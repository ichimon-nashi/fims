// src/components/audit/iosa/IOSAAuditPrep.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./IOSAAuditPrep.module.css";

// ── IRM definitions — loaded once from public/irm-definitions.json ──
let IRM_CACHE: Record<string, string> | null = null;
async function getIRMDefs(): Promise<Record<string, string>> {
	if (IRM_CACHE !== null) return IRM_CACHE;
	try {
		const r = await fetch("/irm-definitions.json");
		const d = await r.json();
		IRM_CACHE = d.terms ?? {};
	} catch {
		IRM_CACHE = {};
	}
	return IRM_CACHE!;
}

// ── Types ─────────────────────────────────────────────────────
interface AuditRecord {
	id?: string;
	cycle_id: string;
	isarp_code: string;
	discipline: string;
	doc_references: string;
	aa_responses: Record<string, { completed: boolean; remarks: string }>;
	prep_flagged: boolean;
	prep_flag_reason: string;
	prep_status: "not_started" | "in_progress" | "ready";
}

interface ISARPWithRecord {
	id: string;
	isarp_code: string;
	discipline: string;
	section: number;
	standard_text: string;
	standard_paras: { text: string; style: string; numFmt?: string }[];
	isarp_type: string;
	has_gm: boolean;
	has_sms: boolean;
	linked_isarps: string[];
	auditor_actions: { num: string; text: string }[];
	guidance: string;
	guidance_paras?: { text: string; style: string; numFmt?: string }[];
	conformance_table?: { cells: string[] }[] | null;
	heading_h2: string;
	heading_h3: string;
	heading_h4: string;
	record: AuditRecord | null;
}

interface ActiveCycle {
	id: string;
	disciplines: string[];
	ism_edition: string;
	name: string;
}

const ALL_DISCIPLINES = [
	"CAB",
	"FLT",
	"DSP",
	"MNT",
	"GRH",
	"ORG",
	"CGO",
	"SEC",
];

// ── Helpers ───────────────────────────────────────────────────
function getPrepStatus(
	record: AuditRecord | null,
): "not_started" | "in_progress" | "ready" {
	if (!record) return "not_started";
	return record.prep_status || "not_started";
}

function useDebounce<T>(value: T, delay: number): T {
	const [d, setD] = useState(value);
	useEffect(() => {
		const t = setTimeout(() => setD(value), delay);
		return () => clearTimeout(t);
	}, [value, delay]);
	return d;
}

// ── Guidance text with clickable refs ────────────────────────
function GuidanceText({
	text,
	paras,
	onRefClick,
	onIRMClick,
	irmDefs,
}: {
	text: string;
	paras?: { text: string; style: string; numFmt?: string }[];
	onRefClick: (code: string) => void;
	onIRMClick?: (term: string) => void;
	irmDefs?: Record<string, string>;
}) {
	const ROMAN = [
		"i",
		"ii",
		"iii",
		"iv",
		"v",
		"vi",
		"vii",
		"viii",
		"ix",
		"x",
		"xi",
		"xii",
		"xiii",
		"xiv",
		"xv",
		"xvi",
		"xvii",
		"xviii",
		"xix",
		"xx",
	];
	// Matches ISARP codes (e.g. ORG 2.5.1) AND table refs (e.g. Table 1.1)
	const REF_RE =
		/\b([A-Z]{2,3}\s\d+\.\d+(?:\.\d+)?[A-Z]?)\b|(Table\s+\d+\.\d+)/g;

	// IRM terms sorted longest-first to match "Cabin Crew" before "Crew"
	const irmTerms = irmDefs
		? Object.keys(irmDefs).sort((a, b) => b.length - a.length)
		: [];

	const renderLine = (line: string, lineIdx: number): React.ReactNode => {
		const hasIRM = /\bIRM\b/.test(line);
		const allMatches: {
			start: number;
			end: number;
			text: string;
			type: "isarp" | "table" | "irm";
		}[] = [];
		REF_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = REF_RE.exec(line)) !== null) {
			allMatches.push({
				start: m.index,
				end: m.index + m[0].length,
				text: m[0],
				type: /^Table\s+\d/.test(m[0]) ? "table" : "isarp",
			});
		}
		if (hasIRM && onIRMClick && irmTerms.length) {
			for (const term of irmTerms) {
				const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const re = new RegExp(`\\b${escaped}\\b`, "g");
				let tm: RegExpExecArray | null;
				while ((tm = re.exec(line)) !== null) {
					const overlaps = allMatches.some(
						(x) =>
							tm!.index < x.end &&
							tm!.index + term.length > x.start,
					);
					if (!overlaps)
						allMatches.push({
							start: tm.index,
							end: tm.index + term.length,
							text: term,
							type: "irm",
						});
				}
			}
		}
		allMatches.sort((a, b) => a.start - b.start);
		const parts: React.ReactNode[] = [];
		let last = 0;
		for (const match of allMatches) {
			if (match.start < last) continue;
			if (match.start > last) parts.push(line.slice(last, match.start));
			if (match.type === "irm") {
				parts.push(
					<span
						key={`${lineIdx}-irm-${match.start}`}
						className={styles.irmTerm}
						onClick={() => onIRMClick!(match.text)}
						title={`IRM: ${match.text}`}
					>
						{match.text}
					</span>,
				);
			} else {
				parts.push(
					<span
						key={`${lineIdx}-${match.start}`}
						className={
							match.type === "isarp"
								? styles.isarpRef
								: styles.tableRef
						}
						onClick={() => onRefClick(match.text)}
						title={`View ${match.text}`}
						style={{ cursor: "pointer" }}
					>
						{match.text}
					</span>,
				);
			}
			last = match.end;
		}
		if (last < line.length) parts.push(line.slice(last));
		return parts;
	};

	// Render with full bullet formatting when guidance_paras available
	if (paras && paras.length > 0) {
		const counters: Record<string, number> = {};
		let lastStyle = "Normal";
		return (
			<div className={styles.guidanceText}>
				{paras.map((p, idx) => {
					const isListItem = p.style === "iatalistitem";
					if (isListItem && lastStyle !== "iatalistitem")
						counters[p.numFmt ?? "def"] = 0;
					lastStyle = p.style;
					let prefix = "";
					if (isListItem) {
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
										: `${ROMAN[n] ?? n + 1}.`;
					}
					return (
						<span
							key={idx}
							className={`${styles.stdLine} ${isListItem ? styles.stdSubItem : ""}`}
						>
							{isListItem && (
								<span
									className={`${styles.listPrefix} ${p.numFmt === "bullet" ? styles.listBullet : ""}`}
								>
									{prefix}
								</span>
							)}
							{renderLine(p.text, idx)}
						</span>
					);
				})}
			</div>
		);
	}

	// Fallback: plain text split on newlines
	const lines = text.split(/\r\n|\n/);
	return (
		<div className={styles.guidanceText}>
			{lines.map((line, idx) => (
				<span key={idx} className={styles.stdLine}>
					{renderLine(line, idx)}
				</span>
			))}
		</div>
	);
}

