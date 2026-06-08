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

	function toggleFlag() {
		if (readonly) return;
		onChange(item.code, { ...response, flagged: !response.flagged });
	}

	// Result indicator color for item row border
	const resultColor =
		response.result === "conformity"
			? "#22c55e"
			: response.result === "finding"
				? "#ef4444"
				: response.result === "na"
					? "#475569"
					: null;

	const resultKeys: ResultType[] = ["conformity", "finding", "na"];

	return (
		<div
			className={styles.itemRow}
			style={
				resultColor
					? { borderLeft: `3px solid ${resultColor}` }
					: { borderLeft: "3px solid transparent" }
			}
		>
			<div className={styles.itemTop}>
				<span className={styles.itemCode}>{item.code}</span>
				<div className={styles.itemTitles}>
					<div className={styles.itemZh}>{item.zhTitle}</div>
					<div className={styles.itemEn}>{item.enTitle}</div>
					{item.isarp && item.isarp !== "N/A" && (
						<div className={styles.itemIsarp}>
							依據: {item.isarp}
						</div>
					)}
				</div>
				{!readonly && (
					<button
						className={`${styles.flagBtn} ${response.flagged ? styles.flagBtnActive : ""}`}
						onClick={toggleFlag}
						title={response.flagged ? "取消標記" : "標記討論"}
					>
						🚩
					</button>
				)}
				{readonly && response.flagged && (
					<span
						className={styles.flagBtnActive}
						style={{ fontSize: "1rem" }}
					>
						🚩
					</span>
				)}
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

			{/* Result selector — conformity / finding / N/A only */}
			<div className={styles.resultRow}>
				{resultKeys.map((key) => {
					if (!key) return null;
					const isActive = response.result === key;
					const activeClass =
						key === "conformity"
							? styles.resultBtnConformity
							: key === "finding"
								? styles.resultBtnFinding
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

			{/* Finding sub-type */}
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
						<div className={styles.findingTypeLabel}>缺失類型</div>
						<span
							style={{ color: "#ef4444", fontSize: "0.8125rem" }}
						>
							{FINDING_TYPE_LABELS[response.finding_type]}
						</span>
					</div>
				)}

			{/* CAR number */}
			{response.result === "finding" && (
				<div className={styles.carRow}>
					<span className={styles.carLabel}>CAR #</span>
					<input
						className={styles.carInput}
						placeholder="2026TZ-01-01"
						value={response.car_number}
						onChange={(e) => setField("car_number", e.target.value)}
						disabled={readonly}
					/>
				</div>
			)}

			{/* Toggle for evidence + comments */}
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
						{showExtra ? "▲ 縮小" : "▼ 展開"}
					</button>
				</div>
			)}

			{(showExtra || readonly) &&
				response.result &&
				response.result !== "na" && (
					<div className={styles.extraFields}>
						<div className={styles.textareaWrap}>
							<span className={styles.textareaLabel}>
								文件 Documentation
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
