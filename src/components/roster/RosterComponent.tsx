// src/components/roster/RosterComponent.tsx - ENHANCED VERSION WITH SORTING AND HIDING
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/common/Navbar";
import DutyManager from "@/components/roster/DutyManager";
import {
	User,
	ScheduleEntry,
	DUTY_COLORS as DEFAULT_DUTY_COLORS,
} from "@/lib/types";
import styles from "./RosterComponent.module.css";

// Special accounts that can modify all schedules
const ADMIN_ACCOUNTS = ["admin", "21986", "51892"];

// Priority order for sorting - these employees will appear first in this exact order
const PRIORITY_ORDER = ["21701", "21531", "21986"];

// Employees to hide from the roster (even if they meet the filter criteria)
const HIDDEN_EMPLOYEES = [
	"20580",
];

// Define interfaces for better type safety
interface DateColumn {
	date: number;
	fullDate: string;
	isWeekend: boolean;
	dayOfWeek: number;
}

interface Month {
	value: number;
	label: string;
}

interface DutyResponse {
	duties?: Array<{ name: string; color: string }>;
}

interface UsersResponse {
	users?: User[];
}

interface CleanupPreview {
	preview: {
		toBeDeleted: {
			emptyDuties: number;
			oldRecords: number;
			futureRecords: number;
			total: number;
		};
		willRemain: number;
		currentYearRange: string;
	};
}

interface CleanupResult {
	summary: {
		emptyDutiesDeleted: number;
		oldRecordsDeleted: number;
		remainingRecords: number;
		dateRange: string;
	};
}

