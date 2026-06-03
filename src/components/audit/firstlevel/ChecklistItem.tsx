// src/components/audit/firstlevel/ChecklistItem.tsx
"use client";

import { useState } from "react";
import styles from "./firstlevel.module.css";
import {
	ChecklistItem as ChecklistItemType,
	ItemResponse,
	ResultType,
	FindingType,
	RESULT_LABELS,
	FINDING_TYPE_LABELS,
} from "./checklistData";

interface Props {
	item: ChecklistItemType;
	response: ItemResponse;
	onChange: (code: string, updated: ItemResponse) => void;
	readonly?: boolean;
}

export default function ChecklistItem({
	item,
	response,
	onChange,
	readonly,
}: Props) {
	const [showExtra, setShowExtra] = useState(
		!!(response.evidence || response.comment || response.car_number),
	);

	function setResult(result: ResultType) {
		if (readonly) return;
		onChange(item.code, {
			...response,
			result,
			// Clear finding-specific fields when switching away from finding
			finding_type: result === "finding" ? response.finding_type : null,
			car_number: result === "finding" ? response.car_number : "",
		});
		if (!showExtra && result && result !== "na") setShowExtra(true);
	}

	function setFindingType(finding_type: FindingType) {
		if (readonly) return;
		onChange(item.code, { ...response, finding_type });
	}

	function setField(field: keyof ItemResponse, value: string) {
		if (readonly) return;
		onChange(item.code, { ...response, [field]: value });
	}

	const resultKeys = ["conformity", "finding", "observation", "na"] as const;

	return (
		<div className={styles.itemRow}>
			<div className={styles.itemTop}>
				<span className={styles.itemCode}>{item.code}</span>
				<div className={styles.itemTitles}>
					<div className={styles.itemZh}>{item.zhTitle}</div>
					<div className={styles.itemEn}>{item.enTitle}</div>
					{item.isarp && item.isarp !== "N/A" && (
						<div className={styles.itemIsarp}>
							ISARP: {item.isarp}
						</div>
					)}
				</div>
			</div>

			{item.subItems && item.subItems.length > 0 && (
				<div className={styles.subItems}>
					{item.subItems.map((s, i) => (
						<div key={i} className={styles.subItem}>
							{s.label}
						</div>
					))}
				</div>
			)}

			{/* Result selector */}
			<div className={styles.resultRow}>
				{resultKeys.map((key) => {
					const isActive = response.result === key;
					const activeClass =
						key === "conformity"
							? styles.resultBtnConformity
							: key === "finding"
								? styles.resultBtnFinding
								: key === "observation"
									? styles.resultBtnObservation
									: styles.resultBtnNa;
					return (
						<button
							key={key}
							className={`${styles.resultBtn} ${activeClass} ${isActive ? styles.resultBtnActive : ""}`}
							onClick={() => setResult(isActive ? null : key)}
							disabled={readonly}
						>
							{RESULT_LABELS[key].zh} {RESULT_LABELS[key].en}
						</button>
					);
				})}
			</div>

			{/* Finding sub-type — only when finding selected */}
			{response.result === "finding" && !readonly && (
				<div className={styles.findingTypeRow}>
					<div className={styles.findingTypeLabel}>
						缺失類型 Finding Type
					</div>
					{(Object.keys(FINDING_TYPE_LABELS) as FindingType[])
						.filter(Boolean)
						.map((ft) => (
							<button
								key={ft!}
								className={`${styles.findingTypeBtn} ${response.finding_type === ft ? styles.findingTypeBtnActive : ""}`}
								onClick={() =>
									setFindingType(
										response.finding_type === ft
											? null
											: ft,
									)
								}
							>
								{FINDING_TYPE_LABELS[ft!]}
							</button>
						))}
				</div>
			)}
			{response.result === "finding" &&
				readonly &&
				response.finding_type && (
					<div className={styles.findingTypeRow}>
						<div className={styles.findingTypeLabel}>
							缺失類型 Finding Type
						</div>
						<span
							className={styles.findingTypeBtn}
							style={{ color: "#ef4444" }}
						>
							{FINDING_TYPE_LABELS[response.finding_type]}
						</span>
					</div>
				)}

			{/* CAR number — required for finding */}
			{response.result === "finding" && (
				<div className={styles.carRow}>
					<span className={styles.carLabel}>CAR #</span>
					<input
						className={styles.carInput}
						placeholder="CAR-XXXX"
						value={response.car_number}
						onChange={(e) => setField("car_number", e.target.value)}
						disabled={readonly}
					/>
				</div>
			)}

			{/* Evidence + comments — toggled */}
			{!readonly && response.result && response.result !== "na" && (
				<div style={{ marginBottom: "0.5rem" }}>
					<button
						style={{
							background: "none",
							border: "none",
							color: "#4a9eff",
							fontSize: "0.8rem",
							cursor: "pointer",
							padding: 0,
							fontFamily: "inherit",
						}}
						onClick={() => setShowExtra((v) => !v)}
					>
						{showExtra ? "▲ 收起" : "▼ 展開備註/佐證"}
					</button>
				</div>
			)}

			{(showExtra || readonly) &&
				((response.result && response.result !== "na") || readonly) && (
					<div className={styles.extraFields}>
						<div className={styles.textareaWrap}>
							<span className={styles.textareaLabel}>
								佐證文件 Evidence
							</span>
							<textarea
								className={styles.textarea}
								rows={2}
								placeholder="文件名稱、版本、日期..."
								value={response.evidence}
								onChange={(e) =>
									setField("evidence", e.target.value)
								}
								disabled={readonly}
							/>
						</div>
						<div className={styles.textareaWrap}>
							<span className={styles.textareaLabel}>
								備註 Auditor Comments
							</span>
							<textarea
								className={styles.textarea}
								rows={2}
								placeholder="查核員備註..."
								value={response.comment}
								onChange={(e) =>
									setField("comment", e.target.value)
								}
								disabled={readonly}
							/>
						</div>
					</div>
				)}
		</div>
	);
}
