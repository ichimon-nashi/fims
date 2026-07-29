// src/components/sms/CrewReportModal.tsx
"use client";

import { useState, useEffect } from "react";
import styles from "./CrewReportModal.module.css";
import { CrewReport, CrewReportCategory } from "@/lib/sms.types";

interface CrewReportModalProps {
	entry: CrewReport | null;
	categories: CrewReportCategory[]; // active categories, plus any inactive ones already on `entry`
	currentYear: number;
	userId: string;
	onClose: () => void;
	onSave: () => void;
}

// "HAZ111-11" -> { digits1: "111", digits2: "11" }. Returns null if it doesn't match.
function parseHazCode(code: string | null | undefined) {
	if (!code) return null;
	const match = code.match(/^HAZ(\d{1,3})-(\d{1,2})$/);
	if (!match) return null;
	return { digits1: match[1], digits2: match[2] };
}

// Half of the 10 reserved category colors (lime, cyan, pink, tan, stone) are
// light enough that white text on a solid fill of them is hard to read — a
// fixed "always white" text color can't work for a palette this varied.
// Compute perceived luminance and pick dark or light text accordingly.
function getContrastTextColor(hex: string): string {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance > 0.6 ? "#1a1f35" : "#e8e9ed";
}

export default function CrewReportModal({
	entry,
	categories,
	currentYear,
	userId,
	onClose,
	onSave,
}: CrewReportModalProps) {
	const [source, setSource] = useState<"haz" | "other">("haz");
	const [digits1, setDigits1] = useState(""); // 3 digits
	const [digits2, setDigits2] = useState(""); // 2 digits
	const [yearMonth, setYearMonth] = useState(
		`${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
	);
	const [description, setDescription] = useState("");
	const [actionTaken, setActionTaken] = useState("");
	const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (entry) {
			const parsed = parseHazCode(entry.report_code);
			if (parsed) {
				setSource("haz");
				setDigits1(parsed.digits1);
				setDigits2(parsed.digits2);
			} else {
				setSource("other");
				setDigits1("");
				setDigits2("");
			}
			setYearMonth(
				`${entry.report_year}-${String(entry.report_month).padStart(2, "0")}`
			);
			setDescription(entry.description || "");
			setActionTaken(entry.action_taken || "");
			setSelectedCategoryIds(entry.category_ids || []);
		}
	}, [entry]);

	// Categories available to pick from: active ones, plus any already-selected
	// category even if it's been soft-deleted since this report was created.
	const pickableCategories = categories.filter(
		(c) => c.active || selectedCategoryIds.includes(c.id)
	);

	const toggleCategory = (id: string) => {
		setSelectedCategoryIds((prev) =>
			prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
		);
	};

	const handleDigits1Change = (value: string) => {
		setDigits1(value.replace(/\D/g, "").slice(0, 3));
	};

	const handleDigits2Change = (value: string) => {
		setDigits2(value.replace(/\D/g, "").slice(0, 2));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (source === "haz" && (!digits1 || !digits2)) {
			alert("請輸入完整的報告編號");
			return;
		}

		if (!description.trim()) {
			alert("請輸入描述");
			return;
		}

		// 分類 is optional — no validation on selectedCategoryIds.

		const [yearStr, monthStr] = yearMonth.split("-");
		if (!yearStr || !monthStr) {
			alert("請選擇年/月");
			return;
		}

		setLoading(true);

		try {
			const token = localStorage.getItem("token");

			const report_code =
				source === "haz"
					? `HAZ${digits1.padStart(3, "0")}-${digits2.padStart(2, "0")}`
					: null;

			const payload = {
				report_code,
				report_year: parseInt(yearStr, 10),
				report_month: parseInt(monthStr, 10),
				description: description.trim(),
				action_taken: actionTaken.trim() || null,
				category_ids: selectedCategoryIds,
				created_by: userId,
			};

			const url = entry
				? `/api/sms/crew-reports/${entry.id}`
				: "/api/sms/crew-reports";
			const method = entry ? "PUT" : "POST";

			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "儲存失敗");
			}

			onSave();
			onClose();
		} catch (error: any) {
			console.error("Error saving crew report:", error);
			alert(error.message || "儲存失敗，請重試");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.modalOverlay}>
			{/* Deliberately no onClick={onClose} on the overlay above — a stray
			    click must not discard an in-progress report. */}
			<div className={styles.modal}>
				<div className={styles.modalHeader}>
					<h2>{entry ? "編輯組員報告" : "新增組員報告"}</h2>
					<button
						type="button"
						onClick={onClose}
						className={styles.closeButton}
						disabled={loading}
					>
						×
					</button>
				</div>

				<form onSubmit={handleSubmit}>
					<div className={styles.form}>
						<div className={styles.formGroup}>
							<label>報告來源</label>
							<div className={styles.radioGroup}>
								<label>
									<input
										type="radio"
										checked={source === "haz"}
										onChange={() => setSource("haz")}
									/>
									安全報告
								</label>
								<label>
									<input
										type="radio"
										checked={source === "other"}
										onChange={() => setSource("other")}
									/>
									其他來源
								</label>
							</div>
						</div>

						<div className={styles.formRow}>
							{source === "haz" && (
								<div className={styles.formGroup}>
									<label>
										報告編號{" "}
										<span className={styles.required}>*</span>
									</label>
									<div className={styles.codeInputGroup}>
										<span className={styles.codePrefix}>HAZ</span>
										<input
											className={styles.codeSmallInput}
											value={digits1}
											onChange={(e) =>
												handleDigits1Change(e.target.value)
											}
											maxLength={3}
											placeholder="111"
											inputMode="numeric"
										/>
										<span className={styles.codeSeparator}>-</span>
										<input
											className={styles.codeSmallInput}
											value={digits2}
											onChange={(e) =>
												handleDigits2Change(e.target.value)
											}
											maxLength={2}
											placeholder="11"
											inputMode="numeric"
										/>
									</div>
								</div>
							)}

							<div className={styles.formGroup}>
								<label>
									年/月 <span className={styles.required}>*</span>
								</label>
								<input
									className={styles.input}
									type="month"
									value={yearMonth}
									onChange={(e) => setYearMonth(e.target.value)}
									required
								/>
							</div>
						</div>

						<div className={styles.formGroup}>
							<label>
								描述 <span className={styles.required}>*</span>
							</label>
							<textarea
								className={styles.textarea}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={3}
								required
							/>
						</div>

						<div className={styles.formGroup}>
							<label>分類</label>
							<div className={styles.pillGrid}>
								{pickableCategories.length === 0 && (
									<span className={styles.placeholder}>
										尚無可選分類
									</span>
								)}
								{pickableCategories.map((cat) => {
									const selected = selectedCategoryIds.includes(
										cat.id
									);
									return (
										<button
											key={cat.id}
											type="button"
											onClick={() => toggleCategory(cat.id)}
											className={styles.pill}
											style={
												selected
													? {
															background: cat.color_hex,
															borderColor: cat.color_hex,
															color: getContrastTextColor(cat.color_hex),
													  }
													: {
															background: `${cat.color_hex}1f`,
															borderColor: `${cat.color_hex}66`,
													  }
											}
										>
											{cat.name}
											{!cat.active && (
												<span
													className={styles.pillInactiveTag}
												>
													（已停用）
												</span>
											)}
										</button>
									);
								})}
							</div>
						</div>

						<div className={styles.formGroup}>
							<label>辦理情形</label>
							<textarea
								className={styles.textarea}
								value={actionTaken}
								onChange={(e) => setActionTaken(e.target.value)}
								rows={2}
							/>
						</div>
					</div>

					<div className={styles.modalFooter}>
						<button
							type="button"
							onClick={onClose}
							className={styles.cancelButton}
							disabled={loading}
						>
							取消
						</button>
						<button
							type="submit"
							className={styles.saveButton}
							disabled={loading}
						>
							{loading ? "儲存中..." : "儲存"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}