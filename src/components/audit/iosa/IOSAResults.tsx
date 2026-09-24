// src/components/audit/iosa/IOSAResults.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./IOSAResults.module.css";

interface ActiveCycle {
	id: string;
	name: string;
	disciplines: string[];
	ism_edition: string;
	status: string;
}
interface AuditRecord {
	isarp_code: string;
	discipline: string;
	conformance_status: string | null;
	nonconformity_desc: string;
	root_cause: string;
	corrective_action: string;
	doc_references: string;
	open_item?: boolean;
	auditor_comments?: string;
	aa_responses?: Record<string, { completed?: boolean }>;
}
interface ISARPWithRecord {
	isarp_code: string;
	discipline: string;
	isarp_type: string;
	standard_text: string;
	// Returned by the auditprep GET (select *) — used by the ISARP reference modal
	standard_paras?: { text: string; style: string; numFmt?: string }[];
	auditor_actions?: { num: string; text: string }[];
	guidance?: string;
	record: AuditRecord | null;
}
interface DiscStat {
	disc: string;
	total: number;
	assessed: number;
	conformities: number;
	findings: number;
	observations: number;
	findingItems: ISARPWithRecord[];
	obsItems: ISARPWithRecord[];
	open: number;
	noteItems: ISARPWithRecord[]; // non-NC items with comments or open flag
}

function catOf(s: string | null) {
	if (!s) return null;
	if (s.startsWith("Conformity")) return "conformity";
	if (s.startsWith("Finding")) return "finding";
	if (s.startsWith("Observation")) return "observation";
	if (s.startsWith("N/A")) return "na";
	return null;
}

// Short form for UI display only
function shortStatus(s: string | null) {
	if (!s) return "";
	return s
		.replace(
			"Finding (Not Documented, Not Implemented)",
			"Not Doc · Not Impl",
		)
		.replace("Finding (Not Documented, Implemented)", "Not Doc · Impl")
		.replace("Finding (Documented, Not Implemented)", "Doc · Not Impl")
		.replace(
			"Observation (Not Documented, Not Implemented)",
			"Not Doc · Not Impl",
		)
		.replace("Observation (Not Documented, Implemented)", "Not Doc · Impl")
		.replace("Observation (Documented, Not Implemented)", "Doc · Not Impl")
		.replace("Conformity (Documented and Implemented)", "Conformity")
		.replace("N/A (Not Applicable)", "N/A");
}

// Full form for Excel export — no abbreviations
function fullStatus(s: string | null) {
	if (!s) return "";
	return s
		.replace(
			"Finding (Not Documented, Not Implemented)",
			"Finding — Not Documented, Not Implemented",
		)
		.replace(
			"Finding (Not Documented, Implemented)",
			"Finding — Not Documented, Implemented",
		)
		.replace(
			"Finding (Documented, Not Implemented)",
			"Finding — Documented, Not Implemented",
		)
		.replace(
			"Observation (Not Documented, Not Implemented)",
			"Observation — Not Documented, Not Implemented",
		)
		.replace(
			"Observation (Not Documented, Implemented)",
			"Observation — Not Documented, Implemented",
		)
		.replace(
			"Observation (Documented, Not Implemented)",
			"Observation — Documented, Not Implemented",
		)
		.replace(
			"Conformity (Documented and Implemented)",
			"Conformity — Documented and Implemented",
		)
		.replace("N/A (Not Applicable)", "N/A — Not Applicable");
}

// ── Export (ExcelJS — SheetJS community build cannot style cells) ──
const XL = {
	navy: "FF0D1220",
	navy2: "FF1B2340",
	white: "FFFFFFFF",
	text: "FF1F2937",
	dim: "FF6B7280",
	zebra: "FFF6F8FB",
	border: "FFD9DEE7",
	redBg: "FFFDE8E8",
	redFg: "FFB42318",
	amberBg: "FFFEF3E2",
	amberFg: "FFB54708",
	greenBg: "FFE7F6EC",
	greenFg: "FF1E7B45",
	blueBg: "FFE8F1FE",
	blueFg: "FF1D5FBF",
	greyBg: "FFF0F1F4",
};
const FONT = "Calibri";

type XCol = { header: string; key: string; width: number; wrap?: boolean; center?: boolean };

function statusColors(s: string | null) {
	const c = catOf(s);
	if (c === "finding") return { bg: XL.redBg, fg: XL.redFg };
	if (c === "observation") return { bg: XL.amberBg, fg: XL.amberFg };
	if (c === "conformity") return { bg: XL.greenBg, fg: XL.greenFg };
	if (c === "na") return { bg: XL.greyBg, fg: XL.dim };
	return null;
}

