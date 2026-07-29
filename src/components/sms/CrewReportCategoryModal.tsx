// src/components/sms/CrewReportCategoryModal.tsx
"use client";

import { useState } from "react";
import styles from "./CrewReportCategoryModal.module.css";
import { CrewReportCategory, CREW_REPORT_CATEGORY_COLORS } from "@/lib/sms.types";

interface CrewReportCategoryModalProps {
	categories: CrewReportCategory[]; // may include inactive ones (for count display elsewhere); this modal only lists active ones
	categoryCounts: Record<string, number>;
	onClose: () => void;
	onSaved: () => void;
}

export default function CrewReportCategoryModal({
	categories,
	categoryCounts,
	onClose,
	onSaved,
}: CrewReportCategoryModalProps) {
	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState(CREW_REPORT_CATEGORY_COLORS[0]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editColor, setEditColor] = useState("");
	const [loading, setLoading] = useState(false);

	// Only active categories are listed here. Deleting one soft-deletes it
	// (active: false) — it disappears from this list and from the new-report
	// picker, but the category row itself still exists, so past reports that
	// already used it keep showing its real name and color.
	const activeCategories = categories.filter((c) => c.active);

	const handleAdd = async () => {
		if (!newName.trim()) {
			alert("請輸入分類名稱");
			return;
		}
		setLoading(true);
		try {
			const token = localStorage.getItem("token");
			const response = await fetch("/api/sms/crew-report-categories", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ name: newName.trim(), color_hex: newColor }),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "新增分類失敗");
			}

			setNewName("");
			onSaved();
		} catch (error: any) {
			console.error("Error creating category:", error);
			alert(error.message || "新增分類失敗");
		} finally {
			setLoading(false);
		}
	};

	const startEdit = (category: CrewReportCategory) => {
		setEditingId(category.id);
		setEditName(category.name);
		setEditColor(category.color_hex);
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditName("");
		setEditColor("");
	};

	const saveEdit = async (id: string) => {
		if (!editName.trim()) {
			alert("請輸入分類名稱");
			return;
		}
		setLoading(true);
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(`/api/sms/crew-report-categories/${id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ name: editName.trim(), color_hex: editColor }),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "更新分類失敗");
			}

			cancelEdit();
			onSaved();
		} catch (error: any) {
			console.error("Error updating category:", error);
			alert(error.message || "更新分類失敗");
		} finally {
			setLoading(false);
		}
	};

	// Soft-delete: sets active: false. No confirmation needed since it's
	// non-destructive — the category record and its name/color are preserved
	// for any report that already references it.
	const handleDelete = async (category: CrewReportCategory) => {
		setLoading(true);
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				`/api/sms/crew-report-categories/${category.id}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ active: false }),
				}
			);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "刪除失敗");
			}

			onSaved();
		} catch (error: any) {
			console.error("Error deleting category:", error);
			alert(error.message || "刪除失敗");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.modalOverlay}>
			<div className={styles.modal}>
				<div className={styles.modalHeader}>
					<h2>管理報告分類</h2>
					<button
						type="button"
						onClick={onClose}
						className={styles.closeButton}
					>
						×
					</button>
				</div>

				<div className={styles.form}>
					<div className={styles.formGroup}>
						<label>新增分類</label>
						<input
							className={styles.input}
							type="text"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="輸入分類名稱..."
						/>
						<label style={{ marginTop: "0.75rem" }}>選擇顏色</label>
						<div className={styles.colorSwatchRow}>
							{CREW_REPORT_CATEGORY_COLORS.map((color) => (
								<div
									key={color}
									className={`${styles.colorSwatch} ${
										newColor === color ? styles.selected : ""
									}`}
									style={{ background: color }}
									onClick={() => setNewColor(color)}
								/>
							))}
						</div>
						<button
							type="button"
							onClick={handleAdd}
							disabled={loading}
							className={styles.addButton}
						>
							+ 新增分類
						</button>
					</div>

					<div className={styles.categoryList}>
						{activeCategories.length === 0 && (
							<div className={styles.emptyState}>尚無分類</div>
						)}
						{activeCategories.map((category) => (
							<div key={category.id} className={styles.categoryRow}>
								{editingId === category.id ? (
									<div className={styles.editRow}>
										<input
											className={styles.input}
											type="text"
											value={editName}
											onChange={(e) =>
												setEditName(e.target.value)
											}
										/>
										<div className={styles.colorSwatchRow}>
											{CREW_REPORT_CATEGORY_COLORS.map(
												(color) => (
													<div
														key={color}
														className={`${
															styles.colorSwatch
														} ${
															editColor === color
																? styles.selected
																: ""
														}`}
														style={{
															background: color,
														}}
														onClick={() =>
															setEditColor(color)
														}
													/>
												)
											)}
										</div>
										<div className={styles.editActions}>
											<button
												type="button"
												onClick={() =>
													saveEdit(category.id)
												}
												disabled={loading}
												className={styles.iconBtn}
											>
												儲存
											</button>
											<button
												type="button"
												onClick={cancelEdit}
												className={styles.iconBtn}
											>
												取消
											</button>
										</div>
									</div>
								) : (
									<>
										<span
											className={styles.dot}
											style={{
												background: category.color_hex,
											}}
										/>
										<span className={styles.name}>
											{category.name}
										</span>
										<span className={styles.count}>
											{categoryCounts[category.id] || 0} 筆使用中
										</span>
										<button
											type="button"
											onClick={() => startEdit(category)}
											className={styles.iconBtn}
										>
											編輯
										</button>
										<button
											type="button"
											onClick={() => handleDelete(category)}
											disabled={loading}
											className={`${styles.iconBtn} ${styles.deleteBtn}`}
										>
											刪除
										</button>
									</>
								)}
							</div>
						))}
					</div>
				</div>

				<div className={styles.modalFooter}>
					<button
						type="button"
						onClick={onClose}
						className={styles.doneButton}
					>
						完成
					</button>
				</div>
			</div>
		</div>
	);
}