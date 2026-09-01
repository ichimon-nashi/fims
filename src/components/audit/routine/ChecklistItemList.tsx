// src/components/audit/routine/ChecklistItemList.tsx
"use client";

import styles from "./ChecklistItemList.module.css";
import ChecklistItemRow, { ItemResult } from "./ChecklistItemRow";

export interface ChecklistItem {
	item_no: number;
	category?: string | null; // absent for monthly focus items — they render flat, no group header
	item_text: string;
	ccom_ref?: string | null;
}

export interface ItemAnswer {
	result: ItemResult | null;
	remark: string;
}

interface Props {
	items: ChecklistItem[];
	answers: Record<number, ItemAnswer>; // keyed by item_no
	onAnswerChange?: (itemNo: number, result: ItemResult | null, remark: string) => void;
	title?: string; // e.g. "一、安全 / 二、服務" or "本月加強重點檢查（2026年8月）"
	showErrors?: boolean; // true after a failed submit attempt — highlights every unanswered item
	readOnly?: boolean;
}

export default function ChecklistItemList({ items, answers, onAnswerChange, title, showErrors, readOnly }: Props) {
	const completed = items.filter((i) => answers[i.item_no]?.result).length;

	// group by category if any item has one; otherwise render as a single flat list
	const hasCategories = items.some((i) => i.category);
	const groups = hasCategories
		? items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
				const key = item.category ?? "";
				(acc[key] ??= []).push(item);
				return acc;
			}, {})
		: { "": items };

	return (
		<div className={styles.section}>
			{title && (
				<div className={styles.sectionHeader}>
					<span className={styles.sectionTitle}>{title}</span>
					<span className={styles.sectionCount}>
						{completed} / {items.length} 已完成
					</span>
				</div>
			)}
			{Object.entries(groups).map(([category, groupItems]) => (
				<div key={category}>
					{category && <p className={styles.categoryLabel}>{category}</p>}
					{groupItems.map((item) => {
						const answer = answers[item.item_no] ?? { result: null, remark: "" };
						return (
							<ChecklistItemRow
								key={item.item_no}
								itemNo={item.item_no}
								itemText={item.item_text}
								ccomRef={item.ccom_ref}
								result={answer.result}
								remark={answer.remark}
								onChange={(result, remark) => onAnswerChange?.(item.item_no, result, remark)}
								showError={showErrors}
								readOnly={readOnly}
							/>
						);
					})}
				</div>
			))}
		</div>
	);
}