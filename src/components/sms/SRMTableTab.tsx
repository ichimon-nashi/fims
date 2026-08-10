// src/components/sms/SRMTableTab.tsx
"use client";

import React, { useState, useEffect } from "react";
import styles from "./SRMTableTab.module.css";
import SRMEntryModal from "./SRMEntryModal";

interface SRMTableTabProps {
	currentYear: number;
	userId: string;
	isAdmin: boolean;
}

interface SRMEntry {
	id: string;
	number: string;
	file_date: string;
	identification_source_type: "SA" | "SRM";
	hazard_description?: string;
	possible_cause?: string;
	hazard_impact?: string;
	existing_measures?: string;
	current_risk_assessment?: string;
	risk_mitigation_measures?: string;
	post_mitigation_assessment?: string;
	human_factors_codes?: string[];
	ef_attribute_codes?: string[];
	year: number;
	created_at: string;
}

interface SRMTableLink {
	id: string;
	number: string;
	file_date: string;
	hazard_description?: string;
	identification_source_type?: string;
	year?: number;
}

interface SRMEntryRaw {
	id: string;
	rr_number: string;
	srm_table_link?: SRMTableLink;
	created_at: string;
	// ... other RR fields
}

interface YearGroup {
	year: number;
	entries: SRMEntry[];
}