const RosterComponent: React.FC = () => {
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
	const [instructionsMinimized, setInstructionsMinimized] = useState(true); // Default to minimized
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

	const [dutyColors, setDutyColors] =
		useState<Record<string, string>>(DEFAULT_DUTY_COLORS);

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
		const userEmployeeId = currentUser?.employee_id || currentUser?.id;

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

	// Get employee identifier - prioritize employee_id over UUID
	const getEmployeeIdentifier = (user: User): string => {
		const identifier = user.employee_id || user.id || "";
		console.log(
			`User ${user.full_name}: employee_id=${user.employee_id}, id=${user.id}, using=${identifier}`
		);
		return identifier;
	};

	// Custom sort function for instructors
	const sortInstructors = (instructors: User[]): User[] => {
		console.log("Sorting instructors...", {
			priorityOrder: PRIORITY_ORDER,
			hiddenEmployees: HIDDEN_EMPLOYEES,
			totalInstructors: instructors.length
		});

		// First, filter out hidden employees
		const visibleInstructors = instructors.filter(instructor => {
			const employeeId = getEmployeeIdentifier(instructor);
			const isHidden = HIDDEN_EMPLOYEES.includes(employeeId);
			if (isHidden) {
				console.log(`Hiding instructor: ${instructor.full_name} (${employeeId})`);
			}
			return !isHidden;
		});

		console.log(`After filtering hidden employees: ${visibleInstructors.length} instructors`);

		// Sort the visible instructors
		const sorted = visibleInstructors.sort((a, b) => {
			const aId = getEmployeeIdentifier(a);
			const bId = getEmployeeIdentifier(b);
			
			const aPriority = PRIORITY_ORDER.indexOf(aId);
			const bPriority = PRIORITY_ORDER.indexOf(bId);
			
			// If both are in priority list, sort by priority order
			if (aPriority !== -1 && bPriority !== -1) {
				return aPriority - bPriority;
			}
			
			// If only A is in priority list, A comes first
			if (aPriority !== -1) {
				return -1;
			}
			
			// If only B is in priority list, B comes first
			if (bPriority !== -1) {
				return 1;
			}
			
			// If neither is in priority list, sort by employee ID numerically (smallest to largest)
			const aNum = parseInt(aId) || 0;
			const bNum = parseInt(bId) || 0;
			return aNum - bNum;
		});

		console.log("Sorted instructor order:", sorted.map(instructor => ({
			id: getEmployeeIdentifier(instructor),
			name: instructor.full_name
		})));

		return sorted;
	};

	// Detect mobile/tablet for different interaction modes
	useEffect(() => {
		const checkMobile = (): void => {
			setIsMobile(window.innerWidth < 1024);
		};

		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Horizontal scroll handlers
	const scrollLeft = (): void => {
		if (tableContainerRef.current) {
			tableContainerRef.current.scrollBy({
				left: -200,
				behavior: "smooth",
			});
		}
	};

	const scrollRight = (): void => {
		if (tableContainerRef.current) {
			tableContainerRef.current.scrollBy({
				left: 200,
				behavior: "smooth",
			});
		}
	};

	// Generate year options (starting from 2025, current year ± 1)
	const generateYearOptions = (): number[] => {
		const years: number[] = [];
		const currentYear = currentDate.getFullYear();
		const startYear = Math.max(2025, currentYear - 1); // Don't go below 2025
		const endYear = currentYear + 1;

		for (let i = startYear; i <= endYear; i++) {
			years.push(i);
		}
		return years;
	};

	// Month options
	const months: Month[] = [
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
	const generateDateColumns = (): DateColumn[] => {
		const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
		const columns: DateColumn[] = [];

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

	// Fetch duties from database - wrapped in useCallback
	const fetchDutiesFromAPI = useCallback(async (): Promise<void> => {
		try {
			const response = await fetch("/api/duties", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data: DutyResponse = await response.json();
				console.log("Duties API response:", data);

				if (data.duties && Array.isArray(data.duties)) {
					const dutyNames = data.duties.map((d) => d.name);
					const dutyColorsMap = data.duties.reduce(
						(acc: Record<string, string>, d) => {
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
	}, [token]);

	// Fetch instructors - wrapped in useCallback
	const fetchInstructors = useCallback(async (): Promise<void> => {
		try {
			setLoading(true);
			const response = await fetch("/api/users", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data: UsersResponse | User[] = await response.json();
				console.log("Users API response:", data);
				const users = Array.isArray(data)
					? data
					: (data as UsersResponse).users || [];

				const filteredInstructors = users.filter(
					(user: User) =>
						user.rank === "FI" ||
						user.rank === "FI - Flight Attendant Instructor" ||
						user.rank === "SC" ||
						user.rank === "SC - Section Chief" ||
						getEmployeeIdentifier(user) === "21701" ||
						getEmployeeIdentifier(user) === "22119" ||
						getEmployeeIdentifier(user) === "36639"
				);

				console.log("Filtered instructors before sorting:", filteredInstructors.length);
				
				// Apply custom sorting
				const sortedInstructors = sortInstructors(filteredInstructors);
				
				console.log("Final sorted instructors:", sortedInstructors.length);
				setInstructors(sortedInstructors);
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
	}, [token]);

	// Fetch schedules from API - wrapped in useCallback
	const fetchSchedulesFromAPI = useCallback(async (): Promise<void> => {
		try {
			const scheduleApiUrl = `/api/schedule?year=${selectedYear}&month=${selectedMonth}`;

			const response = await fetch(scheduleApiUrl, {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const schedules: { [key: string]: ScheduleEntry[] } =
					await response.json();
				setScheduleData(schedules || {});
			} else {
				setScheduleData({});
			}
		} catch (err) {
			console.error("Error fetching schedules:", err);
			setScheduleData({});
		}
	}, [token, selectedYear, selectedMonth]);

	// Refresh data
	const handleRefresh = async (): Promise<void> => {
		setLoading(true);
		try {
			await Promise.all([fetchInstructors(), fetchSchedulesFromAPI()]);
		} catch (err) {
			console.error("Error refreshing data:", err);
		} finally {
			setLoading(false);
		}
	};

	// Screenshot functionality
	const handleScreenshot = async (): Promise<void> => {
		try {
			const html2canvasModule = await import("html2canvas");
			const html2canvas = html2canvasModule.default || html2canvasModule;

			console.log("Creating universal screenshot...");

			const tableContainer = tableContainerRef.current;
			if (!tableContainer) {
				alert("無法找到表格元素");
				return;
			}

			// Create a dedicated screenshot container with universal styling
			const screenshotContainer = document.createElement("div");
			screenshotContainer.id = "screenshot-container";
			screenshotContainer.style.cssText = `
			position: absolute;
			top: -10000px;
			left: 0;
			width: fit-content;
			height: fit-content;
			background: #ffffff !important;
			padding: 8px 20px 20px 8px;
			margin: 0;
			border: none;
			box-shadow: none;
			z-index: -999;
			visibility: hidden;
			opacity: 0;
			overflow: visible;
			box-sizing: content-box;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
		`;

			// Create outer wrapper with balanced padding
			const outerWrapper = document.createElement("div");
			outerWrapper.style.cssText = `
			background: #ffffff !important;
			padding: 8px 16px 16px 8px;
			margin: 0;
			border: 4px solid #ffffff;
			box-sizing: border-box;
			width: fit-content;
			height: fit-content;
		`;

			// Create table with comprehensive styling
			const table = document.createElement("table");
			table.style.cssText = `
			border-collapse: collapse;
			width: auto;
			background: #ffffff !important;
			font-family: inherit;
			table-layout: auto;
			margin: 0;
			padding: 0;
			border: 2px solid #e5e7eb;
		`;

			// Create thead
			const thead = document.createElement("thead");
			const headerRow = document.createElement("tr");
			headerRow.style.background = "#ffffff";

			// Header cells
			const headers = ["員編", "姓名", "基地"];
			headers.forEach((header) => {
				const th = document.createElement("th");
				th.textContent = header;
				th.style.cssText = `
				background: #02c39a !important;
				color: #ffffff !important;
				padding: 12px 10px;
				text-align: center;
				font-weight: 600;
				border: 1px solid #00a783;
				font-size: 14px;
				min-width: 90px;
				white-space: nowrap;
				box-sizing: border-box;
			`;
				headerRow.appendChild(th);
			});

			// Date headers
			dateColumns.forEach((col) => {
				const th = document.createElement("th");
				const dayName = ["日", "一", "二", "三", "四", "五", "六"][
					col.dayOfWeek
				];

				// Create date content
				const dateContent = document.createElement("div");
				dateContent.style.cssText = `
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 2px;
				padding: 2px;
			`;

				const dateNumber = document.createElement("div");
				dateNumber.textContent = col.date.toString();
				dateNumber.style.cssText = `
				font-size: 14px;
				font-weight: bold;
				color: inherit;
			`;

				const dayOfWeekSpan = document.createElement("div");
				dayOfWeekSpan.textContent = dayName;
				dayOfWeekSpan.style.cssText = `
				font-size: 10px;
				opacity: 0.9;
				color: inherit;
			`;

				dateContent.appendChild(dateNumber);
				dateContent.appendChild(dayOfWeekSpan);
				th.appendChild(dateContent);

				th.style.cssText = `
				background: ${col.isWeekend ? "#ef6f6f" : "#5c98f9"} !important;
				color: #ffffff !important;
				padding: 8px 6px;
				text-align: center;
				font-weight: 600;
				border: 1px solid ${col.isWeekend ? "#dc2626" : "#2563eb"};
				font-size: 12px;
				min-width: 70px;
				white-space: nowrap;
				box-sizing: border-box;
			`;
				headerRow.appendChild(th);
			});

			thead.appendChild(headerRow);
			table.appendChild(thead);

			// Create tbody
			const tbody = document.createElement("tbody");
			tbody.style.background = "#ffffff";

			instructors.forEach((instructor, instructorIndex) => {
				const employeeId = getEmployeeIdentifier(instructor);
				const row = document.createElement("tr");
				row.style.cssText = `
				border-bottom: 1px solid #e5e7eb;
				background: #ffffff !important;
			`;

				// Instructor info cells
				const cells = [
					employeeId,
					instructor.full_name,
					instructor.base,
				];
				cells.forEach((text, cellIndex) => {
					const td = document.createElement("td");
					td.textContent = text || "";
					td.style.cssText = `
					padding: 10px 8px;
					text-align: center;
					border: 1px solid #e5e7eb;
					background: ${cellIndex === 0 ? "#f1f5f9" : "#f8fafc"} !important;
					font-weight: 500;
					font-size: 13px;
					min-width: 90px;
					white-space: nowrap;
					color: #1f2937;
					box-sizing: border-box;
				`;
					row.appendChild(td);
				});

				// Schedule cells
				dateColumns.forEach((col) => {
					const td = document.createElement("td");
					const duties = getDutiesForDate(employeeId, col.fullDate);

					td.style.cssText = `
					padding: 4px;
					border: 1px solid #e5e7eb;
					vertical-align: top;
					min-width: 70px;
					height: 80px;
					background: #ffffff !important;
					box-sizing: border-box;
				`;

					const dutiesContainer = document.createElement("div");
					dutiesContainer.style.cssText = `
					display: flex;
					flex-direction: column;
					gap: 2px;
					height: 100%;
					min-height: 70px;
					align-items: center;
					justify-content: flex-start;
					padding: 2px;
					box-sizing: border-box;
				`;

					duties.forEach((duty) => {
						const dutyTag = document.createElement("div");
						dutyTag.textContent = duty;
						dutyTag.style.cssText = `
						padding: 3px 6px;
						text-align: center;
						font-size: 11px;
						font-weight: 600;
						border-radius: 3px;
						color: #ffffff !important;
						text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.6);
						min-height: 18px;
						display: flex;
						align-items: center;
						justify-content: center;
						background: ${DUTY_COLORS[duty] || "#3b82f6"} !important;
						border: 1px solid rgba(0, 0, 0, 0.2);
						white-space: nowrap;
						width: 100%;
						box-sizing: border-box;
						max-width: 60px;
					`;
						dutiesContainer.appendChild(dutyTag);
					});

					td.appendChild(dutiesContainer);
					row.appendChild(td);
				});

				tbody.appendChild(row);
			});

			table.appendChild(tbody);
			outerWrapper.appendChild(table);
			screenshotContainer.appendChild(outerWrapper);

			// Add to DOM
			document.body.appendChild(screenshotContainer);

			// Force layout calculation
			await new Promise((resolve) => {
				requestAnimationFrame(() => {
					requestAnimationFrame(resolve);
				});
			});

			// Calculate dimensions with balanced padding
			const tableWidth = table.offsetWidth;
			const tableHeight = table.offsetHeight;
			const totalWidth = tableWidth + 24; // 8px left + 16px right
			const totalHeight = tableHeight + 24; // 8px top + 16px bottom

			console.log(
				`Table dimensions: ${tableWidth}x${tableHeight}, Total: ${totalWidth}x${totalHeight}`
			);

			// Temporarily make visible for measurement and capture
			screenshotContainer.style.visibility = "visible";
			screenshotContainer.style.opacity = "1";

			// Capture with comprehensive options
			const canvas = await html2canvas(screenshotContainer, {
				useCORS: true,
				allowTaint: true,
				backgroundColor: "#ffffff",
				logging: false,
				pixelRatio: Math.min(window.devicePixelRatio || 1, 2), // Cap at 2x for performance
				scale: 1.2, // Balanced quality/performance
				width: totalWidth,
				height: totalHeight,
				windowWidth: totalWidth,
				windowHeight: totalHeight,
				scrollX: 0,
				scrollY: 0,
				removeContainer: true,
				foreignObjectRendering: false, // More compatible
				imageTimeout: 0,
				onclone: (clonedDoc: Document) => {
					// Ensure white background in cloned document
					const clonedBody = clonedDoc.body;
					if (clonedBody) {
						clonedBody.style.backgroundColor = "#ffffff";
					}
					const clonedContainer = clonedDoc.getElementById(
						"screenshot-container"
					);
					if (clonedContainer) {
						clonedContainer.style.backgroundColor = "#ffffff";
						clonedContainer.style.visibility = "visible";
						clonedContainer.style.opacity = "1";
					}
				},
			} as any);

			// Clean up
			document.body.removeChild(screenshotContainer);

			console.log("Canvas created:", canvas.width, "x", canvas.height);

			// Verify canvas has content
			const ctx = canvas.getContext("2d");
			const imageData = ctx?.getImageData(
				0,
				0,
				canvas.width,
				canvas.height
			);
			const hasContent = imageData?.data.some(
				(value, index) => index % 4 !== 3 && value !== 255 // Check for non-white pixels (excluding alpha)
			);

			if (!hasContent) {
				throw new Error("Screenshot appears to be blank");
			}

			// Create and download
			const link = document.createElement("a");
			const fileName = `教師班表-${selectedYear}年${selectedMonth}月-${new Date()
				.toISOString()
				.slice(0, 10)}.png`;
			link.download = fileName;
			link.href = canvas.toDataURL("image/png", 0.95); // High quality

			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			console.log("Universal screenshot saved successfully:", fileName);
			alert(`截圖已儲存：${fileName}`);
		} catch (error: any) {
			console.error("Screenshot error:", error);

			// Provide specific error guidance
			let errorMessage = "截圖失敗：";
			if (error.message?.includes("blank")) {
				errorMessage += "截圖內容為空白，請稍後再試";
			} else if (error.message?.includes("html2canvas")) {
				errorMessage += "截圖庫載入失敗，請重新整理頁面";
			} else if (error.message?.includes("Canvas")) {
				errorMessage +=
					"瀏覽器不支援此功能，請使用最新版 Chrome 或 Firefox";
			} else {
				errorMessage += error.message || "未知錯誤";
			}

			alert(errorMessage);
		}
	};

	// Excel export functionality
	const handleExcelExport = async (): Promise<void> => {
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
			const excelData: (string | number)[][] = [];

			// Add header row
			const headerRow: (string | number)[] = ["員編", "姓名", "基地"];
			dateColumns.forEach((col) => {
				const dayName = ["日", "一", "二", "三", "四", "五", "六"][
					col.dayOfWeek
				];
				headerRow.push(`${col.date}日(${dayName})`);
			});
			excelData.push(headerRow);

			// Add data rows
			instructors.forEach((instructor) => {
				const employeeId = getEmployeeIdentifier(instructor);
				const row: (string | number)[] = [
					employeeId,
					instructor.full_name,
					instructor.base,
				];

				dateColumns.forEach((col) => {
					const duties = getDutiesForDate(employeeId, col.fullDate);
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
		} catch (error: any) {
			console.error("Excel export error:", error);

			// Provide more specific error information
			if (error.message?.includes("XLSX")) {
				alert("Excel資料庫載入失敗，請確認已安裝 xlsx 套件");
			} else {
				alert(`匯出Excel失敗：${error.message || "未知錯誤"}`);
			}
		}
	};

	const handleDatabaseCleanup = async (): Promise<void> => {
		const userEmployeeId = currentUser?.employee_id || currentUser?.id;
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
				const preview: CleanupPreview = await previewResponse.json();
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
				const result: CleanupResult = await response.json();
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
	): Promise<void> => {
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
				(i) => getEmployeeIdentifier(i) === instructorId
			);
			const scheduleEntry = {
				employee_id: instructorId,
				full_name: instructor?.full_name || "Unknown",
				rank: instructor?.rank || "FI",
				base: instructor?.base || "Unknown",
				date,
				duties: newDuties,
				created_by: currentUser?.employee_id || currentUser?.id,
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
						} as ScheduleEntry,
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
	): Promise<void> => {
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
				(i) => getEmployeeIdentifier(i) === instructorId
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
						} as ScheduleEntry,
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
	const handleDragStart = (e: React.DragEvent, duty: string): void => {
		e.dataTransfer.setData("duty", duty);
		e.dataTransfer.effectAllowed = "copy";
	};

	// Handle drop (desktop)
	const handleDrop = (
		e: React.DragEvent,
		instructorId: string,
		date: string
	): void => {
		e.preventDefault();
		const duty = e.dataTransfer.getData("duty");
		if (duty) {
			addDutyToDate(instructorId, date, duty);
		}
	};

	const handleDragOver = (e: React.DragEvent): void => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "copy";
	};

	// Handle mobile click
	const handleCellClick = (instructorId: string, date: string): void => {
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
	): void => {
		e.stopPropagation();

		if (isMobile || e.detail === 2) {
			removeDutyFromDate(instructorId, date, duty);
		}
	};

	// Add custom duty
	const addCustomDuty = async (
		newDuty: string,
		color: string
	): Promise<void> => {
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
	const updateDuties = (duties: { name: string; color: string }[]): void => {
		const dutyNames = duties.map((d) => d.name);
		const colors = duties.reduce((acc, d) => {
			acc[d.name] = d.color;
			return acc;
		}, {} as Record<string, string>);

		setAvailableDuties(dutyNames);
		setDutyColors((prev) => ({ ...prev, ...colors }));
	};

	// Update single duty name
	const updateDutyName = (oldName: string, newName: string): void => {
		setAvailableDuties((prev) =>
			prev.map((d) => (d === oldName ? newName : d))
		);

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

	// Handle year change
	const handleYearChange = (
		e: React.ChangeEvent<HTMLSelectElement>
	): void => {
		setSelectedYear(parseInt(e.target.value));
	};

	// Handle month change
	const handleMonthChange = (
		e: React.ChangeEvent<HTMLSelectElement>
	): void => {
		setSelectedMonth(parseInt(e.target.value));
	};

	useEffect(() => {
		if (token) {
			fetchInstructors();
			fetchDutiesFromAPI();
		}
	}, [token, fetchInstructors, fetchDutiesFromAPI]);

	useEffect(() => {
		if (token && instructors.length > 0) {
			fetchSchedulesFromAPI();
		}
	}, [
		token,
		selectedYear,
		selectedMonth,
		instructors.length,
		fetchSchedulesFromAPI,
	]);

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
										onChange={handleYearChange}
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
										onChange={handleMonthChange}
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
						currentUser?.employee_id || currentUser?.id || ""
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
							{instructors.map((instructor) => {
								const employeeId =
									getEmployeeIdentifier(instructor);
								return (
									<tr
										key={instructor.id}
										className={styles.instructorRow}
									>
										<td className={styles.instructorCell}>
											{employeeId}
										</td>
										<td className={styles.instructorCell}>
											{instructor.full_name}
										</td>
										<td className={styles.instructorCell}>
											{instructor.base}
										</td>
										{dateColumns.map((col) => {
											const duties = getDutiesForDate(
												employeeId,
												col.fullDate
											);
											const canModify = canModifyDuty(
												employeeId,
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
															employeeId,
															col.fullDate
														)
													}
													onDragOver={handleDragOver}
													onClick={() =>
														handleCellClick(
															employeeId,
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
																	onClick={(
																		e
																	) =>
																		handleDutyClick(
																			e,
																			employeeId,
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
								);
							})}
						</tbody>
					</table>
				</div>

				{/* Instructions - Minimized by Default */}
				{instructionsMinimized ? (
					<div className={styles.minimizedInstructionsContainer}>
						<button
							onClick={() => setInstructionsMinimized(false)}
							className={styles.expandInstructionsButton}
						>
							📖 顯示使用說明
						</button>
					</div>
				) : (
					<div className={styles.instructions}>
						<div className={styles.instructionsHeader}>
							<h3>使用說明：</h3>
							<button
								onClick={() => setInstructionsMinimized(true)}
								className={styles.minimizeInstructionsButton}
								title="隱藏使用說明"
							>
								隱藏
							</button>
						</div>
						<ul>
							<li>
								<strong>桌面版本：</strong>
								拖拉上方任務到對應日期
							</li>
							<li>
								<strong>手機版本：</strong>
								點選欲排任務，再點選日期
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
							<li>
								<strong>排序說明：</strong>
								員工按照特定順序排列：21701, 21531, 21986 優先，其餘按員編號碼排序
							</li>
							{HIDDEN_EMPLOYEES.length > 0 && (
								<li>
									<strong>隱藏員工：</strong>
									部分員工已從名單中隱藏 ({HIDDEN_EMPLOYEES.length} 人)
								</li>
							)}
						</ul>
					</div>
				)}

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
				</div>
			</div>
		</div>
	);
};

export default RosterComponent;