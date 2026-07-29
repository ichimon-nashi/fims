// src/components/sms/CrewReportTab.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./CrewReportTab.module.css";
import CrewReportModal from "./CrewReportModal";
import CrewReportCategoryModal from "./CrewReportCategoryModal";
import { CrewReport, CrewReportCategory } from "@/lib/sms.types";

interface CrewReportTabProps {
	currentYear: number;
	userId: string;
	isAdmin: boolean;
}

type ViewMode = "date" | "category";

const MONTH_NAMES = [
	"1月", "2月", "3月", "4月", "5月", "6月",
	"7月", "8月", "9月", "10月", "11月", "12月",
];

// (No row-expand/collapse — descriptions and 辦理情形 are always shown in full.)

export default function CrewReportTab({
	currentYear,
	userId,
	isAdmin,
}: CrewReportTabProps) {
	const [reports, setReports] = useState<CrewReport[]>([]);
	const [categories, setCategories] = useState<CrewReportCategory[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [viewMode, setViewMode] = useState<ViewMode>("date");

	const [expandedYears, setExpandedYears] = useState<Set<number>>(
		new Set([currentYear])
	);
	const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
	const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
		new Set()
	);

	const [showAddModal, setShowAddModal] = useState(false);
	const [editingEntry, setEditingEntry] = useState<CrewReport | null>(null);
	const [showCategoryModal, setShowCategoryModal] = useState(false);
	const [showPieModal, setShowPieModal] = useState(false);

	useEffect(() => {
		fetchAll();
	}, []);

	const fetchAll = async () => {
		setLoading(true);
		await Promise.all([fetchReports(), fetchCategories()]);
		setLoading(false);
	};

	const fetchReports = async () => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch("/api/sms/crew-reports", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) throw new Error("Failed to fetch crew reports");
			const data = await response.json();
			setReports(data);
		} catch (error) {
			console.error("Error fetching crew reports:", error);
		}
	};

	const fetchCategories = async () => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch("/api/sms/crew-report-categories", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) throw new Error("Failed to fetch categories");
			const data = await response.json();
			setCategories(data);
		} catch (error) {
			console.error("Error fetching crew report categories:", error);
		}
	};

	const categoryMap = useMemo(() => {
		const map = new Map<string, CrewReportCategory>();
		categories.forEach((c) => map.set(c.id, c));
		return map;
	}, [categories]);

	const activeCategories = useMemo(
		() => categories.filter((c) => c.active),
		[categories]
	);

	// Category counts + percentages computed from ALL reports (not search-filtered) —
	// the overview chips/pie chart represent the whole dataset, not the current search.
	const categoryCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		reports.forEach((r) => {
			r.category_ids.forEach((id) => {
				counts[id] = (counts[id] || 0) + 1;
			});
		});
		return counts;
	}, [reports]);

	const totalTagCount = useMemo(
		() => Object.values(categoryCounts).reduce((sum, n) => sum + n, 0),
		[categoryCounts]
	);

	const populatedCategories = useMemo(
		() =>
			categories
				.filter((c) => (categoryCounts[c.id] || 0) > 0)
				.sort((a, b) => (categoryCounts[b.id] || 0) - (categoryCounts[a.id] || 0)),
		[categories, categoryCounts]
	);

	const filteredReports = useMemo(() => {
		if (!searchTerm.trim()) return reports;
		const term = searchTerm.toLowerCase();
		return reports.filter(
			(r) =>
				r.description.toLowerCase().includes(term) ||
				r.action_taken?.toLowerCase().includes(term) ||
				r.report_code?.toLowerCase().includes(term)
		);
	}, [reports, searchTerm]);

	// Group filtered reports by year -> month for date view
	const dateGroups = useMemo(() => {
		const yearMap = new Map<number, Map<number, CrewReport[]>>();
		filteredReports.forEach((r) => {
			if (!yearMap.has(r.report_year)) yearMap.set(r.report_year, new Map());
			const monthMap = yearMap.get(r.report_year)!;
			if (!monthMap.has(r.report_month)) monthMap.set(r.report_month, []);
			monthMap.get(r.report_month)!.push(r);
		});

		return Array.from(yearMap.entries())
			.sort((a, b) => b[0] - a[0])
			.map(([year, monthMap]) => ({
				year,
				total: Array.from(monthMap.values()).reduce(
					(sum, arr) => sum + arr.length,
					0
				),
				months: Array.from(monthMap.entries())
					.sort((a, b) => b[0] - a[0])
					.map(([month, entries]) => ({ month, entries })),
			}));
	}, [filteredReports]);

	const toggleYear = (year: number) => {
		setExpandedYears((prev) => {
			const next = new Set(prev);
			if (next.has(year)) next.delete(year);
			else next.add(year);
			return next;
		});
	};

	const toggleCategoryExpand = (id: string) => {
		setExpandedCategories((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleAdd = () => {
		setEditingEntry(null);
		setShowAddModal(true);
	};

	const handleEdit = (entry: CrewReport) => {
		setEditingEntry(entry);
		setShowAddModal(true);
	};

	const handleDelete = async (entry: CrewReport) => {
		if (!confirm(`確定要刪除此報告嗎？(${entry.report_code || "NIL"})`)) return;

		try {
			const token = localStorage.getItem("token");
			const response = await fetch(`/api/sms/crew-reports/${entry.id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) throw new Error("刪除失敗");
			await fetchReports();
		} catch (error: any) {
			console.error("Error deleting crew report:", error);
			alert(error.message || "刪除失敗");
		}
	};

	const renderReportRow = (report: CrewReport) => (
		<tr key={report.id}>
			<td>
				{report.report_code ? (
					<span className={styles.reportCode}>{report.report_code}</span>
				) : (
					<span className={`${styles.reportCode} ${styles.nil}`}>NIL</span>
				)}
			</td>
			<td className={styles.descCell}>{report.description}</td>
			<td>
				<div className={styles.tags}>
					{report.category_ids.map((id) => {
						const cat = categoryMap.get(id);
						if (!cat) return null;
						return (
							<span
								key={id}
								className={styles.tag}
								style={{
									background: `${cat.color_hex}33`,
									borderColor: `${cat.color_hex}80`,
								}}
							>
								{cat.name}
							</span>
						);
					})}
				</div>
			</td>
			<td className={styles.actionCell}>{report.action_taken || "-"}</td>
			{isAdmin && (
				<td>
					<div className={styles.rowActions}>
						<button
							className={styles.iconBtnSm}
							onClick={() => handleEdit(report)}
							title="編輯"
						>
							📝
						</button>
						<button
							className={styles.iconBtnSm}
							onClick={() => handleDelete(report)}
							title="刪除"
						>
							❌
						</button>
					</div>
				</td>
			)}
		</tr>
	);

	if (loading) {
		return (
			<div className={styles.loading}>
				<div className={styles.spinner} />
				<p>載入中...</p>
			</div>
		);
	}

	return (
		<div className={styles.crewReportTab}>
			{isAdmin && (
				<div className={styles.adminRow}>
					<button
						className={styles.btnSettings}
						onClick={() => setShowCategoryModal(true)}
					>
						⚙ 管理分類
					</button>
				</div>
			)}

			<div className={styles.toolbar}>
				<div className={styles.toolbarLeft}>
					<input
						type="text"
						placeholder="搜尋編號或描述..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className={styles.searchInput}
					/>
					<div className={styles.viewToggle}>
						<button
							className={viewMode === "date" ? styles.active : ""}
							onClick={() => setViewMode("date")}
						>
							依日期
						</button>
						<button
							className={viewMode === "category" ? styles.active : ""}
							onClick={() => setViewMode("category")}
						>
							依分類
						</button>
					</div>
				</div>
				<div className={styles.toolbarRight}>
					<button
						className={styles.btnGhost}
						onClick={() => setShowPieModal(true)}
					>
						📊 分類圖
					</button>
					{isAdmin && (
						<button className={styles.btnPrimary} onClick={handleAdd}>
							+ 新增報告
						</button>
					)}
				</div>
			</div>

			{populatedCategories.length > 0 && (
				<div className={styles.counterRow}>
					{populatedCategories.map((cat) => {
						const count = categoryCounts[cat.id] || 0;
						const pct = totalTagCount
							? Math.round((count / totalTagCount) * 100)
							: 0;
						return (
							<div key={cat.id} className={styles.counterChip}>
								<span
									className={styles.dot}
									style={{ background: cat.color_hex }}
								/>
								<span className={styles.label}>{cat.name}</span>
								<span className={styles.count}>{count}</span>
								<span className={styles.pct}>({pct}%)</span>
							</div>
						);
					})}
				</div>
			)}

			{filteredReports.length === 0 ? (
				<div className={styles.emptyState}>
					<p>{searchTerm ? "找不到符合的報告" : "尚無組員報告"}</p>
				</div>
			) : viewMode === "date" ? (
				<div className={styles.accordionContainer}>
					{dateGroups.map(({ year, total, months }) => (
						<div
							key={year}
							className={`${styles.yearGroup} ${
								year === currentYear ? styles.currentYear : ""
							}`}
						>
							<div
								className={styles.yearHeader}
								onClick={() => toggleYear(year)}
							>
								<div className={styles.yearHeaderLeft}>
								<span className={styles.expandIcon}>
									{expandedYears.has(year) ? "▼" : "▶"}
								</span>
									<h3>{year} 年</h3>
								</div>
								<span className={styles.yearCount}>
									{total} 筆報告
								</span>
							</div>

							{expandedYears.has(year) && (
								<div className={styles.yearContent}>
									{months.map(({ month, entries }) => (
										<div key={month} className={styles.monthGroup}>
											<div className={styles.monthHeader}>
												{MONTH_NAMES[month - 1]} ({entries.length} 筆)
											</div>
											<div className={styles.tableWrapper}>
											<table className={styles.table}>
												<colgroup>
													<col style={{ width: "14%" }} />
													<col style={{ width: "32%" }} />
													<col style={{ width: "18%" }} />
													<col style={{ width: "26%" }} />
													{isAdmin && (
														<col style={{ width: "10%" }} />
													)}
												</colgroup>
												<thead>
													<tr>
														<th>編號</th>
														<th>描述</th>
														<th>分類</th>
														<th>辦理情形</th>
														{isAdmin && <th>操作</th>}
													</tr>
												</thead>
													<tbody>
														{entries.map(renderReportRow)}
													</tbody>
												</table>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					))}
				</div>
			) : (
				<div className={styles.accordionContainer}>
					{populatedCategories.map((cat) => {
						const catReports = filteredReports.filter((r) =>
							r.category_ids.includes(cat.id)
						);
						if (catReports.length === 0) return null;
						const isExpanded = expandedCategories.has(cat.id);
						const pct = totalTagCount
							? Math.round(
									((categoryCounts[cat.id] || 0) / totalTagCount) * 100
							  )
							: 0;

						return (
							<div
								key={cat.id}
								className={`${styles.catGroup} ${
									isExpanded ? styles.expanded : ""
								}`}
							>
								<div
									className={styles.catHeader}
									onClick={() => toggleCategoryExpand(cat.id)}
								>
								<span className={styles.expandIcon}>
									{isExpanded ? "▼" : "▶"}
								</span>
									<span
										className={styles.dot}
										style={{ background: cat.color_hex }}
									/>
									<h3>{cat.name}</h3>
									<span className={styles.catCount}>
										{catReports.length} 筆報告 ({pct}%)
									</span>
								</div>

								{isExpanded && (
									<div className={styles.tableWrapper}>
										<table className={styles.table}>
											<colgroup>
												<col style={{ width: "14%" }} />
												<col style={{ width: "32%" }} />
												<col style={{ width: "18%" }} />
												<col style={{ width: "26%" }} />
												{isAdmin && (
													<col style={{ width: "10%" }} />
												)}
											</colgroup>
											<thead>
												<tr>
													<th>編號</th>
													<th>描述</th>
													<th>年/月</th>
													<th>辦理情形</th>
													{isAdmin && <th>操作</th>}
												</tr>
											</thead>
											<tbody>
												{catReports.map((report) => (
													<tr key={report.id}>
														<td>
															{report.report_code ? (
																<span
																	className={
																		styles.reportCode
																	}
																>
																	{report.report_code}
																</span>
															) : (
																<span
																	className={`${styles.reportCode} ${styles.nil}`}
																>
																	NIL
																</span>
															)}
														</td>
														<td className={styles.descCell}>
															{report.description}
														</td>
														<td>
															{report.report_year}-
															{String(
																report.report_month
															).padStart(2, "0")}
														</td>
														<td className={styles.actionCell}>
															{report.action_taken || "-"}
														</td>
														{isAdmin && (
															<td>
																<div
																	className={
																		styles.rowActions
																	}
																>
																	<button
																		className={
																			styles.iconBtnSm
																		}
																		onClick={() =>
																			handleEdit(
																				report
																			)
																		}
																		title="編輯"
																	>
																		📝
																	</button>
																	<button
																		className={
																			styles.iconBtnSm
																		}
																		onClick={() =>
																			handleDelete(
																				report
																			)
																		}
																		title="刪除"
																	>
																		❌
																	</button>
																</div>
															</td>
														)}
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{showAddModal && (
				<CrewReportModal
					entry={editingEntry}
					categories={activeCategories.length > 0 ? activeCategories : categories}
					currentYear={currentYear}
					userId={userId}
					onClose={() => setShowAddModal(false)}
					onSave={fetchReports}
				/>
			)}

			{showCategoryModal && (
				<CrewReportCategoryModal
					categories={categories}
					categoryCounts={categoryCounts}
					onClose={() => setShowCategoryModal(false)}
					onSaved={fetchCategories}
				/>
			)}

			{showPieModal && (
				<div className={styles.modalOverlay}>
					{/* Deliberately no onClick={onClose} — consistent with the
					    other modals in this component. */}
					<div className={styles.pieModal}>
						<div className={styles.modalHeader}>
							<h2>分類圖</h2>
							<button
								className={styles.closeButton}
								onClick={() => setShowPieModal(false)}
							>
								×
							</button>
						</div>
						<div className={styles.pieModalBody}>
							{populatedCategories.length === 0 ? (
								<p className={styles.emptyState}>尚無資料可顯示</p>
							) : (
								<CategoryDonutChart
									categories={populatedCategories}
									counts={categoryCounts}
									total={totalTagCount}
								/>
							)}
						</div>
						<div className={styles.modalFooter}>
							<button
								className={styles.btnPrimary}
								onClick={() => setShowPieModal(false)}
							>
								關閉
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// Polar -> cartesian helper, angle 0 = 12 o'clock, clockwise.
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
	const rad = ((angleDeg - 90) * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// A single donut-ring wedge: outer arc, straight line in, inner arc back,
// close. Standard SVG donut-segment path.
function describeDonutSlice(
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	startAngle: number,
	endAngle: number
) {
	const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
	const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
	const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
	const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
	const largeArc = endAngle - startAngle > 180 ? 1 : 0;
	return [
		"M", outerStart.x, outerStart.y,
		"A", outerR, outerR, 0, largeArc, 1, outerEnd.x, outerEnd.y,
		"L", innerEnd.x, innerEnd.y,
		"A", innerR, innerR, 0, largeArc, 0, innerStart.x, innerStart.y,
		"Z",
	].join(" ");
}

// Donut chart with every label placed OUTSIDE the ring via a short leader
// line — never on top of a color fill, which sidesteps the contrast problem
// entirely (no need to pick per-slice text color). A center total count
// replaces the need for a separate legend. viewBox has generous margin so
// labels never clip regardless of how narrow the modal renders.
function CategoryDonutChart({
	categories,
	counts,
	total,
}: {
	categories: CrewReportCategory[];
	counts: Record<string, number>;
	total: number;
}) {
	const cx = 180;
	const cy = 180;
	const outerR = 95;
	const innerR = 52;

	let cursor = 0;
	const slices = categories.map((cat) => {
		const count = counts[cat.id] || 0;
		const angle = total ? (count / total) * 360 : 0;
		const start = cursor;
		const end = cursor + angle;
		cursor = end;
		const mid = (start + end) / 2;
		const pct = total ? Math.round((count / total) * 100) : 0;
		return { cat, count, pct, start, end, mid, angle };
	});

	return (
		<svg
			viewBox="0 0 360 360"
			width="100%"
			style={{ maxWidth: "440px", display: "block", margin: "0 auto" }}
		>
			{slices.map((s) => (
				<path
					key={s.cat.id}
					d={describeDonutSlice(cx, cy, outerR, innerR, s.start, s.end)}
					fill={s.cat.color_hex}
					stroke="#1a1f35"
					strokeWidth={2}
				/>
			))}

			{/* Center total — replaces the need for a legend to see the whole-count. */}
			<text
				x={cx}
				y={cy - 6}
				textAnchor="middle"
				dominantBaseline="middle"
				fontSize="26"
				fontWeight="700"
				fill="#e8e9ed"
			>
				{total}
			</text>
			<text
				x={cx}
				y={cy + 16}
				textAnchor="middle"
				dominantBaseline="middle"
				fontSize="12"
				fill="#a0aec0"
			>
				總筆數
			</text>

			{slices.map((s) => {
				const lineStart = polarToCartesian(cx, cy, outerR + 2, s.mid);
				const lineBend = polarToCartesian(cx, cy, outerR + 14, s.mid);
				const labelPos = polarToCartesian(cx, cy, outerR + 18, s.mid);
				const sinMid = Math.sin(((s.mid - 90) * Math.PI) / 180);
				const anchor = sinMid > 0.15 ? "start" : sinMid < -0.15 ? "end" : "middle";
				return (
					<g key={`${s.cat.id}-label`}>
						<line
							x1={lineStart.x}
							y1={lineStart.y}
							x2={lineBend.x}
							y2={lineBend.y}
							stroke={s.cat.color_hex}
							strokeWidth={1.5}
						/>
						<text
							x={labelPos.x}
							y={labelPos.y}
							textAnchor={anchor as any}
							dominantBaseline="middle"
							fontSize="12"
							fontWeight="600"
							fill="#e8e9ed"
						>
							{s.cat.name} {s.pct}%
						</text>
					</g>
				);
			})}
		</svg>
	);
}