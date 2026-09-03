// src/components/audit/routine/RoutineSummary.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./RoutineSummary.module.css";
import {
	RoutineSamChart,
	RoutineEfChart,
	RoutineTrendChart,
	RoutineSamCompareChart,
	RoutineEfCompareChart,
	RoutineSamCategoryComparePies,
	RoutineEfCategoryComparePies,
} from "./RoutineCharts";
import RoutineEntriesTable from "./RoutineEntriesTable";
import RoutineEntryModal from "./RoutineEntryModal";
import TrendRecordsModal from "../../sms/TrendRecordsModal";
import { SAM_CODE_MAP, EF_CODE_MAP } from "@/lib/routineAudit.constants";
import {
	PieGroupLevel,
	RoutineSummaryResponse,
	RoutineAuditEntry,
} from "@/lib/routineAudit.types";

const AVAILABLE_YEARS = [2025, 2026]; // TODO: derive from distinct report_year once more years exist
const TREND_COLORS = ["#4a9eff", "#fb923c"];
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

// ── NEW: independent per-side period, replacing primaryYear/compareYear +
// one shared monthFrom/monthTo. Matches StatisticsTab.tsx's ComparePeriod
// pattern exactly (year, startMonth, endMonth per side).
interface Period {
	year: number;
	startMonth: number;
	endMonth: number;
}

function periodLabel(p: Period): string {
	return p.startMonth === 1 && p.endMonth === 12 ? `${p.year}年` : `${p.year}年${p.startMonth}-${p.endMonth}月`;
}

// year*12+month gives a single monotonic index for ordering two periods —
// same technique StatisticsTab.tsx uses for its start/end swap-correction
function periodIndex(p: Period): number {
	return p.year * 12 + p.startMonth;
}

type ModalState =
	| { open: false }
	| { open: true; mode: "create" }
	| { open: true; mode: "edit"; entries: RoutineAuditEntry[] };

