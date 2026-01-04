// src/components/sms/SRMEntryModal.tsx
"use client";

import { useState, useEffect } from "react";
import styles from "./SRMEntryModal.module.css";
import CodeSelector from "./CodeSelector";
import RiskMatrixSelector from "./RiskMatrixSelector";
import {
	HUMAN_FACTOR_CATEGORIES,
	EF_ATTRIBUTE_CATEGORIES,
} from "@/lib/sms.constants";

interface RiskMitigationMeasure {
	description: string;
	department: string;
	deadline: string;
}

interface SRMEntryModalProps {
	entry?: any;
	currentYear: number;
	onClose: () => void;
	onSave: () => void;
}

export default function SRMEntryModal({
	entry,
	currentYear,
	onClose,
	onSave,
}: SRMEntryModalProps) {
	const [formData, setFormData] = useState({
		number: "",
		file_date: "",
		identification_source_type: "SA" as "SA" | "SRM",
		occurrence_month: "", // NEW: YYYY-MM format
		hazard_description: "",
		possible_cause: "",
		hazard_impact: "",
		existing_measures: "",
		current_risk_assessment: "",
		post_mitigation_assessment: "",
	});

	// NEW: Array of risk mitigation measures
	const [riskMitigationMeasures, setRiskMitigationMeasures] = useState<
		RiskMitigationMeasure[]
	>([{ description: "", department: "", deadline: "" }]);

	const [humanFactorsCodes, setHumanFactorsCodes] = useState<string[]>([]);
	const [efAttributeCodes, setEfAttributeCodes] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);
	const [openMatrix, setOpenMatrix] = useState<"current" | "post" | null>(
		null
	);

	useEffect(() => {
		if (entry) {
			setFormData({
				number: entry.number || "",
				file_date: entry.file_date || "",
				identification_source_type:
					entry.identification_source_type || "SA",
				occurrence_month: entry.occurrence_month || "",
				hazard_description: entry.hazard_description || "",
				possible_cause: entry.possible_cause || "",
				hazard_impact: entry.hazard_impact || "",
				existing_measures: entry.existing_measures || "",
				current_risk_assessment: entry.current_risk_assessment || "",
				post_mitigation_assessment:
					entry.post_mitigation_assessment || "",
			});
			setHumanFactorsCodes(entry.human_factors_codes || []);
			setEfAttributeCodes(entry.ef_attribute_codes || []);

			// Parse risk_mitigation_measures from JSON array or convert from old string format
			if (entry.risk_mitigation_measures) {
				try {
					const parsed = JSON.parse(entry.risk_mitigation_measures);
					if (Array.isArray(parsed)) {
						setRiskMitigationMeasures(parsed);
					} else {
						// Old format: single string - convert to array
						setRiskMitigationMeasures([
							{
								description: entry.risk_mitigation_measures,
								department: "",
								deadline: "",
							},
						]);
					}
				} catch {
					// If not JSON, treat as old string format
					setRiskMitigationMeasures([
						{
							description: entry.risk_mitigation_measures,
							department: "",
							deadline: "",
						},
					]);
				}
			}
		}
	}, [entry]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const token = localStorage.getItem("token");

			// Extract year from file_date
			const year = new Date(formData.file_date).getFullYear();

			// If occurrence_month is empty, default to year/month of created_at (current date)
			const occurrenceMonth =
				formData.occurrence_month ||
				new Date().toISOString().slice(0, 7); // YYYY-MM format

			const payload = {
				...formData,
				year,
				occurrence_month: occurrenceMonth,
				human_factors_codes: humanFactorsCodes,
				ef_attribute_codes: efAttributeCodes,
				// Serialize risk_mitigation_measures as JSON array
				risk_mitigation_measures: JSON.stringify(
					riskMitigationMeasures
				),
			};

			const url = entry
				? `/api/sms/srm-entries/${entry.id}`
				: "/api/sms/srm-entries";

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
			console.error("Error saving SRM entry:", error);
			alert(error.message || "儲存失敗");
		} finally {
			setLoading(false);
		}
	};

	// Add new risk mitigation measure
	const addRiskMitigationMeasure = () => {
		setRiskMitigationMeasures([
			...riskMitigationMeasures,
			{ description: "", department: "", deadline: "" },
		]);
	};

	// Remove risk mitigation measure at index
	const removeRiskMitigationMeasure = (index: number) => {
		if (riskMitigationMeasures.length === 1) {
			alert("至少需要一項風險緩解措施");
			return;
		}
		setRiskMitigationMeasures(
			riskMitigationMeasures.filter((_, i) => i !== index)
		);
	};

	// Update risk mitigation measure at index
	const updateRiskMitigationMeasure = (
		index: number,
		field: keyof RiskMitigationMeasure,
		value: string
	) => {
		const updated = [...riskMitigationMeasures];
		updated[index][field] = value;
		setRiskMitigationMeasures(updated);
	};

	return (
		<div className={styles.modalOverlay}>
			<div className={styles.modal}>
				<div className={styles.modalHeader}>
					<h2>{entry ? "編輯" : "新增"}管控表項目</h2>
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
					<div className={styles.modalBody}>
						{/* Row 1: 檔案日期, 編號, 資料來源, 事件月份 in four columns */}
						<div
							className={styles.formRow}
							style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}
						>
							<div className={styles.formGroup}>
								<label className={styles.required}>
									檔案日期
								</label>
								<input
									className={styles.input}
									type="date"
									value={formData.file_date}
									onChange={(e) =>
										setFormData({
											...formData,
											file_date: e.target.value,
										})
									}
									required
								/>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.required}>編號</label>
								<input
									className={styles.input}
									type="text"
									value={formData.number}
									onChange={(e) =>
										setFormData({
											...formData,
											number: e.target.value,
										})
									}
									placeholder="例如: 2025TZ12-03"
									required
								/>
							</div>

							<div className={styles.formGroup}>
								<label>資料來源</label>
								<div className={styles.radioGroup}>
									<label>
										<input
											type="radio"
											value="SA"
											checked={
												formData.identification_source_type ===
												"SA"
											}
											onChange={(e) =>
												setFormData({
													...formData,
													identification_source_type:
														e.target.value as
															| "SA"
															| "SRM",
												})
											}
										/>
										SA
									</label>
									<label>
										<input
											type="radio"
											value="SRM"
											checked={
												formData.identification_source_type ===
												"SRM"
											}
											onChange={(e) =>
												setFormData({
													...formData,
													identification_source_type:
														e.target.value as
															| "SA"
															| "SRM",
												})
											}
										/>
										SRM
									</label>
								</div>
							</div>

							<div className={styles.formGroup}>
								<label>事件月份</label>
								<input
									className={styles.input}
									type="month"
									value={formData.occurrence_month}
									onChange={(e) =>
										setFormData({
											...formData,
											occurrence_month: e.target.value,
										})
									}
									placeholder="YYYY-MM"
								/>
								<small
									style={{
										color: "#6b7280",
										fontSize: "0.75rem",
										marginTop: "0.25rem",
										display: "block",
									}}
								>
									留空則使用建檔月份
								</small>
							</div>
						</div>

						{/* 危險源描述 */}
						<div className={styles.formGroup}>
							<label>危險源描述</label>
							<textarea
								className={styles.textarea}
								value={formData.hazard_description}
								onChange={(e) =>
									setFormData({
										...formData,
										hazard_description: e.target.value,
									})
								}
								rows={3}
							/>
						</div>

						{/* 可能肇因 */}
						<div className={styles.formGroup}>
							<label>可能肇因</label>
							<textarea
								className={styles.textarea}
								value={formData.possible_cause}
								onChange={(e) =>
									setFormData({
										...formData,
										possible_cause: e.target.value,
									})
								}
								rows={3}
							/>
						</div>

						{/* Row 2: 危害影響 & 現有管控措施 */}
						<div className={styles.formRow}>
							<div className={styles.formGroup}>
								<label>危害影響</label>
								<textarea
									className={styles.textarea}
									value={formData.hazard_impact}
									onChange={(e) =>
										setFormData({
											...formData,
											hazard_impact: e.target.value,
										})
									}
									rows={3}
								/>
							</div>

							<div className={styles.formGroup}>
								<label>現有管控措施</label>
								<textarea
									className={styles.textarea}
									value={formData.existing_measures}
									onChange={(e) =>
										setFormData({
											...formData,
											existing_measures: e.target.value,
										})
									}
									rows={3}
								/>
							</div>
						</div>

						{/* Row 3: 人因代碼 & EF屬性代碼 side by side */}
						<div className={styles.formRow}>
							<CodeSelector
								title="人因代碼"
								categories={HUMAN_FACTOR_CATEGORIES}
								selectedCodes={humanFactorsCodes}
								onChange={setHumanFactorsCodes}
								type="human-factors"
								required={true}
							/>

							<CodeSelector
								title="EF屬性代碼"
								categories={EF_ATTRIBUTE_CATEGORIES}
								selectedCodes={efAttributeCodes}
								onChange={setEfAttributeCodes}
								type="ef-attributes"
								required={true}
							/>
						</div>

						{/* 風險評估 */}
						<div className={styles.formGroup}>
							<RiskMatrixSelector
								label="風險評估"
								required={true}
								value={formData.current_risk_assessment}
								onChange={(value) =>
									setFormData({
										...formData,
										current_risk_assessment: value,
									})
								}
								isOpen={openMatrix === "current"}
								onToggle={() =>
									setOpenMatrix(
										openMatrix === "current"
											? null
											: "current"
									)
								}
							/>
						</div>

						{/* 風險緩解措施 - MULTIPLE ENTRIES */}
						<div className={styles.formGroup}>
							<div className={styles.sectionHeader}>
								<label className={styles.required}>
									風險緩解措施
								</label>
								<button
									type="button"
									onClick={addRiskMitigationMeasure}
									className={styles.addButton}
								>
									+ 新增措施
								</button>
							</div>

							{riskMitigationMeasures.map((measure, index) => (
								<div key={index} className={styles.measureItem}>
									<div className={styles.measureHeader}>
										<span>措施 {index + 1}</span>
										{riskMitigationMeasures.length > 1 && (
											<button
												type="button"
												onClick={() =>
													removeRiskMitigationMeasure(
														index
													)
												}
												className={styles.removeButton}
											>
												×
											</button>
										)}
									</div>

									<div className={styles.measureFields}>
										{/* 描述 */}
										<div className={styles.formGroup}>
											<label className={styles.required}>
												描述
											</label>
											<textarea
												className={styles.textarea}
												value={measure.description}
												onChange={(e) =>
													updateRiskMitigationMeasure(
														index,
														"description",
														e.target.value
													)
												}
												rows={3}
												placeholder="請輸入風險緩解措施描述"
												required
											/>
										</div>

										{/* 辦理單位 */}
										<div className={styles.formGroup}>
											<label className={styles.required}>
												辦理單位
											</label>
											<input
												className={styles.input}
												type="text"
												value={measure.department}
												onChange={(e) =>
													updateRiskMitigationMeasure(
														index,
														"department",
														e.target.value
													)
												}
												placeholder="例如: 管派組"
												required
											/>
										</div>

										{/* 實施期限 */}
										<div className={styles.formGroup}>
											<label className={styles.required}>
												實施期限
											</label>
											<input
												className={styles.input}
												type="text"
												value={measure.deadline}
												onChange={(e) =>
													updateRiskMitigationMeasure(
														index,
														"deadline",
														e.target.value
													)
												}
												placeholder="例如: 12/1前"
												required
											/>
										</div>
									</div>
								</div>
							))}
						</div>

						{/* 緩解後評估 */}
						<div className={styles.formGroup}>
							<RiskMatrixSelector
								label="緩解後評估"
								value={formData.post_mitigation_assessment}
								onChange={(value) =>
									setFormData({
										...formData,
										post_mitigation_assessment: value,
									})
								}
								isOpen={openMatrix === "post"}
								onToggle={() =>
									setOpenMatrix(
										openMatrix === "post" ? null : "post"
									)
								}
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
							className={styles.submitButton}
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
