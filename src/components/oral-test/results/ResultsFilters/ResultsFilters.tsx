// src/components/results/ResultsFilters/ResultsFilters.tsx
"use client";

import React from "react";
import styles from "./ResultsFilters.module.css";

interface ResultsFiltersProps {
	selectedYear: number;
	selectedMonth: number; // 0 = All months, 1-12 = specific month
	onYearChange: (year: number) => void;
	onMonthChange: (month: number) => void;
	totalResults: number;
	availableYears?: number[];
	availableMonths?: number[]; // Available months for the selected year
}

const ResultsFilters = ({
	selectedYear,
	selectedMonth,
	onYearChange,
	onMonthChange,
	totalResults,
	availableYears = [],
	availableMonths = [],
}: ResultsFiltersProps) => {
	
	const monthNames = [
		"All Months",
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"
	];

	const getFilterDescription = () => {
		if (selectedMonth === 0) {
			return `All of ${selectedYear}`;
		}
		return `${monthNames[selectedMonth]} ${selectedYear}`;
	};

	// Debug logging
	console.log('ResultsFilters render:', {
		selectedYear,
		selectedMonth,
		availableMonths,
		totalResults
	});

	return (
		<div className={styles.resultsFilters}>
			<div className={styles.filterSection}>
				<label className={styles.filterLabel}>
					Filter by Year:
					<select
						value={selectedYear}
						onChange={(e) => onYearChange(parseInt(e.target.value))}
						className={styles.filterSelect}
					>
						{availableYears.length > 0 ? (
							availableYears.map((year) => (
								<option key={year} value={year}>
									{year}
								</option>
							))
						) : (
							<option value={selectedYear}>
								{selectedYear} (No data)
							</option>
						)}
					</select>
				</label>

				<label className={styles.filterLabel}>
					Filter by Month:
					<select
						value={selectedMonth}
						onChange={(e) => onMonthChange(parseInt(e.target.value))}
						className={styles.filterSelect}
					>
						<option value={0}>All Months</option>
						{availableMonths.map((month) => (
							<option key={month} value={month}>
								{monthNames[month]}
							</option>
						))}
					</select>
				</label>
			</div>

			<div className={styles.resultsSummary}>
				<span className={styles.resultsCount}>
					{totalResults} test{totalResults !== 1 ? "s" : ""} found for{" "}
					{getFilterDescription()}
				</span>
			</div>
		</div>
	);
};

export default ResultsFilters;