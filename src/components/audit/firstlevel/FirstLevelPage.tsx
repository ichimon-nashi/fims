// src/components/audit/firstlevel/FirstLevelPage.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import styles from "./firstlevel.module.css";
import ChecklistItemComponent from "./ChecklistItem";
import {
	CHECKLIST_ITEMS,
	SECTIONS,
	SECTIONS_DEPT,
	EMPTY_RESPONSE,
	ItemResponse,
	DeptSection,
} from "./checklistData";

type View = "landing" | "new" | "records" | "detail";

interface AuditRecord {
	id: string;
	year: number;
	half: 1 | 2;
	section: DeptSection;
	auditor_id: string;
	auditor_name: string;
	status: "draft" | "submitted";
	created_at: string;
	updated_at: string;
	submitted_at: string | null;
	period_start: string | null;
	period_end: string | null;
	responses?: Record<string, ItemResponse>;
	additional_remarks?: string;
	reviewer_name?: string;
	reviewer_date?: string;
}

const AUDIT_TABS = [
	{ id: "routine", label: "例行性", href: "/audit/routine" },
	{ id: "firstlevel", label: "一級查核", href: "/audit/firstlevel" },
	{ id: "iosa", label: "IOSA", href: "/audit/iosa" },
] as const;

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_HALF = new Date().getMonth() < 6 ? 1 : 2;

function buildEmptyResponses(): Record<string, ItemResponse> {
	const out: Record<string, ItemResponse> = {};
	for (const item of CHECKLIST_ITEMS) {
		out[item.code] = { ...EMPTY_RESPONSE };
	}
	return out;
}

