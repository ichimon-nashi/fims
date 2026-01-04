// src/components/sms/RRSMSModal.tsx
"use client";

import { useState, useEffect } from "react";
import styles from "./RRSMSModal.module.css";
import { RRSMSEntry } from "@/lib/sms.types";

interface RRSMSModalProps {
	entry: RRSMSEntry | null;
	userId: string;
	currentYear: number;
	onClose: () => void;
	onSave: () => void;
}

interface SRMListItem {
	id: string;
	number: string;
	hazard_description?: string;
	file_date: string;
	year: number;
}

interface YearGroup {
	year: number;
	items: SRMListItem[];
}

export default function RRSMSModal({
	entry,
	userId,
	currentYear,
	onClose,
	onSave,
}: RRSMSModalProps) {
	const [formData, setFormData] = useState({
		num1: "",
		num2: "",
		srm_table_link_id: "",
		risk_id_barrier: "",
		last_review: "",
		next_review: "",
	});

	const [srmYearGroups, setSrmYearGroups] = useState<YearGroup[]>([]);
	const [srmSearchTerm, setSrmSearchTerm] = useState("");
	const [loadingSrmList, setLoadingSrmList] = useState(false);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (entry) {
			const parts = entry.rr_number.split("/");
			if (parts.length === 3) {
				setFormData({
					num1: parts[0],
					num2: parts[2],
					srm_table_link_id: entry.srm_table_link_id || "",
					risk_id_barrier: entry.risk_id_barrier || "",
					last_review: entry.last_review || "",
					next_review: entry.next_review || "",
				});
			}
		}
	}, [entry]);

	useEffect(() => {
		fetchSrmListItems();
	}, []);

	const fetchSrmListItems = async () => {
		try {
			setLoadingSrmList(true);
			const token = localStorage.getItem("token");

			const response = await fetch("/api/sms/srm-list", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) throw new Error("Failed to fetch SRM list");

			const data = await response.json();
			groupSrmByYear(data);
		} catch (error) {
			console.error("Error fetching SRM list items:", error);
		} finally {
			setLoadingSrmList(false);
		}
	};

	const groupSrmByYear = (items: SRMListItem[]) => {
		const groups: { [year: number]: SRMListItem[] } = {};

		items.forEach((item) => {
			const year = item.year;
			if (!groups[year]) {
				groups[year] = [];
			}
			groups[year].push(item);
		});

		const yearGroupsArray = Object.keys(groups)
			.map((year) => ({
				year: parseInt(year),
				items: groups[parseInt(year)].sort(
					(a, b) =>
						new Date(b.file_date).getTime() -
						new Date(a.file_date).getTime()
				),
			}))
			.sort((a, b) => b.year - a.year);

		setSrmYearGroups(yearGroupsArray);
	};

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target;

		// Handle num1 and num2 - only digits
		if (name === "num1") {
			setFormData((prev) => ({
				...prev,
				num1: value.replace(/\D/g, "").slice(0, 2),
			}));
		} else if (name === "num2") {
			setFormData((prev) => ({
				...prev,
				num2: value.replace(/\D/g, "").slice(0, 3),
			})); // Allow 2-3 digits
		}
		// Auto-calculate next_review when last_review changes
		else if (name === "last_review" && value) {
			const lastReviewDate = new Date(value);
			const nextReviewDate = new Date(lastReviewDate);
			nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);
			const nextReviewStr = nextReviewDate.toISOString().split("T")[0];
			setFormData((prev) => ({
				...prev,
				last_review: value,
				next_review: nextReviewStr,
			}));
		} else {
			setFormData((prev) => ({ ...prev, [name]: value }));
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		// Validate RR number parts
		if (!formData.num1 || !formData.num2) {
			alert("請輸入完整的 RR 編號");
			setLoading(false);
			return;
		}

		if (
			formData.num1.length !== 2 ||
			(formData.num2.length !== 2 && formData.num2.length !== 3)
		) {
			alert("RR 編號格式: XX/RR/XX 或 XX/RR/XXX");
			setLoading(false);
			return;
		}

		const rr_number = `${formData.num1}/RR/${formData.num2}`;

		try {
			const token = localStorage.getItem("token");

			// Extract year from last_review
			const year = formData.last_review
				? new Date(formData.last_review).getFullYear()
				: currentYear;

			const payload = {
				rr_number,
				srm_table_link_id: formData.srm_table_link_id || null,
				risk_id_barrier: formData.risk_id_barrier || null,
				last_review: formData.last_review || null,
				next_review: formData.next_review || null,
				year,
				created_by: userId,
			};

			const url = entry
				? `/api/sms/rr-entries/${entry.id}`
				: "/api/sms/rr-entries";

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
				throw new Error(errorData.error || "Failed to save entry");
			}

			alert(entry ? "更新成功！" : "新增成功！");
			onSave();
			onClose();
		} catch (error: any) {
			console.error("Error saving RR SMS entry:", error);
			alert(error.message || "儲存失敗");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.modalOverlay}>
			<div className={styles.modal}>
				<div className={styles.modalHeader}>
					<h2>{entry ? "編輯 RR SMS 項目" : "新增 RR SMS 項目"}</h2>
					<button className={styles.closeButton} onClick={onClose}>
						×
					</button>
				</div>

				<form onSubmit={handleSubmit} className={styles.form}>
					<div className={styles.formRow}>
						<div className={styles.formGroup}>
							<label>
								RR編號{" "}
								<span className={styles.required}>*</span>
							</label>
							<div className={styles.rrNumberInput}>
								<input
									type="text"
									name="num1"
									value={formData.num1}
									onChange={handleChange}
									placeholder="XX"
									maxLength={2}
									required
									className={styles.smallInput}
								/>
								<span className={styles.separator}>/</span>
								<span className={styles.rrText}>RR</span>
								<span className={styles.separator}>/</span>
								<input
									type="text"
									name="num2"
									value={formData.num2}
									onChange={handleChange}
									placeholder="XX"
									maxLength={3}
									required
									className={styles.smallInput}
								/>
							</div>
							<small>
								年份 2 碼，序號 2-3 碼 (例如: 26/RR/01 或
								26/RR/123)
							</small>
						</div>

						<div className={styles.formGroup}>
							<label>Risk ID / Barrier ID</label>
							<input
								type="text"
								name="risk_id_barrier"
								value={formData.risk_id_barrier}
								onChange={handleChange}
								placeholder="例如: R1, R2, B1 (用逗號分隔)"
								className={styles.input}
							/>
							<small>
								Risk ID 以 R 開頭，Barrier ID 以 B 開頭
							</small>
						</div>
					</div>

					<div className={styles.formGroup}>
						<label>管控表Link</label>
						<input
							type="text"
							placeholder="搜尋管控表編號或描述..."
							value={srmSearchTerm}
							onChange={(e) => setSrmSearchTerm(e.target.value)}
							className={styles.input}
						/>
						<select
							name="srm_table_link_id"
							value={formData.srm_table_link_id}
							onChange={handleChange}
							className={styles.select}
						>
							<option value="">選擇管控表項目</option>
							{loadingSrmList ? (
								<option disabled>載入中...</option>
							) : (
								srmYearGroups.map(({ year, items }) => {
									const filteredItems = items.filter(
										(item) => {
											if (!srmSearchTerm) return true;
											const search =
												srmSearchTerm.toLowerCase();
											return (
												item.number
													.toLowerCase()
													.includes(search) ||
												item.hazard_description
													?.toLowerCase()
													.includes(search)
											);
										}
									);
									if (filteredItems.length === 0) return null;
									return (
										<optgroup
											key={year}
											label={`━━━━━ ${year} 年度 (${filteredItems.length}) ━━━━━`}
										>
											{filteredItems.map((item) => (
												<option
													key={item.id}
													value={item.id}
												>
													{item.number} -{" "}
													{item.hazard_description?.substring(
														0,
														60
													) || ""}
												</option>
											))}
										</optgroup>
									);
								})
							)}
						</select>
					</div>

					<div className={styles.formRow}>
						<div className={styles.formGroup}>
							<label>Last Review</label>
							<input
								type="date"
								name="last_review"
								value={formData.last_review}
								onChange={handleChange}
								className={styles.input}
							/>
						</div>

						<div className={styles.formGroup}>
							<label>Next Review</label>
							<input
								type="date"
								name="next_review"
								value={formData.next_review}
								onChange={handleChange}
								className={styles.input}
							/>
							<small className={styles.hintGreen}>
								預設為 Last Review + 1 年
							</small>
						</div>
					</div>

					<div className={styles.modalFooter}>
						<button
							type="button"
							onClick={onClose}
							className={styles.cancelButton}
						>
							取消
						</button>
						<button
							type="submit"
							disabled={loading}
							className={styles.saveButton}
						>
							{loading ? "儲存中..." : entry ? "更新" : "新增"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
