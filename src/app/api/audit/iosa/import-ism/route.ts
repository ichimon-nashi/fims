// src/app/api/audit/iosa/import-ism/route.ts
// Parses ISM discipline docx files → seeds audit_iosa_isarps for a cycle
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_DISCIPLINES = ["ORG","FLT","DSP","CAB","GRH","MNT","CGO","SEC"];
const ISARP_RE = /^([A-Z]{2,3} \d+\.\d+(?:\.\d+)?[A-Z]?)$/;
const REF_RE   = /\b([A-Z]{2,3} \d+\.\d+(?:\.\d+)?[A-Z]?)\b/g;
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// Get text from a w:r run element
function runText(r: Element): string {
  return Array.from(r.getElementsByTagNameNS(W, "t"))
    .map(t => t.textContent || "")
    .join("");
}

// Get text from a w:p paragraph element (direct runs only, not nested)
function paraText(p: Element): string {
  return Array.from(p.childNodes)
    .filter(n => (n as Element).localName === "r")
    .map(r => runText(r as Element))
    .join("")
    .replace(/[\u2610\u2611\u2612\u25A1\u25A0☐☑]/g, "") // strip checkbox chars
    .trim();
}

// Get style of a w:p element
function paraStyle(p: Element): string {
  const pPr = Array.from(p.childNodes).find(n => (n as Element).localName === "pPr") as Element | undefined;
  if (!pPr) return "Normal";
  const pStyle = Array.from(pPr.childNodes).find(n => (n as Element).localName === "pStyle") as Element | undefined;
  if (!pStyle) return "Normal";
  return pStyle.getAttributeNS(W, "val") || pStyle.getAttribute("w:val") || "Normal";
}

// Get DIRECT child w:tr elements of a w:tbl (avoid nested table rows)
function directRows(tbl: Element): Element[] {
  return Array.from(tbl.childNodes)
    .filter(n => (n as Element).localName === "tr") as Element[];
}

// Get DIRECT child w:tc of a w:tr
function firstCell(tr: Element): Element | null {
  return Array.from(tr.childNodes).find(n => (n as Element).localName === "tc") as Element || null;
}

// Get paragraphs from a cell (direct w:p children only, not from nested tables)
function cellParas(tc: Element): { text: string; style: string }[] {
  const results: { text: string; style: string }[] = [];
  for (const node of Array.from(tc.childNodes)) {
    const el = node as Element;
    if (el.localName === "p") {
      const txt = paraText(el);
      if (txt) results.push({ text: txt, style: paraStyle(el) });
    }
    // Skip w:tbl nodes (nested tables like Assessment Tool)
  }
  return results;
}

