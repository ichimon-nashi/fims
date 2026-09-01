// src/app/api/audit/routine/self-inspection/[id]/export-docx/route.ts
//
// REPLACES the earlier docx-library reconstruction — this version edits
// the actual template file's XML directly, verified cell-by-cell against
// the real September 2026 form (see chat notes). Requires the template
// file at TEMPLATE_PATH below (the cleared/blank version, with the
// hardcoded August date and the 5 hardcoded focus rows removed).
//
// Structural assumptions, all verified against the real file, not guessed:
// - Table 0 (header): 6 real <w:tc> per row.
//     row0 tc1 = date value (vMerge-restart, spans row0+row1 — edit row0, not row1)
//     row1 tc2..5 = 機型/機號/班號/航段 (blank, independent cells)
//     row3 tc1/tc2 = CA / FO name
//     row5 tc1..5 = cabin crew names, under row4 labels F1/1L, F2/1R, F3/3L, 3R, Z2
// - Table 1 (checklist): 6 real <w:tc> per main-item row: [item, CCOM(gridSpan2),
//     CCSM, standard, result, remark]. Main items occupy rows 3-29 (27 safety)
//     and 31-37 (7 service), in the exact same order as checklist_template_items.
//     Row 38 is the "本月加強重點檢查" header — dynamic focus rows are inserted
//     immediately after it. Whatever row follows (originally "查核結果及建議")
//     is found by text match, not a hardcoded index, since it shifts depending
//     on how many focus rows get inserted.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { hasAuditTabAccess } from "@/lib/permissionHelpers";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import fs from "fs";
import path from "path";

const TEMPLATE_PATH = path.join(process.cwd(), "public/templates/audit_routine_main_template.docx");
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// column slots on the real form — 5 fixed positions, NOT the same as the
// app's DUTY_OPTIONS list (which has 6: 1L,1R,3L,3R,Z2,3RA). A crew member
// assigned "3RA" has no matching column and is silently omitted from the
// printed form — confirmed acceptable per instruction, not a bug.
const CREW_COLUMN_MATCH: { label: string; matches: string[] }[] = [
	{ label: "F1/1L", matches: ["F1", "1L"] },
	{ label: "F2/1R", matches: ["F2", "1R"] },
	{ label: "F3/3L", matches: ["F3", "3L"] },
	{ label: "3R", matches: ["3R"] },
	{ label: "Z2", matches: ["Z2"] },
];

function fleetFromTail(tail: string): "ATR" | "B738" | null {
	if (/^B168/i.test(tail)) return "ATR";
	if (/^B186/i.test(tail)) return "B738";
	return null;
}

function buildFallbackRPr(doc: Document, size?: number): Element {
	const rPr = doc.createElementNS(W_NS, "w:rPr");
	const fonts = doc.createElementNS(W_NS, "w:rFonts");
	fonts.setAttribute("w:ascii", "Arial");
	fonts.setAttribute("w:hAnsi", "Arial");
	fonts.setAttribute("w:eastAsia", "標楷體"); // = DFKai-SB
	fonts.setAttribute("w:cs", "Arial");
	rPr.appendChild(fonts);
	if (size !== undefined) {
		const sz = doc.createElementNS(W_NS, "w:sz");
		sz.setAttribute("w:val", String(size));
		rPr.appendChild(sz);
		const szCs = doc.createElementNS(W_NS, "w:szCs");
		szCs.setAttribute("w:val", String(size));
		rPr.appendChild(szCs);
	}
	return rPr;
}

// strips any w:color from an rPr (in place) so app-generated text always
// renders in the document's default/automatic color (black), regardless
// of what the source cell/run it was cloned from happened to specify —
// some cells in this document use blue or red for other purposes
function stripColor(rPr: Element) {
	for (const c of Array.from(rPr.getElementsByTagNameNS(W_NS, "color"))) {
		rPr.removeChild(c);
	}
}

// forces a specific size (in half-points, e.g. 16 = 8pt) on an rPr,
// replacing whatever sz/szCs it already had — used for remark columns,
// which must always be 8pt regardless of what the source cell specified
function forceSize(doc: Document, rPr: Element, size: number) {
	for (const tag of ["sz", "szCs"]) {
		for (const el of Array.from(rPr.getElementsByTagNameNS(W_NS, tag))) rPr.removeChild(el);
		const el = doc.createElementNS(W_NS, `w:${tag}`);
		el.setAttribute("w:val", String(size));
		rPr.appendChild(el);
	}
}

