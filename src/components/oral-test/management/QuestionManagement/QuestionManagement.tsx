// src/components/oral-test/management/QuestionManagement/QuestionManagement.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Question } from "@/lib/types";
import QUESTION_CATEGORIES from "@/lib/constants";
import DataTable from "../DataTable/DataTable";
import styles from "./QuestionManagement.module.css";

// Define types for imported question data
interface ImportedQuestion {
	question_category: string;
	question_title: string;
	question_chapter: string;
	question_page: number;
	question_line: string;
	difficulty_level: number;
}

// Define type for Excel row data
interface ExcelRowData {
	[key: string]: any;
}

// Define type for current user
interface CurrentUser {
	authentication_level: number;
	employee_id?: string;
	[key: string]: any;
}

// Define type for related records info
interface RelatedRecordInfo {
	id: string;
	relatedCount: number;
}

// Define type for promise result
interface PromiseResult {
	status: 'fulfilled' | 'rejected';
	value?: any;
	reason?: { message?: string };
}

// Import XLSX dynamically to avoid SSR issues
let XLSX: any = null;
if (typeof window !== "undefined") {
	import("xlsx").then((xlsxModule) => {
		XLSX = xlsxModule;
	});
}

// Responsive button text hook
const useResponsiveButtonText = () => {
	const [isCompactView, setIsCompactView] = useState(false);

	useEffect(() => {
		const checkViewport = () => {
			setIsCompactView(
				window.innerWidth >= 1024 && window.innerWidth < 1300
			);
		};

		checkViewport();
		window.addEventListener("resize", checkViewport);
		return () => window.removeEventListener("resize", checkViewport);
	}, []);

	return {
		addText: isCompactView ? "➕ Add" : "➕ Add Question",
		exportText: isCompactView ? "📊 Export" : "📊 Export Excel",
		importText: isCompactView ? "📄 Import" : "📄 Import Excel",
		deleteText: (count: number) =>
			isCompactView
				? `🗑️ Delete (${count})`
				: `🗑️ Delete Selected (${count})`,
	};
};

