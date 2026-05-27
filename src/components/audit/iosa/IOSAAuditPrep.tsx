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
	isarp_type: string;
	has_gm: boolean;
	has_sms: boolean;
	linked_isarps: string[];
	auditor_actions: { num: string; text: string }[];
	record: AuditRecord | null;
}

interface ActiveCycle {
	id: string;
	disciplines: string[];
	ism_edition: string;
	name: string;
}

interface IOSAAuditPrepProps {
	activeCycle: ActiveCycle | null;
}

// ── Status helpers ────────────────────────────────────────────
function getPrepStatus(
	record: AuditRecord | null,
): "not_started" | "in_progress" | "ready" {
	if (!record) return "not_started";
	return record.prep_status || "not_started";
}

function statusDotClass(status: string, styles: any) {
	switch (status) {
		case "ready":
			return styles.dotReady;
		case "in_progress":
			return styles.dotInProgress;
		default:
			return styles.dotNone;
	}
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), delay);
		return () => clearTimeout(timer);
	}, [value, delay]);
	return debounced;
}

// ── ISARP List (left panel) ───────────────────────────────────
interface ISARPListProps {
	isarps: ISARPWithRecord[];
	selectedCode: string | null;
	onSelect: (isarp: ISARPWithRecord) => void;
	searchQuery: string;
	onSearch: (q: string) => void;
	sectionCounts: Record<number, { total: number; ready: number }>;
}

