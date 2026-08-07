// src/components/audit/routine/RoutineSummary.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./RoutineSummary.module.css";
import RoutineFilters from "./RoutineFilters";
import RoutineCategoryChart from "./RoutineCategoryChart";
import RoutineTrendChart from "./RoutineTrendChart";
import RoutineEntriesTable from "./RoutineEntriesTable";
import RoutineEntryModal from "./RoutineEntryModal";
import {
	PieGroupLevel,
	RoutineSummaryResponse,
	RoutineAuditEntry,
	SamCode,
} from "@/lib/routineAudit.types";

const AVAILABLE_YEARS = [2025, 2026]; // TODO: derive from distinct report_year once more years exist
const TREND_COLORS = ["#4a9eff", "#fb923c"];

type ModalState =
	| { open: false }
	| { open: true; mode: "create"; prefillEntryNo: string | null }
	| { open: true; mode: "edit"; entry: RoutineAuditEntry };

export default function RoutineSummary() {
	const [primaryYear, setPrimaryYear] = useState<number>(2026);
	const [compareYear, setCompareYear] = useState<number | null>(null);
	const [monthFrom, setMonthFrom] = useState<number>(1);
	const [monthTo, setMonthTo] = useState<number>(12);
	const [pieLevel, setPieLevel] = useState<PieGroupLevel>("category");

	const [summary, setSummary] = useState<RoutineSummaryResponse | null>(null);
	const [entries, setEntries] = useState<RoutineAuditEntry[]>([]);
	const [samCodes, setSamCodes] = useState<SamCode[]>([]);
	const [loading, setLoading] = useState(true);
	const [entriesLoading, setEntriesLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [modal, setModal] = useState<ModalState>({ open: false });
	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState<{ imported: number; warnings: string[] } | null>(null);
	const [innerTab, setInnerTab] = useState<"charts" | "table">("table");

	const years = useMemo(
		() => (compareYear ? [primaryYear, compareYear] : [primaryYear]),
		[primaryYear, compareYear]
	);

	const fetchSummary = useCallback(() => {
		const token = localStorage.getItem("token");
		if (!token) return;
		setLoading(true);
		setError(null);
		const params = new URLSearchParams({
			years: years.join(","),
			month_from: String(monthFrom),
			month_to: String(monthTo),
		});
		fetch(`/api/audit/routine/summary?${params}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((res) => {
				if (!res.ok) throw new Error("彙整資料載入失敗");
				return res.json();
			})
			.then(setSummary)
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [years, monthFrom, monthTo]);

	const fetchEntries = useCallback(() => {
		const token = localStorage.getItem("token");
		if (!token) return;
		setEntriesLoading(true);
		const params = new URLSearchParams({
			year: String(primaryYear),
			month_from: String(monthFrom),
			month_to: String(monthTo),
		});
		fetch(`/api/audit/routine/entries?${params}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((res) => {
				if (!res.ok) throw new Error("紀錄載入失敗");
				return res.json();
			})
			.then((data) => setEntries(data.records ?? []))
			.catch(() => setEntries([]))
			.finally(() => setEntriesLoading(false));
	}, [primaryYear, monthFrom, monthTo]);

	useEffect(() => {
		const token = localStorage.getItem("token");
		if (!token) return;
		fetch("/api/audit/routine/sam-codes", {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((res) => res.json())
			.then((data) => setSamCodes(data.records ?? []))
			.catch(() => setSamCodes([]));
	}, []);

	useEffect(fetchSummary, [fetchSummary]);
	useEffect(fetchEntries, [fetchEntries]);

	const categoryData = useMemo(() => {
		if (!summary) return [];
		const source =
			(pieLevel === "area" ? summary.byArea : pieLevel === "code" ? summary.byCode : summary.byCategory) ?? {};
		return Object.entries(source).map(([label, byYear]) => ({
			label,
			count: byYear[primaryYear] ?? 0,
		}));
	}, [summary, primaryYear, pieLevel]);

	const trendSeries = useMemo(() => {
		if (!summary) return [];
		return years.map((year, i) => ({
			year,
			color: TREND_COLORS[i],
			values: Array.from({ length: 12 }, (_, m) => summary.byMonth[year]?.[m + 1] ?? 0),
		}));
	}, [summary, years]);

	const totalFindings = categoryData.reduce((sum, c) => sum + c.count, 0);

	function refetchAll() {
		fetchSummary();
		fetchEntries();
	}

	function handleAddEntry() {
		setModal({ open: true, mode: "create", prefillEntryNo: null });
	}

	function handleAddFinding(entryNo: string) {
		setModal({ open: true, mode: "create", prefillEntryNo: entryNo });
	}

	function handleEdit(entry: RoutineAuditEntry) {
		setModal({ open: true, mode: "edit", entry });
	}

	async function handleDelete(entry: RoutineAuditEntry) {
		if (!confirm(`確定刪除此筆紀錄？(${entry.entry_no}, ${entry.finding.slice(0, 20)}...)`)) {
			return;
		}
		const token = localStorage.getItem("token");
		const res = await fetch(`/api/audit/routine/entries/${entry.id}`, {
			method: "DELETE",
			headers: { Authorization: `Bearer ${token}` },
		});
		if (res.ok) {
			refetchAll();
		} else {
			alert("刪除失敗");
		}
	}

	function handleExport() {
		// TODO: export route not built yet
	}

	async function handleImportFile(file: File) {
		setImporting(true);
		setImportResult(null);
		const token = localStorage.getItem("token");
		const formData = new FormData();
		formData.append("file", file);

		try {
			const res = await fetch("/api/audit/routine/import", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "匯入失敗");
			setImportResult({ imported: data.imported, warnings: data.warnings ?? [] });
			refetchAll();
		} catch (err) {
			setImportResult({
				imported: 0,
				warnings: [err instanceof Error ? err.message : "匯入失敗"],
			});
		} finally {
			setImporting(false);
		}
	}

	return (
		<div className={styles.container}>
			<RoutineFilters
				availableYears={AVAILABLE_YEARS}
				primaryYear={primaryYear}
				monthFrom={monthFrom}
				monthTo={monthTo}
				onPrimaryYearChange={setPrimaryYear}
				onMonthFromChange={setMonthFrom}
				onMonthToChange={setMonthTo}
				onExport={handleExport}
				onAddEntry={handleAddEntry}
				onImportFile={handleImportFile}
				importing={importing}
			/>

			{importResult && (
				<div className={styles.importResult}>
					<p>已匯入 {importResult.imported} 筆紀錄</p>
					{importResult.warnings.length > 0 && (
						<ul>
							{importResult.warnings.map((w, i) => (
								<li key={i}>{w}</li>
							))}
						</ul>
					)}
					<button onClick={() => setImportResult(null)}>關閉</button>
				</div>
			)}

			{error && <p className={styles.error}>{error}</p>}
			{loading && <p className={styles.loading}>載入中...</p>}

			{!loading && !error && (
				<>
					<div className={styles.kpiRow}>
						<div className={styles.kpiCard}>
							<p className={styles.kpiLabel}>飛安相關發現</p>
							<p className={styles.kpiValue}>{totalFindings}</p>
						</div>
					</div>

					<div className={styles.innerTabs}>
						<button
							className={innerTab === "table" ? styles.innerTabActive : styles.innerTab}
							onClick={() => setInnerTab("table")}
						>
							紀錄列表
						</button>
						<button
							className={innerTab === "charts" ? styles.innerTabActive : styles.innerTab}
							onClick={() => setInnerTab("charts")}
						>
							圖表
						</button>
					</div>

					{innerTab === "charts" && (
						<div className={styles.chartRow}>
							<RoutineCategoryChart
								data={categoryData}
								year={primaryYear}
								pieLevel={pieLevel}
								onPieLevelChange={setPieLevel}
							/>
							<RoutineTrendChart
								series={trendSeries}
								monthFrom={monthFrom}
								monthTo={monthTo}
								compareYear={compareYear}
								availableYears={AVAILABLE_YEARS}
								primaryYear={primaryYear}
								onCompareYearChange={setCompareYear}
							/>
						</div>
					)}

					{innerTab === "table" && (
						<RoutineEntriesTable
							entries={entries}
							loading={entriesLoading}
							onEdit={handleEdit}
							onDelete={handleDelete}
							onAddFinding={handleAddFinding}
						/>
					)}
				</>
			)}

			<RoutineEntryModal
				open={modal.open}
				mode={modal.open ? modal.mode : "create"}
				editingEntry={modal.open && modal.mode === "edit" ? modal.entry : null}
				prefillEntryNo={modal.open && modal.mode === "create" ? modal.prefillEntryNo : null}
				samCodes={samCodes}
				onClose={() => setModal({ open: false })}
				onSaved={refetchAll}
			/>
		</div>
	);
}