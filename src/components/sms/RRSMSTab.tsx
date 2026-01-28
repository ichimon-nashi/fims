// src/components/sms/RRSMSTab.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./RRSMSTab.module.css";
import RRSMSModal from "./RRSMSModal";
import { RRSMSEntry } from "@/lib/sms.types";

interface RRSMSTabProps {
	currentYear: number;
	userId: string;
	isAdmin: boolean;
}

interface YearGroup {
	year: number;
	entries: RRSMSEntry[];
}

export default function RRSMSTab({
	currentYear,
	userId,
	isAdmin,
}: RRSMSTabProps) {
	const [allEntries, setAllEntries] = useState<RRSMSEntry[]>([]);
	const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
	const [expandedYears, setExpandedYears] = useState<Set<number>>(
		new Set([currentYear])
	);
	const [loading, setLoading] = useState(true);
	const [showModal, setShowModal] = useState(false);
	const [editingEntry, setEditingEntry] = useState<RRSMSEntry | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [showDeprecated, setShowDeprecated] = useState(true);

	// Column resizing state
	const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>(
		() => {
			if (typeof window !== "undefined") {
				const saved = localStorage.getItem("rrSmsColumnWidths");
				return saved ? JSON.parse(saved) : {};
			}
			return {};
		}
	);
	const [resizing, setResizing] = useState<{
		column: string;
		startX: number;
		startWidth: number;
	} | null>(null);

	useEffect(() => {
		fetchAllEntries();
	}, []);

	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(
				"rrSmsColumnWidths",
				JSON.stringify(columnWidths)
			);
		}
	}, [columnWidths]);

	const fetchAllEntries = async () => {
		try {
			setLoading(true);
			const token = localStorage.getItem("token");

			// Fetch ALL entries (no year filter)
			const response = await fetch("/api/sms/rr-entries", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) throw new Error("Failed to fetch entries");

			const data = await response.json();
			setAllEntries(data);
			groupEntriesByYear(data);
		} catch (error) {
			console.error("Error fetching RR SMS entries:", error);
		} finally {
			setLoading(false);
		}
	};

	// Helper: Get the primary review date (prefer risk, fallback to barrier, then old format)
	const getReviewDate = (
		entry: RRSMSEntry,
		type: "last" | "next"
	): string | undefined => {
		if (type === "last") {
			return (
				entry.risk_last_review ||
				entry.barrier_last_review ||
				entry.last_review
			);
		} else {
			return (
				entry.risk_next_review ||
				entry.barrier_next_review ||
				entry.next_review
			);
		}
	};

	// Helper: Expand entries into separate Risk and Barrier rows (or combined if dates match)
	interface ExpandedRow {
		entry: RRSMSEntry;
		reviewType: "Risk" | "Barrier" | "Risk+Barrier";
		rowId: string;
		reviewId: string;
		lastReview?: string;
		nextReview?: string;
		daysRemaining: number | null;
	}

	const expandToRows = (entries: RRSMSEntry[]): ExpandedRow[] => {
		const rows: ExpandedRow[] = [];

		entries.forEach((entry) => {
			const hasRisk = !!(
				entry.risk_id ||
				entry.risk_last_review ||
				entry.risk_next_review
			);
			const hasBarrier = !!(
				entry.barrier_id ||
				entry.barrier_last_review ||
				entry.barrier_next_review
			);

			// Check if dates are identical
			const sameLastReview =
				entry.risk_last_review === entry.barrier_last_review;
			const sameNextReview =
				entry.risk_next_review === entry.barrier_next_review;
			const datesMatch =
				sameLastReview &&
				sameNextReview &&
				entry.risk_last_review &&
				entry.risk_next_review;

			// If both exist and dates match, combine into one row
			if (hasRisk && hasBarrier && datesMatch) {
				const riskId =
					entry.risk_id || extractRiskId(entry.risk_id_barrier) || "";
				const barrierId =
					entry.barrier_id ||
					extractBarrierId(entry.risk_id_barrier) ||
					"";

				rows.push({
					entry,
					reviewType: "Risk+Barrier",
					rowId: `${entry.id}-combined`,
					reviewId: [riskId, barrierId].filter(Boolean).join(", "),
					lastReview: entry.risk_last_review,
					nextReview: entry.risk_next_review,
					daysRemaining: getDaysUntilReview(entry.risk_next_review),
				});
			} else {
				// Create separate rows when dates differ or only one exists

				// Add Risk row
				if (hasRisk) {
					rows.push({
						entry,
						reviewType: "Risk",
						rowId: `${entry.id}-risk`,
						reviewId:
							entry.risk_id ||
							extractRiskId(entry.risk_id_barrier) ||
							"-",
						lastReview: entry.risk_last_review,
						nextReview: entry.risk_next_review,
						daysRemaining: getDaysUntilReview(entry.risk_next_review),
					});
				}

				// Add Barrier row
				if (hasBarrier) {
					rows.push({
						entry,
						reviewType: "Barrier",
						rowId: `${entry.id}-barrier`,
						reviewId:
							entry.barrier_id ||
							extractBarrierId(entry.risk_id_barrier) ||
							"-",
						lastReview: entry.barrier_last_review,
						nextReview: entry.barrier_next_review,
						daysRemaining: getDaysUntilReview(
							entry.barrier_next_review
						),
					});
				}
			}

			// Fallback: if no split fields, show as Risk with old fields
			if (!hasRisk && !hasBarrier) {
				rows.push({
					entry,
					reviewType: "Risk",
					rowId: entry.id,
					reviewId: extractRiskId(entry.risk_id_barrier) || "-",
					lastReview: entry.last_review,
					nextReview: entry.next_review,
					daysRemaining: getDaysUntilReview(entry.next_review),
				});
			}
		});

		// Sort by days remaining (most urgent first)
		return rows.sort((a, b) => {
			if (a.daysRemaining === null && b.daysRemaining === null) return 0;
			if (a.daysRemaining === null) return 1;
			if (b.daysRemaining === null) return -1;
			return a.daysRemaining - b.daysRemaining;
		});
	};

	const groupEntriesByYear = (entries: RRSMSEntry[]) => {
		const groups: { [year: number]: RRSMSEntry[] } = {};

		entries.forEach((entry) => {
			const lastReview = getReviewDate(entry, "last");
			if (lastReview) {
				const year = new Date(lastReview).getFullYear();
				if (!groups[year]) {
					groups[year] = [];
				}
				groups[year].push(entry);
			}
		});

		const yearGroupsArray = Object.keys(groups)
			.map((year) => ({
				year: parseInt(year),
				entries: groups[parseInt(year)].sort((a, b) => {
					// Sort by days remaining (smallest/closest to deadline first)
					const nextReviewA = getReviewDate(a, "next");
					const nextReviewB = getReviewDate(b, "next");
					const daysA = getDaysUntilReview(nextReviewA);
					const daysB = getDaysUntilReview(nextReviewB);

					// Handle null cases
					if (daysA === null && daysB === null) return 0;
					if (daysA === null) return 1;
					if (daysB === null) return -1;

					return daysA - daysB;
				}),
			}))
			.sort((a, b) => b.year - a.year); // Newest year first

		setYearGroups(yearGroupsArray);
		// Expand all years by default
		const allYears = new Set(yearGroupsArray.map((g) => g.year));
		setExpandedYears(allYears);
	};

	const toggleYear = (year: number) => {
		const newExpanded = new Set(expandedYears);
		if (newExpanded.has(year)) {
			newExpanded.delete(year);
		} else {
			newExpanded.add(year);
		}
		setExpandedYears(newExpanded);
	};

	const handleAdd = () => {
		setEditingEntry(null);
		setShowModal(true);
	};

	const handleEdit = (entry: RRSMSEntry) => {
		setEditingEntry(entry);
		setShowModal(true);
	};

	const handleDelete = async (entry: RRSMSEntry) => {
		if (!confirm(`確定要刪除 ${entry.rr_number} 嗎？`)) return;

		try {
			const token = localStorage.getItem("token");
			const response = await fetch(`/api/sms/rr-entries/${entry.id}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) throw new Error("Failed to delete");

			alert("刪除成功");
			fetchAllEntries();
		} catch (error) {
			console.error("Error deleting entry:", error);
			alert("刪除失敗");
		}
	};

	const handleStatusChange = async (entry: RRSMSEntry, newStatus: boolean) => {
		try {
			const token = localStorage.getItem("token");
			const response = await fetch(
				`/api/sms/rr-entries/${entry.id}`,
				{
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ is_deprecated: newStatus }),
				}
			);

			if (!response.ok) throw new Error("Failed to update");
			fetchAllEntries();
		} catch (error) {
			console.error("Error updating status:", error);
			alert("更新狀態失敗");
		}
	};

	const handleSave = () => {
		setShowModal(false);
		fetchAllEntries();
	};

	const formatDate = (dateString?: string) => {
		if (!dateString) return "-";
		const date = new Date(dateString);
		return date.toLocaleDateString("zh-TW", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
	};

	const getDaysUntilReview = (dateString?: string) => {
		if (!dateString) return null;
		const today = new Date();
		const reviewDate = new Date(dateString);
		const diffTime = reviewDate.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	};

	const getReviewStatus = (dateString?: string) => {
		const days = getDaysUntilReview(dateString);
		if (days === null) return { className: "", text: "" };

		if (days < 0) return { className: styles.overdue, text: "逾期" };
		if (days === 0) return { className: styles.dueToday, text: "今日到期" };
		if (days <= 7) return { className: styles.dueSoon, text: `${days}天` };
		if (days <= 30)
			return { className: styles.upcoming, text: `${days}天` };
		return { className: "", text: `${days}天` };
	};

	const extractRiskId = (riskIdBarrier?: string) => {
		if (!riskIdBarrier) return "-";
		return (
			riskIdBarrier
				.split(/[,;/\n]/)
				.map((s) => s.trim())
				.filter((s) => s.startsWith("R"))
				.join(", ") || "-"
		);
	};

	const extractBarrierId = (riskIdBarrier?: string) => {
		if (!riskIdBarrier) return "-";
		return (
			riskIdBarrier
				.split(/[,;/\n]/)
				.map((s) => s.trim())
				.filter((s) => s.toUpperCase().startsWith("B") )
				.join(", ") || "-"
		);
	};

	const getFilteredEntries = (entries: RRSMSEntry[]) => {
		let filtered = entries;
		
		if (!showDeprecated) {
			filtered = filtered.filter(entry => !entry.is_deprecated);
		}
		
		if (!searchTerm) return filtered;
		
		const search = searchTerm.toLowerCase();
		return filtered.filter(
			(entry) =>
				entry.rr_number.toLowerCase().includes(search) ||
				entry.srm_table_link?.number.toLowerCase().includes(search) ||
				entry.srm_table_link?.hazard_description
					?.toLowerCase()
					.includes(search) ||
				entry.risk_id_barrier?.toLowerCase().includes(search)
		);
	};

	// Column resizing handlers
	const handleMouseDown = (
		e: React.MouseEvent,
		column: string,
		currentWidth: number
	) => {
		e.preventDefault();
		setResizing({ column, startX: e.clientX, startWidth: currentWidth });
	};

	const handleMouseMove = (e: MouseEvent) => {
		if (!resizing) return;

		const diff = e.clientX - resizing.startX;
		const newWidth = Math.max(
			80,
			Math.min(500, resizing.startWidth + diff)
		);

		setColumnWidths((prev) => ({
			...prev,
			[resizing.column]: newWidth,
		}));
	};

	const handleMouseUp = () => {
		setResizing(null);
	};

	useEffect(() => {
		if (resizing) {
			document.addEventListener("mousemove", handleMouseMove);
			document.addEventListener("mouseup", handleMouseUp);
			return () => {
				document.removeEventListener("mousemove", handleMouseMove);
				document.removeEventListener("mouseup", handleMouseUp);
			};
		}
	}, [resizing]);

	const getColumnStyle = (column: string, defaultWidth: number) => {
		return { width: columnWidths[column] || defaultWidth };
	};

	if (loading) {
		return (
			<div className={styles.loading}>
				<div className={styles.spinner}></div>
				<p>載入中...</p>
			</div>
		);
	}

	return (
		<div className={styles.rrSmsTab}>
			<div className={styles.toolbar}>
				<div className={styles.searchBar}>
					<input
						type="text"
						placeholder="搜尋 RR 編號、管控表或風險..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className={styles.searchInput}
					/>
				</div>
				<div className={styles.stats}>
					共 {allEntries.length} 筆記錄，{yearGroups.length} 個年度
				</div>
				<label className={styles.filterCheckbox}>
					<input
						type="checkbox"
						checked={showDeprecated}
						onChange={(e) => setShowDeprecated(e.target.checked)}
					/>
					<span>顯示已棄用項目</span>
				</label>
				{isAdmin && (
					<button onClick={handleAdd} className={styles.addButton}>
						+ 新增 RR 項目
					</button>
				)}
			</div>

			<div className={styles.accordionContainer}>
				{yearGroups.length === 0 ? (
					<div className={styles.emptyState}>
						<p>尚無任何 RR SMS 項目</p>
						{isAdmin && (
							<button
								onClick={handleAdd}
								className={styles.addButton}
							>
								新增第一筆
							</button>
						)}
					</div>
				) : (
					yearGroups.map(({ year, entries }) => {
						const isExpanded = expandedYears.has(year);
						const isCurrentYear = year === currentYear;
						const filteredEntries = getFilteredEntries(entries);

						return (
							<div
								key={year}
								className={`${styles.yearGroup} ${
									isCurrentYear ? styles.currentYear : ""
								}`}
							>
								<div
									className={styles.yearHeader}
									onClick={() => toggleYear(year)}
								>
									<div className={styles.yearHeaderLeft}>
										<span className={styles.expandIcon}>
											{isExpanded ? "▼" : "▶"}
										</span>
										<h3>{year} 年度</h3>
										<span className={styles.yearCount}>
											({filteredEntries.length} 筆
											{searchTerm &&
												` / ${entries.length} 總數`}
											)
										</span>
									</div>
								</div>

								{isExpanded && (
									<div className={styles.yearContent}>
										<div className={styles.tableWrapper}>
											<table className={styles.table}>
												<thead>
													<tr>
														<th
															style={getColumnStyle(
																"rr_number",
																130
															)}
														>
															RR編號
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"rr_number",
																		columnWidths[
																			"rr_number"
																		] || 130
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"srm_link",
																200
															)}
														>
															管控表Link
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"srm_link",
																		columnWidths[
																			"srm_link"
																		] || 200
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"risk_id",
																120
															)}
														>
															類型
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"risk_id",
																		columnWidths[
																			"risk_id"
																		] || 120
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"barrier_id",
																120
															)}
														>
															ID
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"barrier_id",
																		columnWidths[
																			"barrier_id"
																		] || 120
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"last_review",
																120
															)}
														>
															Last Review
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"last_review",
																		columnWidths[
																			"last_review"
																		] || 120
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"next_review",
																120
															)}
														>
															Next Review
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"next_review",
																		columnWidths[
																			"next_review"
																		] || 120
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"deprecated_status",
																80
															)}
														>
															狀態
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"deprecated_status",
																		columnWidths[
																			"deprecated_status"
																		] || 80
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"status",
																100
															)}
														>
															剩餘天數
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"status",
																		columnWidths[
																			"status"
																		] || 100
																	)
																}
															/>
														</th>
														{isAdmin && (
															<th
																style={{
																	width: 100,
																}}
															>
																操作
															</th>
														)}
													</tr>
												</thead>
												<tbody>
													{(() => {
														const expandedRows = expandToRows(filteredEntries);
														
														if (expandedRows.length === 0) {
															return (
																<tr>
																	<td
																		colSpan={isAdmin ? 8 : 7}
																		className={styles.emptyState}
																	>
																		{searchTerm ? "沒有符合搜尋的項目" : "本年度尚無項目"}
																	</td>
																</tr>
															);
														}
														
														return expandedRows.map((row) => {
															const status = getReviewStatus(row.nextReview);
															
															let typeColor = "#4a9eff";
															if (row.reviewType === "Barrier") {
																typeColor = "#10b981";
															} else if (row.reviewType === "Risk+Barrier") {
																typeColor = "#8b5cf6";
															}
															
															return (
																<tr key={row.rowId} className={row.entry.is_deprecated ? styles.deprecatedRow : ""}>
																	<td className={styles.rrNumber}>{row.entry.rr_number}</td>
																	<td className={styles.srmLink}>
																		{row.entry.srm_table_link ? (
																			<div>
																				<div className={styles.srmNumber}>
																					{row.entry.srm_table_link.number}
																				</div>
																				<div className={styles.srmDesc}>
																					{row.entry.srm_table_link.hazard_description?.substring(0, 40)}
																					{(row.entry.srm_table_link.hazard_description?.length || 0) > 40 ? "..." : ""}
																				</div>
																			</div>
																		) : (
																			"-"
																		)}
																	</td>
																	<td>
																		<span style={{ color: typeColor, fontWeight: 600, fontSize: "0.85rem" }}>
																			{row.reviewType}
																		</span>
																	</td>
																	<td style={{ fontSize: "0.85rem" }}>{row.reviewId}</td>
																	<td>{formatDate(row.lastReview)}</td>
																	<td>{formatDate(row.nextReview)}</td>
																	<td>
																		{isAdmin ? (
																			<select
																				className={styles.statusSelect}
																				value={row.entry.is_deprecated ? "deprecated" : "active"}
																				onChange={(e) => handleStatusChange(row.entry, e.target.value === "deprecated")}
																			>
																				<option value="active">有效</option>
																				<option value="deprecated">棄用</option>
																			</select>
																		) : (
																			<span
																				className={
																					row.entry.is_deprecated
																						? styles.deprecatedBadge
																						: styles.activeBadge
																				}
																			>
																				{row.entry.is_deprecated ? "棄用" : "有效"}
																			</span>
																		)}
																	</td>
																	<td>
																		{status.text && (
																			<span className={`${styles.statusBadge} ${status.className}`}>
																				{status.text}
																			</span>
																		)}
																	</td>
																	{isAdmin && (
																		<td>
																			<div className={styles.actions}>
																				<button
																					onClick={() => handleEdit(row.entry)}
																					className={styles.editButton}
																					title="編輯"
																				>
																					📝
																				</button>
																				<button
																					onClick={() => handleDelete(row.entry)}
																					className={styles.deleteButton}
																					title="刪除"
																				>
																					❌
																				</button>
																			</div>
																		</td>
																	)}
																</tr>
															);
														});
													})()}
												</tbody>
											</table>
										</div>
									</div>
								)}
							</div>
						);
					})
				)}
			</div>

			{showModal && (
				<RRSMSModal
					entry={editingEntry}
					userId={userId}
					currentYear={currentYear}
					onClose={() => setShowModal(false)}
					onSave={handleSave}
				/>
			)}
		</div>
	);
}