const QuestionManagement = () => {
	const { user: currentUser } = useAuth();
	const [questions, setQuestions] = useState<Question[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [editingQuestion, setEditingQuestion] = useState<Question | null>(
		null
	);
	const [showAddForm, setShowAddForm] = useState(false);
	const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
	
	// NEW: Add current page state for pagination preservation
	const [currentPage, setCurrentPage] = useState(1);

	// Responsive button text
	const buttonText = useResponsiveButtonText();

	useEffect(() => {
		fetchQuestions();
	}, []);

	const fetchQuestions = async () => {
		try {
			setLoading(true);
			console.log("Fetching questions...");

			const response = await fetch("/api/questions", {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});

			console.log("Questions response status:", response.status);

			if (response.ok) {
				const data = await response.json();
				console.log("Questions API response:", data);

				// FIXED: Sort questions by question_number for better display
				const sortedQuestions = Array.isArray(data)
					? data.sort((a: Question, b: Question) => {
							// Sort by question_number first, then by id if question_number is null
							if (a.question_number && b.question_number) {
								return a.question_number - b.question_number;
							}
							if (a.question_number && !b.question_number)
								return -1;
							if (!a.question_number && b.question_number)
								return 1;
							return a.id.localeCompare(b.id);
					  })
					: [];

				setQuestions(sortedQuestions);
			} else {
				const errorData = await response.json();
				console.error("Questions API error:", errorData);
				setError(errorData.message || "Failed to load questions");
			}
		} catch (err) {
			console.error("Questions fetch error:", err);
			setError("Failed to load questions");
		} finally {
			setLoading(false);
		}
	};

	const handleSaveQuestion = async (questionData: Partial<Question>) => {
		try {
			// FIXED: Check for duplicate question titles
			if (!editingQuestion) {
				const isDuplicate = questions.some(
					(q) =>
						q.question_title.trim().toLowerCase() ===
						questionData.question_title?.trim().toLowerCase()
				);

				if (isDuplicate) {
					setError(
						"A question with this title already exists. Please use a different title."
					);
					return;
				}
			} else {
				// For editing, check duplicates excluding the current question
				const isDuplicate = questions.some(
					(q) =>
						q.id !== editingQuestion.id &&
						q.question_title.trim().toLowerCase() ===
							questionData.question_title?.trim().toLowerCase()
				);

				if (isDuplicate) {
					setError(
						"A question with this title already exists. Please use a different title."
					);
					return;
				}
			}

			const url = editingQuestion
				? `/api/questions/${editingQuestion.id}`
				: "/api/questions";
			const method = editingQuestion ? "PUT" : "POST";

			console.log("Saving question:", { url, method, questionData });

			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify(questionData),
			});

			if (response.ok) {
				await fetchQuestions();
				setEditingQuestion(null);
				setShowAddForm(false);
				setError("");
				// NOTE: currentPage state is preserved automatically
			} else {
				const errorData = await response.json();
				console.error("Save question error:", errorData);
				setError(errorData.message || "Failed to save question");
			}
		} catch (err) {
			console.error("Save question error:", err);
			setError("Failed to save question");
		}
	};

	const handleDeleteQuestions = async (questionIds: string[]) => {
		// First check for foreign key issues
		let hasRelatedRecords = false;
		const relatedRecordsInfo: RelatedRecordInfo[] = [];

		try {
			console.log("Checking for related test results...");
			for (const id of questionIds) {
				const checkResponse = await fetch("/api/debug-db", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem(
							"token"
						)}`,
					},
					body: JSON.stringify({ questionId: id }),
				});

				if (checkResponse.ok) {
					const checkData = await checkResponse.json();
					if (checkData.tests?.foreignKeys?.relatedRecords > 0) {
						hasRelatedRecords = true;
						relatedRecordsInfo.push({
							id,
							relatedCount:
								checkData.tests.foreignKeys.relatedRecords,
						});
					}
				}
			}
		} catch (checkError) {
			console.error("Error checking for related records:", checkError);
		}

		// Show warning if there are related records
		if (hasRelatedRecords) {
			const totalRelated = relatedRecordsInfo.reduce(
				(sum, item) => sum + item.relatedCount,
				0
			);
			const confirmMessage = `⚠️ WARNING: ${questionIds.length} question(s) selected for deletion have ${totalRelated} related test result(s).

These questions cannot be deleted because they are referenced in existing test results.

Options:
• Cancel deletion (recommended)
• Contact administrator to remove test results first

Do you want to continue anyway? (Will likely fail)`;

			if (!confirm(confirmMessage)) {
				return;
			}
		} else {
			// Standard confirmation for questions without related records
			if (
				!confirm(
					`Are you sure you want to delete ${questionIds.length} question(s)? This action cannot be undone.`
				)
			) {
				return;
			}
		}

		try {
			console.log(
				"Starting deletion process for questions:",
				questionIds
			);

			// Delete questions one by one and collect results
			const deletePromises = questionIds.map(async (id: string) => {
				console.log(`Attempting to delete question: ${id}`);

				try {
					const response = await fetch(`/api/questions/${id}`, {
						method: "DELETE",
						headers: {
							Authorization: `Bearer ${localStorage.getItem(
								"token"
							)}`,
							"Content-Type": "application/json",
						},
					});

					console.log(
						`Delete response for ${id}:`,
						response.status,
						response.statusText
					);

					const responseText = await response.text();
					console.log(
						`Delete response body for ${id}:`,
						responseText
					);

					let responseData;
					try {
						responseData = JSON.parse(responseText);
					} catch (parseError) {
						console.error(
							`Failed to parse response for ${id}:`,
							parseError
						);
						throw new Error(
							`Invalid response format: ${responseText}`
						);
					}

					if (!response.ok) {
						// Handle specific error cases
						if (response.status === 409) {
							const conflictMessage = `Cannot delete question ${id}: ${
								responseData.message ||
								"It is referenced in test results"
							}`;
							throw new Error(conflictMessage);
						}

						throw new Error(
							`Delete failed for ${id}: ${
								responseData.message ||
								responseData.error ||
								"Unknown error"
							}`
						);
					}

					console.log(`Successfully deleted question ${id}`);
					return { id, success: true };
				} catch (error) {
					console.error(`Error deleting question ${id}:`, error);
					throw error;
				}
			});

			// Wait for all deletions to complete
			console.log("Waiting for all deletion promises...");
			const results = await Promise.allSettled(deletePromises);

			// Check if any deletions failed
			const failed = results.filter(
				(result): result is PromiseRejectedResult => result.status === "rejected"
			);
			const successful = results.filter(
				(result): result is PromiseFulfilledResult<any> => result.status === "fulfilled"
			);

			console.log(
				`Deletion results: ${successful.length} successful, ${failed.length} failed`
			);

			if (failed.length > 0) {
				console.error(
					"Failed deletions:",
					failed.map((f) => f.reason)
				);
				const errorMessages = failed
					.map((f) => f.reason?.message || "Unknown error")
					.join("\n");

				// Show specific message for foreign key violations
				const foreignKeyErrors = failed.filter(
					(f) =>
						f.reason?.message?.includes(
							"referenced in test results"
						) ||
						f.reason?.message?.includes("foreign key constraint")
				);

				if (foreignKeyErrors.length > 0) {
					setError(`⏰ Cannot delete ${foreignKeyErrors.length} question(s): They are referenced in existing test results.

📋 These questions have been used in tests and cannot be deleted to preserve data integrity.

💡 Solutions:
• Use different questions for future tests
• Contact your administrator to remove old test results
• Archive these questions instead of deleting them

Detailed errors:
${errorMessages}`);
				} else {
					setError(
						`Failed to delete ${failed.length} question(s):\n${errorMessages}`
					);
				}
			}

			if (successful.length > 0) {
				console.log(
					"Some deletions were successful, refreshing questions list"
				);
			}

			// Refresh the questions list regardless of partial failures
			await fetchQuestions();
			setSelectedQuestions([]);

			// Clear error if all deletions were successful
			if (failed.length === 0) {
				setError("");
				console.log("All deletions completed successfully");
			}
		} catch (err) {
			console.error("Unexpected error in handleDeleteQuestions:", err);
			setError(
				"Unexpected error during deletion: " +
					(err instanceof Error ? err.message : "Unknown error")
			);
		}
	};

	const handleExportExcel = async () => {
		try {
			// Wait for XLSX to load if not already loaded
			if (!XLSX) {
				const xlsxModule = await import("xlsx");
				XLSX = xlsxModule;
			}

			// Prepare data for export (exclude date columns)
			const exportData = questions.map((question) => ({
				"Question Number": question.question_number || "N/A",
				Category: question.question_category,
				"Question Title": question.question_title,
				Chapter: question.question_chapter,
				Page: question.question_page,
				Line: question.question_line,
				// FIXED: Include difficulty for level 10+ users in export
				...(currentUser &&
					currentUser.authentication_level >= 10 && {
						"Difficulty Level": question.difficulty_level || 3,
					}),
			}));

			// Create workbook and worksheet
			const ws = XLSX.utils.json_to_sheet(exportData);
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "Questions");

			// Auto-size columns
			const maxWidth = 60;
			const colWidths = Object.keys(exportData[0] || {}).map((key) => {
				if (key === "Question Title") {
					return { wch: maxWidth }; // Max width for question title
				}
				return { wch: Math.min(Math.max(key.length, 12), 30) };
			});
			ws["!cols"] = colWidths;

			// Generate filename with current date
			const today = new Date().toISOString().split("T")[0];
			const filename = `questions_export_${today}.xlsx`;

			// Save file
			XLSX.writeFile(wb, filename);
		} catch (err) {
			console.error("Export error:", err);
			setError("Failed to export Excel file");
		}
	};

	const handleImportExcel = async (file: File) => {
		try {
			// Wait for XLSX to load if not already loaded
			if (!XLSX) {
				const xlsxModule = await import("xlsx");
				XLSX = xlsxModule;
			}

			const data = await file.arrayBuffer();
			const workbook = XLSX.read(data);
			const worksheet = workbook.Sheets[workbook.SheetNames[0]];
			const jsonData = XLSX.utils.sheet_to_json(worksheet);

			console.log("Excel data preview:", jsonData.slice(0, 2));
			console.log(
				"Available columns:",
				jsonData.length > 0 ? Object.keys(jsonData[0]) : "No data"
			);

			// Validate and transform imported data
			const importedQuestions = jsonData.map((row: ExcelRowData, index: number): ImportedQuestion => {
				// FIXED: Handle multiple column name formats (both display names and database field names)
				const getFieldValue = (
					row: ExcelRowData,
					...possibleNames: string[]
				): any => {
					for (const name of possibleNames) {
						if (
							row[name] !== undefined &&
							row[name] !== null &&
							row[name] !== ""
						) {
							return row[name];
						}
					}
					return undefined;
				};

				// Map Excel columns to database fields with flexible column name matching
				const mappedData: ImportedQuestion = {
					question_category: getFieldValue(
						row,
						"Category",
						"question_category",
						"category",
						"CATEGORY"
					),
					question_title: getFieldValue(
						row,
						"Question Title",
						"question_title",
						"title",
						"Question",
						"QUESTION_TITLE"
					),
					question_chapter: getFieldValue(
						row,
						"Chapter",
						"question_chapter",
						"chapter",
						"CHAPTER"
					),
					question_page:
						parseInt(
							getFieldValue(
								row,
								"Page",
								"question_page",
								"page",
								"PAGE"
							)
						) || 1,
					question_line:
						getFieldValue(
							row,
							"Line",
							"question_line",
							"line",
							"LINE"
						)?.toString() || "1",
					// FIXED: Handle difficulty level from import if available
					difficulty_level:
						parseInt(
							getFieldValue(
								row,
								"Difficulty Level",
								"difficulty_level",
								"difficulty",
								"DIFFICULTY"
							)
						) || 3,
				};

				return mappedData;
			});

			// FIXED: Check for duplicate question titles in import
			const existingTitles = new Set(
				questions.map((q) => q.question_title.trim().toLowerCase())
			);
			const importTitles = new Set<string>();
			const duplicates: string[] = [];

			for (const question of importedQuestions) {
				if (!question.question_title) continue;

				const title = question.question_title.trim().toLowerCase();
				if (existingTitles.has(title) || importTitles.has(title)) {
					duplicates.push(question.question_title);
				}
				importTitles.add(title);
			}

			if (duplicates.length > 0) {
				setError(
					`Import contains duplicate questions:\n${duplicates
						.slice(0, 5)
						.join("\n")}${
						duplicates.length > 5 ? "\n... and more" : ""
					}`
				);
				return;
			}

			// Validate required fields
			const errors: string[] = [];
			importedQuestions.forEach(
				(question: ImportedQuestion, index: number) => {
					const rowNum = index + 2; // Excel row number (accounting for header)

					if (!question.question_category)
						errors.push(`Row ${rowNum}: Category is required`);
					if (!question.question_title)
						errors.push(`Row ${rowNum}: Question Title is required`);
					if (!question.question_chapter)
						errors.push(`Row ${rowNum}: Chapter is required`);
					if (!question.question_page || question.question_page < 1)
						errors.push(`Row ${rowNum}: Valid Page number is required`);
					if (!question.question_line || question.question_line.trim() === "")
						errors.push(`Row ${rowNum}: Line reference is required`);
				}
			);

			if (errors.length > 0) {
				setError(
					`Import validation errors:\n${errors
						.slice(0, 10)
						.join("\n")}${
						errors.length > 10
							? `\n... and ${errors.length - 10} more errors`
							: ""
					}`
				);
				return;
			}

			// Filter out any completely empty rows
			const validQuestions = importedQuestions.filter(
				(q: ImportedQuestion) =>
					q.question_category &&
					q.question_title &&
					q.question_chapter
			);

			if (validQuestions.length === 0) {
				setError(
					"No valid questions found in the Excel file. Please check the format and ensure all required fields are filled."
				);
				return;
			}

			// Batch create questions
			let successCount = 0;
			let errorCount = 0;
			const importErrors: string[] = [];

			for (const questionData of validQuestions) {
				try {
					const response = await fetch("/api/questions", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${localStorage.getItem(
								"token"
							)}`,
						},
						body: JSON.stringify(questionData),
					});

					if (response.ok) {
						successCount++;
					} else {
						errorCount++;
						const errorData = await response.json();
						const errorMsg =
							errorData.message ||
							errorData.error ||
							"Unknown error";
						importErrors.push(
							`"${questionData.question_title.substring(
								0,
								50
							)}...": ${errorMsg}`
						);
					}
				} catch (err) {
					errorCount++;
					console.error(
						`Import error for question "${questionData.question_title}":`,
						err
					);
					importErrors.push(
						`"${questionData.question_title.substring(
							0,
							50
						)}...": Network/connection error`
					);
				}
			}

			// Show import results
			let message = `Import completed: ${successCount} questions created successfully`;
			if (errorCount > 0) {
				message += `, ${errorCount} errors:\n${importErrors.join(
					"\n"
				)}`;
			}

			if (errorCount > 0) {
				setError(message);
			} else {
				alert(message);
			}

			await fetchQuestions();
		} catch (err) {
			console.error("Import processing error:", err);
			setError(
				"Failed to process Excel file. Please check the format and ensure it's a valid Excel file."
			);
		}
	};

	const columns = [
		{
			key: "question_number",
			label: "Question #",
			sortable: true,
			filterable: true,
			render: (value: number) => (
				<span
					className={styles.questionNumber}
					data-status={value ? undefined : "pending"}
				>
					{value ? `#${value}` : "PENDING"}
				</span>
			),
		},
		{
			key: "question_category",
			label: "Category",
			sortable: true,
			filterable: true,
		},
		{
			key: "question_title",
			label: "Question",
			sortable: true,
			filterable: true,
			render: (value: string) => (
				<div
					style={{
						maxWidth: "300px",
						whiteSpace: "normal",
						wordWrap: "break-word",
					}}
				>
					{value}
				</div>
			),
		},
		{
			key: "question_chapter",
			label: "Chapter",
			sortable: true,
			filterable: true,
		},
		{
			key: "question_page",
			label: "Page",
			sortable: true,
			filterable: false,
		},
		{
			key: "question_line",
			label: "Line",
			sortable: true,
			filterable: false,
		},
		// Difficulty Level - only visible to level 10+
		...(currentUser && currentUser.authentication_level >= 10
			? [
					{
						key: "difficulty_level",
						label: "Difficulty",
						sortable: true,
						filterable: false,
						render: (value: number) => (
							<span
								className={`${styles.difficultyBadge} ${
									styles[`difficulty${value || 3}`]
								}`}
							>
								Level {value || 3}
							</span>
						),
					},
			  ]
			: []),
		{
			key: "last_date_modified",
			label: "Last Modified",
			sortable: true,
			filterable: false,
			render: (value: string) =>
				value ? new Date(value).toLocaleDateString() : "N/A",
		},
	];

	if (loading) {
		return (
			<div className={styles.loading}>
				<div className="loading-spinner"></div>
				<p>Loading questions...</p>
			</div>
		);
	}

	return (
		<div className={styles.questionManagement}>
			<div className={styles.header}>
				<h1>Question Management</h1>
				<div className={styles.actions}>
					<button
						className="btn btn-primary"
						onClick={() => setShowAddForm(true)}
					>
						{buttonText.addText}
					</button>
					<button
						className="btn btn-secondary"
						onClick={handleExportExcel}
					>
						{buttonText.exportText}
					</button>
					<input
						type="file"
						accept=".xlsx,.xls"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) handleImportExcel(file);
						}}
						style={{ display: "none" }}
						id="import-excel"
					/>
					<label htmlFor="import-excel" className="btn btn-secondary">
						{buttonText.importText}
					</label>
					{selectedQuestions.length > 0 && (
						<button
							className="btn btn-danger"
							onClick={() => {
								console.log(
									"Multiple delete button clicked, selected questions:",
									selectedQuestions
								);
								handleDeleteQuestions(selectedQuestions);
							}}
						>
							{buttonText.deleteText(selectedQuestions.length)}
						</button>
					)}
				</div>
			</div>

			{error && <div className="alert alert-error">{error}</div>}

			<div className={styles.importHelp}>
				<details>
					<summary>💡 Excel Import Format Guide</summary>
					<p>
						Your Excel file should contain the following columns
						(case-insensitive):
					</p>
					<ul>
						<li>
							<strong>Category</strong> (or &quot;category&quot;)
							- Question category (required)
							<br />
							<small>
								Example: Safety, Regulations, Protocol, etc.
							</small>
						</li>
						<li>
							<strong>Question Title</strong> (or
							&quot;question_title&quot;) - The complete question
							text (required) - must be unique
							<br />
							<small>
								Example: &quot;What is the emergency evacuation
								procedure?&quot;
							</small>
						</li>
						<li>
							<strong>Chapter</strong> (or &quot;chapter&quot;) -
							Reference chapter (required)
							<br />
							<small>
								Example: &quot;Emergency Procedures&quot; or
								&quot;1&quot;
							</small>
						</li>
						<li>
							<strong>Page</strong> (or &quot;page&quot;) -
							Reference page number (required)
							<br />
							<small>Example: 25</small>
						</li>
						<li>
							<strong>Line</strong> (or &quot;line&quot;) -
							Reference line number (required)
							<br />
							<small>Example: 10</small>
						</li>
						{currentUser &&
							currentUser.authentication_level >= 10 && (
								<li>
									<strong>Difficulty Level</strong> (or
									&quot;difficulty_level&quot;) - Optional
									difficulty level (1-5, defaults to 3)
									<br />
									<small>Example: 3</small>
								</li>
							)}
					</ul>
					<p>
						<em>
							Note: Question numbers are auto-generated and should
							not be included in import files. Question titles
							must be unique.
						</em>
					</p>
					<div
						style={{
							marginTop: "1rem",
							padding: "0.5rem",
							background: "#e3f2fd",
							borderRadius: "4px",
						}}
					>
						<strong>📋 Supported Column Formats:</strong>
						<ul style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
							<li>
								<strong>Display format:</strong>{" "}
								&quot;Category&quot;, &quot;Question
								Title&quot;, &quot;Chapter&quot;,
								&quot;Page&quot;, &quot;Line&quot;
							</li>
							<li>
								<strong>Database format:</strong>{" "}
								&quot;category&quot;,
								&quot;question_title&quot;, &quot;chapter&quot;,
								&quot;page&quot;, &quot;line&quot;
							</li>
							<li>
								<strong>Mixed format:</strong> Any combination
								of the above
							</li>
						</ul>
					</div>
				</details>
			</div>

			<div className={styles.tableContainer}>
				<DataTable
					data={questions}
					columns={columns}
					onEdit={(question: Question) => setEditingQuestion(question)}
					onDelete={(question: Question) => {
						console.log(
							"Delete button clicked for question:",
							question.id
						);
						handleDeleteQuestions([question.id]);
					}}
					onSelectionChange={setSelectedQuestions}
					selectedItems={selectedQuestions}
					rowKey="id"
					// NEW: Enable pagination preservation
					preservePagination={true}
					currentPage={currentPage}
					onPageChange={setCurrentPage}
				/>
			</div>

			{(showAddForm || editingQuestion) && (
				<QuestionForm
					question={editingQuestion}
					onSave={handleSaveQuestion}
					onCancel={() => {
						setEditingQuestion(null);
						setShowAddForm(false);
					}}
					currentUser={currentUser}
				/>
			)}
		</div>
	);
};

