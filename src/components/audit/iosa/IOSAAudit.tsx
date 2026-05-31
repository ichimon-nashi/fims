// src/components/audit/iosa/IOSAAudit.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@supabase/supabase-js";
import styles from "./IOSAAudit.module.css";

const supabaseClient = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

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
	conformance_status: string | null;
	nonconformity_desc: string;
	root_cause: string;
	corrective_action: string;
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
	heading_h2: string;
	heading_h3: string;
	heading_h4: string;
	record: AuditRecord | null;
}

interface ActiveCycle {
	id: string;
	name: string;
	disciplines: string[];
	ism_edition: string;
	status: string;
}

// ── Conformance status config ─────────────────────────────────
const CONFORMANCE_OPTIONS = [
	{
		value: "Conformity (Documented and Implemented)",
		short: "Conformity",
		color: "#48bb78",
		bg: "rgba(72,187,120,0.12)",
		border: "rgba(72,187,120,0.4)",
		key: "C",
	},
	{
		value: "Finding (Not Documented, Not Implemented)",
		short: "Not Documented · Not Implemented",
		color: "#fc8181",
		bg: "rgba(252,129,129,0.12)",
		border: "rgba(252,129,129,0.4)",
		key: "F1",
	},
	{
		value: "Finding (Not Documented, Implemented)",
		short: "Not Documented · Implemented",
		color: "#fc8181",
		bg: "rgba(252,129,129,0.12)",
		border: "rgba(252,129,129,0.4)",
		key: "F2",
	},
	{
		value: "Finding (Documented, Not Implemented)",
		short: "Documented · Not Implemented",
		color: "#fc8181",
		bg: "rgba(252,129,129,0.12)",
		border: "rgba(252,129,129,0.4)",
		key: "F3",
	},
	{
		value: "Observation (Not Documented, Not Implemented)",
		short: "Not Documented · Not Implemented",
		color: "#f6ad55",
		bg: "rgba(246,173,85,0.12)",
		border: "rgba(246,173,85,0.4)",
		key: "O1",
	},
	{
		value: "Observation (Not Documented, Implemented)",
		short: "Not Documented · Implemented",
		color: "#f6ad55",
		bg: "rgba(246,173,85,0.12)",
		border: "rgba(246,173,85,0.4)",
		key: "O2",
	},
	{
		value: "Observation (Documented, Not Implemented)",
		short: "Documented · Not Implemented",
		color: "#f6ad55",
		bg: "rgba(246,173,85,0.12)",
		border: "rgba(246,173,85,0.4)",
		key: "O3",
	},
	{
		value: "N/A (Not Applicable)",
		short: "N/A",
		color: "#a0aec0",
		bg: "rgba(160,174,192,0.10)",
		border: "rgba(160,174,192,0.3)",
		key: "N",
	},
] as const;

function getOptionByValue(v: string | null) {
	return CONFORMANCE_OPTIONS.find((o) => o.value === v) ?? null;
}

function conformanceCategory(
	v: string | null,
): "conformity" | "finding" | "observation" | "na" | null {
	if (!v) return null;
	if (v.startsWith("Conformity")) return "conformity";
	if (v.startsWith("Finding")) return "finding";
	if (v.startsWith("Observation")) return "observation";
	if (v.startsWith("N/A")) return "na";
	return null;
}

