// src/components/audit/iosa/IOSADashboard.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./IOSADashboard.module.css";

// ── Types ────────────────────────────────────────────────────
interface AuditCycle {
	id: string;
	name: string;
	year: number;
	status: "prep" | "active" | "completed";
	ism_edition: string;
	disciplines: string[];
	created_by: string;
	created_at: string;
}

interface DisciplineStats {
	discipline: string;
	total: number;
	completed: number;
	findings: number;
	observations: number;
	inScope: boolean;
}

interface FlaggedISARP {
	isarp_code: string;
	discipline: string;
	reason: string;
	flag_type: "prep" | "finding" | "observation";
}

interface DashboardData {
	cycle: AuditCycle | null;
	disciplineStats: DisciplineStats[];
	flaggedISARPs: FlaggedISARP[];
	linkedAlerts: string[];
}

const DISCIPLINE_TOTALS: Record<string, number> = {
	CAB: 233,
	FLT: 578,
	DSP: 244,
	MNT: 205,
	GRH: 218,
	ORG: 160,
	CGO: 148,
	SEC: 129,
};
const DISCIPLINE_ORDER = [
	"CAB",
	"FLT",
	"DSP",
	"MNT",
	"GRH",
	"ORG",
	"CGO",
	"SEC",
];

const STATUS_LABELS: Record<string, string> = {
	prep: "準備中",
	active: "進行中",
	completed: "已完成",
};

// ── Create Cycle Modal ────────────────────────────────────────
interface CreateCycleModalProps {
	token: string;
	onClose: () => void;
	onCreated: (cycle: AuditCycle) => void;
}