// ── Standard text renderer ────────────────────────────────────
function ISARPText({
	isarp,
	onRefClick,
	onIRMClick,
	irmDefs,
}: {
	isarp: ISARPWithRecord;
	onRefClick: (code: string) => void;
	onIRMClick: (term: string) => void;
	irmDefs: Record<string, string>;
}) {
	// Matches ISARP codes like "CAB 1.2.1" OR table refs like "Table 1.1" or "Table 5.2"
	const REF_RE =
		/\b([A-Z]{2,3}\s\d+\.\d+(?:\.\d+)?[A-Z]?)\b|(Table\s+\d+\.\d+)/g;

	// Build sorted IRM term list for detection (longest first to match "Post Holder" before "Holder")
	const irmTerms = Object.keys(irmDefs).sort((a, b) => b.length - a.length);

	const renderSpans = (text: string, key: string) => {
		// First detect IRM terms if "IRM" appears in the same paragraph
		const hasIRM = /\bIRM\b/.test(text);

		// Build a combined regex: ISARP refs, table refs, and (if IRM context) IRM terms
		// Process character-by-character using both regexes
		const parts: React.ReactNode[] = [];
		let remaining = text;
		let posOffset = 0;

		// Simple approach: find all match positions, sort, render in order
		const allMatches: {
			start: number;
			end: number;
			text: string;
			type: "isarp" | "table" | "irm";
		}[] = [];

		// ISARP + table refs
		REF_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = REF_RE.exec(text)) !== null) {
			const ref = m[0];
			allMatches.push({
				start: m.index,
				end: m.index + ref.length,
				text: ref,
				type: /^Table\s+\d/.test(ref) ? "table" : "isarp",
			});
		}

		// IRM terms (only when "IRM" in paragraph — avoids false positives)
		if (hasIRM) {
			for (const term of irmTerms) {
				if (!irmDefs[term]) continue;
				// Escape for regex
				const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const re = new RegExp(`\\b${escaped}\\b`, "g");
				let tm: RegExpExecArray | null;
				while ((tm = re.exec(text)) !== null) {
					const start = tm.index;
					const end = start + term.length;
					// Don't overlap with existing matches
					const overlaps = allMatches.some(
						(x) => start < x.end && end > x.start,
					);
					if (!overlaps) {
						allMatches.push({
							start,
							end,
							text: term,
							type: "irm",
						});
					}
				}
			}
		}

		// Sort by position
		allMatches.sort((a, b) => a.start - b.start);

		let last = 0;
		for (const match of allMatches) {
			if (match.start < last) continue; // skip overlaps
			if (match.start > last) parts.push(text.slice(last, match.start));
			if (match.type === "irm") {
				parts.push(
					<span
						key={`${key}-irm-${match.start}`}
						className={styles.irmTerm}
						onClick={() => onIRMClick(match.text)}
						title={`IRM definition: ${match.text}`}
					>
						{match.text}
					</span>,
				);
			} else {
				parts.push(
					<span
						key={`${key}-${match.start}`}
						className={
							match.type === "isarp"
								? styles.isarpRef
								: styles.tableRef
						}
						onClick={() => onRefClick(match.text)}
						title={`View ${match.text}`}
						style={{ cursor: "pointer" }}
					>
						{match.text}
					</span>,
				);
			}
			last = match.end;
		}
		if (last < text.length) parts.push(text.slice(last));
		return parts;
	};

	// Use standard_paras if available (from ISM docx — has style info)
	if (isarp.standard_paras?.length > 0) {
		const ROMAN = [
			"i",
			"ii",
			"iii",
			"iv",
			"v",
			"vi",
			"vii",
			"viii",
			"ix",
			"x",
			"xi",
			"xii",
			"xiii",
			"xiv",
			"xv",
			"xvi",
			"xvii",
			"xviii",
			"xix",
			"xx",
		];
		// Track per-numFmt counters so each list resets independently
		const counters: Record<string, number> = {};
		let lastStyle = "Normal";

		return (
			<div className={styles.stdText}>
				{isarp.standard_paras.map((para, idx) => {
					const isSubItem = para.style === "iatalistitem";
					const isPlainSubItem =
						!isSubItem && /^\s*\([ivxabcIVXABC]+\)/.test(para.text);

					// Reset counter when transitioning from non-list to list
					if (isSubItem && lastStyle !== "iatalistitem") {
						counters[para.numFmt ?? "default"] = 0;
					}
					lastStyle = para.style;

					let prefix = "";
					if (isSubItem) {
						const fmt = para.numFmt ?? "lowerRoman";
						const n = counters[fmt] ?? 0;
						counters[fmt] = n + 1;
						if (fmt === "bullet") {
							prefix = "•";
						} else if (fmt === "lowerRoman") {
							prefix = (ROMAN[n] ?? String(n + 1)) + ".";
						} else if (fmt === "decimal") {
							prefix = String(n + 1) + ".";
						} else if (fmt === "lowerLetter") {
							prefix = String.fromCharCode(97 + n) + ".";
						} else {
							prefix = (ROMAN[n] ?? String(n + 1)) + ".";
						}
					}

					return (
						<span
							key={idx}
							className={`${styles.stdLine} ${isSubItem || isPlainSubItem ? styles.stdSubItem : ""}`}
						>
							{isSubItem && (
								<span
									className={`${styles.listPrefix} ${para.numFmt === "bullet" ? styles.listBullet : ""}`}
								>
									{prefix}
								</span>
							)}
							{renderSpans(para.text, String(idx))}
						</span>
					);
				})}
			</div>
		);
	}

	// Fallback: split plain text on line breaks
	const lines = isarp.standard_text.split(/\r\n|\n/);
	return (
		<div className={styles.stdText}>
			{lines.map((line, idx) => {
				const isSubItem = /^\s*\([ivxabcIVXABC]+\)/.test(line);
				return (
					<span
						key={idx}
						className={`${styles.stdLine} ${isSubItem ? styles.stdSubItem : ""}`}
					>
						{renderSpans(line, String(idx))}
					</span>
				);
			})}
		</div>
	);
}

