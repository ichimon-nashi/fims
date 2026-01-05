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

	const groupEntriesByYear = (entries: RRSMSEntry[]) => {
		const groups: { [year: number]: RRSMSEntry[] } = {};

		entries.forEach((entry) => {
			if (entry.last_review) {
				const year = new Date(entry.last_review).getFullYear();
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
				const daysA = getDaysUntilReview(a.next_review);
				const daysB = getDaysUntilReview(b.next_review);
				
				// Handle null cases (entries without next_review go to bottom)
				if (daysA === null && daysB === null) return 0;
				if (daysA === null) return 1;
				if (daysB === null) return -1;
				
				// Sort by days remaining ascending (smallest first)
				return daysA - daysB;
			}),
			}))
			.sort((a, b) => b.year - a.year); // Newest year first

		setYearGroups(yearGroupsArray);
		// Expand all years by default
		const allYears = new Set(yearGroupsArray.map(g => g.year));
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

	const handleSave = () => {
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
				.filter((s) => s.startsWith("B"))
				.join(", ") || "-"
		);
	};

	const getFilteredEntries = (entries: RRSMSEntry[]) => {
		if (!searchTerm) return entries;
		const search = searchTerm.toLowerCase();
		return entries.filter(
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
															Risk ID
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
															Barrier ID
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
													{filteredEntries.length ===
													0 ? (
														<tr>
															<td
																colSpan={
																	isAdmin
																		? 8
																		: 7
																}
																className={
																	styles.emptyState
																}
															>
																{searchTerm
																	? "沒有符合搜尋的項目"
																	: "本年度尚無項目"}
															</td>
														</tr>
													) : (
														filteredEntries.map(
															(entry) => {
																const status =
																	getReviewStatus(
																		entry.next_review
																	);
																return (
																	<tr
																		key={
																			entry.id
																		}
																	>
																		<td
																			className={
																				styles.rrNumber
																			}
																		>
																			{
																				entry.rr_number
																			}
																		</td>
																		<td
																			className={
																				styles.srmLink
																			}
																		>
																			{entry.srm_table_link ? (
																				<div>
																					<div
																						className={
																							styles.srmNumber
																						}
																					>
																						{
																							entry
																								.srm_table_link
																								.number
																						}
																					</div>
																					<div
																						className={
																							styles.srmDesc
																						}
																					>
																						{entry.srm_table_link.hazard_description?.substring(
																							0,
																							40
																						)}
																						{(entry
																							.srm_table_link
																							.hazard_description
																							?.length ||
																							0) >
																						40
																							? "..."
																							: ""}
																					</div>
																				</div>
																			) : (
																				"-"
																			)}
																		</td>
																		<td>
																			{extractRiskId(
																				entry.risk_id_barrier
																			)}
																		</td>
																		<td>
																			{extractBarrierId(
																				entry.risk_id_barrier
																			)}
																		</td>
																		<td>
																			{formatDate(
																				entry.last_review
																			)}
																		</td>
																		<td>
																			{formatDate(
																				entry.next_review
																			)}
																		</td>
																		<td>
																			{status.text && (
																				<span
																					className={`${styles.statusBadge} ${status.className}`}
																				>
																					{
																						status.text
																					}
																				</span>
																			)}
																		</td>
																		{isAdmin && (
																			<td>
																				<div
																					className={
																						styles.actions
																					}
																				>
																					<button
																						onClick={() =>
																							handleEdit(
																								entry
																							)
																						}
																						className={
																							styles.editButton
																						}
																						title="編輯"
																					>
																						📝
																					</button>
																					<button
																						onClick={() =>
																							handleDelete(
																								entry
																							)
																						}
																						className={
																							styles.deleteButton
																						}
																						title="刪除"
																					>
																						❌
																					</button>
																				</div>
																			</td>
																		)}
																	</tr>
																);
															}
														)
													)}
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