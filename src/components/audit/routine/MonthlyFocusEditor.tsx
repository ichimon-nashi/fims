// src/components/audit/routine/MonthlyFocusEditor.tsx
"use client";

import { useEffect, useState } from "react";
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

export default function MonthlyFocusEditor({ onClose }: { onClose: () => void }) {
	const { token } = useAuth();
	const now = new Date();
	const [year, setYear] = useState(now.getFullYear());
	const [month, setMonth] = useState(now.getMonth() + 1);
	const [items, setItems] = useState<FocusItem[]>([]);
	const [attachmentTemplates, setAttachmentTemplates] = useState<AttachmentTemplateOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!token) return;
		fetch("/api/audit/routine/checklist-template?type=attachment", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((data) => setAttachmentTemplates((data.templates ?? []).map((t: any) => t.template)));
	}, [token]);

	useEffect(() => {
		if (!token) return;
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
	}, [token, year, month]);

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

	return (
		<div className={styles.panel}>
			<div className={styles.header}>
				<span className={styles.title}>編輯本月加強重點檢查</span>
				<button className={styles.closeBtn} onClick={onClose}>
					✕
				</button>
			</div>

			<div className={styles.body}>
				<div className={styles.monthSelect}>
					<select value={year} onChange={(e) => setYear(Number(e.target.value))}>
						{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
							<option key={y} value={y}>
								{y}年
							</option>
						))}
					</select>
					<select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
						{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
							<option key={m} value={m}>
								{m}月
							</option>
						))}
					</select>
					<span className={styles.monthHint}>
						{month === now.getMonth() + 1 && year === now.getFullYear() ? "（當月）" : "（可預先設定次月）"}
					</span>
				</div>

				{loading ? (
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

			<div className={styles.footer}>
				<button className={styles.saveBtn} disabled={saving} onClick={handleSave}>
					{saving ? "儲存中..." : saved ? "已儲存 ✓" : "儲存"}
				</button>
			</div>
		</div>
	);
}