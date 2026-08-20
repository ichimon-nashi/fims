// src/components/sms/StatisticsTab.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styles from "./StatisticsTab.module.css";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { EF_ATTRIBUTE_CATEGORIES } from "@/lib/sms.constants";

interface SRMEntry {
	id: number;
	number: string;
	occurrence_month: string;
	ef_attribute_codes: string[];
	data_source: string;
	created_at: string;
}

interface MonthlyStats {
	[efCode: string]: {
		[month: string]: {
			count: number;
			sources: Set<string>;
		};
	};
}

interface YearlyStats {
	[efCode: string]: number;
}

interface StatisticsTabProps {
	isAdmin: boolean;
}

export default function StatisticsTab({ isAdmin }: StatisticsTabProps) {
	const [entries, setEntries] = useState<SRMEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [exporting, setExporting] = useState(false);
	const [capturing, setCapturing] = useState(false);
	const [selectedYear, setSelectedYear] = useState<number>(
		new Date().getFullYear()
	);
	const [compareYear1, setCompareYear1] = useState<number>(
		new Date().getFullYear()
	);
	const [compareYear2, setCompareYear2] = useState<number>(
		new Date().getFullYear() - 1
	);
	const [availableYears, setAvailableYears] = useState<number[]>([]);

	const containerRef = useRef<HTMLDivElement>(null);

	const EF_CATEGORIES: { [key: string]: string } = {
		P: "安全程序/訓練",
		E: "設備/工作區域",
		C: "組員溝通協調",
		I: "個人/行為影響",
		T: "技術/知識/技巧/經驗",
		O: "其他",
		M: "改變管理",
	};

	const efCodeDescriptions = useMemo(() => {
		const map: { [code: string]: string } = {};
		EF_ATTRIBUTE_CATEGORIES.forEach((category) => {
			category.middleCategories.forEach((middle) => {
				middle.subcodes.forEach((subcode) => {
					map[subcode.code] = subcode.description;
				});
			});
		});
		return map;
	}, []);

	useEffect(() => {
		fetchEntries();
	}, []);

	const fetchEntries = async () => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch("/api/sms/srm-entries", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) throw new Error("Failed to fetch entries");
			const data = await response.json();
			setEntries(data);

			const years = new Set<number>();
			data.forEach((entry: SRMEntry) => {
				if (entry.occurrence_month) {
					const year = parseInt(entry.occurrence_month.split("-")[0]);
					years.add(year);
				}
			});
			const yearsArray = Array.from(years).sort((a, b) => b - a);
			setAvailableYears(yearsArray);

			// Set selectedYear to first available year (or current year if no data)
			if (yearsArray.length > 0) {
				setSelectedYear(yearsArray[0]);
			}
		} catch (error) {
			console.error("Error fetching entries:", error);
		} finally {
			setLoading(false);
		}
	};

	const [selectedMonthFrom, setSelectedMonthFrom] = useState<number>(1);
	const [selectedMonthTo, setSelectedMonthTo] = useState<number>(12);

	// Swap (not clamp) when the range would invert — e.g. picking 結束月
	// "April" while 起始月 is "June" ends with 起始月=April, 結束月=June,
	// preserving both selected values rather than collapsing them together.
	const handleMonthFromChange = (v: number) => {
		if (v > selectedMonthTo) {
			setSelectedMonthFrom(selectedMonthTo);
			setSelectedMonthTo(v);
		} else {
			setSelectedMonthFrom(v);
		}
	};

	const handleMonthToChange = (v: number) => {
		if (v < selectedMonthFrom) {
			setSelectedMonthTo(selectedMonthFrom);
			setSelectedMonthFrom(v);
		} else {
			setSelectedMonthTo(v);
		}
	};

	const monthlyStats = useMemo(() => {
		const stats: MonthlyStats = {};
		entries
			.filter((entry) => {
				if (!entry.occurrence_month) return false;
				const [yearStr, monthStr] = entry.occurrence_month.split("-");
				const year = parseInt(yearStr);
				const month = parseInt(monthStr);
				return year === selectedYear && month >= selectedMonthFrom && month <= selectedMonthTo;
			})
			.forEach((entry) => {
				if (
					!entry.ef_attribute_codes ||
					entry.ef_attribute_codes.length === 0
				)
					return;
				entry.ef_attribute_codes.forEach((code) => {
					if (!code) return;
					if (!stats[code]) stats[code] = {};
					const month = entry.occurrence_month;
					if (!stats[code][month]) {
						stats[code][month] = {
							count: 0,
							sources: new Set<string>(),
						};
					}
					stats[code][month].count += 1;
					if (entry.data_source) {
						stats[code][month].sources.add(entry.data_source);
					}
				});
			});
		return stats;
	}, [entries, selectedYear, selectedMonthFrom, selectedMonthTo]);

	const activeMonths = useMemo(() => {
		const months = new Set<string>();
		Object.values(monthlyStats).forEach((codeStats) => {
			Object.keys(codeStats).forEach((month) => months.add(month));
		});
		return Array.from(months).sort();
	}, [monthlyStats]);

	const activeCodes = useMemo(() => {
		return Object.keys(monthlyStats).sort();
	}, [monthlyStats]);

	// ---- Shared EF/HFACS toggle for 統計表, 類別分析, and EF代碼統計圖.
	// HFACS categories are server-computed (trend-analysis/route.ts
	// already groups+totals them), so the pie chart reads
	// hfacsData.categories directly rather than re-deriving a grouping
	// scheme client-side the way EF's fixed P/E/C/I/T/O/M grouping does. ----
	const [dataType, setDataType] = useState<"ef" | "hfacs">("ef");
	const [hfacsData, setHfacsData] = useState<{
		codes: { code: string; description: string; total: number }[];
		categories: { category: string; total: number }[];
		trendByCode: Record<string, Record<string, { srm: number; self: number }>>;
	} | null>(null);
	const [hfacsLoading, setHfacsLoading] = useState(false);

	// Fetches eagerly (not just when dataType==="hfacs") — the summary row
	// shows both EF種類 and HFACS種類 counts regardless of which toggle
	// is active, so HFACS data needs to be available either way.
	useEffect(() => {
		let cancelled = false;

		async function loadHfacs() {
			setHfacsLoading(true);
			try {
				const token = localStorage.getItem("token");
				const params = new URLSearchParams({
					years: String(selectedYear),
					month_from: String(selectedMonthFrom),
					month_to: String(selectedMonthTo),
					type: "hfacs",
				});
				const res = await fetch(`/api/sms/trend-analysis?${params}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (!res.ok) throw new Error("HFACS 資料載入失敗");
				const data = await res.json();
				if (!cancelled) setHfacsData(data);
			} catch (error) {
				console.error("Error loading HFACS data:", error);
				if (!cancelled) setHfacsData(null);
			} finally {
				if (!cancelled) setHfacsLoading(false);
			}
		}

		loadHfacs();
		return () => {
			cancelled = true;
		};
	}, [selectedYear, selectedMonthFrom, selectedMonthTo]);

	// Reshaped into the exact same { code: { month: { count, sources } } }
	// shape monthlyStats already uses, so the table's existing render
	// logic works unchanged regardless of which mode is active. self is
	// always 0 now (trend-analysis/route.ts is SRM-only), so count is
	// effectively just srm, and sources is a constant ["SRM"].
	const hfacsMonthlyStats = useMemo((): MonthlyStats => {
		if (!hfacsData) return {};
		const stats: MonthlyStats = {};
		Object.entries(hfacsData.trendByCode).forEach(([code, months]) => {
			stats[code] = {};
			Object.entries(months).forEach(([month, counts]) => {
				const total = counts.srm + counts.self;
				if (total === 0) return;
				stats[code][month] = { count: total, sources: new Set(["SRM"]) };
			});
		});
		return stats;
	}, [hfacsData]);

	const hfacsCodeDescriptions = useMemo(() => {
		const map: { [code: string]: string } = {};
		(hfacsData?.codes ?? []).forEach((c) => {
			map[c.code] = c.description;
		});
		return map;
	}, [hfacsData]);

	const tableMonthlyStats = dataType === "hfacs" ? hfacsMonthlyStats : monthlyStats;
	const tableCodeDescriptions = dataType === "hfacs" ? hfacsCodeDescriptions : efCodeDescriptions;
	const tableActiveCodes = useMemo(() => {
		return Object.keys(tableMonthlyStats).sort((a, b) => {
			const totalA = Object.values(tableMonthlyStats[a]).reduce((s, d) => s + d.count, 0);
			const totalB = Object.values(tableMonthlyStats[b]).reduce((s, d) => s + d.count, 0);
			return totalB - totalA;
		});
	}, [tableMonthlyStats]);
	const tableActiveMonths = useMemo(() => {
		const months = new Set<string>();
		Object.values(tableMonthlyStats).forEach((codeStats) => {
			Object.keys(codeStats).forEach((month) => months.add(month));
		});
		return Array.from(months).sort();
	}, [tableMonthlyStats]);

	const yearlyTotals = useMemo(() => {
		const totals: YearlyStats = {};
		Object.entries(monthlyStats).forEach(([code, months]) => {
			totals[code] = Object.values(months).reduce(
				(sum, data) => sum + data.count,
				0
			);
		});
		return totals;
	}, [monthlyStats]);

	const categoryBreakdown = useMemo(() => {
		const breakdown: { [category: string]: number } = {};
		Object.entries(yearlyTotals).forEach(([code, count]) => {
			const category = code.charAt(0);
			const categoryName = EF_CATEGORIES[category] || category;
			breakdown[categoryName] = (breakdown[categoryName] || 0) + count;
		});
		return breakdown;
	}, [yearlyTotals, EF_CATEGORIES]);

	const pieChartData = useMemo(() => {
		const colors = ["#4a9eff", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];
		return Object.entries(EF_CATEGORIES).map(([code, name], index) => ({
			code,
			name,
			value: categoryBreakdown[name] || 0,
			color: colors[index % colors.length],
		}));
	}, [categoryBreakdown, EF_CATEGORIES]);

	// 類別分析 (pie) — EF uses the fixed P/E/C/I/T/O/M palette computed
	// client-side (code.charAt(0)); HFACS categories are open-ended and
	// already grouped+totaled server-side in hfacsData.categories, so
	// that's used directly rather than re-deriving a grouping scheme here.
	const PIE_COLORS = ["#4a9eff", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1", "#fb923c", "#1baf7a", "#e87ba4"];
	const hfacsPieChartData = useMemo(() => {
		if (!hfacsData) return [];
		return hfacsData.categories.map((c, index) => ({
			code: c.category, // HFACS categories have no separate short-code distinct from their name — label logic below skips the "(code)" suffix when code === name
			name: c.category,
			value: c.total,
			color: PIE_COLORS[index % PIE_COLORS.length],
		}));
	}, [hfacsData]);
	const activePieChartData = (dataType === "hfacs" ? hfacsPieChartData : pieChartData).filter(
		(d) => d.value > 0
	);
	const pieTotalCases = activePieChartData.reduce((sum, d) => sum + d.value, 0);

	// EF代碼統計圖 (bar) — unified shape for both modes so the bar chart's
	// JSX doesn't need mode-specific branching, just one sorted array.
	const barChartCodes = useMemo(() => {
		if (dataType === "hfacs") {
			return [...(hfacsData?.codes ?? [])].sort((a, b) => b.total - a.total);
		}
		return Object.entries(yearlyTotals)
			.map(([code, count]) => ({ code, description: efCodeDescriptions[code] || code, total: count }))
			.sort((a, b) => b.total - a.total);
	}, [dataType, hfacsData, yearlyTotals, efCodeDescriptions]);

	// ---- 代碼組成分析 — ported from TrendAnalysisTab.tsx, simplified.
	// The original showed a stacked srm/self bar per code; that split is
	// now structurally dead everywhere on this page (self is always 0,
	// see trend-analysis/route.ts), so porting the two-color stack as-is
	// would show a visual that no longer means anything. Single-color bar
	// instead, same search/top-10-expand behavior. Click-to-show-趨勢分析
	// intentionally NOT wired yet — that needs the line-chart section
	// ported too, and a row that looks clickable but does nothing would
	// be worse than a plain list in the meantime. ----
	const [compositionSearch, setCompositionSearch] = useState("");
	const [showAllComposition, setShowAllComposition] = useState(false);

	const filteredComposition = useMemo(() => {
		if (!compositionSearch.trim()) {
			return showAllComposition ? barChartCodes : barChartCodes.slice(0, 10);
		}
		const term = compositionSearch.toLowerCase();
		return barChartCodes.filter(
			(c) => c.code.toLowerCase().includes(term) || c.description.toLowerCase().includes(term)
		);
	}, [barChartCodes, compositionSearch, showAllComposition]);

	// ---- 趨勢分析 (single-code trend graph), shown on click from a
	// 代碼組成分析 row. Ported in scope — TrendAnalysisTab.tsx's version
	// spans a fromYear/toYear multi-year range with month/quarter/half-
	// year/year granularity rollup; StatisticsTab is scoped to one
	// selectedYear + a month range within it, so this shows the plain
	// monthly series across that range without a granularity toggle.
	// Reuses data already fetched for the table/pie/bar — no new fetch. ----
	const [selectedTrendCode, setSelectedTrendCode] = useState<string | null>(null);

	const trendCodeSeries = useMemo(() => {
		if (!selectedTrendCode) return [];
		const monthCounts: Record<string, number> =
			dataType === "hfacs"
				? Object.fromEntries(
						Object.entries(hfacsData?.trendByCode?.[selectedTrendCode] ?? {}).map(
							([month, counts]) => [month, counts.srm + counts.self]
						)
				  )
				: Object.fromEntries(
						Object.entries(monthlyStats[selectedTrendCode] ?? {}).map(([month, d]) => [
							month,
							d.count,
						])
				  );
		return Object.entries(monthCounts)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([period, count]) => ({ period, count }));
	}, [selectedTrendCode, dataType, hfacsData, monthlyStats]);

	const selectedTrendDescription =
		barChartCodes.find((c) => c.code === selectedTrendCode)?.description ?? "";

	const comparisonData = useMemo(() => {
		const year1Data: YearlyStats = {};
		const year2Data: YearlyStats = {};
		entries.forEach((entry) => {
			if (!entry.occurrence_month || !entry.ef_attribute_codes) return;
			const year = parseInt(entry.occurrence_month.split("-")[0]);
			const targetData =
				year === compareYear1
					? year1Data
					: year === compareYear2
					? year2Data
					: null;
			if (targetData) {
				entry.ef_attribute_codes.forEach((code) => {
					if (code) targetData[code] = (targetData[code] || 0) + 1;
				});
			}
		});
		return { year1: year1Data, year2: year2Data };
	}, [entries, compareYear1, compareYear2]);

	const exportToExcel = async () => {
		setExporting(true);
		try {
			const token = localStorage.getItem("token");

			// Reshape monthlyStats from { code: { month: { count, sources } } }
			// to { code: { month: count } } — the export route only needs
			// counts, not the sources Set (which doesn't survive JSON anyway).
			const monthlyStatsForExport: Record<string, Record<string, number>> = {};
			Object.entries(monthlyStats).forEach(([code, months]) => {
				monthlyStatsForExport[code] = {};
				Object.entries(months).forEach(([month, data]) => {
					monthlyStatsForExport[code][month] = data.count;
				});
			});

			const response = await fetch("/api/sms/export-statistics", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					year: selectedYear,
					activeMonths,
					activeCodes,
					efCodeDescriptions,
					monthlyStats: monthlyStatsForExport,
					yearlyTotals,
					categoryBreakdown,
					totalCases,
					compareYear1,
					compareYear2,
					comparisonData,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || "Failed to export");
			}

			const blob = await response.blob();
			saveAs(blob, `SRM統計報表_${selectedYear}.xlsx`);

			alert("✅ Excel 檔案已匯出！圖表已內建，可直接編輯");
		} catch (error) {
			console.error("Export error:", error);
			alert("匯出失敗：" + (error as Error).message);
		} finally {
			setExporting(false);
		}
	};

	const captureScreenshot = async () => {
		if (!containerRef.current) return;
		setCapturing(true);
		try {
			const canvas = await html2canvas(containerRef.current, {
				backgroundColor: "#1a202c",
				scale: 2,
				logging: false,
				useCORS: true,
			} as any);
			const link = document.createElement("a");
			link.download = `SRM統計_${selectedYear}_${new Date()
				.toISOString()
				.slice(0, 10)}.png`;
			link.href = canvas.toDataURL("image/png");
			link.click();
			alert("✅ 截圖已下載！");
		} catch (error) {
			console.error("Screenshot error:", error);
			alert("截圖失敗：" + (error as Error).message);
		} finally {
			setCapturing(false);
		}
	};

	if (loading) {
		return (
			<div className={styles.loading}>
				<div className={styles.spinner}></div>
				<p>載入統計資料中...</p>
			</div>
		);
	}

	const totalCases = Object.values(yearlyTotals).reduce(
		(sum, count) => sum + count,
		0
	);

	return (
		<div className={styles.statisticsTab} ref={containerRef}>
			<div className={styles.header}>
				<div className={styles.controls}>
					<div className={styles.filterGroup}>
						<div className={styles.controlGroup}>
							<label>選擇年份:</label>
							<select
								value={selectedYear}
								onChange={(e) =>
									setSelectedYear(parseInt(e.target.value))
								}
								className={styles.select}
							>
								{availableYears.map((year) => (
									<option key={year} value={year}>
										{year}年
									</option>
								))}
							</select>
						</div>

						<div className={styles.controlGroup}>
							<label>起始月:</label>
							<select
								value={selectedMonthFrom}
								onChange={(e) => handleMonthFromChange(parseInt(e.target.value))}
								className={styles.select}
							>
								{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
									<option key={m} value={m}>
										{m}月
									</option>
								))}
							</select>
						</div>

						<div className={styles.controlGroup}>
							<label>結束月:</label>
							<select
								value={selectedMonthTo}
								onChange={(e) => handleMonthToChange(parseInt(e.target.value))}
								className={styles.select}
							>
								{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
									<option key={m} value={m}>
										{m}月
									</option>
								))}
							</select>
						</div>
					</div>

					<div className={styles.buttonGroup}>
						<button
							onClick={captureScreenshot}
							className={styles.screenshotButton}
							disabled={capturing}
						>
							{capturing ? "⏳ 截圖中..." : "📸 截圖"}
						</button>
						<button
							onClick={exportToExcel}
							className={styles.exportButton}
							disabled={exporting}
						>
							{exporting ? "⏳ 匯出中..." : "📊 匯出 Excel"}
						</button>
					</div>
				</div>

				<div className={styles.summary}>
					<span className={styles.summaryItem}>
						總案件數: <strong>{totalCases}</strong>
					</span>
					<span className={styles.summaryItem}>
						EF代碼種類: <strong>{activeCodes.length}</strong>
					</span>
					<span className={styles.summaryItem}>
						HFACS種類:{" "}
						<strong>{hfacsLoading ? "..." : hfacsData?.codes.length ?? 0}</strong>
					</span>
				</div>
			</div>

			<div className={styles.section}>
				<div className={styles.tableSectionHeader}>
					<h3>📅 {selectedYear}年 統計表{hfacsLoading ? "（載入中...）" : ""}</h3>
					<div className={styles.toggleGroup}>
						<button
							className={dataType === "ef" ? styles.toggleActive : styles.toggleButton}
							onClick={() => setDataType("ef")}
						>
							EF代碼
						</button>
						<button
							className={dataType === "hfacs" ? styles.toggleActive : styles.toggleButton}
							onClick={() => setDataType("hfacs")}
						>
							HFACS代碼
						</button>
					</div>
				</div>
				<div className={styles.tableContainer}>
						<table className={styles.statsTable}>
							<thead>
								<tr>
									<th>{dataType === "hfacs" ? "HFACS代碼" : "EF代碼"}</th>
									<th className={styles.descriptionColumn}>
										內容
									</th>
									{tableActiveMonths.map((month) => {
										const [, monthNum] = month.split("-");
										return (
											<th key={month}>
												{parseInt(monthNum)}月
											</th>
										);
									})}
									<th className={styles.totalColumn}>小計</th>
								</tr>
							</thead>
							<tbody>
								{tableActiveCodes.map((code) => {
									const total = Object.values(
										tableMonthlyStats[code]
									).reduce(
										(sum, data) => sum + data.count,
										0
									);
									return (
										<tr key={code}>
											<td className={styles.codeCell}>
												{code}
											</td>
											<td
												className={
													styles.descriptionCell
												}
											>
												{tableCodeDescriptions[code] ||
													code}
											</td>
											{tableActiveMonths.map((month) => {
												const data =
													tableMonthlyStats[code][month];
												const count = data?.count || 0;
												const sources = data?.sources
													? Array.from(data.sources)
													: [];
												return (
													<td
														key={month}
														className={
															styles.countCell
														}
														title={
															sources.length > 0
																? `資料來源: ${sources.join(
																		", "
																  )}`
																: ""
														}
													>
														{count > 0 ? (
															<div
																className={
																	styles.cellContent
																}
															>
																<span
																	className={
																		styles.count
																	}
																>
																	{count}
																</span>
																{sources.length >
																	1 && (
																	<span
																		className={
																			styles.sourceIndicator
																		}
																		title={sources.join(
																			", "
																		)}
																	>
																		(
																		{
																			sources.length
																		}
																		)
																	</span>
																)}
															</div>
														) : (
															"-"
														)}
													</td>
												);
											})}
											<td className={styles.totalCell}>
												{total}
											</td>
										</tr>
									);
								})}
								<tr className={styles.grandTotalRow}>
									<td className={styles.codeCell}>總計</td>
									<td className={styles.descriptionCell}>
										-
									</td>
									{tableActiveMonths.map((month) => {
										const monthTotal = tableActiveCodes.reduce(
											(sum, code) =>
												sum +
												(tableMonthlyStats[code][month]
													?.count || 0),
											0
										);
										return (
											<td
												key={month}
												className={styles.totalCell}
											>
												{monthTotal}
											</td>
										);
									})}
									<td className={styles.totalCell}>
										{tableActiveCodes.reduce(
											(sum, code) =>
												sum +
												Object.values(tableMonthlyStats[code]).reduce(
													(s, d) => s + d.count,
													0
												),
											0
										)}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<div className={styles.section}>
					<h3>🗃️ {selectedYear}年 類別分析{dataType === "hfacs" ? "（HFACS）" : "（EF）"}</h3>
					<div className={styles.pieChartContainer}>
						<ResponsiveContainer width="100%" height={460}>
							<PieChart margin={{ top: 50, right: 30, bottom: 30, left: 30 }}>
								<Pie
									data={activePieChartData}
									dataKey="value"
									nameKey="name"
									cx="50%"
									cy="48%"
									outerRadius={120}
									label={({ name, value, percent, payload }) => {
										const code = payload?.code;
										const suffix = code && code !== name ? `(${code})` : "";
										return `${name}${suffix} -${value}筆 (${((percent ?? 0) * 100).toFixed(1)}%)`;
									}}
								>
									{activePieChartData.map((entry) => (
										<Cell key={entry.code} fill={entry.color} />
									))}
								</Pie>
								<Tooltip
									contentStyle={{
										background: "#1a1f35",
										border: "1px solid rgba(255,255,255,0.1)",
										borderRadius: 8,
									}}
									itemStyle={{ color: "#e8e9ed" }}
									labelStyle={{ color: "#e8e9ed" }}
									formatter={(value: number, name: string, item: any) => {
										const pct = pieTotalCases ? ((value / pieTotalCases) * 100).toFixed(1) : "0.0";
										const code = item?.payload?.code;
										const label = code && code !== name ? `${name}(${code})` : name;
										return [`${value} 件 (${pct}%)`, label];
									}}
								/>
								<Legend
									wrapperStyle={{ paddingTop: 24 }}
									formatter={(value) => (
										<span style={{ color: "#e8e9ed" }}>{value}</span>
									)}
								/>
							</PieChart>
						</ResponsiveContainer>
					</div>
				</div>

			<div className={styles.section}>
				<div className={styles.sectionHeader}>
					<h3>📊 代碼組成分析{dataType === "hfacs" ? "（HFACS）" : "（EF）"}</h3>
					<input
						type="text"
						className={styles.searchInput}
						placeholder="搜尋代碼或描述..."
						value={compositionSearch}
						onChange={(e) => setCompositionSearch(e.target.value)}
					/>
				</div>

				{filteredComposition.length === 0 ? (
					<div className={styles.emptyState}>
						<p>{compositionSearch ? "找不到符合的代碼" : "本期間尚無資料"}</p>
					</div>
				) : (
					<div className={styles.compositionList}>
						{filteredComposition.map((c) => {
							const isSelected = selectedTrendCode === c.code;
							return (
								<button
									key={c.code}
									className={`${styles.compositionRow} ${isSelected ? styles.compositionRowActive : ""}`}
									onClick={() => setSelectedTrendCode(isSelected ? null : c.code)}
								>
									<div className={styles.compositionRowHeader}>
										<span className={styles.compositionCode}>
											{c.code}
											<span className={styles.compositionDesc}>{c.description}</span>
										</span>
										<span className={styles.compositionTotal}>{c.total} 件</span>
									</div>
									<div className={styles.compositionBar}>
										<div
											className={styles.compositionSegment}
											style={{ width: "100%", background: "#4a9eff" }}
										>
											{c.total} 件
										</div>
									</div>
								</button>
							);
						})}
					</div>
				)}

				{!compositionSearch && barChartCodes.length > 10 && (
					<button
						className={styles.showAllButton}
						onClick={() => setShowAllComposition((v) => !v)}
					>
						{showAllComposition ? "只顯示前 10 項" : `顯示全部 (${barChartCodes.length})`}
					</button>
				)}

				{selectedTrendCode && (
					<div className={styles.trendPanel}>
						<div className={styles.trendPanelHeader}>
							<h4>
								📈 {selectedTrendCode}
								{selectedTrendDescription && (
									<span className={styles.compositionDesc}>{selectedTrendDescription}</span>
								)}
								{" "}趨勢
							</h4>
							<button
								className={styles.closeButton}
								onClick={() => setSelectedTrendCode(null)}
							>
								×
							</button>
						</div>
						{trendCodeSeries.length === 0 ? (
							<div className={styles.emptyState}>
								<p>本期間尚無資料</p>
							</div>
						) : (
							<ResponsiveContainer width="100%" height={280}>
								<LineChart data={trendCodeSeries} margin={{ top: 20, right: 30, bottom: 10, left: 0 }}>
									<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
									<XAxis dataKey="period" stroke="#a0aec0" fontSize={12} />
									<YAxis stroke="#a0aec0" fontSize={12} allowDecimals={false} />
									<Tooltip
										contentStyle={{
											background: "#1a1f35",
											border: "1px solid rgba(255,255,255,0.1)",
											borderRadius: 8,
										}}
										itemStyle={{ color: "#e8e9ed" }}
										labelStyle={{ color: "#e8e9ed" }}
									/>
									<Line
										type="monotone"
										dataKey="count"
										name="件數"
										stroke="#4a9eff"
										strokeWidth={2}
										dot={{ r: 3 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						)}
					</div>
				)}
			</div>

			<div className={styles.section}>
				<h3>📊 {selectedYear}年 {dataType === "hfacs" ? "HFACS代碼統計圖" : "EF代碼統計圖"}</h3>
				<div className={styles.chartContainer}>
					<div className={styles.barChart}>
						{barChartCodes.map(({ code, description, total }) => {
								const maxCount = Math.max(
									...barChartCodes.map((c) => c.total),
									1
								);
								const percentage =
									maxCount > 0 ? (total / maxCount) * 100 : 0;
								const pixelHeight = (percentage / 100) * 280; // 380px chart - 52px info - 48px top padding
									return (
										<div key={code} className={styles.barItem}>
											<div className={styles.barInfo}>
												<div className={styles.barCode}>
													{code}
												</div>
												<div className={styles.barDescription}>
													{description}
												</div>
											</div>
											<div className={styles.barTrack}>
												<div
													className={styles.barFill}
													style={{
														height: `${pixelHeight}px`,
														['--percentage' as any]: `${percentage}%`,
													}}
												>
													<span
														className={styles.barValue}
													>
														{total}
													</span>
												</div>
											</div>
										</div>
									);
							})}
					</div>
				</div>
			</div>

			<div className={styles.section}>
				<h3>📈 年度比較</h3>
				<div className={styles.comparisonControls}>
					<div className={styles.controlGroup}>
						<label>年份1:</label>
						<select
							value={compareYear1}
							onChange={(e) =>
								setCompareYear1(parseInt(e.target.value))
							}
							className={styles.select}
						>
							{availableYears.map((year) => (
								<option key={year} value={year}>
									{year}年
								</option>
							))}
						</select>
					</div>
					<span className={styles.vs}>VS</span>
					<div className={styles.controlGroup}>
						<label>年份2:</label>
						<select
							value={compareYear2}
							onChange={(e) =>
								setCompareYear2(parseInt(e.target.value))
							}
							className={styles.select}
						>
							{availableYears.map((year) => (
								<option key={year} value={year}>
									{year}年
								</option>
							))}
						</select>
					</div>
				</div>

				<div className={styles.comparisonChart}>
					{Array.from(
						new Set([
							...Object.keys(comparisonData.year1),
							...Object.keys(comparisonData.year2),
						])
					)
						.sort()
						.map((code) => {
							const y1Count = comparisonData.year1[code] || 0;
							const y2Count = comparisonData.year2[code] || 0;
							const maxCount = Math.max(
								...Object.values(comparisonData.year1),
								...Object.values(comparisonData.year2)
							);
							return (
								<div
									key={code}
									className={styles.comparisonGroup}
								>
									<div className={styles.comparisonLabel}>
										<div className={styles.comparisonCode}>
											{code}
										</div>
										<div className={styles.comparisonDesc}>
											{efCodeDescriptions[code] || code}
										</div>
									</div>
									<div className={styles.comparisonBars}>
										<div className={styles.comparisonBar}>
											<div
												className={
													styles.comparisonBarFill
												}
												style={{
													width:
														maxCount > 0
															? `${
																	(y1Count /
																		maxCount) *
																	100
															  }%`
															: "0",
													backgroundColor: "#4a9eff",
												}}
											>
												<span
													className={
														styles.comparisonValue
													}
												>
													{y1Count || ""}
												</span>
											</div>
										</div>
										<div className={styles.comparisonBar}>
											<div
												className={
													styles.comparisonBarFill
												}
												style={{
													width:
														maxCount > 0
															? `${
																	(y2Count /
																		maxCount) *
																	100
															  }%`
															: "0",
													backgroundColor: "#f59e0b",
												}}
											>
												<span
													className={
														styles.comparisonValue
													}
												>
													{y2Count || ""}
												</span>
											</div>
										</div>
									</div>
									<div className={styles.comparisonDiff}>
										{y1Count - y2Count > 0 ? "+" : ""}
										{y1Count - y2Count}
									</div>
								</div>
							);
						})}
				</div>

				<div className={styles.comparisonLegend}>
					<span className={styles.legendItem}>
						<span
							className={styles.legendDot}
							style={{ backgroundColor: "#4a9eff" }}
						></span>
						{compareYear1}年
					</span>
					<span className={styles.legendItem}>
						<span
							className={styles.legendDot}
							style={{ backgroundColor: "#f59e0b" }}
						></span>
						{compareYear2}年
					</span>
				</div>
			</div>
		</div>
	);
}