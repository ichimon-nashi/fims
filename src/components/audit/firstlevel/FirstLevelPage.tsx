// src/components/audit/firstlevel/FirstLevelPage.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import styles from "./firstlevel.module.css";
import ChecklistItemComponent from "./ChecklistItem";
import {
	CHECKLIST_ITEMS,
	SECTIONS,
	SECTIONS_DEPT,
	RECOMMENDATION_SECTIONS,
	EMPTY_RESPONSE,
	ItemResponse,
	DeptSection,
	Recommendation,
} from "./checklistData";

type View = "landing" | "new" | "records" | "detail";

interface AuditorEntry {
	employee_id: string;
	full_name: string;
}

interface AuditRecord {
	id: string;
	year: number;
	half: 1 | 2;
	section: DeptSection;
	auditor_id: string;
	auditor_name: string;
	auditors: AuditorEntry[];
	audit_date: string | null;
	status: "draft" | "submitted";
	created_at: string;
	updated_at: string;
	submitted_at: string | null;
	responses?: Record<string, ItemResponse>;
	recommendations?: Recommendation[];
}

const AVATAR_BASE =
	"https://rhdpkxkmugimtlbdizfp.supabase.co/storage/v1/object/public/avatars";
const DEFAULT_AVATAR = `${AVATAR_BASE}/avatar-default.png`;

function avatarUrl(employeeId: string) {
	return employeeId ? `${AVATAR_BASE}/${employeeId}.png` : DEFAULT_AVATAR;
}

const AUDIT_TABS = [
	{ id: "routine", label: "例行性", href: "/audit/routine" },
	{ id: "firstlevel", label: "一級查核", href: "/audit/firstlevel" },
	{ id: "iosa", label: "IOSA", href: "/audit/iosa" },
] as const;

// Years: 2026 to current
const START_YEAR = 2026;
const CURRENT_YEAR = Math.max(new Date().getFullYear(), START_YEAR);
const CURRENT_HALF: 1 | 2 = new Date().getMonth() < 6 ? 1 : 2;
const YEARS = Array.from(
	{ length: CURRENT_YEAR - START_YEAR + 1 },
	(_, i) => START_YEAR + i,
);

interface UserOption {
	employee_id: string;
	full_name: string;
	rank: string;
}

function buildEmptyResponses(): Record<string, ItemResponse> {
	const out: Record<string, ItemResponse> = {};
	for (const item of CHECKLIST_ITEMS) out[item.code] = { ...EMPTY_RESPONSE };
	return out;
}

