// src/components/results/ResultsFilters/ResultsFilters.tsx
"use client";

import React from "react";
import { TrainingType } from "@/lib/types";
import styles from "./ResultsFilters.module.css";

interface ResultsFiltersProps {
	selectedYear: number;
	selectedMonth: number; // 0 = All months, 1-12 = specific month
	onYearChange: (year: number) => void;
	onMonthChange: (month: number) => void;
	totalResults: number;
	availableYears?: number[];
	availableMonths?: number[]; // Available months for the selected year
	// Training type filter — optional so this component still works if a
	// caller doesn't pass these (backward compatible with any other usage).
	selectedTrainingType?: TrainingType | "ALL";
	onTrainingTypeChange?: (trainingType: TrainingType | "ALL") => void;
	availableTrainingTypes?: TrainingType[];
}

const ResultsFilters = ({
	selectedYear,
	selectedMonth,
	onYearChange,
	onMonthChange,
	totalResults,
	availableYears = [],
	availableMonths = [],
	selectedTrainingType = "FAAT",
	onTrainingTypeChange,
	availableTrainingTypes = [],
}: ResultsFiltersProps) => {
	
	const monthNames = [
		"All Months",
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"
	];

	const getFilterDescription = () => {
		const period =
			selectedMonth === 0
				? `All of ${selectedYear}`
				: `${monthNames[selectedMonth]} ${selectedYear}`;
		return selectedTrainingType === "ALL"
			? period
			: `${period} · ${selectedTrainingType}`;
	};

	// FAAT is always offered as an option since it's the default and is
	// guaranteed to exist (backfilled for every historical row). Other
	// types only appear once they actually have data, so the dropdown
	// doesn't list all 7 possible types up front.
	const otherTypes = availableTrainingTypes.filter(
		(type) => type !== "FAAT"
	);

	// Debug logging
	console.log('ResultsFilters render:', {
		selectedYear,
		selectedMonth,
		availableMonths,
		selectedTrainingType,
		availableTrainingTypes,
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

				{onTrainingTypeChange && (
					<label className={styles.filterLabel}>
						Training Type:
						<select
							value={selectedTrainingType}
							onChange={(e) =>
								onTrainingTypeChange(
									e.target.value as TrainingType | "ALL"
								)
							}
							className={styles.filterSelect}
						>
							<option value="FAAT">FAAT</option>
							{otherTypes.map((type) => (
								<option key={type} value={type}>
									{type}
								</option>
							))}
							<option value="ALL">ALL</option>
						</select>
					</label>
				)}
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