// Excel does not reliably auto-fit wrapped rows on open, so estimate height.
// CJK glyphs count as ~2 Latin chars wide.
function estLines(text: string, width: number) {
	if (!text) return 1;
	const perLine = Math.max(1, Math.floor(width * 1.15));
	return String(text)
		.split(/\r?\n/)
		.reduce((n, para) => {
			let w = 0;
			for (const ch of para) w += /[\u2E80-\uFFEF]/.test(ch) ? 2 : 1;
			return n + Math.max(1, Math.ceil(w / perLine));
		}, 0);
}

function fill(argb: string) {
	return { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } };
}

const thin = { style: "thin" as const, color: { argb: XL.border } };

// Title band + styled table. Returns the worksheet.
function addTableSheet(
	wb: any,
	name: string,
	title: string,
	subtitle: string,
	cols: XCol[],
	rows: Record<string, any>[],
	statusKey?: string,
	rawStatus?: (string | null)[],
) {
	const ws = wb.addWorksheet(name, {
		views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
		pageSetup: {
			orientation: "landscape",
			paperSize: 9, // A4
			fitToPage: true,
			fitToWidth: 1,
			fitToHeight: 0,
			margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
		},
	});
	ws.pageSetup.printTitlesRow = "4:4";
	ws.headerFooter.oddFooter = `&L${title}&RPage &P of &N`;
	ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
	const last = cols.length;

	ws.mergeCells(1, 1, 1, last);
	const t = ws.getCell(1, 1);
	t.value = title;
	t.font = { name: FONT, size: 15, bold: true, color: { argb: XL.white } };
	t.fill = fill(XL.navy);
	t.alignment = { vertical: "middle", indent: 1 };
	ws.getRow(1).height = 30;

	ws.mergeCells(2, 1, 2, last);
	const st = ws.getCell(2, 1);
	st.value = subtitle;
	st.font = { name: FONT, size: 10, color: { argb: "FFA8B3C5" } };
	st.fill = fill(XL.navy2);
	st.alignment = { vertical: "middle", indent: 1 };
	ws.getRow(2).height = 20;
	ws.getRow(3).height = 8;

	const hr = ws.getRow(4);
	cols.forEach((c, i) => {
		const cell = hr.getCell(i + 1);
		cell.value = c.header;
		cell.font = { name: FONT, size: 10, bold: true, color: { argb: XL.white } };
		cell.fill = fill(XL.navy2);
		cell.alignment = { vertical: "middle", horizontal: c.center ? "center" : "left", wrapText: true };
		cell.border = { bottom: { style: "medium", color: { argb: "FF4A9EFF" } } };
	});
	hr.height = 24;

	if (rows.length === 0) {
		ws.mergeCells(5, 1, 5, last);
		const e = ws.getCell(5, 1);
		e.value = "None recorded.";
		e.font = { name: FONT, size: 10, italic: true, color: { argb: XL.dim } };
		e.alignment = { horizontal: "center" };
		return ws;
	}

	rows.forEach((r, idx) => {
		const row = ws.addRow(r);
		row.eachCell({ includeEmpty: true }, (cell: any, colNo: number) => {
			const c = cols[colNo - 1];
			if (!c) return;
			cell.font = { name: FONT, size: 10, color: { argb: XL.text } };
			cell.alignment = {
				vertical: "top",
				horizontal: c.center ? "center" : "left",
				wrapText: !!c.wrap,
			};
			cell.border = { bottom: thin };
			if (idx % 2 === 1) cell.fill = fill(XL.zebra);
		});
		if (statusKey && rawStatus) {
			const col = cols.findIndex((c) => c.key === statusKey) + 1;
			const sc = statusColors(rawStatus[idx]);
			if (col > 0 && sc) {
				const cell = row.getCell(col);
				cell.fill = fill(sc.bg);
				cell.font = { name: FONT, size: 10, bold: true, color: { argb: sc.fg } };
			}
		}
		const lines = Math.max(
			1,
			...cols.filter((c) => c.wrap).map((c) => estLines(r[c.key] ?? "", c.width)),
		);
		row.height = Math.min(409, lines * 13.5 + 6);
		const codeCol = cols.findIndex((c) => c.key === "isarp") + 1;
		if (codeCol > 0) row.getCell(codeCol).font = { name: FONT, size: 10, bold: true, color: { argb: XL.text } };
	});

	ws.autoFilter = {
		from: { row: 4, column: 1 },
		to: { row: 4 + rows.length, column: last },
	};
	return ws;
}

