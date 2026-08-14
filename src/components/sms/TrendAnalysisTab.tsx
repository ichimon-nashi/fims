// src/components/sms/TrendAnalysisTab.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { saveAs } from "file-saver";
import styles from "./TrendAnalysisTab.module.css";
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

// Given two boundary period labels (order not assumed), returns the
// inclusive slice of allPeriods between them plus a display label —
// a single period if start===end, otherwise "start~end".
function computeRange(allPeriods: string[], start: string | null, end: string | null): { periods: string[]; label: string } {
	if (!start || !end) return { periods: [], label: "" };
	const idxStart = allPeriods.indexOf(start);
	const idxEnd = allPeriods.indexOf(end);
	if (idxStart === -1 || idxEnd === -1) return { periods: [], label: "" };
	const [lo, hi] = idxStart <= idxEnd ? [idxStart, idxEnd] : [idxEnd, idxStart];
	const periods = allPeriods.slice(lo, hi + 1);
	const label = periods.length === 1 ? periods[0] : `${periods[0]}~${periods[periods.length - 1]}`;
	return { periods, label };
}

// Sums a rolled-up series across a set of period labels. Null (future,
// no data) contributes 0 — summing across a range has no ambiguity the
// way a single continuous time point does, so this doesn't need the
// hideFuture distinction rollUp makes.
function sumRange(series: PeriodValue[], periods: string[]): { srm: number; self: number } {
	return periods.reduce(
		(acc, p) => {
			const entry = series.find((s) => s.period === p);
			acc.srm += entry?.srm ?? 0;
			acc.self += entry?.self ?? 0;
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
	const [data, setData] = useState<TrendAnalysisResponse | null>(null);

	const [searchTerm, setSearchTerm] = useState("");
	const [showAll, setShowAll] = useState(false);

	const [trendMode, setTrendMode] = useState<TrendMode>("code");
	const [selectedCode, setSelectedCode] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [selectedArea, setSelectedArea] = useState<string | null>(null);
	const [granularity, setGranularity] = useState<Granularity>("month");
	const [periodAStart, setPeriodAStart] = useState<string | null>(null);
	const [periodAEnd, setPeriodAEnd] = useState<string | null>(null);
	const [periodBStart, setPeriodBStart] = useState<string | null>(null);
	const [periodBEnd, setPeriodBEnd] = useState<string | null>(null);
	const [mitigationView, setMitigationView] = useState<"list" | "overview">("list");

	useEffect(() => {
		fetchData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [fromYear, toYear, type]);

	// EF codes have no area tier (see route) — if the user had "area" mode
	// selected under HFACS and switches to EF, fall back to category
	// rather than leaving the trend chart pointed at empty data.
	useEffect(() => {
		if (type === "ef" && trendMode === "area") {
			setTrendMode("category");
		}
	}, [type, trendMode]);

	const handleFromYearChange = (y: number) => {
		setFromYear(y);
		if (y > toYear) setToYear(y);
	};

	const handleToYearChange = (y: number) => {
		setToYear(y);
		if (y < fromYear) setFromYear(y);
	};

	const fetchData = async () => {
		setLoading(true);
		setError(null);
		try {
			const token = localStorage.getItem("token");
			const years = [];
			for (let y = fromYear; y <= toYear; y++) years.push(y);

			const params = new URLSearchParams({
				years: years.join(","),
				month_from: "1",
				month_to: "12",
				type,
			});

			const response = await fetch(`/api/sms/trend-analysis?${params}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				throw new Error(err.error || "Failed to load trend analysis");
			}
			const json: TrendAnalysisResponse = await response.json();
			setData(json);

			// default trend selection to the top code/category/area, once data arrives
			if (json.codes.length > 0) {
				setSelectedCode(json.codes[0].code);
			}
			if (json.categories.length > 0) {
				setSelectedCategory(json.categories[0].category);
			}
			if (json.areas.length > 0) {
				setSelectedArea(json.areas[0].area);
			}
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
			return rollUp(data.months, split, granularity, true);
		}
		if (trendMode === "category" && selectedCategory) {
			const split = data.trendByCategory[selectedCategory] ?? {};
			return rollUp(data.months, split, granularity, true);
		}
		if (trendMode === "area" && selectedArea) {
			const split = data.trendByArea[selectedArea] ?? {};
			return rollUp(data.months, split, granularity, true);
		}
		return [];
	}, [data, trendMode, selectedCode, selectedCategory, selectedArea, granularity]);

	// Every available period label at the current granularity, independent
	// of which code/category/area the trend line above is showing — period
	// comparison now covers the top 10 codes at once, not one entity, so it
	// can't be tied to a single entity's series anymore. rollUp's period
	// labels only depend on months+granularity, not the split contents, so
	// an empty split here safely yields just the label list.
	const allPeriods = useMemo(() => {
		if (!data) return [];
		return rollUp(data.months, {}, granularity).map((p) => p.period);
	}, [data, granularity]);

	// Re-default both ranges (each starting as a single-period range: latest
	// vs earliest) whenever the available periods change — otherwise a
	// stale period label from a previous granularity could silently point
	// at nothing. The user can then widen either range's start/end
	// independently to compare spans, e.g. "2025 vs 2026 Jan-June".
	useEffect(() => {
		if (allPeriods.length >= 2) {
			setPeriodAStart(allPeriods[0]);
			setPeriodAEnd(allPeriods[0]);
			setPeriodBStart(allPeriods[allPeriods.length - 1]);
			setPeriodBEnd(allPeriods[allPeriods.length - 1]);
		} else {
			setPeriodAStart(null);
			setPeriodAEnd(null);
			setPeriodBStart(null);
			setPeriodBEnd(null);
		}
	}, [allPeriods]);

	// Each side's start/end are free pickers — chronological order within a
	// range is normalized here (swap if picked backwards), same principle
	// as the single-period fix from before, just generalized to a span.
	const periodARange = useMemo(() => computeRange(allPeriods, periodAStart, periodAEnd), [allPeriods, periodAStart, periodAEnd]);
	const periodBRange = useMemo(() => computeRange(allPeriods, periodBStart, periodBEnd), [allPeriods, periodBStart, periodBEnd]);

	// Top 10 codes, ranked by relevance to the two RANGES actually being
	// compared (their combined activity summed across each full range),
	// not by total across the entire fetched year range. Rows with zero
	// in both ranges are dropped entirely rather than shown as noise.
	const topCodesComparison = useMemo(() => {
		if (!data || periodARange.periods.length === 0 || periodBRange.periods.length === 0) return [];
		const rows = data.codes
			.map((c) => {
				const series = rollUp(data.months, data.trendByCode[c.code] ?? {}, granularity);
				const aSum = sumRange(series, periodARange.periods);
				const bSum = sumRange(series, periodBRange.periods);
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

		return rows.slice(0, 10).sort((x, y) => {
			const diffX = x.b.srm + x.b.self - (x.a.srm + x.a.self);
			const diffY = y.b.srm + y.b.self - (y.a.srm + y.a.self);
			return diffX - diffY; // then most-improved (largest decrease) first, for display
		});
	}, [data, periodARange, periodBRange, granularity]);

	// Collective overview, redesigned: x-axis is the risks themselves (the
	// same top-10 list above), not time — one line per range, each point
	// being that code's combined SRM+自督 total for that range. Directly
	// reuses topCodesComparison so the list and this chart always agree.
	const riskComparisonSeries = useMemo(() => {
		return topCodesComparison.map((c) => ({
			code: c.code,
			description: c.description,
			[periodARange.label]: c.a.srm + c.a.self,
			[periodBRange.label]: c.b.srm + c.b.self,
		}));
	}, [topCodesComparison, periodARange.label, periodBRange.label]);

	const trendLabel = useMemo(() => {
		if (trendMode === "code" && selectedCode) {
			const c = data?.codes.find((c) => c.code === selectedCode);
			return c ? `${c.code} — ${c.description}` : selectedCode;
		}
		if (trendMode === "category" && selectedCategory) return selectedCategory;
		if (trendMode === "area" && selectedArea) return selectedArea;
		return "";
	}, [trendMode, selectedCode, selectedCategory, selectedArea, data]);

	const granularityLabel = useMemo(() => {
		switch (granularity) {
			case "month":
				return "月";
			case "quarter":
				return "季";
			case "halfYear":
				return "半年";
			case "year":
				return "年";
		}
	}, [granularity]);

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
					type,
					trendLabel: trendLabel || "全部",
					granularityLabel,
					codes: data?.codes ?? [],
					trendSeries,
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
							className={styles.sourceLinkButton}
							onClick={() => router.push("/sms?tab=statistics")}
						>
							SMS統計 ↗
						</button>
						<button
							className={styles.sourceLinkButton}
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
								className={granularity === "month" ? styles.typeActive : ""}
								onClick={() => setGranularity("month")}
							>
								月
							</button>
							<button
								className={granularity === "quarter" ? styles.typeActive : ""}
								onClick={() => setGranularity("quarter")}
							>
								季
							</button>
							<button
								className={granularity === "halfYear" ? styles.typeActive : ""}
								onClick={() => setGranularity("halfYear")}
							>
								半年
							</button>
							<button
								className={granularity === "year" ? styles.typeActive : ""}
								onClick={() => setGranularity("year")}
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

			{/* Period comparison — answers "did mitigation actually reduce this",
			    across the top 10 codes at once rather than one at a time —
			    plus a collective overview toggle for a whole-programme view
			    instead of drilling into individual risks. Both view modes
			    share the same range pickers below, so they're always shown. */}
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

				{allPeriods.length < 2 ? (
					<div className={styles.emptyState}>
						<p>至少需要 2 個期間才能比較</p>
					</div>
				) : (
					<>
						<div className={styles.compareControls}>
							<div className={styles.controlGroup}>
								<label>期間 A:</label>
								<select
									className={styles.select}
									value={periodAStart ?? ""}
									onChange={(e) => setPeriodAStart(e.target.value)}
								>
									{allPeriods.map((p) => (
										<option key={p} value={p}>
											{p}
										</option>
									))}
								</select>
								<span className={styles.rangeToLabel}>至</span>
								<select
									className={styles.select}
									value={periodAEnd ?? ""}
									onChange={(e) => setPeriodAEnd(e.target.value)}
								>
									{allPeriods.map((p) => (
										<option key={p} value={p}>
											{p}
										</option>
									))}
								</select>
							</div>
							<span className={styles.vsLabel}>vs</span>
							<div className={styles.controlGroup}>
								<label>期間 B:</label>
								<select
									className={styles.select}
									value={periodBStart ?? ""}
									onChange={(e) => setPeriodBStart(e.target.value)}
								>
									{allPeriods.map((p) => (
										<option key={p} value={p}>
											{p}
										</option>
									))}
								</select>
								<span className={styles.rangeToLabel}>至</span>
								<select
									className={styles.select}
									value={periodBEnd ?? ""}
									onChange={(e) => setPeriodBEnd(e.target.value)}
								>
									{allPeriods.map((p) => (
										<option key={p} value={p}>
											{p}
										</option>
									))}
								</select>
							</div>
						</div>

						{mitigationView === "overview" ? (
							riskComparisonSeries.length === 0 ? (
								<div className={styles.emptyState}>
									<p>本期間尚無資料</p>
								</div>
							) : (
								<ResponsiveContainer width="100%" height={380}>
									<LineChart data={riskComparisonSeries} margin={{ top: 20, right: 30, bottom: 40, left: 0 }}>
										<CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
										<XAxis
											dataKey="code"
											stroke="#a0aec0"
											fontSize={12}
											angle={-35}
											textAnchor="end"
											height={60}
										/>
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
										<Legend formatter={(value) => <span style={{ color: "#e8e9ed" }}>{value}</span>} />
										<Line
											type="monotone"
											dataKey={periodARange.label}
											name={periodARange.label}
											stroke={SRM_COLOR}
											strokeWidth={2}
											dot={{ r: 3 }}
										/>
										<Line
											type="monotone"
											dataKey={periodBRange.label}
											name={periodBRange.label}
											stroke={SELF_COLOR}
											strokeWidth={2}
											dot={{ r: 3 }}
										/>
									</LineChart>
								</ResponsiveContainer>
							)
						) : topCodesComparison.length === 0 ? (
							<div className={styles.emptyState}>
								<p>本期間尚無資料</p>
							</div>
						) : (
							<div className={styles.compareList}>
								{topCodesComparison.map(({ code, description, a, b }) => {
									const totalA = a.srm + a.self;
									const totalB = b.srm + b.self;
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
										</div>
									);
								})}
							</div>
						)}
					</>
				)}
			</div>
				</>
			)}
		</div>
	);
}