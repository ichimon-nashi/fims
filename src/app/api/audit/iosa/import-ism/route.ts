// src/app/api/audit/iosa/import-ism/route.ts
// Requires: npm install @xmldom/xmldom
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_DISCIPLINES = ["ORG","FLT","DSP","CAB","GRH","MNT","CGO","SEC"];
const ISARP_RE  = /^([A-Z]{2,3} \d+\.\d+(?:\.\d+)?[A-Z]?)$/;
const REF_RE    = /\b([A-Z]{2,3} \d+\.\d+(?:\.\d+)?[A-Z]?)\b/g;
const TABLE_RE  = /^(Table\s+[\d.]+)/i;
const W         = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// ── DOM helpers ───────────────────────────────────────────────────────────────

function kids(el: Element, localName: string): Element[] {
  return Array.from(el.childNodes).filter(n => (n as Element).localName === localName) as Element[];
}

function runText(r: Element): string {
  return Array.from(r.getElementsByTagNameNS(W, "t"))
    .map(t => t.textContent ?? "")
    .join("");
}

function paraText(p: Element): string {
  return kids(p, "r")
    .map(runText)
    .join("")
    .replace(/[\u2610\u2611\u2612\u25A1\u25A0☐☑◄]/g, "")
    .trim();
}

function paraStyle(p: Element): string {
  const pPr = kids(p, "pPr")[0];
  if (!pPr) return "Normal";
  const pStyle = kids(pPr, "pStyle")[0];
  if (!pStyle) return "Normal";
  return pStyle.getAttributeNS(W, "val") || pStyle.getAttribute("w:val") || "Normal";
}

function paraNumId(p: Element): string | null {
  const pPr = kids(p, "pPr")[0];
  if (!pPr) return null;
  const numPrEl = kids(pPr, "numPr")[0];
  if (!numPrEl) return null;
  const numId = kids(numPrEl, "numId")[0];
  if (!numId) return null;
  return numId.getAttributeNS(W, "val") || numId.getAttribute("w:val") || null;
}

function directRows(tbl: Element): Element[] { return kids(tbl, "tr"); }
function firstCell(tr: Element): Element | null { return kids(tr, "tc")[0] ?? null; }
function allCells(tr: Element): Element[] { return kids(tr, "tc"); }

function cellParas(tc: Element, numFmts?: Record<string, string>): { text: string; style: string; numFmt?: string }[] {
  return kids(tc, "p").map(p => {
    const text = paraText(p);
    if (!text) return null;
    const style = paraStyle(p);
    let numFmt: string | undefined;
    if (style === "iatalistitem" && numFmts) {
      const id = paraNumId(p);
      if (id && numFmts[id]) numFmt = numFmts[id];
    }
    return { text, style, ...(numFmt ? { numFmt } : {}) };
  }).filter(Boolean) as { text: string; style: string; numFmt?: string }[];
}