async function parseISMDocx(buffer: Buffer): Promise<any[]> {
  const JSZip = (await import("jszip")).default;
  const { DOMParser } = await import("@xmldom/xmldom");

  const zip    = await JSZip.loadAsync(buffer);
  const xmlStr = await zip.file("word/document.xml")!.async("text");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlStr, "application/xml");

  const body = xmlDoc.getElementsByTagNameNS(W, "body")[0];

  const results: any[] = [];
  let rowOrder  = 0;
  let curH2 = "", curH3 = "", curH4 = "";

  // Iterate ALL direct body children to track heading context per table
  for (const node of Array.from(body.childNodes)) {
    const el   = node as Element;
    const tag  = el.localName;

    // Track headings from w:p elements
    if (tag === "p") {
      const style = paraStyle(el);
      const txt   = paraText(el).trim();
      if (!txt) continue;
      if (style === "Heading2") { curH2 = txt; curH3 = ""; curH4 = ""; }
      else if (style === "Heading3") { curH3 = txt; curH4 = ""; }
      else if (style === "Heading4") { curH4 = txt; }
      continue;
    }

    // Process w:tbl elements
    if (tag !== "tbl") continue;

    const rows = directRows(el);
    if (rows.length < 5) continue;

    const cell0    = firstCell(rows[0]);
    if (!cell0) continue;
    const codeText = cellParas(cell0).map(p => p.text).join("").trim();
    if (!ISARP_RE.test(codeText)) continue;

    const isarpCode = codeText;
    const discMatch = isarpCode.match(/^([A-Z]{2,3})/);
    if (!discMatch || !VALID_DISCIPLINES.includes(discMatch[1])) continue;

    const discipline = discMatch[1];
    const secMatch   = isarpCode.match(/\s(\d+)\./);
    const section    = secMatch ? parseInt(secMatch[1]) : 1;

    // Row 1: Standard text paragraphs
    const cell1   = firstCell(rows[1]);
    const stdParas = cell1 ? cellParas(cell1) : [];
    const stdText  = stdParas.map(p => p.text).join("\n");

    const hasGm  = stdText.includes("(GM)");
    const hasSms = stdText.includes("[SMS]");
    const isRp   = stdText.toLowerCase().includes(" should ") &&
                   !stdText.toLowerCase().includes(" shall ");

    // Cross-references
    const refs: string[] = [];
    REF_RE.lastIndex = 0;
    let refMatch: RegExpExecArray | null;
    while ((refMatch = REF_RE.exec(stdText)) !== null) {
      const ref = refMatch[1];
      if (ref !== isarpCode && !refs.includes(ref)) refs.push(ref);
    }

    // Row 4: Auditor Actions
    const cell4  = firstCell(rows[4]);
    const aaParas = cell4 ? cellParas(cell4) : [];
    const aaItems: { num: string; text: string }[] = [];
    let   aaNum = 1;
    for (const para of aaParas) {
      const txt = para.text.trim();
      if (!txt) continue;
      if (txt === "Auditor Actions") continue;
      if (txt.toLowerCase().startsWith("other actions")) continue;
      aaItems.push({ num: `AA${aaNum}`, text: txt });
      aaNum++;
    }

    // Row 5: Guidance
    let guidance = "";
    if (rows.length >= 6) {
      const cell5 = firstCell(rows[5]);
      if (cell5) {
        const guidText = cellParas(cell5).map(p => p.text).join("\n").trim();
        if (guidText.startsWith("Guidance")) {
          guidance = guidText.replace(/^Guidance\s*\n?/, "").trim();
        }
      }
    }

    results.push({
      isarp_code:      isarpCode,
      discipline,
      section,
      standard_text:   stdText,
      standard_paras:  stdParas,
      isarp_type:      isRp ? "Recommended Practice" : "Standard",
      has_gm:          hasGm,
      has_sms:         hasSms,
      linked_isarps:   refs,
      auditor_actions: aaItems,
      guidance,
      heading_h2:      curH2,
      heading_h3:      curH3,
      heading_h4:      curH4,
      row_order:       rowOrder++,
    });
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const token = extractTokenFromHeader(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    verifyToken(token);

    const formData   = await req.formData();
    const files      = formData.getAll("files") as File[];
    const cycleId    = formData.get("cycle_id") as string | null;
    const ismEdition = (formData.get("ism_edition") as string) || "Ed.18 Rev1";

    if (!cycleId)       return NextResponse.json({ error: "cycle_id required" }, { status: 400 });
    if (!files?.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

    const allIsarps: any[]      = [];
    const allTables: any[]          = [];
    const disciplinesSeen: string[] = [];
    let   globalRowOrder = 0;

    for (const file of files) {
      if (!file.name.endsWith(".docx")) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseISMDocx(buffer);
      if (!parsed.length) continue;

      disciplinesSeen.push(parsed[0].discipline);

      for (const isarp of parsed) {
        allIsarps.push({
          cycle_id:        cycleId,
          isarp_code:      isarp.isarp_code,
          discipline:      isarp.discipline,
          section:         isarp.section,
          standard_text:   isarp.standard_text,
          standard_paras:  isarp.standard_paras,
          isarp_type:      isarp.isarp_type,
          has_gm:          isarp.has_gm,
          has_sms:         isarp.has_sms,
          linked_isarps:   isarp.linked_isarps,
          auditor_actions: isarp.auditor_actions,
          guidance:        isarp.guidance,
          heading_h2:      isarp.heading_h2,
          heading_h3:      isarp.heading_h3,
          heading_h4:      isarp.heading_h4,
          ism_edition:     ismEdition,
          row_order:       globalRowOrder++,
        });
      }

      // Extract named tables from this docx
      const TABLE_NAME_RE = /^(Table\s+[\d.]+)/i;
      const JSZipT = (await import("jszip")).default;
      const { DOMParser: DPT } = await import("@xmldom/xmldom");
      const zipT    = await JSZipT.loadAsync(buffer);
      const xmlStrT = await zipT.file("word/document.xml")!.async("text");
      const xmlDocT = new DPT().parseFromString(xmlStrT, "application/xml");
      const bodyT   = xmlDocT.getElementsByTagNameNS(W, "body")[0];

      for (const nodeT of Array.from(bodyT.childNodes)) {
        const elT = nodeT as Element;
        if (elT.localName !== "tbl") continue;
        const rowsT = directRows(elT);
        if (!rowsT.length) continue;
        const cellT = firstCell(rowsT[0]);
        if (!cellT) continue;
        const firstTextT = cellParas(cellT).map(p => p.text).join(" ").trim();
        const mT = TABLE_NAME_RE.exec(firstTextT);
        if (!mT) continue;

        const tableRef   = mT[1].trim();
        const tableTitle = firstTextT.replace(/\s+/g, " ").trim();
        const contentRows: { cells: string[]; is_header: boolean }[] = [];
        const seenRows = new Set<string>();
        for (let ri = 0; ri < rowsT.length; ri++) {
          const tcs = Array.from(rowsT[ri].childNodes).filter(n => (n as Element).localName === "tc") as Element[];
          const cells = tcs.map(tc => cellParas(tc).map(p => p.text).join(" ").trim());
          const key = cells.join("|||");
          if (seenRows.has(key)) continue;
          seenRows.add(key);
          if (cells.every(c => !c)) continue;
          contentRows.push({ cells, is_header: ri <= 1 });
        }
        allTables.push({ cycle_id: cycleId, table_ref: tableRef, title: tableTitle, discipline: parsed[0].discipline, content_json: contentRows, ism_edition: ismEdition });
      }
    }

    if (!allIsarps.length) {
      return NextResponse.json({ error: "No valid ISARPs found in uploaded files" }, { status: 400 });
    }

    // Upsert in batches of 50 (JSONB fields can be large)
    for (let i = 0; i < allIsarps.length; i += 50) {
      const { error } = await supabase
        .from("audit_iosa_isarps")
        .upsert(allIsarps.slice(i, i + 50), { onConflict: "cycle_id,isarp_code" });
      if (error) throw error;
    }

    // Upsert tables
    if (allTables.length > 0) {
      for (let i = 0; i < allTables.length; i += 50) {
        const { error: tErr } = await supabase
          .from("audit_iosa_tables")
          .upsert(allTables.slice(i, i + 50), { onConflict: "cycle_id,table_ref" });
        if (tErr) console.warn("[import-ism] table upsert warn:", tErr.message);
      }
    }

    return NextResponse.json({
      success:         true,
      isarps_imported: allIsarps.length,
      tables_imported: allTables.length,
      disciplines:     disciplinesSeen,
    });

  } catch (e: any) {
    console.error("[import-ism POST]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}