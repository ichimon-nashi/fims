// src/components/sms/TrendAnalysisTab.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { saveAs } from "file-saver";
import styles from "./TrendAnalysisTab.module.css";
import TrendRecordsModal from "./TrendRecordsModal";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type CodeType = "hfacs" | "ef";
type Granularity = "month" | "quarter" | "halfYear" | "year";
type TrendMode = "code" | "category" | "area";

interface CodeBucket {
	code: string;
	description: string;
	category: string;
	srm: number;
	self: number;
	total: number;
}

interface CategoryBucket {
	category: string;
	srm: number;
	self: number;
	total: number;
}

interface AreaBucket {
	area: string;
	srm: number;
	self: number;
	total: number;
}

type MonthSplit = Record<string, { srm: number; self: number }>;

interface TrendAnalysisResponse {
	type: CodeType;
	months: string[];
	codes: CodeBucket[];
	categories: CategoryBucket[];
	areas: AreaBucket[];
	trendByCode: Record<string, MonthSplit>;
	trendByCategory: Record<string, MonthSplit>;
	trendByArea: Record<string, MonthSplit>;
}

const SRM_COLOR = "#4a9eff"; // existing app accent blue
const SELF_COLOR = "#fb923c"; // existing app orange (already used for 組員報告/趨勢分析 elsewhere)

const currentYear = new Date().getFullYear();

// Rolls monthly "YYYY-MM" keys up into quarter/half-year/year period labels,
// summing srm/self counts for whichever months fall in each period.
type PeriodValue = { period: string; srm: number | null; self: number | null };