export default function FirstLevelPage() {
	const { user, token } = useAuth();
	const router = useRouter();
	const [view, setView] = useState<View>("landing");

	// ── Form state ──
	const [year, setYear] = useState(CURRENT_YEAR);
	const [half, setHalf] = useState<1 | 2>(CURRENT_HALF);
	const [section, setSection] = useState<DeptSection>("管派組");
	const [auditDate, setAuditDate] = useState("");
	const [auditors, setAuditors] = useState<AuditorEntry[]>([]);
	const [auditorQuery, setAuditorQuery] = useState("");
	const [showAuditorDrop, setShowAuditorDrop] = useState(false);
	const [responses, setResponses] = useState<Record<string, ItemResponse>>(
		buildEmptyResponses(),
	);
	const [recommendations, setRecommendations] = useState<Recommendation[]>(
		[],
	);
	const [recoSection, setRecoSection] = useState<string>("全科");
	const [recoText, setRecoText] = useState("");
	const [collapsedSections, setCollapsedSections] = useState<
		Record<number, boolean>
	>({});
	const [editingId, setEditingId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveMsg, setSaveMsg] = useState("");

	// ── Records state ──
	const [records, setRecords] = useState<AuditRecord[]>([]);
	const [loadingRecords, setLoadingRecords] = useState(false);
	const [filterYear, setFilterYear] = useState("");
	const [filterHalf, setFilterHalf] = useState("");
	const [filterSection, setFilterSection] = useState("");
	const [detailRecord, setDetailRecord] = useState<AuditRecord | null>(null);

	const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const auditorWrapRef = useRef<HTMLDivElement>(null);
	const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [userOptions, setUserOptions] = useState<UserOption[]>([]);

	// Fetch auditor options — default (FI/SC/MG/OTHER) on mount, search on query change
	async function fetchUsers(q: string) {
		try {
			const params = q ? `?q=${encodeURIComponent(q)}` : "";
			const res = await fetch(`/api/audit/firstlevel/users${params}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			setUserOptions(data.users || []);
		} catch {
			/* silent */
		}
	}

	useEffect(() => {
		fetchUsers("");
	}, [token]); // eslint-disable-line react-hooks/exhaustive-deps

	// Close auditor dropdown on outside click
	useEffect(() => {
		function handleClick(e: MouseEvent) {
			if (
				auditorWrapRef.current &&
				!auditorWrapRef.current.contains(e.target as Node)
			) {
				setShowAuditorDrop(false);
			}
		}
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	// ── Computed ──
	const answered = Object.values(responses).filter(
		(r) => r.result !== null,
	).length;
	const total = CHECKLIST_ITEMS.length;
	const flaggedCount = Object.values(responses).filter(
		(r) => r.flagged,
	).length;
	const auditorName = auditors.map((a) => a.full_name).join("、");

	function sectionAnswered(n: number) {
		return CHECKLIST_ITEMS.filter(
			(i) => i.section === n && responses[i.code]?.result !== null,
		).length;
	}
	function sectionTotal(n: number) {
		return CHECKLIST_ITEMS.filter((i) => i.section === n).length;
	}

	// ── API ──
	async function apiFetch(path: string, method = "GET", body?: unknown) {
		const res = await fetch(path, {
			method,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		if (!res.ok) throw new Error(await res.text());
		return res.json();
	}

	const loadRecords = useCallback(async () => {
		setLoadingRecords(true);
		try {
			const params = new URLSearchParams();
			if (filterYear) params.set("year", filterYear);
			if (filterHalf) params.set("half", filterHalf);
			if (filterSection) params.set("section", filterSection);
			const data = await apiFetch(`/api/audit/firstlevel?${params}`);
			setRecords(data.records || []);
		} catch {
			/* silent */
		}
		setLoadingRecords(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filterYear, filterHalf, filterSection, token]);

	useEffect(() => {
		if (view === "records") loadRecords();
	}, [view, loadRecords]);

	// ── Response change + auto-save ──
	function handleResponseChange(code: string, updated: ItemResponse) {
		setResponses((prev) => ({ ...prev, [code]: updated }));
		if (editingId) {
			if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
			autoSaveTimer.current = setTimeout(autoSaveDraft, 3000);
		}
	}

	async function autoSaveDraft() {
		if (!editingId) return;
		try {
			await apiFetch(`/api/audit/firstlevel/${editingId}`, "PATCH", {
				responses,
				recommendations,
			});
			setSaveMsg("自動儲存 ✓");
			setTimeout(() => setSaveMsg(""), 2000);
		} catch {
			/* silent */
		}
	}

	// ── Payload builder ──
	function buildPayload(status: "draft" | "submitted") {
		return {
			year,
			half,
			section,
			audit_date: auditDate || null,
			auditors,
			status,
			responses,
			recommendations,
		};
	}

	async function saveDraft() {
		setSaving(true);
		try {
			if (editingId) {
				await apiFetch(
					`/api/audit/firstlevel/${editingId}`,
					"PATCH",
					buildPayload("draft"),
				);
			} else {
				const data = await apiFetch(
					"/api/audit/firstlevel",
					"POST",
					buildPayload("draft"),
				);
				setEditingId(data.record.id);
			}
			setSaveMsg("草稿已儲存 ✓");
			setTimeout(() => setSaveMsg(""), 2500);
		} catch {
			setSaveMsg("儲存失敗");
		}
		setSaving(false);
	}

	async function submitAudit() {
		if (!confirm("確認提交？提交後無法修改。")) return;
		setSaving(true);
		try {
			if (editingId) {
				await apiFetch(
					`/api/audit/firstlevel/${editingId}`,
					"PATCH",
					buildPayload("submitted"),
				);
			} else {
				await apiFetch(
					"/api/audit/firstlevel",
					"POST",
					buildPayload("submitted"),
				);
			}
			alert("查核表已提交！");
			resetForm();
			setView("records");
		} catch {
			alert("提交失敗，請再試。");
		}
		setSaving(false);
	}

	function resetForm() {
		setEditingId(null);
		setYear(CURRENT_YEAR);
		setHalf(CURRENT_HALF);
		setSection("管派組");
		setAuditDate("");
		setAuditors([]);
		setAuditorQuery("");
		setResponses(buildEmptyResponses());
		setRecommendations([]);
		setRecoSection("全科");
		setRecoText("");
		setCollapsedSections({});
		setSaveMsg("");
	}

	async function openRecord(record: AuditRecord) {
		try {
			const data = await apiFetch(`/api/audit/firstlevel/${record.id}`);
			const r = data.record as AuditRecord;
			if (r.status === "submitted") {
				setDetailRecord(r);
				setView("detail");
				return;
			}
			setEditingId(r.id);
			setYear(r.year);
			setHalf(r.half);
			setSection(r.section);
			setAuditDate(r.audit_date || "");
			setAuditors(r.auditors || []);
			setAuditorQuery("");
			const merged = buildEmptyResponses();
			if (r.responses) Object.assign(merged, r.responses);
			setResponses(merged);
			setRecommendations(r.recommendations || []);
			setView("new");
		} catch {
			alert("載入失敗");
		}
	}

	const [autoPrint, setAutoPrint] = useState(false);

	useEffect(() => {
		if (autoPrint && view === "detail") {
			const t = setTimeout(() => {
				window.print();
				setAutoPrint(false);
			}, 400);
			return () => clearTimeout(t);
		}
	}, [autoPrint, view]);

	async function exportRecord(record: AuditRecord) {
		try {
			const data = await apiFetch(`/api/audit/firstlevel/${record.id}`);
			setDetailRecord(data.record);
			setView("detail");
			setAutoPrint(true);
		} catch {
			alert("載入失敗");
		}
	}

	function addRecommendation() {
		if (!recoText.trim()) return;
		setRecommendations((prev) => [
			...prev,
			{
				id: `reco-${Date.now()}`,
				section: recoSection,
				text: recoText.trim(),
			},
		]);
		setRecoText("");
	}

	function removeRecommendation(id: string) {
		setRecommendations((prev) => prev.filter((r) => r.id !== id));
	}

	function toggleSection(num: number) {
		setCollapsedSections((prev) => ({ ...prev, [num]: !prev[num] }));
	}

	async function deleteRecord(id: string) {
		if (!confirm("確認刪除此草稿？此操作無法復原。")) return;
		try {
			await apiFetch(`/api/audit/firstlevel/${id}`, "DELETE");
			loadRecords();
		} catch {
			alert("刪除失敗");
		}
	}

	// ── Shared top tab bar ──
	const TopBar = ({ children }: { children?: React.ReactNode }) => (
		<div className={styles.topbar}>
			<div className={styles.auditTabs}>
				{AUDIT_TABS.map((t) => (
					<button
						key={t.id}
						className={`${styles.auditTab} ${t.id === "firstlevel" ? styles.auditTabActive : ""}`}
						onClick={() => {
							if (t.id !== "firstlevel") router.push(t.href);
						}}
					>
						{t.label}
					</button>
				))}
			</div>
			{children && <div className={styles.topbarRight}>{children}</div>}
		</div>
	);

	// ─── LANDING ───────────────────────────────────────────────────
	if (view === "landing") {
		return (
			<div className={styles.shell}>
				<TopBar />
				<div className={styles.landingWrap}>
					<div className={styles.landingHeader}>
						<h1 className={styles.landingTitle}>
							一級自我督察查核
						</h1>
						<p className={styles.landingSubtitle}>
							1st Level Self Audit Checklist · FMEF-06-19
						</p>
					</div>
					<div className={styles.landingCards}>
						<div
							className={styles.landingCard}
							onClick={() => {
								resetForm();
								setView("new");
							}}
						>
							<Image
								src="/images/newaudit.png"
								alt="新增查核"
								width={80}
								height={80}
								style={{ objectFit: "contain" }}
							/>
							<h2 className={styles.landingCardTitle}>
								新增查核
							</h2>
							<p className={styles.landingCardDesc}>
								開始新的一級自我督察查核表
							</p>
						</div>
						<div
							className={styles.landingCard}
							onClick={() => setView("records")}
						>
							<Image
								src="/images/auditrecord.png"
								alt="查核紀錄"
								width={80}
								height={80}
								style={{ objectFit: "contain" }}
							/>
							<h2 className={styles.landingCardTitle}>
								查核紀錄
							</h2>
							<p className={styles.landingCardDesc}>
								檢視過去查核紀錄及草稿
							</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	// ─── RECORDS ───────────────────────────────────────────────────
	if (view === "records") {
		return (
			<div className={styles.shell}>
				<TopBar>
					<button
						className={styles.backBtn}
						onClick={() => setView("landing")}
					>
						← 返回
					</button>
				</TopBar>
				<div className={styles.recordsScroll}>
					<div className={styles.recordsInner}>
						<div className={styles.recordsFilters}>
							<select
								className={styles.filterSelect}
								value={filterYear}
								onChange={(e) => setFilterYear(e.target.value)}
							>
								<option value="">所有年度</option>
								{YEARS.map((y) => (
									<option key={y} value={y}>
										{y}
									</option>
								))}
							</select>
							<select
								className={styles.filterSelect}
								value={filterHalf}
								onChange={(e) => setFilterHalf(e.target.value)}
							>
								<option value="">上/下半年</option>
								<option value="1">上半年</option>
								<option value="2">下半年</option>
							</select>
							<select
								className={styles.filterSelect}
								value={filterSection}
								onChange={(e) =>
									setFilterSection(e.target.value)
								}
							>
								<option value="">所有組別</option>
								{SECTIONS_DEPT.map((s) => (
									<option key={s} value={s}>
										{s}
									</option>
								))}
							</select>
						</div>
						{loadingRecords ? (
							<div className={styles.emptyState}>載入中...</div>
						) : records.length === 0 ? (
							<div className={styles.emptyState}>
								尚無查核紀錄
							</div>
						) : (
							<div className={styles.recordCards}>
								{records.map((rec) => (
									<div
										key={rec.id}
										className={styles.recordCard}
									>
										<div className={styles.recordCardTop}>
											<span
												className={`${styles.statusBadge} ${rec.status === "submitted" ? styles.statusSubmitted : styles.statusDraft}`}
											>
												{rec.status === "submitted"
													? "已提交"
													: "草稿"}
											</span>
											<span
												className={
													styles.recordCardSection
												}
											>
												{rec.section}
											</span>
										</div>
										<div className={styles.recordCardTitle}>
											{rec.year}{" "}
											{rec.half === 1
												? "上半年"
												: "下半年"}
										</div>
										<div className={styles.recordCardMeta}>
											<span>
												查核員：{rec.auditor_name}
											</span>
											{rec.audit_date && (
												<span>
													日期：
													{new Date(
														rec.audit_date +
															"T00:00:00",
													).toLocaleDateString(
														"zh-TW",
													)}
												</span>
											)}
											<span>
												建立：
												{new Date(
													rec.created_at,
												).toLocaleDateString("zh-TW")}
											</span>
										</div>
										<div
											className={styles.recordCardActions}
										>
											<button
												className={
													styles.recordActionBtn
												}
												onClick={() => openRecord(rec)}
											>
												{rec.status === "submitted"
													? "🔍 檢視"
													: "✏️ 編輯"}
											</button>
											{rec.status === "submitted" && (
												<button
													className={
														styles.recordExportBtn
													}
													onClick={() =>
														exportRecord(rec)
													}
												>
													📄 匯出PDF
												</button>
											)}
											{rec.status === "draft" && (
												<button
													className={
														styles.recordDeleteBtn
													}
													onClick={() =>
														deleteRecord(rec.id)
													}
												>
													🗑️ 刪除
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	// ─── DETAIL (read-only) ────────────────────────────────────────
	if (view === "detail" && detailRecord) {
		const r = detailRecord;
		const resp = r.responses || {};
		return (
			<div className={styles.shell}>
				<TopBar>
					<span className={styles.readonlyBadge}>已提交 · 唯讀</span>
					<button
						className={styles.exportBtn}
						onClick={() => window.print()}
					>
						📄 匯出PDF
					</button>
					<button
						className={styles.backBtn}
						onClick={() => {
							setDetailRecord(null);
							setView("records");
						}}
					>
						← 返回
					</button>
				</TopBar>
				<div className={styles.formScroll}>
					<div className={styles.formInner}>
						<div className={styles.headerCard}>
							<div className={styles.fieldGroup}>
								<span className={styles.fieldLabel}>年度</span>
								<div className={styles.readonlyVal}>
									{r.year}{" "}
									{r.half === 1 ? "上半年" : "下半年"}
								</div>
							</div>
							<div className={styles.fieldGroup}>
								<span className={styles.fieldLabel}>組別</span>
								<div className={styles.readonlyVal}>
									{r.section}
								</div>
							</div>
							<div className={styles.fieldGroup}>
								<span className={styles.fieldLabel}>
									查核員
								</span>
								<div className={styles.readonlyVal}>
									{r.auditor_name}
								</div>
							</div>
							<div className={styles.fieldGroup}>
								<span className={styles.fieldLabel}>
									查核日期
								</span>
								<div className={styles.readonlyVal}>
									{r.audit_date || "—"}
								</div>
							</div>
						</div>
						{SECTIONS.map((sec) => (
							<div key={sec.num} className={styles.sectionBlock}>
								<div
									className={styles.sectionHeader}
									onClick={() => toggleSection(sec.num)}
								>
									<span className={styles.sectionNum}>
										{sec.num}
									</span>
									<span className={styles.sectionTitle}>
										{sec.zh}
									</span>
									<span
										className={`${styles.sectionChevron} ${collapsedSections[sec.num] ? "" : styles.sectionChevronOpen}`}
									>
										▼
									</span>
								</div>
								{!collapsedSections[sec.num] && (
									<div className={styles.sectionItems}>
										{CHECKLIST_ITEMS.filter(
											(i) => i.section === sec.num,
										).map((item) => (
											<ChecklistItemComponent
												key={item.code}
												item={item}
												response={
													resp[item.code] || {
														...EMPTY_RESPONSE,
													}
												}
												onChange={() => {}}
												readonly
											/>
										))}
									</div>
								)}
							</div>
						))}
						{r.recommendations && r.recommendations.length > 0 && (
							<div className={styles.recoBlock}>
								<p className={styles.recoTitle}>
									建議事項 Recommendations
								</p>
								<div className={styles.recoList}>
									{r.recommendations.map((rec) => (
										<div
											key={rec.id}
											className={styles.recoItem}
										>
											<span
												className={
													styles.recoItemSection
												}
											>
												{rec.section}
											</span>
											<span
												className={styles.recoItemText}
											>
												{rec.text}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	// ─── NEW / EDIT FORM ───────────────────────────────────────────
	return (
		<div className={styles.shell}>
			<TopBar>
				{saveMsg && <span className={styles.saving}>{saveMsg}</span>}
				{flaggedCount > 0 && (
					<span style={{ fontSize: "0.8125rem", color: "#f59e0b" }}>
						🚩 {flaggedCount} 項標記
					</span>
				)}
				<button
					className={styles.backBtn}
					onClick={() => {
						resetForm();
						setView("landing");
					}}
				>
					← 返回
				</button>
			</TopBar>

			{/* Progress bar */}
			<div className={styles.progressBar}>
				<div className={styles.progressTrack}>
					<div
						className={styles.progressFill}
						style={{ width: `${(answered / total) * 100}%` }}
					/>
				</div>
				<span className={styles.progressLabel}>
					{answered}/{total} 項目已填寫
				</span>
			</div>

			<div className={styles.formScroll}>
				<div className={styles.formInner}>
					{/* Header card */}
					<div className={styles.headerCard}>
						<div className={styles.fieldGroup}>
							<label className={styles.fieldLabel}>
								年度 Year
							</label>
							<select
								className={styles.fieldSelect}
								value={year}
								onChange={(e) =>
									setYear(Number(e.target.value))
								}
							>
								{YEARS.map((y) => (
									<option key={y} value={y}>
										{y}
									</option>
								))}
							</select>
						</div>
						<div className={styles.fieldGroup}>
							<label className={styles.fieldLabel}>
								半年 Half Year
							</label>
							<select
								className={styles.fieldSelect}
								value={half}
								onChange={(e) =>
									setHalf(Number(e.target.value) as 1 | 2)
								}
							>
								<option value={1}>上半年 1st Half</option>
								<option value={2}>下半年 2nd Half</option>
							</select>
						</div>
						<div className={styles.fieldGroup}>
							<label className={styles.fieldLabel}>
								查核組別 Section
							</label>
							<select
								className={styles.fieldSelect}
								value={section}
								onChange={(e) =>
									setSection(e.target.value as DeptSection)
								}
							>
								{SECTIONS_DEPT.map((s) => (
									<option key={s} value={s}>
										{s}
									</option>
								))}
							</select>
						</div>
						<div className={styles.fieldGroup}>
							<label className={styles.fieldLabel}>
								查核日期 Audit Date
							</label>
							<input
								className={styles.fieldInput}
								type="date"
								value={auditDate}
								onChange={(e) => setAuditDate(e.target.value)}
							/>
						</div>
						<div
							className={styles.fieldGroup}
							style={{ gridColumn: "1 / -1" }}
						>
							<label className={styles.fieldLabel}>
								查核員 Auditor
							</label>
							{/* Selected auditors chips */}
							{auditors.length > 0 && (
								<div className={styles.auditorChips}>
									{auditors.map((a) => (
										<div
											key={a.employee_id}
											className={styles.auditorChip}
										>
											<Image
												src={avatarUrl(a.employee_id)}
												alt={a.full_name}
												width={24}
												height={24}
												className={
													styles.auditorChipAvatar
												}
												onError={(e) => {
													(
														e.currentTarget as HTMLImageElement
													).src = DEFAULT_AVATAR;
												}}
											/>
											<span
												className={
													styles.auditorChipName
												}
											>
												{a.full_name}
											</span>
											<button
												className={
													styles.auditorChipClear
												}
												onClick={() =>
													setAuditors((prev) =>
														prev.filter(
															(x) =>
																x.employee_id !==
																a.employee_id,
														),
													)
												}
												title="移除"
											>
												✕
											</button>
										</div>
									))}
								</div>
							)}
							{/* Search input */}
							<div
								className={styles.auditorWrap}
								ref={auditorWrapRef}
							>
								<input
									className={styles.fieldInput}
									value={auditorQuery}
									onChange={(e) => {
										const q = e.target.value;
										setAuditorQuery(q);
										setShowAuditorDrop(true);
										if (searchTimer.current)
											clearTimeout(searchTimer.current);
										searchTimer.current = setTimeout(
											() => fetchUsers(q),
											250,
										);
									}}
									onFocus={() => {
										fetchUsers(auditorQuery);
										setShowAuditorDrop(true);
									}}
									placeholder={
										auditors.length === 0
											? "輸入姓名或工號搜尋"
											: "新增查核員..."
									}
								/>
								{showAuditorDrop && userOptions.length > 0 && (
									<div className={styles.auditorDropdown}>
										{userOptions
											.filter(
												(u) =>
													!auditors.some(
														(a) =>
															a.employee_id ===
															u.employee_id,
													),
											)
											.map((u) => (
												<div
													key={u.employee_id}
													className={
														styles.auditorOption
													}
													onMouseDown={() => {
														setAuditors((prev) => [
															...prev,
															{
																employee_id:
																	u.employee_id,
																full_name:
																	u.full_name,
															},
														]);
														setAuditorQuery("");
														setShowAuditorDrop(
															false,
														);
													}}
												>
													<Image
														src={avatarUrl(
															u.employee_id,
														)}
														alt={u.full_name}
														width={32}
														height={32}
														className={
															styles.auditorOptionAvatar
														}
														onError={(e) => {
															(
																e.currentTarget as HTMLImageElement
															).src =
																DEFAULT_AVATAR;
														}}
													/>
													<div
														className={
															styles.auditorOptionInfo
														}
													>
														<span
															className={
																styles.auditorOptionName
															}
														>
															{u.full_name}
														</span>
														<span
															className={
																styles.auditorOptionMeta
															}
														>
															{u.employee_id} ·{" "}
															{
																u.rank.split(
																	" - ",
																)[0]
															}
														</span>
													</div>
												</div>
											))}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Checklist sections */}
					{SECTIONS.map((sec) => {
						const isCollapsed = collapsedSections[sec.num];
						const secAns = sectionAnswered(sec.num);
						const secTot = sectionTotal(sec.num);
						const secComplete = secAns === secTot;
						return (
							<div key={sec.num} className={styles.sectionBlock}>
								<div
									className={styles.sectionHeader}
									onClick={() => toggleSection(sec.num)}
								>
									<span
										className={styles.sectionNum}
										style={
											secComplete
												? {
														background:
															"rgba(34,197,94,0.2)",
														color: "#22c55e",
													}
												: {}
										}
									>
										{secComplete ? "✓" : sec.num}
									</span>
									<span className={styles.sectionTitle}>
										{sec.zh}
									</span>
									<span
										className={styles.sectionProgress}
										style={
											secComplete
												? { color: "#22c55e" }
												: {}
										}
									>
										{secAns}/{secTot}
									</span>
									<span
										className={`${styles.sectionChevron} ${isCollapsed ? "" : styles.sectionChevronOpen}`}
									>
										▼
									</span>
								</div>
								{!isCollapsed && (
									<div className={styles.sectionItems}>
										{CHECKLIST_ITEMS.filter(
											(i) => i.section === sec.num,
										).map((item) => (
											<ChecklistItemComponent
												key={item.code}
												item={item}
												response={
													responses[item.code] || {
														...EMPTY_RESPONSE,
													}
												}
												onChange={handleResponseChange}
											/>
										))}
									</div>
								)}
							</div>
						);
					})}

					{/* Recommendations block */}
					<div className={styles.recoBlock}>
						<p className={styles.recoTitle}>
							建議事項 Recommendations
						</p>
						{recommendations.length > 0 && (
							<div className={styles.recoList}>
								{recommendations.map((rec) => (
									<div
										key={rec.id}
										className={styles.recoItem}
									>
										<span
											className={styles.recoItemSection}
										>
											{rec.section}
										</span>
										<span className={styles.recoItemText}>
											{rec.text}
										</span>
										<button
											className={styles.recoDeleteBtn}
											onClick={() =>
												removeRecommendation(rec.id)
											}
										>
											✕
										</button>
									</div>
								))}
							</div>
						)}
						<div className={styles.recoAddRow}>
							<select
								className={styles.recoSectionSelect}
								value={recoSection}
								onChange={(e) => setRecoSection(e.target.value)}
							>
								{RECOMMENDATION_SECTIONS.map((s) => (
									<option key={s} value={s}>
										{s}
									</option>
								))}
							</select>
							<textarea
								className={styles.recoTextInput}
								rows={2}
								placeholder="輸入建議事項..."
								value={recoText}
								onChange={(e) => setRecoText(e.target.value)}
							/>
							<button
								className={styles.recoAddBtn}
								onClick={addRecommendation}
								disabled={!recoText.trim()}
							>
								新增
							</button>
						</div>
					</div>

					{/* Footer actions */}
					<div className={styles.footerCard}>
						<div className={styles.footerActions}>
							<button
								className={styles.btnDraft}
								onClick={saveDraft}
								disabled={saving}
							>
								{saving ? "儲存中..." : "儲存草稿"}
							</button>
							<button
								className={styles.btnSubmit}
								onClick={submitAudit}
								disabled={saving || answered === 0}
							>
								提交查核表
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
