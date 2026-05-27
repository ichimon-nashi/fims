// src/components/audit/iosa/IOSAAuditPrep.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./IOSAAuditPrep.module.css";

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
	standard_paras: { text: string; style: string }[];
	isarp_type: string;
	has_gm: boolean;
	has_sms: boolean;
	linked_isarps: string[];
	auditor_actions: { num: string; text: string }[];
	guidance: string;
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
	onRefClick,
}: {
	text: string;
	onRefClick: (code: string) => void;
}) {
	const REF_RE = /\b([A-Z]{2,3}\s\d+\.\d+(?:\.\d+)?[A-Z]?)\b/g;
	const lines = text.split(/\r\n|\n/);

	return (
		<div className={styles.guidanceText}>
			{lines.map((line, idx) => {
				const parts: React.ReactNode[] = [];
				let last = 0;
				let match: RegExpExecArray | null;
				REF_RE.lastIndex = 0;
				while ((match = REF_RE.exec(line)) !== null) {
					if (match.index > last)
						parts.push(line.slice(last, match.index));
					const ref = match[0];
					parts.push(
						<span
							key={`${idx}-${match.index}`}
							className={styles.isarpRef}
							onClick={() => onRefClick(ref)}
							title={`View ${ref}`}
						>
							{ref}
						</span>,
					);
					last = match.index + ref.length;
				}
				if (last < line.length) parts.push(line.slice(last));
				return (
					<span key={idx} className={styles.stdLine}>
						{parts}
					</span>
				);
			})}
		</div>
	);
}

