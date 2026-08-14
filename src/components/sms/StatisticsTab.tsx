// src/components/sms/StatisticsTab.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styles from "./StatisticsTab.module.css";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

	const monthlyStats = useMemo(() => {
		const stats: MonthlyStats = {};
		entries
			.filter((entry) => {
				if (!entry.occurrence_month) return false;
				const year = parseInt(entry.occurrence_month.split("-")[0]);
				return year === selectedYear;
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
	}, [entries, selectedYear]);

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
		return Object.values(EF_CATEGORIES).map((name, index) => ({
			name,
			value: categoryBreakdown[name] || 0,
			color: colors[index % colors.length],
		}));
	}, [categoryBreakdown, EF_CATEGORIES]);

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
				</div>
			</div>

			<div className={styles.topChartsGrid}>
				<div className={styles.section}>
					<h3>📅 {selectedYear}年 月度統計表</h3>
					<div className={styles.tableContainer}>
						<table className={styles.statsTable}>
							<thead>
								<tr>
									<th>EF代碼</th>
									<th className={styles.descriptionColumn}>
										內容
									</th>
									{activeMonths.map((month) => {
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
								{activeCodes.map((code) => {
									const total = Object.values(
										monthlyStats[code]
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
												{efCodeDescriptions[code] ||
													code}
											</td>
											{activeMonths.map((month) => {
												const data =
													monthlyStats[code][month];
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
									{activeMonths.map((month) => {
										const monthTotal = activeCodes.reduce(
											(sum, code) =>
												sum +
												(monthlyStats[code][month]
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
										{totalCases}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</div>

				<div className={styles.section}>
					<h3>🗃️ {selectedYear}年 類別分析</h3>
					<div className={styles.pieChartContainer}>
						<ResponsiveContainer width="100%" height={460}>
							<PieChart margin={{ top: 50, right: 30, bottom: 30, left: 30 }}>
								<Pie
									data={pieChartData}
									dataKey="value"
									nameKey="name"
									cx="50%"
									cy="48%"
									outerRadius={120}
									label={({ name, percent }) =>
										`${name} ${((percent ?? 0) * 100).toFixed(1)}%`
									}
								>
									{pieChartData.map((entry) => (
										<Cell key={entry.name} fill={entry.color} />
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
									formatter={(value: number) => [`${value} 件`, "件數"]}
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
			</div>

			<div className={styles.section}>
				<h3>📊 {selectedYear}年 EF代碼統計圖</h3>
				<div className={styles.chartContainer}>
					<div className={styles.barChart}>
						{Object.entries(yearlyTotals)
							.sort((a, b) => b[1] - a[1])
							.map(([code, count]) => {
								const maxCount = Math.max(
									...Object.values(yearlyTotals)
								);
								const percentage =
									maxCount > 0 ? (count / maxCount) * 100 : 0;
								const pixelHeight = (percentage / 100) * 280; // 380px chart - 52px info - 48px top padding
									return (
										<div key={code} className={styles.barItem}>
											<div className={styles.barInfo}>
												<div className={styles.barCode}>
													{code}
												</div>
												<div className={styles.barDescription}>
													{efCodeDescriptions[code] ||
														code}
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
														{count}
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