// Build numId → numFmt from numbering.xml
async function buildNumFormats(zip: InstanceType<typeof JSZip>): Promise<Record<string, string>> {
  const numFile = zip.file("word/numbering.xml");
  if (!numFile) return {};
  const xml = await numFile.async("text");
  const abstractFormats: Record<string, string> = {};
  for (const m of xml.matchAll(/<w:abstractNum[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
    const lvl0 = m[2].match(/<w:lvl[^>]*w:ilvl="0"[^>]*>([\s\S]*?)<\/w:lvl>/);
    if (!lvl0) continue;
    const fmt = lvl0[1].match(/w:numFmt[^>]*w:val="([^"]+)"/)?.[1] ?? "decimal";
    abstractFormats[m[1]] = fmt;
  }
  const result: Record<string, string> = {};
  for (const m of xml.matchAll(/<w:num[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)) {
    const am = m[2].match(/w:abstractNumId w:val="(\d+)"/);
    if (am && abstractFormats[am[1]]) result[m[1]] = abstractFormats[am[1]];
  }
  return result;
}

// ── Parse docx → ISARPs ───────────────────────────────────────────────────────

async function parseDocx(buffer: Buffer) {
  const zip    = await JSZip.loadAsync(buffer);
  const xmlStr = await zip.file("word/document.xml")!.async("text");
  const body   = new DOMParser()
    .parseFromString(xmlStr, "application/xml")
    .getElementsByTagNameNS(W, "body")[0];
  const numFmts = await buildNumFormats(zip);

  const isarps: any[] = [];
  const tables: any[] = [];
  let rowOrder = 0;
  let curH2 = "", curH3 = "", curH4 = "";

  for (const node of Array.from(body.childNodes)) {
    const el  = node as Element;
    const tag = el.localName;

    // Track headings
    if (tag === "p") {
      const style = paraStyle(el);
      const txt   = paraText(el);
      if (!txt) continue;
      if      (style === "Heading2") { curH2 = txt; curH3 = ""; curH4 = ""; }
      else if (style === "Heading3") { curH3 = txt; curH4 = ""; }
      else if (style === "Heading4") { curH4 = txt; }
      continue;
    }

    if (tag !== "tbl") continue;

    const rows = directRows(el);
    if (rows.length < 2) continue;

    const cell0    = firstCell(rows[0]);
    if (!cell0) continue;
    const firstText = cellParas(cell0).map(p => p.text).join("").trim();

    // ── Named table (Table 1.1 etc.) ──
    const tMatch = TABLE_RE.exec(firstText);
    if (tMatch) {
      const tableRef   = tMatch[1].trim();
      const tableTitle = firstText.replace(/\s+/g, " ").trim();
      // Store each cell's paragraphs with style info (not joined strings)
      const contentRows: { cells: { paras: { text: string; style: string; numFmt?: string }[] }[]; is_header: boolean }[] = [];
      const seenKeys = new Set<string>();
      for (let ri = 0; ri < rows.length; ri++) {
        const cells = allCells(rows[ri]).map(tc => ({
          paras: cellParas(tc, numFmts)
        }));
        const key = cells.map(c => c.paras.map(p => p.text).join("|")).join("|||");
        if (seenKeys.has(key) || cells.every(c => !c.paras.length)) continue;
        seenKeys.add(key);
        contentRows.push({ cells, is_header: ri <= 1 });
      }
      tables.push({ tableRef, tableTitle, contentRows });
      continue;
    }

    // ── ISARP table ──
    if (rows.length < 5) continue;
    if (!ISARP_RE.test(firstText)) continue;

    const isarpCode = firstText;
    const discMatch = isarpCode.match(/^([A-Z]{2,3})/);
    if (!discMatch || !VALID_DISCIPLINES.includes(discMatch[1])) continue;

    const discipline = discMatch[1];
    const section    = parseInt(isarpCode.match(/\s(\d+)\./)?.[1] ?? "1");

    const cell1    = firstCell(rows[1]);
    const stdParas = cell1 ? cellParas(cell1, numFmts) : [];
    const stdText  = stdParas.map(p => p.text).join("\n");

    const hasGm  = stdText.includes("(GM)");
    const hasSms = stdText.includes("[SMS]");
    const isRp   = stdText.toLowerCase().includes(" should ") &&
                   !stdText.toLowerCase().includes(" shall ");

    const refs: string[] = [];
    REF_RE.lastIndex = 0;
    let rm: RegExpExecArray | null;
    while ((rm = REF_RE.exec(stdText)) !== null) {
      if (rm[1] !== isarpCode && !refs.includes(rm[1])) refs.push(rm[1]);
    }

    // Extract conformance applicability table from row 2 (nested w:tbl in status cell)
    let conformanceTable: any = null;
    if (rows.length >= 3) {
      const cell2 = firstCell(rows[2]);
      if (cell2) {
        const nestedTbls = kids(cell2, "tbl");
        for (const nt of nestedTbls) {
          const ntRows = directRows(nt);
          if (!ntRows.length) continue;
          const ntText = kids(ntRows[0], "tc")
            .flatMap(tc => kids(tc, "p").map(p => paraText(p)))
            .join(" ").trim();
          if (ntText.toLowerCase().includes("conformance")) {
            const confRows = ntRows.map(nr => ({
              cells: kids(nr, "tc").map(tc =>
                kids(tc, "p").map(p => paraText(p)).filter(Boolean).join(" ").trim()
              )
            }));
            conformanceTable = confRows;
            break;
          }
        }
      }
    }

    const cell4   = firstCell(rows[4]);
    const aaItems: { num: string; text: string }[] = [];
    let aaNum = 1;
    for (const p of cell4 ? cellParas(cell4) : []) {
      const t = p.text.trim();
      if (!t || t === "Auditor Actions" || t.toLowerCase().startsWith("other actions")) continue;
      aaItems.push({ num: `AA${aaNum++}`, text: t });
    }

    let guidance = "";
    if (rows.length >= 6) {
      const cell5 = firstCell(rows[5]);
      if (cell5) {
        const g = cellParas(cell5).map(p => p.text).join("\n").trim();
        if (g.startsWith("Guidance")) guidance = g.replace(/^Guidance\s*\n?/, "").trim();
      }
    }

    isarps.push({
      isarp_code: isarpCode, discipline, section,
      standard_text: stdText, standard_paras: stdParas,
      isarp_type: isRp ? "Recommended Practice" : "Standard",
      has_gm: hasGm, has_sms: hasSms, linked_isarps: refs,
      auditor_actions: aaItems, guidance,
      conformance_table: conformanceTable,
      heading_h2: curH2, heading_h3: curH3, heading_h4: curH4,
      row_order: rowOrder++,
    });
  }

  return { isarps, tables };
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    verifyToken(token);

    const formData   = await req.formData();
    const files      = formData.getAll("files") as File[];
    const cycleId    = formData.get("cycle_id") as string | null;
    const ismEdition = (formData.get("ism_edition") as string) || "Ed.18 Rev1";

    if (!cycleId)       return NextResponse.json({ error: "cycle_id required" },  { status: 400 });
    if (!files?.length) return NextResponse.json({ error: "No files provided" },   { status: 400 });

    const allIsarps: any[] = [];
    const allTables: any[] = [];
    const disciplines: string[] = [];
    let globalOrder = 0;

    for (const file of files) {
      if (!file.name.endsWith(".docx")) continue;
      const { isarps, tables } = await parseDocx(Buffer.from(await file.arrayBuffer()));
      if (!isarps.length) continue;

      const disc = isarps[0].discipline;
      disciplines.push(disc);

      for (const i of isarps) {
        allIsarps.push({ ...i, cycle_id: cycleId, ism_edition: ismEdition, row_order: globalOrder++ });
      }
      for (const t of tables) {
        allTables.push({
          cycle_id: cycleId, table_ref: t.tableRef, title: t.tableTitle,
          discipline: disc, content_json: t.contentRows, ism_edition: ismEdition,
        });
      }
    }

    if (!allIsarps.length) {
      return NextResponse.json({ error: "No valid ISARPs found" }, { status: 400 });
    }

    // Replace existing data for affected disciplines
    for (const disc of disciplines) {
      await supabase.from("audit_iosa_isarps").delete().eq("cycle_id", cycleId).eq("discipline", disc);
      await supabase.from("audit_iosa_tables").delete().eq("cycle_id", cycleId).eq("discipline", disc);
    }

    for (let i = 0; i < allIsarps.length; i += 50) {
      const { error } = await supabase.from("audit_iosa_isarps")
        .upsert(allIsarps.slice(i, i + 50), { onConflict: "cycle_id,isarp_code" });
      if (error) throw error;
    }

    for (let i = 0; i < allTables.length; i += 50) {
      const { error } = await supabase.from("audit_iosa_tables")
        .upsert(allTables.slice(i, i + 50), { onConflict: "cycle_id,table_ref" });
      if (error) throw new Error(`Table upsert failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      isarps_imported: allIsarps.length,
      tables_imported: allTables.length,
      disciplines,
    });

  } catch (e: any) {
    console.error("[import-ism POST]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}