// ── IRM Term Popup ─────────────────────────────────────────────
// ── Rich cell content: renders paras with bullets from stored para data ─────
function RichCellContent({ cell }: { cell: any }) {
	if (typeof cell === "string") return <span>{cell}</span>;
	const paras: { text: string; style: string; numFmt?: string }[] =
		cell?.paras ?? [];
	if (!paras.length) return null;
	const ROMAN = [
		"i",
		"ii",
		"iii",
		"iv",
		"v",
		"vi",
		"vii",
		"viii",
		"ix",
		"x",
		"xi",
		"xii",
		"xiii",
		"xiv",
		"xv",
		"xvi",
		"xvii",
		"xviii",
		"xix",
		"xx",
	];
	const counters: Record<string, number> = {};
	let lastStyle = "Normal";
	return (
		<div className={styles.richCell}>
			{paras.map((p, idx) => {
				const isListItem = p.style === "iatalistitem";
				// Default to "bullet" for table cells — most ISM table lists are bullet style
				// numFmt is stored correctly after reimport; this fallback handles old data
				const fmt = p.numFmt ?? "bullet";
				if (isListItem && lastStyle !== "iatalistitem")
					counters[fmt] = 0;
				lastStyle = p.style;
				let prefix = "";
				if (isListItem) {
					const n = counters[fmt] ?? 0;
					counters[fmt] = n + 1;
					prefix =
						fmt === "bullet"
							? "•"
							: fmt === "decimal"
								? String(n + 1) + "."
								: fmt === "lowerLetter"
									? String.fromCharCode(97 + n) + "."
									: (ROMAN[n] ?? String(n + 1)) + ".";
				}
				return (
					<div
						key={idx}
						className={`${styles.richCellPara} ${isListItem ? styles.richCellListItem : ""}`}
					>
						{isListItem && (
							<span
								className={`${styles.listPrefix} ${fmt === "bullet" ? styles.listBullet : ""}`}
							>
								{prefix}
							</span>
						)}
						<span>{p.text}</span>
					</div>
				);
			})}
		</div>
	);
}

// ── Conformance Applicability Table ──────────────────────────────────────────
function ConformanceTable({ rows }: { rows: { cells: string[] }[] }) {
	if (!rows?.length) return null;
	return (
		<div className={styles.conformanceTable}>
			{rows.map((row, i) => {
				if (row.cells.length === 1) {
					return (
						<div key={i} className={styles.conformanceTitle}>
							{row.cells[0]}
						</div>
					);
				}
				return (
					<div
						key={i}
						className={`${styles.conformanceRow} ${i <= 1 ? styles.conformanceRowHeader : ""}`}
					>
						{row.cells.map((cell, j) => (
							<div key={j} className={styles.conformanceCell}>
								{cell}
							</div>
						))}
					</div>
				);
			})}
		</div>
	);
}

