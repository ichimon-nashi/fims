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
} from "./RoutineCharts";
import RoutineEntriesTable from "./RoutineEntriesTable";
import RoutineEntryModal from "./RoutineEntryModal";
import { SAM_CODE_MAP, EF_CODE_MAP } from "@/lib/routineAudit.constants";
import {
	PieGroupLevel,
	ChartStyle,
	RoutineSummaryResponse,
	RoutineAuditEntry,
} from "@/lib/routineAudit.types";

const AVAILABLE_YEARS = [2025, 2026]; // TODO: derive from distinct report_year once more years exist
const TREND_COLORS = ["#4a9eff", "#fb923c"];
const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

type ModalState =
	| { open: false }
	| { open: true; mode: "create" }
	| { open: true; mode: "edit"; entries: RoutineAuditEntry[] };

export default function RoutineSummary() {
	const [primaryYear, setPrimaryYear] = useState<number>(2026);
	const [compareYear, setCompareYear] = useState<number | null>(null);
	const [comparePicking, setComparePicking] = useState(false);
	const [monthFrom, setMonthFrom] = useState<number>(1);
	const [monthTo, setMonthTo] = useState<number>(12);
	const [pieLevel, setPieLevel] = useState<PieGroupLevel>("category");
	const [chartStyle, setChartStyle] = useState<ChartStyle>("bar");

	const [summary, setSummary] = useState<RoutineSummaryResponse | null>(null);
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

	const years = useMemo(
		() => (compareYear ? [primaryYear, compareYear].sort((a, b) => a - b) : [primaryYear]),
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

	const fetchEntriesFor = useCallback(
		(year: number, setter: (rows: RoutineAuditEntry[]) => void, setLoadingFn: (v: boolean) => void) => {
			const token = localStorage.getItem("token");
			if (!token) return;
			setLoadingFn(true);
			const params = new URLSearchParams({
				year: String(year),
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
				.then((data) => setter(data.records ?? []))
				.catch(() => setter([]))
				.finally(() => setLoadingFn(false));
		},
		[monthFrom, monthTo]
	);

	const fetchEntries = useCallback(
		() => fetchEntriesFor(primaryYear, setEntries, setEntriesLoading),
		[fetchEntriesFor, primaryYear]
	);

	useEffect(fetchSummary, [fetchSummary]);
	useEffect(fetchEntries, [fetchEntries]);

	// comparison year gets its own entries fetch, only when actually set
	useEffect(() => {
		if (compareYear === null) {
			setCompareEntries([]);
			return;
		}
		fetchEntriesFor(compareYear, setCompareEntries, setCompareEntriesLoading);
	}, [compareYear, fetchEntriesFor]);

	const categoryData = useMemo(() => {
		if (!summary) return [];
		const source = (pieLevel === "code" ? summary.byCode : summary.byCategory) ?? {};
		return Object.entries(source).map(([label, byYear]) => ({
			label,
			count: byYear[primaryYear] ?? 0,
		}));
	}, [summary, primaryYear, pieLevel]);

	const efCodeData = useMemo(() => {
		if (!summary) return [];
		const source = (pieLevel === "code" ? summary.byEfCode : summary.byEfMiddle) ?? {};
		return Object.entries(source).map(([label, byYear]) => ({
			label,
			count: byYear[primaryYear] ?? 0,
		}));
	}, [summary, primaryYear, pieLevel]);

	// ── year-over-year comparison data, only meaningful once a compare
	// year is picked. SAM's category-level comparison reads from byArea
	// (HFACS top tier, e.g. "組織影響") rather than byCategory (e.g.
	// "Resource Management") — a deliberate tier bump for the comparison
	// view only; the single-year pie above stays at the category tier. ──
	const categoryCompareData = useMemo(() => {
		if (!summary || compareYear === null) return [];
		const source = (pieLevel === "code" ? summary.byCode : summary.byArea) ?? {};
		return Object.entries(source).map(([label, byYear]) => ({
			label,
			values: years.map((y) => byYear[y] ?? 0),
		}));
	}, [summary, years, compareYear, pieLevel]);

	const efCompareData = useMemo(() => {
		if (!summary || compareYear === null) return [];
		const source = (pieLevel === "code" ? summary.byEfCode : summary.byEfMiddle) ?? {};
		return Object.entries(source).map(([label, byYear]) => ({
			label,
			values: years.map((y) => byYear[y] ?? 0),
		}));
	}, [summary, years, compareYear, pieLevel]);

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
		if (compareYear !== null) fetchEntriesFor(compareYear, setCompareEntries, setCompareEntriesLoading);
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

	async function handleExport() {
		setExporting(true);
		try {
			const token = localStorage.getItem("token");
			const params = new URLSearchParams({
				years: years.join(","),
				month_from: String(monthFrom),
				month_to: String(monthTo),
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

	return (
		<div className={styles.container}>
			{/* ---- filter bar (merged in from the former RoutineFilters.tsx) ---- */}
			<div className={styles.filterBar}>
				<div className={styles.field}>
					<label className={styles.label}>年度</label>
					<select
						className={styles.select}
						value={primaryYear}
						onChange={(e) => setPrimaryYear(Number(e.target.value))}
					>
						{AVAILABLE_YEARS.map((y) => (
							<option key={y} value={y}>{y}</option>
						))}
					</select>
				</div>

				{/* compare-year control lives here, in the persistent filter bar,
				    so it's reachable from both 紀錄列表 and 圖表 — it used to be
				    inside the trend chart's own header, which only rendered when
				    圖表 was the active tab */}
				<div className={styles.field}>
					<label className={styles.label}>比較年度</label>
					{compareYear === null ? (
						comparePicking ? (
							<select
								autoFocus
								className={styles.select}
								onChange={(e) => {
									setCompareYear(Number(e.target.value));
									setComparePicking(false);
								}}
								onBlur={() => setComparePicking(false)}
							>
								<option value="">選擇年度...</option>
								{AVAILABLE_YEARS.filter((y) => y !== primaryYear).map((y) => (
									<option key={y} value={y}>{y}</option>
								))}
							</select>
						) : (
							<button className={styles.compareChip} onClick={() => setComparePicking(true)}>
								+ 比較年度
							</button>
						)
					) : (
						<button className={styles.compareChipActive} onClick={() => setCompareYear(null)}>
							vs {compareYear} ×
						</button>
					)}
				</div>

				<div className={styles.field}>
					<label className={styles.label}>月份區間</label>
					<div className={styles.monthRange}>
						<select
							className={styles.select}
							value={monthFrom}
							onChange={(e) => setMonthFrom(Number(e.target.value))}
						>
							{MONTHS.map((m, i) => (
								<option key={i} value={i + 1}>{m}</option>
							))}
						</select>
						<span className={styles.to}>至</span>
						<select
							className={styles.select}
							value={monthTo}
							onChange={(e) => setMonthTo(Number(e.target.value))}
						>
							{MONTHS.map((m, i) => (
								<option key={i} value={i + 1}>{m}</option>
							))}
						</select>
					</div>
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

							<div className={styles.chartRow}>
								<RoutineEfChart
									data={efCodeData}
									year={primaryYear}
									level={pieLevel}
									descriptions={efCodeDescriptions}
								/>
								<RoutineSamChart
									data={categoryData}
									year={primaryYear}
									level={pieLevel}
									descriptions={samCodeDescriptions}
								/>
							</div>

							{/* ── year-over-year comparison charts, only once a compare
							    year is picked — mirrors the trend chart's own
							    years-aware rendering just above it in layout order. ── */}
							{compareYear !== null && (
								<>
									<div className={styles.chartControls}>
										<span className={styles.label}>比較圖表</span>
										<div className={styles.levelToggle}>
											{(["bar", "radar"] as const).map((style) => (
												<button
													key={style}
													className={chartStyle === style ? styles.levelBtnActive : styles.levelBtn}
													onClick={() => setChartStyle(style)}
												>
													{style === "bar" ? "長條圖" : "雷達圖"}
												</button>
											))}
										</div>
									</div>

									<div className={styles.chartRow}>
										<RoutineEfCompareChart
											data={efCompareData}
											years={years}
											level={pieLevel}
											chartStyle={chartStyle}
											descriptions={pieLevel === "code" ? efCodeDescriptions : undefined}
										/>
										<RoutineSamCompareChart
											data={categoryCompareData}
											years={years}
											level={pieLevel}
											chartStyle={chartStyle}
											descriptions={pieLevel === "code" ? samCodeDescriptions : undefined}
										/>
									</div>
								</>
							)}

							<div className={styles.trendRow}>
								<RoutineTrendChart
									series={trendSeries}
									monthFrom={monthFrom}
									monthTo={monthTo}
								/>
							</div>
						</>
					)}

					{innerTab === "table" && (
						compareYear === null ? (
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
								{compareYear < primaryYear ? (
									<>
										<div className={styles.compareTableCol}>
											<p className={styles.compareTableHeader}>{compareYear}</p>
											<RoutineEntriesTable
												entries={compareEntries}
												loading={compareEntriesLoading}
												onEdit={handleEdit}
												onDelete={handleDelete}
												openSections={getOpenSections("compare")}
												onToggleSection={(key) => handleToggleSection("compare", key)}
												onDefaultSection={(key) => handleDefaultSection("compare", key)}
											/>
										</div>
										<div className={styles.compareTableCol}>
											<p className={styles.compareTableHeader}>{primaryYear}</p>
											<RoutineEntriesTable
												entries={entries}
												loading={entriesLoading}
												onEdit={handleEdit}
												onDelete={handleDelete}
												openSections={getOpenSections("primary")}
												onToggleSection={(key) => handleToggleSection("primary", key)}
												onDefaultSection={(key) => handleDefaultSection("primary", key)}
											/>
										</div>
									</>
								) : (
									<>
										<div className={styles.compareTableCol}>
											<p className={styles.compareTableHeader}>{primaryYear}</p>
											<RoutineEntriesTable
												entries={entries}
												loading={entriesLoading}
												onEdit={handleEdit}
												onDelete={handleDelete}
												openSections={getOpenSections("primary")}
												onToggleSection={(key) => handleToggleSection("primary", key)}
												onDefaultSection={(key) => handleDefaultSection("primary", key)}
											/>
										</div>
										<div className={styles.compareTableCol}>
											<p className={styles.compareTableHeader}>{compareYear}</p>
											<RoutineEntriesTable
												entries={compareEntries}
												loading={compareEntriesLoading}
												onEdit={handleEdit}
												onDelete={handleDelete}
												openSections={getOpenSections("compare")}
												onToggleSection={(key) => handleToggleSection("compare", key)}
												onDefaultSection={(key) => handleDefaultSection("compare", key)}
											/>
										</div>
									</>
								)}
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
		</div>
	);
}