// ── Standard text renderer ────────────────────────────────────
function ISARPText({
	isarp,
	onRefClick,
}: {
	isarp: ISARPWithRecord;
	onRefClick: (code: string) => void;
}) {
	// Matches ISARP codes like "CAB 1.2.1" OR table refs like "Table 1.1" or "Table 5.2"
	const REF_RE =
		/\b([A-Z]{2,3}\s\d+\.\d+(?:\.\d+)?[A-Z]?)\b|(Table\s+\d+\.\d+)/g;

	const renderSpans = (text: string, key: string) => {
		const parts: React.ReactNode[] = [];
		let last = 0;
		let match: RegExpExecArray | null;
		REF_RE.lastIndex = 0;
		while ((match = REF_RE.exec(text)) !== null) {
			if (match.index > last) parts.push(text.slice(last, match.index));
			const ref = match[0];
			const isIsarp = /^[A-Z]{2,3}\s\d/.test(ref);
			const isTable = /^Table\s+\d/.test(ref);
			parts.push(
				<span
					key={`${key}-${match.index}`}
					className={isIsarp ? styles.isarpRef : styles.tableRef}
					onClick={() => (isIsarp || isTable) && onRefClick(ref)}
					title={
						isIsarp ? `View ${ref}` : isTable ? `View ${ref}` : ref
					}
					style={isIsarp || isTable ? { cursor: "pointer" } : {}}
				>
					{ref}
				</span>,
			);
			last = match.index + ref.length;
		}
		if (last < text.length) parts.push(text.slice(last));
		return parts;
	};

	// Use standard_paras if available (from ISM docx — has style info)
	if (isarp.standard_paras?.length > 0) {
		// Auto-number iatalistitem paragraphs with Roman numerals
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
		let listCounter = 0;
		return (
			<div className={styles.stdText}>
				{isarp.standard_paras.map((para, idx) => {
					const isSubItem = para.style === "iatalistitem";
					const isPlainSubItem =
						!isSubItem && /^\s*\([ivxabcIVXABC]+\)/.test(para.text);
					if (!isSubItem) listCounter = 0; // reset counter on non-list paragraphs
					const prefix = isSubItem
						? `(${ROMAN[listCounter++] || listCounter}) `
						: "";
					return (
						<span
							key={idx}
							className={`${styles.stdLine} ${isSubItem || isPlainSubItem ? styles.stdSubItem : ""}`}
						>
							{isSubItem && (
								<span className={styles.listPrefix}>
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

// ── ISARP Ref Popup — centered modal, auto-sizes to content ──
function RefPopup({
	refCode,
	allIsarps,
	cycleId,
	token,
	onClose,
}: {
	refCode: string;
	allIsarps: ISARPWithRecord[];
	cycleId: string;
	token: string;
	onClose: () => void;
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
								? "Upload the ISM docx files to populate table data."
								: `Import the ${refCode.split(" ")[0]} discipline docx first.`}
						</div>
					)}
					{isarp && (
						<>
							<div className={styles.stdText}>
								{(isarp.standard_paras?.length > 0
									? isarp.standard_paras
									: isarp.standard_text
											.split(/\r\n|\n/)
											.map((t) => ({
												text: t,
												style: "Normal",
											}))
								).map((p, i) => {
									const isSubItem =
										p.style === "iatalistitem" ||
										/^\s*\([ivxabcIVXABC]+\)/.test(p.text);
									return (
										<span
											key={i}
											className={`${styles.stdLine} ${isSubItem ? styles.stdSubItem : ""}`}
										>
											{p.text}
										</span>
									);
								})}
							</div>
							{isarp.guidance && (
								<div
									className={styles.guidanceBox}
									style={{ marginTop: "0.75rem" }}
								>
									<div className={styles.guidanceLabel}>
										Guidance
									</div>
									<div className={styles.guidanceText}>
										{isarp.guidance}
									</div>
								</div>
							)}
						</>
					)}
					{tableData && (
						<div className={styles.tableDisplay}>
							<div className={styles.tableTitle}>
								{tableData.title}
							</div>
							{(tableData.content_json ?? []).map(
								(row: any, i: number) => (
									<div
										key={i}
										className={`${styles.tableRow} ${row.is_header ? styles.tableRowHeader : ""}`}
									>
										{(row.cells ?? []).map(
											(cell: string, j: number) => (
												<div
													key={j}
													className={styles.tableCell}
												>
													{cell}
												</div>
											),
										)}
									</div>
								),
							)}
						</div>
					)}
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
}) {
	const [docRefs, setDocRefs] = useState(record?.doc_references ?? "");
	const [flagged, setFlagged] = useState(record?.prep_flagged ?? false);
	const [flagReason, setFlagReason] = useState(
		record?.prep_flag_reason ?? "",
	);
	const [aaResponses, setAaResponses] = useState<
		Record<string, { completed: boolean; remarks: string }>
	>(record?.aa_responses ?? {});
	const [refPopup, setRefPopup] = useState<string | null>(null);
	const saveTimeout = useRef<NodeJS.Timeout>();

	useEffect(() => {
		setDocRefs(record?.doc_references ?? "");
		setFlagged(record?.prep_flagged ?? false);
		setFlagReason(record?.prep_flag_reason ?? "");
		setAaResponses(record?.aa_responses ?? {});
		setRefPopup(null);
	}, [isarp.isarp_code]);

	const debouncedDocRefs = useDebounce(docRefs, 800);
	const prevDocRefs = useRef(record?.doc_references ?? "");
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
		onSave({ isarp_code: isarp.isarp_code, prep_flagged: v });
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
				<ISARPText isarp={isarp} onRefClick={setRefPopup} />

				{/* Guidance with clickable refs */}
				{isarp.guidance && (
					<div className={styles.guidanceBox}>
						<div className={styles.guidanceLabel}>Guidance</div>
						<GuidanceText
							text={isarp.guidance}
							onRefClick={setRefPopup}
						/>
					</div>
				)}

				{/* Doc references */}
				<div className={styles.fieldGroup}>
					<label className={styles.fieldLabel}>
						Documentation references
					</label>
					<textarea
						className={styles.fieldTextarea}
						value={docRefs}
						onChange={(e) => setDocRefs(e.target.value)}
						placeholder="e.g. CCOM Rev042 Ch.0.5, CCDM -4.4-"
						rows={3}
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
											onClick={() => toggleAA(aa.num)}
										>
											<div
												className={`${styles.aaCheckbox} ${resp.completed ? styles.aaCheckboxDone : ""}`}
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
													rows={2}
													onClick={(e) =>
														e.stopPropagation()
													}
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
				<button className={styles.btnExport}>↓ Export</button>
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
	const { token } = useAuth();

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
