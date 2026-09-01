// src/app/api/audit/routine/self-inspection/[id]/export-attachment/[attachmentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { hasAuditTabAccess } from "@/lib/permissionHelpers";
import JSZip from "jszip";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import fs from "fs";
import path from "path";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const FATIGUE_TEMPLATE_PATH = path.join(process.cwd(), "public/templates/audit_routine_fatigue_template.docx");
const CEFB_TEMPLATE_PATH = path.join(process.cwd(), "public/templates/audit_routine_cefb_template.docx");
// these three items have pre-printed hint text in their remark cell
// (日期 / 版次 / AOR109/FOM) — appending preserves the hint instead of
// wiping it, same reasoning as fatigue's 休時＿＿＿小時 special case
const CEFB_APPEND_REMARK_ITEMS = new Set([4, 8, 9, 33]);

function appendCellText(doc: Document, tc: Element, text: string) {
	const p = tc.getElementsByTagNameNS(W_NS, "p")[0];
	if (!p) return;
	// reuse an existing run's formatting so the appended text matches the
	// pre-printed hint text's font/size instead of falling back to default
	const existingRuns = Array.from(p.getElementsByTagNameNS(W_NS, "r"));
	const sourceRPr = existingRuns.find((r) => r.getElementsByTagNameNS(W_NS, "rPr")[0])?.getElementsByTagNameNS(W_NS, "rPr")[0];
	const r = doc.createElementNS(W_NS, "w:r");
	const rPr = sourceRPr ? (sourceRPr.cloneNode(true) as Element) : buildFallbackRPr(doc, 20);
	stripColor(rPr);
	r.appendChild(rPr);
	const t = doc.createElementNS(W_NS, "w:t");
	t.setAttribute("xml:space", "preserve");
	t.appendChild(doc.createTextNode(" " + text));
	r.appendChild(t);
	p.appendChild(r);
}

async function buildCefbDocx(auditDate: string, flightNo: string, subjectLabel: string, items: { item_no: number; result: string | null; remark: string | null }[]) {
	if (!fs.existsSync(CEFB_TEMPLATE_PATH)) {
		throw new Error(`C-EFB template not found at ${CEFB_TEMPLATE_PATH}`);
	}
	const buffer = fs.readFileSync(CEFB_TEMPLATE_PATH);
	const zip = await JSZip.loadAsync(buffer);
	const xmlText = await zip.file("word/document.xml")!.async("string");
	const dom = new DOMParser().parseFromString(xmlText, "application/xml") as unknown as Document;

	const tables = Array.from(dom.getElementsByTagNameNS(W_NS, "tbl"));
	const headerRows = getRows(tables[0]);
	setCellText(dom, getCells(headerRows[1])[0], auditDate);
	setCellText(dom, getCells(headerRows[1])[1], flightNo);
	setCellText(dom, getCells(headerRows[1])[2], subjectLabel);

	const rows = getRows(tables[1]);
	for (const item of items) {
		const row = rows[item.item_no + 1]; // item 1 -> row index 2 (row0=header, row1=Y/N/NA subheader)
		if (!row) continue;
		const cells = getCells(row);
		if (item.result) {
			const col = item.result === "V" ? 4 : item.result === "X" ? 5 : 6;
			setCellText(dom, cells[col], "✓");
		}
		if (item.remark) {
			if (CEFB_APPEND_REMARK_ITEMS.has(item.item_no)) {
				appendCellText(dom, cells[7], item.remark);
			} else {
				setCellText(dom, cells[7], item.remark, { forcedSize: 16 });
			}
		}
	}

	const serialized = new XMLSerializer().serializeToString(dom);
	zip.file("word/document.xml", serialized);
	return zip.generateAsync({ type: "nodebuffer" });
}

