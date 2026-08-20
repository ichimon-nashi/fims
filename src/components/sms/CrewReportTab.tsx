// src/components/sms/CrewReportTab.tsx
"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import styles from "./CrewReportTab.module.css";
import CrewReportModal from "./CrewReportModal";
import CrewReportCategoryModal from "./CrewReportCategoryModal";
import { CrewReport, CrewReportCategory } from "@/lib/sms.types";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

interface ScreenshotColumn {
	key: string;
	label: string;
	getValue: (report: CrewReport, categoryMap: Map<string, CrewReportCategory>) => string;
}

// All fields available for the screenshot export. Order here is just the
// picker's display order — actual column order in the generated image is
// determined by the sequence the user checks them in, not this array.
const SCREENSHOT_COLUMNS: ScreenshotColumn[] = [
	{ key: "report_code", label: "編號 (AQD Code)", getValue: (r) => r.report_code || "NIL" },
	{ key: "title", label: "標題 (Title)", getValue: (r) => r.title },
	{ key: "description", label: "描述 (Description)", getValue: (r) => r.description },
	{
		key: "category_ids",
		label: "EF分類",
		getValue: (r, categoryMap) =>
			r.category_ids.map((id) => categoryMap.get(id)?.name).filter(Boolean).join(", "),
	},
	{ key: "hazard_type", label: "OF分類 (Hazard Type)", getValue: (r) => r.hazard_type || "" },
	{ key: "occurrence_date", label: "事件日期 (Occurrence Date)", getValue: (r) => r.occurrence_date || "" },
	{ key: "registered_date", label: "登記日期 (Registered Date)", getValue: (r) => r.registered_date || "" },
	{ key: "aircraft", label: "機號 (A/C)", getValue: (r) => r.aircraft || "" },
	{ key: "flight_no", label: "班機編號 (Flight no.)", getValue: (r) => r.flight_no || "" },
	{ key: "departure", label: "出發地 (DEP)", getValue: (r) => r.departure || "" },
	{ key: "arrival", label: "目的地 (ARR)", getValue: (r) => r.arrival || "" },
	{ key: "location", label: "地點 (Location)", getValue: (r) => r.location || "" },
	{
		key: "potential_consequence",
		label: "潛在後果 (Potential Consequence)",
		getValue: (r) => r.potential_consequence || "",
	},
	{ key: "reporter_name", label: "通報人 (Reporter)", getValue: (r) => r.reporter_name || "" },
	{
		key: "operational_category",
		label: "作業分類 (Operational Category)",
		getValue: (r) => r.operational_category || "",
	},
	{ key: "assessment_code", label: "評估代碼 (Assessment Code)", getValue: (r) => r.assessment_code || "" },
	{
		key: "risk_assessment_calculation",
		label: "風險評估計算 (Risk Assessment Calculations)",
		getValue: (r) => r.risk_assessment_calculation || "",
	},
	{ key: "risk_assessment", label: "風險評估 (Risk Assessment)", getValue: (r) => r.risk_assessment || "" },
	{ key: "closed_status", label: "結案狀態 (Closed)", getValue: (r) => r.closed_status || "" },
	{ key: "action_taken", label: "辦理情形 (Synopsis)", getValue: (r) => r.action_taken || "" },
];

// 結案狀態 badge color — heuristic on free text (AQD import data, not a
// fixed enum), so this only recognizes an explicit "closed"-ish value and
// treats everything else as in-progress/neutral rather than guessing.
function getStatusBadgeColor(value: string): { bg: string; text: string; border: string } {
	const isClosed = /close/i.test(value);
	return isClosed
		? { bg: "rgba(16, 185, 129, 0.15)", text: "#6ee7b7", border: "rgba(16, 185, 129, 0.35)" }
		: { bg: "rgba(245, 158, 11, 0.15)", text: "#fcd34d", border: "rgba(245, 158, 11, 0.35)" };
}