function CreateCycleModal({
	token,
	onClose,
	onCreated,
}: CreateCycleModalProps) {
	const currentYear = new Date().getFullYear();
	const [name, setName] = useState(`IOSA ${currentYear}`);
	const [year, setYear] = useState(currentYear);
	const [ismEdition, setIsmEdition] = useState("Ed.18 Rev1");
	const [disciplines, setDisciplines] = useState<string[]>(["CAB"]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [confirmOverwrite, setConfirmOverwrite] = useState(false);

	const toggleDiscipline = (d: string) =>
		setDisciplines((prev) =>
			prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
		);

	const doCreate = async (force = false) => {
		if (!name.trim()) {
			setError("請輸入查核名稱");
			return;
		}
		if (disciplines.length === 0) {
			setError("請選擇至少一個查核規範");
			return;
		}
		setLoading(true);
		setError("");
		try {
			const res = await fetch("/api/audit/iosa/cycles", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					name: name.trim(),
					year,
					ism_edition: ismEdition,
					disciplines,
					force,
				}),
			});
			if (res.status === 409) {
				// Duplicate name — show confirmation dialog
				setConfirmOverwrite(true);
				setLoading(false);
				return;
			}
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || "建立失敗");
			}
			const { cycle } = await res.json();
			onCreated(cycle);
		} catch (e: any) {
			setError(e.message);
			setLoading(false);
		}
	};

	return (
		<div className={styles.modalBackdrop}>
			<div className={styles.modal}>
				<div className={styles.modalHeader}>
					<h2 className={styles.modalTitle}>建立新查核週期</h2>
					<button className={styles.modalClose} onClick={onClose}>
						✕
					</button>
				</div>

				{confirmOverwrite ? (
					<div className={styles.modalBody}>
						<div className={styles.confirmMsg}>
							已存在名稱為「{name}
							」的查核週期，確定要再建立一個同名週期嗎？
						</div>
						{error && (
							<div className={styles.errorMsg}>{error}</div>
						)}
						<div className={styles.modalFooter}>
							<button
								className={styles.btnGhost}
								onClick={() => setConfirmOverwrite(false)}
							>
								取消
							</button>
							<button
								className={styles.btnDanger}
								onClick={() => doCreate(true)}
								disabled={loading}
							>
								{loading ? "建立中..." : "確認建立"}
							</button>
						</div>
					</div>
				) : (
					<>
						<div className={styles.modalBody}>
							<div className={styles.fieldGroup}>
								<label className={styles.fieldLabel}>
									查核名稱
								</label>
								<input
									className={styles.fieldInput}
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="e.g. IOSA 2026"
								/>
							</div>
							<div className={styles.fieldRow}>
								<div className={styles.fieldGroup}>
									<label className={styles.fieldLabel}>
										年度
									</label>
									<input
										className={styles.fieldInput}
										type="number"
										value={year}
										onChange={(e) =>
											setYear(Number(e.target.value))
										}
									/>
								</div>
								<div
									className={styles.fieldGroup}
									style={{ flex: 2 }}
								>
									<label className={styles.fieldLabel}>
										ISM 版本
									</label>
									<input
										className={styles.fieldInput}
										value={ismEdition}
										onChange={(e) =>
											setIsmEdition(e.target.value)
										}
										placeholder="Ed.18 Rev1"
									/>
								</div>
							</div>
							<div className={styles.fieldGroup}>
								<label className={styles.fieldLabel}>
									查核規範範圍
								</label>
								<div className={styles.disciplineGrid}>
									{DISCIPLINE_ORDER.map((d) => (
										<button
											key={d}
											type="button"
											className={`${styles.disciplineToggle} ${disciplines.includes(d) ? styles.disciplineToggleOn : ""}`}
											onClick={() => toggleDiscipline(d)}
										>
											<span
												className={
													styles.disciplineCode
												}
											>
												{d}
											</span>
											<span
												className={
													styles.disciplineCount
												}
											>
												{DISCIPLINE_TOTALS[d]}
											</span>
										</button>
									))}
								</div>
							</div>
							{error && (
								<div className={styles.errorMsg}>{error}</div>
							)}
						</div>
						<div className={styles.modalFooter}>
							<button
								className={styles.btnGhost}
								onClick={onClose}
							>
								取消
							</button>
							<button
								className={styles.btnPrimary}
								onClick={() => doCreate(false)}
								disabled={loading}
							>
								{loading ? "建立中..." : "建立查核週期"}
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

// ── Delete Confirmation Modal ─────────────────────────────────
interface DeleteCycleModalProps {
	cycle: AuditCycle;
	onClose: () => void;
	onConfirm: () => void;
}

function DeleteCycleModal({
	cycle,
	onClose,
	onConfirm,
}: DeleteCycleModalProps) {
	const [typedName, setTypedName] = useState("");
	const matches = typedName.trim() === cycle.name.trim();
	return (
		<div className={styles.modalBackdrop}>
			<div className={styles.modal}>
				<div className={styles.modalHeader}>
					<h2
						className={styles.modalTitle}
						style={{ color: "#fc8181" }}
					>
						刪除查核週期
					</h2>
					<button className={styles.modalClose} onClick={onClose}>
						✕
					</button>
				</div>
				<div className={styles.modalBody}>
					<div
						className={styles.confirmMsg}
						style={{
							borderColor: "rgba(252,129,129,0.3)",
							background: "rgba(252,129,129,0.06)",
						}}
					>
						此操作將永久刪除「<strong>{cycle.name}</strong>
						」及其所有查核記錄，無法復原。
					</div>
					<div className={styles.fieldGroup}>
						<label className={styles.fieldLabel}>
							請輸入查核名稱以確認刪除
						</label>
						<input
							className={styles.fieldInput}
							value={typedName}
							onChange={(e) => setTypedName(e.target.value)}
							placeholder={cycle.name}
							autoFocus
						/>
					</div>
				</div>
				<div className={styles.modalFooter}>
					<button className={styles.btnGhost} onClick={onClose}>
						取消
					</button>
					<button
						className={styles.btnDanger}
						onClick={onConfirm}
						disabled={!matches}
						style={{ opacity: matches ? 1 : 0.4 }}
					>
						確認刪除
					</button>
				</div>
			</div>
		</div>
	);
}

// ── Cycle Selector ────────────────────────────────────────────
interface CycleSelectorProps {
	cycles: AuditCycle[];
	activeCycle: AuditCycle;
	onSelect: (c: AuditCycle) => void;
	onNewCycle: () => void;
	onRename: (id: string, name: string) => void;
	onStatusChange: (id: string, status: string) => void;
	onDelete: (id: string) => void;
	isPrivileged: boolean; // admin or 51892
}

function CycleSelector({
	cycles,
	activeCycle,
	onSelect,
	onNewCycle,
	onRename,
	onStatusChange,
	onDelete,
	isPrivileged,
}: CycleSelectorProps) {
	const [historyOpen, setHistoryOpen] = useState(false);
	const [statusOpen, setStatusOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(activeCycle.name);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setEditName(activeCycle.name);
		setEditing(false);
	}, [activeCycle]);
	useEffect(() => {
		if (editing) inputRef.current?.focus();
	}, [editing]);

	const saveRename = () => {
		if (editName.trim() && editName.trim() !== activeCycle.name) {
			onRename(activeCycle.id, editName.trim());
		}
		setEditing(false);
	};

	const handleDelete = () => {
		setShowDeleteModal(false);
		onDelete(activeCycle.id);
	};

	return (
		<>
			<div className={styles.cycleBar}>
				{/* Left: name + status badge (clickable dropdown) + edition */}
				<div className={styles.cycleLeft}>
					{editing ? (
						<input
							ref={inputRef}
							className={styles.cycleNameInput}
							value={editName}
							onChange={(e) => setEditName(e.target.value)}
							onBlur={saveRename}
							onKeyDown={(e) => {
								if (e.key === "Enter") saveRename();
								if (e.key === "Escape") {
									setEditName(activeCycle.name);
									setEditing(false);
								}
							}}
						/>
					) : (
						<button
							className={styles.cycleNameBtn}
							onClick={() => setEditing(true)}
							title="點擊重命名"
						>
							{activeCycle.name}
							<span className={styles.editHint}>✎</span>
						</button>
					)}

					{/* Status — clickable badge dropdown */}
					<div className={styles.statusDropdownWrap}>
						<button
							className={`${styles.cycleStatusBadge} ${styles[`status_${activeCycle.status}`]}`}
							onClick={() => setStatusOpen((o) => !o)}
							title="點擊更改狀態"
						>
							{STATUS_LABELS[activeCycle.status]} ▾
						</button>
						{statusOpen && (
							<div className={styles.statusDropdown}>
								{(
									Object.entries(STATUS_LABELS) as [
										string,
										string,
									][]
								).map(([key, label]) => (
									<button
										key={key}
										className={`${styles.statusDropdownItem} ${activeCycle.status === key ? styles.statusDropdownItemActive : ""}`}
										onClick={() => {
											onStatusChange(activeCycle.id, key);
											setStatusOpen(false);
										}}
									>
										<span
											className={`${styles.statusDot} ${styles[`statusDot_${key}`]}`}
										/>
										{label}
									</button>
								))}
							</div>
						)}
					</div>

					<span className={styles.cycleEdition}>
						{activeCycle.ism_edition}
					</span>
				</div>

				{/* Right: actions */}
				<div className={styles.cycleRight}>
					<button className={styles.btnNewCycle} onClick={onNewCycle}>
						+ 新週期
					</button>

					{/* History dropdown — only if multiple cycles */}
					{cycles.length > 1 && (
						<div className={styles.cycleDropdownWrap}>
							<button
								className={styles.btnCycleSwitch}
								onClick={() => setHistoryOpen((o) => !o)}
							>
								歷史週期 ({cycles.length}) ▾
							</button>
							{historyOpen && (
								<div className={styles.cycleDropdown}>
									{cycles.map((c) => (
										<button
											key={c.id}
											className={`${styles.cycleDropdownItem} ${c.id === activeCycle.id ? styles.cycleDropdownItemActive : ""}`}
											onClick={() => {
												onSelect(c);
												setHistoryOpen(false);
											}}
										>
											<span className={styles.cdName}>
												{c.name}
											</span>
											<span
												className={`${styles.cdStatus} ${styles[`status_${c.status}`]}`}
											>
												{STATUS_LABELS[c.status]}
											</span>
										</button>
									))}
								</div>
							)}
						</div>
					)}

					{/* Delete — admin/51892 only */}
					{isPrivileged && (
						<button
							className={styles.btnDelete}
							onClick={() => setShowDeleteModal(true)}
							title="刪除此查核週期"
						>
							🗑
						</button>
					)}
				</div>
			</div>

			{showDeleteModal && (
				<DeleteCycleModal
					cycle={activeCycle}
					onClose={() => setShowDeleteModal(false)}
					onConfirm={handleDelete}
				/>
			)}
		</>
	);
}

// ── Main Dashboard ────────────────────────────────────────────
export default function IOSADashboard({
	onCycleChange,
}: {
	onCycleChange?: (cycle: AuditCycle | null) => void;
}) {
	const { token, user } = useAuth();
	const [allCycles, setAllCycles] = useState<AuditCycle[]>([]);
	const [activeCycle, setActiveCycle] = useState<AuditCycle | null>(null);
	const [data, setData] = useState<DashboardData>({
		cycle: null,
		disciplineStats: [],
		flaggedISARPs: [],
		linkedAlerts: [],
	});
	const [loading, setLoading] = useState(true);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [activeDiscipline, setActiveDiscipline] = useState("CAB");
	const [activeFlag, setActiveFlag] = useState<"prep" | "finding">("prep");

	// Only 51892 (owner) and admin master account can delete cycles
	const isPrivileged =
		user?.employee_id === "51892" || user?.employee_id === "admin";

	// Fetch all cycles + dashboard data for selected cycle
	const fetchCycles = useCallback(async () => {
		if (!token) return;
		try {
			const res = await fetch("/api/audit/iosa/cycles?all=true", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error("Failed");
			const { cycles } = await res.json();
			setAllCycles(cycles ?? []);
			if (cycles?.length && !activeCycle) {
				setActiveCycle(cycles[0]);
			}
		} catch {
			/* handled below */
		}
	}, [token, activeCycle]);

	const fetchDashboard = useCallback(
		async (cycleId: string) => {
			if (!token) return;
			setLoading(true);
			try {
				const res = await fetch(
					`/api/audit/iosa/dashboard?cycle_id=${cycleId}`,
					{
						headers: { Authorization: `Bearer ${token}` },
					},
				);
				if (!res.ok) throw new Error("Failed");
				const json = await res.json();
				setData(json);
				if (json.cycle?.disciplines?.length)
					setActiveDiscipline(json.cycle.disciplines[0]);
			} catch {
				/* no cycle */
			} finally {
				setLoading(false);
			}
		},
		[token],
	);

	useEffect(() => {
		fetchCycles();
	}, [token]);
	useEffect(() => {
		if (activeCycle) fetchDashboard(activeCycle.id);
		else setLoading(false);
		onCycleChange?.(activeCycle);
	}, [activeCycle]);

	const handleCycleCreated = (cycle: AuditCycle) => {
		setShowCreateModal(false);
		setAllCycles((prev) => [cycle, ...prev]);
		setActiveCycle(cycle);
	};

	const handleRename = async (id: string, name: string) => {
		if (!token) return;
		try {
			const res = await fetch(`/api/audit/iosa/cycles/${id}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ name }),
			});
			if (!res.ok) return;
			const { cycle } = await res.json();
			setAllCycles((prev) => prev.map((c) => (c.id === id ? cycle : c)));
			setActiveCycle(cycle);
		} catch {
			/* silent */
		}
	};

	const handleStatusChange = async (id: string, status: string) => {
		if (!token) return;
		try {
			const res = await fetch(`/api/audit/iosa/cycles/${id}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ status }),
			});
			if (!res.ok) return;
			const { cycle } = await res.json();
			setAllCycles((prev) => prev.map((c) => (c.id === id ? cycle : c)));
			setActiveCycle(cycle);
		} catch {
			/* silent */
		}
	};

	const handleDelete = async (id: string) => {
		if (!token) return;
		try {
			const res = await fetch(`/api/audit/iosa/cycles/${id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) return;
			const remaining = allCycles.filter((c) => c.id !== id);
			setAllCycles(remaining);
			setActiveCycle(remaining[0] ?? null);
		} catch {
			/* silent */
		}
	};

	// Discipline cards
	const disciplineCards = DISCIPLINE_ORDER.map((disc) => {
		const inScope = activeCycle?.disciplines?.includes(disc) ?? false;
		const stats = data.disciplineStats.find((s) => s.discipline === disc);
		const total = DISCIPLINE_TOTALS[disc];
		const completed = stats?.completed ?? 0;
		const findings = stats?.findings ?? 0;
		const observations = stats?.observations ?? 0;
		const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
		return { disc, inScope, total, completed, findings, observations, pct };
	});

	const activeStats = disciplineCards.find(
		(c) => c.disc === activeDiscipline,
	);
	const prepFlags = data.flaggedISARPs.filter((f) => f.flag_type === "prep");
	const auditFlags = data.flaggedISARPs.filter((f) => f.flag_type !== "prep");
	const visibleFlags = activeFlag === "prep" ? prepFlags : auditFlags;

	// ── No cycle ──
	if (!loading && allCycles.length === 0) {
		return (
			<div className={styles.noCycle}>
				<div className={styles.noCycleIcon}>📋</div>
				<h2 className={styles.noCycleTitle}>尚無查核週期</h2>
				<p className={styles.noCycleText}>
					建立新的 IOSA 查核週期以開始作業
				</p>
				<button
					className={styles.btnPrimary}
					onClick={() => setShowCreateModal(true)}
				>
					+ 建立查核週期
				</button>
				{showCreateModal && token && (
					<CreateCycleModal
						token={token}
						onClose={() => setShowCreateModal(false)}
						onCreated={handleCycleCreated}
					/>
				)}
			</div>
		);
	}

	if (loading) {
		return (
			<div className={styles.loadingCenter}>
				<div className={styles.spinner} />
			</div>
		);
	}

	return (
		<div className={styles.dashboard}>
			{/* ── Cycle bar ── */}
			{activeCycle && (
				<CycleSelector
					cycles={allCycles}
					activeCycle={activeCycle}
					onSelect={setActiveCycle}
					onNewCycle={() => setShowCreateModal(true)}
					onRename={handleRename}
					onStatusChange={handleStatusChange}
					onDelete={handleDelete}
					isPrivileged={isPrivileged}
				/>
			)}

			{/* ── Discipline cards ── */}
			<div className={styles.section}>
				<div className={styles.sectionLabel}>All disciplines</div>
				<div className={styles.discGrid}>
					{disciplineCards.map(
						({ disc, inScope, total, completed, pct }) => (
							<div
								key={disc}
								className={`${styles.discCard} ${inScope ? styles.discCardInScope : ""} ${activeDiscipline === disc ? styles.discCardActive : ""}`}
								onClick={() => setActiveDiscipline(disc)}
							>
								<div className={styles.discTop}>
									<span className={styles.discCode}>
										{disc}
									</span>
									<span
										className={`${styles.discScope} ${!inScope ? styles.discScopeOut : ""}`}
									>
										{inScope ? "In scope" : "Pending"}
									</span>
								</div>
								<div
									className={`${styles.discPct} ${!inScope ? styles.discPctDim : ""}`}
								>
									{inScope ? pct : 0}
									<span className={styles.discPctUnit}>
										%
									</span>
								</div>
								<div
									className={`${styles.discSub} ${!inScope ? styles.discSubDim : ""}`}
								>
									{inScope
										? `${completed} / ${total}`
										: `0 / ${total}`}{" "}
									ISARPs
								</div>
								<div className={styles.discBarTrack}>
									<div
										className={`${styles.discBarFill} ${!inScope ? styles.discBarInactive : ""}`}
										style={{
											width: `${inScope ? pct : 0}%`,
										}}
									/>
								</div>
							</div>
						),
					)}
				</div>
			</div>

			{/* ── Stats strip ── */}
			<div className={styles.section}>
				<div className={styles.sectionLabel}>
					{activeDiscipline} — ISARP statistics
				</div>
				<div className={styles.statsRow}>
					{[
						{
							label: "Total ISARPs",
							val: activeStats?.total ?? 0,
							cls: "",
						},
						{
							label: "Completed",
							val: activeStats?.completed ?? 0,
							cls: styles.green,
						},
						{
							label: "Remaining",
							val:
								(activeStats?.total ?? 0) -
								(activeStats?.completed ?? 0),
							cls: styles.accent,
						},
						{
							label: "Findings",
							val: activeStats?.findings ?? 0,
							cls: styles.red,
						},
						{
							label: "Observations",
							val: activeStats?.observations ?? 0,
							cls: styles.amber,
						},
					].map(({ label, val, cls }) => (
						<div key={label} className={styles.statBox}>
							<div className={`${styles.statVal} ${cls}`}>
								{val}
							</div>
							<div className={styles.statLbl}>{label}</div>
						</div>
					))}
				</div>
			</div>

			{/* ── Linked alert ── */}
			{data.linkedAlerts.length > 0 && (
				<div className={styles.linkedNotice}>
					🔗 <span>{data.linkedAlerts[0]}</span>
				</div>
			)}

			{/* ── Flagged ISARPs ── */}
			<div className={styles.section}>
				<div className={styles.sectionLabel}>Flagged ISARPs</div>
				<div className={styles.flaggedPanel}>
					<div className={styles.flagTabs}>
						<button
							className={`${styles.flagTab} ${activeFlag === "prep" ? styles.flagTabActive : ""}`}
							onClick={() => setActiveFlag("prep")}
						>
							Prep flags{" "}
							<span className={styles.flagCount}>
								{prepFlags.length}
							</span>
						</button>
						<button
							className={`${styles.flagTab} ${activeFlag === "finding" ? styles.flagTabActive : ""}`}
							onClick={() => setActiveFlag("finding")}
						>
							Audit flags{" "}
							<span
								className={`${styles.flagCount} ${styles.flagCountRed}`}
							>
								{auditFlags.length}
							</span>
						</button>
					</div>
					{visibleFlags.length === 0 ? (
						<div className={styles.noFlags}>
							{activeFlag === "prep"
								? "目前沒有 Prep 旗標"
								: "目前沒有 Audit 旗標"}
						</div>
					) : (
						visibleFlags.map((f, i) => (
							<div key={i} className={styles.flagItem}>
								<div className={styles.flagCode}>
									{f.isarp_code}
								</div>
								<div className={styles.flagReason}>
									{f.reason}
								</div>
								<div className={styles.flagDept}>
									{f.discipline}
								</div>
								<div
									className={`${styles.ftag} ${styles[`ftag_${f.flag_type}`]}`}
								>
									{f.flag_type === "prep"
										? "Prep"
										: f.flag_type === "finding"
											? "Finding"
											: "Obs"}
								</div>
							</div>
						))
					)}
				</div>
			</div>

			{showCreateModal && token && (
				<CreateCycleModal
					token={token}
					onClose={() => setShowCreateModal(false)}
					onCreated={handleCycleCreated}
				/>
			)}
		</div>
	);
}
