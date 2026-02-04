// src/components/roster/RosterComponent.tsx - ENHANCED VERSION WITH MANUAL ORDERING
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

// Manual order for roster display - add employee IDs in your desired order
const MANUAL_ORDER = [
	"21986",
	"22018",
	"36639",
	"39426",
	"39462",
	"51892",
	"22119",
	// Add more employee IDs here in your desired sequence
	// Any employees not listed here will appear at the end, sorted by employee ID
];

// Employees to hide from the roster (even if they meet the filter criteria)
const HIDDEN_EMPLOYEES = [
	"20580", "21701", "21531"
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
	const [instructionsMinimized, setInstructionsMinimized] = useState(true);
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

	// Get employee identifier - prioritize employee_id over UUID
	const getEmployeeIdentifier = (user: User): string => {
		const identifier = user.employee_id || user.id || "";
		console.log(
			`User ${user.full_name}: employee_id=${user.employee_id}, id=${user.id}, using=${identifier}`
		);
		return identifier;
	};

	// Enhanced sortInstructors with manual ordering
	const sortInstructors = useCallback((instructors: User[]): User[] => {
		console.log("Sorting instructors with manual order...", {
			manualOrder: MANUAL_ORDER,
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

		// Sort using manual order
		const sorted = visibleInstructors.sort((a, b) => {
			const aId = getEmployeeIdentifier(a);
			const bId = getEmployeeIdentifier(b);
			
			const aIndex = MANUAL_ORDER.indexOf(aId);
			const bIndex = MANUAL_ORDER.indexOf(bId);
			
			// If both are in manual order, sort by their position in MANUAL_ORDER
			if (aIndex !== -1 && bIndex !== -1) {
				return aIndex - bIndex;
			}
			
			// If only A is in manual order, A comes first
			if (aIndex !== -1) {
				return -1;
			}
			
			// If only B is in manual order, B comes first
			if (bIndex !== -1) {
				return 1;
			}
			
			// If neither is in manual order, sort by employee ID numerically (smallest to largest)
			const aNum = parseInt(aId) || 0;
			const bNum = parseInt(bId) || 0;
			return aNum - bNum;
		});

		console.log("Final sorted instructor order:", sorted.map((instructor, index) => ({
			position: index + 1,
			id: getEmployeeIdentifier(instructor),
			name: instructor.full_name,
			inManualOrder: MANUAL_ORDER.includes(getEmployeeIdentifier(instructor))
		})));

		return sorted;
	}, []);

	// Check if current user can modify a duty
	const canModifyDuty = (
		instructorId: string,
		date: string,
		duty?: string
	): boolean => {
		const userEmployeeId = currentUser?.employee_id || currentUser?.id;

		// Admin accounts can modify anything
		if (ADMIN_ACCOUNTS.includes(userEmployeeId || "")) {
			return true;
		}

		// Users can only modify their own schedule
		if (userEmployeeId !== instructorId) {
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
				return false;
			}
		}

		return true;
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
		const startYear = Math.max(2025, currentYear - 1);
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
			const dayOfWeek = date.getDay();
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
	const fetchDutiesFromAPI = useCallback(async (): Promise<void> => {
		try {
			const response = await fetch("/api/duties", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data: DutyResponse = await response.json();

				if (data.duties && Array.isArray(data.duties)) {
					const dutyNames = data.duties.map((d) => d.name);
					const dutyColorsMap = data.duties.reduce(
						(acc: Record<string, string>, d) => {
							acc[d.name] = d.color;
							return acc;
						},
						{}
					);

					setAvailableDuties(dutyNames);
					setDutyColors(dutyColorsMap);
				}
			}
		} catch (error) {
			console.error("Error fetching duties:", error);
		}
	}, [token]);

	// Fetch instructors
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
						getEmployeeIdentifier(user) === "39462"

				);

				const sortedInstructors = sortInstructors(filteredInstructors);
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
	}, [token, sortInstructors]);

	// Fetch schedules from API
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
		const html2canvas = (await import("html2canvas")).default;

		const tableContainer = tableContainerRef.current;
		if (!tableContainer) {
			alert("無法找到表格元素");
			return;
		}

		// Create screenshot container - SMS DARK THEME
		const screenshotContainer = document.createElement("div");
		screenshotContainer.id = "screenshot-container";
		screenshotContainer.style.cssText = `
			position: absolute;
			top: -10000px;
			left: 0;
			width: fit-content;
			height: fit-content;
			background: linear-gradient(135deg, #1a1f35 0%, #2d3651 100%) !important;
			padding: 16px;
			margin: 0;
			border: none;
			box-shadow: none;
			z-index: -999;
			visibility: hidden;
			opacity: 0;
			overflow: visible;
			box-sizing: border-box;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
		`;

		// Create table - SMS DARK THEME
		const table = document.createElement("table");
		table.style.cssText = `
			border-collapse: collapse;
			width: auto;
			background: rgba(255, 255, 255, 0.05) !important;
			font-family: inherit;
			table-layout: auto;
			margin: 0;
			padding: 0;
			border: 3px solid rgba(74, 158, 255, 0.3);
			box-sizing: border-box;
		`;

		// Create thead
		const thead = document.createElement("thead");
		const headerRow = document.createElement("tr");
		headerRow.style.background = "transparent";

		// Header cells - SMS BLUE GRADIENT
		const headers = ["員編", "姓名", "基地"];
		headers.forEach((header) => {
			const th = document.createElement("th");
			th.textContent = header;
			th.style.cssText = `
				background: linear-gradient(135deg, #4a9eff 0%, #357abd 100%) !important;
				color: #ffffff !important;
				padding: 14px 12px;
				text-align: center;
				font-weight: 600;
				border: 1px solid rgba(74, 158, 255, 0.3);
				font-size: 16px;
				min-width: 100px;
				white-space: nowrap;
				box-sizing: border-box;
				text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
			`;
			headerRow.appendChild(th);
		});

		// Date headers - SMS BLUE/RED GRADIENTS
		dateColumns.forEach((col) => {
			const th = document.createElement("th");
			const dayName = ["日", "一", "二", "三", "四", "五", "六"][
				col.dayOfWeek
			];

			const dateContent = document.createElement("div");
			dateContent.style.cssText = `
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: 3px;
				padding: 3px;
			`;

			const dateNumber = document.createElement("div");
			dateNumber.textContent = col.date.toString();
			dateNumber.style.cssText = `
				font-size: 16px;
				font-weight: bold;
				color: inherit;
			`;

			const dayOfWeekSpan = document.createElement("div");
			dayOfWeekSpan.textContent = dayName;
			dayOfWeekSpan.style.cssText = `
				font-size: 12px;
				opacity: 0.9;
				color: inherit;
			`;

			dateContent.appendChild(dateNumber);
			dateContent.appendChild(dayOfWeekSpan);
			th.appendChild(dateContent);

			th.style.cssText = `
				background: ${col.isWeekend ? "linear-gradient(135deg, #f87171 0%, #ef4444 100%)" : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)"} !important;
				color: #ffffff !important;
				padding: 10px 8px;
				text-align: center;
				font-weight: 600;
				border: 1px solid ${col.isWeekend ? "rgba(239, 68, 68, 0.3)" : "rgba(59, 130, 246, 0.3)"};
				font-size: 14px;
				min-width: 80px;
				white-space: nowrap;
				box-sizing: border-box;
				text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
			`;
			headerRow.appendChild(th);
		});

		thead.appendChild(headerRow);
		table.appendChild(thead);

		// Create tbody - SMS DARK THEME
		const tbody = document.createElement("tbody");
		tbody.style.background = "transparent";

		instructors.forEach((instructor) => {
			const employeeId = getEmployeeIdentifier(instructor);
			const row = document.createElement("tr");
			row.style.cssText = `
				border-bottom: 1px solid rgba(255, 255, 255, 0.1);
				background: transparent !important;
			`;

			// Instructor info cells - SMS DARK THEME
			const cells = [
				employeeId,
				instructor.full_name,
				instructor.base,
			];
			cells.forEach((text, cellIndex) => {
				const td = document.createElement("td");
				td.textContent = text || "";
				td.style.cssText = `
					padding: 12px 10px;
					text-align: center;
					border: 1px solid rgba(255, 255, 255, 0.1);
					background: ${cellIndex === 0 ? "rgba(255, 255, 255, 0.08)" : "rgba(255, 255, 255, 0.05)"} !important;
					font-weight: 500;
					font-size: 15px;
					min-width: 100px;
					white-space: nowrap;
					color: #e8e9ed;
					box-sizing: border-box;
				`;
				row.appendChild(td);
			});

			// Schedule cells - SMS DARK THEME
			dateColumns.forEach((col) => {
				const td = document.createElement("td");
				const duties = getDutiesForDate(employeeId, col.fullDate);

				td.style.cssText = `
					padding: 5px;
					border: 1px solid rgba(255, 255, 255, 0.1);
					vertical-align: top;
					min-width: 80px;
					height: 90px;
					background: rgba(255, 255, 255, 0.03) !important;
					box-sizing: border-box;
				`;

				const dutiesContainer = document.createElement("div");
				dutiesContainer.style.cssText = `
					display: flex;
					flex-direction: column;
					gap: 3px;
					height: 100%;
					min-height: 80px;
					align-items: center;
					justify-content: flex-start;
					padding: 3px;
					box-sizing: border-box;
				`;

				duties.forEach((duty) => {
					const dutyTag = document.createElement("div");
					dutyTag.textContent = duty;
					dutyTag.style.cssText = `
						padding: 4px 8px;
						text-align: center;
						font-size: 13px;
						font-weight: 600;
						border-radius: 4px;
						color: #ffffff !important;
						text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.6);
						min-height: 22px;
						display: flex;
						align-items: center;
						justify-content: center;
						background: ${DUTY_COLORS[duty] || "#3b82f6"} !important;
						border: 1px solid rgba(0, 0, 0, 0.2);
						white-space: nowrap;
						width: 100%;
						box-sizing: border-box;
						max-width: 70px;
					`;
					dutiesContainer.appendChild(dutyTag);
				});

				td.appendChild(dutiesContainer);
				row.appendChild(td);
			});

			tbody.appendChild(row);
		});

		table.appendChild(tbody);
		screenshotContainer.appendChild(table);

		document.body.appendChild(screenshotContainer);

		await new Promise((resolve) => {
			requestAnimationFrame(() => {
				requestAnimationFrame(resolve);
			});
		});

		const tableWidth = table.offsetWidth;
		const tableHeight = table.offsetHeight;
		const totalWidth = tableWidth + 32; // 16px padding on each side
		const totalHeight = tableHeight + 32;

		screenshotContainer.style.visibility = "visible";
		screenshotContainer.style.opacity = "1";

		// INCREASED RESOLUTION - 2x pixel ratio and 2x scale
		const canvas = await html2canvas(screenshotContainer, {
			useCORS: true,
			allowTaint: true,
			backgroundColor: "#1a1f35", // SMS dark background
			logging: false,
			pixelRatio: 2, // INCREASED from 1 to 2
			scale: 2, // INCREASED from 1.2 to 2
			width: totalWidth,
			height: totalHeight,
			windowWidth: totalWidth,
			windowHeight: totalHeight,
			scrollX: 0,
			scrollY: 0,
			removeContainer: true,
			foreignObjectRendering: false,
			imageTimeout: 0,
			onclone: (clonedDoc: Document) => {
				const clonedBody = clonedDoc.body;
				if (clonedBody) {
					clonedBody.style.backgroundColor = "#1a1f35";
				}
				const clonedContainer = clonedDoc.getElementById(
					"screenshot-container"
				);
				if (clonedContainer) {
					clonedContainer.style.background = "linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)";
					clonedContainer.style.visibility = "visible";
					clonedContainer.style.opacity = "1";
				}
			},
		} as any);

		document.body.removeChild(screenshotContainer);

		const ctx = canvas.getContext("2d");
		const imageData = ctx?.getImageData(
			0,
			0,
			canvas.width,
			canvas.height
		);
		const hasContent = imageData?.data.some(
			(value, index) => index % 4 !== 3 && value !== 255
		);

		if (!hasContent) {
			throw new Error("Screenshot appears to be blank");
		}

		const link = document.createElement("a");
		const fileName = `教師班表-${selectedYear}年${selectedMonth}月-${new Date()
			.toISOString()
			.slice(0, 10)}.png`;
		link.download = fileName;
		link.href = canvas.toDataURL("image/png", 1.0); // INCREASED quality from 0.95 to 1.0

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		alert(`截圖已儲存：${fileName}\n解析度已提升為高清 (2x)`);
	} catch (error: any) {
		console.error("Screenshot error:", error);
		let errorMessage = "截圖失敗：";
		if (error.message?.includes("blank")) {
			errorMessage += "截圖內容為空白，請稍後再試";
		} else if (error.message?.includes("html2canvas")) {
			errorMessage += "截圖庫載入失敗，請重新整理頁面";
		} else if (error.message?.includes("Canvas")) {
			errorMessage += "瀏覽器不支援此功能，請使用最新版 Chrome 或 Firefox";
		} else {
			errorMessage += error.message || "未知錯誤";
		}
		alert(errorMessage);
	}
};

	// Excel export functionality
	const handleExcelExport = async (): Promise<void> => {
		try {
			const XLSXModule = await import("xlsx");
			const XLSX = XLSXModule.default || XLSXModule;

			if (!XLSX.utils || !XLSX.utils.book_new) {
				throw new Error("XLSX utils not available");
			}

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

			const wb = XLSX.utils.book_new();
			const ws = XLSX.utils.aoa_to_sheet(excelData);

			const colWidths = [
				{ wch: 10 },
				{ wch: 15 },
				{ wch: 8 },
				...dateColumns.map(() => ({ wch: 12 })),
			];
			ws["!cols"] = colWidths;

			const sheetName = `${selectedYear}年${selectedMonth}月班表`;
			XLSX.utils.book_append_sheet(wb, ws, sheetName);

			const fileName = `教師班表-${selectedYear}年${selectedMonth}月.xlsx`;
			XLSX.writeFile(wb, fileName);

		} catch (error: any) {
			console.error("Excel export error:", error);
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
		if (!availableDuties.includes(newDuty)) {
			setAvailableDuties((prev) => [...prev, newDuty]);
			setDutyColors((prev) => ({
				...prev,
				[newDuty]: color,
			}));
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
						<h1 className={styles.title}>教師班表系統</h1>

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
								一般使用者只能安排自己的班表，管理員可修改所有班表
							</li>
							<li>
								<strong>任務編輯限制：</strong>
								一般使用者無法刪除管理者指派的任務
							</li>
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