export default function SRMTableTab({
	currentYear,
	userId,
	isAdmin,
}: SRMTableTabProps) {
	const [allEntries, setAllEntries] = useState<SRMEntry[]>([]);
	const [yearGroups, setYearGroups] = useState<YearGroup[]>([]);
	const [expandedYears, setExpandedYears] = useState<Set<number>>(
		new Set([currentYear])
	);
	const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
	const [loading, setLoading] = useState(true);
	const [searchTerm, setSearchTerm] = useState("");
	const [showModal, setShowModal] = useState(false);
	const [editingEntry, setEditingEntry] = useState<SRMEntry | undefined>(
		undefined
	);

	// Column resizing state
	const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>(
		() => {
			if (typeof window !== "undefined") {
				const saved = localStorage.getItem("srmTableColumnWidths");
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

	// Helper function to get risk color matching the risk matrix
	const getRiskColor = (riskValue: string): string => {
		if (!riskValue || riskValue.length < 2) return "#6B7280"; // Default gray

		const likelihood = riskValue.charAt(0);
		const severity = riskValue.charAt(1);
		const l = parseInt(likelihood);
		const sIndex = severity.charCodeAt(0) - "A".charCodeAt(0);

		// High Risk (Red) - #DC2626
		if (
			(l === 5 && sIndex <= 2) || // 5A, 5B, 5C
			(l === 4 && sIndex <= 1) || // 4A, 4B
			(l === 3 && sIndex === 0)
		) {
			// 3A
			return "#DC2626";
		}

		// Medium Risk (Orange/Yellow) - #F59E0B
		if (
			(l === 5 && sIndex === 3) || // 5D
			(l === 4 && sIndex === 2) || // 4C
			(l === 3 && sIndex === 1) || // 3B
			(l === 3 && sIndex === 2) || // 3C
			(l === 2 && sIndex === 0) || // 2A
			(l === 2 && sIndex === 1) || // 2B
			(l === 1 && sIndex === 0)
		) {
			// 1A
			return "#F59E0B";
		}

		// Low Risk (Green) - #10B981
		// Includes: 4D, 4E, 5E, 3D, 3E, 2C, 2D, 2E, 1B, 1C, 1D, 1E
		return "#10B981";
	};

	useEffect(() => {
		fetchAllEntries();
	}, []);

	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(
				"srmTableColumnWidths",
				JSON.stringify(columnWidths)
			);
		}
	}, [columnWidths]);

	const fetchAllEntries = async () => {
		try {
			setLoading(true);
			const token = localStorage.getItem("token");

			console.log("📋 Fetching ALL SRM entries");

			// Fetch ALL entries (no year filter)
			const response = await fetch("/api/sms/srm-entries", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				const errorData = await response.json();
				console.error("Failed to fetch SRM entries:", errorData);
				throw new Error("Failed to fetch entries");
			}

			const data = await response.json();
			console.log("✅ SRM entries fetched:", data.length);
			console.log("🔍 RAW first entry from API:", JSON.stringify(data[0], null, 2));
			
			setAllEntries(data);
			groupEntriesByYear(data);
		} catch (error) {
			console.error("Error fetching SRM entries:", error);
		} finally {
			setLoading(false);
		}
	};

	const groupEntriesByYear = (entries: SRMEntry[]) => {
		const groups: { [year: number]: SRMEntry[] } = {};

		entries.forEach((entry, index) => {
			// Use year field if available, otherwise extract from file_date
			const year = entry.year || new Date(entry.file_date).getFullYear();
			
			// Debug first entry
			if (index === 0) {
				console.log('🔍 First entry:', {
					file_date: entry.file_date,
					year_field: entry.year,
					computed_year: year
				});
			}
			
			if (!groups[year]) {
				groups[year] = [];
			}
			groups[year].push(entry);
		});

		console.log('📊 Years found:', Object.keys(groups));
		const yearGroupsArray = Object.entries(groups)
			.map(([yearStr, yearEntries]) => ({
				year: parseInt(yearStr),
					entries: yearEntries.sort((a, b) => {
						// First sort by file_date (newest first = oldest at bottom)
						const dateA = new Date(a.file_date).getTime();
						const dateB = new Date(b.file_date).getTime();
						if (dateB !== dateA) {
							return dateB - dateA; // Newer dates first
						}
						// If same date, sort by number (larger number first = smaller at bottom)
						return b.number.localeCompare(a.number);
					}),
			}))
			.sort((a, b) => b.year - a.year);

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

	const toggleRow = (id: string) => {
		const newExpanded = new Set(expandedRows);
		if (newExpanded.has(id)) {
			newExpanded.delete(id);
		} else {
			newExpanded.add(id);
		}
		setExpandedRows(newExpanded);
	};

	const handleAdd = () => {
		setEditingEntry(undefined);
		setShowModal(true);
	};

	const handleEdit = (entry: SRMEntry) => {
		setEditingEntry(entry);
		setShowModal(true);
	};

	const handleDelete = async (entry: SRMEntry) => {
		if (!confirm(`確定要刪除 ${entry.number} 嗎？`)) return;

		try {
			const token = localStorage.getItem("token");
			const response = await fetch(`/api/sms/srm-entries/${entry.id}`, {
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
		return new Date(dateString).toLocaleDateString("zh-TW");
	};

	const getFilteredEntries = (entries: SRMEntry[]) => {
		if (!searchTerm) return entries;
		const search = searchTerm.toLowerCase();
		return entries.filter(
			(entry) =>
				entry.number.toLowerCase().includes(search) ||
				entry.hazard_description?.toLowerCase().includes(search) ||
				entry.possible_cause?.toLowerCase().includes(search)
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
		<div className={styles.srmTableTab}>
			<div className={styles.toolbar}>
				<div className={styles.toolbarLeft}>
					<div className={styles.stats}>
						共 {allEntries.length} 筆記錄，{yearGroups.length}{" "}
						個年度
					</div>
					<div className={styles.searchBar}>
						<input
							type="text"
							placeholder="搜尋編號、危害或原因..."
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className={styles.searchInput}
						/>
					</div>
				</div>
				{isAdmin && (
					<button className={styles.addButton} onClick={handleAdd}>
						+ 新增管控表項目
					</button>
				)}
			</div>

			<div className={styles.accordionContainer}>
				{yearGroups.length === 0 ? (
					<div className={styles.emptyState}>
						<p>尚無任何管控表項目</p>
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
						const isYearExpanded = expandedYears.has(year);
						const filteredEntries = getFilteredEntries(entries);
						const isCurrentYear = year === currentYear;

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
											{isYearExpanded ? "▼" : "▶"}
										</span>
										<h3>{year} 年度</h3>
										<span className={styles.yearCount}>
											({entries.length} 筆)
										</span>
									</div>
								</div>

								{isYearExpanded && (
									<div className={styles.yearContent}>
										<div className={styles.tableWrapper}>
											<table className={styles.table}>
												<thead>
													<tr>
														<th
															style={{
																width: 50,
															}}
														></th>
														<th
															style={getColumnStyle(
																"number",
																150
															)}
														>
															管控表編號
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"number",
																		columnWidths[
																			"number"
																		] || 150
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"file_date",
																120
															)}
														>
															建檔日期
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"file_date",
																		columnWidths[
																			"file_date"
																		] || 120
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"source",
																80
															)}
														>
															來源
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"source",
																		columnWidths[
																			"source"
																		] || 80
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"description",
																250
															)}
														>
															危害描述
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"description",
																		columnWidths[
																			"description"
																		] || 250
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"current_risk",
																100
															)}
														>
															當前風險評估
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"current_risk",
																		columnWidths[
																			"current_risk"
																		] || 100
																	)
																}
															/>
														</th>
														<th
															style={getColumnStyle(
																"post_risk",
																100
															)}
														>
															緩解後評估
															<div
																className={
																	styles.resizeHandle
																}
																onMouseDown={(
																	e
																) =>
																	handleMouseDown(
																		e,
																		"post_risk",
																		columnWidths[
																			"post_risk"
																		] || 100
																	)
																}
															/>
														</th>
														<th
															style={{
																width: 100,
															}}
														>
															操作
														</th>
													</tr>
												</thead>
												<tbody>
													{filteredEntries.length ===
													0 ? (
														<tr>
															<td
																colSpan={8}
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
																const isExpanded =
																	expandedRows.has(
																		entry.id
																	);
																return (
																	<React.Fragment key={entry.id}>
																		<tr
																			className={
																				styles.mainRow
																			}
																		>
																			<td
																				className={
																					styles.expandCol
																				}
																			>
																				<button
																					onClick={() =>
																						toggleRow(
																							entry.id
																						)
																					}
																					className={
																						styles.expandButton
																					}
																					title={
																						isExpanded
																							? "收合"
																							: "展開詳情"
																					}
																				>
																					≡
																				</button>
																			</td>
																			<td
																				className={
																					styles.srmNumber
																				}
																			>
																				{
																					entry.number
																				}
																			</td>
																			<td>
																				{formatDate(
																					entry.file_date
																				)}
																			</td>
																			<td>
																				<span
																					className={`${
																						styles.sourceBadge
																					} ${
																						styles[
																							entry.identification_source_type?.toLowerCase() || ''
																						]
																					}`}
																				>
																					{
																						entry.identification_source_type || 'N/A'
																					}
																				</span>
																			</td>
																			<td
																				className={
																					styles.description
																				}
																			>
																				{entry.hazard_description?.substring(
																					0,
																					80
																				) ||
																					"-"}
																				{(entry
																					.hazard_description
																					?.length ||
																					0) >
																				80
																					? "..."
																					: ""}
																			</td>
																			<td>
																				{entry.current_risk_assessment ? (
																					<span
																						className={
																							styles.riskBadge
																						}
																						style={{
																							backgroundColor:
																								getRiskColor(
																									entry.current_risk_assessment
																								),
																						}}
																					>
																						{
																							entry.current_risk_assessment
																						}
																					</span>
																				) : (
																					"-"
																				)}
																			</td>
																			<td>
																				{entry.post_mitigation_assessment ? (
																					<span
																						className={
																							styles.riskBadge
																						}
																						style={{
																							backgroundColor:
																								getRiskColor(
																									entry.post_mitigation_assessment
																								),
																						}}
																					>
																						{
																							entry.post_mitigation_assessment
																						}
																					</span>
																				) : (
																					"-"
																				)}
																			</td>
																			<td>
																				<div
																					className={
																						styles.actions
																					}
																				>
																					{isAdmin && (
																						<>
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
																						</>
																					)}
																				</div>
																			</td>
																		</tr>
																		{isExpanded && (
																			<tr
																				className={
																					styles.expandedRow
																				}
																			>
																				<td
																					colSpan={
																						8
																					}
																				>
																					<div
																						className={
																							styles.expandedContent
																						}
																					>
																						<div
																							className={
																								styles.detailGrid
																							}
																						>
																							<div
																								className={
																									styles.detailSection
																								}
																							>
																								<h4>
																									基本資訊
																								</h4>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										管控表編號:
																									</strong>{" "}
																									{
																										entry.number
																									}
																								</div>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										建檔日期:
																									</strong>{" "}
																									{formatDate(
																										entry.file_date
																									)}
																								</div>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										來源類型:
																									</strong>{" "}
																									{
																										entry.identification_source_type || 'N/A'
																									}
																								</div>
																							</div>

																							<div
																								className={
																									styles.detailSection
																								}
																							>
																								<h4>
																									危害資訊
																								</h4>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										標題:
																									</strong>
																									<p>
																										{entry.hazard_description ||
																											"-"}
																									</p>
																								</div>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										危害描述:
																									</strong>
																									<p>
																										{entry.possible_cause ||
																											"-"}
																									</p>
																								</div>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										危害影響:
																									</strong>
																									<p>
																										{entry.hazard_impact ||
																											"-"}
																									</p>
																								</div>
																							</div>

																							<div
																								className={
																									styles.detailSection
																								}
																							>
																								<h4>
																									風險評估
																								</h4>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										現有措施:
																									</strong>
																									<p>
																										{entry.existing_measures ||
																											"-"}
																									</p>
																								</div>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										當前風險評估:
																									</strong>{" "}
																									{entry.current_risk_assessment ||
																										"-"}
																								</div>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										風險緩解措施:
																									</strong>
																									{(() => {
																										if (
																											!entry.risk_mitigation_measures
																										)
																											return (
																												<p>
																													-
																												</p>
																											);

																										try {
																											const measures =
																												JSON.parse(
																													entry.risk_mitigation_measures
																												);
																											if (
																												Array.isArray(
																													measures
																												) &&
																												measures.length >
																													0
																											) {
																												return (
																													<div
																														className={
																															styles.measuresTable
																														}
																													>
																														<table>
																															<thead>
																																<tr>
																																	<th>
																																		風險緩解措施
																																	</th>
																																	<th>
																																		辦理單位
																																	</th>
																																	<th>
																																		實施期限
																																	</th>
																																</tr>
																															</thead>
																															<tbody>
																																{measures.map(
																																	(
																																		measure: any,
																																		idx: number
																																	) => (
																																		<tr
																																			key={
																																				idx
																																			}
																																		>
																																			<td>
																																				{measure.description ||
																																					"-"}
																																			</td>
																																			<td>
																																				{measure.department ||
																																					"-"}
																																			</td>
																																			<td>
																																				{measure.deadline ||
																																					"-"}
																																			</td>
																																		</tr>
																																	)
																																)}
																															</tbody>
																														</table>
																													</div>
																												);
																											}
																											// Fallback for non-array JSON
																											return (
																												<p>
																													{
																														entry.risk_mitigation_measures
																													}
																												</p>
																											);
																										} catch {
																											// Old string format
																											return (
																												<p>
																													{
																														entry.risk_mitigation_measures
																													}
																												</p>
																											);
																										}
																									})()}
																								</div>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										緩解後評估:
																									</strong>{" "}
																									{entry.post_mitigation_assessment ||
																										"-"}
																								</div>
																							</div>

																							<div
																								className={
																									styles.detailSection
																								}
																							>
																								<h4>
																									分析代碼
																								</h4>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										人因代碼:
																									</strong>
																									<div
																										className={
																											styles.codeTags
																										}
																									>
																										{entry.human_factors_codes &&
																										entry
																											.human_factors_codes
																											.length >
																											0
																											? entry.human_factors_codes.map(
																													(
																														code
																													) => (
																														<span
																															key={
																																code
																															}
																															className={
																																styles.codeTag
																															}
																														>
																															{
																																code
																															}
																														</span>
																													)
																											  )
																											: "-"}
																									</div>
																								</div>
																								<div
																									className={
																										styles.detailItem
																									}
																								>
																									<strong>
																										EF屬性代碼:
																									</strong>
																									<div
																										className={
																											styles.codeTags
																										}
																									>
																										{entry.ef_attribute_codes &&
																										entry
																											.ef_attribute_codes
																											.length >
																											0
																											? entry.ef_attribute_codes.map(
																													(
																														code
																													) => (
																														<span
																															key={
																																code
																															}
																															className={
																																styles.codeTag
																															}
																														>
																															{
																																code
																															}
																														</span>
																													)
																											  )
																											: "-"}
																									</div>
																								</div>
																							</div>
																						</div>
																					</div>
																				</td>
																			</tr>
																		)}
																	</React.Fragment>
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
				<SRMEntryModal
					entry={editingEntry}
					currentYear={currentYear}
					onClose={() => setShowModal(false)}
					onSave={handleSave}
				/>
			)}
		</div>
	);
}