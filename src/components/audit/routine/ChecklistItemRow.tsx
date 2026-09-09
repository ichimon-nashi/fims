// src/components/audit/routine/ChecklistItemRow.tsx
"use client";

import { useState } from "react";
import styles from "./ChecklistItemList.module.css";

export type ItemResult = "V" | "X" | "NIL";

interface Props {
	itemNo: number;
	itemText: string;
	ccomRef?: string | null;
	standardText?: string | null; // 檢查標準 — what to actually check for, distinct from the item name
	result: ItemResult | null;
	remark: string;
	flagged?: boolean; // separate from result — "need to come back to this", regardless of what's answered so far
	onChange?: (result: ItemResult | null, remark: string) => void;
	onFlagChange?: (flagged: boolean) => void;
	showError?: boolean; // true after a failed submit attempt with this item unanswered
	readOnly?: boolean; // static display for reviewing an already-submitted form — no buttons, no editing
}

export default function ChecklistItemRow({ itemNo, itemText, ccomRef, standardText, result, remark, flagged, onChange, onFlagChange, showError, readOnly }: Props) {
	// remark box shown if there's already text in it, or once the user
	// explicitly asks for it via "+ 備註" — available regardless of result,
	// not just on X, per the "all choices offer space to type remarks" decision
	const [showRemark, setShowRemark] = useState(Boolean(remark));

	function pick(next: ItemResult) {
		onChange?.(result === next ? null : next, remark);
	}

	if (readOnly) {
		return (
			<div className={styles.row}>
				<div className={styles.itemHeader}>
					<span className={styles.itemNo}>{itemNo}</span>
					<p className={styles.itemText}>{itemText}</p>
					{flagged && <span className={styles.flagBadge}>🚩</span>}
					<span
						className={
							result === "V" ? styles.resultBadgeV : result === "X" ? styles.resultBadgeX : result === "NIL" ? styles.resultBadgeNil : styles.resultBadgeEmpty
						}
					>
						{result ?? "—"}
					</span>
				</div>
				{standardText && <p className={styles.standardText}>檢查標準：{standardText}</p>}
				{ccomRef && <p className={styles.itemRef}>參考文件：{ccomRef}</p>}
				{remark && <p className={styles.readOnlyRemark}>{remark}</p>}
			</div>
		);
	}

	return (
		<div className={showError && !result ? styles.rowError : flagged ? styles.rowFlagged : styles.row}>
			<div className={styles.itemHeader}>
				<span className={styles.itemNo}>{itemNo}</span>
				<p className={styles.itemText}>{itemText}</p>
			</div>
			{standardText && <p className={styles.standardText}>檢查標準：{standardText}</p>}
			{ccomRef && <p className={styles.itemRef}>參考文件：{ccomRef}</p>}
			<div className={styles.controls}>
				<button
					className={result === "V" ? styles.btnVActive : styles.btn}
					onClick={() => pick("V")}
				>
					V
				</button>
				<button
					className={result === "X" ? styles.btnXActive : styles.btn}
					onClick={() => pick("X")}
				>
					X
				</button>
				<button
					className={result === "NIL" ? styles.btnNilActive : styles.btn}
					onClick={() => pick("NIL")}
				>
					NIL
				</button>
				<button
					className={showRemark ? styles.remarkToggleActive : styles.remarkToggle}
					onClick={() => setShowRemark((v) => !v)}
				>
					{remark ? "備註 ✓" : "+ 備註"}
				</button>
				{onFlagChange && (
					<button
						className={flagged ? styles.flagToggleActive : styles.flagToggle}
						onClick={() => onFlagChange(!flagged)}
						title="標記此項目，稍後需要回頭處理"
					>
						🚩
					</button>
				)}
			</div>
			{showRemark && (
				<textarea
					className={styles.remarkInput}
					value={remark}
					onChange={(e) => {
						onChange?.(result, e.target.value);
						e.target.style.height = "auto";
						e.target.style.height = `${e.target.scrollHeight}px`;
					}}
					ref={(el) => {
						if (el) {
							el.style.height = "auto";
							el.style.height = `${el.scrollHeight}px`;
						}
					}}
					rows={2}
				/>
			)}
		</div>
	);
}