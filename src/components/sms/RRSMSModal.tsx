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
		risk_id: "",
		risk_last_review: "",
		risk_next_review: "",
		barrier_id: "",
		barrier_last_review: "",
		barrier_next_review: "",
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
					risk_id: entry.risk_id || "",
					risk_last_review: entry.risk_last_review || "",
					risk_next_review: entry.risk_next_review || "",
					barrier_id: entry.barrier_id || "",
					barrier_last_review: entry.barrier_last_review || "",
					barrier_next_review: entry.barrier_next_review || "",
				});
			}
		}
	}, [entry]);

	useEffect(() => {
		fetchSrmList();
	}, []);

	const fetchSrmList = async () => {
		setLoadingSrmList(true);
		try {
			const token = localStorage.getItem("token");
			const response = await fetch("/api/sms/srm-entries", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) throw new Error("Failed to fetch SRM list");

			const data = await response.json();

			// Group by year
			const groups: { [year: number]: SRMListItem[] } = {};
			data.forEach((item: SRMListItem) => {
				if (!groups[item.year]) groups[item.year] = [];
				groups[item.year].push(item);
			});

			const yearGroups = Object.keys(groups)
				.map((year) => ({
					year: parseInt(year),
					items: groups[parseInt(year)].sort(
						(a, b) =>
							new Date(b.file_date).getTime() -
							new Date(a.file_date).getTime()
					),
				}))
				.sort((a, b) => b.year - a.year);

			setSrmYearGroups(yearGroups);
		} catch (error) {
			console.error("Error fetching SRM list:", error);
		} finally {
			setLoadingSrmList(false);
		}
	};

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target;

		// Auto-calculate risk_next_review when risk_last_review changes
		if (name === "risk_last_review" && value) {
			const lastReviewDate = new Date(value);
			const nextReviewDate = new Date(lastReviewDate);
			nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);
			const nextReviewStr = nextReviewDate.toISOString().split("T")[0];
			setFormData((prev) => ({
				...prev,
				risk_last_review: value,
				risk_next_review: nextReviewStr,
			}));
		}
		// Auto-calculate barrier_next_review when barrier_last_review changes
		else if (name === "barrier_last_review" && value) {
			const lastReviewDate = new Date(value);
			const nextReviewDate = new Date(lastReviewDate);
			nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);
			const nextReviewStr = nextReviewDate.toISOString().split("T")[0];
			setFormData((prev) => ({
				...prev,
				barrier_last_review: value,
				barrier_next_review: nextReviewStr,
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

			// Extract year from risk_last_review or barrier_last_review
			const year = formData.risk_last_review
				? new Date(formData.risk_last_review).getFullYear()
				: formData.barrier_last_review
				? new Date(formData.barrier_last_review).getFullYear()
				: currentYear;

			// Auto-calculate risk_next_review if blank but risk_last_review exists
			let riskNextReview = formData.risk_next_review;
			if (!riskNextReview && formData.risk_last_review) {
				const lastReviewDate = new Date(formData.risk_last_review);
				const nextReviewDate = new Date(lastReviewDate);
				nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);
				riskNextReview = nextReviewDate.toISOString().split("T")[0];
			}

			// Auto-calculate barrier_next_review if blank but barrier_last_review exists
			let barrierNextReview = formData.barrier_next_review;
			if (!barrierNextReview && formData.barrier_last_review) {
				const lastReviewDate = new Date(formData.barrier_last_review);
				const nextReviewDate = new Date(lastReviewDate);
				nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);
				barrierNextReview = nextReviewDate.toISOString().split("T")[0];
			}

			const payload = {
				rr_number,
				srm_table_link_id: formData.srm_table_link_id || null,
				risk_id: formData.risk_id || null,
				risk_last_review: formData.risk_last_review || null,
				risk_next_review: riskNextReview || null,
				barrier_id: formData.barrier_id || null,
				barrier_last_review: formData.barrier_last_review || null,
				barrier_next_review: barrierNextReview || null,
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

			onSave();
			onClose();
		} catch (error: any) {
			console.error("Error saving RR entry:", error);
			alert(error.message || "儲存失敗，請重試");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.modalOverlay} onClick={onClose}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
							<option value="">選擇管控表條目</option>
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
											label={`${year}年`}
										>
											{filteredItems.map((item) => (
												<option
													key={item.id}
													value={item.id}
												>
													{item.number} -{" "}
													{item.hazard_description?.substring(
														0,
														50
													) || "無描述"}
												</option>
											))}
										</optgroup>
									);
								})
							)}
						</select>
					</div>

					{/* Risk ID Section */}
					<div className={styles.sectionDivider}>
						<h3>Risk ID</h3>
					</div>

					<div className={styles.formGroup}>
						<label>Risk ID</label>
						<input
							type="text"
							name="risk_id"
							value={formData.risk_id}
							onChange={handleChange}
							placeholder="例如: R1, R2 (用逗號分隔)"
							className={styles.input}
						/>
						<small>Risk ID 以 R 開頭</small>
					</div>

					<div className={styles.formRow}>
						<div className={styles.formGroup}>
							<label>Risk 最後審查</label>
							<input
								type="date"
								name="risk_last_review"
								value={formData.risk_last_review}
								onChange={handleChange}
								className={styles.input}
							/>
						</div>

						<div className={styles.formGroup}>
							<label>Risk 下次審查</label>
							<input
								type="date"
								name="risk_next_review"
								value={formData.risk_next_review}
								onChange={handleChange}
								className={styles.input}
							/>
							<small>留空自動計算（最後審查 + 1年）</small>
						</div>
					</div>

					{/* Barrier ID Section */}
					<div className={styles.sectionDivider}>
						<h3>Barrier ID</h3>
					</div>

					<div className={styles.formGroup}>
						<label>Barrier ID</label>
						<input
							type="text"
							name="barrier_id"
							value={formData.barrier_id}
							onChange={handleChange}
							placeholder="例如: B1, B2 (用逗號分隔)"
							className={styles.input}
						/>
						<small>Barrier ID 以 B 開頭</small>
					</div>

					<div className={styles.formRow}>
						<div className={styles.formGroup}>
							<label>Barrier 最後審查</label>
							<input
								type="date"
								name="barrier_last_review"
								value={formData.barrier_last_review}
								onChange={handleChange}
								className={styles.input}
							/>
						</div>

						<div className={styles.formGroup}>
							<label>Barrier 下次審查</label>
							<input
								type="date"
								name="barrier_next_review"
								value={formData.barrier_next_review}
								onChange={handleChange}
								className={styles.input}
							/>
							<small>留空自動計算（最後審查 + 1年）</small>
						</div>
					</div>

					<div className={styles.modalActions}>
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
