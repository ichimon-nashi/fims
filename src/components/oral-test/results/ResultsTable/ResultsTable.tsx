// src/components/oral-test/results/ResultsTable/ResultsTable.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { TestResult } from "@/lib/types";
import DataTable from "../../management/DataTable/DataTable";
import ResultsFilters from "../ResultsFilters/ResultsFilters";
import styles from "./ResultsTable.module.css";

// Enhanced TestResult interface with question details
interface EnhancedTestResult extends TestResult {
	questions?: {
		q1: {
			id: string;
			number: number | string;
			title: string;
			category: string;
			result: boolean;
		};
		q2: {
			id: string;
			number: number | string;
			title: string;
			category: string;
			result: boolean;
		};
		q3: {
			id: string;
			number: number | string;
			title: string;
			category: string;
			result: boolean;
		};
		r1: {
			id: string;
			number: number | string;
			title: string;
			category: string;
			result: boolean;
		} | null;
		r2: {
			id: string;
			number: number | string;
			title: string;
			category: string;
			result: boolean;
		} | null;
	};
}

// Type for API response
interface TestResultsResponse {
	results?: EnhancedTestResult[];
	[key: string]: any;
}

const ResultsTable = () => {
	const { user } = useAuth();
	const [results, setResults] = useState<EnhancedTestResult[]>([]);
	const [allResults, setAllResults] = useState<EnhancedTestResult[]>([]);
	const [availableYears, setAvailableYears] = useState<number[]>([]);
	const [availableMonths, setAvailableMonths] = useState<number[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
	const [selectedMonth, setSelectedMonth] = useState(0); // 0 = All months

	const fetchAllResults = useCallback(async () => {
		try {
			setLoading(true);
			console.log("Fetching test results...");

			// FIXED: Use correct token key
			const response = await fetch(`/api/test-results`, {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});

			console.log("Test results response status:", response.status);

			if (response.ok) {
				const data: TestResultsResponse | EnhancedTestResult[] = await response.json();
				console.log("Test results data received:", data);

				// FIXED: Handle potential response format issues with proper typing
				const resultsArray: EnhancedTestResult[] = Array.isArray(data)
					? data
					: (data as TestResultsResponse).results || [];

				console.log(
					"Frontend - All results fetched:",
					resultsArray.length,
					"records"
				);

				// Debug: Show sample dates with proper typing
				if (resultsArray.length > 0) {
					console.log(
						"Sample dates:",
						resultsArray.slice(0, 3).map((r: EnhancedTestResult) => r.test_date)
					);
				}

				setAllResults(resultsArray);

				// Extract unique years from the data (only years that have data)
				const years = [
					...new Set(
						resultsArray.map((result: EnhancedTestResult) =>
							new Date(result.test_date).getFullYear()
						)
					),
				].sort((a, b) => b - a); // Sort descending (newest first)

				setAvailableYears(years);

				// Set initial year to the most recent year with data
				if (years.length > 0) {
					if (!years.includes(selectedYear)) {
						setSelectedYear(years[0]);
					}

					// Force update available months after setting data
					setTimeout(() => {
						console.log("Forcing month update after data load...");
						const monthsWithData = new Set<number>();

						resultsArray
							.filter(
								(result: EnhancedTestResult) =>
									new Date(result.test_date).getFullYear() ===
									(years.includes(selectedYear)
										? selectedYear
										: years[0])
							)
							.forEach((result: EnhancedTestResult) => {
								const month =
									new Date(result.test_date).getMonth() + 1;
								monthsWithData.add(month);
							});

						const sortedMonths = Array.from(monthsWithData).sort(
							(a, b) => a - b
						);
						console.log("Setting available months:", sortedMonths);
						setAvailableMonths(sortedMonths);
					}, 200);
				} else {
					// No data available
					setAvailableYears([]);
					setAvailableMonths([]);
				}
			} else {
				const errorData = await response.json();
				console.error("Test results API error:", errorData);
				setError(errorData.message || "Failed to load test results");
			}
		} catch (err) {
			console.error("Test results fetch error:", err);
			setError("Failed to load test results");
		} finally {
			setLoading(false);
		}
	}, [selectedYear]);

	// Update available months when year changes
	const updateAvailableMonths = useCallback(() => {
		console.log("Updating available months for year:", selectedYear);
		console.log("All results:", allResults.length);

		const monthsWithData = new Set<number>();

		const resultsForYear = allResults.filter((result: EnhancedTestResult) => {
			const resultYear = new Date(result.test_date).getFullYear();
			console.log("Result date:", result.test_date, "Year:", resultYear);
			return resultYear === selectedYear;
		});

		console.log("Results for selected year:", resultsForYear.length);

		resultsForYear.forEach((result: EnhancedTestResult) => {
			const month = new Date(result.test_date).getMonth() + 1; // 1-12
			console.log("Adding month:", month);
			monthsWithData.add(month);
		});

		const sortedMonths = Array.from(monthsWithData).sort((a, b) => a - b);
		console.log("Available months:", sortedMonths);
		setAvailableMonths(sortedMonths);

		// Reset to "All months" if current month has no data
		if (selectedMonth !== 0 && !sortedMonths.includes(selectedMonth)) {
			console.log("Resetting month to 0");
			setSelectedMonth(0);
		}
	}, [allResults, selectedYear, selectedMonth]);

	const filterResultsByYearAndMonth = useCallback(() => {
		let filteredResults = allResults.filter(
			(result: EnhancedTestResult) =>
				new Date(result.test_date).getFullYear() === selectedYear
		);

		// Apply month filter if a specific month is selected
		if (selectedMonth !== 0) {
			filteredResults = filteredResults.filter(
				(result: EnhancedTestResult) =>
					new Date(result.test_date).getMonth() + 1 === selectedMonth
			);
		}

		console.log(
			`Filtered results for ${selectedYear}${
				selectedMonth !== 0 ? ` month ${selectedMonth}` : ""
			}:`,
			filteredResults.length
		);
		setResults(filteredResults);
	}, [allResults, selectedYear, selectedMonth]);

	useEffect(() => {
		fetchAllResults();
	}, [fetchAllResults]);

	// Add this effect to refresh data when component becomes visible
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden) {
				console.log("Page became visible, refreshing results...");
				fetchAllResults();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		// Also refresh when focus returns to window
		const handleFocus = () => {
			console.log("Window focused, refreshing results...");
			fetchAllResults();
		};

		window.addEventListener("focus", handleFocus);

		return () => {
			document.removeEventListener(
				"visibilitychange",
				handleVisibilityChange
			);
			window.removeEventListener("focus", handleFocus);
		};
	}, [fetchAllResults]);

	useEffect(() => {
		if (allResults.length > 0) {
			console.log(
				"Main effect triggered - updating months and filtering"
			);
			updateAvailableMonths();
			filterResultsByYearAndMonth();
		}
	}, [
		allResults,
		selectedYear,
		selectedMonth,
		updateAvailableMonths,
		filterResultsByYearAndMonth,
	]);

	// Force update when component mounts or data changes
	useEffect(() => {
		if (allResults.length > 0) {
			console.log("Force updating available months...");
			setTimeout(() => {
				updateAvailableMonths();
			}, 100); // Small delay to ensure state is settled
		}
	}, [allResults, updateAvailableMonths]);

	const handleRefreshAll = async () => {
		console.log("Refreshing all data and filters...");
		await fetchAllResults();

		// Force update months after a short delay
		setTimeout(() => {
			console.log("Force updating months after refresh...");
			updateAvailableMonths();
		}, 300);
	};

	// Enhanced screenshot function with clean report format
	const handleScreenshot = async () => {
		try {
			const html2canvas = (await import("html2canvas")).default;

			// Create a temporary container with clean styling
			const tempContainer = document.createElement("div");
			tempContainer.style.cssText = `
			position: fixed;
			top: -9999px;
			left: -9999px;
			background: white;
			padding: 2rem;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			width: 1200px;
			z-index: 9999;
		`;

			// Create header for the screenshot
			const header = document.createElement("div");
			header.style.cssText = `
			text-align: center;
			margin-bottom: 2rem;
			border-bottom: 2px solid #e2e8f0;
			padding-bottom: 1rem;
		`;

			const monthNames = [
				"",
				"January",
				"February",
				"March",
				"April",
				"May",
				"June",
				"July",
				"August",
				"September",
				"October",
				"November",
				"December",
			];

			const periodText =
				selectedMonth === 0
					? `All of ${selectedYear}`
					: `${monthNames[selectedMonth]} ${selectedYear}`;

			header.innerHTML = `
			<h1 style="font-size: 2rem; color: #2d3748; margin: 0 0 0.5rem 0;">Test Results Report</h1>
			<p style="color: #4a5568; margin: 0; font-size: 1rem;">
				Period: ${periodText} | Total Tests: ${results.length} | 
				Generated: ${new Date().toLocaleDateString()}
			</p>
		`;

			// Clone the stats cards
			const statsSection = document.querySelector(
				`.${styles.statsCards}`
			);
			const statsClone = statsSection?.cloneNode(true) as HTMLElement;
			if (statsClone) {
				statsClone.style.cssText = `
				display: grid;
				grid-template-columns: repeat(4, 1fr);
				gap: 1rem;
				margin-bottom: 2rem;
			`;

				// Clean up stats cards styling
				const statCards = statsClone.querySelectorAll(
					`.${styles.statCard}`
				);
				statCards.forEach((card) => {
					(card as HTMLElement).style.cssText = `
					background: white;
					border: 1px solid #e2e8f0;
					border-radius: 8px;
					padding: 1rem;
					display: flex;
					align-items: center;
					gap: 1rem;
				`;
				});
			}

			// Create a properly structured table from the data
			const tableClone = document.createElement("table");
			tableClone.style.cssText = `
			width: 100%;
			border-collapse: collapse;
			background: white;
			border: 1px solid #e2e8f0;
			font-size: 0.9rem;
		`;

			// Create THEAD (header) first
			const thead = document.createElement("thead");
			const headerRow = document.createElement("tr");
			headerRow.style.background = "#f7fafc";

			const headers = [
				"Test Date",
				"Employee ID",
				"Full Name",
				"Rank",
				"Base",
				"Q1",
				"Q2",
				"Q3",
				"R1",
				"R2",
				"Score",
				"Examiner",
			];
			headers.forEach((headerText) => {
				const th = document.createElement("th");
				th.textContent = headerText;
				th.style.cssText = `
				padding: 0.75rem 0.5rem;
				border: 1px solid #e2e8f0;
				text-align: left;
				font-weight: 600;
				color: #2d3748;
				font-size: 0.85rem;
				background: #f7fafc;
			`;
				headerRow.appendChild(th);
			});
			thead.appendChild(headerRow);
			tableClone.appendChild(thead);

			// Create TBODY (data rows)
			const tbody = document.createElement("tbody");
			results.forEach((result: EnhancedTestResult) => {
				const row = document.createElement("tr");
				const score = calculateScore(result);

				// Helper function to format question result
				const formatQuestionResult = (
					questionKey: "q1" | "q2" | "q3" | "r1" | "r2"
				): string => {
					const questionData = result.questions?.[questionKey];
					const resultValue = result[`${questionKey}_result`];

					if (resultValue === null || resultValue === undefined) return "—";

					const questionNumber = questionData?.number || "N/A";
					const resultIcon = resultValue ? "✅" : "❌";

					return `#${questionNumber} ${resultIcon}`;
				};

				const cells = [
					new Date(result.test_date).toLocaleDateString(),
					result.employee_id || "N/A",
					result.full_name,
					result.rank,
					result.base,
					formatQuestionResult("q1"),
					formatQuestionResult("q2"),
					formatQuestionResult("q3"),
					formatQuestionResult("r1"),
					formatQuestionResult("r2"),
					`${score}/3`,
					result.examiner_name,
				];

				cells.forEach((cellText) => {
					const td = document.createElement("td");
					td.textContent = cellText;
					td.style.cssText = `
					padding: 0.75rem 0.5rem;
					border: 1px solid #e2e8f0;
					text-align: left;
					background: white;
					vertical-align: middle;
					font-size: 0.85rem;
				`;
					row.appendChild(td);
				});
				tbody.appendChild(row);
			});
			tableClone.appendChild(tbody);

			// Assemble the content in correct order
			tempContainer.appendChild(header);
			if (statsClone) tempContainer.appendChild(statsClone);
			tempContainer.appendChild(tableClone);

			document.body.appendChild(tempContainer);

			// Take screenshot
			const canvas = await html2canvas(tempContainer, {
				backgroundColor: "#ffffff",
				useCORS: true,
				allowTaint: true,
				scale: 2,
				width: 1200,
				scrollX: 0,
				scrollY: 0,
			} as any);

			// Clean up
			document.body.removeChild(tempContainer);

			// Download
			const link = document.createElement("a");
			const periodSuffix =
				selectedMonth === 0
					? selectedYear.toString()
					: `${selectedYear}-${selectedMonth
							.toString()
							.padStart(2, "0")}`;
			link.download = `test-results-report-${periodSuffix}-${
				new Date().toISOString().split("T")[0]
			}.png`;
			link.href = canvas.toDataURL("image/png");
			link.click();
		} catch (err) {
			console.error("Screenshot error:", err);
			setError("Failed to capture screenshot. Please try again.");
		}
	};

	const handleExportExcel = () => {
		try {
			// Convert results to CSV format with question numbers
			const headers = [
				"Test Date",
				"Employee ID",
				"Full Name",
				"Rank",
				"Base",
				"Q1 Number",
				"Q1 Result",
				"Q2 Number",
				"Q2 Result",
				"Q3 Number",
				"Q3 Result",
				"R1 Number",
				"R1 Result",
				"R2 Number",
				"R2 Result",
				"Score Percentage",
				"Score Fraction",
				"Examiner",
			];

			const csvData = results.map((result: EnhancedTestResult) => {
				const score = calculateScore(result);
				const scorePercentage = Math.round((score / 3) * 100);

				return [
					result.test_date,
					result.employee_id,
					result.full_name,
					result.rank,
					result.base,
					result.questions?.q1?.number || "N/A",
					result.q1_result === null || result.q1_result === undefined
						? "N/A"
						: result.q1_result
						? "V"
						: "X",
					result.questions?.q2?.number || "N/A",
					result.q2_result === null || result.q2_result === undefined
						? "N/A"
						: result.q2_result
						? "V"
						: "X",
					result.questions?.q3?.number || "N/A",
					result.q3_result === null || result.q3_result === undefined
						? "N/A"
						: result.q3_result
						? "V"
						: "X",
					result.questions?.r1?.number || "N/A",
					result.r1_result === null || result.r1_result === undefined
						? "N/A"
						: result.r1_result
						? "V"
						: "X",
					result.questions?.r2?.number || "N/A",
					result.r2_result === null || result.r2_result === undefined
						? "N/A"
						: result.r2_result
						? "V"
						: "X",
					`${scorePercentage}%`,
					`${score} out of 3`,
					result.examiner_name,
				];
			});

			const csvContent = [headers, ...csvData]
				.map((row) => row.map((cell) => `"${cell || ""}"`).join(","))
				.join("\n");

			const blob = new Blob([csvContent], {
				type: "text/csv;charset=utf-8;",
			});
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			const periodSuffix =
				selectedMonth === 0
					? selectedYear.toString()
					: `${selectedYear}-${selectedMonth
							.toString()
							.padStart(2, "0")}`;
			link.download = `test-results-${periodSuffix}-${
				new Date().toISOString().split("T")[0]
			}.csv`;
			link.click();
		} catch (err) {
			setError("Failed to export Excel file");
		}
	};

	const getResultIcon = (result: boolean | null | undefined): string => {
		if (result === null || result === undefined) return "—";
		return result ? "✅" : "❌";
	};

	const getScoreColor = (score: number): string => {
		if (score >= 3) return styles.scorePass;
		if (score >= 2) return styles.scoreWarning;
		return styles.scoreFail;
	};

	const calculateScore = (result: EnhancedTestResult): number => {
		// Only count correct answers (ignore null/undefined values)
		const resultValues = [
			result.q1_result,
			result.q2_result,
			result.q3_result,
			result.r1_result,
			result.r2_result,
		];
		return resultValues.filter((r) => r === true).length;
	};

	// Simplified question render function with question number and result only
	const renderQuestionResult = (
		questionKey: "q1" | "q2" | "q3" | "r1" | "r2",
		result: EnhancedTestResult
	): React.ReactElement | string => {
		const questionData = result.questions?.[questionKey];
		const resultValue = result[`${questionKey}_result`];

		if (!questionData && (resultValue === null || resultValue === undefined)) {
			return "—";
		}

		const questionNumber = questionData?.number || "N/A";

		return (
			<div className={styles.questionResult}>
				<div className={styles.questionNumber}>#{questionNumber}</div>
				<div className={styles.resultIcon}>
					{getResultIcon(resultValue)}
				</div>
			</div>
		);
	};

	const columns = [
		{
			key: "test_date",
			label: "Test Date",
			sortable: true,
			filterable: true,
			render: (value: string) => new Date(value).toLocaleDateString(),
		},
		{
			key: "employee_id",
			label: "Employee ID",
			sortable: true,
			filterable: true,
			render: (value: string, row: EnhancedTestResult) =>
				value || "N/A",
		},
		{
			key: "full_name",
			label: "Full Name",
			sortable: true,
			filterable: true,
		},
		{
			key: "rank",
			label: "Rank",
			sortable: true,
			filterable: true,
		},
		{
			key: "base",
			label: "Base",
			sortable: true,
			filterable: true,
		},
		{
			key: "q1_result",
			label: "Q1",
			sortable: false,
			filterable: false,
			render: (value: boolean | null | undefined, row: EnhancedTestResult) =>
				renderQuestionResult("q1", row),
		},
		{
			key: "q2_result",
			label: "Q2",
			sortable: false,
			filterable: false,
			render: (value: boolean | null | undefined, row: EnhancedTestResult) =>
				renderQuestionResult("q2", row),
		},
		{
			key: "q3_result",
			label: "Q3",
			sortable: false,
			filterable: false,
			render: (value: boolean | null | undefined, row: EnhancedTestResult) =>
				renderQuestionResult("q3", row),
		},
		{
			key: "r1_result",
			label: "R1",
			sortable: false,
			filterable: false,
			render: (value: boolean | null | undefined, row: EnhancedTestResult) =>
				renderQuestionResult("r1", row),
		},
		{
			key: "r2_result",
			label: "R2",
			sortable: false,
			filterable: false,
			render: (value: boolean | null | undefined, row: EnhancedTestResult) =>
				renderQuestionResult("r2", row),
		},
		{
			key: "score",
			label: "Score",
			sortable: true,
			filterable: false,
			render: (value: any, row: EnhancedTestResult) => {
				const score = calculateScore(row);
				return (
					<span
						className={`${styles.scoreBadge} ${getScoreColor(
							score
						)}`}
					>
						{score}/3
					</span>
				);
			},
		},
		{
			key: "examiner_name",
			label: "Examiner",
			sortable: true,
			filterable: true,
		},
	];

	if (loading) {
		return (
			<div className={styles.loading}>
				<div className="loading-spinner"></div>
				<p>Loading test results...</p>
			</div>
		);
	}

	return (
		<div className={styles.resultsTable}>
			<div className={styles.header}>
				<h1> </h1>
				<div className={styles.actions}>
					<button
						className="btn btn-secondary"
						onClick={handleRefreshAll}
						title="Refresh results and filters"
					>
						🔄 Refresh All
					</button>
					<button
						className="btn btn-secondary"
						onClick={handleScreenshot}
						title="Take screenshot of current results"
					>
						📷 Screenshot
					</button>
					<button
						className="btn btn-primary"
						onClick={handleExportExcel}
						title="Export current results to CSV"
					>
						📊 Export Excel
					</button>
				</div>
			</div>

			<ResultsFilters
				selectedYear={selectedYear}
				selectedMonth={selectedMonth}
				onYearChange={setSelectedYear}
				onMonthChange={setSelectedMonth}
				totalResults={results.length}
				availableYears={availableYears}
				availableMonths={availableMonths}
			/>

			{error && <div className="alert alert-error">{error}</div>}

			<div className={styles.statsCards}>
				<div className={styles.statCard}>
					<div className={styles.statIcon}>📊</div>
					<div className={styles.statContent}>
						<h3>Total Tests</h3>
						<p>{results.length}</p>
					</div>
				</div>

				<div className={styles.statCard}>
					<div className={styles.statIcon}>✅</div>
					<div className={styles.statContent}>
						<h3>Passed (3/3)</h3>
						<p>
							{
								results.filter((r: EnhancedTestResult) => calculateScore(r) >= 3)
									.length
							}
						</p>
					</div>
				</div>

				<div className={styles.statCard}>
					<div className={styles.statIcon}>❌</div>
					<div className={styles.statContent}>
						<h3>Failed (&lt;3)</h3>
						<p>
							{
								results.filter((r: EnhancedTestResult) => calculateScore(r) < 3)
									.length
							}
						</p>
					</div>
				</div>

				<div className={styles.statCard}>
					<div className={styles.statIcon}>📈</div>
					<div className={styles.statContent}>
						<h3>Pass Rate</h3>
						<p>
							{results.length > 0
								? Math.round(
										(results.filter(
											(r: EnhancedTestResult) => calculateScore(r) >= 3
										).length /
											results.length) *
											100
								  )
								: 0}
							%
						</p>
					</div>
				</div>
			</div>

			<DataTable
				data={results}
				columns={columns}
				rowKey="id"
				searchable={true}
				paginated={true}
				pageSize={15}
			/>
		</div>
	);
};

export default ResultsTable;