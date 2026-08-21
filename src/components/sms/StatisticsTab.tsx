// src/components/sms/StatisticsTab.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styles from "./StatisticsTab.module.css";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { EF_ATTRIBUTE_CATEGORIES } from "@/lib/sms.constants";
import TrendRecordsModal from "./TrendRecordsModal";

// ---- Ported from TrendAnalysisTab.tsx (rollUp + supporting types) ----
type MonthSplit = Record<string, { srm: number; self: number }>;
type Granularity = "month" | "quarter" | "halfYear" | "year";
type TrendMode = "code" | "category" | "area";
type PeriodValue = { period: string; srm: number | null; self: number | null };

interface FullTrendData {
	months: string[];
	codes: { code: string; description: string; total: number }[];
	categories: { category: string; total: number }[];
	areas: { area: string; total: number }[];
	trendByCode: Record<string, Record<string, { srm: number; self: number }>>;
	trendByCategory: Record<string, Record<string, { srm: number; self: number }>>;
	trendByArea: Record<string, Record<string, { srm: number; self: number }>>;
}

const SRM_COLOR = "#4a9eff";
const SELF_COLOR = "#fb923c";

function currentMonthKey(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// Rolls monthly "YYYY-MM" keys up into quarter/half-year/year period
// labels, summing srm/self counts for whichever months fall in each
// period.
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

// Sums raw monthly srm/self counts across a set of month keys — used for
// the calendar-year comparison in 風險緩解分析, which operates directly
// on months rather than a granularity-bucketed series.
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

// Same computation as 風險緩解分析's on-screen allComparisonRows, but as a
// plain function taking data explicitly rather than reading the
// comparisonType-selected mitigationData — so the export can build both
// EF and HFACS comparison tables unconditionally, not just whichever one
// is currently toggled on screen.
function computeComparisonRows(
	data: FullTrendData | null,
	year1: number,
	year2: number
): { code: string; description: string; year1Count: number; year2Count: number }[] {
	if (!data || year1 === year2) return [];
	const periodA = data.months.filter((m) => parseInt(m.slice(0, 4), 10) === year1);
	const periodB = data.months.filter((m) => parseInt(m.slice(0, 4), 10) === year2);
	if (periodA.length === 0 || periodB.length === 0) return [];
	const rows = data.codes
		.map((c) => {
			const split = data.trendByCode[c.code] ?? {};
			const aSum = sumMonths(split, periodA);
			const bSum = sumMonths(split, periodB);
			return {
				code: c.code,
				description: c.description,
				year1Count: aSum.srm + aSum.self,
				year2Count: bSum.srm + bSum.self,
			};
		})
		.filter((r) => r.year1Count + r.year2Count > 0);
	rows.sort((x, y) => y.year1Count + y.year2Count - (x.year1Count + x.year2Count));
	return rows;
}

// Same shape as 風險緩解分析's on-screen 整體趨勢總覽 (top 10 codes'
// counts per period), but again as a plain function so the export can
// build both EF and HFACS trend-overview series unconditionally.
function computeTrendOverview(
	data: FullTrendData | null,
	granularity: Granularity
): { periods: string[]; series: { code: string; description: string; values: (number | null)[] }[] } {
	if (!data) return { periods: [], series: [] };
	const periods = rollUp(data.months, {}, granularity).map((p) => p.period);
	const topCodes = data.codes.slice(0, 10);
	const series = topCodes.map((c) => {
		const rolled = rollUp(data.months, data.trendByCode[c.code] ?? {}, granularity, true);
		const values = periods.map((period) => {
			const entry = rolled.find((p) => p.period === period);
			return entry && entry.srm !== null && entry.self !== null ? entry.srm + entry.self : null;
		});
		return { code: c.code, description: c.description, values };
	});
	return { periods, series };
}

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
	const [startYear, setStartYear] = useState<number>(new Date().getFullYear());
	const [startMonth, setStartMonth] = useState<number>(1);
	const [endYear, setEndYear] = useState<number>(new Date().getFullYear());
	const [endMonth, setEndMonth] = useState<number>(12);

	// Collapses to a plain "{year}年" when the range is exactly one full
	// year (the common case), otherwise shows the full span so a
	// multi-year or partial-year selection is unambiguous in headers.
	// Declared here (before the loading-state early return further down)
	// rather than near where it's used — a hook placed after an early
	// return gets skipped entirely on the render where loading=true,
	// then included once loading=false, which is a different number of
	// hooks between renders and a real Rules-of-Hooks violation.
	const rangeLabel = useMemo(() => {
		if (startYear === endYear && startMonth === 1 && endMonth === 12) {
			return `${startYear}年`;
		}
		if (startYear === endYear) {
			return `${startYear}年${startMonth}月-${endMonth}月`;
		}
		return `${startYear}年${startMonth}月-${endYear}年${endMonth}月`;
	}, [startYear, startMonth, endYear, endMonth]);

	const [compareYear1, setCompareYear1] = useState<number>(
		new Date().getFullYear() - 1
	);
	const [compareYear2, setCompareYear2] = useState<number>(
		new Date().getFullYear()
	);
	const [availableYears, setAvailableYears] = useState<number[]>([]);

	// Swap (not clamp) when the selection would invert — compareYear1 is
	// always the earlier year, compareYear2 the later one, so bars/legend
	// consistently show the earlier year first regardless of which
	// dropdown the user actually changed.
	const handleCompareYear1Change = (y: number) => {
		if (y > compareYear2) {
			setCompareYear1(compareYear2);
			setCompareYear2(y);
		} else {
			setCompareYear1(y);
		}
	};
	const handleCompareYear2Change = (y: number) => {
		if (y < compareYear1) {
			setCompareYear2(compareYear1);
			setCompareYear1(y);
		} else {
			setCompareYear2(y);
		}
	};

	// year*12+month gives a single monotonic index, so a compound
	// year+month boundary can be swap-corrected with plain numeric
	// comparison instead of tuple logic — e.g. picking 結束年/結束月
	// "2025年3月" while 起始年/起始月 is "2025年6月" ends with
	// 起始=2025年3月, 結束=2025年6月, preserving both selected values
	// rather than collapsing them, and correctly handling cases that
	// span a year boundary (2025年12月 vs 2026年1月).
	const toMonthIndex = (year: number, month: number) => year * 12 + month;

	const handleStartChange = (year: number, month: number) => {
		if (toMonthIndex(year, month) > toMonthIndex(endYear, endMonth)) {
			setStartYear(endYear);
			setStartMonth(endMonth);
			setEndYear(year);
			setEndMonth(month);
		} else {
			setStartYear(year);
			setStartMonth(month);
		}
	};
	const handleEndChange = (year: number, month: number) => {
		if (toMonthIndex(year, month) < toMonthIndex(startYear, startMonth)) {
			setEndYear(startYear);
			setEndMonth(startMonth);
			setStartYear(year);
			setStartMonth(month);
		} else {
			setEndYear(year);
			setEndMonth(month);
		}
	};

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

			// Default both boundaries to the latest available year (whole
			// year), matching the previous single-year default — the user
			// can widen the range from there if they want a multi-year span.
			if (yearsArray.length > 0) {
				setStartYear(yearsArray[0]);
				setEndYear(yearsArray[0]);
			}
		} catch (error) {
			console.error("Error fetching entries:", error);
		} finally {
			setLoading(false);
		}
	};

	// Genuine cross-year range via "YYYY-MM" string comparison — matches
	// the same fix applied to trend-analysis/route.ts. A per-row numeric
	// month check applied without regard to which year the row is in
	// (the previous approach) can't express a span like Jan 2025-Aug
	// 2026: it would silently drop Sep-Dec 2025.
	const rangeStartKey = `${startYear}-${String(startMonth).padStart(2, "0")}`;
	const rangeEndKey = `${endYear}-${String(endMonth).padStart(2, "0")}`;

	const monthlyStats = useMemo(() => {
		const stats: MonthlyStats = {};
		entries
			.filter((entry) => {
				if (!entry.occurrence_month) return false;
				const key = entry.occurrence_month.slice(0, 7);
				return key >= rangeStartKey && key <= rangeEndKey;
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
	}, [entries, rangeStartKey, rangeEndKey]);

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

	// ---- Shared EF/HFACS toggle for 統計表, 類別分析, 代碼組成分析, and
	// 趨勢分析. HFACS categories are server-computed (trend-analysis/
	// route.ts already groups+totals them), so the pie chart reads
	// hfacsData.categories directly rather than re-deriving a grouping
	// scheme client-side the way EF's fixed P/E/C/I/T/O/M grouping does. ----
	const [dataType, setDataType] = useState<"ef" | "hfacs">("ef");

	const [hfacsData, setHfacsData] = useState<FullTrendData | null>(null);
	// EF's table/pie/composition data comes from raw /api/sms/srm-entries
	// (existing, unchanged, working) — but 趨勢分析's category/area modes
	// need the same server-side grouping trend-analysis/route.ts provides
	// for HFACS, which raw entries can't give. Separate fetch, used only
	// by 趨勢分析, so the already-shipped EF table/pie/composition path
	// isn't touched.
	const [efFullData, setEfFullData] = useState<FullTrendData | null>(null);
	const [hfacsLoading, setHfacsLoading] = useState(false);

	// Fetches eagerly (not just when dataType==="hfacs") — the summary row
	// shows both EF種類 and HFACS種類 counts regardless of which toggle
	// is active, so HFACS data needs to be available either way. Both
	// hfacs and ef fetched together, matching TrendAnalysisTab.tsx's own
	// dual-fetch pattern, so switching dataType doesn't need a re-fetch.
	useEffect(() => {
		let cancelled = false;

		async function loadTrendData() {
			setHfacsLoading(true);
			try {
				const token = localStorage.getItem("token");
				const baseParams = {
					start_year: String(startYear),
					start_month: String(startMonth),
					end_year: String(endYear),
					end_month: String(endMonth),
				};
				const [hfacsRes, efRes] = await Promise.all([
					fetch(`/api/sms/trend-analysis?${new URLSearchParams({ ...baseParams, type: "hfacs" })}`, {
						headers: { Authorization: `Bearer ${token}` },
					}),
					fetch(`/api/sms/trend-analysis?${new URLSearchParams({ ...baseParams, type: "ef" })}`, {
						headers: { Authorization: `Bearer ${token}` },
					}),
				]);
				if (!hfacsRes.ok || !efRes.ok) throw new Error("趨勢資料載入失敗");
				const hfacsJson = await hfacsRes.json();
				const efJson = await efRes.json();
				if (!cancelled) {
					setHfacsData(hfacsJson);
					setEfFullData(efJson);
				}
			} catch (error) {
				console.error("Error loading trend data:", error);
				if (!cancelled) {
					setHfacsData(null);
					setEfFullData(null);
				}
			} finally {
				if (!cancelled) setHfacsLoading(false);
			}
		}

		loadTrendData();
		return () => {
			cancelled = true;
		};
	}, [startYear, startMonth, endYear, endMonth]);

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

	// ---- 趨勢分析 — directly ported from TrendAnalysisTab.tsx per
	// explicit request (controls, granularity toggle, dual SRM/自督
	// lines all preserved as-is). fullData picks whichever of
	// hfacsData/efFullData matches the current dataType toggle — both are
	// always fetched together (see the trend-data effect above), so
	// switching the toggle doesn't need a re-fetch. ----
	const fullData = dataType === "hfacs" ? hfacsData : efFullData;

	const [trendMode, setTrendMode] = useState<TrendMode>("code");
	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [selectedArea, setSelectedArea] = useState<string | null>(null);
	const [trendGranularity, setTrendGranularity] = useState<Granularity>("month");

	// Defaults to the highest-risk code (barChartCodes[0], already sorted
	// descending) whenever nothing is explicitly selected, or whenever a
	// previous selection no longer exists in the current dataset (e.g.
	// after switching dataType) — per explicit request that the trend
	// graph shows the top risk by default rather than requiring a click.
	const effectiveCode = useMemo(() => {
		if (selectedCode && barChartCodes.some((c) => c.code === selectedCode)) return selectedCode;
		return barChartCodes[0]?.code ?? null;
	}, [selectedCode, barChartCodes]);

	const trendSeries = useMemo(() => {
		if (!fullData) return [];
		if (trendMode === "code" && effectiveCode) {
			const split = fullData.trendByCode[effectiveCode] ?? {};
			return rollUp(fullData.months, split, trendGranularity, true);
		}
		if (trendMode === "category" && selectedCategory) {
			const split = fullData.trendByCategory[selectedCategory] ?? {};
			return rollUp(fullData.months, split, trendGranularity, true);
		}
		if (trendMode === "area" && selectedArea) {
			const split = fullData.trendByArea[selectedArea] ?? {};
			return rollUp(fullData.months, split, trendGranularity, true);
		}
		return [];
	}, [fullData, trendMode, effectiveCode, selectedCategory, selectedArea, trendGranularity]);

	const trendLabel = useMemo(() => {
		if (trendMode === "code" && effectiveCode) {
			const c = fullData?.codes.find((c) => c.code === effectiveCode);
			return c ? `${c.code} — ${c.description}` : effectiveCode;
		}
		if (trendMode === "category" && selectedCategory) return selectedCategory;
		if (trendMode === "area" && selectedArea) return selectedArea;
		return "";
	}, [trendMode, effectiveCode, selectedCategory, selectedArea, fullData]);

	// ---- 風險緩解分析 — directly ported from TrendAnalysisTab.tsx.
	// Independent HFACS/EF toggle, separate from the page-level dataType
	// — this matches the original's deliberate design (its own comment:
	// "not the trend chart's dataset"). Reuses the existing compareYear1/
	// compareYear2 state (already on this page for the old 年度比較
	// section this replaces) rather than fromYear/toYear naming, since
	// this control's existing semantics are "year A vs year B" with no
	// enforced ordering, not a continuous from-to range. Fetches only the
	// two specific comparison years, not everything between them. ----
	const [comparisonType, setComparisonType] = useState<"hfacs" | "ef">("ef");
	const [mitigationView, setMitigationView] = useState<"list" | "overview">("list");
	const [comparisonGranularity, setComparisonGranularity] = useState<Granularity>("month");
	const [showAllComparison, setShowAllComparison] = useState(false);
	const [showAllTrendCodes, setShowAllTrendCodes] = useState(false);
	const [hiddenTrendLines, setHiddenTrendLines] = useState<Set<string>>(new Set());
	const [recordsModal, setRecordsModal] = useState<{
		code: string;
		description: string;
		source: "srm" | "routine";
	} | null>(null);

	const [mitigationHfacsData, setMitigationHfacsData] = useState<FullTrendData | null>(null);
	const [mitigationEfData, setMitigationEfData] = useState<FullTrendData | null>(null);
	const [mitigationLoading, setMitigationLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;

		async function loadMitigationData() {
			setMitigationLoading(true);
			try {
				const token = localStorage.getItem("token");
				const baseParams = {
					start_year: String(compareYear1),
					start_month: "1",
					end_year: String(compareYear2),
					end_month: "12",
				};
				const [hfacsRes, efRes] = await Promise.all([
					fetch(`/api/sms/trend-analysis?${new URLSearchParams({ ...baseParams, type: "hfacs" })}`, {
						headers: { Authorization: `Bearer ${token}` },
					}),
					fetch(`/api/sms/trend-analysis?${new URLSearchParams({ ...baseParams, type: "ef" })}`, {
						headers: { Authorization: `Bearer ${token}` },
					}),
				]);
				if (!hfacsRes.ok || !efRes.ok) throw new Error("風險緩解分析資料載入失敗");
				const hfacsJson = await hfacsRes.json();
				const efJson = await efRes.json();
				if (!cancelled) {
					setMitigationHfacsData(hfacsJson);
					setMitigationEfData(efJson);
				}
			} catch (error) {
				console.error("Error loading mitigation comparison data:", error);
				if (!cancelled) {
					setMitigationHfacsData(null);
					setMitigationEfData(null);
				}
			} finally {
				if (!cancelled) setMitigationLoading(false);
			}
		}

		loadMitigationData();
		return () => {
			cancelled = true;
		};
	}, [compareYear1, compareYear2]);

	const mitigationData = comparisonType === "hfacs" ? mitigationHfacsData : mitigationEfData;

	const toggleTrendLine = (code: string) => {
		setHiddenTrendLines((prev) => {
			const next = new Set(prev);
			if (next.has(code)) next.delete(code);
			else next.add(code);
			return next;
		});
	};

	const mitigationAllPeriods = useMemo(() => {
		if (!mitigationData) return [];
		return rollUp(mitigationData.months, {}, comparisonGranularity).map((p) => p.period);
	}, [mitigationData, comparisonGranularity]);

	const periodARange = useMemo(() => {
		if (!mitigationData || compareYear1 === compareYear2) return { periods: [] as string[], label: "" };
		const periods = mitigationData.months.filter((m) => parseInt(m.slice(0, 4), 10) === compareYear1);
		return { periods, label: `${compareYear1}年` };
	}, [mitigationData, compareYear1, compareYear2]);

	const periodBRange = useMemo(() => {
		if (!mitigationData || compareYear1 === compareYear2) return { periods: [] as string[], label: "" };
		const periods = mitigationData.months.filter((m) => parseInt(m.slice(0, 4), 10) === compareYear2);
		return { periods, label: `${compareYear2}年` };
	}, [mitigationData, compareYear1, compareYear2]);

	const allComparisonRows = useMemo(() => {
		if (!mitigationData || periodARange.periods.length === 0 || periodBRange.periods.length === 0) return [];
		const rows = mitigationData.codes
			.map((c) => {
				const split = mitigationData.trendByCode[c.code] ?? {};
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
			return totalY - totalX;
		});
		return rows;
	}, [mitigationData, periodARange, periodBRange]);

	const topCodesComparison = useMemo(() => {
		const visible = showAllComparison ? allComparisonRows : allComparisonRows.slice(0, 10);
		return [...visible].sort((x, y) => {
			const diffX = x.b.srm + x.b.self - (x.a.srm + x.a.self);
			const diffY = y.b.srm + y.b.self - (y.a.srm + y.a.self);
			return diffX - diffY;
		});
	}, [allComparisonRows, showAllComparison]);

	const topCodesForMitigationTrend = useMemo(() => {
		if (!mitigationData) return [];
		const codes = showAllTrendCodes ? mitigationData.codes : mitigationData.codes.slice(0, 10);
		return codes.map((c) => ({ code: c.code, description: c.description }));
	}, [mitigationData, showAllTrendCodes]);

	const mitigationCodeDescLookup = useMemo(() => {
		return Object.fromEntries(topCodesForMitigationTrend.map((c) => [c.code, c.description]));
	}, [topCodesForMitigationTrend]);

	const topCodesMitigationTrendSeries = useMemo(() => {
		if (!mitigationData) return [];
		return mitigationAllPeriods.map((period) => {
			const row: Record<string, string | number | null> = { period };
			topCodesForMitigationTrend.forEach(({ code }) => {
				const series = rollUp(mitigationData.months, mitigationData.trendByCode[code] ?? {}, comparisonGranularity, true);
				const entry = series.find((p) => p.period === period);
				row[code] = entry && entry.srm !== null && entry.self !== null ? entry.srm + entry.self : null;
			});
			return row;
		});
	}, [mitigationData, mitigationAllPeriods, topCodesForMitigationTrend, comparisonGranularity]);

	const MITIGATION_TREND_COLORS = [
		"#4a9eff", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
		"#ec4899", "#6366f1", "#fb923c", "#1baf7a", "#e87ba4",
	];

	// ---- Export-only derived data. Sheet 1 must always include both EF
	// and HFACS tables regardless of the dataType toggle, and the year-
	// comparison/trend-overview sheets must exist for both types
	// regardless of the comparisonType toggle — so all of this is
	// computed unconditionally here rather than reusing the toggle-
	// dependent table*/mitigationData variables used on screen. ----
	const hfacsActiveMonths = useMemo(() => {
		const months = new Set<string>();
		Object.values(hfacsMonthlyStats).forEach((codeStats) => {
			Object.keys(codeStats).forEach((month) => months.add(month));
		});
		return Array.from(months).sort();
	}, [hfacsMonthlyStats]);

	const hfacsActiveCodes = useMemo(() => {
		return Object.keys(hfacsMonthlyStats).sort((a, b) => {
			const totalA = Object.values(hfacsMonthlyStats[a]).reduce((s, d) => s + d.count, 0);
			const totalB = Object.values(hfacsMonthlyStats[b]).reduce((s, d) => s + d.count, 0);
			return totalB - totalA;
		});
	}, [hfacsMonthlyStats]);

	const hfacsYearlyTotals = useMemo(() => {
		const totals: YearlyStats = {};
		Object.entries(hfacsMonthlyStats).forEach(([code, months]) => {
			totals[code] = Object.values(months).reduce((sum, data) => sum + data.count, 0);
		});
		return totals;
	}, [hfacsMonthlyStats]);

	const hfacsTotalCases = Object.values(hfacsYearlyTotals).reduce((sum, c) => sum + c, 0);

	// hfacsData.categories is already server-grouped+totaled — no need to
	// re-derive from hfacsYearlyTotals the way the EF category breakdown
	// re-derives from yearlyTotals (HFACS categories don't share EF's
	// fixed single-letter-code scheme, so there's no equivalent grouping
	// key to recompute from client-side anyway).
	const hfacsCategoryBreakdown = useMemo(() => {
		const breakdown: Record<string, number> = {};
		(hfacsData?.categories ?? []).forEach((c) => {
			breakdown[c.category] = c.total;
		});
		return breakdown;
	}, [hfacsData]);

	// EF's categoryBreakdown (declared below) is keyed by Chinese name;
	// this is the same data keyed by the single-letter code instead, plus
	// a code->name lookup — both needed so the export can show "改變管理
	// (M)" (Chinese name + English/letter code) in both the 類別分析
	// table and the pie chart's category labels.
	const efCategoryBreakdownByCode = useMemo(() => {
		const breakdown: Record<string, number> = {};
		Object.entries(yearlyTotals).forEach(([code, count]) => {
			const category = code.charAt(0);
			breakdown[category] = (breakdown[category] || 0) + count;
		});
		return breakdown;
	}, [yearlyTotals]);

	const efComparisonRows = useMemo(
		() => computeComparisonRows(mitigationEfData, compareYear1, compareYear2),
		[mitigationEfData, compareYear1, compareYear2]
	);
	const hfacsComparisonRows = useMemo(
		() => computeComparisonRows(mitigationHfacsData, compareYear1, compareYear2),
		[mitigationHfacsData, compareYear1, compareYear2]
	);

	// Reuses mitigationEfData/mitigationHfacsData (both already fetched
	// for compareYear1/compareYear2, not the page's main year-range
	// fetch) — same source 風險緩解分析's on-screen comparison already
	// uses, just computed for both types unconditionally instead of only
	// whichever comparisonType is toggled.
	const efTrendOverview = useMemo(
		() => computeTrendOverview(mitigationEfData, comparisonGranularity),
		[mitigationEfData, comparisonGranularity]
	);
	const hfacsTrendOverview = useMemo(
		() => computeTrendOverview(mitigationHfacsData, comparisonGranularity),
		[mitigationHfacsData, comparisonGranularity]
	);

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

			// Reshape both monthlyStats objects from { code: { month: { count,
			// sources } } } to { code: { month: count } } — the export route
			// only needs counts, not the sources Set (which doesn't survive
			// JSON anyway).
			const reshapeMonthlyStats = (stats: MonthlyStats): Record<string, Record<string, number>> => {
				const out: Record<string, Record<string, number>> = {};
				Object.entries(stats).forEach(([code, months]) => {
					out[code] = {};
					Object.entries(months).forEach(([month, data]) => {
						out[code][month] = data.count;
					});
				});
				return out;
			};

			const response = await fetch("/api/sms/export-statistics", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					rangeLabel,
					ef: {
						activeMonths,
						activeCodes,
						codeDescriptions: efCodeDescriptions,
						monthlyStats: reshapeMonthlyStats(monthlyStats),
						yearlyTotals,
						totalCases,
						categoryBreakdown: efCategoryBreakdownByCode, // code -> count
						categoryNames: EF_CATEGORIES, // code -> Chinese name
					},
					hfacs: {
						activeMonths: hfacsActiveMonths,
						activeCodes: hfacsActiveCodes,
						codeDescriptions: hfacsCodeDescriptions,
						monthlyStats: reshapeMonthlyStats(hfacsMonthlyStats),
						yearlyTotals: hfacsYearlyTotals,
						totalCases: hfacsTotalCases,
						categoryBreakdown: hfacsCategoryBreakdown, // name -> count, no separate code
					},
					compareYear1,
					compareYear2,
					efComparisonRows,
					hfacsComparisonRows,
					efTrendOverview,
					hfacsTrendOverview,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || "Failed to export");
			}

			const blob = await response.blob();
			const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
			saveAs(blob, `SRM統計報表_${dateStamp}.xlsx`);

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
			link.download = `SRM統計_${endYear}_${new Date()
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
							<label>起始年:</label>
							<select
								value={startYear}
								onChange={(e) => handleStartChange(parseInt(e.target.value), startMonth)}
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
								value={startMonth}
								onChange={(e) => handleStartChange(startYear, parseInt(e.target.value))}
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
							<label>結束年:</label>
							<select
								value={endYear}
								onChange={(e) => handleEndChange(parseInt(e.target.value), endMonth)}
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
							<label>結束月:</label>
							<select
								value={endMonth}
								onChange={(e) => handleEndChange(endYear, parseInt(e.target.value))}
								className={styles.select}
							>
								{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
									<option key={m} value={m}>
										{m}月
									</option>
								))}
							</select>
						</div>

						<div className={styles.toggleGroup}>
							<button
								className={dataType === "ef" ? styles.efButtonActive : styles.efButton}
								onClick={() => setDataType("ef")}
							>
								EF代碼
							</button>
							<button
								className={dataType === "hfacs" ? styles.hfacsButtonActive : styles.hfacsButton}
								onClick={() => setDataType("hfacs")}
							>
								HFACS代碼
							</button>
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
				<h3>📅 {rangeLabel} 統計表{hfacsLoading ? "（載入中...）" : ""}</h3>
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
					<h3>🗃️ {rangeLabel} 類別分析{dataType === "hfacs" ? "（HFACS）" : "（EF）"}</h3>
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
							const isSelected = trendMode === "code" && effectiveCode === c.code;
							const maxTotal = barChartCodes[0]?.total || 1;
							const widthPct = Math.max((c.total / maxTotal) * 100, 2); // 2% floor so non-zero values stay visible/clickable
							return (
								<button
									key={c.code}
									className={`${styles.compositionRow} ${isSelected ? styles.compositionRowActive : ""}`}
									onClick={() => {
										setTrendMode("code");
										setSelectedCode(isSelected ? null : c.code);
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
										<div
											className={styles.compositionSegment}
											style={{ width: `${widthPct}%`, background: "#4a9eff" }}
										>
											{widthPct >= 15 && `${c.total} 件`}
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

			</div>

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
							{dataType === "hfacs" && (
								<button
									className={trendMode === "area" ? styles.typeActive : ""}
									onClick={() => setTrendMode("area")}
								>
									領域彙總
								</button>
							)}
						</div>

						{trendMode === "code" && fullData && (
							<select
								className={styles.select}
								value={effectiveCode ?? ""}
								onChange={(e) => setSelectedCode(e.target.value)}
							>
								{fullData.codes.map((c) => (
									<option key={c.code} value={c.code}>
										{c.code} — {c.description}
									</option>
								))}
							</select>
						)}
						{trendMode === "category" && fullData && (
							<select
								className={styles.select}
								value={selectedCategory ?? ""}
								onChange={(e) => setSelectedCategory(e.target.value)}
							>
								{fullData.categories.map((cat) => (
									<option key={cat.category} value={cat.category}>
										{cat.category}
									</option>
								))}
							</select>
						)}
						{trendMode === "area" && fullData && (
							<select
								className={styles.select}
								value={selectedArea ?? ""}
								onChange={(e) => setSelectedArea(e.target.value)}
							>
								{fullData.areas.map((a) => (
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

				{hfacsLoading ? (
					<div className={styles.emptyState}>
						<p>載入中...</p>
					</div>
				) : trendSeries.length === 0 ? (
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
						</LineChart>
					</ResponsiveContainer>
				)}
			</div>


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
						: compareYear1 === compareYear2
						? "請選擇不同的年份1與年份2以進行比較"
						: `比較 ${compareYear1}年 與 ${compareYear2}年 的風險緩解成效`}
				</div>

				<div className={styles.inlineControlsRow}>
					<div className={styles.typeToggle}>
						<button
							className={comparisonType === "ef" ? styles.efButtonActive : styles.efButton}
							onClick={() => setComparisonType("ef")}
						>
							EF 代碼
						</button>
						<button
							className={comparisonType === "hfacs" ? styles.hfacsButtonActive : styles.hfacsButton}
							onClick={() => setComparisonType("hfacs")}
						>
							HFACS 代碼
						</button>
					</div>

					<div className={styles.controlGroup}>
						<label>年份1:</label>
						<select
							value={compareYear1}
							onChange={(e) => handleCompareYear1Change(parseInt(e.target.value))}
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
							onChange={(e) => handleCompareYear2Change(parseInt(e.target.value))}
							className={styles.select}
						>
							{availableYears.map((year) => (
								<option key={year} value={year}>
									{year}年
								</option>
							))}
						</select>
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

				{mitigationLoading ? (
					<div className={styles.emptyState}>
						<p>載入中...</p>
					</div>
				) : mitigationView === "overview" ? (
					topCodesMitigationTrendSeries.length === 0 ? (
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
											topCodesForMitigationTrend.length > 0 &&
											topCodesForMitigationTrend.every((c) => hiddenTrendLines.has(c.code));
										setHiddenTrendLines(
											allHidden ? new Set() : new Set(topCodesForMitigationTrend.map((c) => c.code))
										);
									}}
								>
									{topCodesForMitigationTrend.length > 0 && topCodesForMitigationTrend.every((c) => hiddenTrendLines.has(c.code))
										? "全部顯示"
										: "全部隱藏"}
								</button>
							</div>

							<ResponsiveContainer width="100%" height={520}>
								<LineChart data={topCodesMitigationTrendSeries} margin={{ top: 20, right: 30, bottom: 10, left: 0 }}>
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
													{mitigationCodeDescLookup[value] && (
														<span className={styles.legendDesc}>
															{" "}
															— {mitigationCodeDescLookup[value]}
														</span>
													)}
												</span>
											);
										}}
									/>
									{topCodesForMitigationTrend.map(({ code }, i) => (
										<Line
											key={code}
											type="monotone"
											dataKey={code}
											name={code}
											stroke={MITIGATION_TREND_COLORS[i % MITIGATION_TREND_COLORS.length]}
											strokeWidth={2}
											dot={{ r: 2 }}
											connectNulls={false}
											hide={hiddenTrendLines.has(code)}
										/>
									))}
								</LineChart>
							</ResponsiveContainer>

							{mitigationData && mitigationData.codes.length > 10 && (
								<button
									className={styles.showAllButton}
									onClick={() => setShowAllTrendCodes((v) => !v)}
								>
									{showAllTrendCodes ? "只顯示前 10 項" : `顯示全部 (${mitigationData.codes.length})`}
								</button>
							)}
						</>
					)
				) : compareYear1 === compareYear2 ? (
					<div className={styles.emptyState}>
						<p>年份1與年份2相同，無法比較 — 請調整上方年份選擇</p>
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
												{ label: a.period, total: totalA, color: SRM_COLOR },
												{ label: b.period, total: totalB, color: SELF_COLOR },
											].map(({ label, total, color }) => (
												<div key={label} className={styles.compareMiniBarRow}>
													<span className={styles.compareMiniBarLabel}>{label}</span>
													<div className={styles.compareMiniBarTrack}>
														<div
															className={styles.compareMiniBarFill}
															style={{ width: `${(total / maxTotal) * 100}%`, background: color }}
														/>
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

			{recordsModal && (
				<TrendRecordsModal
					code={recordsModal.code}
					description={recordsModal.description}
					type={comparisonType}
					source={recordsModal.source}
					yearA={compareYear1}
					yearB={compareYear2}
					onClose={() => setRecordsModal(null)}
				/>
			)}
		</div>
	);
}