// sets a <w:tc>'s text content to a single run — preserves the existing
// font-family formatting (e.g. DFKai-SB/標楷體) from the paragraph's
// default rPr or an existing run's rPr, but always strips color (forces
// black) and optionally forces an exact size (for remark columns, 8pt)
function setCellText(doc: Document, tc: Element, text: string, opts: { fallbackSize?: number; forcedSize?: number } = {}) {
	const p = tc.getElementsByTagNameNS(W_NS, "p")[0];
	if (!p) return;
	const pPr = p.getElementsByTagNameNS(W_NS, "pPr")[0];
	const defaultRPr = pPr?.getElementsByTagNameNS(W_NS, "rPr")[0];
	const existingRuns = Array.from(p.getElementsByTagNameNS(W_NS, "r"));
	const sourceRPr =
		existingRuns.find((r) => r.getElementsByTagNameNS(W_NS, "rPr")[0])?.getElementsByTagNameNS(W_NS, "rPr")[0] ??
		defaultRPr;
	for (const r of existingRuns) p.removeChild(r);
	if (!text) return;
	const r = doc.createElementNS(W_NS, "w:r");
	const rPr = sourceRPr ? (sourceRPr.cloneNode(true) as Element) : buildFallbackRPr(doc, opts.fallbackSize ?? 20);
	stripColor(rPr);
	if (opts.forcedSize !== undefined) forceSize(doc, rPr, opts.forcedSize);
	r.appendChild(rPr);
	const t = doc.createElementNS(W_NS, "w:t");
	t.setAttribute("xml:space", "preserve");
	t.appendChild(doc.createTextNode(text));
	r.appendChild(t);
	p.appendChild(r);
}

// for a brand-new paragraph (e.g. the inserted comment line)
function setRunFont(doc: Document, p: Element, text: string, fallbackSize = 20) {
	const pPr = p.getElementsByTagNameNS(W_NS, "pPr")[0];
	const defaultRPr = pPr?.getElementsByTagNameNS(W_NS, "rPr")[0];
	const r = doc.createElementNS(W_NS, "w:r");
	const rPr = defaultRPr ? (defaultRPr.cloneNode(true) as Element) : buildFallbackRPr(doc, fallbackSize);
	stripColor(rPr);
	r.appendChild(rPr);
	const t = doc.createElementNS(W_NS, "w:t");
	t.setAttribute("xml:space", "preserve");
	t.appendChild(doc.createTextNode(text));
	r.appendChild(t);
	p.appendChild(r);
}

// appends into an EXISTING label paragraph (e.g. "檢查員："). Real bug
// fixed here: this used to clone "the last run's" rPr, but the last run
// is frequently a trailing whitespace-padding run using a plain fallback
// font (Arial, not 標楷體) — visually confirmed in the actual template.
// Cloning it produced both the wrong font AND (since we appended after
// all that padding) the large gap before the injected name. Now: any
// trailing whitespace-only runs are removed first, and the font always
// comes from the explicit fallback (reliable) rather than a guessed sibling.
function appendRunWithFont(doc: Document, existingParagraph: Element, text: string, fallbackSize = 20) {
	const runs = Array.from(existingParagraph.getElementsByTagNameNS(W_NS, "r"));
	for (let i = runs.length - 1; i >= 0; i--) {
		const runText = Array.from(runs[i].getElementsByTagNameNS(W_NS, "t")).map((t) => t.textContent ?? "").join("");
		if (runText.trim() === "") {
			existingParagraph.removeChild(runs[i]);
		} else {
			break; // stop at the first non-whitespace run from the end
		}
	}
	const r = doc.createElementNS(W_NS, "w:r");
	const rPr = buildFallbackRPr(doc, fallbackSize);
	r.appendChild(rPr);
	const t = doc.createElementNS(W_NS, "w:t");
	t.setAttribute("xml:space", "preserve");
	t.appendChild(doc.createTextNode(text));
	r.appendChild(t);
	existingParagraph.appendChild(r);
}

function getRows(table: Element): Element[] {
	return Array.from(table.getElementsByTagNameNS(W_NS, "tr"));
}

function getCells(row: Element): Element[] {
	// direct children only — getElementsByTagNameNS would also pick up
	// nested tables' cells if any existed, which none do here, but being
	// explicit avoids that entire class of bug
	return Array.from(row.childNodes).filter(
		(n): n is Element => n.nodeType === 1 && (n as Element).localName === "tc",
	);
}

function rowText(row: Element): string {
	return Array.from(row.getElementsByTagNameNS(W_NS, "t"))
		.map((t) => t.textContent ?? "")
		.join("");
}

