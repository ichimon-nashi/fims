// src/components/audit/routine/RoutineEntriesTable.tsx
"use client";

import { useMemo, useState } from "react";
import styles from "./RoutineEntriesTable.module.css";
import { RoutineAuditEntry } from "@/lib/routineAudit.types";
import { isB738 } from "@/utils/routineAuditHelpers";
import { SAM_CODE_MAP, EF_CODE_MAP } from "@/lib/routineAudit.constants";
import { usePermissions } from "@/hooks/usePermissions"; // ── NEW ──
import { useAuth } from "@/context/AuthContext"; // ── NEW ──

interface Props {
	entries: RoutineAuditEntry[];
	loading: boolean;
	onEdit: (group: RoutineAuditEntry[]) => void; // all findings sharing one entry_no
	onDelete: (group: RoutineAuditEntry[]) => void;
	openSections: Set<string>;
	onToggleSection: (key: string) => void;
	onDefaultSection: (key: string) => void; // called once to seed "latest month open" when openSections is still empty
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
	openSections,
	onToggleSection,
	onDefaultSection,
}: Props) {
	const [search, setSearch] = useState("");
	const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

	// ── NEW ── flag toggle — no longer paired with classify (that feature
	// was removed; SAM/EF codes are now set via 編輯, the existing full-record
	// edit modal, not a separate inline classify control here)
	const permissions = usePermissions();
	const canView = permissions.hasAuditTabAccess("routine"); // broad — anyone who can see this page at all can flag, since it's a communication signal, not a restricted action
	const { token } = useAuth();
	const [flagBusyEntryNo, setFlagBusyEntryNo] = useState<string | null>(null);
	const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<RoutineAuditEntry>>>({});

	async function patchEntry(id: string, patch: Record<string, unknown>) {
		if (!token) return;
		const res = await fetch(`/api/audit/routine/entries/${id}/classify`, {
			method: "PATCH",
			headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
			body: JSON.stringify(patch),
		});
		if (res.ok) {
			setLocalOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
		}
		return res.ok;
	}

	function getFlag(entry: RoutineAuditEntry): boolean {
		return Boolean(localOverrides[entry.id]?.flagged_item ?? (entry as any).flagged_item);
	}

	// flags/unflags every finding sharing one entry_no at once — the flag is
	// stored per finding row, but the concept being communicated is "this
	// whole audit visit needs another look," not "this specific finding" —
	// per-finding granularity was the wrong UX for a broad review signal
	async function toggleGroupFlag(entryNo: string, findings: RoutineAuditEntry[]) {
		const currentlyFlagged = findings.some((f) => getFlag(f));
		const next = !currentlyFlagged;
		setFlagBusyEntryNo(entryNo);
		try {
			await Promise.all(findings.map((f) => patchEntry(f.id, { flagged_item: next })));
			// decoupled event instead of a prop threaded through RoutineSummary.tsx —
			// I don't actually have that file's source (only its CSS module was
			// ever given to me; an earlier message claiming otherwise for a
			// different file was wrong), so this avoids guessing at its structure
			window.dispatchEvent(new Event("routine-flagged-count-changed"));
		} finally {
			setFlagBusyEntryNo(null);
		}
	}
	// ── END NEW ──

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
		let result = groups;
		if (showFlaggedOnly) {
			result = result.filter((g) => g.findings.some((f) => getFlag(f)));
		}
		if (!q) return result;
		return result.filter((g) => {
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
	}, [groups, search, showFlaggedOnly, localOverrides]);

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
			const monthGroups = byMonth.get(key)!;
			const flaggedCount = monthGroups.filter((g) => g.findings.some((f) => getFlag(f))).length;
			return { key, year, month, groups: monthGroups, flaggedCount };
		});
	}, [filteredGroups, localOverrides]);

	// previously auto-opened the latest month on first load — removed per
	// instruction; every month now starts collapsed until the user
	// explicitly clicks a divider (or search/flag-filter force-opens matches)

	if (loading) {
		return <p className={styles.status}>載入中...</p>;
	}

	if (groups.length === 0) {
		return <p className={styles.status}>此區間無紀錄</p>;
	}

	return (
		<div className={styles.cardList}>
			<div className={styles.searchRow}>
				<input
					className={styles.searchInput}
					placeholder="🔍 搜尋編號、日期、查核員、機號、記錄內容..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				<button
					className={showFlaggedOnly ? styles.flagFilterActive : styles.flagFilter}
					onClick={() => setShowFlaggedOnly((v) => !v)}
					title="只顯示待複核項目"
				>
					🚩 待複核
				</button>
			</div>

			{(search.trim() || showFlaggedOnly) && filteredGroups.length === 0 && (
				<p className={styles.status}>查無符合的紀錄</p>
			)}

			{sections.map(({ key, year, month, groups: monthGroups, flaggedCount }) => {
				// searching or filtering by flag force-opens any section with a
				// match, without touching openSections — clearing either
				// reverts to whatever you'd manually expanded/collapsed before
				const isOpen = search.trim() || showFlaggedOnly ? true : openSections.has(key);
				return (
					<div key={key} className={styles.monthSection}>
						<button className={styles.monthDivider} onClick={() => onToggleSection(key)}>
							<span className={styles.monthChevron}>{isOpen ? "▾" : "▸"}</span>
							<span>{year}年{month}月</span>
							<span className={styles.monthDividerCount}>{monthGroups.length}筆</span>
							{flaggedCount > 0 && (
								<span className={styles.monthFlagBadge}>🚩 {flaggedCount}</span>
							)}
						</button>

						{isOpen && (
							<div className={styles.monthCards}>
								{monthGroups.map(({ entryNo, header, findings }) => (
									<div key={entryNo} className={styles.card}>
										<div className={styles.cardHeader}>
											<div className={styles.cardHeaderMain}>
												{findings.some((f) => getFlag(f)) && (
													<span className={styles.flagIndicator}>🚩</span>
												)}
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
												{canView && (
													<button
														className={findings.some((f) => getFlag(f)) ? styles.flagBtnActive : styles.flagBtn}
														disabled={flagBusyEntryNo === entryNo}
														onClick={() => toggleGroupFlag(entryNo, findings)}
														title="標記/取消標記此筆待複核 — 讓其他人知道需要再次確認"
													>
														🚩
													</button>
												)}
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