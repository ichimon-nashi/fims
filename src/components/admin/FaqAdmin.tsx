// src/components/admin/FaqAdmin.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/common/Navbar";
import { APP_META } from "@/lib/appConfig";
import type { FaqEntry, FaqSection, FaqType } from "@/lib/faq.types";
import styles from "./FaqAdmin.module.css";

const ADMINS = ["admin", "51892"];

interface FormState {
	app_id: string;
	title: string;
	type: FaqType;
	sections: FaqSection[];
	sort_order: number;
}

const emptySection = (): FaqSection => ({ content: "", image_url: null, sort_order: 0 });

const todayStr = () => new Date().toISOString().slice(0, 10).replace(/-/g, "/");

const defaultTitleFor = (type: FaqType): string =>
	type === "更新" ? `更新 ${todayStr()}` : "功能介紹";

const emptyForm = (): FormState => ({
	app_id: APP_META[0]?.id ?? "",
	title: defaultTitleFor("說明"),
	type: "說明",
	sections: [emptySection()],
	sort_order: 0,
});

export default function FaqAdmin() {
	const { user, loading, token } = useAuth();
	const router = useRouter();

	const [entries, setEntries] = useState<FaqEntry[]>([]);
	const [listLoading, setListLoading] = useState(true);
	const [listError, setListError] = useState<string | null>(null);

	const [filterApp, setFilterApp] = useState<string>("all");

	const [editing, setEditing] = useState<"new" | FaqEntry | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm());
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

	const [deleting, setDeleting] = useState<FaqEntry | null>(null);
	const [deleteBusy, setDeleteBusy] = useState(false);

	const isAdmin = !!user?.employee_id && ADMINS.includes(user.employee_id);

	// ── Auth guard ───────────────────────────────────────────────────────────
	useEffect(() => {
		if (loading) return;
		if (!user || !token) { router.replace("/login"); return; }
		if (!isAdmin) router.replace("/dashboard");
	}, [user, token, loading, isAdmin, router]);

	// ── Fetch entries ────────────────────────────────────────────────────────
	const fetchEntries = async () => {
		if (!token) return;
		setListLoading(true);
		setListError(null);
		try {
			const res = await fetch("/api/faq", { headers: { Authorization: `Bearer ${token}` } });
			if (!res.ok) throw new Error("載入失敗");
			const data = await res.json();
			setEntries(data.entries || []);
		} catch {
			setListError("無法載入 FAQ 項目");
		} finally {
			setListLoading(false);
		}
	};

	useEffect(() => {
		if (token && isAdmin) fetchEntries();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token, isAdmin]);

	// ── Derived list ─────────────────────────────────────────────────────────
	const visibleEntries = useMemo(() => {
		const filtered = filterApp === "all" ? entries : entries.filter((e) => e.app_id === filterApp);
		return [...filtered].sort(
			(a, b) =>
				a.app_id.localeCompare(b.app_id) ||
				a.sort_order - b.sort_order ||
				b.updated_at.localeCompare(a.updated_at)
		);
	}, [entries, filterApp]);

	const appTitle = (id: string) => APP_META.find((a) => a.id === id)?.title ?? id;
	const appColor = (id: string) => APP_META.find((a) => a.id === id)?.color ?? "#4a9eff";

	// ── Modal open/close ─────────────────────────────────────────────────────
	const openNew = () => {
		setForm(emptyForm());
		setSaveError(null);
		setEditing("new");
	};

	const openEdit = (entry: FaqEntry) => {
		setForm({
			app_id: entry.app_id,
			title: entry.title,
			type: entry.type,
			sections: entry.sections.length
				? [...entry.sections].sort((a, b) => a.sort_order - b.sort_order)
				: [emptySection()],
			sort_order: entry.sort_order,
		});
		setSaveError(null);
		setEditing(entry);
	};

	const closeModal = () => { if (!saving) setEditing(null); };

	// ── Section editor helpers ───────────────────────────────────────────────
	const updateSection = (idx: number, patch: Partial<FaqSection>) =>
		setForm((f) => ({
			...f,
			sections: f.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
		}));

	const addSection = () =>
		setForm((f) => ({ ...f, sections: [...f.sections, emptySection()] }));

	const removeSection = (idx: number) =>
		setForm((f) => ({ ...f, sections: f.sections.filter((_, i) => i !== idx) }));

	const moveSection = (idx: number, dir: -1 | 1) =>
		setForm((f) => {
			const next = [...f.sections];
			const target = idx + dir;
			if (target < 0 || target >= next.length) return f;
			[next[idx], next[target]] = [next[target], next[idx]];
			return { ...f, sections: next };
		});

	const fileToBase64 = (file: File): Promise<string> =>
		new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				// reader.result is "data:image/png;base64,AAAA..." — strip the prefix
				const result = reader.result as string;
				resolve(result.slice(result.indexOf(",") + 1));
			};
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});

	const uploadSectionImage = async (idx: number, file: File) => {
		if (!token) return;
		if (file.size > 3 * 1024 * 1024) {
			setSaveError("檔案大小不可超過 3MB");
			return;
		}
		setUploadingIdx(idx);
		setSaveError(null);
		try {
			const dataBase64 = await fileToBase64(file);
			const res = await fetch("/api/faq/upload", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ fileName: file.name, fileType: file.type, dataBase64 }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || "上傳失敗");
			updateSection(idx, { image_url: data.url });
		} catch (e) {
			setSaveError(e instanceof Error ? e.message : "上傳失敗");
		} finally {
			setUploadingIdx(null);
		}
	};

	// ── Save (create or update) ──────────────────────────────────────────────
	const save = async () => {
		if (!token) return;
		if (!form.title.trim()) { setSaveError("請輸入標題"); return; }
		if (form.sections.every((s) => !s.content.trim())) { setSaveError("至少需要一個有內容的段落"); return; }

		setSaving(true);
		setSaveError(null);

		const payload = {
			app_id: form.app_id,
			title: form.title.trim(),
			type: form.type,
			sort_order: form.sort_order,
			sections: form.sections
				.filter((s) => s.content.trim())
				.map((s, i) => ({ ...s, sort_order: i })),
		};

		try {
			const isNew = editing === "new";
			const url = isNew ? "/api/faq" : `/api/faq/${(editing as FaqEntry).id}`;
			const res = await fetch(url, {
				method: isNew ? "POST" : "PUT",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || "儲存失敗");
			}
			setEditing(null);
			await fetchEntries();
		} catch (e) {
			setSaveError(e instanceof Error ? e.message : "儲存失敗");
		} finally {
			setSaving(false);
		}
	};

	// ── Delete ────────────────────────────────────────────────────────────────
	const doDelete = async () => {
		if (!token || !deleting) return;
		setDeleteBusy(true);
		try {
			const res = await fetch(`/api/faq/${deleting.id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error();
			setEntries((prev) => prev.filter((e) => e.id !== deleting.id));
			setDeleting(null);
		} catch {
			setListError("刪除失敗，請再試一次");
		} finally {
			setDeleteBusy(false);
		}
	};

	if (loading || !user || !token || !isAdmin) return null;

	return (
		<>
			<Navbar />
			<div className={styles.page}>
				<div className={styles.container}>
					<div className={styles.header}>
						<div>
							<h1 className={styles.title}>FAQ 管理</h1>
							<p className={styles.subtitle}>管理各功能的使用說明與更新紀錄</p>
						</div>
						<button type="button" className={styles.primaryBtn} onClick={openNew}>
							＋ 新增項目
						</button>
					</div>

					<div className={styles.toolbar}>
						<select
							className={styles.select}
							value={filterApp}
							onChange={(e) => setFilterApp(e.target.value)}
						>
							<option value="all">全部功能</option>
							{APP_META.map((a) => (
								<option key={a.id} value={a.id}>{a.title}</option>
							))}
						</select>
					</div>

					{listError && <div className={styles.errorBanner}>{listError}</div>}

					{listLoading ? (
						<div className={styles.center}><div className={styles.spinner} /></div>
					) : visibleEntries.length === 0 ? (
						<div className={styles.empty}>尚無項目</div>
					) : (
						<div className={styles.list}>
							{visibleEntries.map((entry) => (
								<div key={entry.id} className={styles.row}>
									<div className={styles.rowMain}>
										<span
										className={styles.appTag}
										style={{ backgroundColor: `${appColor(entry.app_id)}22`, color: appColor(entry.app_id) }}
									>
										{appTitle(entry.app_id)}
									</span>
										<span className={`${styles.typeTag} ${entry.type === "更新" ? styles.typeUpdate : styles.typeGuide}`}>
											{entry.type}
										</span>
										<span className={styles.rowTitle}>{entry.title}</span>
									</div>
									<div className={styles.rowMeta}>
										{entry.sections.length} 段落 ・ 更新於 {entry.updated_at.slice(0, 10)}
									</div>
									<div className={styles.rowActions}>
										<button type="button" className={styles.ghostBtn} onClick={() => openEdit(entry)}>編輯</button>
										<button type="button" className={styles.dangerBtn} onClick={() => setDeleting(entry)}>刪除</button>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* ── Edit/Create modal ── */}
			{editing && (
				<div className={styles.overlay} role="dialog" aria-modal="true">
					<div className={styles.scrim} />
					<div className={styles.modal}>
						<div className={styles.modalHeader}>
							<h2>{editing === "new" ? "新增項目" : "編輯項目"}</h2>
							<button type="button" className={styles.closeBtn} onClick={closeModal} aria-label="關閉">×</button>
						</div>

						<div className={styles.modalBody}>
							<div className={styles.formRow}>
								<label className={styles.label}>功能</label>
								<select
									className={styles.select}
									value={form.app_id}
									onChange={(e) => setForm((f) => ({ ...f, app_id: e.target.value }))}
								>
									{APP_META.map((a) => (
										<option key={a.id} value={a.id}>{a.title}</option>
									))}
								</select>
							</div>

							<div className={styles.formRow}>
								<label className={styles.label}>類型</label>
								<div className={styles.typeToggle}>
									{(["說明", "更新"] as FaqType[]).map((t) => (
										<button
											key={t}
											type="button"
											className={`${styles.typeBtn} ${form.type === t ? styles.typeBtnActive : ""}`}
											onClick={() =>
											setForm((f) => {
												const stillDefault = f.title.trim() === "" || f.title === defaultTitleFor(f.type);
												return {
													...f,
													type: t,
													title: stillDefault ? defaultTitleFor(t) : f.title,
												};
											})
										}
										>
											{t === "說明" ? "使用說明" : "更新紀錄"}
										</button>
									))}
								</div>
							</div>

							<div className={styles.formRow}>
								<label className={styles.label}>標題</label>
								<input
									className={styles.input}
									value={form.title}
									onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
									placeholder="例：功能介紹 或 更新 2026/09/14"
								/>
							</div>

							<div className={styles.formRow}>
								<div className={styles.sectionsHeader}>
									<label className={styles.label}>內容段落</label>
									<button type="button" className={styles.ghostBtn} onClick={addSection}>＋ 新增段落</button>
								</div>

								{form.sections.map((s, idx) => (
									<div key={idx} className={styles.sectionEditor}>
										<div className={styles.sectionEditorHead}>
											<span className={styles.stepNum}>{idx + 1}</span>
											<div className={styles.sectionEditorBtns}>
												<button type="button" className={styles.iconBtn} onClick={() => moveSection(idx, -1)} disabled={idx === 0}>↑</button>
												<button type="button" className={styles.iconBtn} onClick={() => moveSection(idx, 1)} disabled={idx === form.sections.length - 1}>↓</button>
												<button type="button" className={styles.iconBtn} onClick={() => removeSection(idx)} disabled={form.sections.length === 1}>✕</button>
											</div>
										</div>
										<textarea
											className={styles.textarea}
											rows={3}
											value={s.content}
											onChange={(e) => updateSection(idx, { content: e.target.value })}
											placeholder="說明內容，換行請直接按 Enter"
										/>

										{s.image_url ? (
											<div className={styles.imagePreview}>
												<img src={s.image_url} alt="" className={styles.imagePreviewImg} />
												<button
													type="button"
													className={styles.ghostBtn}
													onClick={() => updateSection(idx, { image_url: null })}
												>
													移除圖片
												</button>
											</div>
										) : (
											<label className={styles.uploadLabel}>
												{uploadingIdx === idx ? "上傳中…" : "＋ 上傳圖片（選填）"}
												<input
													type="file"
													accept="image/png,image/jpeg,image/webp,image/gif"
													className={styles.uploadInput}
													disabled={uploadingIdx !== null}
													onChange={(e) => {
														const file = e.target.files?.[0];
														e.target.value = ""; // allow re-selecting the same file later
														if (file) uploadSectionImage(idx, file);
													}}
												/>
											</label>
										)}
									</div>
								))}
							</div>

							{saveError && <div className={styles.errorBanner}>{saveError}</div>}
						</div>

						<div className={styles.modalFooter}>
							<button type="button" className={styles.ghostBtn} onClick={closeModal} disabled={saving}>取消</button>
							<button type="button" className={styles.primaryBtn} onClick={save} disabled={saving}>
								{saving ? "儲存中…" : "儲存"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Delete confirm ── */}
			{deleting && (
				<div className={styles.overlay} role="dialog" aria-modal="true">
					<div className={styles.scrim} onClick={() => !deleteBusy && setDeleting(null)} />
					<div className={styles.confirmModal}>
						<h2>刪除項目？</h2>
						<p>「{deleting.title}」將被永久刪除，無法復原。</p>
						<div className={styles.modalFooter}>
							<button type="button" className={styles.ghostBtn} onClick={() => setDeleting(null)} disabled={deleteBusy}>取消</button>
							<button type="button" className={styles.dangerBtn} onClick={doDelete} disabled={deleteBusy}>
								{deleteBusy ? "刪除中…" : "確認刪除"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