function IRMPopup({
	term,
	definition,
	onClose,
}: {
	term: string;
	definition: string;
	onClose: () => void;
}) {
	return (
		<div className={styles.irmPopupBackdrop} onClick={onClose}>
			<div
				className={styles.irmPopup}
				onClick={(e) => e.stopPropagation()}
			>
				<div className={styles.irmPopupHeader}>
					<span className={styles.irmPopupTerm}>{term}</span>
					<span className={styles.irmEditionBadge}>IRM Ed.15</span>
					<button className={styles.refPopupClose} onClick={onClose}>
						✕
					</button>
				</div>
				<div className={styles.irmPopupBody}>{definition}</div>
			</div>
		</div>
	);
}
function RefPopup({
	refCode,
	allIsarps,
	cycleId,
	token,
	onClose,
	onIRMClick,
	irmDefs,
}: {
	refCode: string;
	allIsarps: ISARPWithRecord[];
	cycleId: string;
	token: string;
	onClose: () => void;
	onIRMClick?: (term: string) => void;
	irmDefs?: Record<string, string>;
}) {
	const isTable = /^Table\s+\d/.test(refCode);
	const [fetched, setFetched] = useState<any>("loading");

	useEffect(() => {
		if (isTable) {
			fetch(
				`/api/audit/iosa/tables?cycle_id=${cycleId}&table_ref=${encodeURIComponent(refCode)}`,
				{
					headers: { Authorization: `Bearer ${token}` },
				},
			)
				.then((r) => r.json())
				.then(({ table }) => setFetched(table ?? "not_found"))
				.catch(() => setFetched("not_found"));
			return;
		}
		const local = allIsarps.find((i) => i.isarp_code === refCode);
		if (local) {
			setFetched(local);
			return;
		}
		const disc = refCode.split(" ")[0];
		fetch(
			`/api/audit/iosa/auditprep?cycle_id=${cycleId}&discipline=${disc}`,
			{
				headers: { Authorization: `Bearer ${token}` },
			},
		)
			.then((r) => r.json())
			.then(({ isarps }) => {
				const found = (isarps ?? []).find(
					(i: ISARPWithRecord) => i.isarp_code === refCode,
				);
				setFetched(found ?? "not_found");
			})
			.catch(() => setFetched("not_found"));
	}, [refCode]);

	const isarp: ISARPWithRecord | null =
		!isTable && fetched !== "loading" && fetched !== "not_found"
			? fetched
			: null;
	const tableData =
		isTable && fetched !== "loading" && fetched !== "not_found"
			? fetched
			: null;

	return (
		<div className={styles.refPopupBackdrop} onClick={onClose}>
			<div
				className={styles.refPopup}
				onClick={(e) => e.stopPropagation()}
			>
				<div className={styles.refPopupHeader}>
					<span className={styles.refPopupCode}>{refCode}</span>
					{isarp && (
						<span
							className={`${styles.wsTypeBadge} ${isarp.isarp_type === "Recommended Practice" ? styles.wsTypeRP : ""}`}
						>
							{isarp.isarp_type === "Recommended Practice"
								? "RP"
								: "Standard"}
						</span>
					)}
					{(isarp?.discipline || tableData?.discipline) && (
						<span className={styles.wsTag}>
							{isarp?.discipline || tableData?.discipline}
						</span>
					)}
					<button className={styles.refPopupClose} onClick={onClose}>
						✕
					</button>
				</div>
				<div className={styles.refPopupBody}>
					{fetched === "loading" && (
						<div className={styles.refPopupLoading}>
							<div className={styles.spinner} />
						</div>
					)}
					{fetched === "not_found" && (
						<div className={styles.refPopupNotFound}>
							{refCode} could not be found.{" "}
							{isTable
								? "Re-import the ISM docx files — table extraction is now included."
								: `Import the ${refCode.split(" ")[0]} discipline docx first.`}
						</div>
					)}
					{isarp && (
						<>
							<ISARPText
								isarp={isarp}
								onRefClick={onClose}
								onIRMClick={onIRMClick}
								irmDefs={irmDefs}
							/>
							{isarp.guidance && (
								<div
									className={styles.guidanceBox}
									style={{ marginTop: "0.75rem" }}
								>
									<div className={styles.guidanceLabel}>
										Guidance
									</div>
									<GuidanceText
										text={isarp.guidance}
										paras={isarp.guidance_paras}
										onRefClick={onClose}
										onIRMClick={onIRMClick}
										irmDefs={irmDefs}
									/>
								</div>
							)}
						</>
					)}
					{tableData &&
						(() => {
							const rows: any[] = tableData.content_json ?? [];
							// Use stored colCount, or derive from widest row as fallback
							const colCount: number =
								tableData.col_count ??
								rows.reduce(
									(max: number, r: any) =>
										Math.max(max, (r.cells ?? []).length),
									1,
								);

							// Smart column sizing: detect narrow index col, use minmax to prevent overflow
							const firstColNarrow = rows.some((r: any) => {
								const firstText = (r.cells?.[0]?.paras ?? [])
									.map((p: any) => p.text)
									.join("")
									.trim();
								return /^\(([ivxlcIVXLC]+|[a-z]{1,4})\)$/.test(
									firstText,
								);
							});
							// minmax(0, Xfr) ensures columns shrink to fit within grid width — no overflow
							const gridCols =
								colCount === 1
									? "1fr"
									: firstColNarrow
										? `max-content ${Array(colCount - 1)
												.fill("minmax(0, 1fr)")
												.join(" ")}`
										: Array(colCount)
												.fill("minmax(0, 1fr)")
												.join(" ");

							// Extract column labels from last header row (most specific header)
							const headerRows = rows.filter(
								(r: any) => r.is_header,
							);
							const labelRow = headerRows[headerRows.length - 1];
							const headerLabels: string[] = (
								labelRow?.cells ?? []
							).map((c: any) =>
								(c?.paras ?? [])
									.map((p: any) => p.text)
									.join(" ")
									.trim(),
							);

							return (
								<>
									<div className={styles.tableMobileNotice}>
										<span>📊</span>
										This table is best viewed on a larger
										screen.
									</div>
									<div className={styles.tableScrollWrap}>
										<div
											className={styles.tableDisplay}
											style={{
												gridTemplateColumns: gridCols,
											}}
										>
											<div
												className={styles.tableTitle}
												style={{ gridColumn: `1 / -1` }}
											>
												{tableData.title}
											</div>
											{rows.map((row: any, i: number) => {
												const cells: any[] =
													row.cells ?? [];
												const isFullSpan =
													cells.length === 1 &&
													(cells[0]?.span ?? 1) > 1;
												if (isFullSpan) {
													return (
														<div
															key={i}
															className={`${styles.tableRowFullSpan} ${row.is_header ? styles.tableRowHeader : ""}`}
															style={{
																gridColumn: `1 / -1`,
															}}
														>
															<RichCellContent
																cell={cells[0]}
															/>
														</div>
													);
												}
												// display:contents wrapper — cells participate directly in parent grid
												return (
													<div
														key={i}
														className={`${styles.tableRowWrapper} ${row.is_header ? styles.tableRowHeader : ""}`}
													>
														{cells.map(
															(
																cell: any,
																j: number,
															) => {
																const cellSpan: number =
																	cell?.span ??
																	1;
																return (
																	<div
																		key={j}
																		className={
																			styles.tableCell
																		}
																		data-label={
																			headerLabels[
																				j
																			] ??
																			""
																		}
																		style={
																			cellSpan >
																			1
																				? {
																						gridColumn: `span ${cellSpan}`,
																					}
																				: undefined
																		}
																	>
																		<RichCellContent
																			cell={
																				cell
																			}
																		/>
																	</div>
																);
															},
														)}
													</div>
												);
											})}
										</div>
									</div>
								</>
							);
						})()}
				</div>
			</div>
		</div>
	);
}