function getRows(table: Element): Element[] {
	return Array.from(table.getElementsByTagNameNS(W_NS, "tr"));
}
function getCells(row: Element): Element[] {
	return Array.from(row.childNodes).filter(
		(n): n is Element => n.nodeType === 1 && (n as Element).localName === "tc",
	);
}
function buildFallbackRPr(doc: Document, size?: number): Element {
	const rPr = doc.createElementNS(W_NS, "w:rPr");
	const fonts = doc.createElementNS(W_NS, "w:rFonts");
	fonts.setAttribute("w:ascii", "Arial");
	fonts.setAttribute("w:hAnsi", "Arial");
	fonts.setAttribute("w:eastAsia", "標楷體"); // = DFKai-SB, matches every existing run in these documents
	fonts.setAttribute("w:cs", "Arial");
	rPr.appendChild(fonts);
	if (size !== undefined) {
		const sz = doc.createElementNS(W_NS, "w:sz");
		sz.setAttribute("w:val", String(size));
		rPr.appendChild(sz);
	}
	return rPr;
}
function stripColor(rPr: Element) {
	for (const c of Array.from(rPr.getElementsByTagNameNS(W_NS, "color"))) rPr.removeChild(c);
}
function forceSize(doc: Document, rPr: Element, size: number) {
	for (const tag of ["sz", "szCs"]) {
		for (const el of Array.from(rPr.getElementsByTagNameNS(W_NS, tag))) rPr.removeChild(el);
		const el = doc.createElementNS(W_NS, `w:${tag}`);
		el.setAttribute("w:val", String(size));
		rPr.appendChild(el);
	}
}
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
// fills the blank-space run between pre-printed label text (e.g. "休時" /
// "小時") without disturbing the surrounding label — used only for the
// two rows (勤前/勤後休時) that have this pre-printed pattern
function fillBlankRun(tc: Element, value: string): boolean {
	const runs = Array.from(tc.getElementsByTagNameNS(W_NS, "t"));
	for (const t of runs) {
		if ((t.textContent ?? "").trim() === "") {
			while (t.firstChild) t.removeChild(t.firstChild);
			t.appendChild(t.ownerDocument!.createTextNode(value));
			return true;
		}
	}
	return false;
}
// trims trailing whitespace-only runs before appending, and uses the
// explicit fallback font rather than cloning "the last run" — verified
// these two documents' padding runs already carry the correct font, but
// applying the same defensive pattern as the main form for consistency
// and in case either template is edited later
function appendToParagraphByLabel(dom: Document, paragraphs: Element[], labelSubstring: string, value: string, fallbackSize = 20): boolean {
	for (const p of paragraphs) {
		const text = Array.from(p.getElementsByTagNameNS(W_NS, "t")).map((t) => t.textContent).join("");
		if (text.includes(labelSubstring)) {
			const runs = Array.from(p.getElementsByTagNameNS(W_NS, "r"));
			for (let i = runs.length - 1; i >= 0; i--) {
				const runText = Array.from(runs[i].getElementsByTagNameNS(W_NS, "t")).map((t) => t.textContent ?? "").join("");
				if (runText.trim() === "") {
					p.removeChild(runs[i]);
				} else {
					break;
				}
			}
			const r = dom.createElementNS(W_NS, "w:r");
			const rPr = buildFallbackRPr(dom, fallbackSize);
			r.appendChild(rPr);
			const t = dom.createElementNS(W_NS, "w:t");
			t.setAttribute("xml:space", "preserve");
			t.appendChild(dom.createTextNode(value));
			r.appendChild(t);
			p.appendChild(r);
			return true;
		}
	}
	return false;
}


