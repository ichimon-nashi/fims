// src/components/audit/routine/ChecklistItemList.tsx
"use client";

import { useState } from "react";
import styles from "./ChecklistItemList.module.css";
import ChecklistItemRow, { ItemResult } from "./ChecklistItemRow";

export interface ChecklistItem {
	item_no: number;
	category?: string | null; // absent for monthly focus items — they render flat, no group header
	item_text: string;
	ccom_ref?: string | null;
	standard_text?: string | null; // 檢查標準 — the criteria/guidance describing what to actually look for, distinct from item_text (the item name)
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

	// ── NEW: the whole section is now collapsible via its own header —
	// defaults open. This replaces relying on a separate wrapper
	// component for top-level collapsibility, since this header already
	// shows the title AND the completion count; a second wrapper around
	// it would either duplicate the title or lose the count.
	const [sectionOpen, setSectionOpen] = useState(true);

	// group by category if any item has one; otherwise render as a single flat list
	const hasCategories = items.some((i) => i.category);
	const groups = hasCategories
		? items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
				const key = item.category ?? "";
				(acc[key] ??= []).push(item);
				return acc;
			}, {})
		: { "": items };

	// ── NEW: each category is now its own collapsible mini-section, with
	// its own completion count visible even while collapsed. Defaults
	// open (same visible-by-default experience as before) — collapsing is
	// opt-in per category, not forced. Un-categorized lists (monthly
	// focus items, which have no .category at all) are unaffected: no
	// toggle renders for them, same flat layout as before.
	const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
	function toggleCategory(category: string) {
		setCollapsedCategories((prev) => {
			const next = new Set(prev);
			if (next.has(category)) next.delete(category);
			else next.add(category);
			return next;
		});
	}

	return (
		<div className={styles.section}>
			{title && (
				<button type="button" className={styles.sectionHeader} onClick={() => setSectionOpen((v) => !v)}>
					<span className={styles.sectionHeaderLeft}>
						<span className={styles.sectionChevron}>{sectionOpen ? "▾" : "▸"}</span>
						<span className={styles.sectionTitle}>{title}</span>
					</span>
					<span className={styles.sectionCount}>
						{completed} / {items.length} 已完成
					</span>
				</button>
			)}
			{(!title || sectionOpen) && Object.entries(groups).map(([category, groupItems]) => {
				const categoryCompleted = groupItems.filter((i) => answers[i.item_no]?.result).length;
				const isCollapsed = collapsedCategories.has(category);
				return (
					<div key={category}>
						{category && (
							<button type="button" className={styles.categoryToggle} onClick={() => toggleCategory(category)}>
								<span className={styles.categoryChevron}>{isCollapsed ? "▸" : "▾"}</span>
								<span className={styles.categoryToggleLabel}>{category}</span>
								<span className={styles.categoryToggleCount}>
									{categoryCompleted} / {groupItems.length}
								</span>
							</button>
						)}
						{!isCollapsed &&
							groupItems.map((item, localIndex) => {
								const answer = answers[item.item_no] ?? { result: null, remark: "" };
								// display numbering restarts per category, matching the
								// original paper documents' own native Word list numbering
								// (confirmed: the exported docx already restarts correctly
								// via the template's own formatting) — item_no itself stays
								// global/unique for answer keying and the React key, only the
								// DISPLAYED number changes
								const displayNo = hasCategories ? localIndex + 1 : item.item_no;
								return (
									<ChecklistItemRow
										key={item.item_no}
										itemNo={displayNo}
										itemText={item.item_text}
										ccomRef={item.ccom_ref}
										standardText={item.standard_text}
										result={answer.result}
										remark={answer.remark}
										onChange={(result, remark) => onAnswerChange?.(item.item_no, result, remark)}
										showError={showErrors}
										readOnly={readOnly}
									/>
								);
							})}
					</div>
				);
			})}
		</div>
	);
}