// ── Workspace ─────────────────────────────────────────────────
function Workspace({
	isarp,
	record,
	allIsarps,
	cycleId,
	token,
	onSave,
	onNext,
	onPrev,
	hasNext,
	hasPrev,
	saving,
	readOnly,
}: {
	isarp: ISARPWithRecord;
	record: AuditRecord | null;
	allIsarps: ISARPWithRecord[];
	cycleId: string;
	token: string;
	onSave: (
		patch: Partial<AuditRecord> & { isarp_code: string },
	) => Promise<AuditRecord>;
	onNext: () => void;
	onPrev: () => void;
	hasNext: boolean;
	hasPrev: boolean;
	saving: boolean;
	readOnly: boolean;
}) {
	const [docRefs, setDocRefs] = useState(record?.doc_references ?? "");
	const docRefsRef = useRef<HTMLTextAreaElement>(null);
	const [flagged, setFlagged] = useState(record?.prep_flagged ?? false);
	const [flagReason, setFlagReason] = useState(
		record?.prep_flag_reason ?? "",
	);
	const [aaResponses, setAaResponses] = useState<
		Record<string, { completed: boolean; remarks: string }>
	>(record?.aa_responses ?? {});
	const [refPopup, setRefPopup] = useState<string | null>(null);
	const [irmPopup, setIrmPopup] = useState<{
		term: string;
		def: string;
	} | null>(null);
	const [irmDefs, setIrmDefs] = useState<Record<string, string>>({});
	const saveTimeout = useRef<NodeJS.Timeout>();

	// Load IRM definitions once
	useEffect(() => {
		getIRMDefs().then(setIrmDefs);
	}, []);

	useEffect(() => {
		setDocRefs(record?.doc_references ?? "");
		setFlagged(record?.prep_flagged ?? false);
		setFlagReason(record?.prep_flag_reason ?? "");
		setAaResponses(record?.aa_responses ?? {});
		setRefPopup(null);
		setIrmPopup(null);
	}, [isarp.isarp_code]);

	const debouncedDocRefs = useDebounce(docRefs, 800);
	const prevDocRefs = useRef(record?.doc_references ?? "");
	// Auto-size doc refs textarea on mount and content change
	useEffect(() => {
		const el = docRefsRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = el.scrollHeight + "px";
	}, [docRefs]);

	useEffect(() => {
		if (debouncedDocRefs === prevDocRefs.current) return;
		prevDocRefs.current = debouncedDocRefs;
		onSave({
			isarp_code: isarp.isarp_code,
			doc_references: debouncedDocRefs,
		});
	}, [debouncedDocRefs]);

	const debouncedFlagReason = useDebounce(flagReason, 800);
	const prevFlagReason = useRef(record?.prep_flag_reason ?? "");
	useEffect(() => {
		if (debouncedFlagReason === prevFlagReason.current) return;
		prevFlagReason.current = debouncedFlagReason;
		onSave({
			isarp_code: isarp.isarp_code,
			prep_flag_reason: debouncedFlagReason,
		});
	}, [debouncedFlagReason]);

	const toggleFlag = () => {
		const v = !flagged;
		setFlagged(v);
		// If flagging (v=true) and currently ready → demote to in_progress
		const currentStatus = getPrepStatus(record);
		if (v && currentStatus === "ready") {
			onSave({
				isarp_code: isarp.isarp_code,
				prep_flagged: true,
				prep_status: "in_progress",
			});
		} else {
			onSave({ isarp_code: isarp.isarp_code, prep_flagged: v });
		}
	};

	const toggleAA = (num: string) => {
		const updated = {
			...aaResponses,
			[num]: {
				completed: !aaResponses[num]?.completed,
				remarks: aaResponses[num]?.remarks ?? "",
			},
		};
		setAaResponses(updated);
		onSave({ isarp_code: isarp.isarp_code, aa_responses: updated });
	};

	const updateAARemark = (num: string, remarks: string) => {
		const updated = {
			...aaResponses,
			[num]: {
				...aaResponses[num],
				completed: aaResponses[num]?.completed ?? false,
				remarks,
			},
		};
		setAaResponses(updated);
		clearTimeout(saveTimeout.current);
		saveTimeout.current = setTimeout(
			() =>
				onSave({ isarp_code: isarp.isarp_code, aa_responses: updated }),
			800,
		);
	};

	const toggleReady = () => {
		const isReady = getPrepStatus(record) === "ready";
		onSave({
			isarp_code: isarp.isarp_code,
			prep_status: isReady ? "in_progress" : "ready",
		});
	};

	const status = getPrepStatus(record);
	const isReady = status === "ready";
	const totalAAs = isarp.auditor_actions?.length ?? 0;
	const completedAAs =
		isarp.auditor_actions?.filter((aa) => aaResponses[aa.num]?.completed)
			.length ?? 0;

	return (
		<div className={styles.workspace}>
			{/* Header */}
			<div className={styles.wsHeader}>
				<div className={styles.wsHeaderLeft}>
					<span className={styles.wsCode}>{isarp.isarp_code}</span>
					<span
						className={`${styles.wsTypeBadge} ${isarp.isarp_type === "Recommended Practice" ? styles.wsTypeRP : ""}`}
					>
						{isarp.isarp_type === "Recommended Practice"
							? "RP"
							: "Standard"}
					</span>
					{isarp.has_sms && <span className={styles.wsTag}>SMS</span>}
					{isarp.has_gm && <span className={styles.wsTag}>GM</span>}
					{/* Interlink badge — prominent chain icon when ISARP references other ISARPs */}
					{isarp.linked_isarps?.length > 0 && (
						<span
							className={styles.interlinkBadge}
							title={`Interlinked with: ${isarp.linked_isarps.join(", ")}`}
						>
							🔗 Interlinked ({isarp.linked_isarps.length})
						</span>
					)}
					{isarp.linked_isarps?.map((link) => (
						<span
							key={link}
							className={styles.wsLinkChip}
							onClick={() => setRefPopup(link)}
							title={`View ${link}`}
						>
							{link}
						</span>
					))}
				</div>
				<div className={styles.wsHeaderRight}>
					<button
						className={`${styles.btnReadyHeader} ${isReady ? styles.btnReadyHeaderActive : ""}`}
						onClick={toggleReady}
						title={
							isReady
								? "Click to unmark ready"
								: "Click to mark ready"
						}
					>
						{isReady ? "✓ Ready" : "Mark ready"}
					</button>
					{saving && (
						<span className={styles.savingDot} title="Saving…">
							●
						</span>
					)}
				</div>
			</div>

			{/* Body */}
			<div className={styles.wsBody}>
				{/* Standard text — always full */}
				<ISARPText
					isarp={isarp}
					onRefClick={setRefPopup}
					onIRMClick={(term) =>
						setIrmPopup({ term, def: irmDefs[term] ?? "" })
					}
					irmDefs={irmDefs}
				/>

				{/* Conformance Applicability Table */}
				{isarp.conformance_table &&
					isarp.conformance_table.length > 0 && (
						<div className={styles.fieldGroup}>
							<ConformanceTable rows={isarp.conformance_table} />
						</div>
					)}

				{/* Guidance with clickable refs */}
				{isarp.guidance && (
					<div className={styles.guidanceBox}>
						<div className={styles.guidanceLabel}>Guidance</div>
						<GuidanceText
							text={isarp.guidance}
							paras={isarp.guidance_paras}
							onRefClick={setRefPopup}
							onIRMClick={(term) =>
								setIrmPopup({ term, def: irmDefs[term] ?? "" })
							}
							irmDefs={irmDefs}
						/>
					</div>
				)}

				{/* Doc references */}
				<div className={styles.fieldGroup}>
					<label className={styles.fieldLabel}>
						Documentation references
						{readOnly && (
							<span className={styles.readOnlyBadge}>
								👁 View only
							</span>
						)}
					</label>
					<textarea
						ref={docRefsRef}
						className={`${styles.fieldTextarea} ${styles.fieldTextareaAuto}`}
						value={docRefs}
						onChange={(e) => setDocRefs(e.target.value)}
						placeholder="e.g. CCOM Rev042 Ch.0.5, CCDM -4.4-"
						rows={1}
						disabled={readOnly}
					/>
				</div>

				{/* Auditor Actions */}
				{totalAAs > 0 ? (
					<div className={styles.fieldGroup}>
						<label className={styles.fieldLabel}>
							Auditor actions
							<span className={styles.aaCount}>
								{completedAAs} / {totalAAs} completed
							</span>
						</label>
						<div className={styles.aaList}>
							{isarp.auditor_actions.map((aa) => {
								const resp = aaResponses[aa.num] ?? {
									completed: false,
									remarks: "",
								};
								return (
									<div
										key={aa.num}
										className={`${styles.aaItem} ${resp.completed ? styles.aaItemDone : ""}`}
									>
										<div
											className={styles.aaTop}
											onClick={() =>
												!readOnly && toggleAA(aa.num)
											}
											style={
												readOnly
													? { cursor: "default" }
													: {}
											}
										>
											<div
												className={`${styles.aaCheckbox} ${resp.completed ? styles.aaCheckboxDone : ""} ${readOnly ? styles.aaCheckboxReadOnly : ""}`}
											>
												{resp.completed && "✓"}
											</div>
											<div className={styles.aaNum}>
												{aa.num}
											</div>
											<div className={styles.aaText}>
												{aa.text}
											</div>
										</div>
										{resp.completed && (
											<div className={styles.aaRemarks}>
												<textarea
													className={
														styles.aaRemarksInput
													}
													value={resp.remarks}
													onChange={(e) =>
														updateAARemark(
															aa.num,
															e.target.value,
														)
													}
													placeholder={`Remarks for ${aa.num}…`}
													rows={Math.max(2, (resp.remarks.match(/\n/g)?.length ?? 0) + 1)}
													onClick={(e) =>
														e.stopPropagation()
													}
													disabled={readOnly}
												/>
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				) : (
					<div className={styles.noAaNote}>
						📄 Auditor actions not yet loaded. Use{" "}
						<strong>↑ Import ISARPs → ISM Checklist</strong> to
						populate AA text for this cycle.
					</div>
				)}

				{/* Flag */}
				<div className={styles.flagRow}>
					<button
						className={`${styles.flagBtn} ${flagged ? styles.flagBtnActive : ""}`}
						onClick={toggleFlag}
					>
						⚑ {flagged ? "Flagged" : "Flag for discussion"}
					</button>
					{flagged && (
						<input
							className={styles.flagReasonInput}
							value={flagReason}
							onChange={(e) => setFlagReason(e.target.value)}
							placeholder="Reason for flag…"
						/>
					)}
				</div>
			</div>

			{/* Footer */}
			<div className={styles.wsFooter}>
				<div className={styles.navBtns}>
					<button
						className={styles.btnNav}
						onClick={onPrev}
						disabled={!hasPrev}
					>
						←
					</button>
					<button
						className={styles.btnNav}
						onClick={onNext}
						disabled={!hasNext}
					>
						→
					</button>
				</div>
			</div>

			{refPopup && (
				<RefPopup
					refCode={refPopup}
					allIsarps={allIsarps}
					cycleId={cycleId}
					token={token}
					onClose={() => setRefPopup(null)}
					onIRMClick={(term) => {
						setRefPopup(null);
						setIrmPopup({ term, def: irmDefs[term] ?? "" });
					}}
					irmDefs={irmDefs}
				/>
			)}
			{irmPopup && (
				<IRMPopup
					term={irmPopup.term}
					definition={irmPopup.def}
					onClose={() => setIrmPopup(null)}
				/>
			)}
		</div>
	);
}

// ── Grouped ISARP List ────────────────────────────────────────
function GroupedISARPList({
	isarps,
	selectedCode,
	onSelect,
	searchQuery,
	onSearch,
}: {
	isarps: ISARPWithRecord[];
	selectedCode: string | null;
	onSelect: (i: ISARPWithRecord) => void;
	searchQuery: string;
	onSearch: (q: string) => void;
}) {
	// Group by h2 → h3
	type Group = { h2: string; h3: string; items: ISARPWithRecord[] };
	const groups: Group[] = [];

	for (const isarp of isarps) {
		const h2 = isarp.heading_h2 || "General";
		const h3 = isarp.heading_h3 || "";
		const last = groups[groups.length - 1];
		if (!last || last.h2 !== h2 || last.h3 !== h3) {
			groups.push({ h2, h3, items: [isarp] });
		} else {
			last.items.push(isarp);
		}
	}

	// Track which h2s are collapsed
	const [collapsedH2, setCollapsedH2] = useState<Set<string>>(new Set());
	const toggleH2 = (h2: string) =>
		setCollapsedH2((prev) => {
			const next = new Set(prev);
			next.has(h2) ? next.delete(h2) : next.add(h2);
			return next;
		});

	return (
		<div className={styles.listPanel}>
			<div className={styles.listHeader}>
				<input
					className={styles.searchInput}
					placeholder="Search…"
					value={searchQuery}
					onChange={(e) => onSearch(e.target.value)}
				/>
			</div>
			<div className={styles.listBody}>
				{isarps.length === 0 ? (
					<div className={styles.listEmpty}>
						No ISARPs — import ISM checklist first
					</div>
				) : (
					(() => {
						let lastH2 = "";
						return groups.map((group, gi) => {
							const h2Changed = group.h2 !== lastH2;
							if (h2Changed) lastH2 = group.h2;
							const isCollapsed = collapsedH2.has(group.h2);
							return (
								<div key={gi}>
									{/* H2 section header */}
									{h2Changed && (
										<div
											className={styles.listH2}
											onClick={() => toggleH2(group.h2)}
										>
											<span
												className={styles.listH2Arrow}
											>
												{isCollapsed ? "▸" : "▾"}
											</span>
											<span className={styles.listH2Text}>
												{group.h2}
											</span>
										</div>
									)}
									{!isCollapsed && (
										<>
											{/* H3 subsection header */}
											{group.h3 && (
												<div className={styles.listH3}>
													{group.h3}
												</div>
											)}
											{/* ISARP rows */}
											{group.items.map((isarp) => {
												const status = getPrepStatus(
													isarp.record,
												);
												const isRP =
													isarp.isarp_type ===
													"Recommended Practice";
												const hasLinks =
													(isarp.linked_isarps
														?.length ?? 0) > 0;
												return (
													<div
														key={isarp.isarp_code}
														className={`${styles.listRow} ${selectedCode === isarp.isarp_code ? styles.listRowActive : ""}`}
														onClick={() =>
															onSelect(isarp)
														}
													>
														<div
															className={`${styles.statusDot} ${
																status ===
																"ready"
																	? styles.dotReady
																	: status ===
																		  "in_progress"
																		? styles.dotInProgress
																		: styles.dotNone
															}`}
														/>
														<div
															className={
																styles.listRowCode
															}
														>
															{isarp.isarp_code}
														</div>
														<div
															className={
																styles.listRowBadges
															}
														>
															{isRP && (
																<span
																	className={
																		styles.listRPBadge
																	}
																	title="Recommended Practice"
																>
																	RP
																</span>
															)}
															{hasLinks && (
																<span
																	className={
																		styles.listLinkBadge
																	}
																	title={`Interlinked with: ${isarp.linked_isarps.join(", ")}`}
																>
																	🔗
																</span>
															)}
															{isarp.record
																?.prep_flagged && (
																<div
																	className={
																		styles.flagDot
																	}
																	title="Flagged"
																>
																	⚑
																</div>
															)}
														</div>
													</div>
												);
											})}
										</>
									)}
								</div>
							);
						});
					})()
				)}
			</div>
		</div>
	);
}
export default function IOSAAuditPrep({
	activeCycle,
}: {
	activeCycle: ActiveCycle | null;
}) {
	const { token, user } = useAuth();

	// Discipline-level edit permission — raw DB shape: audit.iosa_edit_disciplines is string[]
	const editDiscs: string[] | null =
		(user?.app_permissions as any)?.audit?.iosa_edit_disciplines ?? null;
	const canEditCurrentDisc = (disc: string) =>
		!editDiscs || editDiscs.length === 0 || editDiscs.includes(disc);

	// Discipline + section navigation
	const [activeDiscipline, setActiveDiscipline] = useState<string>("");
	const [activeSection, setActiveSection] = useState<number>(1);
	const [searchQuery, setSearchQuery] = useState("");

	// All ISARPs for the active discipline (all sections loaded at once)
	const [allDisciplineIsarps, setAllDisciplineIsarps] = useState<
		ISARPWithRecord[]
	>([]);
	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	// Set initial discipline from cycle
	useEffect(() => {
		if (activeCycle?.disciplines?.length && !activeDiscipline) {
			setActiveDiscipline(activeCycle.disciplines[0]);
		}
	}, [activeCycle]);

	// Fetch ALL ISARPs for the active discipline (no section filter)
	// so section counts are always accurate
	const fetchIsarps = useCallback(async () => {
		if (!token || !activeCycle || !activeDiscipline) return;
		setLoading(true);
		try {
			const res = await fetch(
				`/api/audit/iosa/auditprep?cycle_id=${activeCycle.id}&discipline=${activeDiscipline}`,
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			if (!res.ok) throw new Error("Failed");
			const { isarps: data } = await res.json();
			setAllDisciplineIsarps(data ?? []);
			setSelectedCode(null);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	}, [token, activeCycle, activeDiscipline]);

	useEffect(() => {
		fetchIsarps();
	}, [fetchIsarps]);

	// Filter by active section client-side
	const sectionIsarps = allDisciplineIsarps.filter(
		(i) => i.section === activeSection,
	);

	// Available sections for this discipline
	const availableSections = [
		...new Set(allDisciplineIsarps.map((i) => i.section)),
	].sort();

	// Section counts from full discipline data
	const sectionCounts = availableSections.reduce(
		(acc, s) => {
			const si = allDisciplineIsarps.filter((i) => i.section === s);
			acc[s] = {
				total: si.length,
				ready: si.filter((i) => getPrepStatus(i.record) === "ready")
					.length,
			};
			return acc;
		},
		{} as Record<number, { total: number; ready: number }>,
	);

	// Which disciplines have ISARPs in this cycle
	const inScopeDisciplines = activeCycle?.disciplines ?? [];

	const filteredIsarps = searchQuery
		? sectionIsarps.filter((i) =>
				i.isarp_code.toLowerCase().includes(searchQuery.toLowerCase()),
			)
		: sectionIsarps;

	const selectedIndex = filteredIsarps.findIndex(
		(i) => i.isarp_code === selectedCode,
	);
	const selectedIsarp = filteredIsarps[selectedIndex] ?? null;

	const goNext = () => {
		if (selectedIndex < filteredIsarps.length - 1)
			setSelectedCode(filteredIsarps[selectedIndex + 1].isarp_code);
	};
	const goPrev = () => {
		if (selectedIndex > 0)
			setSelectedCode(filteredIsarps[selectedIndex - 1].isarp_code);
	};

	const handleSave = useCallback(
		async (
			patch: Partial<AuditRecord> & { isarp_code: string },
		): Promise<AuditRecord> => {
			if (!token || !activeCycle) return {} as AuditRecord;
			setSaving(true);
			try {
				const res = await fetch("/api/audit/iosa/auditprep", {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						cycle_id: activeCycle.id,
						discipline: activeDiscipline,
						...patch,
					}),
				});
				if (!res.ok) throw new Error("Save failed");
				const { record } = await res.json();
				setAllDisciplineIsarps((prev) =>
					prev.map((i) =>
						i.isarp_code === patch.isarp_code
							? { ...i, record }
							: i,
					),
				);
				return record;
			} catch (e) {
				console.error(e);
				return {} as AuditRecord;
			} finally {
				setSaving(false);
			}
		},
		[token, activeCycle, activeDiscipline],
	);

	const readyCount = sectionIsarps.filter(
		(i) => getPrepStatus(i.record) === "ready",
	).length;
	const totalCount = sectionIsarps.length;

	if (!activeCycle) {
		return (
			<div className={styles.noCycle}>
				<div className={styles.noCycleIcon}>📋</div>
				<p className={styles.noCycleText}>
					Go to Dashboard and select an audit cycle first.
				</p>
			</div>
		);
	}

	return (
		<div className={styles.auditPrep}>
			{/* ── Top nav: discipline tabs + section pills ── */}
			<div className={styles.topNav}>
				{/* Discipline row */}
				<div className={styles.discRow}>
					{inScopeDisciplines.map((disc) => (
						<button
							key={disc}
							className={`${styles.discPill} ${activeDiscipline === disc ? styles.discPillActive : ""}`}
							onClick={() => {
								setActiveDiscipline(disc);
								setActiveSection(1);
								setSearchQuery("");
							}}
						>
							{disc}
						</button>
					))}
					<div className={styles.progressInfo}>
						{loading
							? "Loading…"
							: `${readyCount} / ${totalCount} ready`}
					</div>
				</div>

				{/* Section row */}
				{availableSections.length > 0 && (
					<div className={styles.sectionRow}>
						{availableSections.map((s) => (
							<button
								key={s}
								className={`${styles.sectionPill} ${activeSection === s ? styles.sectionPillActive : ""}`}
								onClick={() => {
									setActiveSection(s);
									setSelectedCode(null);
									setSearchQuery("");
								}}
							>
								{activeDiscipline} {s}
								<span className={styles.pillCount}>
									{sectionCounts[s]?.ready ?? 0}/
									{sectionCounts[s]?.total ?? 0}
								</span>
							</button>
						))}
					</div>
				)}
			</div>

			{loading ? (
				<div className={styles.loadingCenter}>
					<div className={styles.spinner} />
				</div>
			) : (
				<div className={styles.splitPanel}>
					<GroupedISARPList
						isarps={filteredIsarps}
						selectedCode={selectedCode}
						onSelect={(i) => setSelectedCode(i.isarp_code)}
						searchQuery={searchQuery}
						onSearch={setSearchQuery}
					/>

					{/* Workspace */}
					{selectedIsarp ? (
						<Workspace
							isarp={selectedIsarp}
							record={selectedIsarp.record}
							allIsarps={allDisciplineIsarps}
							cycleId={activeCycle.id}
							token={token ?? ""}
							onSave={handleSave}
							onNext={goNext}
							onPrev={goPrev}
							hasNext={selectedIndex < filteredIsarps.length - 1}
							hasPrev={selectedIndex > 0}
							saving={saving}
							readOnly={!canEditCurrentDisc(activeDiscipline)}
						/>
					) : (
						<div className={styles.noSelection}>
							{filteredIsarps.length > 0
								? "Select an ISARP from the list"
								: "No ISARPs in this section"}
						</div>
					)}
				</div>
			)}
		</div>
	);
}