function currentMonthKey(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function rollUp(months: string[], split: MonthSplit, granularity: Granularity, hideFuture: boolean = false): PeriodValue[] {
	const nowKey = currentMonthKey();

	if (granularity === "month") {
		return months.map((m) => {
			const isFuture = hideFuture && m > nowKey;
			return {
				period: m,
				srm: isFuture ? null : split[m]?.srm ?? 0,
				self: isFuture ? null : split[m]?.self ?? 0,
			};
		});
	}

	const periodOf = (m: string): string => {
		const [yStr, moStr] = m.split("-");
		const y = parseInt(yStr, 10);
		const mo = parseInt(moStr, 10);
		if (granularity === "quarter") return `${y} Q${Math.ceil(mo / 3)}`;
		if (granularity === "halfYear") return `${y} ${mo <= 6 ? "上半年" : "下半年"}`;
		return `${y}`;
	};

	const order: string[] = [];
	const sums: Record<string, { srm: number; self: number; minMonth: string }> = {};
	months.forEach((m) => {
		const p = periodOf(m);
		if (!sums[p]) {
			sums[p] = { srm: 0, self: 0, minMonth: m };
			order.push(p);
		} else if (m < sums[p].minMonth) {
			sums[p].minMonth = m;
		}
		sums[p].srm += split[m]?.srm ?? 0;
		sums[p].self += split[m]?.self ?? 0;
	});

	// A bucket only counts as "future" if its EARLIEST month hasn't
	// happened yet — a quarter straddling past and future months still
	// shows its real partial sum, not a gap.
	return order.map((p) => {
		const isFuture = hideFuture && sums[p].minMonth > nowKey;
		return { period: p, srm: isFuture ? null : sums[p].srm, self: isFuture ? null : sums[p].self };
	});
}

// Sums a rolled-up series across a set of period labels. Null (future,
// no data) contributes 0 — summing across a range has no ambiguity the
// way a single continuous time point does, so this doesn't need the
// hideFuture distinction rollUp makes.
// Sums raw monthly srm/self counts across a set of month keys — used for
// the calendar-year comparison, which operates directly on months rather
// than a granularity-bucketed series.
function sumMonths(split: MonthSplit, months: string[]): { srm: number; self: number } {
	return months.reduce(
		(acc, m) => {
			acc.srm += split[m]?.srm ?? 0;
			acc.self += split[m]?.self ?? 0;
			return acc;
		},
		{ srm: 0, self: 0 }
	);
}

export default function TrendAnalysisTab() {
	const router = useRouter();
	const [fromYear, setFromYear] = useState(Math.max(2024, currentYear - 1));
	const [toYear, setToYear] = useState(currentYear);
	const [type, setType] = useState<CodeType>("hfacs");
	const [loading, setLoading] = useState(true);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hfacsData, setHfacsData] = useState<TrendAnalysisResponse | null>(null);
	const [efData, setEfData] = useState<TrendAnalysisResponse | null>(null);

	const [searchTerm, setSearchTerm] = useState("");
	const [showAll, setShowAll] = useState(false);
	const [showAllComparison, setShowAllComparison] = useState(false);
	const [recordsModal, setRecordsModal] = useState<{
		code: string;
		description: string;
		source: "srm" | "routine";
	} | null>(null);
	const [hiddenTrendLines, setHiddenTrendLines] = useState<Set<string>>(new Set());
	const [showAllTrendCodes, setShowAllTrendCodes] = useState(false);

	const toggleTrendLine = (code: string) => {
		setHiddenTrendLines((prev) => {
			const next = new Set(prev);
			if (next.has(code)) next.delete(code);
			else next.add(code);
			return next;
		});
	};

	const [trendMode, setTrendMode] = useState<TrendMode>("code");
	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [selectedArea, setSelectedArea] = useState<string | null>(null);
	const [trendGranularity, setTrendGranularity] = useState<Granularity>("month");
	const [comparisonGranularity, setComparisonGranularity] = useState<Granularity>("month");
	const [comparisonType, setComparisonType] = useState<CodeType>("hfacs");
	const [mitigationView, setMitigationView] = useState<"list" | "overview">("list");

	// Both code types are always fetched together now — HFACS/EF toggles
	// for 趨勢分析 and 風險緩解分析 are independent (see comparisonType),
	// so both datasets need to already be in memory rather than
	// re-fetching whichever one wasn't currently displayed.
	const data = useMemo(() => (type === "hfacs" ? hfacsData : efData), [type, hfacsData, efData]);
	const comparisonData = useMemo(() => (comparisonType === "hfacs" ? hfacsData : efData), [comparisonType, hfacsData, efData]);

	useEffect(() => {
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fromYear, toYear]);

	// Default trend selection to the top code/category/area whenever the
	// relevant dataset changes (type toggled, or a fresh fetch arrived).
	useEffect(() => {
		if (!data) return;
		if (data.codes.length > 0) setSelectedCode(data.codes[0].code);
		if (data.categories.length > 0) setSelectedCategory(data.categories[0].category);
		if (data.areas.length > 0) setSelectedArea(data.areas[0].area);
	}, [data]);

	// EF codes have no area tier (see route) — if the user had "area" mode
	// selected under HFACS and switches to EF, fall back to category
	// rather than leaving the trend chart pointed at empty data.
	useEffect(() => {
		if (type === "ef" && trendMode === "area") {
			setTrendMode("category");
		}
	}, [type, trendMode]);

	// Swap (not clamp) when the range would invert — preserves both
	// selected years rather than collapsing them together. See the same
	// fix applied to StatisticsTab.tsx's month range.
	const handleFromYearChange = (y: number) => {
		if (y > toYear) {
			setFromYear(toYear);
			setToYear(y);
		} else {
			setFromYear(y);
		}
	};

	const handleToYearChange = (y: number) => {
		if (y < fromYear) {
			setToYear(fromYear);
			setFromYear(y);
		} else {
			setToYear(y);
		}
	};

	const fetchData = async () => {
		setLoading(true);
		setError(null);
		try {
			const token = localStorage.getItem("token");
			const years = [];
			for (let y = fromYear; y <= toYear; y++) years.push(y);
			const baseParams = { years: years.join(","), month_from: "1", month_to: "12" };

			const [hfacsRes, efRes] = await Promise.all([
				fetch(`/api/sms/trend-analysis?${new URLSearchParams({ ...baseParams, type: "hfacs" })}`, {
					headers: { Authorization: `Bearer ${token}` },
				}),
				fetch(`/api/sms/trend-analysis?${new URLSearchParams({ ...baseParams, type: "ef" })}`, {
					headers: { Authorization: `Bearer ${token}` },
				}),
			]);

			if (!hfacsRes.ok || !efRes.ok) {
				const failedRes = !hfacsRes.ok ? hfacsRes : efRes;
				const err = await failedRes.json().catch(() => ({}));
				throw new Error(err.error || "Failed to load trend analysis");
			}

			const hfacsJson: TrendAnalysisResponse = await hfacsRes.json();
			const efJson: TrendAnalysisResponse = await efRes.json();
			setHfacsData(hfacsJson);
			setEfData(efJson);
		} catch (e: any) {
			console.error("Error fetching trend analysis:", e);
			setError(e.message || "載入失敗");
		} finally {
			setLoading(false);
		}
	};

	const filteredCodes = useMemo(() => {
		if (!data) return [];
		if (!searchTerm.trim()) {
			return showAll ? data.codes : data.codes.slice(0, 10);
		}
		const term = searchTerm.toLowerCase();
		return data.codes.filter(
			(c) => c.code.toLowerCase().includes(term) || c.description.toLowerCase().includes(term)
		);
	}, [data, searchTerm, showAll]);

	const trendSeries = useMemo(() => {
		if (!data) return [];
		if (trendMode === "code" && selectedCode) {
			const split = data.trendByCode[selectedCode] ?? {};
			return rollUp(data.months, split, trendGranularity, true);
		}
		if (trendMode === "category" && selectedCategory) {
			const split = data.trendByCategory[selectedCategory] ?? {};
			return rollUp(data.months, split, trendGranularity, true);
		}
		if (trendMode === "area" && selectedArea) {
			const split = data.trendByArea[selectedArea] ?? {};
			return rollUp(data.months, split, trendGranularity, true);
		}
		return [];
	}, [data, trendMode, selectedCode, selectedCategory, selectedArea, trendGranularity]);

	// Every available period label at the current comparison granularity —
	// scoped to comparisonData (風險緩解分析's own independent HFACS/EF
	// selection), not the trend chart's dataset above.
	const allPeriods = useMemo(() => {
		if (!comparisonData) return [];
		return rollUp(comparisonData.months, {}, comparisonGranularity).map((p) => p.period);
	}, [comparisonData, comparisonGranularity]);

	// Comparison is always fromYear vs toYear (the same year range already
	// set at the top of the page) — a natural "2025 vs 2026", not an
	// arbitrary midpoint split of the month list. Deliberately independent
	// of comparisonGranularity, which is now purely a display setting for
	// the overview line chart below, not part of what's being compared.
	const periodARange = useMemo(() => {
		if (!comparisonData || fromYear === toYear) return { periods: [] as string[], label: "" };
		const periods = comparisonData.months.filter((m) => parseInt(m.slice(0, 4), 10) === fromYear);
		return { periods, label: `${fromYear}年` };
	}, [comparisonData, fromYear, toYear]);

	const periodBRange = useMemo(() => {
		if (!comparisonData || fromYear === toYear) return { periods: [] as string[], label: "" };
		const periods = comparisonData.months.filter((m) => parseInt(m.slice(0, 4), 10) === toYear);
		return { periods, label: `${toYear}年` };
	}, [comparisonData, fromYear, toYear]);

	// Top 10 codes, ranked by relevance to the two years actually being
	// compared (their combined activity summed across each full year),
	// not by total across the entire fetched year range. Rows with zero
	// in both years are dropped entirely rather than shown as noise.
	const allComparisonRows = useMemo(() => {
		if (!comparisonData || periodARange.periods.length === 0 || periodBRange.periods.length === 0) return [];
		const rows = comparisonData.codes
			.map((c) => {
				const split = comparisonData.trendByCode[c.code] ?? {};
				const aSum = sumMonths(split, periodARange.periods);
				const bSum = sumMonths(split, periodBRange.periods);
				return {
					code: c.code,
					description: c.description,
					a: { period: periodARange.label, srm: aSum.srm, self: aSum.self },
					b: { period: periodBRange.label, srm: bSum.srm, self: bSum.self },
				};
			})
			.filter((r) => r.a.srm + r.a.self + r.b.srm + r.b.self > 0);

		rows.sort((x, y) => {
			const totalX = x.a.srm + x.a.self + x.b.srm + x.b.self;
			const totalY = y.a.srm + y.a.self + y.b.srm + y.b.self;
			return totalY - totalX; // most relevant to this specific comparison first
		});
		return rows;
	}, [comparisonData, periodARange, periodBRange]);

	const topCodesComparison = useMemo(() => {
		const visible = showAllComparison ? allComparisonRows : allComparisonRows.slice(0, 10);
		return [...visible].sort((x, y) => {
			const diffX = x.b.srm + x.b.self - (x.a.srm + x.a.self);
			const diffY = y.b.srm + y.b.self - (y.a.srm + y.a.self);
			return diffX - diffY; // most-improved (largest decrease) first, for display
		});
	}, [allComparisonRows, showAllComparison]);

	// Fixed palette for the top-10 trend lines — reuses hex values already
	// established elsewhere in this app (StatisticsTab's category colors,
	// SRM_COLOR/SELF_COLOR) rather than inventing new ones. Cycled if more
	// than 10 lines somehow render.
	const TREND_LINE_COLORS = [
		"#4a9eff", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
		"#ec4899", "#6366f1", "#fb923c", "#1baf7a", "#e87ba4",
	];

	// Collective overview, corrected: time stays on the x-axis (a line
	// chart only makes sense along a continuous axis — codes on the x-axis
	// was the earlier mistake, since there's no real relationship between
	// adjacent codes for a line's slope to represent). One line per top-10
	// risk, each showing that code's combined SRM+自督 count over the full
	// selected range — this is what actually shows whether each risk is
	// individually trending up or down.
	const topCodesForTrend = useMemo(() => {
		if (!comparisonData) return [];
		const codes = showAllTrendCodes ? comparisonData.codes : comparisonData.codes.slice(0, 10);
		return codes.map((c) => ({ code: c.code, description: c.description }));
	}, [comparisonData, showAllTrendCodes]);

	const codeDescLookup = useMemo(() => {
		return Object.fromEntries(topCodesForTrend.map((c) => [c.code, c.description]));
	}, [topCodesForTrend]);

	const topCodesTrendSeries = useMemo(() => {
		if (!comparisonData) return [];
		return allPeriods.map((period) => {
			const row: Record<string, string | number | null> = { period };
			topCodesForTrend.forEach(({ code }) => {
				const series = rollUp(comparisonData.months, comparisonData.trendByCode[code] ?? {}, comparisonGranularity, true);
				const entry = series.find((p) => p.period === period);
				row[code] = entry && entry.srm !== null && entry.self !== null ? entry.srm + entry.self : null;
			});
			return row;
		});
	}, [comparisonData, allPeriods, topCodesForTrend, comparisonGranularity]);

	const trendLabel = useMemo(() => {
		if (trendMode === "code" && selectedCode) {
			const c = data?.codes.find((c) => c.code === selectedCode);
			return c ? `${c.code} — ${c.description}` : selectedCode;
		}
		if (trendMode === "category" && selectedCategory) return selectedCategory;
		if (trendMode === "area" && selectedArea) return selectedArea;
		return "";
	}, [trendMode, selectedCode, selectedCategory, selectedArea, data]);

	function granularityLabelOf(g: Granularity): string {
		switch (g) {
			case "month":
				return "月";
			case "quarter":
				return "季";
			case "halfYear":
				return "半年";
			case "year":
				return "年";
		}
	}

	const trendGranularityLabel = useMemo(() => granularityLabelOf(trendGranularity), [trendGranularity]);
	const comparisonGranularityLabel = useMemo(() => granularityLabelOf(comparisonGranularity), [comparisonGranularity]);

	const yearOptions = useMemo(() => {
		const years = [];
		for (let y = currentYear + 1; y >= 2024; y--) years.push(y);
		return years;
	}, []);

	const exportToExcel = async () => {
		setExporting(true);
		try {
			const token = localStorage.getItem("token");

			const response = await fetch("/api/sms/trend-analysis/export", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					hfacsCodes: hfacsData?.codes ?? [],
					efCodes: efData?.codes ?? [],
					trendLabel: trendLabel || "全部",
					trendGranularityLabel,
					comparisonGranularityLabel,
					trendSeries,
					topCodesForTrend,
					topCodesTrendSeries,
					periodALabel: periodARange.label,
					periodBLabel: periodBRange.label,
					topCodesComparison,
				}),
			});
			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				throw new Error(err.error || "匯出失敗");
			}
			const blob = await response.blob();
			saveAs(blob, `趨勢分析_${trendLabel || "全部"}.xlsx`);
		} catch (e: any) {
			console.error("Export error:", e);
			alert("匯出失敗：" + (e.message || "未知錯誤"));
		} finally {
			setExporting(false);
		}
	};

	if (loading && !data && !error) {
		return (
			<div className={styles.loading}>
				<div className={styles.spinner} />
				<p>載入趨勢分析中...</p>
			</div>
		);
	}

	return (
		<div className={styles.trendAnalysisTab}>
			<div className={styles.header}>
				<div className={styles.controls}>
					<div className={styles.yearControlsRow}>
						<div className={styles.controlGroup}>
							<label>起始年:</label>
							<select
								className={styles.select}
								value={fromYear}
								onChange={(e) => handleFromYearChange(parseInt(e.target.value))}
							>
								{yearOptions.map((y) => (
									<option key={y} value={y}>
										{y}年
									</option>
								))}
							</select>
						</div>
						<div className={styles.controlGroup}>
							<label>結束年:</label>
							<select
								className={styles.select}
								value={toYear}
								onChange={(e) => handleToYearChange(parseInt(e.target.value))}
							>
								{yearOptions.map((y) => (
									<option key={y} value={y}>
										{y}年
									</option>
								))}
							</select>
						</div>
					</div>

					<div className={styles.typeToggle}>
						<button
							className={type === "hfacs" ? styles.typeActive : ""}
							onClick={() => setType("hfacs")}
						>
							HFACS 代碼
						</button>
						<button
							className={type === "ef" ? styles.typeActive : ""}
							onClick={() => setType("ef")}
						>
							EF 代碼
						</button>
					</div>

					<button
						className={styles.exportButton}
						onClick={exportToExcel}
						disabled={exporting || !data}
					>
						{exporting ? "⏳ 匯出中..." : "📊 匯出 Excel"}
					</button>
				</div>

				<div className={styles.legendRow}>
					<span className={styles.legendItem}>
						<span className={styles.legendDot} style={{ background: SRM_COLOR }} />
						SRM
					</span>
					<span className={styles.legendItem}>
						<span className={styles.legendDot} style={{ background: SELF_COLOR }} />
						自督
					</span>

					<span className={styles.sourceLinks}>
						資料來源：
						<button
							className={`${styles.sourceLinkButton} ${styles.sourceLinkSrm}`}
							onClick={() => router.push("/sms?tab=statistics")}
						>
							SMS統計 ↗
						</button>
						<button
							className={`${styles.sourceLinkButton} ${styles.sourceLinkRoutine}`}
							onClick={() => router.push("/audit/routine")}
						>
							例行性查核彙整 ↗
						</button>
					</span>
				</div>
			</div>

			{error && (
				<div className={styles.errorBanner}>
					<span>⚠️ {error}</span>
					<button onClick={fetchData}>重試</button>
				</div>
			)}

			{!error && !data && (
				<div className={styles.loading}>
					<div className={styles.spinner} />
				</div>
			)}

			{!error && data && (
				<>
					{/* Composition */}
					<div className={styles.section}>
				<div className={styles.sectionHeader}>
					<h3>📊 代碼組成分析 — 依來源</h3>
					<input
						type="text"
						className={styles.searchInput}
						placeholder="搜尋代碼或描述..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>

				{filteredCodes.length === 0 ? (
					<div className={styles.emptyState}>
						<p>{searchTerm ? "找不到符合的代碼" : "本期間尚無資料"}</p>
					</div>
				) : (
					<div className={styles.compositionList}>
						{filteredCodes.map((c) => {
							const srmPct = c.total > 0 ? Math.round((c.srm / c.total) * 100) : 0;
							const selfPct = 100 - srmPct;
							const isSelected = trendMode === "code" && selectedCode === c.code;
							return (
								<button
									key={c.code}
									className={`${styles.compositionRow} ${isSelected ? styles.compositionRowActive : ""}`}
									onClick={() => {
										setTrendMode("code");
										setSelectedCode(c.code);
									}}
								>
									<div className={styles.compositionRowHeader}>
										<span className={styles.compositionCode}>
											{c.code}
											<span className={styles.compositionDesc}>{c.description}</span>
										</span>
										<span className={styles.compositionTotal}>{c.total} 件</span>
									</div>
									<div className={styles.compositionBar}>
										{c.srm > 0 && (
											<div
												className={styles.compositionSegment}
												style={{ width: `${srmPct}%`, background: SRM_COLOR }}
											>
												{srmPct >= 15 && `${c.srm} (${srmPct}%)`}
											</div>
										)}
										{c.self > 0 && (
											<div
												className={styles.compositionSegment}
												style={{ width: `${selfPct}%`, background: SELF_COLOR }}
											>
												{selfPct >= 15 && `${c.self} (${selfPct}%)`}
											</div>
										)}
									</div>
								</button>
							);
						})}
					</div>
				)}

				{!searchTerm && data.codes.length > 10 && (
					<button className={styles.showAllButton} onClick={() => setShowAll((v) => !v)}>
						{showAll ? "只顯示前 10 項" : `顯示全部 (${data.codes.length})`}
					</button>
				)}
			</div>

			{/* Trend */}
			<div className={styles.section}>
				<div className={styles.sectionHeader}>
					<h3>📈 趨勢分析</h3>
					<div className={styles.trendControls}>
						<div className={styles.typeToggle}>
							<button
								className={trendMode === "code" ? styles.typeActive : ""}
								onClick={() => setTrendMode("code")}
							>
								個別代碼
							</button>
							<button
								className={trendMode === "category" ? styles.typeActive : ""}
								onClick={() => setTrendMode("category")}
							>
								分類彙總
							</button>
							{type === "hfacs" && (
								<button
									className={trendMode === "area" ? styles.typeActive : ""}
									onClick={() => setTrendMode("area")}
								>
									領域彙總
								</button>
							)}
						</div>

						{trendMode === "code" && (
							<select
								className={styles.select}
								value={selectedCode ?? ""}
								onChange={(e) => setSelectedCode(e.target.value)}
							>
								{data.codes.map((c) => (
									<option key={c.code} value={c.code}>
										{c.code} — {c.description}
									</option>
								))}
							</select>
						)}
						{trendMode === "category" && (
							<select
								className={styles.select}
								value={selectedCategory ?? ""}
								onChange={(e) => setSelectedCategory(e.target.value)}
							>
								{data.categories.map((cat) => (
									<option key={cat.category} value={cat.category}>
										{cat.category}
									</option>
								))}
							</select>
						)}
						{trendMode === "area" && (
							<select
								className={styles.select}
								value={selectedArea ?? ""}
								onChange={(e) => setSelectedArea(e.target.value)}
							>
								{data.areas.map((a) => (
									<option key={a.area} value={a.area}>
										{a.area}
									</option>
								))}
							</select>
						)}

						<div className={styles.typeToggle}>
							<button
								className={trendGranularity === "month" ? styles.typeActive : ""}
								onClick={() => setTrendGranularity("month")}
							>
								月
							</button>
							<button
								className={trendGranularity === "quarter" ? styles.typeActive : ""}
								onClick={() => setTrendGranularity("quarter")}
							>
								季
							</button>
							<button
								className={trendGranularity === "halfYear" ? styles.typeActive : ""}
								onClick={() => setTrendGranularity("halfYear")}
							>
								半年
							</button>
							<button
								className={trendGranularity === "year" ? styles.typeActive : ""}
								onClick={() => setTrendGranularity("year")}
							>
								年
							</button>
						</div>
					</div>
				</div>

				{trendSeries.length === 0 ? (
					<div className={styles.emptyState}>
						<p>尚無資料可顯示趨勢</p>
					</div>
				) : (
					<ResponsiveContainer width="100%" height={340}>
						<LineChart data={trendSeries} margin={{ top: 20, right: 30, bottom: 10, left: 0 }}>
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
							<Legend
								formatter={(value) => <span style={{ color: "#e8e9ed" }}>{value}</span>}
							/>
							<Line type="monotone" dataKey="srm" name="SRM" stroke={SRM_COLOR} strokeWidth={2} dot={{ r: 3 }} />
							<Line type="monotone" dataKey="self" name="自督" stroke={SELF_COLOR} strokeWidth={2} dot={{ r: 3 }} />
						</LineChart>
					</ResponsiveContainer>
				)}
			</div>

			{/* Period comparison — answers "did mitigation actually reduce this",across the top 10 codes at once rather than one at a time — plus a collective overview toggle for a whole-programme view instead of drilling into individual risks. Both view modes share the same range pickers below, so they're always shown. */}
			<div className={styles.section}>
				<div className={styles.sectionHeader}>
					<h3>⚖️ 風險緩解分析</h3>
					<div className={styles.typeToggle}>
						<button
							className={mitigationView === "list" ? styles.typeActive : ""}
							onClick={() => setMitigationView("list")}
						>
							個別代碼比較
						</button>
						<button
							className={mitigationView === "overview" ? styles.typeActive : ""}
							onClick={() => setMitigationView("overview")}
						>
							整體趨勢總覽
						</button>
					</div>
				</div>

				<div className={styles.mitigationHint}>
					{mitigationView === "overview"
						? showAllTrendCodes
							? "顯示全部風險代碼隨時間的變化趨勢（點選圖例可單獨顯示/隱藏個別代碼）"
							: "顯示前 10 大風險代碼隨時間的變化趨勢（點選圖例可單獨顯示/隱藏個別代碼）"
						: fromYear === toYear
						? "請選擇不同的起始年與結束年以進行比較"
						: `比較 ${fromYear}年 與 ${toYear}年 的風險緩解成效`}
				</div>

				<div className={styles.inlineControlsRow}>
					<div className={styles.typeToggle}>
						<button
							className={comparisonType === "hfacs" ? styles.typeActive : ""}
							onClick={() => setComparisonType("hfacs")}
						>
							HFACS 代碼
						</button>
						<button
							className={comparisonType === "ef" ? styles.typeActive : ""}
							onClick={() => setComparisonType("ef")}
						>
							EF 代碼
						</button>
					</div>

					{mitigationView === "overview" && (
						<div className={`${styles.controlGroup} ${styles.inlineControlsSpaced}`}>
							<label>時間單位:</label>
							<div className={styles.typeToggle}>
								<button
									className={comparisonGranularity === "month" ? styles.typeActive : ""}
									onClick={() => setComparisonGranularity("month")}
								>
									月
								</button>
								<button
									className={comparisonGranularity === "quarter" ? styles.typeActive : ""}
									onClick={() => setComparisonGranularity("quarter")}
								>
									季
								</button>
								<button
									className={comparisonGranularity === "halfYear" ? styles.typeActive : ""}
									onClick={() => setComparisonGranularity("halfYear")}
								>
									半年
								</button>
								<button
									className={comparisonGranularity === "year" ? styles.typeActive : ""}
									onClick={() => setComparisonGranularity("year")}
								>
									年
								</button>
							</div>
						</div>
					)}
				</div>

				{mitigationView === "overview" ? (
					topCodesTrendSeries.length === 0 ? (
						<div className={styles.emptyState}>
							<p>尚無資料可顯示</p>
						</div>
					) : (
						<>
							<div className={styles.trendLineActions}>
								<button
									className={styles.toggleAllLinesButton}
									onClick={() => {
										const allHidden =
											topCodesForTrend.length > 0 &&
											topCodesForTrend.every((c) => hiddenTrendLines.has(c.code));
										setHiddenTrendLines(
											allHidden ? new Set() : new Set(topCodesForTrend.map((c) => c.code))
										);
									}}
								>
									{topCodesForTrend.length > 0 && topCodesForTrend.every((c) => hiddenTrendLines.has(c.code))
										? "全部顯示"
										: "全部隱藏"}
								</button>
							</div>

							<ResponsiveContainer width="100%" height={520}>
								<LineChart data={topCodesTrendSeries} margin={{ top: 20, right: 30, bottom: 10, left: 0 }}>
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
									<Legend
										onClick={(e: any) => toggleTrendLine(e.dataKey)}
										formatter={(value, entry: any) => {
											const isHidden = hiddenTrendLines.has(entry?.dataKey ?? value);
											return (
												<span
													style={{
														color: isHidden ? "#6b7280" : "#ffffff",
														cursor: "pointer",
														textDecoration: isHidden ? "line-through" : "none",
													}}
												>
													{value}
													{codeDescLookup[value] && (
														<span className={styles.legendDesc}>
															{" "}
															— {codeDescLookup[value]}
														</span>
													)}
												</span>
											);
										}}
									/>
									{topCodesForTrend.map(({ code }, i) => (
										<Line
											key={code}
											type="monotone"
											dataKey={code}
											name={code}
											stroke={TREND_LINE_COLORS[i % TREND_LINE_COLORS.length]}
											strokeWidth={2}
											dot={{ r: 2 }}
											connectNulls={false}
											hide={hiddenTrendLines.has(code)}
										/>
									))}
								</LineChart>
							</ResponsiveContainer>

							{comparisonData && comparisonData.codes.length > 10 && (
								<button
									className={styles.showAllButton}
									onClick={() => setShowAllTrendCodes((v) => !v)}
								>
									{showAllTrendCodes ? "只顯示前 10 項" : `顯示全部 (${comparisonData.codes.length})`}
								</button>
							)}
						</>
					)
				) : fromYear === toYear ? (
					<div className={styles.emptyState}>
						<p>起始年與結束年相同，無法比較 — 請調整頁面上方的年份範圍</p>
					</div>
				) : topCodesComparison.length === 0 ? (
					<div className={styles.emptyState}>
						<p>本期間尚無資料</p>
					</div>
				) : (
					<>
						<div className={styles.presetSummary}>
							<span className={styles.presetSummaryRange}>{periodARange.label}</span>
							<span className={styles.vsLabel}>vs</span>
							<span className={styles.presetSummaryRange}>{periodBRange.label}</span>
						</div>

						<div className={styles.compareList}>
							{topCodesComparison.map(({ code, description, a, b }) => {
								const totalA = a.srm + a.self;
								const totalB = b.srm + b.self;
								const sampleSize = totalA + totalB;
								const diff = totalB - totalA;
								const pct = totalA > 0 ? Math.round((diff / totalA) * 100) : null;
								const improved = diff < 0;
								const unchanged = diff === 0;
								const maxTotal = Math.max(totalA, totalB, 1);

								return (
									<div key={code} className={styles.compareRow}>
										<div className={styles.compareRowHeader}>
											<span className={styles.compositionCode}>
												{code}
												<span className={styles.compositionDesc}>{description}</span>
												<span className={styles.sampleSizeTag}>n={sampleSize}</span>
											</span>
											<span
												className={
													unchanged
														? styles.deltaNeutral
														: improved
														? styles.deltaGood
														: styles.deltaBad
												}
											>
												{totalA} → {totalB}
												{" "}
												({diff > 0 ? "+" : ""}
												{diff}
												{pct !== null && `, ${diff > 0 ? "+" : ""}${pct}%`})
												{!unchanged && (improved ? " ↓ 改善" : " ↑ 惡化")}
											</span>
										</div>

										<div className={styles.compareMiniBars}>
											{[
												{ label: a.period, total: totalA, srm: a.srm, self: a.self },
												{ label: b.period, total: totalB, srm: b.srm, self: b.self },
											].map(({ label, total, srm, self }) => (
												<div key={label} className={styles.compareMiniBarRow}>
													<span className={styles.compareMiniBarLabel}>{label}</span>
													<div className={styles.compareMiniBarTrack}>
														<div
															className={styles.compareMiniBarFill}
															style={{ width: `${(total / maxTotal) * 100}%` }}
														>
															{srm > 0 && (
																<div
																	className={styles.compareBarSegment}
																	style={{ flex: srm, background: SRM_COLOR }}
																/>
															)}
															{self > 0 && (
																<div
																	className={styles.compareBarSegment}
																	style={{ flex: self, background: SELF_COLOR }}
																/>
															)}
														</div>
													</div>
													<span className={styles.compareMiniBarTotal}>{total}</span>
												</div>
											))}
										</div>

										<div className={styles.crossLinkRow}>
											<button
												className={`${styles.crossLinkButton} ${styles.crossLinkSrm}`}
												onClick={() => setRecordsModal({ code, description, source: "srm" })}
											>
												🔍 查看 SRM 相關記錄
											</button>
											<button
												className={`${styles.crossLinkButton} ${styles.crossLinkRoutine}`}
												onClick={() => setRecordsModal({ code, description, source: "routine" })}
											>
												🔍 查看例行性查核記錄
											</button>
										</div>
									</div>
								);
							})}
						</div>

						{!showAllComparison && allComparisonRows.length > 10 && (
							<button className={styles.showAllButton} onClick={() => setShowAllComparison(true)}>
								顯示全部 ({allComparisonRows.length})
							</button>
						)}
						{showAllComparison && allComparisonRows.length > 10 && (
							<button className={styles.showAllButton} onClick={() => setShowAllComparison(false)}>
								只顯示前 10 項
							</button>
						)}
					</>
				)}
			</div>
				</>
			)}

			{recordsModal && (
				<TrendRecordsModal
					code={recordsModal.code}
					description={recordsModal.description}
					type={comparisonType}
					source={recordsModal.source}
					yearA={fromYear}
					yearB={toYear}
					onClose={() => setRecordsModal(null)}
				/>
			)}
		</div>
	);
}