// ── Workspace ─────────────────────────────────────────────────
function AuditWorkspace({
	isarp,
	record,
	token,
	cycleId,
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
	token: string;
	cycleId: string;
	onSave: (patch: any) => Promise<void>;
	onNext: () => void;
	onPrev: () => void;
	hasNext: boolean;
	hasPrev: boolean;
	saving: boolean;
	readOnly: boolean;
}) {
	const status = record?.conformance_status ?? null;
	const category = conformanceCategory(status);
	const needsDetails = category === "finding" || category === "observation";

	const [docRefs, setDocRefs] = useState(record?.doc_references ?? "");
	const [nonconfDesc, setNonconfDesc] = useState(
		record?.nonconformity_desc ?? "",
	);
	const [rootCause, setRootCause] = useState(record?.root_cause ?? "");
	const [corrAction, setCorrAction] = useState(
		record?.corrective_action ?? "",
	);
	const saveTimeout = useRef<NodeJS.Timeout>();

	useEffect(() => {
		setDocRefs(record?.doc_references ?? "");
		setNonconfDesc(record?.nonconformity_desc ?? "");
		setRootCause(record?.root_cause ?? "");
		setCorrAction(record?.corrective_action ?? "");
	}, [isarp.isarp_code]);

	const autoSave = (patch: any) => {
		clearTimeout(saveTimeout.current);
		saveTimeout.current = setTimeout(() => onSave(patch), 800);
	};

	const setConformance = (value: string) => {
		const isClearing = value === status;
		const newStatus = isClearing ? null : value;
		const newCat = conformanceCategory(newStatus);
		const wasNC = category === "finding" || category === "observation";
		const isNowNC = newCat === "finding" || newCat === "observation";

		// Switching away from finding/observation — clear the detail fields
		if (wasNC && !isNowNC) {
			setNonconfDesc("");
			setRootCause("");
			setCorrAction("");
			onSave({
				isarp_code: isarp.isarp_code,
				discipline: isarp.discipline,
				conformance_status: newStatus,
				nonconformity_desc: "",
				root_cause: "",
				corrective_action: "",
			});
		} else {
			onSave({
				isarp_code: isarp.isarp_code,
				discipline: isarp.discipline,
				conformance_status: newStatus,
			});
		}
	};

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
	];
	const counters: Record<string, number> = {};
	let lastStyle = "Normal";

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
					{record?.prep_flagged && (
						<span
							className={styles.wsFlagBadge}
							title={
								record?.prep_flag_reason || "Flagged in prep"
							}
						>
							⚑ Flagged
						</span>
					)}
				</div>
				<div className={styles.wsHeaderRight}>
					{readOnly && (
						<span className={styles.readOnlyBadge}>
							👁 View only
						</span>
					)}
					{status && (
						<span
							className={styles.statusChip}
							style={{
								color: getOptionByValue(status)?.color,
								borderColor: getOptionByValue(status)?.border,
								background: getOptionByValue(status)?.bg,
							}}
						>
							{getOptionByValue(status)?.short}
						</span>
					)}
					{saving && <span className={styles.savingDot} />}
				</div>
			</div>

			{/* Body */}
			<div className={styles.wsBody}>
				{/* Standard text */}
				<div className={styles.stdText}>
					{(isarp.standard_paras?.length > 0
						? isarp.standard_paras
						: isarp.standard_text
								.split(/\r?\n/)
								.map((t) => ({ text: t, style: "Normal" }))
					).map((p, idx) => {
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
								{p.text}
							</span>
						);
					})}
				</div>

				{/* Guidance */}
				{isarp.guidance && (
					<div className={styles.guidanceBox}>
						<div className={styles.guidanceLabel}>Guidance</div>
						<div className={styles.guidanceText}>
							{isarp.guidance}
						</div>
					</div>
				)}

				{/* Documentation references — read-only from AuditPrep */}
				{docRefs && (
					<div className={styles.fieldGroup}>
						<div className={styles.fieldLabel}>
							Documentation references
						</div>
						<div className={styles.docRefsReadOnly}>{docRefs}</div>
					</div>
				)}

				{/* Auditor Actions — checkable */}
				{isarp.auditor_actions?.length > 0 && (
					<div className={styles.aaSection}>
						<div className={styles.aaSectionLabel}>
							Auditor Actions
							<span className={styles.aaCount}>
								{
									Object.values(
										record?.aa_responses ?? {},
									).filter((r) => r.completed).length
								}
								/{isarp.auditor_actions.length} completed
							</span>
						</div>
						{isarp.auditor_actions.map((aa) => {
							const resp = record?.aa_responses?.[aa.num];
							return (
								<div
									key={aa.num}
									className={`${styles.aaRow} ${resp?.completed ? styles.aaRowDone : ""}`}
								>
									<div
										className={`${styles.aaCheckbox} ${resp?.completed ? styles.aaCheckboxDone : ""}`}
									>
										{resp?.completed && "✓"}
									</div>
									<span className={styles.aaNum}>
										{aa.num}
									</span>
									<div className={styles.aaContent}>
										<span className={styles.aaText}>
											{aa.text}
										</span>
										{resp?.remarks && (
											<span className={styles.aaRemarks}>
												{resp.remarks}
											</span>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}

				{/* Conformance status — grouped */}
				<div className={styles.conformanceSection}>
					<div className={styles.conformanceSectionLabel}>
						Conformance Status
					</div>

					{/* Conformity + N/A — single row */}
					<div className={styles.conformanceRow1}>
						{CONFORMANCE_OPTIONS.filter(
							(o) => o.key === "C" || o.key === "N",
						).map((opt) => (
							<button
								key={opt.key}
								className={`${styles.conformanceBtn} ${status === opt.value ? styles.conformanceBtnActive : ""}`}
								style={
									status === opt.value
										? {
												background: opt.bg,
												borderColor: opt.border,
												color: opt.color,
											}
										: {}
								}
								onClick={() =>
									!readOnly && setConformance(opt.value)
								}
								disabled={readOnly}
							>
								<span
									className={styles.conformanceBtnDot}
									style={{ background: opt.color }}
								/>
								{opt.short}
							</button>
						))}
					</div>

					{/* Findings — group label + 3 buttons */}
					<div className={styles.conformanceGroup}>
						<div
							className={styles.conformanceGroupLabel}
							style={{ color: "#fc8181" }}
						>
							Finding
						</div>
						<div className={styles.conformanceSubGrid}>
							{CONFORMANCE_OPTIONS.filter((o) =>
								o.key.startsWith("F"),
							).map((opt) => (
								<button
									key={opt.key}
									className={`${styles.conformanceBtn} ${styles.conformanceBtnSm} ${status === opt.value ? styles.conformanceBtnActive : ""}`}
									style={
										status === opt.value
											? {
													background: opt.bg,
													borderColor: opt.border,
												}
											: {}
									}
									onClick={() =>
										!readOnly && setConformance(opt.value)
									}
									disabled={readOnly}
								>
									<span
										className={styles.conformanceBtnDot}
										style={{ background: "#fc8181" }}
									/>
									<span
										className={styles.conformanceBtnMain}
										style={
											status === opt.value
												? { color: opt.color }
												: {}
										}
									>
										{opt.short}
									</span>
								</button>
							))}
						</div>
					</div>

					{/* Observations — group label + 3 buttons */}
					<div className={styles.conformanceGroup}>
						<div
							className={styles.conformanceGroupLabel}
							style={{ color: "#f6ad55" }}
						>
							Observation
						</div>
						<div className={styles.conformanceSubGrid}>
							{CONFORMANCE_OPTIONS.filter((o) =>
								o.key.startsWith("O"),
							).map((opt) => (
								<button
									key={opt.key}
									className={`${styles.conformanceBtn} ${styles.conformanceBtnSm} ${status === opt.value ? styles.conformanceBtnActive : ""}`}
									style={
										status === opt.value
											? {
													background: opt.bg,
													borderColor: opt.border,
												}
											: {}
									}
									onClick={() =>
										!readOnly && setConformance(opt.value)
									}
									disabled={readOnly}
								>
									<span
										className={styles.conformanceBtnDot}
										style={{ background: "#f6ad55" }}
									/>
									<span
										className={styles.conformanceBtnMain}
										style={
											status === opt.value
												? { color: opt.color }
												: {}
										}
									>
										{opt.short}
									</span>
								</button>
							))}
						</div>
					</div>
				</div>

				{/* Finding / Observation detail fields */}
				{needsDetails && (
					<div className={styles.findingFields}>
						<div className={styles.fieldGroup}>
							<label className={styles.fieldLabel}>
								{category === "finding"
									? "Nonconformity Description"
									: "Observation Description"}
								<span className={styles.fieldRequired}>*</span>
							</label>
							<textarea
								className={styles.fieldTextarea}
								value={nonconfDesc}
								rows={3}
								placeholder="Describe the finding / observation..."
								disabled={readOnly}
								onChange={(e) => {
									setNonconfDesc(e.target.value);
									autoSave({
										isarp_code: isarp.isarp_code,
										discipline: isarp.discipline,
										nonconformity_desc: e.target.value,
									});
								}}
							/>
						</div>
						{category === "finding" && (
							<>
								<div className={styles.fieldGroup}>
									<label className={styles.fieldLabel}>
										Root Cause
									</label>
									<textarea
										className={styles.fieldTextarea}
										value={rootCause}
										rows={2}
										placeholder="Root cause analysis..."
										onChange={(e) => {
											setRootCause(e.target.value);
											autoSave({
												isarp_code: isarp.isarp_code,
												discipline: isarp.discipline,
												root_cause: e.target.value,
											});
										}}
									/>
								</div>
								<div className={styles.fieldGroup}>
									<label className={styles.fieldLabel}>
										Corrective Action
									</label>
									<textarea
										className={styles.fieldTextarea}
										value={corrAction}
										rows={2}
										placeholder="Proposed corrective action..."
										onChange={(e) => {
											setCorrAction(e.target.value);
											autoSave({
												isarp_code: isarp.isarp_code,
												discipline: isarp.discipline,
												corrective_action:
													e.target.value,
											});
										}}
									/>
								</div>
							</>
						)}
					</div>
				)}
			</div>

			{/* Footer nav */}
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
		</div>
	);
}

// ── List item ─────────────────────────────────────────────────
function AuditListItem({
	isarp,
	selected,
	onClick,
}: {
	isarp: ISARPWithRecord;
	selected: boolean;
	onClick: () => void;
}) {
	const status = isarp.record?.conformance_status ?? null;
	const category = conformanceCategory(status);
	const opt = getOptionByValue(status);

	return (
		<div
			className={`${styles.listRow} ${selected ? styles.listRowActive : ""}`}
			onClick={onClick}
		>
			<div
				className={styles.statusDot}
				style={
					opt
						? { background: opt.color, borderColor: opt.border }
						: {}
				}
				title={status ?? "Not assessed"}
			/>
			<div className={styles.listRowCode}>{isarp.isarp_code}</div>
			<div className={styles.listRowBadges}>
				{isarp.isarp_type === "Recommended Practice" && (
					<span className={styles.listRPBadge}>RP</span>
				)}
				{(isarp.linked_isarps?.length ?? 0) > 0 && (
					<span className={styles.listLinkBadge} title="Interlinked">
						🔗
					</span>
				)}
				{isarp.record?.prep_flagged && (
					<span
						className={styles.listFlagBadge}
						title="Flagged in prep"
					>
						⚑
					</span>
				)}
			</div>
		</div>
	);
}

// ── Main component ────────────────────────────────────────────
export default function IOSAAudit({
	activeCycle,
}: {
	activeCycle: ActiveCycle | null;
}) {
	const { token, user } = useAuth();

	const [discipline, setDiscipline] = useState<string>("");

	// Discipline-level edit permission — raw DB shape: audit.iosa_edit_disciplines is string[]
	// null/undefined = no restriction (backwards compatible). Empty array = no disciplines allowed.
	const editDiscs: string[] | null =
		(user?.app_permissions as any)?.audit?.iosa_edit_disciplines ?? null;
	const canEditDiscipline = !discipline
		? true // no discipline selected yet — default allow
		: editDiscs === null
			? true // no restriction set — full access (legacy users)
			: editDiscs.includes(discipline); // must be in the whitelist
	const [allIsarps, setAllIsarps] = useState<ISARPWithRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [filterStatus, setFilterStatus] = useState<
		"pending" | "nonconformity" | "done"
	>("pending");

	// Set initial discipline
	useEffect(() => {
		if (activeCycle?.disciplines?.length && !discipline) {
			setDiscipline(activeCycle.disciplines[0]);
		}
	}, [activeCycle]);

	// Load ISARPs for discipline
	useEffect(() => {
		if (!discipline || !activeCycle?.id || !token) return;
		setLoading(true);
		setSelectedCode(null);
		fetch(
			`/api/audit/iosa/auditprep?cycle_id=${activeCycle.id}&discipline=${discipline}`,
			{
				headers: { Authorization: `Bearer ${token}` },
			},
		)
			.then((r) => r.json())
			.then(({ isarps }) => setAllIsarps(isarps ?? []))
			.catch(console.error)
			.finally(() => setLoading(false));
	}, [discipline, activeCycle?.id, token]);

	// Realtime: subscribe to record changes for this cycle+discipline
	useEffect(() => {
		if (!activeCycle?.id || !discipline) return;

		const channel = supabaseClient
			.channel(`audit-records-${activeCycle.id}-${discipline}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "audit_iosa_records",
					filter: `cycle_id=eq.${activeCycle.id}`,
				},
				(payload) => {
					const record = payload.new as AuditRecord;
					if (!record || record.discipline !== discipline) return;
					setAllIsarps((prev) =>
						prev.map((i) =>
							i.isarp_code === record.isarp_code
								? { ...i, record }
								: i,
						),
					);
				},
			)
			.subscribe();

		return () => {
			supabaseClient.removeChannel(channel);
		};
	}, [activeCycle?.id, discipline]);

	// Track selected by code so it persists across filter changes
	const [selectedCode, setSelectedCode] = useState<string | null>(null);

	// Filtered list
	const filtered = allIsarps.filter((i) => {
		const q = searchQuery.toLowerCase();
		if (
			q &&
			!i.isarp_code.toLowerCase().includes(q) &&
			!i.standard_text.toLowerCase().includes(q)
		)
			return false;
		const cat = conformanceCategory(i.record?.conformance_status ?? null);
		if (filterStatus === "pending") return !i.record?.conformance_status;
		if (filterStatus === "nonconformity")
			return cat === "finding" || cat === "observation";
		if (filterStatus === "done")
			return cat === "conformity" || cat === "na";
		return true;
	});

	// Selected is the tracked code — falls back to first filtered item
	const selected =
		(selectedCode
			? allIsarps.find((i) => i.isarp_code === selectedCode)
			: null) ??
		filtered[0] ??
		null;

	// When filter changes, reset selectedCode to first item in new list
	useEffect(() => {
		setSelectedCode(filtered[0]?.isarp_code ?? null);
	}, [filterStatus, discipline]);

	const handleReset = useCallback(
		async (isarpCode: string, discipline: string) => {
			if (!token || !activeCycle) return;
			await fetch("/api/audit/iosa/auditprep", {
				method: "PATCH",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					cycle_id: activeCycle.id,
					isarp_code: isarpCode,
					discipline,
					conformance_status: null,
				}),
			});
			setAllIsarps((prev) =>
				prev.map((i) =>
					i.isarp_code === isarpCode
						? {
								...i,
								record: i.record
									? { ...i.record, conformance_status: null }
									: i.record,
							}
						: i,
				),
			);
		},
		[token, activeCycle],
	);

	const handleSave = useCallback(
		async (patch: any) => {
			if (!token || !activeCycle) return;
			setSaving(true);
			try {
				const res = await fetch("/api/audit/iosa/auditprep", {
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						cycle_id: activeCycle.id,
						...patch,
					}),
				});
				const { record } = await res.json();
				if (record) {
					setAllIsarps((prev) =>
						prev.map((i) =>
							i.isarp_code === record.isarp_code
								? { ...i, record }
								: i,
						),
					);
					// Keep selected ISARP in workspace — tab switches on navigate
					if (patch.conformance_status !== undefined) {
						setSelectedCode(record.isarp_code);
					}
				}
			} catch (e) {
				console.error(e);
			} finally {
				setSaving(false);
			}
		},
		[token, activeCycle],
	);

	// Navigate to an ISARP — switches tab to the bucket it now belongs to
	const navigateTo = useCallback(
		(code: string) => {
			const isarp = allIsarps.find((i) => i.isarp_code === code);
			if (!isarp) return;
			const cat = conformanceCategory(
				isarp.record?.conformance_status ?? null,
			);
			if (cat === "finding" || cat === "observation")
				setFilterStatus("nonconformity");
			else if (cat === "conformity" || cat === "na")
				setFilterStatus("done");
			else setFilterStatus("pending");
			setSelectedCode(code);
		},
		[allIsarps],
	);

	// Stats
	const stats = {
		total: allIsarps.length,
		assessed: allIsarps.filter((i) => i.record?.conformance_status).length,
		findings: allIsarps.filter(
			(i) =>
				conformanceCategory(i.record?.conformance_status ?? null) ===
				"finding",
		).length,
		observations: allIsarps.filter(
			(i) =>
				conformanceCategory(i.record?.conformance_status ?? null) ===
				"observation",
		).length,
		conformities: allIsarps.filter(
			(i) =>
				conformanceCategory(i.record?.conformance_status ?? null) ===
				"conformity",
		).length,
		nonconformities: allIsarps.filter((i) => {
			const c = conformanceCategory(i.record?.conformance_status ?? null);
			return c === "finding" || c === "observation";
		}).length,
	};

	if (!activeCycle) {
		return (
			<div className={styles.noCycle}>
				<div className={styles.noCycleIcon}>🔍</div>
				<p className={styles.noCycleText}>No active cycle selected.</p>
			</div>
		);
	}

	return (
		<div className={styles.auditPage}>
			{/* Discipline pills + stats strip */}
			<div className={styles.topNav}>
				<div className={styles.discRow}>
					{(activeCycle.disciplines ?? []).map((d) => (
						<button
							key={d}
							className={`${styles.discPill} ${discipline === d ? styles.discPillActive : ""}`}
							onClick={() => {
								setDiscipline(d);
								setSearchQuery("");
								setFilterStatus("pending");
							}}
						>
							{d}
						</button>
					))}
				</div>
				<div className={styles.statsStrip}>
					<span className={styles.statItem}>
						<span className={styles.statVal}>{stats.assessed}</span>
						<span className={styles.statLbl}>
							/ {stats.total} assessed
						</span>
					</span>
					<span className={styles.statDivider} />
					<span className={styles.statItem}>
						<span
							className={styles.statVal}
							style={{ color: "#fc8181" }}
						>
							{stats.findings}
						</span>
						<span className={styles.statLbl}>findings</span>
					</span>
					<span className={styles.statDivider} />
					<span className={styles.statItem}>
						<span
							className={styles.statVal}
							style={{ color: "#f6ad55" }}
						>
							{stats.observations}
						</span>
						<span className={styles.statLbl}>observations</span>
					</span>
					<span className={styles.statDivider} />
					<span className={styles.statItem}>
						<span
							className={styles.statVal}
							style={{ color: "#48bb78" }}
						>
							{stats.conformities}
						</span>
						<span className={styles.statLbl}>conformities</span>
					</span>
				</div>
			</div>

			{/* Split panel */}
			<div className={styles.splitPanel}>
				{/* List panel */}
				<div className={styles.listPanel}>
					<div className={styles.listHeader}>
						<input
							className={styles.searchInput}
							placeholder="Search…"
							value={searchQuery}
							onChange={(e) => {
								setSearchQuery(e.target.value);
							}}
						/>
						<div className={styles.filterRow}>
							<div className={styles.filterTabs}>
								{(
									[
										{
											id: "pending",
											label: "Pending",
											color: "",
										},
										{
											id: "nonconformity",
											label: "Non-conformity",
											color: "#fc8181",
										},
										{
											id: "done",
											label: "Done",
											color: "#48bb78",
										},
									] as const
								).map((f) => (
									<button
										key={f.id}
										className={`${styles.filterBtn} ${filterStatus === f.id ? styles.filterBtnActive : ""}`}
										style={
											filterStatus === f.id && f.color
												? {
														color: f.color,
														borderColor:
															f.color + "66",
													}
												: {}
										}
										onClick={() => {
											setFilterStatus(f.id as any);
										}}
									>
										{f.label}
										{f.id === "nonconformity" &&
											stats.nonconformities > 0 && (
												<span
													className={
														styles.filterCount
													}
												>
													{stats.nonconformities}
												</span>
											)}
										{f.id === "pending" && (
											<span
												className={styles.filterCount}
											>
												{
													allIsarps.filter(
														(i) =>
															!i.record
																?.conformance_status,
													).length
												}
											</span>
										)}
									</button>
								))}
							</div>
							{filterStatus === "done" && stats.assessed > 0 && (
								<button
									className={styles.resetBtn}
									onClick={() => {
										if (
											!confirm(
												"Reset all " +
													stats.assessed +
													" assessed ISARPs in " +
													discipline +
													" to pending? This cannot be undone.",
											)
										)
											return;
										allIsarps
											.filter(
												(i) =>
													i.record
														?.conformance_status,
											)
											.forEach((i) =>
												handleReset(
													i.isarp_code,
													i.discipline,
												),
											);
									}}
									title="Reset all to pending"
								>
									↺ Reset all to pending
								</button>
							)}
						</div>
					</div>
					<div className={styles.listBody}>
						{loading ? (
							<div className={styles.listLoading}>
								<div className={styles.spinner} />
							</div>
						) : filtered.length === 0 ? (
							<div className={styles.listEmpty}>
								No ISARPs match filter.
							</div>
						) : (
							filtered.map((isarp, idx) => (
								<AuditListItem
									key={isarp.isarp_code}
									isarp={isarp}
									selected={
										isarp.isarp_code ===
										selected?.isarp_code
									}
									onClick={() => navigateTo(isarp.isarp_code)}
								/>
							))
						)}
					</div>
				</div>

				{/* Workspace */}
				{selected ? (
					<AuditWorkspace
						isarp={selected}
						record={selected.record}
						token={token ?? ""}
						cycleId={activeCycle.id}
						onSave={handleSave}
						onNext={() => {
							const cur = allIsarps.findIndex(
								(i) => i.isarp_code === selected?.isarp_code,
							);
							// Find next pending ISARP after current position
							const nextPending = allIsarps
								.slice(cur + 1)
								.find((i) => !i.record?.conformance_status);
							if (nextPending) navigateTo(nextPending.isarp_code);
							else {
								// No more pending — just go to next in sequence regardless
								const next = allIsarps[cur + 1];
								if (next) navigateTo(next.isarp_code);
							}
						}}
						onPrev={() => {
							const cur = allIsarps.findIndex(
								(i) => i.isarp_code === selected?.isarp_code,
							);
							// Find previous pending ISARP before current position
							const prevPending = allIsarps
								.slice(0, cur)
								.reverse()
								.find((i) => !i.record?.conformance_status);
							if (prevPending) navigateTo(prevPending.isarp_code);
							else {
								const prev = allIsarps[cur - 1];
								if (prev) navigateTo(prev.isarp_code);
							}
						}}
						hasNext={
							allIsarps.findIndex(
								(i) => i.isarp_code === selected?.isarp_code,
							) <
							allIsarps.length - 1
						}
						hasPrev={
							allIsarps.findIndex(
								(i) => i.isarp_code === selected?.isarp_code,
							) > 0
						}
						saving={saving}
						readOnly={!canEditDiscipline}
					/>
				) : (
					<div className={styles.noSelection}>
						Select an ISARP to begin audit.
					</div>
				)}
			</div>
		</div>
	);
}
