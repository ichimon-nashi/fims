// src/components/audit/routine/RoutineEntriesTable.tsx
"use client";

import styles from "./RoutineEntriesTable.module.css";
import { RoutineAuditEntry } from "@/lib/routineAudit.types";
import { isB738 } from "@/utils/routineAuditHelpers";

interface Props {
	entries: RoutineAuditEntry[];
	loading: boolean;
	onEdit: (entry: RoutineAuditEntry) => void;
	onDelete: (entry: RoutineAuditEntry) => void;
	onAddFinding: (entryNo: string) => void; // attach another finding to the same audit
}

export default function RoutineEntriesTable({
	entries,
	loading,
	onEdit,
	onDelete,
	onAddFinding,
}: Props) {
	if (loading) {
		return <p className={styles.status}>載入中...</p>;
	}

	if (entries.length === 0) {
		return <p className={styles.status}>此區間無紀錄</p>;
	}

	return (
		<div className={styles.tableWrap}>
			<table className={styles.table}>
				<thead>
					<tr>
						<th>日期</th>
						<th>編號</th>
						<th>查核員</th>
						<th>機號</th>
						<th>班次</th>
						<th>航段</th>
						<th>記錄</th>
						<th>結果</th>
						<th>SAM分類/代碼</th>
						<th>非飛安相關</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{entries.map((entry) => (
						<tr key={entry.id}>
							<td>{entry.audit_date}</td>
							<td>
								<button
									className={styles.entryNoBtn}
									onClick={() => onAddFinding(entry.entry_no)}
									title="新增此次稽核的其他發現"
								>
									{entry.entry_no}
								</button>
							</td>
							<td>{entry.auditor_name}</td>
							<td className={isB738(entry.aircraft_tail) ? styles.b738 : undefined}>
								{entry.aircraft_tail}
							</td>
							<td>{entry.flight_no}</td>
							<td>{entry.route}</td>
							<td className={styles.findingCell}>{entry.finding}</td>
							<td>{entry.result}</td>
							<td>
								{entry.sam_code
									? `${entry.sam_code.category} / ${entry.sam_code.code}`
									: "-"}
							</td>
							<td>{entry.is_non_flight_safety ? "v" : ""}</td>
							<td className={styles.actions}>
								<button className={styles.iconBtn} onClick={() => onEdit(entry)}>
									編輯
								</button>
								<button
									className={styles.iconBtnDanger}
									onClick={() => onDelete(entry)}
								>
									刪除
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}