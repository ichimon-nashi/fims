// src/components/roster/RosterComponent.tsx - ENHANCED VERSION
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/common/Navbar";
import DutyManager from "@/components/roster/DutyManager";
import styles from "./RosterComponent.module.css";

interface User {
	id: string;
	employee_id: string;
	full_name: string;
	rank: string;
	base: string;
	email: string;
	filter: string[];
	handicap_level: number;
	authentication_level: number;
}

interface ScheduleEntry {
	id?: string;
	employee_id: string;
	date: string;
	duties: string[];
	created_by?: string; // Track who created the entry
}

interface DutyPermission {
	duty: string;
	created_by: string;
}

// Special accounts that can modify all schedules
const ADMIN_ACCOUNTS = ["admin", "21986", "51892"];

const RosterComponent = () => {
	const { token, user: currentUser } = useAuth();
	const tableContainerRef = useRef<HTMLDivElement>(null);
	const [instructors, setInstructors] = useState<User[]>([]);
	const [scheduleData, setScheduleData] = useState<{
		[key: string]: ScheduleEntry[];
	}>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [selectedDuty, setSelectedDuty] = useState<string | null>(null);
	const [isMobile, setIsMobile] = useState(false);
	const [dutiesMinimized, setDutiesMinimized] = useState(false);
	const [availableDuties, setAvailableDuties] = useState<string[]>([
		"OD",
		"SAG",
		"教師會",
		"訓練",
		"課",
		"專案",
		"休假",
		"查核",
		"IOSA",
	]);

	const [dutyColors, setDutyColors] = useState<Record<string, string>>({
		OD: "#FF6B6B",
		SAG: "#4ECDC4", 
		教師會: "#3772ff", 
		訓練: "#72e0ac", 
		課: "#f9a03f", 
		專案: "#ffc2e2", 
		休假: "#d0ada7", 
		查核: "#f4e285",
		IOSA: "#b892ff", 
	});

	// Year/Month selection state
	const currentDate = new Date();
	const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
	const [selectedMonth, setSelectedMonth] = useState(
		currentDate.getMonth() + 1
	);

	const DUTY_COLORS = dutyColors;

	// Check if current user can modify a duty
	const canModifyDuty = (
		instructorId: string,
		date: string,
		duty?: string
	): boolean => {
		// Get user identifier - try multiple fields
		const userEmployeeId =
			currentUser?.employee_id ||
			currentUser?.employeeId ||
			currentUser?.id;

		console.log("Permission check:", {
			currentUser: currentUser,
			userEmployeeId,
			instructorId,
			adminAccounts: ADMIN_ACCOUNTS,
		});

		// Admin accounts can modify anything
		if (ADMIN_ACCOUNTS.includes(userEmployeeId || "")) {
			console.log("User is admin, allowing modification");
			return true;
		}

		// Users can only modify their own schedule
		if (userEmployeeId !== instructorId) {
			console.log("User trying to modify someone else's schedule");
			return false;
		}

		// If checking a specific duty, ensure it wasn't created by admin
		if (duty) {
			const key = `${instructorId}-${date}`;
			const entry = scheduleData[key]?.[0];
			if (
				entry?.created_by &&
				ADMIN_ACCOUNTS.includes(entry.created_by)
			) {
				console.log("Duty was created by admin, cannot modify");
				return false;
			}
		}

		console.log("Permission granted for self-modification");
		return true;
	};

	// Detect mobile/tablet for different interaction modes
	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 1024);
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Horizontal scroll handlers
	const scrollLeft = () => {
		if (tableContainerRef.current) {
			tableContainerRef.current.scrollBy({
				left: -200,
				behavior: "smooth",
			});
		}
	};

	const scrollRight = () => {
		if (tableContainerRef.current) {
			tableContainerRef.current.scrollBy({
				left: 200,
				behavior: "smooth",
			});
		}
	};

	// Generate year options (starting from 2025, current year ± 1)
	const generateYearOptions = () => {
		const years = [];
		const currentYear = currentDate.getFullYear();
		const startYear = Math.max(2025, currentYear - 1); // Don't go below 2025
		const endYear = currentYear + 1;

		for (let i = startYear; i <= endYear; i++) {
			years.push(i);
		}
		return years;
	};

	// Month options
	const months = [
		{ value: 1, label: "一月 (January)" },
		{ value: 2, label: "二月 (February)" },
		{ value: 3, label: "三月 (March)" },
		{ value: 4, label: "四月 (April)" },
		{ value: 5, label: "五月 (May)" },
		{ value: 6, label: "六月 (June)" },
		{ value: 7, label: "七月 (July)" },
		{ value: 8, label: "八月 (August)" },
		{ value: 9, label: "九月 (September)" },
		{ value: 10, label: "十月 (October)" },
		{ value: 11, label: "十一月 (November)" },
		{ value: 12, label: "十二月 (December)" },
	];

	// Generate date columns for the selected month
	const generateDateColumns = () => {
		const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
		const columns = [];

		for (let day = 1; day <= daysInMonth; day++) {
			const date = new Date(selectedYear, selectedMonth - 1, day);
			const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
			const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

			columns.push({
				date: day,
				fullDate: `${selectedYear}-${selectedMonth
					.toString()
					.padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
				isWeekend,
				dayOfWeek,
			});
		}

		return columns;
	};

	const dateColumns = generateDateColumns();

	// Fetch duties from database
	const fetchDutiesFromAPI = async () => {
		try {
			const response = await fetch("/api/duties", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				console.log("Duties API response:", data);

				if (data.duties && Array.isArray(data.duties)) {
					const dutyNames = data.duties.map((d: any) => d.name);
					const dutyColorsMap = data.duties.reduce(
						(acc: Record<string, string>, d: any) => {
							acc[d.name] = d.color;
							return acc;
						},
						{}
					);

					console.log("Setting duties from API:", dutyNames);
					console.log("Setting colors from API:", dutyColorsMap);

					setAvailableDuties(dutyNames);
					setDutyColors(dutyColorsMap);
				}
			} else {
				console.log("Failed to fetch duties from API, using defaults");
			}
		} catch (error) {
			console.error("Error fetching duties:", error);
			console.log("Using default duties due to error");
		}
	};

	// Fetch instructors
	const fetchInstructors = async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/users", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();
				const users = data.users || data;

				const filteredInstructors = users.filter(
					(user: User) =>
						user.rank === "FI - Flight Attendant Instructor" ||
						user.rank === "SC - Section Chief" ||
						user.employee_id === "22119"
				);

				setInstructors(filteredInstructors);
			} else {
				const errorData = await response.json();
				setError(
					`Failed to fetch instructors: ${
						errorData.message || "Unknown error"
					}`
				);
			}
		} catch (err) {
			setError("Error loading instructors");
			console.error("Error fetching instructors:", err);
		} finally {
			setLoading(false);
		}
	};

	// Fetch schedules from API
	const fetchSchedulesFromAPI = async () => {
		try {
			const scheduleApiUrl = `/api/schedule?year=${selectedYear}&month=${selectedMonth}`;

			const response = await fetch(scheduleApiUrl, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const schedules = await response.json();
				setScheduleData(schedules || {});
			} else {
				setScheduleData({});
			}
		} catch (err) {
			console.error("Error fetching schedules:", err);
			setScheduleData({});
		}
	};

	// Refresh data
	const handleRefresh = async () => {
		setLoading(true);
		try {
			await Promise.all([fetchInstructors(), fetchSchedulesFromAPI()]);
		} catch (err) {
			console.error("Error refreshing data:", err);
		} finally {
			setLoading(false);
		}
	};

	// Screenshot functionality - captures entire month
	const handleScreenshot = async () => {
		try {
			const html2canvasModule = await import("html2canvas");
			const html2canvas = html2canvasModule.default || html2canvasModule;

			console.log("Starting full month screenshot capture...");

			const tableContainer = tableContainerRef.current;
			if (!tableContainer) {
				alert("無法找到表格元素");
				return;
			}

			// Store original styles
			const originalStyles = {
				containerOverflow: tableContainer.style.overflow,
				containerMaxWidth: tableContainer.style.maxWidth,
				containerWidth: tableContainer.style.width,
				tableMinWidth:
					tableContainer.querySelector("table")?.style.minWidth || "",
			};

			// Temporarily modify styles to show full table
			tableContainer.style.overflow = "visible";
			tableContainer.style.maxWidth = "none";
			tableContainer.style.width = "max-content";

			const table = tableContainer.querySelector("table");
			if (table) {
				table.style.minWidth = "max-content";
				table.style.width = "max-content";
			}

			// Wait for layout changes to apply
			await new Promise((resolve) => setTimeout(resolve, 100));

			console.log("Capturing full table...");

			// Create canvas with the full table visible
			const canvas = await html2canvas(tableContainer, {
				scale: 1.5, // Good quality without being too large
				useCORS: true,
				allowTaint: true,
				backgroundColor: "#ffffff",
				logging: false,
				width: tableContainer.scrollWidth, // Capture full width
				height: tableContainer.scrollHeight, // Capture full height
				scrollX: 0,
				scrollY: 0,
				onclone: (clonedDoc) => {
					// Ensure cloned table shows full content
					const clonedContainer = clonedDoc.querySelector(
						'[data-testid="roster-table"]'
					);
					const clonedTable = clonedContainer?.querySelector("table");

					if (clonedContainer && clonedTable) {
						clonedContainer.style.overflow = "visible";
						clonedContainer.style.width = "max-content";
						clonedContainer.style.maxWidth = "none";
						clonedTable.style.width = "max-content";
						clonedTable.style.minWidth = "max-content";

						// Ensure all columns are visible
						const cells = clonedTable.querySelectorAll("td, th");
						cells.forEach((cell) => {
							cell.style.whiteSpace = "nowrap";
						});
					}
				},
			});

			// Restore original styles
			tableContainer.style.overflow = originalStyles.containerOverflow;
			tableContainer.style.maxWidth = originalStyles.containerMaxWidth;
			tableContainer.style.width = originalStyles.containerWidth;

			if (table) {
				table.style.minWidth = originalStyles.tableMinWidth;
				table.style.width = "";
			}

			console.log("Canvas created:", canvas.width, "x", canvas.height);

			// Create download link
			const link = document.createElement("a");
			const fileName = `教師班表-${selectedYear}年${selectedMonth}月.png`;
			link.download = fileName;
			link.href = canvas.toDataURL("image/png", 0.95); // Slightly compressed for file size

			// Trigger download
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			console.log("Full month screenshot saved:", fileName);
		} catch (error) {
			console.error("Screenshot error:", error);
			alert(`截圖失敗：${error.message || "未知錯誤"}，請聯絡豪神`);
		}
	};

	// Excel export functionality
	const handleExcelExport = async () => {
		try {
			// Use SheetJS library for Excel export - handle different export formats
			const XLSXModule = await import("xlsx");
			const XLSX = XLSXModule.default || XLSXModule;

			console.log("XLSX module loaded:", XLSX);

			// Check if XLSX has the required methods
			if (!XLSX.utils || !XLSX.utils.book_new) {
				throw new Error("XLSX utils not available");
			}

			// Prepare data for Excel
			const excelData = [];

			// Add header row
			const headerRow = ["員編", "姓名", "基地"];
			dateColumns.forEach((col) => {
				const dayName = ["日", "一", "二", "三", "四", "五", "六"][
					col.dayOfWeek
				];
				headerRow.push(`${col.date}日(${dayName})`);
			});
			excelData.push(headerRow);

			// Add data rows
			instructors.forEach((instructor) => {
				const row = [
					instructor.employee_id,
					instructor.full_name,
					instructor.base,
				];

				dateColumns.forEach((col) => {
					const duties = getDutiesForDate(
						instructor.employee_id,
						col.fullDate
					);
					row.push(duties.join(", ") || "");
				});

				excelData.push(row);
			});

			console.log("Excel data prepared:", excelData.length, "rows");

			// Create workbook
			const wb = XLSX.utils.book_new();
			const ws = XLSX.utils.aoa_to_sheet(excelData);

			// Set column widths
			const colWidths = [
				{ wch: 10 }, // 員編
				{ wch: 15 }, // 姓名
				{ wch: 8 }, // 基地
				...dateColumns.map(() => ({ wch: 12 })), // 日期列
			];
			ws["!cols"] = colWidths;

			// Add worksheet to workbook
			const sheetName = `${selectedYear}年${selectedMonth}月班表`;
			XLSX.utils.book_append_sheet(wb, ws, sheetName);

			// Save file
			const fileName = `教師班表-${selectedYear}年${selectedMonth}月.xlsx`;
			console.log("Saving Excel file:", fileName);

			XLSX.writeFile(wb, fileName);

			console.log("Excel export completed successfully");
		} catch (error) {
			console.error("Excel export error:", error);

			// Provide more specific error information
			if (error.message?.includes("XLSX")) {
				alert("Excel資料庫載入失敗，請確認已安裝 xlsx 套件");
			} else {
				alert(`匯出Excel失敗：${error.message || "未知錯誤"}`);
			}
		}
	};
	const handleDatabaseCleanup = async () => {
		const userEmployeeId =
			currentUser?.employee_id ||
			currentUser?.employeeId ||
			currentUser?.id;
		if (!ADMIN_ACCOUNTS.includes(userEmployeeId || "")) {
			alert("只有管理者可以執行資料庫清理");
			return;
		}

		if (
			!confirm(
				"確定要清理資料庫嗎？\n\n這會：\n• 刪除空的任務記錄\n• 刪除超出年份範圍的記錄\n• 只保留3年紀錄(前年至隔年)的記錄"
			)
		) {
			return;
		}

		try {
			setLoading(true);

			// Preview cleanup first
			const previewResponse = await fetch("/api/cleanup", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (previewResponse.ok) {
				const preview = await previewResponse.json();
				const { toBeDeleted, willRemain, currentYearRange } =
					preview.preview;

				const confirmMessage = `清理預覽：\n\n將刪除：\n• ${toBeDeleted.emptyDuties} 個空任務\n• ${toBeDeleted.oldRecords} 個舊記錄\n• ${toBeDeleted.futureRecords} 個新記錄\n• 總計：${toBeDeleted.total} 個記錄\n\n將保留：${willRemain} 個記錄 (${currentYearRange})\n\n確定執行清理？`;

				if (!confirm(confirmMessage)) {
					return;
				}
			}

			// Execute cleanup
			const response = await fetch("/api/cleanup", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const result = await response.json();
				alert(
					`清理完成！\n\n• 刪除空任務：${result.summary.emptyDutiesDeleted} 個\n• 刪除過期記錄：${result.summary.oldRecordsDeleted} 個\n• 剩餘記錄：${result.summary.remainingRecords} 個\n• 日期範圍：${result.summary.dateRange}`
				);

				// Refresh data after cleanup
				await handleRefresh();
			} else {
				const errorData = await response.json();
				alert(`清理失敗：${errorData.message}`);
			}
		} catch (error) {
			console.error("Database cleanup error:", error);
			alert("清理過程中發生錯誤");
		} finally {
			setLoading(false);
		}
	};

	// Get duties for a specific instructor and date
	const getDutiesForDate = (instructorId: string, date: string): string[] => {
		const key = `${instructorId}-${date}`;
		const entry = scheduleData[key];
		return entry?.[0]?.duties || [];
	};

	// Add duty to a date
	const addDutyToDate = async (
		instructorId: string,
		date: string,
		duty: string
	) => {
		if (!canModifyDuty(instructorId, date)) {
			alert("你沒有權限修改此任務");
			return;
		}

		try {
			const currentDuties = getDutiesForDate(instructorId, date);

			if (currentDuties.includes(duty)) {
				return;
			}

			const newDuties = [...currentDuties, duty];

			const instructor = instructors.find(
				(i) => i.employee_id === instructorId
			);
			const scheduleEntry = {
				employee_id: instructorId,
				full_name: instructor?.full_name || "Unknown",
				rank: instructor?.rank || "FI",
				base: instructor?.base || "Unknown",
				date,
				duties: newDuties,
				created_by:
					currentUser?.employee_id ||
					currentUser?.id ||
					currentUser?.id,
			};

			const response = await fetch("/api/schedule", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(scheduleEntry),
			});

			if (response.ok) {
				const key = `${instructorId}-${date}`;
				setScheduleData((prev) => ({
					...prev,
					[key]: [
						{
							employee_id: instructorId,
							date,
							duties: newDuties,
							created_by: currentUser?.employee_id,
						},
					],
				}));
			} else {
				const errorData = await response.json();
				console.error("Failed to add duty:", errorData);
			}
		} catch (error) {
			console.error("Error adding duty:", error);
		}
	};

	// Remove duty from a date
	const removeDutyFromDate = async (
		instructorId: string,
		date: string,
		dutyToRemove: string
	) => {
		if (!canModifyDuty(instructorId, date, dutyToRemove)) {
			alert("你沒有權限移除此任務（只能由管理者調整）");
			return;
		}

		try {
			const currentDuties = getDutiesForDate(instructorId, date);
			const newDuties = currentDuties.filter(
				(duty) => duty !== dutyToRemove
			);

			const instructor = instructors.find(
				(i) => i.employee_id === instructorId
			);
			const scheduleEntry = {
				employee_id: instructorId,
				full_name: instructor?.full_name || "Unknown",
				rank: instructor?.rank || "FI",
				base: instructor?.base || "Unknown",
				date,
				duties: newDuties,
				created_by: currentUser?.employee_id,
			};

			const response = await fetch("/api/schedule", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(scheduleEntry),
			});

			if (response.ok) {
				const key = `${instructorId}-${date}`;
				setScheduleData((prev) => ({
					...prev,
					[key]: [
						{
							employee_id: instructorId,
							date,
							duties: newDuties,
							created_by: currentUser?.employee_id,
						},
					],
				}));
			} else {
				const errorData = await response.json();
				console.error("Failed to remove duty:", errorData);
			}
		} catch (error) {
			console.error("Error removing duty:", error);
		}
	};

	// Handle drag start (desktop)
	const handleDragStart = (e: React.DragEvent, duty: string) => {
		e.dataTransfer.setData("duty", duty);
		e.dataTransfer.effectAllowed = "copy";
	};

	// Handle drop (desktop)
	const handleDrop = (
		e: React.DragEvent,
		instructorId: string,
		date: string
	) => {
		e.preventDefault();
		const duty = e.dataTransfer.getData("duty");
		if (duty) {
			addDutyToDate(instructorId, date, duty);
		}
	};

	// Handle drag over
	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	};

	// Handle mobile click
	const handleCellClick = (instructorId: string, date: string) => {
		if (isMobile && selectedDuty) {
			addDutyToDate(instructorId, date, selectedDuty);
			setSelectedDuty(null);
		}
	};

	// Handle duty click for removal
	const handleDutyClick = (
		e: React.MouseEvent,
		instructorId: string,
		date: string,
		duty: string
	) => {
		e.stopPropagation();

		if (isMobile || e.detail === 2) {
			removeDutyFromDate(instructorId, date, duty);
		}
	};

	// Add custom duty
	const addCustomDuty = async (newDuty: string, color: string) => {
		console.log("Adding custom duty:", newDuty, "with color:", color);

		if (!availableDuties.includes(newDuty)) {
			setAvailableDuties((prev) => [...prev, newDuty]);

			// Update duty colors with the new color
			setDutyColors((prev) => ({
				...prev,
				[newDuty]: color,
			}));

			console.log("Updated duty colors:", {
				...dutyColors,
				[newDuty]: color,
			});
		}
	};

	// Update duty list
	const updateDuties = (duties: { name: string; color: string }[]) => {
		const dutyNames = duties.map((d) => d.name);
		const colors = duties.reduce((acc, d) => {
			acc[d.name] = d.color;
			return acc;
		}, {} as Record<string, string>);

		setAvailableDuties(dutyNames);
		setDutyColors((prev) => ({ ...prev, ...colors }));
	};

	// Update single duty name
	const updateDutyName = (oldName: string, newName: string) => {
		setAvailableDuties((prev) =>
			prev.map((d) => (d === oldName ? newName : d))
		);

		// Update duty colors
		setDutyColors((prev) => {
			const newColors = { ...prev };
			if (newColors[oldName]) {
				newColors[newName] = newColors[oldName];
				delete newColors[oldName];
			}
			return newColors;
		});

		// Update schedule data to reflect name change
		setScheduleData((prev) => {
			const newData = { ...prev };
			Object.keys(newData).forEach((key) => {
				newData[key] = newData[key].map((entry) => ({
					...entry,
					duties: entry.duties.map((duty) =>
						duty === oldName ? newName : duty
					),
				}));
			});
			return newData;
		});
	};

	useEffect(() => {
		if (token) {
			fetchInstructors();
			fetchDutiesFromAPI(); // Load duties and colors from database
		}
	}, [token]);

	useEffect(() => {
		if (token && instructors.length > 0) {
			fetchSchedulesFromAPI();
		}
	}, [token, selectedYear, selectedMonth, instructors]);

	if (loading) {
		return (
			<div className={styles.loading}>
				<div>載入教師資料中...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className={styles.container}>
				<Navbar />
				<div className={styles.header}>
					<div className={styles.error}>{error}</div>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<Navbar />

			<div className={styles.maxWidth}>
				{/* Header */}
				<div className={styles.header}>
					<div className={styles.headerContent}>
						<h1 className={styles.title}>教師月份休假計畫</h1>

						<div className={styles.topControls}>
							<div className={styles.dateSelector}>
								<div className={styles.dropdown}>
									<label htmlFor="year">年份:</label>
									<select
										id="year"
										value={selectedYear}
										onChange={(e) =>
											setSelectedYear(
												parseInt(e.target.value)
											)
										}
										className={styles.select}
									>
										{generateYearOptions().map((year) => (
											<option key={year} value={year}>
												{year}年
											</option>
										))}
									</select>
								</div>

								<div className={styles.dropdown}>
									<label htmlFor="month">月份:</label>
									<select
										id="month"
										value={selectedMonth}
										onChange={(e) =>
											setSelectedMonth(
												parseInt(e.target.value)
											)
										}
										className={styles.select}
									>
										{months.map((month) => (
											<option
												key={month.value}
												value={month.value}
											>
												{month.label}
											</option>
										))}
									</select>
								</div>
							</div>

							<div>
								<button
									onClick={handleRefresh}
									className={`${styles.actionButton} ${styles.actionButtonBlue}`}
									disabled={loading}
								>
									🔄 {loading ? "載入中..." : "重新載入"}
								</button>

								{ADMIN_ACCOUNTS.includes(
									currentUser?.employee_id ||
										currentUser?.employeeId ||
										currentUser?.id ||
										""
								) && (
									<button
										className={`${styles.actionButton} ${styles.actionButtonRed}`}
										onClick={handleDatabaseCleanup}
										disabled={loading}
									>
										🧹 清理資料
									</button>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Duty Types */}
				<DutyManager
					duties={availableDuties}
					dutyColors={DUTY_COLORS}
					selectedDuty={selectedDuty}
					onDutySelect={setSelectedDuty}
					onDragStart={handleDragStart}
					minimized={dutiesMinimized}
					onToggleMinimize={() =>
						setDutiesMinimized(!dutiesMinimized)
					}
					onAddCustomDuty={addCustomDuty}
					onUpdateDuties={updateDuties}
					onUpdateDutyName={updateDutyName}
					isMobile={isMobile}
					isAdmin={ADMIN_ACCOUNTS.includes(
						currentUser?.employee_id ||
							currentUser?.employeeId ||
							currentUser?.id ||
							""
					)}
					token={token || ""}
				/>

				{/* Horizontal Scroll Controls */}
				{!isMobile && (
					<div className={styles.scrollControls}>
						<button
							onClick={scrollLeft}
							className={styles.scrollButton}
						>
							← 左滑
						</button>
						<button
							onClick={scrollRight}
							className={styles.scrollButton}
						>
							右滑 →
						</button>
					</div>
				)}

				{/* Roster Table */}
				<div
					className={styles.tableContainer}
					ref={tableContainerRef}
					data-testid="roster-table"
				>
					<table className={styles.rosterTable}>
						<thead>
							<tr>
								<th className={styles.instructorHeader}>
									員編
								</th>
								<th className={styles.instructorHeader}>
									姓名
								</th>
								<th className={styles.instructorHeader}>
									基地
								</th>
								{dateColumns.map((col) => (
									<th
										key={col.date}
										className={`${styles.dateHeader} ${
											col.isWeekend ? styles.weekend : ""
										}`}
									>
										<div
											className={styles.dateHeaderContent}
										>
											<div className={styles.dateNumber}>
												{col.date}
											</div>
											<div className={styles.dayOfWeek}>
												{
													[
														"日",
														"一",
														"二",
														"三",
														"四",
														"五",
														"六",
													][col.dayOfWeek]
												}
											</div>
										</div>
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{instructors.map((instructor) => (
								<tr
									key={instructor.id}
									className={styles.instructorRow}
								>
									<td className={styles.instructorCell}>
										{instructor.employee_id}
									</td>
									<td className={styles.instructorCell}>
										{instructor.full_name}
									</td>
									<td className={styles.instructorCell}>
										{instructor.base}
									</td>
									{dateColumns.map((col) => {
										const duties = getDutiesForDate(
											instructor.employee_id,
											col.fullDate
										);
										const canModify = canModifyDuty(
											instructor.employee_id,
											col.fullDate
										);

										return (
											<td
												key={col.date}
												className={`${
													styles.scheduleCell
												} ${
													!canModify
														? styles.readOnlyCell
														: ""
												}`}
												onDrop={(e) =>
													handleDrop(
														e,
														instructor.employee_id,
														col.fullDate
													)
												}
												onDragOver={handleDragOver}
												onClick={() =>
													handleCellClick(
														instructor.employee_id,
														col.fullDate
													)
												}
												title={
													!canModify
														? "你沒有權限修改此任務"
														: ""
												}
											>
												<div
													className={
														styles.dutiesContainer
													}
												>
													{duties.map(
														(duty, index) => (
															<div
																key={index}
																className={`${
																	styles.dutyTag
																} ${
																	!canModify
																		? styles.readOnlyDuty
																		: ""
																}`}
																style={{
																	backgroundColor:
																		DUTY_COLORS[
																			duty
																		] ||
																		"#3b82f6",
																}}
																onClick={(e) =>
																	handleDutyClick(
																		e,
																		instructor.employee_id,
																		col.fullDate,
																		duty
																	)
																}
																title={
																	!canModify
																		? "管理者設定，無法修改"
																		: isMobile
																		? `點選刪除 ${duty}`
																		: `點兩下刪除 ${duty}`
																}
															>
																{duty}
															</div>
														)
													)}
												</div>
											</td>
										);
									})}
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{/* Instructions */}
				<div className={styles.instructions}>
					<h3>使用說明：</h3>
					<ul>
						<li>
							<strong>桌面版本：</strong>拖拉上方任務到對應日期
						</li>
						<li>
							<strong>手機版本：</strong>點選欲排任務，再點選日期
						</li>
						<li>
							<strong>刪除任務：</strong>
							{isMobile
								? "點選已安排的任務"
								: "要刪除的任務用滑鼠點選兩次"}
						</li>
						<li>
							<strong>權限說明：</strong>
							一般使用者只能修改自己的排程，管理員可修改所有排程
						</li>
						<li>
							<strong>受保護任務：</strong>
							由管理員設定的任務無法被一般使用者移除
						</li>
					</ul>
				</div>

				{/* Action Buttons */}
				<div className={styles.actionButtons}>
					<button
						className={`${styles.actionButton} ${styles.actionButtonGreen}`}
						onClick={handleScreenshot}
					>
						📸 截圖儲存
					</button>

					<button
						className={`${styles.actionButton} ${styles.actionButtonOrange}`}
						onClick={handleExcelExport}
					>
						📊 匯出Excel
					</button>

					{/* {ADMIN_ACCOUNTS.includes(currentUser?.employee_id || currentUser?.employeeId || currentUser?.id || "") && (
            <button 
              className={`${styles.actionButton} ${styles.actionButtonRed}`}
              onClick={handleDatabaseCleanup}
              disabled={loading}
            >
              🧹 清理資料庫
            </button>
          )} */}
				</div>
			</div>
		</div>
	);
};

export default RosterComponent;
