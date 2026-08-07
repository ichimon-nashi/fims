// src/components/audit/routine/RoutineEntriesTable.tsx
"use client";

import { useMemo } from "react";
import styles from "./RoutineEntriesTable.module.css";
import { RoutineAuditEntry } from "@/lib/routineAudit.types";
import { isB738 } from "@/utils/routineAuditHelpers";
import { SAM_CODE_MAP, EF_CODE_MAP } from "@/lib/routineAudit.constants";

interface Props {
	entries: RoutineAuditEntry[];
	loading: boolean;
	onEdit: (group: RoutineAuditEntry[]) => void; // all findings sharing one entry_no
	onDelete: (group: RoutineAuditEntry[]) => void;
}

function samLabel(code: string | null): string {
	if (!code) return "-";
	const resolved = SAM_CODE_MAP[code];
	return resolved ? `${resolved.category} / ${code}` : code; // unresolvable code still shows the raw code, never "undefined"
}

function efLabel(code: string | null): string | null {
	if (!code) return null;
	const resolved = EF_CODE_MAP[code];
	return resolved ? `${resolved.attributeName} / ${code}` : code;
}

export default function RoutineEntriesTable({
	entries,
	loading,
	onEdit,
	onDelete,
}: Props) {
	// group by entry_no, preserving first-seen order — one audit visit,
	// multiple findings, shown as one card instead of N indistinguishable rows
	const groups = useMemo(() => {
		const order: string[] = [];
		const map = new Map<string, RoutineAuditEntry[]>();
		for (const e of entries) {
			if (!map.has(e.entry_no)) {
				order.push(e.entry_no);
				map.set(e.entry_no, []);
			}
			map.get(e.entry_no)!.push(e);
		}
		return order.map((entryNo) => {
			const rows = map.get(entryNo)!.sort((a, b) => a.finding_seq - b.finding_seq);
			return { entryNo, header: rows[0], findings: rows };
		});
	}, [entries]);

	if (loading) {
		return <p className={styles.status}>載入中...</p>;
	}

	if (groups.length === 0) {
		return <p className={styles.status}>此區間無紀錄</p>;
	}

	return (
		<div className={styles.cardList}>
			{groups.map(({ entryNo, header, findings }) => (
				<div key={entryNo} className={styles.card}>
					<div className={styles.cardHeader}>
						<div className={styles.cardHeaderMain}>
							<span className={styles.entryNo}>{entryNo}</span>
							<span className={styles.headerDate}>{header.audit_date}</span>
							<span>{header.auditor_name}</span>
							<span className={isB738(header.aircraft_tail) ? styles.b738Badge : styles.tailBadge}>
								{header.aircraft_tail}
							</span>
							{header.flight_no && <span className={styles.headerMeta}>{header.flight_no}</span>}
							{header.route && <span className={styles.headerMeta}>{header.route}</span>}
						</div>
						<div className={styles.cardHeaderActions}>
							<button className={styles.iconBtn} onClick={() => onEdit(findings)}>編輯</button>
							<button className={styles.iconBtnDanger} onClick={() => onDelete(findings)}>刪除</button>
						</div>
					</div>

					<div className={styles.findingList}>
						{findings.map((entry) => {
							const ef = efLabel(entry.ef_code);
							return (
								<div key={entry.id} className={styles.findingRow}>
									<div className={styles.findingSeq}>{entry.finding_seq}</div>
									<div className={styles.findingBody}>
										<p className={styles.findingText}>{entry.finding}</p>
										{entry.corrective_action && (
											<p className={styles.correctiveText}>處置：{entry.corrective_action}</p>
										)}
										<div className={styles.findingTags}>
											<span className={styles.samTag}>{samLabel(entry.sam_code)}</span>
											{ef && <span className={styles.efTag}>{ef}</span>}
											{entry.is_non_flight_safety && (
												<span className={styles.nonSafetyTag}>非安全相關</span>
											)}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			))}
		</div>
	);
}