export default function FirstLevelPage() {
	const { user, token } = useAuth();
	const router = useRouter();
	const [view, setView] = useState<View>("landing");

	// ── New audit form state ──
	const [year, setYear] = useState(CURRENT_YEAR);
	const [half, setHalf] = useState<1 | 2>(CURRENT_HALF);
	const [section, setSection] = useState<DeptSection>("管派組");
	const [periodStart, setPeriodStart] = useState("");
	const [periodEnd, setPeriodEnd] = useState("");
	const [auditorName, setAuditorName] = useState(user?.full_name || "");
	const [responses, setResponses] = useState<Record<string, ItemResponse>>(
		buildEmptyResponses(),
	);
	const [additionalRemarks, setAdditionalRemarks] = useState("");
	const [reviewerName, setReviewerName] = useState("");
	const [reviewerDate, setReviewerDate] = useState("");
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

	// ── Computed ──
	const answered = Object.values(responses).filter(
		(r) => r.result !== null,
	).length;
	const total = CHECKLIST_ITEMS.length;

	function sectionAnswered(sectionNum: number) {
		const items = CHECKLIST_ITEMS.filter((i) => i.section === sectionNum);
		return items.filter((i) => responses[i.code]?.result !== null).length;
	}

	// ── API helpers ──
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

	// ── Load records ──
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
			autoSaveTimer.current = setTimeout(() => autoSaveDraft(), 3000);
		}
	}

	async function autoSaveDraft() {
		if (!editingId) return;
		try {
			await apiFetch(`/api/audit/firstlevel/${editingId}`, "PATCH", {
				responses,
				additional_remarks: additionalRemarks,
				reviewer_name: reviewerName,
				reviewer_date: reviewerDate || null,
			});
			setSaveMsg("自動儲存 ✓");
			setTimeout(() => setSaveMsg(""), 2000);
		} catch {
			/* silent */
		}
	}

	// ── Save draft ──
	async function saveDraft() {
		setSaving(true);
		try {
			const payload = {
				year,
				half,
				section,
				period_start: periodStart || null,
				period_end: periodEnd || null,
				auditor_id: user?.employee_id || "",
				auditor_name: auditorName,
				status: "draft",
				responses,
				additional_remarks: additionalRemarks,
				reviewer_name: reviewerName,
				reviewer_date: reviewerDate || null,
			};
			if (editingId) {
				await apiFetch(
					`/api/audit/firstlevel/${editingId}`,
					"PATCH",
					payload,
				);
			} else {
				const data = await apiFetch(
					"/api/audit/firstlevel",
					"POST",
					payload,
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

	// ── Submit ──
	async function submitAudit() {
		if (!confirm("確認提交？提交後無法修改。")) return;
		setSaving(true);
		try {
			const payload = {
				year,
				half,
				section,
				period_start: periodStart || null,
				period_end: periodEnd || null,
				auditor_id: user?.employee_id || "",
				auditor_name: auditorName,
				status: "submitted",
				responses,
				additional_remarks: additionalRemarks,
				reviewer_name: reviewerName,
				reviewer_date: reviewerDate || null,
			};
			if (editingId) {
				await apiFetch(
					`/api/audit/firstlevel/${editingId}`,
					"PATCH",
					payload,
				);
			} else {
				await apiFetch("/api/audit/firstlevel", "POST", payload);
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
		setPeriodStart("");
		setPeriodEnd("");
		setAuditorName(user?.full_name || "");
		setResponses(buildEmptyResponses());
		setAdditionalRemarks("");
		setReviewerName("");
		setReviewerDate("");
		setCollapsedSections({});
		setSaveMsg("");
	}

	// ── Open existing record ──
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
			setPeriodStart(r.period_start || "");
			setPeriodEnd(r.period_end || "");
			setAuditorName(r.auditor_name);
			const merged = buildEmptyResponses();
			if (r.responses) Object.assign(merged, r.responses);
			setResponses(merged);
			setAdditionalRemarks(r.additional_remarks || "");
			setReviewerName(r.reviewer_name || "");
			setReviewerDate(r.reviewer_date || "");
			setView("new");
		} catch {
			alert("載入失敗");
		}
	}

	function toggleSection(num: number) {
		setCollapsedSections((prev) => ({ ...prev, [num]: !prev[num] }));
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

	// ─────────────────────────────────────────────────────────────────
	// RENDER
	// ─────────────────────────────────────────────────────────────────

	// Landing
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
							<div className={styles.landingCardIcon}>📋</div>
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
							<div className={styles.landingCardIcon}>🗂️</div>
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

	// Records list
	if (view === "records") {
		const years = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
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
								{years.map((y) => (
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
							<table className={styles.recordsTable}>
								<thead>
									<tr>
										<th>年度/半年</th>
										<th>組別</th>
										<th>查核員</th>
										<th>日期</th>
										<th>狀態</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									{records.map((rec) => (
										<tr key={rec.id}>
											<td>
												{rec.year}{" "}
												{rec.half === 1 ? "上" : "下"}
												半年
											</td>
											<td>{rec.section}</td>
											<td>{rec.auditor_name}</td>
											<td>
												{new Date(
													rec.created_at,
												).toLocaleDateString("zh-TW")}
											</td>
											<td>
												<span
													className={`${styles.statusBadge} ${rec.status === "submitted" ? styles.statusSubmitted : styles.statusDraft}`}
												>
													{rec.status === "submitted"
														? "已提交"
														: "草稿"}
												</span>
											</td>
											<td>
												<button
													className={
														styles.recordActionBtn
													}
													onClick={() =>
														openRecord(rec)
													}
												>
													{rec.status === "submitted"
														? "檢視"
														: "繼續編輯"}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>
			</div>
		);
	}

	// Detail / read-only
	if (view === "detail" && detailRecord) {
		const r = detailRecord;
		const resp = r.responses || {};
		return (
			<div className={styles.shell}>
				<TopBar>
					<span className={styles.readonlyBadge}>已提交 · 唯讀</span>
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
							{r.period_start && (
								<div className={styles.fieldGroup}>
									<span className={styles.fieldLabel}>
										查核期間
									</span>
									<div className={styles.readonlyVal}>
										{r.period_start} → {r.period_end}
									</div>
								</div>
							)}
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
						{r.additional_remarks && (
							<div className={styles.footerCard}>
								<div className={styles.fieldGroup}>
									<span className={styles.fieldLabel}>
										Additional Remarks
									</span>
									<div
										style={{
											color: "#e8e9ed",
											fontSize: "0.9375rem",
										}}
									>
										{r.additional_remarks}
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	// New / edit form
	return (
		<div className={styles.shell}>
			<TopBar>
				{saveMsg && <span className={styles.saving}>{saveMsg}</span>}
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
								{Array.from(
									{ length: 5 },
									(_, i) => CURRENT_YEAR - i,
								).map((y) => (
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
								查核員 Auditor
							</label>
							<input
								className={styles.fieldInput}
								value={auditorName}
								onChange={(e) => setAuditorName(e.target.value)}
								placeholder="姓名"
							/>
						</div>
						<div className={styles.fieldGroup}>
							<label className={styles.fieldLabel}>
								查核期間起 Period Start
							</label>
							<input
								className={styles.fieldInput}
								type="date"
								value={periodStart}
								onChange={(e) => setPeriodStart(e.target.value)}
							/>
						</div>
						<div className={styles.fieldGroup}>
							<label className={styles.fieldLabel}>
								查核期間訖 Period End
							</label>
							<input
								className={styles.fieldInput}
								type="date"
								value={periodEnd}
								onChange={(e) => setPeriodEnd(e.target.value)}
							/>
						</div>
					</div>

					{/* Checklist sections */}
					{SECTIONS.map((sec) => {
						const isCollapsed = collapsedSections[sec.num];
						const secAnswered = sectionAnswered(sec.num);
						const secTotal = CHECKLIST_ITEMS.filter(
							(i) => i.section === sec.num,
						).length;
						return (
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
									<span className={styles.sectionProgress}>
										{secAnswered}/{secTotal}
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

					{/* Footer */}
					<div className={styles.footerCard}>
						<div className={styles.textareaWrap}>
							<span className={styles.textareaLabel}>
								Additional Remarks
							</span>
							<textarea
								className={styles.textarea}
								rows={3}
								value={additionalRemarks}
								onChange={(e) =>
									setAdditionalRemarks(e.target.value)
								}
								placeholder="其他備註..."
							/>
						</div>
						<div className={styles.footerGrid}>
							<div className={styles.fieldGroup}>
								<label className={styles.fieldLabel}>
									複審 Reviewed By
								</label>
								<input
									className={styles.fieldInput}
									value={reviewerName}
									onChange={(e) =>
										setReviewerName(e.target.value)
									}
									placeholder="複審員姓名"
								/>
							</div>
							<div className={styles.fieldGroup}>
								<label className={styles.fieldLabel}>
									複審日期 Reviewed Date
								</label>
								<input
									className={styles.fieldInput}
									type="date"
									value={reviewerDate}
									onChange={(e) =>
										setReviewerDate(e.target.value)
									}
								/>
							</div>
						</div>
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
