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

/** Like paraText but descends into nested <w:sdt><w:sdtContent> content controls
 *  and preserves <w:br/> as newlines — required for the AA cell where the user's
 *  labeled remarks (AA1: ..., AA2: ...) may live inside a nested sdt sibling of
 *  the checkbox run within the same paragraph, separated by <w:br/>. */
function paraFullText(p: Element): string {
  const parts: string[] = [];
  function walk(el: Element) {
    for (const child of Array.from(el.childNodes) as Element[]) {
      const ln = child.localName;
      if (ln === "t") parts.push(child.textContent ?? "");
      else if (ln === "br") parts.push("\n");
      else if (ln === "r" || ln === "sdtContent" || ln === "sdt") walk(child);
    }
  }
  walk(p);
  return parts.join("").replace(/[\u2610\u2611\u2612\u25A1\u25A0☐☑◄]/g, "").trim();
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

/** Find a w14:checkbox content control nested anywhere inside this paragraph.
 *  Returns null if the paragraph has no checkbox (i.e. it's a plain remarks line). */
function paraCheckbox(p: Element): { checked: boolean } | null {
  const sdts = p.getElementsByTagNameNS(W, "sdt");
  for (const sdt of Array.from(sdts) as Element[]) {
    const sdtPr = kids(sdt, "sdtPr")[0];
    if (!sdtPr) continue;
    const cb = kids(sdtPr, "checkbox")[0]; // w14:checkbox shares localName "checkbox"
    if (!cb) continue;
    const checkedEl = kids(cb, "checked")[0];
    const val = checkedEl?.getAttributeNS(W, "val") ?? checkedEl?.getAttribute("w14:val") ?? "0";
    return { checked: val === "1" };
  }
  return null;
}

/** Like paraText, but renders w:br elements as newlines instead of collapsing them —
 *  needed for "Auditor Comments" cells which use <w:br/> between numbered lines
 *  inside a single paragraph rather than separate paragraphs. */
function paraTextWithBreaks(p: Element): string {
  const parts: string[] = [];
  for (const r of kids(p, "r")) {
    for (const child of Array.from(r.childNodes) as Element[]) {
      if (child.localName === "t") parts.push(child.textContent ?? "");
      else if (child.localName === "br") parts.push("\n");
    }
  }
  return parts.join("")
    .replace(/[\u2610\u2611\u2612\u25A1\u25A0☐☑◄]/g, "")
    .trim();
}

/** Find paragraphs inside a table cell, including those nested one level inside
 *  a content-control wrapper (w:sdt > w:sdtContent > w:p), as used by free-text
 *  fields like "Auditor Comments". Does NOT descend into nested w:tbl. */
function cellAllParas(tc: Element): Element[] {
  const result: Element[] = [];
  for (const node of Array.from(tc.childNodes) as Element[]) {
    if (node.localName === "p") result.push(node);
    else if (node.localName === "sdt") {
      const content = kids(node, "sdtContent")[0];
      if (content) result.push(...kids(content, "p"));
    }
  }
  return result;
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

function cellGridSpan(tc: Element): number {
  const tcPr = kids(tc, "tcPr")[0];
  if (!tcPr) return 1;
  const gs = kids(tcPr, "gridSpan")[0];
  if (!gs) return 1;
  return parseInt(gs.getAttributeNS(W, "val") || gs.getAttribute("w:val") || "1", 10) || 1;
}

function directRows(tbl: Element): Element[] { return kids(tbl, "tr"); }
function firstCell(tr: Element): Element | null { return kids(tr, "tc")[0] ?? null; }
function allCells(tr: Element): Element[] { return kids(tr, "tc"); }

/** Build row cells preserving span — NO filler cells, renderer uses gridColumn: span N */
function expandRow(
  tr: Element,
  numFmts?: Record<string, string>
): { paras: { text: string; style: string; numFmt?: string }[]; span: number }[] {
  return allCells(tr).map(tc => ({
    paras: cellParas(tc, numFmts),
    span:  cellGridSpan(tc),
  }));
}

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

      // Expand all rows respecting colspan so every row has the same number of columns
      type TableCell = { paras: { text: string; style: string; numFmt?: string }[]; span: number };
      type TableRow  = { cells: TableCell[]; is_header: boolean };
      const contentRows: TableRow[] = [];
      const seenKeys = new Set<string>();
      let colCount = 0;

      // First pass: compute true column count by summing spans in multi-cell rows
      for (let ri = 0; ri < rows.length; ri++) {
        const cells = allCells(rows[ri]);
        if (cells.length > 1) {
          const totalCols = cells.reduce((sum, tc) => sum + cellGridSpan(tc), 0);
          colCount = Math.max(colCount, totalCols);
        }
      }
      if (colCount === 0) colCount = 1;

      // Second pass: build content rows
      for (let ri = 0; ri < rows.length; ri++) {
        const physicalCells = allCells(rows[ri]);
        const isFullSpan = physicalCells.length === 1; // title, note, or intro row

        let cells: TableCell[];
        if (isFullSpan) {
          // Store as single full-width cell — don't expand
          const paras = cellParas(physicalCells[0], numFmts);
          if (!paras.length) continue; // empty row — skip
          const rowText = paras.map(p => p.text).join("").trim();
          // Skip if it's the title row (already stored in tableTitle)
          if (rowText === tableTitle.replace(/\s+/g, " ").trim()) continue;
          cells = [{ paras, span: colCount }]; // span entire width
        } else {
          cells = expandRow(rows[ri], numFmts);
        }

        const key = cells.map(c => c.paras.map(p => p.text).join("|")).join("|||");
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        // is_header: rows where all cells are short labels (no iatalistitem, short text)
        const isHeader = !isFullSpan && cells.every(c =>
          c.paras.length <= 2 && c.paras.every(p => p.style !== "iatalistitem" && p.text.length < 60)
        ) && ri < 6; // only first few rows can be headers

        contentRows.push({ cells, is_header: isHeader });
      }

      tables.push({ tableRef, tableTitle, colCount, contentRows });
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

    // Extract the 5-way conformity checkbox group from row 2.
    // The docx itself disambiguates Finding vs Observation per-ISARP at the label
    // level (e.g. CAB 3.1.4C's checkboxes say "...(Observation)" while CAB 3.1.4B's
    // say "...(Finding)" for the identical 3 documented/implemented combinations) —
    // so both label variants are mapped directly to the final, already-correct
    // audit_iosa_records.conformance_status value. No isarp_type inference needed.
    const CONFORMITY_LABEL_MAP: Record<string, string> = {
      "documented and implemented (conformity)":     "conformity",
      "documented not implemented (finding)":        "finding_doc_not_impl",
      "implemented not documented (finding)":        "finding_impl_not_doc",
      "not documented not implemented (finding)":    "finding_not_doc_not_impl",
      "documented not implemented (observation)":    "obs_doc_not_impl",
      "implemented not documented (observation)":    "obs_impl_not_doc",
      "not documented not implemented (observation)": "obs_not_doc_not_impl",
      "n/a":                                          "na",
    };
    let conformanceStatus: string | null = null;
    if (rows.length >= 3) {
      const cell2 = firstCell(rows[2]);
      if (cell2) {
        for (const p of kids(cell2, "p")) {
          const cb = paraCheckbox(p);
          if (!cb || !cb.checked) continue;
          const label = paraText(p).trim().toLowerCase();
          const mapped = CONFORMITY_LABEL_MAP[label];
          if (mapped) { conformanceStatus = mapped; break; }
        }
      }
    }

    // Extract "Auditor Comments" free text from row 3 → doc_references.
    // This field is wrapped in a content control (w:sdt > w:sdtContent > w:p),
    // so we use cellAllParas (not the plain kids(cell,"p")) to find it, and
    // paraTextWithBreaks to preserve the <w:br/> line breaks between i./ii./iii. lines.
    let docReferences = "";
    if (rows.length >= 4) {
      const cell3 = firstCell(rows[3]);
      if (cell3) {
        const texts = cellAllParas(cell3)
          .map(p => paraTextWithBreaks(p))
          .filter(t => t && t !== "Auditor Comments" && t !== "Click or tap here to enter text.");
        docReferences = texts.join("\n").trim();
      }
    }

    const cell4   = firstCell(rows[4]);
    const aaItems: { num: string; text: string; checked: boolean; remarks: string }[] = [];
    if (cell4) {
      const aaParas = kids(cell4, "p");
      let current: { num: string; text: string; checked: boolean; remarks: string } | null = null;
      let aaNum = 1;
      for (const p of aaParas) {
        // Use paraFullText (not paraText) so we descend into nested sdt content
        // controls — the user's labeled remarks (AA1: ..., AA2: ...) may live inside
        // a <w:sdt><w:sdtContent> nested within the "Other Actions" paragraph itself,
        // separated from the checkbox run by a <w:br/>.
        const t = paraFullText(p);
        if (!t || t === "Auditor Actions") continue;

        const cb = paraCheckbox(p);
        if (cb) {
          // Split on the first line that looks like an AA label — everything before
          // is the checkbox label text; everything from that line onward is the
          // labeled remarks block the user typed into the nested content control.
          const lines = t.split("\n").map(s => s.trim()).filter(Boolean);
          const labelBlockStart = lines.findIndex(
            l => /^AA\d+\s*:/i.test(l) || /^AA_other\s*:/i.test(l)
          );
          const checkboxText = (labelBlockStart > 0 ? lines.slice(0, labelBlockStart) : lines)
            .join(" ")
            .replace(/[\u2610\u2611\u2612\u25A1\u25A0☐☑◄]/g, "")
            .trim();

          const isOther = checkboxText.toLowerCase().startsWith("other action");
          current = {
            num: isOther ? "AA_other" : `AA${aaNum++}`,
            text: checkboxText || t,
            checked: cb.checked,
            remarks: "",
          };
          aaItems.push(current);

          // If a labeled block was embedded in this paragraph, dispatch each segment.
          if (labelBlockStart >= 0) {
            const block = lines.slice(labelBlockStart).join("\n");
            const segments = block.split(/(?=AA\d+\s*:|AA_other\s*:)/i).filter(Boolean);
            for (const seg of segments) {
              const m = seg.match(/^(AA(\d+)|AA_other)\s*:\s*([\s\S]+)$/i);
              if (!m) continue;
              const key = m[2] ? `AA${m[2]}` : "AA_other";
              const remark = m[3].trim();
              const target = aaItems.find(a => a.num === key);
              if (target) target.remarks = target.remarks ? `${target.remarks}\n${remark}` : remark;
            }
          }
        } else {
          // No checkbox — either a separate-paragraph labeled block (AA1: ..., AA2: ...)
          // or an interleaved remark sitting directly beneath its checkbox paragraph.
          const labelMatch = t.match(/^(AA(\d+)|AA_other)\s*:\s*([\s\S]+)$/i);
          if (labelMatch) {
            const labelKey = labelMatch[2] ? `AA${labelMatch[2]}` : "AA_other";
            const remark = labelMatch[3].trim();
            const target = aaItems.find(a => a.num === labelKey);
            if (target) target.remarks = target.remarks ? `${target.remarks}\n${remark}` : remark;
          } else if (current) {
            current.remarks = current.remarks ? `${current.remarks}\n${t}` : t;
          }
        }
      }
    }

    let guidance = "";
    let guidance_paras: { text: string; style: string; numFmt?: string }[] = [];
    if (rows.length >= 6) {
      const cell5 = firstCell(rows[5]);
      if (cell5) {
        const allParas = cellParas(cell5, numFmts);
        // Strip leading "Guidance" header para
        const bodyParas = allParas[0]?.text?.trim() === "Guidance"
          ? allParas.slice(1)
          : allParas;
        guidance = bodyParas.map(p => p.text).join("\n").trim();
        guidance_paras = bodyParas;
      }
    }

    isarps.push({
      isarp_code: isarpCode, discipline, section,
      standard_text: stdText, standard_paras: stdParas,
      isarp_type: isRp ? "Recommended Practice" : "Standard",
      has_gm: hasGm, has_sms: hasSms, linked_isarps: refs,
      auditor_actions: aaItems, guidance, guidance_paras,
      conformance_table: conformanceTable,
      conformance_status: conformanceStatus, doc_references: docReferences,
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
    const allRecords: any[] = [];
    const disciplines: string[] = [];
    let globalOrder = 0;

    for (const file of files) {
      if (!file.name.endsWith(".docx")) continue;
      const { isarps, tables } = await parseDocx(Buffer.from(await file.arrayBuffer()));
      if (!isarps.length) continue;

      const disc = isarps[0].discipline;
      disciplines.push(disc);

      for (const i of isarps) {
        // audit_iosa_isarps keeps its existing shape exactly — strip ONLY the new
        // conformance fields that don't belong in that table. auditor_actions stays —
        // it's an original field of audit_iosa_isarps, not something new.
        const { conformance_status, doc_references, ...isarpFields } = i;
        const auditor_actions = i.auditor_actions;
        allIsarps.push({ ...isarpFields, cycle_id: cycleId, ism_edition: ismEdition, row_order: globalOrder++ });

        // audit_iosa_records gets the conformance data extracted from this same docx.
        // aa_responses shape matches what AuditPrep already reads/writes:
        // { AA1: { completed: bool, remarks: string }, ... }
        const aaResponses: Record<string, { completed: boolean; remarks: string }> = {};
        for (const aa of auditor_actions as { num: string; checked: boolean; remarks: string }[]) {
          aaResponses[aa.num] = { completed: aa.checked, remarks: aa.remarks };
        }
        allRecords.push({
          cycle_id: cycleId,
          isarp_code: i.isarp_code,
          discipline: disc,
          doc_references: doc_references || "",
          conformance_status: conformance_status,
          aa_responses: aaResponses,
        });
      }
      for (const t of tables) {
        allTables.push({
          cycle_id: cycleId, table_ref: t.tableRef, title: t.tableTitle,
          discipline: disc, content_json: t.contentRows, col_count: t.colCount,
          ism_edition: ismEdition,
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

    // Upsert conformance data extracted from the same docx into audit_iosa_records.
    // This does NOT delete existing records first (unlike isarps/tables above) —
    // a record may already hold prep_flagged/assigned_auditor_id/etc. set via the
    // FIMS UI that this import has no knowledge of and must not wipe out.
    //
    // It also must not blindly overwrite aa_responses/doc_references/conformance_status
    // wholesale: if an auditor has already ticked a box or typed a remark in AuditPrep
    // since the last import, re-uploading the same (or an updated) docx must not erase
    // that. Rule: per AA key, keep the EXISTING value if it's already non-empty
    // (completed=true OR remarks non-blank); only fill in from the docx when the
    // existing slot is still at its untouched default. Same idea for doc_references
    // and conformance_status — only fill if the existing value is empty/null.
    if (allRecords.length) {
      const codes = allRecords.map(r => r.isarp_code);
      const { data: existingRecords, error: fetchErr } = await supabase
        .from("audit_iosa_records")
        .select("isarp_code, aa_responses, doc_references, conformance_status")
        .eq("cycle_id", cycleId)
        .in("isarp_code", codes);
      if (fetchErr) throw new Error(`Failed to fetch existing records: ${fetchErr.message}`);

      const existingByCode = new Map((existingRecords ?? []).map(r => [r.isarp_code, r]));

      for (const rec of allRecords) {
        const existing = existingByCode.get(rec.isarp_code);
        if (!existing) continue; // no existing row — the freshly parsed docx values stand as-is

        // Per-key AA merge: the docx is the source of truth. Only keep the existing
        // DB value if it has a non-empty remark — that's the only reliable signal a
        // human has typed something in AuditPrep that the docx doesn't also contain.
        // completed:true alone is NOT sufficient: a previous import sets completed:true
        // with empty remarks, and we must not let that stale value block fresh docx
        // data (including real remarks) from landing on re-import.
        const existingAA = (existing.aa_responses ?? {}) as Record<string, { completed: boolean; remarks: string }>;
        const mergedAA: Record<string, { completed: boolean; remarks: string }> = { ...rec.aa_responses };
        for (const num of Object.keys(existingAA)) {
          const ex = existingAA[num];
          const humanRemark = ex && ex.remarks && ex.remarks.trim();
          if (humanRemark) mergedAA[num] = ex; // non-empty remark = human typed something, preserve it
        }
        rec.aa_responses = mergedAA;

        // doc_references and conformance_status always take the fresh docx value —
        // these fields are filled in Word, not typed by users in AuditPrep, so the
        // docx is unconditionally authoritative. No merge protection needed here.
      }
    }

    for (let i = 0; i < allRecords.length; i += 50) {
      const { error } = await supabase.from("audit_iosa_records")
        .upsert(allRecords.slice(i, i + 50), { onConflict: "cycle_id,isarp_code" });
      if (error) throw new Error(`Records upsert failed: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      isarps_imported: allIsarps.length,
      tables_imported: allTables.length,
      records_imported: allRecords.length,
      disciplines,
    });

  } catch (e: any) {
    console.error("[import-ism POST]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}