async function buildFatigueDocx(subjectLabel: string, inspectorName: string, auditDate: string, items: { item_no: number; result: string | null; remark: string | null }[]) {
	if (!fs.existsSync(FATIGUE_TEMPLATE_PATH)) {
		throw new Error(`Fatigue template not found at ${FATIGUE_TEMPLATE_PATH}`);
	}
	const buffer = fs.readFileSync(FATIGUE_TEMPLATE_PATH);
	const zip = await JSZip.loadAsync(buffer);
	const xmlText = await zip.file("word/document.xml")!.async("string");
	const dom = new DOMParser().parseFromString(xmlText, "application/xml") as unknown as Document;

	const paragraphs = Array.from(dom.getElementsByTagNameNS(W_NS, "p"));
	appendToParagraphByLabel(dom, paragraphs, "受檢人員編/姓名", subjectLabel);
	appendToParagraphByLabel(dom, paragraphs, "檢查人員", inspectorName);
	appendToParagraphByLabel(dom, paragraphs, "檢查日期", auditDate);

	const table = dom.getElementsByTagNameNS(W_NS, "tbl")[0];
	const rows = getRows(table);

	// items 1-14 map directly to table rows 1-14 (row 0 is the header row)
	// — verified against the real file, not assumed
	for (const item of items) {
		const rowIdx = item.item_no; // item_no 1 → row index 1, etc. — coincidentally aligned since row 0 is the header
		const row = rows[rowIdx];
		if (!row) continue;
		const cells = getCells(row);
		setCellText(dom, cells[2], item.result ?? "");
		if (item.item_no === 6 || item.item_no === 7) {
			// preserve the pre-printed "休時＿＿＿小時" text, fill only the blank
			if (item.remark) fillBlankRun(cells[3], item.remark);
		} else {
			setCellText(dom, cells[3], item.remark ?? "", { forcedSize: 16 });
		}
	}

	const serialized = new XMLSerializer().serializeToString(dom);
	zip.file("word/document.xml", serialized);
	return zip.generateAsync({ type: "nodebuffer" });
}

export async function GET(
	req: NextRequest,
	context: { params: Promise<{ id: string; attachmentId: string }> },
) {
	const { id, attachmentId } = await context.params;

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
	if (!hasAuditTabAccess(user, "routine").granted)
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const { data: form } = await supabase.from("audit_routine_forms").select("*").eq("id", id).single();
	if (!form)
		return NextResponse.json({ error: "Submission not found" }, { status: 404 });

	const { data: attachment } = await supabase
		.from("audit_routine_form_attachments")
		.select("*, checklist_templates(code, name)")
		.eq("id", attachmentId)
		.eq("form_id", id)
		.single();
	if (!attachment)
		return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

	const code = (attachment as any).checklist_templates?.code;

	function formatDateForFilename(dateStr: string): string {
		return dateStr.replace(/-/g, ""); // 2026-09-01 -> 20260901
	}

	const { data: items } = await supabase
		.from("audit_routine_items")
		.select("item_no, result, remark")
		.eq("form_id", id)
		.eq("item_type", "attachment")
		.eq("attachment_id", attachmentId);

	const subjectLabel = attachment.subject_employee_id
		? `${attachment.subject_employee_id}/${attachment.subject_crew_name}`
		: attachment.subject_crew_name;

	if (code === "fatigue") {
		const { data: submitter } = await supabase
			.from("users")
			.select("full_name")
			.eq("employee_id", form.submitted_by)
			.single();

		const buffer = await buildFatigueDocx(
			subjectLabel,
			submitter?.full_name ?? form.submitted_by,
			form.audit_date,
			items ?? [],
		);

		return new NextResponse(buffer, {
			status: 200,
			headers: {
				"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`自我督察疲檢附件_${formatDateForFilename(form.audit_date)}.docx`)}`,
			},
		});
	}

	if (code === "c_efb") {
		const buffer = await buildCefbDocx(form.audit_date, form.flight_no ?? "", subjectLabel, items ?? []);
		return new NextResponse(buffer, {
			status: 200,
			headers: {
				"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`自我督察附件- C-EFB_${formatDateForFilename(form.audit_date)}.docx`)}`,
			},
		});
	}

	return NextResponse.json({ error: `匯出功能尚未支援此附件類型（${code}）` }, { status: 501 });
}