function ISARPList({
	isarps,
	selectedCode,
	onSelect,
	searchQuery,
	onSearch,
	sectionCounts,
}: ISARPListProps) {
	return (
		<div className={styles.listPanel}>
			<div className={styles.listHeader}>
				<input
					className={styles.searchInput}
					placeholder="Search ISARPs…"
					value={searchQuery}
					onChange={(e) => onSearch(e.target.value)}
				/>
			</div>
			<div className={styles.listBody}>
				{isarps.length === 0 ? (
					<div className={styles.listEmpty}>
						{searchQuery
							? "No ISARPs match your search"
							: "No ISARPs found — import the CR first"}
					</div>
				) : (
					isarps.map((isarp) => {
						const status = getPrepStatus(isarp.record);
						return (
							<div
								key={isarp.isarp_code}
								className={`${styles.listRow} ${selectedCode === isarp.isarp_code ? styles.listRowActive : ""}`}
								onClick={() => onSelect(isarp)}
							>
								<div
									className={`${styles.statusDot} ${statusDotClass(status, styles)}`}
								/>
								<div className={styles.listRowCode}>
									{isarp.isarp_code}
								</div>
								<div className={styles.listRowPreview}>
									{isarp.standard_text
										.slice(isarp.isarp_code.length)
										.trim()
										.slice(0, 60)}
								</div>
								{isarp.record?.prep_flagged && (
									<div
										className={styles.flagDot}
										title="Flagged"
									>
										⚑
									</div>
								)}
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

// ── Workspace (right panel) ───────────────────────────────────
interface WorkspaceProps {
	isarp: ISARPWithRecord;
	record: AuditRecord | null;
	cycleId: string;
	onSave: (patch: Partial<AuditRecord>) => Promise<void>;
	onNext: () => void;
	onPrev: () => void;
	hasNext: boolean;
	hasPrev: boolean;
	saving: boolean;
}

function Workspace({
	isarp,
	record,
	cycleId,
	onSave,
	onNext,
	onPrev,
	hasNext,
	hasPrev,
	saving,
}: WorkspaceProps) {
	const [docRefs, setDocRefs] = useState(record?.doc_references ?? "");
	const [flagged, setFlagged] = useState(record?.prep_flagged ?? false);
	const [flagReason, setFlagReason] = useState(
		record?.prep_flag_reason ?? "",
	);
	const [aaResponses, setAaResponses] = useState<
		Record<string, { completed: boolean; remarks: string }>
	>(record?.aa_responses ?? {});
	const [textExpanded, setTextExpanded] = useState(false);
	const saveTimeout = useRef<NodeJS.Timeout>();

	// Reset when ISARP changes
	useEffect(() => {
		setDocRefs(record?.doc_references ?? "");
		setFlagged(record?.prep_flagged ?? false);
		setFlagReason(record?.prep_flag_reason ?? "");
		setAaResponses(record?.aa_responses ?? {});
		setTextExpanded(false);
	}, [isarp.isarp_code]);

	// Auto-save debounced
	const debouncedDocRefs = useDebounce(docRefs, 800);
	const debouncedFlagReason = useDebounce(flagReason, 800);

	useEffect(() => {
		if (debouncedDocRefs === (record?.doc_references ?? "")) return;
		onSave({ doc_references: debouncedDocRefs });
	}, [debouncedDocRefs]);

	useEffect(() => {
		if (debouncedFlagReason === (record?.prep_flag_reason ?? "")) return;
		onSave({ prep_flag_reason: debouncedFlagReason });
	}, [debouncedFlagReason]);

	const toggleAA = (num: string) => {
		const updated = {
			...aaResponses,
			[num]: {
				completed: !aaResponses[num]?.completed,
				remarks: aaResponses[num]?.remarks ?? "",
			},
		};
		setAaResponses(updated);
		onSave({ aa_responses: updated });
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
		// debounce AA remarks save
		clearTimeout(saveTimeout.current);
		saveTimeout.current = setTimeout(
			() => onSave({ aa_responses: updated }),
			800,
		);
	};

	const toggleFlag = () => {
		const newVal = !flagged;
		setFlagged(newVal);
		onSave({
			prep_flagged: newVal,
			prep_flag_reason: newVal ? flagReason : "",
		});
	};

	const markReady = () => {
		onSave({
			prep_status: "ready",
			doc_references: docRefs,
			aa_responses: aaResponses,
			prep_flagged: flagged,
			prep_flag_reason: flagReason,
		});
	};

	const markInProgress = () => {
		onSave({ prep_status: "in_progress" });
	};

	const status = getPrepStatus(record);
	const completedAAs =
		isarp.auditor_actions?.filter((aa) => aaResponses[aa.num]?.completed)
			.length ?? 0;
	const totalAAs = isarp.auditor_actions?.length ?? 0;

	return (
		<div className={styles.workspace}>
			{/* ── Header ── */}
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
					{isarp.linked_isarps?.length > 0 && (
						<div className={styles.wsLinks}>
							{isarp.linked_isarps.map((link) => (
								<span key={link} className={styles.wsLinkChip}>
									🔗 {link}
								</span>
							))}
						</div>
					)}
				</div>
				<div className={styles.wsHeaderRight}>
					<span
						className={`${styles.wsStatus} ${styles[`wsStatus_${status}`]}`}
					>
						{status === "ready"
							? "✓ Ready"
							: status === "in_progress"
								? "In progress"
								: "Not started"}
					</span>
					{saving && <span className={styles.savingDot}>●</span>}
				</div>
			</div>

			{/* ── Standard text ── */}
			<div className={styles.wsBody}>
				<div
					className={`${styles.stdText} ${textExpanded ? styles.stdTextExpanded : ""}`}
					onClick={() => setTextExpanded((e) => !e)}
				>
					{isarp.standard_text}
				</div>
				<button
					className={styles.expandBtn}
					onClick={() => setTextExpanded((e) => !e)}
				>
					{textExpanded ? "▴ collapse" : "▾ show full text"}
				</button>

				{/* ── Doc references ── */}
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

				{/* ── Auditor Actions ── */}
				{totalAAs > 0 && (
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
				)}

				{/* ── No AA data note ── */}
				{totalAAs === 0 && (
					<div className={styles.noAaNote}>
						Auditor actions not yet loaded for this ISARP. Import
						the ISM PDF to populate AA text.
					</div>
				)}

				{/* ── Flag ── */}
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

			{/* ── Footer ── */}
			<div className={styles.wsFooter}>
				<button
					className={styles.btnExport}
					title="Export prep data to CR xlsx / checklist docx"
				>
					↓ Export
				</button>
				{status === "ready" ? (
					<button
						className={styles.btnReady}
						onClick={markInProgress}
					>
						↩ Unmark ready
					</button>
				) : (
					<button className={styles.btnReady} onClick={markReady}>
						✓ Mark ready
					</button>
				)}
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
		</div>
	);
}

// ── Main AuditPrep ────────────────────────────────────────────
export default function IOSAAuditPrep({ activeCycle }: IOSAAuditPrepProps) {
	const { token } = useAuth();
	const [activeSection, setActiveSection] = useState<number>(1);
	const [searchQuery, setSearchQuery] = useState("");
	const [isarps, setIsarps] = useState<ISARPWithRecord[]>([]);
	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const SECTIONS = [1, 2, 3, 4];

	// Fetch ISARPs for selected discipline + section
	const fetchIsarps = useCallback(async () => {
		if (!token || !activeCycle) return;
		setLoading(true);
		try {
			const discipline = activeCycle.disciplines?.[0] ?? "CAB";
			const res = await fetch(
				`/api/audit/iosa/auditprep?cycle_id=${activeCycle.id}&discipline=${discipline}&section=${activeSection}&ism_edition=${encodeURIComponent(activeCycle.ism_edition)}`,
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			if (!res.ok) throw new Error("Failed to fetch ISARPs");
			const { isarps: data } = await res.json();
			setIsarps(data ?? []);
			// Auto-select first if nothing selected
			if (!selectedCode && data?.length)
				setSelectedCode(data[0].isarp_code);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	}, [token, activeCycle, activeSection]);

	useEffect(() => {
		fetchIsarps();
	}, [fetchIsarps]);

	// Save a record patch
	const handleSave = useCallback(
		async (patch: Partial<AuditRecord>) => {
			if (!token || !activeCycle || !selectedCode) return;
			setSaving(true);
			try {
				const discipline = activeCycle.disciplines?.[0] ?? "CAB";
				const res = await fetch("/api/audit/iosa/auditprep", {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						cycle_id: activeCycle.id,
						isarp_code: selectedCode,
						discipline,
						...patch,
					}),
				});
				if (!res.ok) throw new Error("Save failed");
				const { record } = await res.json();
				// Update local state
				setIsarps((prev) =>
					prev.map((i) =>
						i.isarp_code === selectedCode ? { ...i, record } : i,
					),
				);
			} catch (e) {
				console.error(e);
			} finally {
				setSaving(false);
			}
		},
		[token, activeCycle, selectedCode],
	);

	// Navigation
	const filteredIsarps = searchQuery
		? isarps.filter(
				(i) =>
					i.isarp_code
						.toLowerCase()
						.includes(searchQuery.toLowerCase()) ||
					i.standard_text
						.toLowerCase()
						.includes(searchQuery.toLowerCase()),
			)
		: isarps;

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

	// Section counts
	const sectionCounts = SECTIONS.reduce(
		(acc, s) => {
			const sectionIsarps = isarps.filter((i) => i.section === s);
			acc[s] = {
				total: sectionIsarps.length,
				ready: sectionIsarps.filter(
					(i) => getPrepStatus(i.record) === "ready",
				).length,
			};
			return acc;
		},
		{} as Record<number, { total: number; ready: number }>,
	);

	// Overall progress for current section
	const currentSectionIsarps = isarps;
	const readyCount = currentSectionIsarps.filter(
		(i) => getPrepStatus(i.record) === "ready",
	).length;

	if (!activeCycle) {
		return (
			<div className={styles.noCycle}>
				<div className={styles.noCycleIcon}>📋</div>
				<p className={styles.noCycleText}>
					Go to Dashboard and create or select an audit cycle first.
				</p>
			</div>
		);
	}

	return (
		<div className={styles.auditPrep}>
			{/* ── Section pills + progress ── */}
			<div className={styles.topBar}>
				<div className={styles.sectionPills}>
					{SECTIONS.map((s) => (
						<button
							key={s}
							className={`${styles.sectionPill} ${activeSection === s ? styles.sectionPillActive : ""}`}
							onClick={() => {
								setActiveSection(s);
								setSelectedCode(null);
								setSearchQuery("");
							}}
						>
							{activeCycle.disciplines?.[0] ?? "CAB"} {s}
							<span className={styles.pillCount}>
								{sectionCounts[s]?.ready ?? 0}/
								{sectionCounts[s]?.total ?? "–"}
							</span>
						</button>
					))}
				</div>
				<div className={styles.progressInfo}>
					{loading
						? "Loading…"
						: `${readyCount} / ${currentSectionIsarps.length} ready`}
				</div>
			</div>

			{/* ── Split panel ── */}
			{loading ? (
				<div className={styles.loadingCenter}>
					<div className={styles.spinner} />
				</div>
			) : (
				<div className={styles.splitPanel}>
					<ISARPList
						isarps={filteredIsarps}
						selectedCode={selectedCode}
						onSelect={(i) => setSelectedCode(i.isarp_code)}
						searchQuery={searchQuery}
						onSearch={setSearchQuery}
						sectionCounts={sectionCounts}
					/>
					{selectedIsarp ? (
						<Workspace
							isarp={selectedIsarp}
							record={selectedIsarp.record}
							cycleId={activeCycle.id}
							onSave={handleSave}
							onNext={goNext}
							onPrev={goPrev}
							hasNext={selectedIndex < filteredIsarps.length - 1}
							hasPrev={selectedIndex > 0}
							saving={saving}
						/>
					) : (
						<div className={styles.noSelection}>
							<span>Select an ISARP from the list</span>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