// builds one dynamic focus-item row as a fresh XML fragment, matching the
// exact structure of the original template's focus rows (captured and
// verified from the real file, not reconstructed from guesswork) —
// hardcoded here since the template no longer contains a literal row to
// clone from (the reusable template has them removed, by design)
function buildFocusRowXml(itemText: string, result: string, remark: string): string {
	const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	return `<w:tr xmlns:w="${W_NS}">
  <w:trPr><w:trHeight w:val="340" w:hRule="atLeast"/></w:trPr>
  <w:tc>
    <w:tcPr><w:tcW w:w="7215" w:type="dxa"/><w:gridSpan w:val="5"/>
      <w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:start w:val="single" w:sz="18" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:end w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders>
      <w:vAlign w:val="center"/></w:tcPr>
    <w:p><w:pPr><w:pStyle w:val="Normal"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="6"/></w:numPr><w:spacing w:lineRule="atLeast" w:line="0"/><w:ind w:hanging="238" w:start="238" w:end="0"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="標楷體" w:cs="Arial"/><w:sz w:val="20"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="標楷體"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(itemText)}</w:t></w:r>
    </w:p>
  </w:tc>
  <w:tc>
    <w:tcPr><w:tcW w:w="567" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:start w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:end w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tcBorders></w:tcPr>
    <w:p><w:pPr><w:pStyle w:val="Normal"/><w:snapToGrid w:val="false"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="標楷體" w:cs="Arial"/><w:sz w:val="20"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:rFonts w:eastAsia="標楷體" w:cs="Arial" w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${esc(result)}</w:t></w:r>
    </w:p>
  </w:tc>
  <w:tc>
    <w:tcPr><w:tcW w:w="2118" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:start w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:end w:val="single" w:sz="18" w:space="0" w:color="000000"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>
    <w:p><w:pPr><w:pStyle w:val="Normal"/><w:snapToGrid w:val="false"/><w:spacing w:lineRule="atLeast" w:line="0"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="標楷體" w:cs="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:rFonts w:eastAsia="標楷體" w:cs="Arial" w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">${esc(remark)}</w:t></w:r>
    </w:p>
  </w:tc>
</w:tr>`;
}

