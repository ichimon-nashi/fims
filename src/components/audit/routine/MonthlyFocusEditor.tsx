// src/components/audit/routine/MonthlyFocusEditor.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./MonthlyFocusEditor.module.css";
import { useAuth } from "@/context/AuthContext";

interface FocusItem {
	item_no: number;
	item_text: string;
	required_attachment_template_id?: string | null;
}

interface AttachmentTemplateOption {
	id: string;
	code: string;
	name: string;
}

// ── NEW ──
interface FocusListItem {
	item_no: number;
	item_text: string;
	required_attachment_template_id: string | null;
}
interface FocusSetSummary {
	id: string;
	report_year: number;
	report_month: number;
	items: FocusListItem[];
}

export default function MonthlyFocusEditor({ onClose }: { onClose: () => void }) {
	const { token } = useAuth();
	const now = new Date();

	// ── NEW: browse-list-first flow. "list" shows every existing month's
	// focus set grouped by year — the primary view now, replacing
	// dropdown-driven single-month lookup as the default. "edit" is the
	// original per-month editor below, unchanged in its own logic, just
	// reached by clicking a listed month or creating a new one instead of
	// always being the first thing shown.
	const [mode, setMode] = useState<"list" | "edit">("list");
	const [focusList, setFocusList] = useState<FocusSetSummary[]>([]);
	const [listLoading, setListLoading] = useState(true);
	// ── NEW: selection for the copy-to-another-month mechanism — key ->
	// item is the single source of truth, so toggling is trivial and can
	// never fall out of sync (an earlier draft of this tried to keep two
	// separate states in lockstep and it was a mess — this is simpler)
	const [selectedMap, setSelectedMap] = useState<Map<string, FocusListItem>>(new Map());
	const [copyTargetYear, setCopyTargetYear] = useState(now.getFullYear());
	const [copyTargetMonth, setCopyTargetMonth] = useState(now.getMonth() + 1);
	const [copying, setCopying] = useState(false);
	// set right before entering edit mode via the copy action — tells the
	// edit-mode fetch effect to skip its normal fetch just this once,
	// since `items` has already been pre-populated with the copied items
	// appended to the target month's existing ones
	const skipNextEditFetchRef = useRef(false);
	const [newYear, setNewYear] = useState(now.getFullYear());
	const [newMonth, setNewMonth] = useState(now.getMonth() + 1);

	const [year, setYear] = useState(now.getFullYear());
	const [month, setMonth] = useState(now.getMonth() + 1);
	const [items, setItems] = useState<FocusItem[]>([]);
	const [attachmentTemplates, setAttachmentTemplates] = useState<AttachmentTemplateOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// ── NEW: fetch the full list (no year/month params — the additive
	// list-mode branch on the GET route)
	function loadList() {
		if (!token) return;
		setListLoading(true);
		fetch("/api/audit/routine/monthly-focus", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((data) => setFocusList(data.sets ?? []))
			.finally(() => setListLoading(false));
	}

	useEffect(() => {
		if (mode === "list") loadList();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode, token]);

	useEffect(() => {
		if (!token) return;
		fetch("/api/audit/routine/checklist-template?type=attachment", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((data) => setAttachmentTemplates((data.templates ?? []).map((t: any) => t.template)));
	}, [token]);

	// unchanged single-month fetch — now gated on mode === "edit" instead
	// of running unconditionally, since "list" mode doesn't need it
	useEffect(() => {
		if (mode !== "edit" || !token) return;
		if (skipNextEditFetchRef.current) {
			skipNextEditFetchRef.current = false;
			setLoading(false);
			return;
		}
		setLoading(true);
		setSaved(false);
		fetch(`/api/audit/routine/monthly-focus?year=${year}&month=${month}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((r) => r.json())
			.then((data) => {
				setItems(
					(data.items ?? []).map((i: any) => ({
						item_no: i.item_no,
						item_text: i.item_text,
						required_attachment_template_id: i.required_attachment_template_id,
					})),
				);
			})
			.finally(() => setLoading(false));
	}, [token, year, month, mode]);

	// ── NEW: single Map is the source of truth for selection — key ->
	// item, so add/remove/lookup are all trivial and never fall out of sync
	function toggleSelect(key: string, item: FocusListItem) {
		setSelectedMap((prev) => {
			const next = new Map(prev);
			if (next.has(key)) next.delete(key);
			else next.set(key, item);
			return next;
		});
	}

	function openMonth(y: number, m: number) {
		setYear(y);
		setMonth(m);
		setMode("edit");
	}

	// ── NEW: fetches the target month's existing items, appends the
	// selected items on top, then enters edit mode with that combined
	// list pre-populated — user reviews/adjusts before hitting 儲存,
	// rather than this silently overwriting the target month in the
	// background with no chance to check the result first
	async function copySelectedTo(y: number, m: number) {
		if (!token || selectedMap.size === 0) return;
		setCopying(true);
		try {
			const res = await fetch(`/api/audit/routine/monthly-focus?year=${y}&month=${m}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			const existing: FocusListItem[] = (data.items ?? []).map((i: any) => ({
				item_no: i.item_no,
				item_text: i.item_text,
				required_attachment_template_id: i.required_attachment_template_id,
			}));
			const combined = [...existing, ...Array.from(selectedMap.values())].map((it, idx) => ({
				...it,
				item_no: idx + 1,
			}));
			setItems(combined);
			setYear(y);
			setMonth(m);
			skipNextEditFetchRef.current = true;
			setMode("edit");
			setSelectedMap(new Map());
		} finally {
			setCopying(false);
		}
	}

	function addItem() {
		setItems((prev) => [...prev, { item_no: prev.length + 1, item_text: "" }]);
	}

	function updateItem(index: number, patch: Partial<FocusItem>) {
		setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
	}

	function removeItem(index: number) {
		setItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, item_no: i + 1 })));
	}

	function moveItem(index: number, dir: -1 | 1) {
		setItems((prev) => {
			const next = prev.slice();
			const target = index + dir;
			if (target < 0 || target >= next.length) return prev;
			[next[index], next[target]] = [next[target], next[index]];
			return next.map((it, i) => ({ ...it, item_no: i + 1 }));
		});
	}

	async function handleSave() {
		if (!token) return;
		if (items.some((i) => !i.item_text.trim())) {
			setError("項目內容不可為空");
			return;
		}
		setError(null);
		setSaving(true);
		try {
			const res = await fetch("/api/audit/routine/monthly-focus", {
				method: "PUT",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
				body: JSON.stringify({ report_year: year, report_month: month, items }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? "儲存失敗");
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} catch (e: any) {
			setError(e.message ?? "儲存失敗");
		} finally {
			setSaving(false);
		}
	}

	// ── NEW: group by year for display — list is already sorted
	// year-desc, month-desc by the API, so groups come out most-recent-first
	const groupedByYear = new Map<number, FocusSetSummary[]>();
	for (const s of focusList) {
		if (!groupedByYear.has(s.report_year)) groupedByYear.set(s.report_year, []);
		groupedByYear.get(s.report_year)!.push(s);
	}

	return (
		<div className={styles.panel}>
			<div className={styles.header}>
				{mode === "edit" && (
					<button className={styles.backBtn} onClick={() => setMode("list")}>
						← 返回列表
					</button>
				)}
				<span className={styles.title}>
					{mode === "list" ? "本月加強重點檢查" : `編輯 ${year}年${month}月 加強重點檢查`}
				</span>
				<button className={styles.closeBtn} onClick={onClose}>
					✕
				</button>
			</div>

			<div className={styles.body}>
				{mode === "list" ? (
					<>
						<div className={styles.newMonthRow}>
							<select value={newYear} onChange={(e) => setNewYear(Number(e.target.value))}>
								{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
									<option key={y} value={y}>
										{y}年
									</option>
								))}
							</select>
							<select value={newMonth} onChange={(e) => setNewMonth(Number(e.target.value))}>
								{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
									<option key={m} value={m}>
										{m}月
									</option>
								))}
							</select>
							<button className={styles.addBtn} onClick={() => openMonth(newYear, newMonth)}>
								+ 新增此月份
							</button>
						</div>

						{listLoading ? (
							<p className={styles.status}>載入中...</p>
						) : focusList.length === 0 ? (
							<p className={styles.status}>尚未設定任何月份的加強重點檢查</p>
						) : (
							<>
								{selectedMap.size > 0 && (
									<div className={styles.copyBar}>
										<span className={styles.copyBarLabel}>已選 {selectedMap.size} 項 → 加入至</span>
										<select value={copyTargetYear} onChange={(e) => setCopyTargetYear(Number(e.target.value))}>
											{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
												<option key={y} value={y}>{y}年</option>
											))}
										</select>
										<select value={copyTargetMonth} onChange={(e) => setCopyTargetMonth(Number(e.target.value))}>
											{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
												<option key={m} value={m}>{m}月</option>
											))}
										</select>
										<button
											className={styles.addBtn}
											disabled={copying}
											onClick={() => copySelectedTo(copyTargetYear, copyTargetMonth)}
										>
											{copying ? "處理中..." : "加入並編輯"}
										</button>
									</div>
								)}

								{Array.from(groupedByYear.entries()).map(([y, months]) => (
									<div key={y} className={styles.yearGroup}>
										<p className={styles.yearGroupLabel}>{y}年</p>
										{months.map((s) => (
											<div key={s.id} className={styles.monthBlock}>
												<button className={styles.monthBlockHeader} onClick={() => openMonth(s.report_year, s.report_month)}>
													<span className={styles.monthBlockTitle}>{s.report_month}月</span>
													<span className={styles.monthBlockCount}>{s.items.length} 項 · 點擊編輯</span>
												</button>
												{s.items.length > 0 && (
													<div className={styles.monthItemList}>
														{s.items.map((item) => {
															const key = `${s.id}-${item.item_no}`;
															return (
																<label key={key} className={styles.monthItemRow}>
																	<input
																		type="checkbox"
																		checked={selectedMap.has(key)}
																		onChange={() => toggleSelect(key, item)}
																	/>
																	<span>{item.item_text}</span>
																</label>
															);
														})}
													</div>
												)}
											</div>
										))}
									</div>
								))}
							</>
						)}
					</>
				) : loading ? (
					<p className={styles.status}>載入中...</p>
				) : (
					<div className={styles.itemList}>
						{items.map((item, i) => (
							<div key={i} className={styles.itemRow}>
								<div className={styles.itemMoveCol}>
									<button className={styles.moveBtn} disabled={i === 0} onClick={() => moveItem(i, -1)}>
										▲
									</button>
									<span className={styles.itemNo}>{item.item_no}</span>
									<button className={styles.moveBtn} disabled={i === items.length - 1} onClick={() => moveItem(i, 1)}>
										▼
									</button>
								</div>
								<div className={styles.itemFields}>
									<textarea
										className={styles.itemTextInput}
										value={item.item_text}
										onChange={(e) => updateItem(i, { item_text: e.target.value })}
										rows={2}
										placeholder="本月加強重點檢查項目內容"
									/>
									<select
										className={styles.attachmentSelect}
										value={item.required_attachment_template_id ?? ""}
										onChange={(e) => updateItem(i, { required_attachment_template_id: e.target.value || null })}
									>
										<option value="">不連結附加查核</option>
										{attachmentTemplates.map((t) => (
											<option key={t.id} value={t.id}>
												連結：{t.name}
											</option>
										))}
									</select>
								</div>
								<button className={styles.removeBtn} onClick={() => removeItem(i)}>
									✕
								</button>
							</div>
						))}
						<button className={styles.addBtn} onClick={addItem}>
							+ 新增項目
						</button>
					</div>
				)}
			</div>

			{error && <p className={styles.error}>{error}</p>}

			{mode === "edit" && (
				<div className={styles.footer}>
					<button className={styles.saveBtn} disabled={saving} onClick={handleSave}>
						{saving ? "儲存中..." : saved ? "已儲存 ✓" : "儲存"}
					</button>
				</div>
			)}
		</div>
	);
}