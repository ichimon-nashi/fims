// src/components/sms/TrendRecordsModal.tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./TrendRecordsModal.module.css";

type CodeType = "hfacs" | "ef";
type Source = "srm" | "routine";

interface TrendRecordsModalProps {
	code: string;
	description: string;
	type: CodeType;
	source: Source;
	yearA: number;
	yearB: number;
	onClose: () => void;
}

// Kept in sync with src/lib/hfacsCodeMap.ts's stripLeadingZeros — small
// enough to duplicate client-side rather than reach across the server/
// client boundary for one pure string function. Only used for HFACS
// codes; EF codes already match exactly everywhere, no normalization.
function normalizeHfacsCode(rawCode: string): string {
	const m = rawCode.match(/^([A-Za-z]+?)0*(\d+)$/);
	return m ? `${m[1]}${m[2]}` : rawCode;
}

interface SrmEntryRow {
	id: string;
	number: string;
	file_date: string;
	occurrence_month?: string;
	identification_source_type: "SA" | "SRM";
	hazard_description?: string;
	human_factors_codes?: string[];
	ef_attribute_codes?: string[];
}

interface RoutineEntryRow {
	id: string;
	entry_no: string;
	audit_date: string;
	auditor_name: string;
	aircraft_tail: string;
	finding: string;
	sam_code: string | null;
	ef_code: string | null;
}

export default function TrendRecordsModal({
	code,
	description,
	type,
	source,
	yearA,
	yearB,
	onClose,
}: TrendRecordsModalProps) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [entriesA, setEntriesA] = useState<(SrmEntryRow | RoutineEntryRow)[]>([]);
	const [entriesB, setEntriesB] = useState<(SrmEntryRow | RoutineEntryRow)[]>([]);

	useEffect(() => {
		let cancelled = false;

		async function load() {
			setLoading(true);
			setError(null);
			const token = localStorage.getItem("token");

			try {
				if (source === "srm") {
					// Existing endpoint fetches everything, no filter params —
					// reused as-is, filtering happens here instead of adding a
					// new server-side query path for this one modal.
					const res = await fetch("/api/sms/srm-entries", {
						headers: { Authorization: `Bearer ${token}` },
					});
					if (!res.ok) throw new Error("SRM 記錄載入失敗");
					const all: SrmEntryRow[] = await res.json();

					const matches = all.filter((e) => {
						const codes = type === "hfacs" ? e.human_factors_codes ?? [] : e.ef_attribute_codes ?? [];
						return type === "hfacs"
							? codes.some((c) => normalizeHfacsCode(c) === code)
							: codes.includes(code);
					});

					// occurrence_month is the field actually used for trend
					// bucketing elsewhere in this app; file_date is a fallback
					// in case a given row predates that field being populated.
					const yearOf = (e: SrmEntryRow): number | null => {
						const dateStr = e.occurrence_month || e.file_date;
						return dateStr ? parseInt(String(dateStr).slice(0, 4), 10) : null;
					};

					if (!cancelled) {
						setEntriesA(matches.filter((e) => yearOf(e) === yearA));
						setEntriesB(matches.filter((e) => yearOf(e) === yearB));
					}
				} else {
					// Routine's entries endpoint is already year-scoped — call
					// it once per compared year rather than fetching
					// everything and filtering client-side.
					const [resA, resB] = await Promise.all([
						fetch(
							`/api/audit/routine/entries?${new URLSearchParams({
								year: String(yearA),
								month_from: "1",
								month_to: "12",
							})}`,
							{ headers: { Authorization: `Bearer ${token}` } }
						),
						fetch(
							`/api/audit/routine/entries?${new URLSearchParams({
								year: String(yearB),
								month_from: "1",
								month_to: "12",
							})}`,
							{ headers: { Authorization: `Bearer ${token}` } }
						),
					]);
					if (!resA.ok || !resB.ok) throw new Error("例行性查核記錄載入失敗");
					const dataA = await resA.json();
					const dataB = await resB.json();

					const filterFn = (rows: RoutineEntryRow[]) =>
						rows.filter((r) =>
							type === "hfacs" ? r.sam_code && normalizeHfacsCode(r.sam_code) === code : r.ef_code === code
						);

					if (!cancelled) {
						setEntriesA(filterFn(dataA.records ?? []));
						setEntriesB(filterFn(dataB.records ?? []));
					}
				}
			} catch (e: any) {
				if (!cancelled) setError(e.message || "載入失敗");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		load();
		return () => {
			cancelled = true;
		};
	}, [code, type, source, yearA, yearB]);

	const isSrm = source === "srm";

	function renderEntry(entry: SrmEntryRow | RoutineEntryRow) {
		if (isSrm) {
			const e = entry as SrmEntryRow;
			return (
				<div key={e.id} className={styles.entryCard}>
					<div className={styles.entryHeader}>
						<span className={styles.entryNumber}>{e.number}</span>
						<span className={styles.entryDate}>{e.occurrence_month || e.file_date}</span>
						<span className={styles.entrySourceBadge}>{e.identification_source_type}</span>
					</div>
					<p className={styles.entryText}>{e.hazard_description || "-"}</p>
				</div>
			);
		}
		const e = entry as RoutineEntryRow;
		return (
			<div key={e.id} className={styles.entryCard}>
				<div className={styles.entryHeader}>
					<span className={styles.entryNumber}>{e.entry_no}</span>
					<span className={styles.entryDate}>{e.audit_date}</span>
					<span className={styles.entryMeta}>👤 {e.auditor_name}</span>
					<span className={styles.entryMeta}>{e.aircraft_tail}</span>
				</div>
				<p className={styles.entryText}>{e.finding}</p>
			</div>
		);
	}

	return (
		<div className={styles.modalOverlay}>
			<div className={styles.modal}>
				<div className={styles.modalHeader}>
					<h2>
						{code} <span className={styles.headerDesc}>{description}</span>
					</h2>
					<button type="button" onClick={onClose} className={styles.closeButton}>
						×
					</button>
				</div>

				<div className={styles.modalSubheader}>{isSrm ? "SRM 相關記錄" : "例行性查核相關記錄"}</div>

				<div className={styles.modalBody}>
					{loading ? (
						<div className={styles.status}>載入中...</div>
					) : error ? (
						<div className={styles.status}>{error}</div>
					) : (
						<div className={styles.yearColumns}>
							<div className={styles.yearColumn}>
								<div className={styles.yearColumnHeader}>
									{yearA}年 <span className={styles.yearCount}>({entriesA.length} 筆)</span>
								</div>
								{entriesA.length === 0 ? (
									<p className={styles.status}>本年度無相關記錄</p>
								) : (
									entriesA.map(renderEntry)
								)}
							</div>
							<div className={styles.yearColumn}>
								<div className={styles.yearColumnHeader}>
									{yearB}年 <span className={styles.yearCount}>({entriesB.length} 筆)</span>
								</div>
								{entriesB.length === 0 ? (
									<p className={styles.status}>本年度無相關記錄</p>
								) : (
									entriesB.map(renderEntry)
								)}
							</div>
						</div>
					)}
				</div>

				<div className={styles.modalFooter}>
					<button type="button" onClick={onClose} className={styles.closeFooterButton}>
						關閉
					</button>
				</div>
			</div>
		</div>
	);
}