export async function GET(
	req: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;

	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();

	const { data: userRecord } = await supabase
		.from("users")
		.select("employee_id, app_permissions")
		.eq("id", decoded.userId)
		.single();
	if (!userRecord)
		return NextResponse.json({ error: "User not found" }, { status: 404 });

	const user = { employee_id: userRecord.employee_id, app_permissions: userRecord.app_permissions } as any;

	const { data: form, error: formError } = await supabase
		.from("audit_routine_forms")
		.select("*")
		.eq("id", id)
		.single();
	if (formError || !form)
		return NextResponse.json({ error: "Submission not found" }, { status: 404 });

	const canView = hasAuditTabAccess(user, "routine").granted;
	if (!canView && form.submitted_by !== userRecord.employee_id)
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const { data: allItems } = await supabase.from("audit_routine_items").select("*").eq("form_id", id);
	const { data: mainTemplateItems } = await supabase
		.from("checklist_template_items")
		.select("*")
		.eq("template_id", form.template_id)
		.order("sort_order", { ascending: true });

	let focusItems: { item_no: number; item_text: string }[] = [];
	if (form.focus_set_id) {
		const { data } = await supabase
			.from("monthly_focus_items")
			.select("item_no, item_text")
			.eq("focus_set_id", form.focus_set_id)
			.order("sort_order", { ascending: true });
		focusItems = data ?? [];
	}

	function findAnswer(itemType: string, itemNo: number) {
		return (allItems ?? []).find((it) => it.item_type === itemType && it.item_no === itemNo && it.attachment_id === null);
	}

	// ---- load template ----
	if (!fs.existsSync(TEMPLATE_PATH)) {
		return NextResponse.json({ error: `Template not found at ${TEMPLATE_PATH}` }, { status: 500 });
	}
	const templateBuffer = fs.readFileSync(TEMPLATE_PATH);
	const zip = await JSZip.loadAsync(templateBuffer);
	const documentXmlPath = "word/document.xml";
	const xmlText = await zip.file(documentXmlPath)!.async("string");
	const dom = new DOMParser().parseFromString(xmlText, "application/xml") as unknown as Document;

	const tables = Array.from(dom.getElementsByTagNameNS(W_NS, "tbl"));
	if (tables.length < 2) {
		return NextResponse.json({ error: "Template structure unexpected — fewer than 2 tables found" }, { status: 500 });
	}
	const headerTable = tables[0];
	const checklistTable = tables[1];

	// ---- header table ----
	const headerRows = getRows(headerTable);
	setCellText(dom, getCells(headerRows[0])[1], form.audit_date); // date — row0, not row1 (vMerge-restart cell)

	const fleet = fleetFromTail(form.aircraft_tail);
	setCellText(dom, getCells(headerRows[1])[2], fleet ?? "");
	setCellText(dom, getCells(headerRows[1])[3], form.aircraft_tail);
	setCellText(dom, getCells(headerRows[1])[4], form.flight_no ?? "");
	setCellText(dom, getCells(headerRows[1])[5], form.route ?? "");

	setCellText(dom, getCells(headerRows[3])[1], form.ca_name ?? "");
	setCellText(dom, getCells(headerRows[3])[2], form.fo_name ?? "");

	const cabinCrew: { position: string; name: string }[] = form.cabin_crew ?? [];
	const crewRow5Cells = getCells(headerRows[5]);
	CREW_COLUMN_MATCH.forEach((col, idx) => {
		const match = cabinCrew.find((c) => col.matches.includes(c.position));
		setCellText(dom, crewRow5Cells[idx + 1], match?.name ?? ""); // +1 skips the label cell at index 0
	});

	// ---- main checklist items (rows 3-29 = 27 safety, 31-37 = 7 service) ----
	const checklistRows = getRows(checklistTable);
	const mainItemRowIndices = [
		...Array.from({ length: 27 }, (_, i) => 3 + i),
		...Array.from({ length: 7 }, (_, i) => 31 + i),
	];
	(mainTemplateItems ?? []).forEach((templateItem, i) => {
		const rowIdx = mainItemRowIndices[i];
		if (rowIdx === undefined) return; // more DB items than template rows — template/DB out of sync, skip rather than crash
		const cells = getCells(checklistRows[rowIdx]);
		const answer = findAnswer("main", templateItem.item_no);
		setCellText(dom, cells[4], answer?.result ?? "");
		setCellText(dom, cells[5], answer?.remark ?? "", { forcedSize: 16 }); // 8pt per instruction
	});

	// ---- monthly focus: dynamic row insertion ----
	// find the header row and the row that follows it by TEXT, not a
	// hardcoded index — the template has zero focus rows between them by
	// design, so "the very next row" is always correct here regardless of
	// how many rows get inserted on this pass
	const focusHeaderRow = checklistRows.find((r) => rowText(r).includes("本月加強重點檢查"));
	if (focusHeaderRow && focusItems.length > 0) {
		const parent = focusHeaderRow.parentNode!;
		let insertBeforeNode = focusHeaderRow.nextSibling;
		for (const item of focusItems) {
			const answer = findAnswer("focus", item.item_no);
			const rowXmlStr = buildFocusRowXml(item.item_text, answer?.result ?? "", answer?.remark ?? "");
			const rowDoc = new DOMParser().parseFromString(rowXmlStr, "application/xml") as unknown as Document;
			const importedRow = dom.importNode(rowDoc.documentElement, true);
			parent.insertBefore(importedRow, insertBeforeNode);
		}
	}

	// ---- comments + 檢查員 (inspector name = whoever submitted the form) ----
	const commentsRow = checklistRows.find((r) => rowText(r).includes("查核結果及建議"));
	if (commentsRow) {
		const firstCell = getCells(commentsRow)[0];
		const paragraphs = Array.from(firstCell.getElementsByTagNameNS(W_NS, "p"));

		if (form.comments) {
			// insert right after the label paragraph, not appended at the very
			// end — appending at the end visually landed the comment below the
			// 檢查員 signature line, confirmed by rendering to PDF and looking
			const labelParagraph = paragraphs[0];
			const p = dom.createElementNS(W_NS, "w:p");
			setRunFont(dom, p, form.comments, 20);
			if (labelParagraph && labelParagraph.nextSibling) {
				firstCell.insertBefore(p, labelParagraph.nextSibling);
			} else {
				firstCell.appendChild(p);
			}
		}

		const { data: submitter } = await supabase
			.from("users")
			.select("full_name")
			.eq("employee_id", form.submitted_by)
			.single();
		const inspectorParagraph = paragraphs.find((p) =>
			Array.from(p.getElementsByTagNameNS(W_NS, "t")).map((t) => t.textContent).join("").includes("檢查員"),
		);
		if (inspectorParagraph) {
			appendRunWithFont(dom, inspectorParagraph, submitter?.full_name ?? form.submitted_by);
		}
	}

	const serialized = new XMLSerializer().serializeToString(dom);
	zip.file(documentXmlPath, serialized);
	const outBuffer = await zip.generateAsync({ type: "nodebuffer" });

	return new NextResponse(outBuffer, {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`自我督察表_${form.audit_date.replace(/-/g, "")}.docx`)}`,
		},
	});
}