interface QuestionFormProps {
	question: Question | null;
	onSave: (questionData: Partial<Question>) => void;
	onCancel: () => void;
	currentUser: CurrentUser | null;
}

const QuestionForm = ({
	question,
	onSave,
	onCancel,
	currentUser,
}: QuestionFormProps) => {
	const [formData, setFormData] = useState({
		question_category: question?.question_category || "",
		question_title: question?.question_title || "",
		question_chapter: question?.question_chapter || "",
		question_page: question?.question_page || 1,
		question_line: question?.question_line || "1",
		difficulty_level: question?.difficulty_level || 3,
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSave(formData);
	};

	const categories = QUESTION_CATEGORIES;

	// FIXED: Determine if difficulty selector should be shown
	const showDifficulty =
		currentUser && currentUser.authentication_level >= 10;

	return (
		<div className={styles.modal}>
			<div className={styles.modalContent}>
				<div className={styles.modalHeader}>
					<h2>{question ? "✏️ Edit Question" : "➕ Add New Question"}</h2>
					<button
						type="button"
						className={styles.closeButton}
						onClick={onCancel}
						aria-label="Close"
					>
						✕
					</button>
				</div>

				<form onSubmit={handleSubmit} className={styles.questionForm}>
					<div className={styles.formGrid}>
						<div className={styles.formGroup}>
							<label className={styles.formLabel}>Category *</label>
							<select
								className={styles.formSelect}
								value={formData.question_category}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										question_category: e.target.value,
									}))
								}
								required
							>
								<option value="">Select Category</option>
								{categories.map((category) => (
									<option key={category} value={category}>
										{category}
									</option>
								))}
							</select>
						</div>

						<div className={styles.formGroup}>
							<label className={styles.formLabel}>Chapter *</label>
							<input
								type="text"
								className={styles.formInput}
								value={formData.question_chapter}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										question_chapter: e.target.value,
									}))
								}
								required
								placeholder="e.g., Traffic Rules"
							/>
						</div>

						<div className={styles.formGroup}>
							<label className={styles.formLabel}>Page *</label>
							<input
								type="number"
								className={styles.formInput}
								min="1"
								value={formData.question_page}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										question_page:
											parseInt(e.target.value) || 1,
									}))
								}
								required
							/>
						</div>

						<div className={styles.formGroup}>
							<label className={styles.formLabel}>Line *</label>
							<input
								type="text"
								className={styles.formInput}
								value={formData.question_line}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										question_line: e.target.value,
									}))
								}
								required
								placeholder="e.g., 1, 1.5.20, Chapter A"
							/>
						</div>

						{/* FIXED: Show difficulty selector for level 10+ users */}
						{showDifficulty && (
							<div className={styles.formGroup}>
								<label className={styles.formLabel}>
									Difficulty Level *
								</label>
								<select
									className={styles.formSelect}
									value={formData.difficulty_level}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											difficulty_level:
												parseInt(e.target.value) || 3,
										}))
									}
									required
								>
									<option value={1}>Level 1 - Easiest</option>
									<option value={2}>Level 2 - Easy</option>
									<option value={3}>Level 3 - Medium</option>
									<option value={4}>Level 4 - Hard</option>
									<option value={5}>Level 5 - Hardest</option>
								</select>
								<small>
									Controls which users will see this question
									based on their handicap level
								</small>
							</div>
						)}
					</div>

					<div className={styles.questionTitleSection}>
						<label className={styles.formLabel}>Question Title *</label>
						<textarea
							className={styles.formInput}
							rows={6}
							value={formData.question_title}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									question_title: e.target.value,
								}))
							}
							required
							placeholder="Enter the complete question text... (must be unique)"
							style={{ resize: "vertical", minHeight: "180px" }}
						/>
						<small style={{ color: "#e53e3e" }}>
							⚠️ Question title must be unique - duplicates will
							be rejected
						</small>
					</div>

					<div className={styles.formActions}>
						<button
							type="button"
							className="btn btn-secondary"
							onClick={onCancel}
						>
							↪ Cancel
						</button>
						<button type="submit" className="btn btn-primary">
							{question
								? "💾 Update Question"
								: "✅ Create Question"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default QuestionManagement;