// 風險評估 badge color — matches values like "3D" (number+letter, same
// shape as SRM's risk assessment codes) with a simple heuristic scale;
// anything not matching that shape (free text from AQD) gets a neutral
// badge rather than a guessed color.
function getRiskBadgeColor(value: string): { bg: string; text: string; border: string } {
	const match = value.trim().match(/^([1-5])([A-E])$/i);
	if (!match) {
		return { bg: "rgba(107, 114, 128, 0.15)", text: "#d1d5db", border: "rgba(107, 114, 128, 0.35)" };
	}
	const num = parseInt(match[1], 10);
	const letter = match[2].toUpperCase();
	const letterScore = "ABCDE".indexOf(letter) + 1;
	const score = num * letterScore;
	if (score >= 15) return { bg: "rgba(239, 68, 68, 0.15)", text: "#fca5a5", border: "rgba(239, 68, 68, 0.35)" }; // high
	if (score >= 6) return { bg: "rgba(245, 158, 11, 0.15)", text: "#fcd34d", border: "rgba(245, 158, 11, 0.35)" }; // medium
	return { bg: "rgba(16, 185, 129, 0.15)", text: "#6ee7b7", border: "rgba(16, 185, 129, 0.35)" }; // low
}



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
	const [expandedReportRows, setExpandedReportRows] = useState<Set<string>>(
		new Set()
	);

	const [showAddModal, setShowAddModal] = useState(false);
	const [editingEntry, setEditingEntry] = useState<CrewReport | null>(null);
	const [showCategoryModal, setShowCategoryModal] = useState(false);
	const [showPieModal, setShowPieModal] = useState(false);
	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState<{
		imported: number;
		skippedDuplicate: number;
		skippedNoDate: number;
		skippedNoTitle: number;
		errors: string[];
	} | null>(null);
	const [importError, setImportError] = useState<string | null>(null);
	const importInputRef = useRef<HTMLInputElement>(null);

	const [showScreenshotModal, setShowScreenshotModal] = useState(false);
	// Ordered array, not a Set — the sequence items are checked in IS the
	// resulting column order, per the explicit requirement.
	const [selectedScreenshotColumns, setSelectedScreenshotColumns] = useState<string[]>([]);
	const [generatingScreenshot, setGeneratingScreenshot] = useState(false);
	const screenshotTableRef = useRef<HTMLDivElement>(null);

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

	const handleImportClick = () => {
		importInputRef.current?.click();
	};

	const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = ""; // allow re-selecting the same file consecutively
		if (!file) return;

		setImporting(true);
		setImportError(null);
		setImportResult(null);

		try {
			const token = localStorage.getItem("token");
			const body = new FormData();
			body.append("file", file);

			const response = await fetch("/api/sms/crew-reports/import", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body,
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || "匯入失敗");
			}

			setImportResult(data);
			await fetchReports();
		} catch (error: any) {
			console.error("Error importing crew reports:", error);
			setImportError(error.message || "匯入失敗，請重試");
		} finally {
			setImporting(false);
		}
	};

	const toggleScreenshotColumn = (key: string) => {
		setSelectedScreenshotColumns((prev) =>
			prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
		);
	};

	const handleGenerateScreenshot = async () => {
		if (selectedScreenshotColumns.length === 0) {
			alert("請至少選擇一個欄位");
			return;
		}
		setGeneratingScreenshot(true);
		try {
			// Hidden table's content depends on selectedScreenshotColumns via
			// props — give React a tick to render the latest selection before
			// html2canvas captures it.
			await new Promise((resolve) => setTimeout(resolve, 50));

			const html2canvas = (await import("html2canvas")).default;
			const target = screenshotTableRef.current;
			if (!target) throw new Error("找不到截圖內容");

			const canvas = await html2canvas(target, {
				backgroundColor: "#1a1f35",
				scale: 2, // sharper output than a raw 1:1 DOM capture
			});

			const dataUrl = canvas.toDataURL("image/png");
			const link = document.createElement("a");
			link.href = dataUrl;
			link.download = `OF安全報告截圖_${new Date().toISOString().slice(0, 10)}.png`;
			link.click();

			setShowScreenshotModal(false);
		} catch (error) {
			console.error("Error generating screenshot:", error);
			alert("截圖失敗，請重試");
		} finally {
			setGeneratingScreenshot(false);
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

	const toggleReportRow = (id: string) => {
		setExpandedReportRows((prev) => {
			// Accordion: expanding a row collapses whichever other row was
			// open, rather than allowing multiple rows expanded at once.
			if (prev.has(id)) return new Set();
			return new Set([id]);
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

	const renderReportRow = (report: CrewReport) => {
		const isRowExpanded = expandedReportRows.has(report.id);

		// Same 8 groups used in the create/edit form, so a user editing a
		// report sees the same organization they'd use to fill one in.
		// Sections with no populated fields are hidden entirely rather than
		// showing a wall of "-" placeholders — most reports won't have all
		// 21 optional fields filled.
		type DetailField = {
			label: string;
			value: string | null | undefined;
			long?: boolean;
			badge?: "status" | "risk";
		};

		const detailSections: { title: string; icon: string; fields: DetailField[] }[] = [
			{
				title: "日期資訊",
				icon: "📅",
				fields: [
					{ label: "事件日期", value: report.occurrence_date },
					{ label: "登記日期", value: report.registered_date },
				],
			},
			{
				title: "航班資訊",
				icon: "✈️",
				fields: [
					{ label: "機號", value: report.aircraft },
					{ label: "班機編號", value: report.flight_no },
					{ label: "出發地", value: report.departure },
					{ label: "目的地", value: report.arrival },
					{ label: "地點", value: report.location },
				],
			},
			{
				title: "事件內容",
				icon: "📝",
				fields: [
					{ label: "通報人", value: report.reporter_name },
					{ label: "潛在後果", value: report.potential_consequence, long: true },
					{ label: "辦理情形", value: report.action_taken, long: true },
				],
			},
			{
				title: "分類與評估",
				icon: "🏷️",
				fields: [
					{ label: "OF分類", value: report.hazard_type },
					{ label: "作業分類", value: report.operational_category },
					{ label: "評估代碼", value: report.assessment_code },
					{ label: "風險評估計算", value: report.risk_assessment_calculation },
					{ label: "風險評估", value: report.risk_assessment, badge: "risk" as const },
					{ label: "結案狀態", value: report.closed_status, badge: "status" as const },
				],
			},
		].filter((section) => section.fields.some((f) => f.value));

		return (
			<Fragment key={report.id}>
				<tr
					className={
						isRowExpanded
							? `${styles.mainRow} ${styles.mainRowExpanded}`
							: styles.mainRow
					}
				>
					<td className={styles.expandCol}>
						<button
							className={styles.expandButton}
							onClick={() => toggleReportRow(report.id)}
							title={isRowExpanded ? "收合" : "展開詳情"}
						>
							{isRowExpanded ? "▼" : "▶"}
						</button>
					</td>
					<td>
						{report.report_code ? (
							<span className={styles.reportCode}>{report.report_code}</span>
						) : (
							<span className={`${styles.reportCode} ${styles.nil}`}>NIL</span>
						)}
					</td>
					<td className={styles.descCell}>{report.title}</td>
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
				{isRowExpanded && (
					<tr className={styles.expandedRow}>
						<td colSpan={isAdmin ? 6 : 5}>
							<div className={styles.expandedContent}>
								{detailSections.length === 0 ? (
									<p className={styles.emptyState}>無其他補充資料</p>
								) : (
									detailSections.map((section) => (
										<div key={section.title} className={styles.detailSection}>
											<h4>
												<span className={styles.detailSectionIcon}>{section.icon}</span>
												{section.title}
											</h4>
											<div className={styles.detailGrid}>
												{section.fields
													.filter((f) => f.value)
													.map((f) => {
														const badgeColors =
															f.badge === "status"
																? getStatusBadgeColor(f.value as string)
																: f.badge === "risk"
																? getRiskBadgeColor(f.value as string)
																: null;
														return (
															<div
																key={f.label}
																className={
																	f.long
																		? `${styles.detailItem} ${styles.detailItemLong}`
																		: styles.detailItem
																}
															>
																<strong>{f.label}</strong>
																{badgeColors ? (
																	<span
																		className={styles.detailBadge}
																		style={{
																			background: badgeColors.bg,
																			color: badgeColors.text,
																			borderColor: badgeColors.border,
																		}}
																	>
																		{f.value}
																	</span>
																) : (
																	<p>{f.value}</p>
																)}
															</div>
														);
													})}
											</div>
										</div>
									))
								)}
							</div>
						</td>
					</tr>
				)}
			</Fragment>
		);
	};

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
						className={`${styles.displayGraphButton} ${styles.btnGhost}`}
						onClick={() => setShowPieModal(true)}
					>
						📊 分類圖
					</button>
					<button
						className={`${styles.screenshotButton} ${styles.btnGhost}`}
						onClick={() => setShowScreenshotModal(true)}
					>
						📸 截圖
					</button>
					{isAdmin && (
						<>
							<input
								ref={importInputRef}
								type="file"
								accept=".xlsx,.xls"
								style={{ display: "none" }}
								onChange={handleImportFileChange}
							/>
							<button
								className={`${styles.importButton} ${styles.btnGhost}`}
								onClick={handleImportClick}
								disabled={importing}
							>
								{importing ? "匯入中..." : "📥 匯入 Excel"}
							</button>
							<button className={styles.btnPrimary} onClick={handleAdd}>
								+ 新增報告
							</button>
						</>
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
													<col style={{ width: "6%" }} />
													<col style={{ width: "12%" }} />
													<col style={{ width: "18%" }} />
													<col style={{ width: "28%" }} />
													<col style={{ width: "18%" }} />
													{isAdmin && (
														<col style={{ width: "10%" }} />
													)}
												</colgroup>
												<thead>
													<tr>
														<th></th>
														<th>編號</th>
														<th>標題</th>
														<th>描述</th>
														<th>EF分類</th>
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
												<col style={{ width: "12%" }} />
												<col style={{ width: "16%" }} />
												<col style={{ width: "26%" }} />
												<col style={{ width: "14%" }} />
												<col style={{ width: "22%" }} />
												{isAdmin && (
													<col style={{ width: "10%" }} />
												)}
											</colgroup>
											<thead>
												<tr>
													<th>編號</th>
													<th>標題</th>
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
															{report.title}
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

			{showScreenshotModal && (
				<div className={styles.modalOverlay}>
					<div className={styles.pieModal}>
						<div className={styles.modalHeader}>
							<h2>選擇截圖欄位</h2>
							<button
								className={styles.closeButton}
								onClick={() => setShowScreenshotModal(false)}
							>
								×
							</button>
						</div>
						<div className={styles.pieModalBody}>
							<p className={styles.screenshotHint}>
								勾選要顯示的欄位，勾選順序即為欄位在截圖中的排列順序。
							</p>
							<div className={styles.screenshotColumnList}>
								{SCREENSHOT_COLUMNS.map((col) => {
									const orderIndex = selectedScreenshotColumns.indexOf(col.key);
									const isSelected = orderIndex !== -1;
									return (
										<label key={col.key} className={styles.screenshotColumnRow}>
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => toggleScreenshotColumn(col.key)}
											/>
											<span className={styles.screenshotColumnLabel}>{col.label}</span>
											{isSelected && (
												<span className={styles.screenshotColumnOrder}>
													{orderIndex + 1}
												</span>
											)}
										</label>
									);
								})}
							</div>
						</div>
						<div className={styles.modalFooter}>
							<button
								className={styles.btnGhost}
								onClick={() => setShowScreenshotModal(false)}
							>
								取消
							</button>
							<button
								className={styles.btnPrimary}
								onClick={handleGenerateScreenshot}
								disabled={generatingScreenshot || selectedScreenshotColumns.length === 0}
							>
								{generatingScreenshot ? "產生中..." : "產生截圖"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Off-screen capture target for html2canvas — fixed wide width
			    (not responsive) so the output always looks like a desktop
			    table regardless of what device generated it. Always rendered
			    (not conditional on the modal being open) so it's ready the
			    moment 產生截圖 is clicked. */}
			<div
				ref={screenshotTableRef}
				style={{ position: "fixed", top: "-9999px", left: "-9999px", zIndex: -1 }}
			>
				<ScreenshotTable
					columnKeys={selectedScreenshotColumns}
					reports={filteredReports}
					categoryMap={categoryMap}
				/>
			</div>

			{(importResult || importError) && (
				<div className={styles.modalOverlay}>
					<div className={styles.pieModal}>
						<div className={styles.modalHeader}>
							<h2>匯入結果</h2>
							<button
								className={styles.closeButton}
								onClick={() => {
									setImportResult(null);
									setImportError(null);
								}}
							>
								×
							</button>
						</div>
						<div className={styles.pieModalBody}>
							{importError ? (
								<p className={styles.importErrorText}>{importError}</p>
							) : (
								importResult && (
									<div className={styles.importSummary}>
										<div className={styles.importSummaryRow}>
											<span className={styles.importSummaryLabel}>已匯入</span>
											<span className={styles.importSummaryValueGood}>
												{importResult.imported} 筆
											</span>
										</div>
										{importResult.skippedDuplicate > 0 && (
											<div className={styles.importSummaryRow}>
												<span className={styles.importSummaryLabel}>
													已存在（略過）
												</span>
												<span className={styles.importSummaryValue}>
													{importResult.skippedDuplicate} 筆
												</span>
											</div>
										)}
										{importResult.skippedNoDate > 0 && (
											<div className={styles.importSummaryRow}>
												<span className={styles.importSummaryLabel}>
													缺少事件日期（略過）
												</span>
												<span className={styles.importSummaryValue}>
													{importResult.skippedNoDate} 筆
												</span>
											</div>
										)}
										{importResult.skippedNoTitle > 0 && (
											<div className={styles.importSummaryRow}>
												<span className={styles.importSummaryLabel}>
													缺少標題（略過）
												</span>
												<span className={styles.importSummaryValue}>
													{importResult.skippedNoTitle} 筆
												</span>
											</div>
										)}
										{importResult.errors.length > 0 && (
											<div className={styles.importErrorList}>
												<strong>發生錯誤：</strong>
												<ul>
													{importResult.errors.map((err, i) => (
														<li key={i}>{err}</li>
													))}
												</ul>
											</div>
										)}
									</div>
								)
							)}
						</div>
						<div className={styles.modalFooter}>
							<button
								className={styles.btnPrimary}
								onClick={() => {
									setImportResult(null);
									setImportError(null);
								}}
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

// Donut chart via recharts (innerRadius creates the ring). Center total
// count is an overlaid <text> — recharts renders unrecognized children
// directly into the underlying <svg>, which is the standard pattern for
// a center label in a recharts donut. cy/text y-offsets are both pulled
// up from center to leave room for the legend below, same approach as
// StatisticsTab's 類別分析 chart.
// Plain HTML table with inline styles (not CSS-module classes) for the
// screenshot capture — html2canvas resolves inline styles more reliably
// than externally-linked stylesheet rules. Fixed width, not responsive:
// the whole point is a consistent desktop-style capture regardless of the
// device that generated it.
function ScreenshotTable({
	columnKeys,
	reports,
	categoryMap,
}: {
	columnKeys: string[];
	reports: CrewReport[];
	categoryMap: Map<string, CrewReportCategory>;
}) {
	const columns = columnKeys
		.map((key) => SCREENSHOT_COLUMNS.find((c) => c.key === key))
		.filter((c): c is ScreenshotColumn => !!c);

	if (columns.length === 0) return null;

	return (
		<div style={{ width: "1600px", background: "#1a1f35", padding: "2rem", fontFamily: "sans-serif" }}>
			<table style={{ width: "100%", borderCollapse: "collapse" }}>
				<thead>
					<tr>
						{columns.map((col) => (
							<th
								key={col.key}
								style={{
									padding: "0.75rem 1rem",
									textAlign: "left",
									color: "#4a9eff",
									borderBottom: "2px solid rgba(74,158,255,0.4)",
									fontSize: "14px",
									whiteSpace: "nowrap",
								}}
							>
								{col.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{reports.map((report) => (
						<tr key={report.id}>
							{columns.map((col) => (
								<td
									key={col.key}
									style={{
										padding: "0.75rem 1rem",
										color: "#e8e9ed",
										borderBottom: "1px solid rgba(255,255,255,0.08)",
										fontSize: "13px",
										maxWidth: "320px",
										verticalAlign: "top",
									}}
								>
									{col.getValue(report, categoryMap)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function CategoryDonutChart({
	categories,
	counts,
	total,
}: {
	categories: CrewReportCategory[];
	counts: Record<string, number>;
	total: number;
}) {
	const data = categories.map((cat) => ({
		id: cat.id,
		name: cat.name,
		value: counts[cat.id] || 0,
		color: cat.color_hex,
	}));

	return (
		<ResponsiveContainer width="100%" height={460}>
			<PieChart margin={{ top: 50, right: 20, bottom: 30, left: 20 }}>
				<Pie
					data={data}
					dataKey="value"
					nameKey="name"
					cx="50%"
					cy="48%"
					innerRadius={80}
					outerRadius={140}
					paddingAngle={2}
					label={({ name, value, percent }) =>
						`${name} ${value}筆 (${((percent ?? 0) * 100).toFixed(0)}%)`
					}
				>
					{data.map((entry) => (
						<Cell key={entry.id} fill={entry.color} stroke="#1a1f35" strokeWidth={2} />
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
					formatter={(value: number, name: string) => {
						const pct = total ? Math.round((value / total) * 100) : 0;
						return [`${value} 筆 (${pct}%)`, name];
					}}
				/>
				<Legend
					wrapperStyle={{ paddingTop: 24 }}
					formatter={(value) => <span style={{ color: "#e8e9ed" }}>{value}</span>}
				/>
				<text
					x="50%"
					y="46%"
					textAnchor="middle"
					dominantBaseline="middle"
					fontSize={26}
					fontWeight={700}
					fill="#e8e9ed"
				>
					{total}
				</text>
				<text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#a0aec0">
					總筆數
				</text>
			</PieChart>
		</ResponsiveContainer>
	);
}