// src/components/audit/routine/RoutineEntriesTable.tsx
"use client";

import { useMemo, useState } from "react";
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
	const resolved = code ? SAM_CODE_MAP[code] : undefined;
	return resolved ? `${resolved.category} / ${code}` : code ?? ""; // unresolvable code still shows the raw code, never "undefined"
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
	const [search, setSearch] = useState("");

	// group by entry_no — one audit visit, multiple findings, shown as one
	// card instead of N indistinguishable rows. Sort primarily by
	// audit_date (chronological), then by entry_no as a tiebreak when dates
	// match — GA sorts before SA naturally (G < S), matching the real
	// convention where a same-day 加強查核 (GA) is listed ahead of a
	// routine (SA) entry.
	const groups = useMemo(() => {
		const map = new Map<string, RoutineAuditEntry[]>();
		for (const e of entries) {
			if (!map.has(e.entry_no)) map.set(e.entry_no, []);
			map.get(e.entry_no)!.push(e);
		}
		return Array.from(map.entries())
			.map(([entryNo, rows]) => {
				const sortedRows = rows.sort((a, b) => a.finding_seq - b.finding_seq);
				return { entryNo, header: sortedRows[0], findings: sortedRows };
			})
			.sort((a, b) => {
				const dateCompare = a.header.audit_date.localeCompare(b.header.audit_date);
				if (dateCompare !== 0) return dateCompare;
				return a.entryNo.localeCompare(b.entryNo);
			});
	}, [entries]);

	// matches against everything someone would plausibly search by —
	// entry_no, date, auditor, tail, flight/route, and every finding's own
	// text, SAM/EF labels
	const filteredGroups = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return groups;
		return groups.filter((g) => {
			const headerText = [
				g.entryNo,
				g.header.audit_date,
				g.header.auditor_name,
				g.header.aircraft_tail,
				g.header.flight_no ?? "",
				g.header.route ?? "",
				g.header.special_remarks.join(" "),
			]
				.join(" ")
				.toLowerCase();
			if (headerText.includes(q)) return true;
			return g.findings.some((f) => {
				const findingText = [f.finding, f.corrective_action ?? "", samLabel(f.sam_code), efLabel(f.ef_code) ?? ""]
					.join(" ")
					.toLowerCase();
				return findingText.includes(q);
			});
		});
	}, [groups, search]);

	// bucket into month sections for the accordion
	const sections = useMemo(() => {
		const order: string[] = [];
		const byMonth = new Map<string, typeof filteredGroups>();
		for (const g of filteredGroups) {
			const key = `${g.header.report_year}-${g.header.report_month}`;
			if (!byMonth.has(key)) {
				order.push(key);
				byMonth.set(key, []);
			}
			byMonth.get(key)!.push(g);
		}
		return order.map((key) => {
			const [year, month] = key.split("-").map(Number);
			return { key, year, month, groups: byMonth.get(key)! };
		});
	}, [filteredGroups]);

	// only the most recent month starts expanded — everything else is
	// collapsed by default so reaching an older month is one click instead
	// of a long scroll
	const [openSections, setOpenSections] = useState<Set<string>>(
		() => new Set(sections.length ? [sections[sections.length - 1].key] : [])
	);

	function toggleSection(key: string) {
		setOpenSections((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	if (loading) {
		return <p className={styles.status}>載入中...</p>;
	}

	if (groups.length === 0) {
		return <p className={styles.status}>此區間無紀錄</p>;
	}

	return (
		<div className={styles.cardList}>
			<input
				className={styles.searchInput}
				placeholder="🔍 搜尋編號、日期、查核員、機號、記錄內容..."
				value={search}
				onChange={(e) => setSearch(e.target.value)}
			/>

			{search.trim() && filteredGroups.length === 0 && (
				<p className={styles.status}>查無符合的紀錄</p>
			)}

			{sections.map(({ key, year, month, groups: monthGroups }) => {
				// searching force-opens any section with a match, without
				// touching openSections — clearing the search reverts to
				// whatever you'd manually expanded/collapsed before
				const isOpen = search.trim() ? true : openSections.has(key);
				return (
					<div key={key} className={styles.monthSection}>
						<button className={styles.monthDivider} onClick={() => toggleSection(key)}>
							<span className={styles.monthChevron}>{isOpen ? "▾" : "▸"}</span>
							<span>{year}年{month}月</span>
							<span className={styles.monthDividerCount}>{monthGroups.length}筆</span>
						</button>

						{isOpen && (
							<div className={styles.monthCards}>
								{monthGroups.map(({ entryNo, header, findings }) => (
									<div key={entryNo} className={styles.card}>
										<div className={styles.cardHeader}>
											<div className={styles.cardHeaderMain}>
												<span className={entryNo.startsWith("GA") ? styles.entryNoGA : styles.entryNo}>{entryNo}</span>
												<span className={styles.headerDate}>{header.audit_date}</span>
												<span className={styles.auditorBadge}>👤 {header.auditor_name}</span>
												<span className={isB738(header.aircraft_tail) ? styles.b738Badge : styles.tailBadge}>
													{header.aircraft_tail}
												</span>
												{header.flight_no && (
													<span className={styles.flightBadge}>✈ {header.flight_no}</span>
												)}
												{header.route && (
													<span className={styles.routeBadge}>{header.route}</span>
												)}
												{header.special_remarks.map((remark) => (
													<span key={remark} className={styles.specialBadge}>{remark}</span>
												))}
											</div>
											<div className={styles.cardHeaderActions}>
												<button className={styles.iconBtn} onClick={() => onEdit(findings)}>編輯</button>
												<button className={styles.iconBtnDanger} onClick={() => onDelete(findings)}>刪除</button>
											</div>
										</div>

										<div className={styles.findingList}>
											{findings.map((entry) => {
												const ef = efLabel(entry.ef_code);
												const sam = samLabel(entry.sam_code);
												return (
													<div key={entry.id} className={styles.findingRow}>
														<div className={styles.findingSeq}>{entry.finding_seq}</div>
														<div className={styles.findingBody}>
															<p className={styles.findingText}>{entry.finding}</p>
															{entry.corrective_action && (
																<p className={styles.correctiveText}>處置：{entry.corrective_action}</p>
															)}
															{(sam || ef || entry.is_non_flight_safety) && (
																<div className={styles.findingTags}>
																	{sam && <span className={styles.samTag}>{sam}</span>}
																	{ef && <span className={styles.efTag}>{ef}</span>}
																	{entry.is_non_flight_safety && (
																		<span className={styles.nonSafetyTag}>非安全相關</span>
																	)}
																</div>
															)}
														</div>
													</div>
												);
											})}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}