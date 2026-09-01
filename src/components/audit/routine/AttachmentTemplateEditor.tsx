// src/components/audit/routine/AttachmentTemplateEditor.tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./MonthlyFocusEditor.module.css"; // shared styling — same panel/item-list pattern
import { useAuth } from "@/context/AuthContext";

interface TemplateItem {
	item_no: number;
	category: string | null;
	item_text: string;
	ccom_ref: string | null;
}

interface Template {
	id: string;
	code: string;
	name: string;
	always_required: boolean;
}

export default function AttachmentTemplateEditor({ onClose }: { onClose: () => void }) {
	const { token } = useAuth();
	const [templates, setTemplates] = useState<Template[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [items, setItems] = useState<TemplateItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [showNewForm, setShowNewForm] = useState(false);
	const [newCode, setNewCode] = useState("");
	const [newName, setNewName] = useState("");
	const [newAlwaysRequired, setNewAlwaysRequired] = useState(false);

	function loadTemplates() {
		if (!token) return;
		fetch("/api/audit/routine/checklist-template?type=attachment", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((data) => setTemplates((data.templates ?? []).map((t: any) => t.template)));
	}

	useEffect(loadTemplates, [token]);

	function selectTemplate(id: string) {
		setSelectedId(id);
		setLoading(true);
		fetch(`/api/audit/routine/checklist-template?id=${id}`, { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((data) => setItems(data.items ?? []))
			.finally(() => setLoading(false));
	}

	async function createTemplate() {
		if (!newCode.trim() || !newName.trim()) {
			setError("代碼與名稱皆為必填");
			return;
		}
		setError(null);
		try {
			const res = await fetch("/api/audit/routine/checklist-template", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
				body: JSON.stringify({ code: newCode, name: newName, always_required: newAlwaysRequired }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? "新增失敗");
			setShowNewForm(false);
			setNewCode("");
			setNewName("");
			setNewAlwaysRequired(false);
			loadTemplates();
			selectTemplate(data.template.id);
		} catch (e: any) {
			setError(e.message ?? "新增失敗");
		}
	}

	function addItem() {
		setItems((prev) => [...prev, { item_no: prev.length + 1, category: null, item_text: "", ccom_ref: null }]);
	}

	function updateItem(index: number, patch: Partial<TemplateItem>) {
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
		if (!selectedId || !token) return;
		if (items.some((i) => !i.item_text.trim())) {
			setError("項目內容不可為空");
			return;
		}
		setError(null);
		setSaving(true);
		try {
			const res = await fetch(`/api/audit/routine/checklist-template/${selectedId}/items`, {
				method: "PUT",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
				body: JSON.stringify({ items }),
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
				<span className={styles.title}>查核附件類型管理</span>
				<button className={styles.closeBtn} onClick={onClose}>
					✕
				</button>
			</div>

			<div className={styles.body}>
				<div className={styles.monthSelect}>
					<select value={selectedId ?? ""} onChange={(e) => e.target.value && selectTemplate(e.target.value)}>
						<option value="">選擇查核附件類型...</option>
						{templates.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name}（{t.code}）{t.always_required ? " — 每次必填" : ""}
							</option>
						))}
					</select>
					<button className={styles.addBtn} onClick={() => setShowNewForm((v) => !v)} style={{ padding: "8px 14px", width: "auto" }}>
						+ 新增類型
					</button>
				</div>

				{showNewForm && (
					<div className={styles.itemRow} style={{ flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
						<input
							className={styles.itemTextInput}
							placeholder="代碼（英數，例如 c_efb）"
							value={newCode}
							onChange={(e) => setNewCode(e.target.value)}
						/>
						<input
							className={styles.itemTextInput}
							placeholder="顯示名稱（例如 C-EFB作業查核）"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<label style={{ fontSize: "0.8125rem", color: "#e8e9ed", display: "flex", alignItems: "center", gap: "6px" }}>
							<input type="checkbox" checked={newAlwaysRequired} onChange={(e) => setNewAlwaysRequired(e.target.checked)} />
							每次查核皆須填寫（如疲勞管理）
						</label>
						<button className={styles.saveBtn} onClick={createTemplate}>
							建立
						</button>
					</div>
				)}

				{selectedId && (
					<>
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
											<input
												className={styles.itemTextInput}
												value={item.category ?? ""}
												onChange={(e) => updateItem(i, { category: e.target.value || null })}
												placeholder="分類（選填，例如：行政紀錄）"
											/>
											<textarea
												className={styles.itemTextInput}
												value={item.item_text}
												onChange={(e) => updateItem(i, { item_text: e.target.value })}
												rows={2}
												placeholder="查核項目內容"
											/>
											<input
												className={styles.itemTextInput}
												value={item.ccom_ref ?? ""}
												onChange={(e) => updateItem(i, { ccom_ref: e.target.value || null })}
												placeholder="參考文件（選填，例如：CCOM 0.5/7.1）"
											/>
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
					</>
				)}
			</div>

			{error && <p className={styles.error}>{error}</p>}

			{selectedId && (
				<div className={styles.footer}>
					<button className={styles.saveBtn} disabled={saving} onClick={handleSave}>
						{saving ? "儲存中..." : saved ? "已儲存 ✓" : "儲存項目"}
					</button>
				</div>
			)}
		</div>
	);
}