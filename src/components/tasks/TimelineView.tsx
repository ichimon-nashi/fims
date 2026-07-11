// src/components/tasks/TimelineView.tsx - UPDATED: Filter for in-progress, auto-scroll, fixed z-index, removed navigation
import React, { useState, useRef, useEffect, useMemo } from "react";
import Avatar from "@/components/ui/Avatar/Avatar";
import { Task, ZoomLevel } from "@/lib/task.types";
import { calculateParentProgress } from "@/utils/taskHelpers";
import { useTimeline } from "@/hooks/useTimeline";
import { createServiceClient } from "@/utils/supabase/service-client";
import styles from "./TimelineView.module.css";

interface TimelineViewProps {
	tasks: Task[];
	onTaskClick: (task: Task) => void;
	refreshTasks?: () => void;
}

// Card layout constants for the staggered floating-card gantt
const CARD_HEIGHT = 104;
const LANE_VERTICAL_GAP = 28;
const CARD_HORIZONTAL_GAP = 28;
const MIN_CARD_WIDTH = 220;

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
		extendRangeForward,
	} = useTimeline(tasks);

	// Refs for scroll synchronization
	const timelineScrollRef = useRef<HTMLDivElement>(null);
	// NEW (#8): throttle guard so rapid scroll events don't fire multiple
	// extension requests before the DOM catches up with the new range
	const lastExtendRef = useRef(0);

	// NEW (#2/#3): measure exact remaining viewport height instead of
	// guessing with a calc(100vh - Npx) constant, which drifts whenever
	// surrounding chrome (navbar/header/controls) changes height and
	// causes page-level vertical scroll.
	const timelineBodyRef = useRef<HTMLDivElement>(null);
	const [bodyHeight, setBodyHeight] = useState<number | null>(null);

	useEffect(() => {
		const measure = () => {
			if (!timelineBodyRef.current) return;
			const top = timelineBodyRef.current.getBoundingClientRect().top;
			const available = window.innerHeight - top - 24; // 24px bottom breathing room
			setBodyHeight(Math.max(360, available));
		};
		measure();
		window.addEventListener('resize', measure);
		return () => window.removeEventListener('resize', measure);
	}, []);

	// NEW: Filter to show only "in-progress" tasks by default
	const [statusFilter, setStatusFilter] = useState<string>("in-progress");

	// Hover tooltip state
	const [hoveredTask, setHoveredTask] = useState<{
		task: Task;
		x: number;
		y: number;
	} | null>(null);

	// Auto-scroll to today's date on mount - except quarters, which is meant
	// as a whole-project overview and should start at the left (project start)
	useEffect(() => {
		if (timelineScrollRef.current && dateRange.length > 0) {
			if (zoomLevel === 'quarters') {
				timelineScrollRef.current.scrollLeft = 0;
				return;
			}
			const todayIndex = getTodayColumnIndex();
			if (todayIndex !== -1) {
				const columnWidth = getColumnWidth();
				const scrollPosition = todayIndex * columnWidth - 100; // Offset for visibility
				timelineScrollRef.current.scrollLeft = Math.max(0, scrollPosition);
			}
		}
	}, [dateRange, zoomLevel]); // Run when dateRange is loaded or zoom changes

	// NEW (#5): if the task-driven date range doesn't even fill the visible
	// width, the user never scrolls far enough to trigger the scroll-based
	// extension (#8), so the range just stops mid-viewport. Check fill on
	// mount/resize/zoom-change and extend forward until it's wide enough.
	useEffect(() => {
		const el = timelineScrollRef.current;
		if (!el) return;
		if (el.scrollWidth <= el.clientWidth && el.clientWidth > 0) {
			extendRangeForward();
		}
	}, [dateRange, zoomLevel]);

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
			case "quarters": return 130;
			default: return 60;
		}
	};

	const UNCATEGORIZED_COLOR = "#64748b";

	const hexToRgba = (hex: string, alpha: number) => {
		const clean = hex.replace('#', '');
		const r = parseInt(clean.slice(0, 2), 16);
		const g = parseInt(clean.slice(2, 4), 16);
		const b = parseInt(clean.slice(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	};

	const getCategoryColor = (category?: string) => {
		if (!category || !category.trim()) return UNCATEGORIZED_COLOR;
		const hash = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return TASK_COLOR_PALETTE[hash % TASK_COLOR_PALETTE.length];
	};

	// Staggered floating-card layout: greedy lane packing by rendered pixel
	// position (not raw dates), so cards never overlap visually regardless
	// of zoom level or MIN_CARD_WIDTH clamping.
	const { cardLayout, laneCount } = useMemo(() => {
		const withPosition = parentTasks
			.filter((task) => task.start_date && task.due_date)
			.map((task) => {
				const pos = getFixedTaskPosition(task.start_date!, task.due_date!);
				const left = parseFloat(pos.left);
				const rawWidth = parseFloat(pos.width);
				const width = Math.max(rawWidth, MIN_CARD_WIDTH);
				return { task, left, width, right: left + width };
			})
			.sort((a, b) => a.left - b.left);

		const laneEnds: number[] = [];
		const layout = new Map<string, { left: number; width: number; lane: number }>();

		withPosition.forEach(({ task, left, width, right }) => {
			let lane = laneEnds.findIndex((end) => end + CARD_HORIZONTAL_GAP <= left);
			if (lane === -1) {
				laneEnds.push(right);
				lane = laneEnds.length - 1;
			} else {
				laneEnds[lane] = right;
			}
			layout.set(task.id, { left, width, lane });
		});

		return { cardLayout: layout, laneCount: Math.max(laneEnds.length, 1) };
	}, [parentTasks, dateRange, zoomLevel]);

	const getMonthBackgroundColor = (date: Date) => {
		const month = date.getMonth();
		return month % 2 === 0 ? "rgba(51, 65, 85, 0.12)" : "transparent";
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

	// NEW (#8): when the user scrolls near the right edge of the timeline,
	// extend the date range forward instead of letting it just cut off.
	const handleTimelineScroll = () => {
		const el = timelineScrollRef.current;
		if (!el) return;

		const EDGE_THRESHOLD_PX = 400;
		const MIN_MS_BETWEEN_EXTENSIONS = 400;

		const nearRightEdge = el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_THRESHOLD_PX;
		const now = Date.now();

		if (nearRightEdge && now - lastExtendRef.current > MIN_MS_BETWEEN_EXTENSIONS) {
			lastExtendRef.current = now;
			extendRangeForward();
		}
	};

	return (
		<div className={styles.timelineContainer}>
			{/* Timeline Controls with Status Filter */}
			<div className={styles.timelineControls}>
				{/* Left Side: Zoom and Today */}
				<div className={styles.timelineControlsGroup}>
					<button className={styles.timelineTodayButton} onClick={handleGoToToday}>
						Go to Today
					</button>

					<div className={styles.timelineZoomGroup}>
						{(
							["days", "weeks", "months", "quarters"] as ZoomLevel[]
						).map((level) => (
							<button
								key={level}
								onClick={() => setZoomLevel(level)}
								className={`${styles.timelineZoomButton} ${zoomLevel === level ? styles.timelineZoomButtonActive : ''}`}
							>
								{level}
							</button>
						))}
					</div>
				</div>

				{/* Right Side: Status Filter and Info */}
				<div className={styles.timelineControlsGroup}>
					<div className={styles.timelineStatusGroup}>
						<label className={styles.timelineStatusLabel}>Status:</label>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className={styles.timelineStatusSelect}
						>
							<option value="all">All Tasks</option>
							<option value="backlog">代辦 Open</option>
							<option value="in-progress">進行中 In Progress</option>
							<option value="done">完成 Complete</option>
							<option value="review">暫緩 On Hold</option>
						</select>
					</div>

					<div className={styles.timelineInfo}>
						{parentTasks.length} tasks • {zoomLevel}
					</div>
				</div>
			</div>

			<div
				className={styles.timelineBody}
				ref={timelineBodyRef}
				style={bodyHeight ? { height: `${bodyHeight}px` } : undefined}
			>
				{/* Floating-card timeline canvas (staggered layout, no fixed name column) */}
				<div className={styles.timelineScrollArea} ref={timelineScrollRef} onScroll={handleTimelineScroll}>
					<div className={styles.timelineInnerWidth}>
						<div className={styles.timelineGridWidth} style={{ minWidth: `${dateRange.length * getColumnWidth()}px` }}>
							{/* Month Row */}
							<div className={styles.timelineMonthRow}>
								{dateRange.map((date, index) => {
									const isFirstOfMonth = date.getDate() === 1 || index === 0;

									// FIX: in days zoom, every other day in the month already
									// gets covered by the wide first-of-month cell below - a
									// separate cell here for those days double-counts width
									// and drifts the month row out of sync with the date row.
									if (zoomLevel === "days" && !isFirstOfMonth) return null;

									const monthLabel = getMonthLabel(date);

									let monthWidth = 1;
									if (zoomLevel === "days") {
										const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
										const remainingDays = Math.min(
											daysInMonth - date.getDate() + 1,
											dateRange.length - index
										);
										monthWidth = remainingDays;
									}

									return (
										<div
											key={index}
											className={styles.timelineMonthCell}
											style={{
												width: `${getColumnWidth() * (zoomLevel === "days" ? monthWidth : 1)}px`,
												background: getMonthBackgroundColor(date)
											}}
										>
											{monthLabel}
										</div>
									);
								})}
							</div>

							{/* Date Row */}
							<div className={styles.timelineDateRow}>
								{dateRange.map((date, index) => {
									const isToday = getTodayColumnIndex() === index;
									const isWeekend = zoomLevel === "days" && (date.getDay() === 0 || date.getDay() === 6);

									return (
										<div
											key={index}
											className={`${styles.timelineDateCell} ${isToday ? styles.timelineDateCellToday : ''}`}
											style={{
												width: `${getColumnWidth()}px`,
												background: isWeekend ? 'rgba(51, 65, 85, 0.3)' : 'transparent'
											}}
										>
											{isToday && <div className={styles.timelineTodayIndicatorBar} />}
											{getHeaderLabel(date)}
										</div>
									);
								})}
							</div>

							{/* Floating-card canvas body - fills remaining visible height, or grows taller if lane content needs more room */}
							<div
								className={styles.timelineCanvasBody}
								style={{
									height: `${Math.max(
										laneCount * (CARD_HEIGHT + LANE_VERTICAL_GAP) + LANE_VERTICAL_GAP,
										bodyHeight ? bodyHeight - 110 : 0
									)}px`
								}}
							>
								{/* Month background stripes (drawn once behind all cards) */}
								{dateRange.map((date, dateIndex) => {
									const monthBgColor = getMonthBackgroundColor(date);
									const isWeekend = zoomLevel === "days" && (date.getDay() === 0 || date.getDay() === 6);

									return (
										<div
											key={dateIndex}
											className={styles.timelineMonthStripe}
											style={{
												left: `${dateIndex * getColumnWidth()}px`,
												width: `${getColumnWidth()}px`,
												background: isWeekend ? 'rgba(51, 65, 85, 0.2)' : monthBgColor
											}}
										/>
									);
								})}

								{/* Floating task cards, positioned by lane-packed layout */}
								{parentTasks
									.filter((task) => cardLayout.has(task.id))
									.map((task) => {
										const layout = cardLayout.get(task.id)!;
										const taskColor = getCategoryColor(task.category);
										const calculatedProgress = calculateParentProgress(tasks, task.id);

										return (
											<div
												key={task.id}
												className={styles.timelineCard}
												style={{
													left: `${layout.left}px`,
													top: `${layout.lane * (CARD_HEIGHT + LANE_VERTICAL_GAP) + LANE_VERTICAL_GAP}px`,
													width: `${layout.width}px`,
													minHeight: `${CARD_HEIGHT}px`,
													borderLeft: `8px solid ${taskColor}`
												}}
												onClick={() => onTaskClick(task)}
												onMouseEnter={(e) => handleTaskMouseEnter(e, task)}
												onMouseMove={(e) => handleTaskMouseMove(e, task)}
												onMouseLeave={handleTaskMouseLeave}
											>
												{/* Row 1: date range (left) + avatar stack (right) - matches reference layout */}
												<div className={styles.timelineCardHeaderRow}>
													<span className={styles.timelineCardDateRange}>
														{task.start_date && formatTooltipDate(task.start_date)}
														{task.start_date && task.due_date && ' \u2013 '}
														{task.due_date && formatTooltipDate(task.due_date)}
													</span>

													{task.assigneeAvatars && task.assigneeAvatars.length > 0 && (
														<div className={styles.timelineCardAvatars}>
															{task.assigneeAvatars.slice(0, 3).map((employeeId, index) => (
																<span key={index} className={styles.timelineCardAvatar}>
																	<Avatar
																		employeeId={employeeId}
																		fullName={task.assigneeNames?.[index] || 'Unknown'}
																		size="small"
																	/>
																</span>
															))}
															{task.assigneeAvatars.length > 3 && (
																<span className={styles.timelineCardMoreAvatars}>
																	+{task.assigneeAvatars.length - 3}
																</span>
															)}
														</div>
													)}
												</div>

												{/* Row 2: title */}
												<div className={styles.timelineCardTitle}>{task.title}</div>

												{/* Row 3: progress bar + percentage (short, fixed width), tag pushed right */}
												<div className={styles.timelineCardFooterRow}>
													<div className={styles.timelineCardProgressGroup}>
														<div className={styles.timelineCardProgressTrack}>
															<div
																className={styles.timelineCardProgressFill}
																style={{ width: `${calculatedProgress}%` }}
															/>
														</div>
														<span className={styles.timelineCardProgressLabel}>
															{calculatedProgress}%
														</span>
													</div>
													{task.category && (
														<span
															className={styles.timelineCardTag}
															style={{
																background: hexToRgba(taskColor, 0.18),
																border: `1px solid ${hexToRgba(taskColor, 0.45)}`,
																color: taskColor
															}}
														>
															{task.category}
														</span>
													)}
												</div>
											</div>
										);
									})}

								{/* Today line */}
								{getTodayColumnIndex() !== -1 && (
									<div
										className={styles.timelineTodayLine}
										style={{ left: `${getTodayLinePosition()}px` }}
									/>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Hover Tooltip */}
			{hoveredTask && (
				<div
					className={styles.timelineTooltip}
					style={{ left: `${hoveredTask.x}px`, top: `${hoveredTask.y}px` }}
				>
					<div className={styles.timelineTooltipTitle}>{hoveredTask.task.title}</div>
					{hoveredTask.task.start_date && (
						<div className={styles.timelineTooltipRow}>
							<strong>Start:</strong> {formatTooltipDate(hoveredTask.task.start_date)}
						</div>
					)}
					{hoveredTask.task.due_date && (
						<div className={styles.timelineTooltipRow}>
							<strong>End:</strong> {formatTooltipDate(hoveredTask.task.due_date)}
						</div>
					)}
					<div className={styles.timelineTooltipRow}>
						<strong>Progress:</strong> {hoveredTask.task.progress || 0}%
					</div>
				</div>
			)}
		</div>
	);
};

export default TimelineView;