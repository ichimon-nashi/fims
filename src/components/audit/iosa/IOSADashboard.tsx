// src/components/audit/iosa/IOSADashboard.tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Image from "next/image";
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
	prep_ready: number; // ISARPs marked ready in AuditPrep
	audit_completed: number; // ISARPs with conformance status recorded
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

// Fallback totals used only before ISM import
// Real totals come from audit_iosa_isarps seeded per cycle
const DISCIPLINE_TOTALS_FALLBACK: Record<string, number> = {
	CAB: 107,
	FLT: 267,
	DSP: 115,
	MNT: 103,
	GRH: 115,
	ORG: 77,
	CGO: 71,
	SEC: 53,
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

// Fixed IATA/ISM discipline names — static reference nomenclature, not
// per-cycle data, safe to hardcode same as DISCIPLINE_ORDER/FALLBACK above.
const DISCIPLINE_NAMES: Record<string, string> = {
	CAB: "Cabin Operations",
	FLT: "Flight Operations",
	DSP: "Flight Dispatch",
	MNT: "Maintenance",
	GRH: "Ground Handling",
	ORG: "Organization & Management",
	CGO: "Cargo",
	SEC: "Security",
};

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
	const [disciplines, setDisciplines] = useState<string[]>(DISCIPLINE_ORDER); // all selected by default
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

const STATUS_STYLE: Record<
	string,
	{ bg: string; fg: string; border: string; dot: string }
> = {
	prep: {
		bg: "rgba(239,178,92,.12)",
		fg: "#EFB25C",
		border: "rgba(239,178,92,.3)",
		dot: "#EFB25C",
	},
	active: {
		bg: "rgba(52,217,192,.12)",
		fg: "#34D9C0",
		border: "rgba(52,217,192,.3)",
		dot: "#34D9C0",
	},
	completed: {
		bg: "rgba(91,140,255,.12)",
		fg: "#7FA8FF",
		border: "rgba(91,140,255,.3)",
		dot: "#7FA8FF",
	},
};

// ── Cycle Selector ────────────────────────────────────────────
interface CycleSelectorProps {
	cycles: AuditCycle[];
	activeCycle: AuditCycle;
	onSelect: (c: AuditCycle) => void;
	onNewCycle: () => void;
	onRename: (id: string, name: string) => void;
	onStatusChange: (id: string, status: string) => void;
	onDelete: (id: string) => void;
	onDisciplineUpdate: (id: string, disciplines: string[]) => void;
	isPrivileged: boolean;
}

function CycleSelector({
	cycles,
	activeCycle,
	onSelect,
	onNewCycle,
	onRename,
	onStatusChange,
	onDelete,
	onDisciplineUpdate,
	isPrivileged,
}: CycleSelectorProps) {
	const [historyOpen, setHistoryOpen] = useState(false);
	const [statusOpen, setStatusOpen] = useState(false);
	const [editing, setEditing] = useState(false);
	const [editName, setEditName] = useState(activeCycle.name);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [showDiscEdit, setShowDiscEdit] = useState(false);
	const [editDiscs, setEditDiscs] = useState<string[]>(
		activeCycle.disciplines ?? [],
	);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setEditName(activeCycle.name);
		setEditing(false);
		setEditDiscs(activeCycle.disciplines ?? []);
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

	const toggleEditDisc = (d: string) =>
		setEditDiscs((prev) =>
			prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
		);

	const saveDiscs = () => {
		onDisciplineUpdate(activeCycle.id, editDiscs);
		setShowDiscEdit(false);
	};

	const st = STATUS_STYLE[activeCycle.status];

	return (
		<>
			<div
				style={{
					display: "flex",
					alignItems: "flex-end",
					justifyContent: "space-between",
					gap: 20,
					flexWrap: "wrap",
					marginBottom: 20,
				}}
			>
				{/* Left: name + status badge (clickable dropdown) + edition */}
				<div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
						{editing ? (
							<input
								ref={inputRef}
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
								style={{
									padding: "6px 11px",
									borderRadius: 9,
									border: "1px solid #3D6EF0",
									background: "#0C111A",
									color: "#E9EDF5",
									fontSize: 22,
									fontWeight: 600,
									letterSpacing: "-.02em",
									outline: "none",
									width: 230,
								}}
							/>
						) : (
							<button
								onClick={() => setEditing(true)}
								title="點擊重命名"
								style={{
									display: "flex",
									alignItems: "center",
									gap: 8,
									border: "none",
									background: "transparent",
									cursor: "pointer",
									padding: 0,
								}}
							>
								<h1 style={{ margin: 0, fontSize: 27, fontWeight: 600, letterSpacing: "-.025em", color: "#E9EDF5" }}>
									{activeCycle.name}
								</h1>
								<span style={{ fontSize: 12, color: "#7FA8FF" }}>✎</span>
							</button>
						)}

						{/* Status — clickable badge dropdown */}
						<div style={{ position: "relative" }}>
							<button
								onClick={() => setStatusOpen((o) => !o)}
								title="點擊更改狀態"
								style={{
									fontSize: 11.5,
									fontWeight: 600,
									padding: "5px 11px",
									borderRadius: 99,
									cursor: "pointer",
									background: st.bg,
									color: st.fg,
									border: `1px solid ${st.border}`,
								}}
							>
								{STATUS_LABELS[activeCycle.status]} ▾
							</button>
							{statusOpen && (
								<div
									style={{
										position: "absolute",
										top: 32,
										left: 0,
										zIndex: 40,
										minWidth: 158,
										padding: 5,
										borderRadius: 11,
										background: "#0E131D",
										border: "1px solid #232D3F",
										boxShadow: "0 22px 44px -18px rgba(0,0,0,.9)",
										display: "flex",
										flexDirection: "column",
										gap: 2,
									}}
								>
									{(Object.entries(STATUS_LABELS) as [string, string][]).map(([key, label]) => (
										<button
											key={key}
											onClick={() => {
												onStatusChange(activeCycle.id, key);
												setStatusOpen(false);
											}}
											style={{
												display: "flex",
												alignItems: "center",
												gap: 9,
												padding: "8px 10px",
												border: "none",
												borderRadius: 8,
												textAlign: "left",
												fontSize: 12.5,
												cursor: "pointer",
												background: activeCycle.status === key ? "#141B29" : "transparent",
												color: activeCycle.status === key ? "#E9EDF5" : "#8E9AAD",
											}}
										>
											<span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_STYLE[key].dot }} />
											{label}
										</button>
									))}
								</div>
							)}
						</div>

						<span
							style={{
								fontSize: 11.5,
								color: "#8E9AAD",
								padding: "4px 9px",
								borderRadius: 6,
								background: "#0F1421",
								border: "1px solid #1A2130",
							}}
						>
							{activeCycle.ism_edition}
						</span>
					</div>
				</div>

				{/* Right: actions */}
				<div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
					{/* Edit disciplines */}
					<div style={{ position: "relative" }}>
						<button
							onClick={() => setShowDiscEdit((o) => !o)}
							title="Edit in-scope disciplines"
							style={{
								padding: "9px 14px",
								borderRadius: 9,
								border: "1px solid #212B3C",
								background: "#0E131D",
								color: "#C3CCDB",
								fontSize: 12.5,
								fontWeight: 500,
								cursor: "pointer",
							}}
						>
							✎ Scope
						</button>
						{showDiscEdit && (
							<div
								style={{
									position: "absolute",
									top: 44,
									right: 0,
									zIndex: 40,
									width: 260,
									padding: 14,
									borderRadius: 13,
									background: "#0E131D",
									border: "1px solid #232D3F",
									boxShadow: "0 26px 52px -20px rgba(0,0,0,.92)",
									display: "flex",
									flexDirection: "column",
									gap: 11,
								}}
							>
								<div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".18em", color: "#8791A3" }}>
									IN-SCOPE DISCIPLINES
								</div>
								<div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
									{DISCIPLINE_ORDER.map((d) => {
										const on = editDiscs.includes(d);
										return (
											<button
												key={d}
												type="button"
												onClick={() => toggleEditDisc(d)}
												style={{
													padding: "7px 0",
													borderRadius: 8,
													fontSize: 11,
													fontWeight: 600,
													cursor: "pointer",
													border: `1px solid ${on ? "rgba(122,164,255,.45)" : "#1C2432"}`,
													background: on ? "rgba(91,140,255,.16)" : "#0C111A",
													color: on ? "#7FA8FF" : "#8791A3",
												}}
											>
												{d}
											</button>
										);
									})}
								</div>
								<div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
									<button
										onClick={() => setShowDiscEdit(false)}
										style={{
											padding: "6px 12px",
											borderRadius: 7,
											border: "1px solid #212B3C",
											background: "transparent",
											color: "#8E9AAD",
											fontSize: 12,
											cursor: "pointer",
										}}
									>
										Cancel
									</button>
									<button
										onClick={saveDiscs}
										style={{
											padding: "6px 14px",
											borderRadius: 7,
											border: "1px solid rgba(122,164,255,.4)",
											background: "#2C55CC",
											color: "#fff",
											fontSize: 12,
											fontWeight: 600,
											cursor: "pointer",
										}}
									>
										Save
									</button>
								</div>
							</div>
						)}
					</div>

					<button
						onClick={onNewCycle}
						style={{
							padding: "9px 14px",
							borderRadius: 9,
							border: "1px solid #2A3348",
							background: "#131A28",
							color: "#E9EDF5",
							fontSize: 12.5,
							fontWeight: 600,
							cursor: "pointer",
						}}
					>
						+ 新週期
					</button>

					{/* History dropdown */}
					{cycles.length > 1 && (
						<div style={{ position: "relative" }}>
							<button
								onClick={() => setHistoryOpen((o) => !o)}
								style={{
									padding: "9px 14px",
									borderRadius: 9,
									border: "1px solid #212B3C",
									background: "#0E131D",
									color: "#C3CCDB",
									fontSize: 12.5,
									fontWeight: 500,
									cursor: "pointer",
								}}
							>
								歷史週期 ({cycles.length}) ▾
							</button>
							{historyOpen && (
								<div
									style={{
										position: "absolute",
										top: 44,
										right: 0,
										zIndex: 40,
										minWidth: 236,
										padding: 5,
										borderRadius: 12,
										background: "#0E131D",
										border: "1px solid #232D3F",
										boxShadow: "0 26px 52px -20px rgba(0,0,0,.92)",
										display: "flex",
										flexDirection: "column",
										gap: 2,
										maxHeight: 320,
										overflow: "auto",
									}}
								>
									{cycles.map((c) => (
										<button
											key={c.id}
											onClick={() => {
												onSelect(c);
												setHistoryOpen(false);
											}}
											style={{
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
												gap: 12,
												padding: "9px 11px",
												border: "none",
												borderRadius: 8,
												fontSize: 12.5,
												cursor: "pointer",
												textAlign: "left",
												background: c.id === activeCycle.id ? "#141B29" : "transparent",
												color: "#C3CCDB",
											}}
										>
											<span>{c.name}</span>
											<span
												style={{
													fontSize: 10.5,
													fontWeight: 600,
													padding: "2px 7px",
													borderRadius: 99,
													background: STATUS_STYLE[c.status].bg,
													color: STATUS_STYLE[c.status].fg,
												}}
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
							onClick={() => setShowDeleteModal(true)}
							title="刪除此查核週期"
							style={{
								width: 36,
								height: 36,
								borderRadius: 9,
								border: "1px solid #2E1F24",
								background: "#160F12",
								color: "#F0655C",
								fontSize: 13,
								cursor: "pointer",
							}}
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
	onImport,
}: {
	onCycleChange?: (cycle: AuditCycle | null) => void;
	onImport?: () => void;
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
	const [cyclesChecked, setCyclesChecked] = useState(false);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [activeDiscipline, setActiveDiscipline] = useState("CAB");
	const [activeFlag, setActiveFlag] = useState<"prep" | "finding">("prep");
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState("");

	const handleExportCR = async () => {
		if (!token || !activeCycle) return;
		setExporting(true);
		setExportError("");
		try {
			const params = new URLSearchParams({
				cycle_id: activeCycle.id,
				ism_edition: activeCycle.ism_edition,
			});
			const res = await fetch(`/api/audit/iosa/export-cr?${params}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || "Export failed");
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `Conformance Report - ${activeCycle.name}.xlsx`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (e: any) {
			setExportError(e.message);
		} finally {
			setExporting(false);
		}
	};

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
		} finally {
			setCyclesChecked(true);
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
		else if (cyclesChecked) setLoading(false);
		onCycleChange?.(activeCycle);
	}, [activeCycle, cyclesChecked]);

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

	const handleDisciplineUpdate = async (
		id: string,
		disciplines: string[],
	) => {
		if (!token) return;
		try {
			const res = await fetch(`/api/audit/iosa/cycles/${id}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ disciplines }),
			});
			if (!res.ok) return;
			const { cycle } = await res.json();
			setAllCycles((prev) => prev.map((c) => (c.id === id ? cycle : c)));
			setActiveCycle(cycle);
		} catch {
			/* silent */
		}
	};

	// Discipline cards — use prep_ready for progress bar (AuditPrep phase)
	// use audit_completed for findings/obs (live Audit phase)
	const isAuditPhase =
		activeCycle?.status === "active" || activeCycle?.status === "completed";

	const disciplineCards = DISCIPLINE_ORDER.map((disc) => {
		const inScope = activeCycle?.disciplines?.includes(disc) ?? false;
		const stats = data.disciplineStats.find((s) => s.discipline === disc);
		const total = stats?.total ?? DISCIPLINE_TOTALS_FALLBACK[disc] ?? 0;
		// Show prep_ready during prep, audit_completed during/after audit
		const completed = isAuditPhase
			? (stats?.audit_completed ?? 0)
			: (stats?.prep_ready ?? 0);
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

	// ── Cycle-wide aggregates, in-scope disciplines only ──
	// Everything here is summed from disciplineCards / data above — no new
	// fetches, no invented numbers. "readiness" is prep_ready/total during
	// prep, audit_completed/total during/after audit — same basis the
	// per-discipline cards already use, just rolled up.
	const inScopeCards = disciplineCards.filter((c) => c.inScope);
	const totalIsarps = inScopeCards.reduce((a, c) => a + c.total, 0);
	const totalCompleted = inScopeCards.reduce((a, c) => a + c.completed, 0);
	const totalFindings = inScopeCards.reduce((a, c) => a + c.findings, 0);
	const totalObservations = inScopeCards.reduce((a, c) => a + c.observations, 0);
	// "Conformity" = completed minus findings/observations. Note this also
	// folds in any N/A-status records, since the backend's audit_completed
	// doesn't separate N/A from true conformity — an approximation, not exact.
	const totalConformity = Math.max(0, totalCompleted - totalFindings - totalObservations);
	const readinessPct = totalIsarps > 0 ? Math.round((totalCompleted / totalIsarps) * 100) : 0;
	const outstandingCount = totalIsarps - totalCompleted;

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
				<div className={styles.loadingStack}>
					<Image
						src="/K-dogmatic.png"
						alt="Loading"
						width={300}
						height={240}
						className={styles.loadingImage}
						priority
					/>
					<div className={styles.spinner} />
				</div>
			</div>
		);
	}

	const barBg = (pct: number) => {
		if (pct >= 100) return "#45D483";
		if (pct >= 70) return "linear-gradient(90deg,#3D6EF0,#7FD8FF)";
		if (pct >= 30) return "#EFB25C";
		return "#3D4658";
	};

	return (
		<div
			style={{
				padding: "22px 26px 40px",
				display: "flex",
				flexDirection: "column",
				gap: 20,
				color: "#e8e9ed",
			}}
		>
			{/* ── Action buttons ── */}
			<div style={{ display: "flex", gap: 9, justifyContent: "flex-end", flexWrap: "wrap" }}>
				<button
					onClick={handleExportCR}
					disabled={!activeCycle || exporting}
					style={{
						padding: "9px 17px",
						borderRadius: 9,
						border: "1px solid rgba(122,164,255,.4)",
						background: "linear-gradient(180deg,#3D6EF0,#2C55CC)",
						color: "#fff",
						fontSize: 12.5,
						fontWeight: 600,
						cursor: !activeCycle || exporting ? "default" : "pointer",
						opacity: !activeCycle || exporting ? 0.5 : 1,
						boxShadow: "0 8px 22px -10px rgba(61,110,240,.9)",
					}}
				>
					{exporting ? "Exporting…" : "↓ Export CR"}
				</button>
				<button
					onClick={onImport}
					style={{
						padding: "9px 14px",
						borderRadius: 9,
						border: "1px solid #212B3C",
						background: "#0E131D",
						color: "#C3CCDB",
						fontSize: 12.5,
						fontWeight: 500,
						cursor: "pointer",
					}}
				>
					↑ Import ISARPs
				</button>
			</div>
			{exportError && (
				<div
					style={{
						padding: "10px 14px",
						borderRadius: 9,
						background: "rgba(240,101,92,.1)",
						border: "1px solid rgba(240,101,92,.3)",
						color: "#F0655C",
						fontSize: 12.5,
					}}
				>
					{exportError}
				</div>
			)}

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
					onDisciplineUpdate={handleDisciplineUpdate}
					isPrivileged={isPrivileged}
				/>
			)}

			{/* ── Readiness + live stream ──
			    Readiness ring uses the same completed/total basis as the
			    discipline cards below, just summed across in-scope disciplines —
			    real numbers, not a separate metric. The live-stream panel has no
			    backing data source (no activity-log table exists), so it shows
			    an honest empty state instead of invented entries. */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
				<div
					style={{
						position: "relative",
						overflow: "hidden",
						padding: 24,
						borderRadius: 16,
						background: "radial-gradient(120% 130% at 0% 0%,#16203A 0%,#0C1119 55%)",
						border: "1px solid #1D2637",
						display: "flex",
						alignItems: "center",
						gap: 26,
						flexWrap: "wrap",
						minWidth: 0,
					}}
				>
					<div
						style={{
							position: "relative",
							width: 158,
							height: 158,
							flexShrink: 0,
							borderRadius: "50%",
							background: `conic-gradient(from 180deg, #5B8CFF 0%, #7FD8FF ${readinessPct}%, #141B29 ${readinessPct}%)`,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							boxShadow: "0 0 44px -12px rgba(91,140,255,.55)",
						}}
					>
						<div
							style={{
								width: 126,
								height: 126,
								borderRadius: "50%",
								background: "#0B1018",
								border: "1px solid #1B2434",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								justifyContent: "center",
								gap: 2,
							}}
						>
							<span
								style={{
									fontSize: 38,
									fontWeight: 600,
									letterSpacing: "-.04em",
									fontVariantNumeric: "tabular-nums",
									lineHeight: 1,
								}}
							>
								{readinessPct}
								<span style={{ fontSize: 16, color: "#7E8899" }}>%</span>
							</span>
							<span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".16em", color: "#8791A3" }}>
								{isAuditPhase ? "AUDITED" : "READY"}
							</span>
						</div>
					</div>
					<div style={{ flex: 1, minWidth: 196, display: "flex", flexDirection: "column", gap: 14 }}>
						<div>
							<div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-.01em", marginBottom: 4 }}>
								{isAuditPhase ? "Audit progress" : "Audit readiness"}
							</div>
							<div style={{ fontSize: 12.5, lineHeight: 1.55, color: "#7E8899" }}>
								{isAuditPhase
									? "Conformance status recorded across all in-scope disciplines."
									: "Documentation references and auditor-action evidence recorded across all in-scope disciplines."}
							</div>
						</div>
						<div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
							{[
								[String(totalCompleted), isAuditPhase ? "AUDITED" : "PREP READY", "#E9EDF5"],
								[String(outstandingCount), "OUTSTANDING", "#EFB25C"],
								[String(prepFlags.length), "FLAGGED", "#F0655C"],
							].map(([n, label, c]) => (
								<div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
									<span style={{ fontSize: 19, fontWeight: 600, color: c }}>
										{n}
									</span>
									<span style={{ fontSize: 10.5, color: "#8791A3", letterSpacing: ".05em" }}>{label}</span>
								</div>
							))}
						</div>
					</div>
				</div>

				<div
					style={{
						display: "flex",
						flexDirection: "column",
						borderRadius: 16,
						background: "#0B0F17",
						border: "1px solid #1A2130",
						overflow: "hidden",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "13px 16px",
							borderBottom: "1px solid #151C28",
						}}
					>
						<span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D9C0" }} />
						<span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".04em" }}>Live conformance stream</span>
					</div>
					<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
						<div style={{ fontSize: 12, color: "#8791A3", textAlign: "center" }}>
							No activity log yet.
							<br />
							<span style={{ fontSize: 11 }}>This needs a real activity/audit-log table to show anything true.</span>
						</div>
					</div>
				</div>
			</div>

			{/* ── Discipline cards ── */}
			<div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".2em", color: "#8791A3" }}>
						ALL DISCIPLINES
					</span>
					<span style={{ flex: 1, height: 1, background: "#151C28" }} />
				</div>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(196px,1fr))", gap: 11 }}>
					{disciplineCards.map(({ disc, inScope, total, completed, pct }) => {
						const shownPct = inScope ? pct : 0;
						const full = inScope && pct === 100;
						const active = activeDiscipline === disc;
						return (
							<div
								key={disc}
								onClick={() => setActiveDiscipline(disc)}
								style={{
									position: "relative",
									overflow: "hidden",
									padding: 15,
									borderRadius: 13,
									background: "#0B0F17",
									border: `1px solid ${active ? "#3D6EF0" : "#1A2130"}`,
									opacity: inScope ? 1 : 0.5,
									cursor: "pointer",
									display: "flex",
									flexDirection: "column",
									gap: 11,
								}}
							>
								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
									<span
										style={{
											fontSize: 15,
											fontWeight: 600,
											letterSpacing: ".04em",
											color: full ? "#45D483" : "#E9EDF5",
										}}
									>
										{disc}
									</span>
									<span
										style={{
											fontSize: 9.5,
											fontWeight: 600,
											letterSpacing: ".1em",
											padding: "3px 7px",
											borderRadius: 99,
											background: !inScope
												? "rgba(255,255,255,.05)"
												: full
													? "rgba(69,212,131,.1)"
													: "rgba(91,140,255,.1)",
											color: !inScope ? "#8791A3" : full ? "#45D483" : "#7FA8FF",
										}}
									>
										{inScope ? "In scope" : "Pending"}
									</span>
								</div>
								<div style={{ fontSize: 11, color: "#8791A3", letterSpacing: ".02em" }}>
									{DISCIPLINE_NAMES[disc] ?? disc}
								</div>
								<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
									<span
										style={{
											fontSize: 24,
											fontWeight: 600,
											letterSpacing: "-.03em",
											fontVariantNumeric: "tabular-nums",
											color: !inScope ? "#8791A3" : full ? "#45D483" : "#E9EDF5",
										}}
									>
										{shownPct}
										<span style={{ fontSize: 12, color: "#8791A3" }}>%</span>
									</span>
									<span style={{ fontSize: 11, color: "#8791A3" }}>
										{inScope ? `${completed} / ${total}` : `0 / ${total}`} ISARPs
									</span>
								</div>
								<div style={{ height: 4, borderRadius: 99, background: "#141B29", overflow: "hidden" }}>
									<div
										style={{
											height: "100%",
											borderRadius: 99,
											background: inScope ? barBg(shownPct) : "#3D4658",
											width: `${shownPct}%`,
											transition: "width .5s",
										}}
									/>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* ── Cycle-wide totals ── */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 11 }}>
				{[
					{ label: "Total ISARPs", val: totalIsarps, color: "#E9EDF5" },
					{ label: "Conformity", val: totalConformity, color: "#45D483" },
					{ label: "Findings", val: totalFindings, color: "#F0655C" },
					{ label: "Observations", val: totalObservations, color: "#EFB25C" },
				].map(({ label, val, color }) => (
					<div
						key={label}
						style={{
							padding: 15,
							borderRadius: 13,
							background: "#0B0F17",
							border: "1px solid #1A2130",
							display: "flex",
							flexDirection: "column",
							gap: 6,
						}}
					>
						<span style={{ fontSize: 23, fontWeight: 600, color }}>
							{val}
						</span>
						<span style={{ fontSize: 10.5, letterSpacing: ".08em", color: "#8791A3" }}>{label}</span>
					</div>
				))}
			</div>

			{/* ── Stats strip ── */}
			<div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".2em", color: "#8791A3" }}>
						{activeDiscipline} — ISARP STATISTICS
					</span>
					<span style={{ flex: 1, height: 1, background: "#151C28" }} />
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
						gap: 11,
					}}
				>
					{[
						{ label: "Total ISARPs", val: activeStats?.total ?? 0, color: "#E9EDF5" },
						{
							label: isAuditPhase ? "Audited" : "Prep Ready",
							val: activeStats?.completed ?? 0,
							color: "#45D483",
						},
						{
							label: "Remaining",
							val: (activeStats?.total ?? 0) - (activeStats?.completed ?? 0),
							color: "#7FA8FF",
						},
						{ label: "Findings", val: activeStats?.findings ?? 0, color: "#F0655C" },
						{ label: "Observations", val: activeStats?.observations ?? 0, color: "#EFB25C" },
					].map(({ label, val, color }) => (
						<div
							key={label}
							style={{
								padding: 15,
								borderRadius: 13,
								background: "#0B0F17",
								border: "1px solid #1A2130",
								display: "flex",
								flexDirection: "column",
								gap: 6,
							}}
						>
							<span style={{ fontSize: 23, fontWeight: 600, color }}>
								{val}
							</span>
							<span style={{ fontSize: 10.5, letterSpacing: ".08em", color: "#8791A3" }}>{label}</span>
						</div>
					))}
				</div>
			</div>

			{/* ── Linked alert ── */}
			{data.linkedAlerts.length > 0 && (
				<div
					style={{
						padding: "10px 14px",
						borderRadius: 9,
						background: "rgba(91,140,255,.1)",
						border: "1px solid rgba(91,140,255,.25)",
						color: "#7FA8FF",
						fontSize: 12.5,
					}}
				>
					🔗 <span>{data.linkedAlerts[0]}</span>
				</div>
			)}

			{/* ── Flagged ISARPs ── */}
			<div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".2em", color: "#8791A3" }}>
						FLAGGED ISARPS
					</span>
					<span style={{ flex: 1, height: 1, background: "#151C28" }} />
				</div>
				<div style={{ borderRadius: 14, background: "#0B0F17", border: "1px solid #1A2130", overflow: "hidden" }}>
					<div
						style={{
							display: "flex",
							gap: 2,
							padding: 3,
							margin: 12,
							background: "#0E1420",
							border: "1px solid #1A2130",
							borderRadius: 8,
							width: "fit-content",
						}}
					>
						<button
							onClick={() => setActiveFlag("prep")}
							style={{
								padding: "6px 12px",
								border: "none",
								borderRadius: 5,
								background: activeFlag === "prep" ? "#1B2434" : "transparent",
								color: activeFlag === "prep" ? "#E9EDF5" : "#7E8899",
								fontSize: 11.5,
								fontWeight: activeFlag === "prep" ? 600 : 500,
								cursor: "pointer",
							}}
						>
							Prep flags{" "}
							<span
								style={{
									fontSize: 10.5,
									color: "#8791A3",
									marginLeft: 4,
								}}
							>
								{prepFlags.length}
							</span>
						</button>
						<button
							onClick={() => setActiveFlag("finding")}
							style={{
								padding: "6px 12px",
								border: "none",
								borderRadius: 5,
								background: activeFlag === "finding" ? "#1B2434" : "transparent",
								color: activeFlag === "finding" ? "#E9EDF5" : "#7E8899",
								fontSize: 11.5,
								fontWeight: activeFlag === "finding" ? 600 : 500,
								cursor: "pointer",
							}}
						>
							Audit flags{" "}
							<span
								style={{
									fontSize: 10.5,
									color: "#F0655C",
									marginLeft: 4,
								}}
							>
								{auditFlags.length}
							</span>
						</button>
					</div>
					{visibleFlags.length === 0 ? (
						<div style={{ padding: "20px 16px", fontSize: 12, color: "#8791A3", textAlign: "center" }}>
							{activeFlag === "prep" ? "目前沒有 Prep 旗標" : "目前沒有 Audit 旗標"}
						</div>
					) : (
						visibleFlags.map((f, i) => (
							<div
								key={i}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 12,
									padding: "11px 16px",
									borderTop: "1px solid #10161F",
								}}
							>
								<span
									style={{
										fontSize: 12,
										fontWeight: 500,
										color: "#7FA8FF",
										width: 76,
										flexShrink: 0,
									}}
								>
									{f.isarp_code}
								</span>
								<span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#8E9AAD" }}>{f.reason}</span>
								<span style={{ fontSize: 11, color: "#8791A3", flexShrink: 0 }}>{f.discipline}</span>
								<span
									style={{
										fontSize: 10,
										fontWeight: 600,
										letterSpacing: ".08em",
										padding: "3px 8px",
										borderRadius: 99,
										flexShrink: 0,
										background:
											f.flag_type === "prep"
												? "rgba(239,178,92,.1)"
												: f.flag_type === "finding"
													? "rgba(240,101,92,.1)"
													: "rgba(239,178,92,.1)",
										color:
											f.flag_type === "prep"
												? "#EFB25C"
												: f.flag_type === "finding"
													? "#F0655C"
													: "#EFB25C",
									}}
								>
									{f.flag_type === "prep" ? "Prep" : f.flag_type === "finding" ? "Finding" : "Obs"}
								</span>
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