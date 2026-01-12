// src/components/tasks/TimelineView.tsx - UPDATED: Filter for in-progress, auto-scroll, fixed z-index, removed navigation
import React, { useState, useRef, useEffect } from "react";
import Avatar from "@/components/ui/Avatar/Avatar";
import { Task, ZoomLevel } from "@/lib/task.types";
import { getSubtasks } from "@/utils/taskHelpers";
import { useTimeline } from "@/hooks/useTimeline";
import { createServiceClient } from "@/utils/supabase/service-client";

interface TimelineViewProps {
	tasks: Task[];
	onTaskClick: (task: Task) => void;
	refreshTasks?: () => void;
}

// Color palette for tasks
const TASK_COLOR_PALETTE = [
	"#3b82f6", 
	"#8b5cf6", 
	"#06b6d4", 
	"#10b981", 
	"#f59e0b", 
	"#ef4444",
	"#84cc16", 
	"#ec4899", 
	"#6366f1", 
	"#14b8a6", 
	"#f97316", 
	"#8b5a2b",
	"#7c3aed", 
	"#059669", 
	"#dc2626", 
	"#c2410c", 
	"#9333ea", 
	"#0891b2",
];

const TimelineView: React.FC<TimelineViewProps> = ({ tasks, onTaskClick, refreshTasks }) => {
	const {
		zoomLevel,
		setZoomLevel,
		viewStartDate,
		setViewStartDate,
		dateRange,
	} = useTimeline(tasks);

	// Refs for scroll synchronization
	const timelineScrollRef = useRef<HTMLDivElement>(null);

	// NEW: Filter to show only "in-progress" tasks by default
	const [statusFilter, setStatusFilter] = useState<string>("in-progress");

	// Drag and drop state for subtask reordering
	const [draggedSubtask, setDraggedSubtask] = useState<Task | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [dragOverParentId, setDragOverParentId] = useState<string | null>(null);

	// Hover tooltip state
	const [hoveredTask, setHoveredTask] = useState<{
		task: Task;
		x: number;
		y: number;
	} | null>(null);

	// NEW: Auto-scroll to today's date on mount
	useEffect(() => {
		if (timelineScrollRef.current && dateRange.length > 0) {
			const todayIndex = getTodayColumnIndex();
			if (todayIndex !== -1) {
				const columnWidth = getColumnWidth();
				const scrollPosition = todayIndex * columnWidth - 100; // Offset for visibility
				timelineScrollRef.current.scrollLeft = Math.max(0, scrollPosition);
			}
		}
	}, [dateRange]); // Run when dateRange is loaded

	// UPDATED: Filter tasks by status
	const filteredTasks = tasks.filter((task) => {
		if (statusFilter === "all") return true;
		return task.status === statusFilter;
	});

	// Get parent tasks from filtered tasks
	const parentTasks = filteredTasks.filter((task) => !task.parent_id);

	// Better date formatting for tooltip that handles timezone correctly
	const formatTooltipDate = (dateString: string) => {
		const dateParts = dateString.split('-');
		const year = parseInt(dateParts[0]);
		const month = parseInt(dateParts[1]) - 1;
		const day = parseInt(dateParts[2]);
		const date = new Date(year, month, day);
		
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric"
		});
	};

	const getFixedTaskPosition = (startDate: string, endDate: string) => {
		if (!dateRange || dateRange.length === 0) return { left: '0px', width: '0px' };

		const parseDate = (dateStr: string) => {
			const parts = dateStr.split('-');
			const year = parseInt(parts[0]);
			const month = parseInt(parts[1]) - 1;
			const day = parseInt(parts[2]);
			return new Date(year, month, day);
		};

		const normalizeToMidnight = (date: Date) => {
			return new Date(date.getFullYear(), date.getMonth(), date.getDate());
		};

		const start = parseDate(startDate);
		const end = parseDate(endDate);
		const firstDate = normalizeToMidnight(dateRange[0]);
		
		const columnWidth = getColumnWidth();

		switch (zoomLevel) {
			case "days": {
				const normalizedStart = normalizeToMidnight(start);
				const normalizedEnd = normalizeToMidnight(end);
				
				const startDiff = Math.round((normalizedStart.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
				const endDiff = Math.round((normalizedEnd.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
				const duration = Math.max(1, endDiff - startDiff + 1);
				
				return {
					left: `${Math.max(0, startDiff * columnWidth)}px`,
					width: `${duration * columnWidth}px`
				};
			}
			case "weeks": {
				const normalizedStart = normalizeToMidnight(start);
				const normalizedEnd = normalizeToMidnight(end);
				
				const startWeek = Math.floor((normalizedStart.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
				const endWeek = Math.floor((normalizedEnd.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
				const duration = Math.max(1, endWeek - startWeek + 1);
				
				return {
					left: `${Math.max(0, startWeek * columnWidth)}px`,
					width: `${duration * columnWidth}px`
				};
			}
			case "months": {
				const startMonths = (start.getFullYear() - firstDate.getFullYear()) * 12 + (start.getMonth() - firstDate.getMonth());
				const endMonths = (end.getFullYear() - firstDate.getFullYear()) * 12 + (end.getMonth() - firstDate.getMonth());
				
				const startDay = start.getDate();
				const endDay = end.getDate();
				const endDaysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
				
				const startFraction = (startDay - 1) / new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
				const endFraction = endDay / endDaysInMonth;
				
				const leftPosition = (startMonths + startFraction) * columnWidth;
				const rightPosition = (endMonths + endFraction) * columnWidth;
				const width = Math.max(columnWidth * 0.1, rightPosition - leftPosition);
				
				return {
					left: `${Math.max(0, leftPosition)}px`,
					width: `${width}px`
				};
			}
			case "quarters": {
				const normalizedStart = normalizeToMidnight(start);
				const normalizedEnd = normalizeToMidnight(end);
				
				const startQuarter = Math.floor(((normalizedStart.getFullYear() - firstDate.getFullYear()) * 12 + (normalizedStart.getMonth() - firstDate.getMonth())) / 3);
				const endQuarter = Math.floor(((normalizedEnd.getFullYear() - firstDate.getFullYear()) * 12 + (normalizedEnd.getMonth() - firstDate.getMonth())) / 3);
				const duration = Math.max(1, endQuarter - startQuarter + 1);
				
				return {
					left: `${Math.max(0, startQuarter * columnWidth)}px`,
					width: `${duration * columnWidth}px`
				};
			}
			default:
				return { left: '0px', width: '100px' };
		}
	};

	const getColumnWidth = () => {
		switch (zoomLevel) {
			case "days": return 60;
			case "weeks": return 120;
			case "months": return 180;
			case "quarters": return 240;
			default: return 60;
		}
	};

	const getTaskColor = (taskId: string) => {
		const hash = taskId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return TASK_COLOR_PALETTE[hash % TASK_COLOR_PALETTE.length];
	};

	const getDarkerColor = (color: string) => {
		const hex = color.replace('#', '');
		const r = Math.max(0, parseInt(hex.slice(0, 2), 16) - 40);
		const g = Math.max(0, parseInt(hex.slice(2, 4), 16) - 40);
		const b = Math.max(0, parseInt(hex.slice(4, 6), 16) - 40);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	};

	const getMonthBackgroundColor = (date: Date) => {
		const month = date.getMonth();
		return month % 2 === 0 ? "rgba(241, 245, 249, 0.5)" : "rgba(248, 250, 252, 0.5)";
	};

	const getTodayColumnIndex = () => {
		if (!dateRange || dateRange.length === 0) return -1;

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		return dateRange.findIndex((date) => {
			const checkDate = new Date(date);
			checkDate.setHours(0, 0, 0, 0);
			
			switch (zoomLevel) {
				case "days":
					return checkDate.getTime() === today.getTime();
				case "weeks":
					const weekStart = new Date(checkDate);
					weekStart.setDate(checkDate.getDate() - checkDate.getDay());
					const weekEnd = new Date(weekStart);
					weekEnd.setDate(weekStart.getDate() + 6);
					return today >= weekStart && today <= weekEnd;
				case "months":
					return checkDate.getMonth() === today.getMonth() && 
						   checkDate.getFullYear() === today.getFullYear();
				case "quarters":
					const todayQuarter = Math.floor(today.getMonth() / 3);
					const checkQuarter = Math.floor(checkDate.getMonth() / 3);
					return checkQuarter === todayQuarter && 
						   checkDate.getFullYear() === today.getFullYear();
				default:
					return false;
			}
		});
	};

	const getTodayLinePosition = () => {
		const todayIndex = getTodayColumnIndex();
		if (todayIndex === -1) return 0;

		const columnWidth = getColumnWidth();
		const today = new Date();

		switch (zoomLevel) {
			case "days":
				return todayIndex * columnWidth + columnWidth / 2;
			case "weeks":
				const dayOfWeek = today.getDay();
				return todayIndex * columnWidth + (dayOfWeek / 7) * columnWidth;
			case "months":
				const dayOfMonth = today.getDate();
				const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
				return todayIndex * columnWidth + (dayOfMonth / daysInMonth) * columnWidth;
			case "quarters":
				const monthInQuarter = today.getMonth() % 3;
				return todayIndex * columnWidth + (monthInQuarter / 3) * columnWidth;
			default:
				return todayIndex * columnWidth;
		}
	};

	const getHeaderLabel = (date: Date) => {
		switch (zoomLevel) {
			case "days":
				return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
			case "weeks":
				const weekEnd = new Date(date);
				weekEnd.setDate(date.getDate() + 6);
				return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
			case "months":
				return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
			case "quarters":
				const quarter = Math.floor(date.getMonth() / 3) + 1;
				return `Q${quarter} ${date.getFullYear()}`;
			default:
				return "";
		}
	};

	const getMonthLabel = (date: Date) => {
		return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
	};

	const handleTaskMouseEnter = (e: React.MouseEvent, task: Task) => {
		setHoveredTask({
			task,
			x: e.clientX,
			y: e.clientY - 10
		});
	};

	const handleTaskMouseMove = (e: React.MouseEvent, task: Task) => {
		if (hoveredTask?.task.id === task.id) {
			setHoveredTask({
				task,
				x: e.clientX,
				y: e.clientY - 10
			});
		}
	};

	const handleTaskMouseLeave = () => {
		setHoveredTask(null);
	};

	const handleGoToToday = () => {
		setViewStartDate(new Date());
	};

	return (
		<div style={{ 
			background: 'rgba(15, 23, 42, 0.6)', 
			borderRadius: '1rem', 
			overflow: 'hidden',
			border: '1px solid rgba(148, 163, 184, 0.1)',
			backdropFilter: 'blur(10px)'
		}}>
			{/* Timeline Controls with Status Filter - SIMPLIFIED: Removed navigation buttons */}
			<div style={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				padding: '1rem',
				borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
				background: 'rgba(15, 23, 42, 0.8)',
				flexWrap: 'wrap',
				gap: '1rem'
			}}>
				{/* Left Side: Zoom and Today */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
					{/* Today Button */}
					<button
						onClick={handleGoToToday}
						style={{
							background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
							color: "white",
							border: "none",
							borderRadius: "0.5rem",
							padding: "0.5rem 0.75rem",
							cursor: "pointer",
							fontSize: "0.875rem",
							fontWeight: "600",
							transition: "all 0.2s",
							boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = "translateY(-1px)";
							e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.4)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = "translateY(0)";
							e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.3)";
						}}
					>
						Go to Today
					</button>

					{/* Zoom Level Selector */}
					<div
						style={{
							display: "flex",
							background: "rgba(51, 65, 85, 0.5)",
							borderRadius: "0.5rem",
							padding: "0.25rem",
							border: "1px solid rgba(148, 163, 184, 0.2)",
						}}
					>
						{(
							["days", "weeks", "months", "quarters"] as ZoomLevel[]
						).map((level) => (
							<button
								key={level}
								onClick={() => setZoomLevel(level)}
								style={{
									padding: "0.5rem 1rem",
									borderRadius: "0.375rem",
									fontSize: "0.875rem",
									fontWeight: "600",
									border: "none",
									cursor: "pointer",
									transition: "all 0.2s",
									background:
										zoomLevel === level
											? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
											: "transparent",
									color:
										zoomLevel === level ? "white" : "#94a3b8",
									boxShadow:
										zoomLevel === level
											? "0 2px 8px rgba(59, 130, 246, 0.3)"
											: "none",
									textTransform: "capitalize",
								}}
							>
								{level}
							</button>
						))}
					</div>
				</div>

				{/* Right Side: Status Filter and Info */}
				<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
					{/* Status Filter */}
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
						<label style={{ fontSize: '0.875rem', color: '#cbd5e1', fontWeight: '600' }}>
							Status:
						</label>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							style={{
								padding: '0.5rem 1rem',
								borderRadius: '0.5rem',
								border: '1px solid rgba(148, 163, 184, 0.2)',
								background: 'rgba(30, 41, 59, 0.8)',
								color: '#e2e8f0',
								fontSize: '0.875rem',
								fontWeight: '600',
								cursor: 'pointer'
							}}
						>
							<option value="all">All Tasks</option>
							<option value="backlog">代辦 Open</option>
							<option value="in-progress">進行中 In Progress</option>
							<option value="done">完成 Complete</option>
							<option value="review">暫緩 On Hold</option>
						</select>
					</div>

					{/* Info Display */}
					<div style={{ fontSize: '0.875rem', color: '#94a3b8', fontWeight: '600' }}>
						{parentTasks.length} tasks • {zoomLevel}
					</div>
				</div>
			</div>

			<div style={{ display: 'flex', height: 'calc(100vh - 300px)', minHeight: '500px' }}>
				{/* Task Names Column - FIXED: Higher z-index for sticky positioning */}
				<div style={{ 
					width: '300px', 
					borderRight: '1px solid rgba(148, 163, 184, 0.2)', 
					background: 'rgba(15, 23, 42, 0.9)',
					display: 'flex',
					flexDirection: 'column',
					position: 'sticky',
					left: 0,
					zIndex: 30  // FIXED: Ensure names stay on top when scrolling
				}}>
					{/* Month Header - FIXED: Higher z-index */}
					<div style={{ 
						height: '60px', 
						borderBottom: '1px solid rgba(148, 163, 184, 0.2)', 
						background: 'rgba(15, 23, 42, 1)',
						display: 'flex', 
						alignItems: 'center',
						position: 'sticky',
						top: 0,
						zIndex: 32  // FIXED: Above everything when scrolling
					}} />
					
					{/* Date Header - FIXED: Higher z-index */}
					<div style={{ 
						height: '50px', 
						borderBottom: '1px solid rgba(148, 163, 184, 0.2)', 
						background: 'rgba(15, 23, 42, 1)',
						display: 'flex', 
						alignItems: 'center', 
						padding: '0 1rem',
						fontWeight: '700',
						fontSize: '0.875rem',
						color: '#e2e8f0',
						position: 'sticky',
						top: '60px',
						zIndex: 31  // FIXED: Above task rows when scrolling
					}}>
						Tasks ({parentTasks.length})
					</div>
					
					{/* Task List */}
					<div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
						{parentTasks.map((task, taskIndex) => {
							// FIXED: Get subtasks from ALL tasks, not just filteredTasks
							const subtasks = getSubtasks(tasks, task.id);
							const taskColor = getTaskColor(task.id);
							
							return (
								<div key={task.id}>
									{/* Parent Task Row */}
									<div style={{ 
										minHeight: '60px', 
										borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
										display: 'flex',
										alignItems: 'center',
										padding: '0.75rem 1rem',
										backgroundColor: taskIndex % 2 === 0 ? 'rgba(30, 41, 59, 0.5)' : 'rgba(15, 23, 42, 0.5)',
										cursor: 'pointer',
										transition: 'all 0.2s'
									}}
									onClick={() => onTaskClick(task)}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.7)';
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = taskIndex % 2 === 0 ? 'rgba(30, 41, 59, 0.5)' : 'rgba(15, 23, 42, 0.5)';
									}}
									>
										<div style={{ 
											width: '4px', 
											height: '100%', 
											background: taskColor, 
											marginRight: '0.75rem',
											borderRadius: '2px',
											minHeight: '30px'
										}} />
										<div style={{ flex: 1 }}>
											<div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#e2e8f0', marginBottom: '0.25rem' }}>
												{task.title}
											</div>
											<div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
												{task.assigneeNames?.slice(0, 2).join(', ')}
												{task.assigneeNames && task.assigneeNames.length > 2 && ` +${task.assigneeNames.length - 2}`}
											</div>
										</div>
									</div>
									
									{/* Subtask Rows */}
									{subtasks.map((subtask) => (
										<div key={subtask.id} style={{ 
											minHeight: '60px', 
											borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
											display: 'flex',
											alignItems: 'center',
											padding: '0.75rem 1rem 0.75rem 2rem',
											backgroundColor: 'rgba(51, 65, 85, 0.3)',
											cursor: 'pointer',
											transition: 'all 0.2s'
										}}
										onClick={() => onTaskClick(subtask)}
										onMouseEnter={(e) => {
											e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0.5)';
										}}
										onMouseLeave={(e) => {
											e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.3)';
										}}
										>
											<div style={{ 
												width: '3px', 
												height: '100%', 
												background: getTaskColor(subtask.id), 
												marginRight: '0.75rem',
												borderRadius: '2px',
												minHeight: '24px',
												opacity: 0.7
											}} />
											<div style={{ flex: 1 }}>
												<div style={{ fontWeight: '500', fontSize: '0.8125rem', color: '#cbd5e1' }}>
													↳ {subtask.title}
												</div>
												<div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.125rem' }}>
													{subtask.progress || 0}% complete
												</div>
											</div>
										</div>
									))}
								</div>
							);
						})}
					</div>
				</div>

				{/* Timeline Grid - FIXED: Lower z-index than names column */}
				<div style={{ flex: 1, overflow: 'auto', position: 'relative' }} ref={timelineScrollRef}>
					<div style={{ display: 'inline-block', minWidth: '100%' }}>
						<div style={{ position: 'relative', minWidth: `${dateRange.length * getColumnWidth()}px` }}>
							{/* Month Row - FIXED: Sticky positioning with proper z-index */}
							<div style={{ 
								height: '60px', 
								display: 'flex', 
								borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
								background: 'rgba(15, 23, 42, 1)',
								position: 'sticky',
								top: 0,
								zIndex: 20  // FIXED: Below names column but above timeline bars
							}}>
								{dateRange.map((date, index) => {
									const isFirstOfMonth = date.getDate() === 1 || index === 0;
									const monthLabel = getMonthLabel(date);
									const monthStart = index === 0 || date.getDate() === 1;
									const monthEnd = index === dateRange.length - 1 || 
										(index < dateRange.length - 1 && dateRange[index + 1].getDate() === 1);
									
									let monthWidth = 1;
									if (zoomLevel === "days" && monthStart) {
										const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
										const remainingDays = Math.min(
											daysInMonth - date.getDate() + 1,
											dateRange.length - index
										);
										monthWidth = remainingDays;
									}

									return (
										<div key={index} style={{ 
											width: `${getColumnWidth() * (zoomLevel === "days" && isFirstOfMonth ? monthWidth : 1)}px`,
											borderRight: '1px solid rgba(148, 163, 184, 0.2)',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontWeight: '700',
											fontSize: '0.875rem',
											color: '#e2e8f0',
											background: getMonthBackgroundColor(date),
											opacity: 0.95
										}}>
											{(zoomLevel !== "days" || isFirstOfMonth) && monthLabel}
										</div>
									);
								})}
							</div>

							{/* Date Row - FIXED: Sticky positioning with proper z-index */}
							<div style={{ 
								height: '50px', 
								display: 'flex', 
								borderBottom: '2px solid rgba(148, 163, 184, 0.3)',
								background: 'rgba(15, 23, 42, 0.95)',
								position: 'sticky',
								top: '60px',
								zIndex: 19  // FIXED: Below month row, above timeline bars
							}}>
								{dateRange.map((date, index) => {
									const isToday = getTodayColumnIndex() === index;
									const isWeekend = zoomLevel === "days" && (date.getDay() === 0 || date.getDay() === 6);
									
									return (
										<div key={index} style={{ 
											width: `${getColumnWidth()}px`,
											borderRight: '1px solid rgba(148, 163, 184, 0.2)',
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontWeight: isToday ? '700' : '500',
											fontSize: '0.8125rem',
											color: isToday ? '#3b82f6' : '#cbd5e1',
											background: isWeekend ? 'rgba(51, 65, 85, 0.3)' : 'transparent',
											position: 'relative'
										}}>
											{isToday && (
												<div style={{
													position: 'absolute',
													bottom: 0,
													left: 0,
													right: 0,
													height: '3px',
													background: '#3b82f6'
												}} />
											)}
											{getHeaderLabel(date)}
										</div>
									);
								})}
							</div>

							{/* Task Timeline Body - z-index: 1 (lowest) */}
							<div style={{ position: 'relative', zIndex: 1 }}>
								<div style={{ position: 'relative' }}>
									{parentTasks.map((task, taskIndex) => {
										// FIXED: Get subtasks from ALL tasks, not just filteredTasks
										const subtasks = getSubtasks(tasks, task.id);
										const taskColor = getTaskColor(task.id);
										
										return (
											<div key={task.id}>
												{/* Parent Task Timeline Bar */}
												<div style={{ 
													minHeight: '60px', 
													borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
													backgroundColor: taskIndex % 2 === 0 ? 'rgba(30, 41, 59, 0.3)' : 'rgba(15, 23, 42, 0.3)',
													position: 'relative',
													display: 'flex',
													alignItems: 'center'
												}}>
													{/* Month background stripes */}
													{dateRange.map((date, dateIndex) => {
														const monthBgColor = getMonthBackgroundColor(date);
														const isWeekend = zoomLevel === "days" && (date.getDay() === 0 || date.getDay() === 6);
														
														return (
															<div key={dateIndex} style={{
																position: 'absolute',
																left: `${dateIndex * getColumnWidth()}px`,
																width: `${getColumnWidth()}px`,
																top: 0,
																bottom: 0,
																background: isWeekend ? 'rgba(51, 65, 85, 0.2)' : monthBgColor,
																opacity: 0.3,
																pointerEvents: 'none',
																zIndex: 1
															}} />
														);
													})}
													
													{task.start_date && task.due_date && (
														<div 
															style={{
																position: 'absolute', 
																top: '50%', 
																transform: 'translateY(-50%)',
																height: '1.75rem', 
																background: taskColor, 
																borderRadius: '0.25rem',
																display: 'flex', 
																alignItems: 'center', 
																paddingLeft: '0.5rem',
																paddingRight: '0.5rem',
																color: 'white', 
																fontSize: '0.75rem', 
																fontWeight: '500',
																cursor: 'pointer', 
																minWidth: '100px',
																zIndex: 10,
																boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
																transition: 'all 0.2s ease',
																...getFixedTaskPosition(task.start_date, task.due_date)
															}} 
															onClick={() => onTaskClick(task)}
															onMouseEnter={(e) => handleTaskMouseEnter(e, task)}
															onMouseMove={(e) => handleTaskMouseMove(e, task)}
															onMouseLeave={handleTaskMouseLeave}
														>
															<div style={{ 
																position: 'absolute', 
																left: 0, 
																top: 0, 
																bottom: 0,
																width: `${task.progress || 0}%`,
																background: getDarkerColor(taskColor),
																borderRadius: '0.25rem', 
																transition: 'width 0.3s ease',
																pointerEvents: 'none',
																zIndex: -1
															}} />
															
															<span style={{ 
																position: 'relative', 
																zIndex: 1,
																overflow: 'hidden',
																textOverflow: 'ellipsis',
																whiteSpace: 'nowrap',
																flex: 1,
																pointerEvents: 'none'
															}}>
																{task.title}
															</span>
														</div>
													)}
												</div>
												
												{/* Subtask Timeline Bars */}
												{subtasks.map((subtask) => {
													const subtaskColor = getTaskColor(subtask.id);
													
													return (
														<div key={subtask.id} style={{ 
															minHeight: '60px', 
															borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
															backgroundColor: 'rgba(51, 65, 85, 0.2)', 
															position: 'relative',
															display: 'flex', 
															alignItems: 'center'
														}}>
															{/* Month background stripes */}
															{dateRange.map((date, dateIndex) => {
																const monthBgColor = getMonthBackgroundColor(date);
																const isWeekend = zoomLevel === "days" && (date.getDay() === 0 || date.getDay() === 6);
																
																return (
																	<div key={dateIndex} style={{
																		position: 'absolute',
																		left: `${dateIndex * getColumnWidth()}px`,
																		width: `${getColumnWidth()}px`,
																		top: 0,
																		bottom: 0,
																		background: isWeekend ? 'rgba(51, 65, 85, 0.2)' : monthBgColor,
																		opacity: 0.2,
																		pointerEvents: 'none',
																		zIndex: 1
																	}} />
																);
															})}
															
															{subtask.start_date && subtask.due_date && (
																<div 
																	style={{
																		position: 'absolute', 
																		top: '50%', 
																		transform: 'translateY(-50%)',
																		height: '1.5rem', 
																		background: subtaskColor, 
																		borderRadius: '0.25rem',
																		display: 'flex', 
																		alignItems: 'center', 
																		paddingLeft: '0.5rem',
																		paddingRight: '0.5rem',
																		color: 'white', 
																		fontSize: '0.75rem', 
																		fontWeight: '400',
																		cursor: 'pointer', 
																		opacity: 0.9, 
																		minWidth: '80px',
																		zIndex: 10,
																		boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
																		transition: 'all 0.2s ease',
																		...getFixedTaskPosition(subtask.start_date, subtask.due_date)
																	}} 
																	onClick={() => onTaskClick(subtask)}
																	onMouseEnter={(e) => handleTaskMouseEnter(e, subtask)}
																	onMouseMove={(e) => handleTaskMouseMove(e, subtask)}
																	onMouseLeave={handleTaskMouseLeave}
																>
																	<div style={{ 
																		position: 'absolute', 
																		left: 0, 
																		top: 0, 
																		bottom: 0,
																		width: `${subtask.progress || 0}%`,
																		background: getDarkerColor(subtaskColor),
																		borderRadius: '0.25rem', 
																		transition: 'width 0.3s ease',
																		pointerEvents: 'none',
																		zIndex: -1
																	}} />
																	
																	<span style={{ 
																		position: 'relative', 
																		zIndex: 1,
																		overflow: 'hidden',
																		textOverflow: 'ellipsis',
																		whiteSpace: 'nowrap',
																		flex: 1,
																		pointerEvents: 'none'
																	}}>
																		{subtask.title}
																	</span>
																</div>
															)}
														</div>
													);
												})}
											</div>
										);
									})}
									
									{/* Today line */}
									{getTodayColumnIndex() !== -1 && (
										<div style={{
											position: 'absolute', top: 0, bottom: 0,
											left: `${getTodayLinePosition()}px`,
											width: '2px', background: '#ef4444', zIndex: 5, pointerEvents: 'none'
										}} />
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Hover Tooltip */}
			{hoveredTask && (
				<div style={{
					position: 'fixed',
					left: `${hoveredTask.x}px`,
					top: `${hoveredTask.y}px`,
					transform: 'translateX(-50%) translateY(-100%)',
					background: 'rgba(0, 0, 0, 0.9)',
					color: 'white',
					padding: '0.75rem',
					borderRadius: '0.5rem',
					fontSize: '0.875rem',
					zIndex: 1000,
					pointerEvents: 'none',
					boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
					maxWidth: '300px',
					minWidth: '200px'
				}}>
					<div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
						{hoveredTask.task.title}
					</div>
					{hoveredTask.task.start_date && (
						<div style={{ fontSize: '0.75rem', color: '#e5e7eb', marginBottom: '0.25rem' }}>
							<strong>Start:</strong> {formatTooltipDate(hoveredTask.task.start_date)}
						</div>
					)}
					{hoveredTask.task.due_date && (
						<div style={{ fontSize: '0.75rem', color: '#e5e7eb', marginBottom: '0.25rem' }}>
							<strong>End:</strong> {formatTooltipDate(hoveredTask.task.due_date)}
						</div>
					)}
					<div style={{ fontSize: '0.75rem', color: '#e5e7eb' }}>
						<strong>Progress:</strong> {hoveredTask.task.progress || 0}%
					</div>
				</div>
			)}
		</div>
	);
};

export default TimelineView;