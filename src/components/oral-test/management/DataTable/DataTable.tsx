// src/components/oral-test/management/DataTable/DataTable.tsx
"use client";

import React, { useState, useMemo, useEffect } from "react";
import styles from "./DataTable.module.css";

interface Column {
	key: string;
	label: string;
	sortable?: boolean;
	filterable?: boolean;
	render?: (value: any, row: any) => React.ReactNode;
}

interface DataTableProps {
	data: any[];
	columns: Column[];
	onEdit?: (item: any) => void;
	onDelete?: (item: any) => void;
	onSelectionChange?: (selectedIds: string[]) => void;
	selectedItems?: string[];
	rowKey: string;
	searchable?: boolean;
	paginated?: boolean;
	pageSize?: number;
	// NEW: External pagination control props
	currentPage?: number;
	onPageChange?: (page: number) => void;
	preservePagination?: boolean;
}

const DataTable = ({
	data,
	columns,
	onEdit,
	onDelete,
	onSelectionChange,
	selectedItems = [],
	rowKey,
	searchable = true,
	paginated = true,
	pageSize = 10,
	// NEW: External pagination props with defaults
	currentPage: externalCurrentPage,
	onPageChange,
	preservePagination = false,
}: DataTableProps) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [sortConfig, setSortConfig] = useState<{
		key: string;
		direction: "asc" | "desc";
	} | null>(null);
	
	// Use external currentPage if provided, otherwise use internal state
	const [internalCurrentPage, setInternalCurrentPage] = useState(1);
	const currentPage = preservePagination && externalCurrentPage !== undefined 
		? externalCurrentPage 
		: internalCurrentPage;

	// Filter and search data
	const filteredData = useMemo(() => {
		if (!searchTerm) return data;

		return data.filter((item) =>
			columns.some((column) => {
				if (!column.filterable && !searchable) return false;
				const value = item[column.key];
				if (value == null) return false;
				return value
					.toString()
					.toLowerCase()
					.includes(searchTerm.toLowerCase());
			})
		);
	}, [data, searchTerm, columns, searchable]);

	// Sort data
	const sortedData = useMemo(() => {
		if (!sortConfig) return filteredData;

		return [...filteredData].sort((a, b) => {
			const aValue = a[sortConfig.key];
			const bValue = b[sortConfig.key];

			if (aValue == null) return 1;
			if (bValue == null) return -1;

			if (typeof aValue === "string" && typeof bValue === "string") {
				return sortConfig.direction === "asc"
					? aValue.localeCompare(bValue)
					: bValue.localeCompare(aValue);
			}

			if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
			if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
			return 0;
		});
	}, [filteredData, sortConfig]);

	// Paginate data
	const paginatedData = useMemo(() => {
		if (!paginated) return sortedData;

		const startIndex = (currentPage - 1) * pageSize;
		return sortedData.slice(startIndex, startIndex + pageSize);
	}, [sortedData, currentPage, pageSize, paginated]);

	const totalPages = Math.ceil(sortedData.length / pageSize);

	// NEW: Auto-adjust page if current page is beyond available pages
	useEffect(() => {
		if (totalPages > 0 && currentPage > totalPages) {
			const newPage = Math.max(1, totalPages);
			if (preservePagination && onPageChange) {
				onPageChange(newPage);
			} else {
				setInternalCurrentPage(newPage);
			}
		}
	}, [totalPages, currentPage, preservePagination, onPageChange]);

	// NEW: Reset search when data changes significantly (optional)
	useEffect(() => {
		if (searchTerm && filteredData.length === 0 && data.length > 0) {
			setSearchTerm("");
		}
	}, [data.length, filteredData.length, searchTerm]);

	const handleSort = (columnKey: string) => {
		const column = columns.find((col) => col.key === columnKey);
		if (!column?.sortable) return;

		setSortConfig((prev) => ({
			key: columnKey,
			direction:
				prev?.key === columnKey && prev.direction === "asc"
					? "desc"
					: "asc",
		}));
	};

	// NEW: Modified page change handler
	const handlePageChange = (newPage: number) => {
		if (preservePagination && onPageChange) {
			onPageChange(newPage);
		} else {
			setInternalCurrentPage(newPage);
		}
	};

	const handleSelectAll = (checked: boolean) => {
		if (!onSelectionChange) return;

		if (checked) {
			const allIds = paginatedData.map((item) => item[rowKey]);
			onSelectionChange([...new Set([...selectedItems, ...allIds])]);
		} else {
			const pageIds = new Set(paginatedData.map((item) => item[rowKey]));
			onSelectionChange(selectedItems.filter((id) => !pageIds.has(id)));
		}
	};

	const handleSelectItem = (itemId: string, checked: boolean) => {
		if (!onSelectionChange) return;

		if (checked) {
			onSelectionChange([...selectedItems, itemId]);
		} else {
			onSelectionChange(selectedItems.filter((id) => id !== itemId));
		}
	};

	const isAllSelected =
		paginatedData.length > 0 &&
		paginatedData.every((item) => selectedItems.includes(item[rowKey]));
	const isIndeterminate =
		paginatedData.some((item) => selectedItems.includes(item[rowKey])) &&
		!isAllSelected;

	return (
		<div className={styles.dataTable}>
			{searchable && (
				<div className={styles.searchBar}>
					<input
						type="text"
						placeholder="Search..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className={styles.searchInput}
					/>
				</div>
			)}

			<div className={styles.tableWrapper}>
				<table className={styles.table}>
					<thead>
						<tr>
							{onSelectionChange && (
								<th className={styles.checkboxColumn}>
									<input
										type="checkbox"
										checked={isAllSelected}
										ref={(input) => {
											if (input)
												input.indeterminate =
													isIndeterminate;
										}}
										onChange={(e) =>
											handleSelectAll(e.target.checked)
										}
									/>
								</th>
							)}
							{columns.map((column) => (
								<th
									key={column.key}
									className={`${styles.headerCell} ${
										column.sortable ? styles.sortable : ""
									}`}
									onClick={() => handleSort(column.key)}
								>
									<div className={styles.headerContent}>
										{column.label}
										{column.sortable && (
											<span className={styles.sortIcon}>
												{sortConfig?.key === column.key
													? sortConfig.direction ===
													  "asc"
														? "↑"
														: "↓"
													: "↕"}
											</span>
										)}
									</div>
								</th>
							))}
							{(onEdit || onDelete) && (
								<th className={styles.actionsColumn}>
									Actions
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{paginatedData.map((item) => {
							const itemId = item[rowKey];

							return (
								<tr
									key={itemId}
									className={`${styles.dataRow} ${
										selectedItems.includes(itemId)
											? styles.selected
											: ""
									}`}
								>
									{onSelectionChange && (
										<td className={styles.checkboxColumn}>
											<input
												type="checkbox"
												checked={selectedItems.includes(
													itemId
												)}
												onChange={(e) =>
													handleSelectItem(
														itemId,
														e.target.checked
													)
												}
											/>
										</td>
									)}
									{columns.map((column) => (
										<td
											key={column.key}
											className={styles.dataCell}
										>
											{column.render
												? column.render(
														item[column.key],
														item
												  )
												: item[
														column.key
												  ]?.toString() || "-"}
										</td>
									))}
									{(onEdit || onDelete) && (
										<td className={styles.actionsColumn}>
											<div
												className={styles.actionButtons}
											>
												{onEdit && (
													<button
														className={
															styles.editButton
														}
														onClick={() =>
															onEdit(item)
														}
														title="Edit"
													>
														✏️
													</button>
												)}
												{onDelete && (
													<button
														className={
															styles.deleteButton
														}
														onClick={() =>
															onDelete(item)
														}
														title="Delete"
													>
														🗑️
													</button>
												)}
											</div>
										</td>
									)}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{paginated && totalPages > 1 && (
				<div className={styles.pagination}>
					<div className={styles.paginationInfo}>
						Showing {(currentPage - 1) * pageSize + 1} to{" "}
						{Math.min(currentPage * pageSize, sortedData.length)} of{" "}
						{sortedData.length} entries
					</div>
					<div className={styles.paginationControls}>
						<button
							className={styles.pageButton}
							onClick={() => handlePageChange(1)}
							disabled={currentPage === 1}
						>
							⮜
						</button>
						<button
							className={styles.pageButton}
							onClick={() => handlePageChange(currentPage - 1)}
							disabled={currentPage === 1}
						>
							◀
						</button>

						{Array.from(
							{ length: Math.min(5, totalPages) },
							(_, i) => {
								let pageNum;
								if (totalPages <= 5) {
									pageNum = i + 1;
								} else if (currentPage <= 3) {
									pageNum = i + 1;
								} else if (currentPage > totalPages - 3) {
									pageNum = totalPages - 4 + i;
								} else {
									pageNum = currentPage - 2 + i;
								}

								return (
									<button
										key={pageNum}
										className={`${styles.pageButton} ${
											currentPage === pageNum
												? styles.active
												: ""
										}`}
										onClick={() => handlePageChange(pageNum)}
									>
										{pageNum}
									</button>
								);
							}
						)}

						<button
							className={styles.pageButton}
							onClick={() => handlePageChange(currentPage + 1)}
							disabled={currentPage === totalPages}
						>
							▶
						</button>
						<button
							className={styles.pageButton}
							onClick={() => handlePageChange(totalPages)}
							disabled={currentPage === totalPages}
						>
							⮞
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default DataTable;