async function doExport(
	cycle: ActiveCycle,
	all: ISARPWithRecord[],
	findings: ISARPWithRecord[],
	obs: ISARPWithRecord[],
	discStats: DiscStat[],
) {
	const ExcelJS = (await import("exceljs")).default;
	const wb = new ExcelJS.Workbook();
	wb.creator = "FIMS";
	wb.created = new Date();

	const exported = new Date().toLocaleDateString("en-CA");
	const sub = `${cycle.name}  ·  ${cycle.ism_edition}  ·  Exported ${exported}`;
	const desc = (i: ISARPWithRecord) =>
		i.standard_text?.split("\n")[0]?.slice(0, 200) ?? "";
	const openMark = (i: ISARPWithRecord) => (i.record?.open_item ? "◷ Open" : "");

	// ── Summary ──
	const ws1 = wb.addWorksheet("Summary", {
		views: [{ showGridLines: false }],
		pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
	});
	ws1.columns = [
		{ width: 16 }, { width: 11 }, { width: 11 }, { width: 13 },
		{ width: 14 }, { width: 11 }, { width: 14 }, { width: 12 },
	];
	ws1.mergeCells("A1:H1");
	ws1.getCell("A1").value = "IOSA Audit Results";
	ws1.getCell("A1").font = { name: FONT, size: 18, bold: true, color: { argb: XL.white } };
	ws1.getCell("A1").fill = fill(XL.navy);
	ws1.getCell("A1").alignment = { vertical: "middle", indent: 1 };
	ws1.getRow(1).height = 36;
	ws1.mergeCells("A2:H2");
	ws1.getCell("A2").value = sub;
	ws1.getCell("A2").font = { name: FONT, size: 10, color: { argb: "FFA8B3C5" } };
	ws1.getCell("A2").fill = fill(XL.navy2);
	ws1.getCell("A2").alignment = { vertical: "middle", indent: 1 };
	ws1.getRow(2).height = 20;

	// KPI tiles (row 4 value, row 5 label)
	const tot = (k: keyof DiscStat) =>
		discStats.reduce((s, d) => s + (d[k] as number), 0);
	const totalAll = tot("total");
	const assessedAll = tot("assessed");
	const kpis: [string, number, string][] = [
		["Total ISARPs", totalAll, XL.text],
		[`Assessed · ${totalAll ? Math.round((assessedAll / totalAll) * 100) : 0}%`, assessedAll, XL.blueFg],
		["Conformities", tot("conformities"), XL.greenFg],
		["Findings", tot("findings"), XL.redFg],
		["Observations", tot("observations"), XL.amberFg],
		["Open items", tot("open"), XL.blueFg],
	];
	ws1.getRow(4).height = 30;
	ws1.getRow(5).height = 18;
	kpis.forEach(([label, val, color], i) => {
		const col = i + 1;
		const v = ws1.getCell(4, col);
		v.value = val;
		v.font = { name: FONT, size: 16, bold: true, color: { argb: color } };
		v.alignment = { horizontal: "center", vertical: "bottom" };
		v.fill = fill(XL.zebra);
		const l = ws1.getCell(5, col);
		l.value = label.toUpperCase();
		l.font = { name: FONT, size: 8, bold: true, color: { argb: XL.dim } };
		l.alignment = { horizontal: "center", vertical: "top" };
		l.fill = fill(XL.zebra);
		l.border = { bottom: thin };
	});

	// Discipline table
	const hdr = ["Discipline", "Total", "Assessed", "% Assessed", "Conformities", "Findings", "Observations", "Open items"];
	const h = ws1.getRow(7);
	hdr.forEach((t, i) => {
		const c = h.getCell(i + 1);
		c.value = t;
		c.font = { name: FONT, size: 10, bold: true, color: { argb: XL.white } };
		c.fill = fill(XL.navy2);
		c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
		c.border = { bottom: { style: "medium", color: { argb: "FF4A9EFF" } } };
	});
	h.height = 22;
	discStats.forEach((d, idx) => {
		const pct = d.total ? d.assessed / d.total : 0;
		const r = ws1.getRow(8 + idx);
		[d.disc, d.total, d.assessed, pct, d.conformities, d.findings, d.observations, d.open].forEach((v, i) => {
			const c = r.getCell(i + 1);
			c.value = v;
			c.font = { name: FONT, size: 10, bold: i === 0, color: { argb: XL.text } };
			c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
			c.border = { bottom: thin };
			if (idx % 2 === 1) c.fill = fill(XL.zebra);
		});
		r.getCell(4).numFmt = "0%";
		if (pct >= 1) r.getCell(4).font = { name: FONT, size: 10, bold: true, color: { argb: XL.greenFg } };
		if (d.findings > 0) r.getCell(6).font = { name: FONT, size: 10, bold: true, color: { argb: XL.redFg } };
		if (d.observations > 0) r.getCell(7).font = { name: FONT, size: 10, bold: true, color: { argb: XL.amberFg } };
		if (d.open > 0) r.getCell(8).font = { name: FONT, size: 10, bold: true, color: { argb: XL.blueFg } };
		r.height = 20;
	});
	const tr = ws1.getRow(8 + discStats.length);
	["TOTAL", totalAll, assessedAll, totalAll ? assessedAll / totalAll : 0, tot("conformities"), tot("findings"), tot("observations"), tot("open")].forEach((v, i) => {
		const c = tr.getCell(i + 1);
		c.value = v;
		c.font = { name: FONT, size: 10, bold: true, color: { argb: XL.text } };
		c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
		c.border = { top: { style: "double", color: { argb: XL.text } } };
		c.fill = fill(XL.greyBg);
	});
	tr.getCell(4).numFmt = "0%";
	tr.height = 22;

	// ── Findings / Observations ──
	const ncCols = (label: string): XCol[] => [
		{ header: "#", key: "n", width: 5, center: true },
		{ header: "Discipline", key: "disc", width: 11, center: true },
		{ header: "ISARP", key: "isarp", width: 14 },
		{ header: "ISARP Description", key: "desc", width: 48, wrap: true },
		{ header: "Document Reference", key: "doc", width: 26, wrap: true },
		{ header: "Status", key: "status", width: 30, wrap: true },
		{ header: label, key: "nc", width: 50, wrap: true },
		{ header: "Root Cause", key: "rc", width: 34, wrap: true },
		{ header: "Corrective Action", key: "ca", width: 34, wrap: true },
		{ header: "Auditor Comments", key: "cm", width: 34, wrap: true },
		{ header: "Open", key: "open", width: 9, center: true },
	];
	const ncRow = (i: ISARPWithRecord, n: number) => ({
		n: n + 1,
		disc: i.discipline,
		isarp: i.isarp_code,
		desc: desc(i),
		doc: i.record?.doc_references ?? "",
		status: fullStatus(i.record?.conformance_status ?? null),
		nc: i.record?.nonconformity_desc ?? "",
		rc: i.record?.root_cause ?? "",
		ca: i.record?.corrective_action ?? "",
		cm: i.record?.auditor_comments ?? "",
		open: openMark(i),
	});
	addTableSheet(wb, "Findings", `Findings (${findings.length})`, sub, ncCols("Nonconformity"),
		findings.map(ncRow), "status", findings.map((i) => i.record?.conformance_status ?? null));
	addTableSheet(wb, "Observations", `Observations (${obs.length})`, sub, ncCols("Observation"),
		obs.map(ncRow), "status", obs.map((i) => i.record?.conformance_status ?? null));

	// ── Open items + Auditor comments (any status) ──
	const noteCols: XCol[] = [
		{ header: "#", key: "n", width: 5, center: true },
		{ header: "Discipline", key: "disc", width: 11, center: true },
		{ header: "ISARP", key: "isarp", width: 14 },
		{ header: "Status", key: "status", width: 30, wrap: true },
		{ header: "Open", key: "open", width: 9, center: true },
		{ header: "Auditor Comments", key: "cm", width: 60, wrap: true },
		{ header: "Document Reference", key: "doc", width: 28, wrap: true },
		{ header: "ISARP Description", key: "desc", width: 48, wrap: true },
	];
	const noteRow = (i: ISARPWithRecord, n: number) => ({
		n: n + 1,
		disc: i.discipline,
		isarp: i.isarp_code,
		status: fullStatus(i.record?.conformance_status ?? null) || "Pending",
		open: openMark(i),
		cm: i.record?.auditor_comments ?? "",
		doc: i.record?.doc_references ?? "",
		desc: desc(i),
	});
	const openItems = all.filter((i) => i.record?.open_item);
	addTableSheet(wb, "Open Items", `Open items (${openItems.length})`, sub, noteCols,
		openItems.map(noteRow), "status", openItems.map((i) => i.record?.conformance_status ?? null));
	const commented = all.filter((i) => i.record?.auditor_comments?.trim());
	addTableSheet(wb, "Auditor Comments", `Auditor comments — all statuses (${commented.length})`, sub, noteCols,
		commented.map(noteRow), "status", commented.map((i) => i.record?.conformance_status ?? null));

	// ── Per-discipline detail sheets (disciplines with F/O) ──
	discStats.forEach((d) => {
		const items = [...d.findingItems, ...d.obsItems];
		if (!items.length) return;
		const isF = (i: ISARPWithRecord) =>
			i.record?.conformance_status?.startsWith("Finding") ?? false;
		addTableSheet(
			wb,
			d.disc,
			`${d.disc} — ${d.findings} finding(s), ${d.observations} observation(s)`,
			sub,
			[
				{ header: "ISARP", key: "isarp", width: 14 },
				{ header: "Type", key: "type", width: 12, center: true },
				{ header: "Status", key: "status", width: 30, wrap: true },
				{ header: "Nonconformity / Observation", key: "nc", width: 50, wrap: true },
				{ header: "Root Cause", key: "rc", width: 34, wrap: true },
				{ header: "Corrective Action", key: "ca", width: 34, wrap: true },
				{ header: "Doc References", key: "doc", width: 26, wrap: true },
				{ header: "Auditor Comments", key: "cm", width: 34, wrap: true },
				{ header: "Open", key: "open", width: 9, center: true },
			],
			items.map((i) => ({
				isarp: i.isarp_code,
				type: isF(i) ? "Finding" : "Observation",
				status: fullStatus(i.record?.conformance_status ?? null),
				nc: i.record?.nonconformity_desc ?? "",
				rc: isF(i) ? (i.record?.root_cause ?? "") : "",
				ca: isF(i) ? (i.record?.corrective_action ?? "") : "",
				doc: i.record?.doc_references ?? "",
				cm: i.record?.auditor_comments ?? "",
				open: openMark(i),
			})),
			"status",
			items.map((i) => i.record?.conformance_status ?? null),
		);
	});

	const buf = await wb.xlsx.writeBuffer();
	const blob = new Blob([buf], {
		type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `IOSA_results_${new Date().getFullYear()}.xlsx`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── ISARP reference modal (original standard, guidance, auditor actions) ──
const REF_ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv"];

function IsarpRefModal({
	isarp,
	onClose,
}: {
	isarp: ISARPWithRecord;
	onClose: () => void;
}) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const r = isarp.record;
	const paras =
		isarp.standard_paras && isarp.standard_paras.length > 0
			? isarp.standard_paras
			: (isarp.standard_text ?? "")
					.split(/\r?\n/)
					.map((t) => ({ text: t, style: "Normal" }) as { text: string; style: string; numFmt?: string });
	const counters: Record<string, number> = {};
	let lastStyle = "";
	const aaDone = Object.values(r?.aa_responses ?? {}).filter((x) => x?.completed).length;

	return (
		<div className={styles.refOverlay} onClick={onClose}>
			<div
				className={styles.refModal}
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-label={`${isarp.isarp_code} reference`}
			>
				<div className={styles.refHeader}>
					<div className={styles.refTitleWrap}>
						<span className={styles.refCode}>{isarp.isarp_code}</span>
						<span className={styles.refType}>{isarp.isarp_type}</span>
						{r?.conformance_status && (
							<span className={styles.refStatus}>{fullStatus(r.conformance_status)}</span>
						)}
					</div>
					<button className={styles.refClose} onClick={onClose} aria-label="Close">
						✕
					</button>
				</div>
				<div className={styles.refBody}>
					<div className={styles.refSection}>
						<div className={styles.ncFL}>Standard</div>
						<div className={styles.refStd}>
							{paras.map((p, idx) => {
								const isList = p.style === "iatalistitem";
								if (isList && lastStyle !== "iatalistitem") counters[p.numFmt ?? "def"] = 0;
								lastStyle = p.style;
								let prefix = "";
								if (isList) {
									const fmt = p.numFmt ?? "lowerRoman";
									const n = counters[fmt] ?? 0;
									counters[fmt] = n + 1;
									prefix =
										fmt === "bullet"
											? "•"
											: fmt === "decimal"
												? `${n + 1}.`
												: fmt === "lowerLetter"
													? `${String.fromCharCode(97 + n)}.`
													: `${REF_ROMAN[n] ?? n + 1}.`;
								}
								return (
									<div key={idx} className={isList ? styles.refStdItem : styles.refStdLine}>
										{isList && <span className={styles.refStdPrefix}>{prefix}</span>}
										<span>{p.text}</span>
									</div>
								);
							})}
						</div>
					</div>
					{isarp.guidance && (
						<div className={styles.refSection}>
							<div className={styles.ncFL}>Guidance</div>
							<div className={styles.refGuidance}>{isarp.guidance}</div>
						</div>
					)}
					{(isarp.auditor_actions?.length ?? 0) > 0 && (
						<div className={styles.refSection}>
							<div className={styles.ncFL}>
								Auditor Actions · {aaDone}/{isarp.auditor_actions!.length} completed
							</div>
							{isarp.auditor_actions!.map((aa) => {
								const done = !!r?.aa_responses?.[aa.num]?.completed;
								return (
									<div key={aa.num} className={`${styles.refAA} ${done ? styles.refAADone : ""}`}>
										<span className={styles.refAABox}>{done ? "✓" : ""}</span>
										<span>{aa.text}</span>
									</div>
								);
							})}
						</div>
					)}
					{r?.doc_references && (
						<div className={styles.refSection}>
							<div className={styles.ncFL}>Doc References</div>
							<div className={styles.refDocs}>{r.doc_references}</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ── NC inline row ─────────────────────────────────────────────
function NCRow({
	isarp,
	globalIdx,
	isFinding,
}: {
	isarp: ISARPWithRecord;
	globalIdx: number;
	isFinding: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [showRef, setShowRef] = useState(false);
	const r = isarp.record!;
	const color = isFinding ? styles.ncFinding : styles.ncObs;
	// Description is always visible now, so the body only holds the rest
	const hasBody =
		(isFinding && (r.root_cause || r.corrective_action)) ||
		r.doc_references ||
		r.auditor_comments?.trim();
	return (
		<div className={`${styles.ncRow} ${color} ${r.open_item ? styles.ncRowOpen : ""}`}>
			<div
				className={styles.ncRowTop}
				onClick={() => hasBody && setOpen((o) => !o)}
			>
				<span className={styles.ncIdx}>
					{String(globalIdx).padStart(2, "0")}
				</span>
				<button
					className={`${styles.ncCode} ${styles.ncCodeBtn}`}
					onClick={(e) => {
						e.stopPropagation();
						setShowRef(true);
					}}
					title="View original ISARP"
				>
					{isarp.isarp_code}
				</button>
				<span
					className={`${styles.ncStatusPill} ${isFinding ? styles.ncStatusPillF : styles.ncStatusPillO}`}
				>
					{isFinding ? "F" : "O"} ·{" "}
					{shortStatus(r.conformance_status)}
				</span>
				{r.open_item && (
					<span
						className={`${styles.ncStatusPill} ${styles.ncStatusPillOpen}`}
					>
						◷ Open item
					</span>
				)}
				<span className={styles.ncSpacer} />
				{hasBody && (
					<span
						className={styles.ncChevron}
						style={{ transform: open ? "rotate(180deg)" : "none" }}
					>
						▾
					</span>
				)}
			</div>
			{r.nonconformity_desc && (
				<div
					className={styles.ncDesc}
					onClick={() => hasBody && setOpen((o) => !o)}
				>
					{r.nonconformity_desc}
				</div>
			)}
			{open && (
				<div className={styles.ncBody}>
					{isFinding && r.root_cause && (
						<div className={styles.ncField}>
							<div className={styles.ncFL}>Root Cause</div>
							<div className={styles.ncFV}>{r.root_cause}</div>
						</div>
					)}
					{isFinding && r.corrective_action && (
						<div className={styles.ncField}>
							<div className={styles.ncFL}>Corrective Action</div>
							<div className={styles.ncFV}>
								{r.corrective_action}
							</div>
						</div>
					)}
					{r.doc_references && (
						<div className={styles.ncField}>
							<div className={styles.ncFL}>Doc References</div>
							<div className={styles.ncFV}>
								{r.doc_references}
							</div>
						</div>
					)}
					{r.auditor_comments?.trim() && (
						<div className={styles.ncField}>
							<div className={styles.ncFL}>Auditor Comments</div>
							<div className={styles.ncFV}>
								{r.auditor_comments}
							</div>
						</div>
					)}
				</div>
			)}
			{showRef && (
				<IsarpRefModal isarp={isarp} onClose={() => setShowRef(false)} />
			)}
		</div>
	);
}

// ── Note row: conformity / N/A / pending items with comments or open flag ──
function NoteRow({ isarp }: { isarp: ISARPWithRecord }) {
	const [open, setOpen] = useState(false);
	const [showRef, setShowRef] = useState(false);
	const r = isarp.record!;
	const cat = catOf(r.conformance_status);
	const comment = r.auditor_comments?.trim() ?? "";
	const label =
		cat === "conformity" ? "Conformity" : cat === "na" ? "N/A" : "Pending";
	return (
		<div className={`${styles.ncRow} ${styles.ncNote} ${r.open_item ? styles.ncRowOpen : ""}`}>
			<div
				className={styles.ncRowTop}
				onClick={() => comment && setOpen((o) => !o)}
			>
				<span className={styles.ncIdx}>
					{cat === "conformity" ? "C" : cat === "na" ? "NA" : "—"}
				</span>
				<button
					className={`${styles.ncCode} ${styles.ncCodeBtn}`}
					onClick={(e) => {
						e.stopPropagation();
						setShowRef(true);
					}}
					title="View original ISARP"
				>
					{isarp.isarp_code}
				</button>
				<span
					className={`${styles.ncStatusPill} ${cat === "conformity" && !r.open_item ? styles.ncStatusPillC : styles.ncStatusPillN}`}
				>
					{label}
				</span>
				{r.open_item && (
					<span
						className={`${styles.ncStatusPill} ${styles.ncStatusPillOpen}`}
					>
						◷ Open item
					</span>
				)}
				{comment && !open && (
					<span className={styles.ncPreview}>
						{comment.slice(0, 90)}
						{comment.length > 90 ? "…" : ""}
					</span>
				)}
				{comment && (
					<span
						className={styles.ncChevron}
						style={{ transform: open ? "rotate(180deg)" : "none" }}
					>
						▾
					</span>
				)}
			</div>
			{open && (
				<div className={styles.ncBody}>
					<div className={styles.ncField}>
						<div className={styles.ncFL}>Auditor Comments</div>
						<div className={styles.ncFV}>{comment}</div>
					</div>
				</div>
			)}
			{showRef && (
				<IsarpRefModal isarp={isarp} onClose={() => setShowRef(false)} />
			)}
		</div>
	);
}

// ── Discipline row ────────────────────────────────────────────
function DiscRow({
	d,
	fStart,
	oStart,
}: {
	d: DiscStat;
	fStart: number;
	oStart: number;
}) {
	const pct = d.total > 0 ? Math.round((d.assessed / d.total) * 100) : 0;
	const hasNC = d.findings > 0 || d.observations > 0;
	const hasNotes = d.noteItems.length > 0;
	return (
		<div className={`${styles.discRow} ${hasNC ? styles.discRowNC : ""}`}>
			{/* Main row */}
			<div className={styles.discMain}>
				<span className={styles.discCode}>{d.disc}</span>
				<div className={styles.discTrackWrap}>
					<div className={styles.discTrack}>
						<div
							className={styles.discFill}
							style={{ width: `${pct}%` }}
						/>
					</div>
				</div>
				<div className={styles.discPills}>
					{d.conformities > 0 && (
						<span className={`${styles.pill} ${styles.pillG}`}>
							{d.conformities} ✓
						</span>
					)}
					<span
						className={`${styles.pill} ${d.findings > 0 ? styles.pillR : styles.pillX}`}
					>
						{d.findings} F
					</span>
					<span
						className={`${styles.pill} ${d.observations > 0 ? styles.pillA : styles.pillX}`}
					>
						{d.observations} O
					</span>
					{d.open > 0 && (
						<span className={`${styles.pill} ${styles.pillOpen}`}>
							◷ {d.open} open
						</span>
					)}
				</div>
				<span
					className={styles.discPct}
					style={{ color: pct === 100 ? "#48bb78" : "#a0aec0" }}
				>
					{pct}%
				</span>
			</div>
			{/* Inline NC rows */}
			{(hasNC || hasNotes) && (
				<div className={styles.discNCs}>
					{d.findingItems.map((i, idx) => (
						<NCRow
							key={i.isarp_code}
							isarp={i}
							globalIdx={fStart + idx + 1}
							isFinding={true}
						/>
					))}
					{d.obsItems.map((i, idx) => (
						<NCRow
							key={i.isarp_code}
							isarp={i}
							globalIdx={oStart + idx + 1}
							isFinding={false}
						/>
					))}
					{d.noteItems.map((i) => (
						<NoteRow key={i.isarp_code} isarp={i} />
					))}
				</div>
			)}
		</div>
	);
}

// ── Main ──────────────────────────────────────────────────────
export default function IOSAResults({
	activeCycle,
}: {
	activeCycle: ActiveCycle | null;
}) {
	const { token } = useAuth();
	const [allIsarps, setAllIsarps] = useState<ISARPWithRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [exporting, setExporting] = useState(false);

	useEffect(() => {
		if (!activeCycle?.id || !token) return;
		setLoading(true);
		Promise.all(
			activeCycle.disciplines.map((disc) =>
				fetch(
					`/api/audit/iosa/auditprep?cycle_id=${activeCycle.id}&discipline=${disc}`,
					{
						headers: { Authorization: `Bearer ${token}` },
					},
				)
					.then((r) => r.json())
					.then(({ isarps }) => isarps ?? []),
			),
		)
			.then((r) => setAllIsarps(r.flat()))
			.catch(console.error)
			.finally(() => setLoading(false));
	}, [activeCycle?.id, token]);

	const findings = allIsarps.filter(
		(i) => catOf(i.record?.conformance_status ?? null) === "finding",
	);
	const observations = allIsarps.filter(
		(i) => catOf(i.record?.conformance_status ?? null) === "observation",
	);
	const conformities = allIsarps.filter(
		(i) => catOf(i.record?.conformance_status ?? null) === "conformity",
	);
	const assessed = allIsarps.filter((i) => i.record?.conformance_status);
	const openCount = allIsarps.filter((i) => i.record?.open_item).length;
	const pct =
		allIsarps.length > 0
			? Math.round((assessed.length / allIsarps.length) * 100)
			: 0;

	const discStats: DiscStat[] = (activeCycle?.disciplines ?? []).map(
		(disc) => {
			const d = allIsarps.filter((i) => i.discipline === disc);
			return {
				disc,
				total: d.length,
				assessed: d.filter((i) => i.record?.conformance_status).length,
				conformities: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"conformity",
				).length,
				findings: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"finding",
				).length,
				observations: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"observation",
				).length,
				findingItems: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"finding",
				),
				obsItems: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"observation",
				),
				open: d.filter((i) => i.record?.open_item).length,
				noteItems: d.filter((i) => {
					const c = catOf(i.record?.conformance_status ?? null);
					return (
						c !== "finding" &&
						c !== "observation" &&
						(!!i.record?.auditor_comments?.trim() ||
							!!i.record?.open_item)
					);
				}),
			};
		},
	);

	const handleExport = useCallback(async () => {
		if (!activeCycle) return;
		setExporting(true);
		try {
			await doExport(
				activeCycle,
				allIsarps,
				findings,
				observations,
				discStats,
			);
		} catch (e) {
			console.error(e);
		} finally {
			setExporting(false);
		}
	}, [activeCycle, allIsarps, findings, observations, discStats]);

	if (!activeCycle) {
		return (
			<div className={styles.empty}>
				<span className={styles.emptyIcon}>📋</span>
				<p>No active cycle selected.</p>
			</div>
		);
	}

	let fIdx = 0,
		oIdx = 0;

	return (
		<div className={styles.results}>
			{/* Header */}
			<div className={styles.header}>
				<div className={styles.headerLeft}>
					<span className={styles.cycleName}>{activeCycle.name}</span>
					<div className={styles.headerMeta}>
						<span className={styles.badge}>
							{activeCycle.ism_edition}
						</span>
						<span
							className={`${styles.badge} ${activeCycle.status === "active" ? styles.badgeActive : ""}`}
						>
							{activeCycle.status}
						</span>
					</div>
				</div>
				<button
					className={styles.exportBtn}
					onClick={handleExport}
					disabled={exporting || loading || allIsarps.length === 0}
				>
					{exporting ? "Exporting…" : "↓ Export xlsx"}
				</button>
			</div>

			{loading ? (
				<div className={styles.loadingWrap}>
					<div className={styles.spinner} />
				</div>
			) : (
				<>
					{/* Summary strip */}
					<div className={styles.summaryStrip}>
						<div className={styles.stripBlock}>
							<span className={styles.stripVal}>
								{allIsarps.length}
							</span>
							<span className={styles.stripLbl}>Total</span>
						</div>
						<div className={styles.stripDivider} />
						<div className={styles.stripBlock}>
							<span
								className={styles.stripVal}
								style={{ color: "#4a9eff" }}
							>
								{assessed.length}
							</span>
							<span className={styles.stripLbl}>Assessed</span>
						</div>
						<div className={styles.stripBlock}>
							<div className={styles.stripProgress}>
								<div
									className={styles.stripProgressFill}
									style={{ width: `${pct}%` }}
								/>
							</div>
							<span className={styles.stripPct}>{pct}%</span>
						</div>
						<div className={styles.stripDivider} />
						<div className={styles.stripBlock}>
							<span
								className={styles.stripVal}
								style={{
									color:
										conformities.length > 0
											? "#48bb78"
											: undefined,
								}}
							>
								{conformities.length}
							</span>
							<span className={styles.stripLbl}>
								Conformities
							</span>
						</div>
						<div className={styles.stripDivider} />
						<div className={styles.stripBlock}>
							<span
								className={styles.stripVal}
								style={{
									color:
										findings.length > 0
											? "#fc8181"
											: undefined,
								}}
							>
								{findings.length}
							</span>
							<span className={styles.stripLbl}>Findings</span>
						</div>
						<div className={styles.stripBlock}>
							<span
								className={styles.stripVal}
								style={{
									color:
										observations.length > 0
											? "#f6ad55"
											: undefined,
								}}
							>
								{observations.length}
							</span>
							<span className={styles.stripLbl}>
								Observations
							</span>
						</div>
						{openCount > 0 && (
							<>
								<div className={styles.stripDivider} />
								<div
									className={`${styles.stripBlock} ${styles.stripOpen}`}
								>
									<span className={styles.stripVal}>
										{openCount}
									</span>
									<span className={styles.stripLbl}>
										◷ Open items
									</span>
								</div>
							</>
						)}
					</div>

					{/* Discipline rows */}
					<div className={styles.discList}>
						{discStats.map((d) => {
							const card = (
								<DiscRow
									key={d.disc}
									d={d}
									fStart={fIdx}
									oStart={oIdx}
								/>
							);
							fIdx += d.findings;
							oIdx += d.observations;
							return card;
						})}
					</div>
				</>
			)}
		</div>
	);
}