export default function RoutineSummary() {
	const [periodA, setPeriodA] = useState<Period>({ year: 2026, startMonth: 1, endMonth: 12 });
	const [periodB, setPeriodB] = useState<Period | null>(null);
	const [comparePicking, setComparePicking] = useState(false);
	const [pieLevel, setPieLevel] = useState<PieGroupLevel>("category");
	// local 3-way toggle: bar | pie | radar — pie is new (item comparison
	// view), bar/radar map straight through to the existing ChartStyle type
	// when calling RoutineSamCompareChart/RoutineEfCompareChart
	const [chartMode, setChartMode] = useState<"bar" | "pie" | "radar">("bar");

	const [compareCode, setCompareCode] = useState<"sam" | "ef">("sam");
	// which bar row's records modal is open, if any
	const [recordsModal, setRecordsModal] = useState<{ label: string; type: "sam" | "ef" } | null>(null);

	const [summaryA, setSummaryA] = useState<RoutineSummaryResponse | null>(null);
	const [summaryB, setSummaryB] = useState<RoutineSummaryResponse | null>(null);
	const [entries, setEntries] = useState<RoutineAuditEntry[]>([]);
	const [compareEntries, setCompareEntries] = useState<RoutineAuditEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [entriesLoading, setEntriesLoading] = useState(true);
	const [compareEntriesLoading, setCompareEntriesLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [modal, setModal] = useState<ModalState>({ open: false });
	const [importing, setImporting] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [importResult, setImportResult] = useState<{ imported: number; warnings: string[] } | null>(null);
	const [openSectionsMap, setOpenSectionsMap] = useState<Record<string, Set<string>>>({});

	function getOpenSections(id: string): Set<string> {
		return openSectionsMap[id] ?? new Set();
	}
	function handleToggleSection(id: string, key: string) {
		setOpenSectionsMap((prev) => {
			const current = new Set(prev[id] ?? []);
			if (current.has(key)) current.delete(key);
			else current.add(key);
			return { ...prev, [id]: current };
		});
	}
	function handleDefaultSection(id: string, key: string) {
		setOpenSectionsMap((prev) => {
			if (prev[id] && prev[id].size > 0) return prev; // already seeded — never override a real selection
			return { ...prev, [id]: new Set([key]) };
		});
	}
	const [innerTab, setInnerTab] = useState<"charts" | "table">("table");
	const fileInputRef = useRef<HTMLInputElement>(null);

	// code -> description lookups for the code-level bar charts — built
	// once, not per-render, since SAM_CODE_MAP/EF_CODE_MAP are static
	const samCodeDescriptions = useMemo(
		() => Object.fromEntries(Object.entries(SAM_CODE_MAP).map(([code, r]) => [code, r.description_zh])),
		[]
	);
	const efCodeDescriptions = useMemo(
		() => Object.fromEntries(Object.entries(EF_CODE_MAP).map(([code, r]) => [code, r.description])),
		[]
	);

	// ── NEW: single-period fetch, called once for periodA and once more
	// for periodB when comparing — mirrors StatisticsTab.tsx's
	// loadCompareData calling its single-period endpoint twice rather
	// than one combined multi-range request.
	const fetchSummaryFor = useCallback((p: Period, setter: (r: RoutineSummaryResponse | null) => void) => {
		const token = localStorage.getItem("token");
		if (!token) return;
		const params = new URLSearchParams({
			year: String(p.year),
			month_from: String(p.startMonth),
			month_to: String(p.endMonth),
		});
		return fetch(`/api/audit/routine/summary?${params}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((res) => {
				if (!res.ok) throw new Error("彙整資料載入失敗");
				return res.json();
			})
			.then(setter);
	}, []);

	const fetchSummary = useCallback(() => {
		setLoading(true);
		setError(null);
		const calls = [fetchSummaryFor(periodA, setSummaryA)];
		if (periodB) calls.push(fetchSummaryFor(periodB, setSummaryB));
		else setSummaryB(null);
		Promise.all(calls)
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [periodA, periodB, fetchSummaryFor]);

	const fetchEntriesFor = useCallback(
		(p: Period, setter: (rows: RoutineAuditEntry[]) => void, setLoadingFn: (v: boolean) => void) => {
			const token = localStorage.getItem("token");
			if (!token) return;
			setLoadingFn(true);
			const params = new URLSearchParams({
				year: String(p.year),
				month_from: String(p.startMonth),
				month_to: String(p.endMonth),
			});
			fetch(`/api/audit/routine/entries?${params}`, {
				headers: { Authorization: `Bearer ${token}` },
			})
				.then((res) => {
					if (!res.ok) throw new Error("紀錄載入失敗");
					return res.json();
				})
				.then((data) => setter(data.records ?? []))
				.catch(() => setter([]))
				.finally(() => setLoadingFn(false));
		},
		[]
	);

	const fetchEntries = useCallback(
		() => fetchEntriesFor(periodA, setEntries, setEntriesLoading),
		[fetchEntriesFor, periodA]
	);

	useEffect(fetchSummary, [fetchSummary]);

	// auto-correct the filter bar itself, not just the computed display
	// order — the moment periodB is chronologically earlier than periodA,
	// swap them so the dropdowns visually reflect the correct order too.
	// Safe to do unconditionally: after one swap the invariant (A <= B)
	// holds, so this effect's own condition goes false and it doesn't
	// re-trigger — no loop risk.
	useEffect(() => {
		if (periodB && periodIndex(periodB) < periodIndex(periodA)) {
			setPeriodA(periodB);
			setPeriodB(periodA);
		}
	}, [periodA, periodB]);
	useEffect(fetchEntries, [fetchEntries]);

	// comparison period gets its own entries fetch, with its OWN month
	// range — this was the actual bug being fixed: previously both sides
	// shared one monthFrom/monthTo, so a comparison could never use
	// different windows per side
	useEffect(() => {
		if (periodB === null) {
			setCompareEntries([]);
			return;
		}
		fetchEntriesFor(periodB, setCompareEntries, setCompareEntriesLoading);
	}, [periodB, fetchEntriesFor]);

	// ── FIX: charts must always compare earlier-period-first, regardless
	// of which one the user happened to set as "primary" (periodA) vs
	// "comparison" (periodB) in the filter bar. Without this, picking
	// 2026 as periodA and adding 2025 as periodB would compute deltas as
	// "2025 minus 2026" — backwards relative to actual time, so a real
	// improvement over time could show as a red "worse" arrow. The filter
	// bar's own controls stay bound to raw periodA/periodB (unswapped) so
	// editing them doesn't jump between fields mid-interaction — only the
	// derived values below, used for display/calculation, get reordered.
	const swapped = periodB !== null && periodIndex(periodB) < periodIndex(periodA);
	const chronoPeriodA = swapped ? periodB! : periodA;
	const chronoPeriodB = swapped ? periodA : periodB;
	const chronoSummaryA = swapped ? summaryB : summaryA;
	const chronoSummaryB = swapped ? summaryA : summaryB;
	const chronoEntriesA = swapped ? compareEntries : entries;
	const chronoEntriesB = swapped ? entries : compareEntries;
	const chronoEntriesALoading = swapped ? compareEntriesLoading : entriesLoading;
	const chronoEntriesBLoading = swapped ? entriesLoading : compareEntriesLoading;

	// ── single-period chart data — flat Record<label, count> now, no
	// year-keying needed since summaryA/summaryB are each already scoped
	// to one period
	const categoryData = useMemo(() => {
		if (!chronoSummaryA) return [];
		const source = (pieLevel === "code" ? chronoSummaryA.byCode : chronoSummaryA.byCategory) ?? {};
		return Object.entries(source).map(([label, count]) => ({ label, count }));
	}, [chronoSummaryA, pieLevel]);

	const efCodeData = useMemo(() => {
		if (!chronoSummaryA) return [];
		const source = (pieLevel === "code" ? chronoSummaryA.byEfCode : chronoSummaryA.byEfMiddle) ?? {};
		return Object.entries(source).map(([label, count]) => ({ label, count }));
	}, [chronoSummaryA, pieLevel]);

	// ── NEW: periodB's own single-period data, for the twin-pie
	// comparison view (which needs two separate CountItem[] arrays, not
	// the combined CompareItem[] shape categoryCompareData/efCompareData
	// build for the bar/radar charts below)
	const categoryDataB = useMemo(() => {
		if (!chronoSummaryB) return [];
		const source = (pieLevel === "code" ? chronoSummaryB.byCode : chronoSummaryB.byCategory) ?? {};
		return Object.entries(source).map(([label, count]) => ({ label, count }));
	}, [chronoSummaryB, pieLevel]);

	const efCodeDataB = useMemo(() => {
		if (!chronoSummaryB) return [];
		const source = (pieLevel === "code" ? chronoSummaryB.byEfCode : chronoSummaryB.byEfMiddle) ?? {};
		return Object.entries(source).map(([label, count]) => ({ label, count }));
	}, [chronoSummaryB, pieLevel]);

	// ── comparison data — combines the two independent single-period
	// responses into the CompareItem[] shape RoutineCharts expects.
	const categoryCompareData = useMemo(() => {
		if (!chronoSummaryA || !chronoSummaryB) return [];
		const sourceA = (pieLevel === "code" ? chronoSummaryA.byCode : chronoSummaryA.byArea) ?? {};
		const sourceB = (pieLevel === "code" ? chronoSummaryB.byCode : chronoSummaryB.byArea) ?? {};
		const labels = new Set([...Object.keys(sourceA), ...Object.keys(sourceB)]);
		return Array.from(labels).map((label) => ({
			label,
			values: [sourceA[label] ?? 0, sourceB[label] ?? 0],
		}));
	}, [chronoSummaryA, chronoSummaryB, pieLevel]);

	const efCompareData = useMemo(() => {
		if (!chronoSummaryA || !chronoSummaryB) return [];
		const sourceA = (pieLevel === "code" ? chronoSummaryA.byEfCode : chronoSummaryA.byEfMiddle) ?? {};
		const sourceB = (pieLevel === "code" ? chronoSummaryB.byEfCode : chronoSummaryB.byEfMiddle) ?? {};
		const labels = new Set([...Object.keys(sourceA), ...Object.keys(sourceB)]);
		return Array.from(labels).map((label) => ({
			label,
			values: [sourceA[label] ?? 0, sourceB[label] ?? 0],
		}));
	}, [chronoSummaryA, chronoSummaryB, pieLevel]);

	// trend chart's x-axis window is the UNION of both periods' month
	// ranges, so a comparison between differently-sized windows still
	// shows every relevant month on one axis
	const trendWindow = useMemo(() => {
		const starts = [chronoPeriodA.startMonth, ...(chronoPeriodB ? [chronoPeriodB.startMonth] : [])];
		const ends = [chronoPeriodA.endMonth, ...(chronoPeriodB ? [chronoPeriodB.endMonth] : [])];
		return { from: Math.min(...starts), to: Math.max(...ends) };
	}, [chronoPeriodA, chronoPeriodB]);

	const trendSeries = useMemo(() => {
		if (!chronoSummaryA) return [];
		const series = [
			{
				label: periodLabel(chronoPeriodA),
				color: TREND_COLORS[0],
				values: Array.from({ length: 12 }, (_, m) => chronoSummaryA.byMonth[m + 1] ?? 0),
			},
		];
		if (chronoPeriodB && chronoSummaryB) {
			series.push({
				label: periodLabel(chronoPeriodB!),
				color: TREND_COLORS[1],
				values: Array.from({ length: 12 }, (_, m) => chronoSummaryB.byMonth[m + 1] ?? 0),
			});
		}
		return series;
	}, [chronoSummaryA, chronoSummaryB, chronoPeriodA, chronoPeriodB]);

	const totalFindings = categoryData.reduce((sum, c) => sum + c.count, 0);

	function refetchAll() {
		fetchSummary();
		fetchEntries();
		if (periodB !== null) fetchEntriesFor(periodB, setCompareEntries, setCompareEntriesLoading);
	}

	function handleAddEntry() {
		setModal({ open: true, mode: "create" });
	}
	function handleEdit(group: RoutineAuditEntry[]) {
		setModal({ open: true, mode: "edit", entries: group });
	}

	async function handleDelete(group: RoutineAuditEntry[]) {
		const label = group.length > 1 ? `此稽核的全部 ${group.length} 項發現` : "此筆紀錄";
		if (!confirm(`確定刪除${label}？(${group[0].entry_no})`)) return;
		const token = localStorage.getItem("token");
		const results = await Promise.all(
			group.map((entry) =>
				fetch(`/api/audit/routine/entries/${entry.id}`, {
					method: "DELETE",
					headers: { Authorization: `Bearer ${token}` },
				})
			)
		);
		if (results.every((r) => r.ok)) refetchAll();
		else alert("部分刪除失敗，請重新整理確認結果");
	}

	// NOTE: export still only accepts one shared month range across all
	// requested years — that route hasn't been reworked in this pass.
	// While periodB is active with a DIFFERENT month range than periodA,
	// exporting will apply periodA's window to both years' data.
	async function handleExport() {
		setExporting(true);
		try {
			const token = localStorage.getItem("token");
			const years = periodB ? [periodA.year, periodB.year].sort((a, b) => a - b) : [periodA.year];
			const params = new URLSearchParams({
				years: years.join(","),
				month_from: String(periodA.startMonth),
				month_to: String(periodA.endMonth),
			});
			const res = await fetch(`/api/audit/routine/export?${params}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "匯出失敗");
			}
			const blob = await res.blob();
			const disposition = res.headers.get("content-disposition") ?? "";
			const extendedMatch = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
			const plainMatch = /filename="([^"]+)"/i.exec(disposition);
			const filename = extendedMatch
				? decodeURIComponent(extendedMatch[1])
				: plainMatch
				? plainMatch[1]
				: `routine_audit_export_${years.join("-")}.xlsx`;
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			alert(err instanceof Error ? err.message : "匯出失敗");
		} finally {
			setExporting(false);
		}
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

	// display order for the two-column table view now comes from `swapped`
	// (computed above, shared with the chart calculations)

	return (
		<div className={styles.container}>
			{/* ---- filter bar ---- */}
			<div className={styles.filterBar}>
				<div className={styles.field}>
					<label className={styles.label}>年度</label>
					<select
						className={styles.select}
						value={periodA.year}
						onChange={(e) => setPeriodA((p) => ({ ...p, year: Number(e.target.value) }))}
					>
						{AVAILABLE_YEARS.map((y) => (
							<option key={y} value={y}>{y}</option>
						))}
					</select>
				</div>

				<div className={styles.field}>
					<label className={styles.label}>月份區間</label>
					<div className={styles.monthRange}>
						<select
							className={styles.select}
							value={periodA.startMonth}
							onChange={(e) => setPeriodA((p) => ({ ...p, startMonth: Number(e.target.value) }))}
						>
							{MONTHS.map((m, i) => (
								<option key={i} value={i + 1}>{m}</option>
							))}
						</select>
						<span className={styles.to}>至</span>
						<select
							className={styles.select}
							value={periodA.endMonth}
							onChange={(e) => setPeriodA((p) => ({ ...p, endMonth: Number(e.target.value) }))}
						>
							{MONTHS.map((m, i) => (
								<option key={i} value={i + 1}>{m}</option>
							))}
						</select>
					</div>
				</div>

				{/* ── NEW: comparison period now has its OWN year + month range ── */}
				<div className={styles.field}>
					<label className={styles.label}>比較區間</label>
					{periodB === null ? (
						comparePicking ? (
							<div className={styles.monthRange}>
								<select
									autoFocus
									className={styles.select}
									onChange={(e) =>
										setPeriodB({ year: Number(e.target.value), startMonth: periodA.startMonth, endMonth: periodA.endMonth })
									}
								>
									<option value="">選擇年度...</option>
									{AVAILABLE_YEARS.map((y) => (
										<option key={y} value={y}>{y}</option>
									))}
								</select>
							</div>
						) : (
							<button className={styles.compareChip} onClick={() => setComparePicking(true)}>
								+ 比較區間
							</button>
						)
					) : (
						<div className={styles.monthRange}>
							<select
								className={styles.select}
								value={periodB.year}
								onChange={(e) => setPeriodB((p) => (p ? { ...p, year: Number(e.target.value) } : p))}
							>
								{AVAILABLE_YEARS.map((y) => (
									<option key={y} value={y}>{y}</option>
								))}
							</select>
							<select
								className={styles.select}
								value={periodB.startMonth}
								onChange={(e) => setPeriodB((p) => (p ? { ...p, startMonth: Number(e.target.value) } : p))}
							>
								{MONTHS.map((m, i) => (
									<option key={i} value={i + 1}>{m}</option>
								))}
							</select>
							<span className={styles.to}>至</span>
							<select
								className={styles.select}
								value={periodB.endMonth}
								onChange={(e) => setPeriodB((p) => (p ? { ...p, endMonth: Number(e.target.value) } : p))}
							>
								{MONTHS.map((m, i) => (
									<option key={i} value={i + 1}>{m}</option>
								))}
							</select>
							<button
								className={styles.compareChipActive}
								onClick={() => {
									setPeriodB(null);
									setComparePicking(false);
								}}
							>
								×
							</button>
						</div>
					)}
				</div>

				<div className={styles.actions}>
					<input
						ref={fileInputRef}
						type="file"
						accept=".xls,.xlsx"
						className={styles.hiddenFileInput}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) handleImportFile(file);
							e.target.value = "";
						}}
					/>
					<button
						className={styles.importBtn}
						onClick={() => fileInputRef.current?.click()}
						disabled={importing}
					>
						{importing ? "匯入中..." : "匯入Excel"}
					</button>
					<button className={styles.exportBtn} onClick={handleExport} disabled={exporting}>
						{exporting ? "匯出中..." : "匯出Excel"}
					</button>
					<button className={styles.primaryBtn} onClick={handleAddEntry}>
						+ 新增紀錄
					</button>
				</div>
			</div>

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
						<div className={styles.kpiInline}>
							<span className={styles.kpiLabel}>安全相關紀錄</span>
							<span className={styles.kpiValue}>{totalFindings}</span>
						</div>
					</div>

					{innerTab === "charts" && (
						<>
							<div className={styles.chartControls}>
								<span className={styles.label}>分組方式</span>
								<div className={styles.levelToggle}>
									{(["code", "category"] as const).map((level) => (
										<button
											key={level}
											className={pieLevel === level ? styles.levelBtnActive : styles.levelBtn}
											onClick={() => setPieLevel(level)}
										>
											{level === "code" ? "代碼" : "類別"}
										</button>
									))}
								</div>
							</div>

							{pieLevel === "category" && (
								<div className={styles.chartRow}>
									<RoutineEfChart data={efCodeData} year={periodA.year} level={pieLevel} descriptions={efCodeDescriptions} forceBar />
									<RoutineSamChart data={categoryData} year={periodA.year} level={pieLevel} descriptions={samCodeDescriptions} forceBar />
								</div>
							)}
							<div className={styles.chartRow}>
								<RoutineEfChart
									data={efCodeData}
									year={periodA.year}
									level={pieLevel}
									descriptions={efCodeDescriptions}
								/>
								<RoutineSamChart
									data={categoryData}
									year={periodA.year}
									level={pieLevel}
									descriptions={samCodeDescriptions}
								/>
							</div>

							{/* ── comparison charts, only once periodB is set. Unified
							    長條圖/圓餅圖/雷達圖 toggle — pie sits between bar and
							    radar as a peer option, not level-gated like before. ── */}
							{periodB !== null && (
								<>
									<div className={styles.chartControls}>
										<span className={styles.label}>比較圖表</span>
										<div className={styles.levelToggle}>
											{(["bar", "pie", "radar"] as const).map((mode) => (
												<button
													key={mode}
													className={chartMode === mode ? styles.levelBtnActive : styles.levelBtn}
													onClick={() => setChartMode(mode)}
												>
													{mode === "bar" ? "長條圖" : mode === "pie" ? "圓餅圖" : "雷達圖"}
												</button>
											))}
										</div>
									</div>

									{chartMode === "pie" ? (
										<>
											<div className={styles.chartControls}>
												<span className={styles.label}>比較類別</span>
												<div className={styles.levelToggle}>
													<button
														className={compareCode === "sam" ? styles.levelBtnActive : styles.levelBtn}
														onClick={() => setCompareCode("sam")}
													>
														SAM
													</button>
													<button
														className={compareCode === "ef" ? styles.levelBtnActive : styles.levelBtn}
														onClick={() => setCompareCode("ef")}
													>
														EF
													</button>
												</div>
											</div>
											{compareCode === "sam" ? (
												<RoutineSamCategoryComparePies
													dataA={categoryData}
													dataB={categoryDataB}
													labelA={periodLabel(chronoPeriodA)}
													labelB={periodLabel(chronoPeriodB!)}
												/>
											) : (
												<RoutineEfCategoryComparePies
													dataA={efCodeData}
													dataB={efCodeDataB}
													labelA={periodLabel(chronoPeriodA)}
													labelB={periodLabel(chronoPeriodB!)}
												/>
											)}
										</>
									) : (
										<div className={styles.chartRow}>
											<RoutineEfCompareChart
												data={efCompareData}
												periods={[periodLabel(chronoPeriodA), periodLabel(chronoPeriodB!)]}
												level={pieLevel}
												chartStyle={chartMode === "radar" ? "radar" : "bar"}
												descriptions={efCodeDescriptions}
												onViewRecords={
													chartMode === "bar" && pieLevel === "code"
														? (label) => setRecordsModal({ label, type: "ef" })
														: undefined
												}
											/>
											<RoutineSamCompareChart
												data={categoryCompareData}
												periods={[periodLabel(chronoPeriodA), periodLabel(chronoPeriodB!)]}
												level={pieLevel}
												chartStyle={chartMode === "radar" ? "radar" : "bar"}
												descriptions={samCodeDescriptions}
												onViewRecords={
													chartMode === "bar" && pieLevel === "code"
														? (label) => setRecordsModal({ label, type: "sam" })
														: undefined
												}
											/>
										</div>
									)}
								</>
							)}

							<div className={styles.trendRow}>
								<RoutineTrendChart
									series={trendSeries}
									monthFrom={trendWindow.from}
									monthTo={trendWindow.to}
								/>
							</div>
						</>
					)}

					{innerTab === "table" && (
						periodB === null ? (
							<RoutineEntriesTable
								entries={entries}
								loading={entriesLoading}
								onEdit={handleEdit}
								onDelete={handleDelete}
								openSections={getOpenSections("primary")}
								onToggleSection={(key) => handleToggleSection("primary", key)}
								onDefaultSection={(key) => handleDefaultSection("primary", key)}
							/>
						) : (
							<div className={styles.compareTables}>
								<div className={styles.compareTableCol}>
									<p className={styles.compareTableHeader}>{periodLabel(chronoPeriodA)}</p>
									<RoutineEntriesTable
										entries={chronoEntriesA}
										loading={chronoEntriesALoading}
										onEdit={handleEdit}
										onDelete={handleDelete}
										openSections={getOpenSections(swapped ? "compare" : "primary")}
										onToggleSection={(key) => handleToggleSection(swapped ? "compare" : "primary", key)}
										onDefaultSection={(key) => handleDefaultSection(swapped ? "compare" : "primary", key)}
									/>
								</div>
								<div className={styles.compareTableCol}>
									<p className={styles.compareTableHeader}>{periodLabel(chronoPeriodB!)}</p>
									<RoutineEntriesTable
										entries={chronoEntriesB}
										loading={chronoEntriesBLoading}
										onEdit={handleEdit}
										onDelete={handleDelete}
										openSections={getOpenSections(swapped ? "primary" : "compare")}
										onToggleSection={(key) => handleToggleSection(swapped ? "primary" : "compare", key)}
										onDefaultSection={(key) => handleDefaultSection(swapped ? "primary" : "compare", key)}
									/>
								</div>
							</div>
						)
					)}
				</>
			)}

			<RoutineEntryModal
				open={modal.open}
				mode={modal.open ? modal.mode : "create"}
				editingEntries={modal.open && modal.mode === "edit" ? modal.entries : null}
				onClose={() => setModal({ open: false })}
				onSaved={refetchAll}
			/>

			{recordsModal && periodB && (
				<TrendRecordsModal
					code={recordsModal.label}
					description={
						(recordsModal.type === "sam" ? samCodeDescriptions : efCodeDescriptions)[recordsModal.label] ?? ""
					}
					type={recordsModal.type === "sam" ? "hfacs" : "ef"}
					source="routine"
					yearA={periodA.year}
					yearB={periodB.year}
					monthFromA={periodA.startMonth}
					monthToA={periodA.endMonth}
					monthFromB={periodB.startMonth}
					monthToB={periodB.endMonth}
					onClose={() => setRecordsModal(null)}
				/>
			)}
		</div>
	);
}