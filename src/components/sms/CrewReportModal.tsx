// src/components/sms/CrewReportModal.tsx
"use client";

import { useState, useEffect, ReactNode } from "react";
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
	const [digits1, setDigits1] = useState(""); // variable-length, stored/displayed exactly as entered — no zero-padding
	const [digits2, setDigits2] = useState("");
	const [occurrenceDate, setOccurrenceDate] = useState(
		new Date().toISOString().slice(0, 10)
	);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [hazardType, setHazardType] = useState("");
	const [actionTaken, setActionTaken] = useState("");
	const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
	const [loading, setLoading] = useState(false);

	// All optional AQD-sourced fields not shown in the always-visible core
	// of the form — grouped into one object given the volume, matching the
	// object-state pattern already used for volume in SRMEntryModal.tsx's
	// formData. occurrence_date lives in its own state above now — it's a
	// primary always-visible field, not an optional extra.
	const [extraFields, setExtraFields] = useState({
		registered_date: "",
		aircraft: "",
		flight_no: "",
		departure: "",
		arrival: "",
		location: "",
		potential_consequence: "",
		reporter_name: "",
		operational_category: "",
		assessment_code: "",
		risk_assessment_calculation: "",
		risk_assessment: "",
		closed_status: "",
	});

	const setExtraField = (key: keyof typeof extraFields, value: string) => {
		setExtraFields((prev) => ({ ...prev, [key]: value }));
	};

	useEffect(() => {
		if (entry) {
			const parsed = parseHazCode(entry.report_code);
			setDigits1(parsed?.digits1 || "");
			setDigits2(parsed?.digits2 || "");
			// Falls back to report_year/report_month (day 01) for older
			// entries created before occurrence_date existed as a field.
			setOccurrenceDate(
				entry.occurrence_date?.slice(0, 10) ||
					`${entry.report_year}-${String(entry.report_month).padStart(2, "0")}-01`
			);
			setTitle(entry.title || "");
			setDescription(entry.description || "");
			setHazardType(entry.hazard_type || "");
			setActionTaken(entry.action_taken || "");
			setSelectedCategoryIds(entry.category_ids || []);
			setExtraFields({
				registered_date: entry.registered_date?.slice(0, 10) || "",
				aircraft: entry.aircraft || "",
				flight_no: entry.flight_no || "",
				departure: entry.departure || "",
				arrival: entry.arrival || "",
				location: entry.location || "",
				potential_consequence: entry.potential_consequence || "",
				reporter_name: entry.reporter_name || "",
				operational_category: entry.operational_category || "",
				assessment_code: entry.assessment_code || "",
				risk_assessment_calculation: entry.risk_assessment_calculation || "",
				risk_assessment: entry.risk_assessment || "",
				closed_status: entry.closed_status || "",
			});
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

		if (!digits1 || !digits2) {
			alert("請輸入完整的報告編號");
			return;
		}

		if (!title.trim()) {
			alert("請輸入標題");
			return;
		}

		if (!description.trim()) {
			alert("請輸入描述");
			return;
		}

		// EF分類 is optional — no validation on selectedCategoryIds.
		// OF分類 (hazard_type) is also optional — not every report has one.

		if (!occurrenceDate) {
			alert("請選擇事件日期");
			return;
		}

		setLoading(true);

		try {
			const token = localStorage.getItem("token");

			// Stored exactly as entered — no zero-padding. AQD codes aren't
			// fixed-width (e.g. "HAZ2-26", not "HAZ002-26").
			const report_code = `HAZ${digits1}-${digits2}`;

			const [yearStr, monthStr] = occurrenceDate.split("-");

			const trimmedExtras = Object.fromEntries(
				Object.entries(extraFields).map(([key, value]) => [key, value.trim() || null])
			);

			const payload = {
				report_code,
				report_year: parseInt(yearStr, 10),
				report_month: parseInt(monthStr, 10),
				title: title.trim(),
				description: description.trim(),
				hazard_type: hazardType.trim() || null,
				action_taken: actionTaken.trim() || null,
				category_ids: selectedCategoryIds,
				occurrence_date: occurrenceDate,
				...trimmedExtras,
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
			console.error("Error saving safety report:", error);
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
					<h2>{entry ? "編輯安全報告" : "新增安全報告"}</h2>
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
						<div className={styles.formRow}>
							<div className={styles.formGroup}>
								<label>
									報告編號 (AQD Code){" "}
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

							<div className={styles.formGroup}>
								<label>
									事件日期 (Occurrence Date){" "}
									<span className={styles.required}>*</span>
								</label>
								<input
									className={styles.input}
									type="date"
									value={occurrenceDate}
									onChange={(e) => setOccurrenceDate(e.target.value)}
									required
								/>
							</div>
						</div>

						<div className={styles.formGroup}>
							<label>
								標題 (Title) <span className={styles.required}>*</span>
							</label>
							<input
								className={styles.input}
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								required
							/>
						</div>

						<div className={styles.formGroup}>
							<label>
								描述 (Description) <span className={styles.required}>*</span>
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
							<label>EF分類</label>
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

						{/* Everything below is optional AQD-sourced detail — collapsed by
						    default so the form doesn't overwhelm on open. Grouped to
						    match the same sections used in the table's expanded row view. */}
						<CollapsibleSection title="航班資訊 (Flight Info)">
							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<label>機號 (A/C)</label>
									<input
										className={styles.input}
										type="text"
										value={extraFields.aircraft}
										onChange={(e) => setExtraField("aircraft", e.target.value)}
									/>
								</div>
								<div className={styles.formGroup}>
									<label>班機編號 (Flight no.)</label>
									<input
										className={styles.input}
										type="text"
										value={extraFields.flight_no}
										onChange={(e) => setExtraField("flight_no", e.target.value)}
									/>
								</div>
							</div>
							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<label>出發地 (DEP)</label>
									<input
										className={styles.input}
										type="text"
										value={extraFields.departure}
										onChange={(e) => setExtraField("departure", e.target.value)}
									/>
								</div>
								<div className={styles.formGroup}>
									<label>目的地 (ARR)</label>
									<input
										className={styles.input}
										type="text"
										value={extraFields.arrival}
										onChange={(e) => setExtraField("arrival", e.target.value)}
									/>
								</div>
							</div>
							<div className={styles.formGroup}>
								<label>地點 (Location)</label>
								<input
									className={styles.input}
									type="text"
									value={extraFields.location}
									onChange={(e) => setExtraField("location", e.target.value)}
								/>
							</div>
						</CollapsibleSection>

						<CollapsibleSection title="事件內容補充 (Event Supplement)">
							<div className={styles.formGroup}>
								<label>潛在後果 (Potential Consequence)</label>
								<textarea
									className={styles.textarea}
									value={extraFields.potential_consequence}
									onChange={(e) => setExtraField("potential_consequence", e.target.value)}
									rows={2}
								/>
							</div>
							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<label>通報人 (Reporter)</label>
									<input
										className={styles.input}
										type="text"
										value={extraFields.reporter_name}
										onChange={(e) => setExtraField("reporter_name", e.target.value)}
									/>
								</div>
								<div className={styles.formGroup}>
									<label>登記日期 (Registered Date)</label>
									<input
										className={styles.input}
										type="date"
										value={extraFields.registered_date}
										onChange={(e) => setExtraField("registered_date", e.target.value)}
									/>
								</div>
							</div>
						</CollapsibleSection>

						<CollapsibleSection title="分類與評估 (Classification & Assessment)">
							<div className={styles.formGroup}>
								<label>OF分類 (Hazard Type)</label>
								<input
									className={styles.input}
									type="text"
									value={hazardType}
									onChange={(e) => setHazardType(e.target.value)}
									placeholder="例如：Passenger、Employee Lapse"
								/>
								<small style={{ color: "#6b7280", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
									來自 AQD 匯入資料的 Hazard Type，與上方 EF分類（本系統自訂分類）為不同欄位
								</small>
							</div>
							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<label>作業分類 (Operational Category)</label>
									<input
										className={styles.input}
										type="text"
										value={extraFields.operational_category}
										onChange={(e) => setExtraField("operational_category", e.target.value)}
									/>
								</div>
								<div className={styles.formGroup}>
									<label>評估代碼 (Assessment Code)</label>
									<input
										className={styles.input}
										type="text"
										value={extraFields.assessment_code}
										onChange={(e) => setExtraField("assessment_code", e.target.value)}
									/>
								</div>
							</div>
							<div className={styles.formRow}>
								<div className={styles.formGroup}>
									<label>風險評估計算 (Risk Assessment Calculations)</label>
									<input
										className={styles.input}
										type="text"
										value={extraFields.risk_assessment_calculation}
										onChange={(e) => setExtraField("risk_assessment_calculation", e.target.value)}
									/>
								</div>
								<div className={styles.formGroup}>
									<label>風險評估 (Risk Assessment)</label>
									<input
										className={styles.input}
										type="text"
										value={extraFields.risk_assessment}
										onChange={(e) => setExtraField("risk_assessment", e.target.value)}
										placeholder="例如：3D"
									/>
								</div>
							</div>
							<div className={styles.formGroup}>
								<label>結案狀態 (Closed)</label>
								<input
									className={styles.input}
									type="text"
									value={extraFields.closed_status}
									onChange={(e) => setExtraField("closed_status", e.target.value)}
									placeholder="例如：CLOSED"
								/>
							</div>
						</CollapsibleSection>
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

// Collapsible group for the optional AQD-sourced fields — same ▼/▶ chevron
// convention already used for row/section expand-collapse elsewhere in
// this app. Local to this file since its only use is grouping form fields.
function CollapsibleSection({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	return (
		<div className={styles.collapsibleSection}>
			<button
				type="button"
				className={styles.collapsibleHeader}
				onClick={() => setOpen((v) => !v)}
			>
				<span className={styles.collapsibleChevron}>{open ? "▼" : "▶"}</span>
				<span>{title}</span>
			</button>
			{open && <div className={styles.collapsibleBody}>{children}</div>}
		</div>
	);
}