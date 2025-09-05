// src/components/tasks/TimelineView.tsx - FIXED: Proper scrolling and synchronization
import React, { useState, useRef } from "react";
import Avatar from "@/components/ui/Avatar/Avatar";
import TimelineControls from "./TimelineControls";
import { Task } from "@/lib/task.types";
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
	"#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
	"#84cc16", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#8b5a2b",
	"#7c3aed", "#059669", "#dc2626", "#c2410c", "#9333ea", "#0891b2",
];

const TimelineView: React.FC<TimelineViewProps> = ({ tasks, onTaskClick, refreshTasks }) => {
	const {
		zoomLevel,
		setZoomLevel,
		viewStartDate,
		setViewStartDate,
		dateRange,
		getTaskPosition,
	} = useTimeline();

	// Refs for scroll synchronization - FIXED: Only need one ref for the scrollable container
	const timelineScrollRef = useRef<HTMLDivElement>(null);

	// Drag and drop state for subtask reordering
	const [draggedSubtask, setDraggedSubtask] = useState<Task | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const [dragOverParentId, setDragOverParentId] = useState<string | null>(null);

	// Get parent tasks
	const parentTasks = tasks.filter((task) => !task.parent_id);

	// Color functions
	const getTaskColor = (taskId: string) => {
		let hash = 0;
		for (let i = 0; i < taskId.length; i++) {
			const char = taskId.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		const index = Math.abs(hash) % TASK_COLOR_PALETTE.length;
		return TASK_COLOR_PALETTE[index];
	};

	const getDarkerColor = (color: string, factor: number = 0.4) => {
		const hex = color.replace("#", "");
		const r = parseInt(hex.substr(0, 2), 16);
		const g = parseInt(hex.substr(2, 2), 16);
		const b = parseInt(hex.substr(4, 2), 16);

		const darkerR = Math.floor(r * (1 - factor));
		const darkerG = Math.floor(g * (1 - factor));
		const darkerB = Math.floor(b * (1 - factor));

		return `rgb(${darkerR}, ${darkerG}, ${darkerB})`;
	};

	// Dynamic column width calculation
	const getColumnWidth = () => {
		switch (zoomLevel) {
			case "days": return 80;
			case "weeks": return 100;
			case "months": return 120;
			case "quarters": return 150;
			default: return 80;
		}
	};

	const columnWidth = getColumnWidth();

	// FIXED: Better today line positioning
	const getTodayLinePosition = () => {
		const today = new Date();
		if (!dateRange || dateRange.length === 0) return 0;
		
		const firstDate = dateRange[0];
		
		switch (zoomLevel) {
			case "days":
				const daysDiff = (today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
				const hourProgress = today.getHours() / 24;
				return (daysDiff + hourProgress) * columnWidth;
			case "weeks":
				const weeksDiff = (today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
				return weeksDiff * columnWidth;
			case "months":
				const monthsDiff = (today.getFullYear() - firstDate.getFullYear()) * 12 + (today.getMonth() - firstDate.getMonth());
				const dayOfMonth = today.getDate();
				const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
				const dayProgress = dayOfMonth / daysInMonth;
				return (monthsDiff + dayProgress) * columnWidth;
			case "quarters":
				const quartersDiff = Math.floor(((today.getFullYear() - firstDate.getFullYear()) * 12 + (today.getMonth() - firstDate.getMonth())) / 3);
				return quartersDiff * columnWidth;
			default:
				return 0;
		}
	};

	// Enhanced today indicator functions
	const getTodayColumnIndex = () => {
		const today = new Date();
		switch (zoomLevel) {
			case "days":
				return dateRange.findIndex((date) => date.toDateString() === today.toDateString());
			case "weeks":
				return dateRange.findIndex((date) => {
					const weekStart = new Date(date);
					const weekEnd = new Date(date);
					weekEnd.setDate(date.getDate() + 6);
					return today >= weekStart && today <= weekEnd;
				});
			case "months":
				return dateRange.findIndex((date) =>
					date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
				);
			case "quarters":
				return dateRange.findIndex((date) => {
					const quarter = Math.floor(date.getMonth() / 3);
					const todayQuarter = Math.floor(today.getMonth() / 3);
					return quarter === todayQuarter && date.getFullYear() === today.getFullYear();
				});
			default:
				return -1;
		}
	};

	// FIXED: Helper function to get ordered subtasks
	const getOrderedSubtasks = (parentId: string): Task[] => {
		const subtasks = getSubtasks(tasks, parentId);
		return subtasks.sort((a, b) => {
			// If both have sort_order, use that
			if (a.sort_order !== null && a.sort_order !== undefined && 
				b.sort_order !== null && b.sort_order !== undefined) {
				return a.sort_order - b.sort_order;
			}
			// Otherwise, sort by created_at (earliest first)
			return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
		});
	};

	// FIXED: Drag and drop handlers
	const handleSubtaskDragStart = (e: React.DragEvent, subtask: Task) => {
		setDraggedSubtask(subtask);
		setDragOverParentId(subtask.parent_id || null);
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", "");
	};

	const handleSubtaskDragOver = (e: React.DragEvent, index: number, parentId: string) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		
		if (draggedSubtask?.parent_id === parentId) {
			setDragOverIndex(index);
			setDragOverParentId(parentId);
		}
	};

	const handleSubtaskDragLeave = () => {
		setDragOverIndex(null);
	};

	const handleSubtaskDrop = async (e: React.DragEvent, targetIndex: number, parentId: string) => {
		e.preventDefault();
		if (!draggedSubtask || draggedSubtask.parent_id !== parentId) return;

		const subtasks = getOrderedSubtasks(parentId);
		const currentIndex = subtasks.findIndex((t) => t.id === draggedSubtask.id);

		if (currentIndex === targetIndex) {
			setDraggedSubtask(null);
			setDragOverIndex(null);
			setDragOverParentId(null);
			return;
		}

		// Reorder the subtasks array
		const reorderedSubtasks = [...subtasks];
		const [movedTask] = reorderedSubtasks.splice(currentIndex, 1);
		reorderedSubtasks.splice(targetIndex, 0, movedTask);

		// Update order in database
		try {
			const supabase = createServiceClient();

			// Update sort_order for all affected subtasks
			const updates = reorderedSubtasks.map((task, index) => 
				supabase
					.from("tasks")
					.update({ sort_order: index })
					.eq("id", task.id)
			);

			await Promise.all(updates);
			console.log('Successfully updated subtask order');
			
			if (refreshTasks) {
				refreshTasks();
			}
		} catch (error) {
			console.error("Error reordering subtasks:", error);
		}

		setDraggedSubtask(null);
		setDragOverIndex(null);
		setDragOverParentId(null);
	};

	// Navigation functions
	const navigatePrevious = () => {
		const newDate = new Date(viewStartDate);
		switch (zoomLevel) {
			case "days": newDate.setDate(newDate.getDate() - 7); break;
			case "weeks": newDate.setDate(newDate.getDate() - 28); break;
			case "months": newDate.setMonth(newDate.getMonth() - 3); break;
			case "quarters": newDate.setFullYear(newDate.getFullYear() - 1); break;
		}
		setViewStartDate(newDate);
	};

	const navigateNext = () => {
		const newDate = new Date(viewStartDate);
		switch (zoomLevel) {
			case "days": newDate.setDate(newDate.getDate() + 7); break;
			case "weeks": newDate.setDate(newDate.getDate() + 28); break;
			case "months": newDate.setMonth(newDate.getMonth() + 3); break;
			case "quarters": newDate.setFullYear(newDate.getFullYear() + 1); break;
		}
		setViewStartDate(newDate);
	};

	const goToToday = () => {
		const today = new Date();
		switch (zoomLevel) {
			case "days": today.setDate(today.getDate() - 7); break;
			case "weeks": today.setDate(today.getDate() - 14); break;
			case "months": today.setMonth(today.getMonth() - 3); break;
			case "quarters": today.setMonth(today.getMonth() - 6); break;
		}
		setViewStartDate(today);
	};

	// Format date labels
	const formatDateLabel = (date: Date) => {
		switch (zoomLevel) {
			case "days":
				return (
					<div>
						<div>{date.getDate()}</div>
						<div style={{ fontSize: "0.625rem" }}>
							{date.toLocaleDateString("en-US", { month: "short" })}
						</div>
						<div style={{ fontSize: "0.5rem", color: "#9ca3af" }}>
							{date.toLocaleDateString("en-US", { weekday: "short" })}
						</div>
					</div>
				);
			case "weeks":
				return (
					<div>
						<div>W{Math.ceil(date.getDate() / 7)}</div>
						<div style={{ fontSize: "0.625rem" }}>
							{date.toLocaleDateString("en-US", { month: "short" })}
						</div>
					</div>
				);
			case "months":
				return (
					<div>
						<div>{date.toLocaleDateString("en-US", { month: "short" })}</div>
						<div style={{ fontSize: "0.625rem" }}>{date.getFullYear()}</div>
					</div>
				);
			case "quarters":
				const quarter = Math.floor(date.getMonth() / 3) + 1;
				return (
					<div>
						<div>Q{quarter}</div>
						<div style={{ fontSize: "0.625rem" }}>{date.getFullYear()}</div>
					</div>
				);
			default:
				return <div>{date.getDate()}</div>;
		}
	};

	const totalContentWidth = dateRange.length * columnWidth;

	return (
		<div className="timeline-view" style={{
			background: "white",
			borderRadius: "0.5rem",
			margin: "1rem",
			overflow: "hidden",
		}}>
			<TimelineControls
				zoomLevel={zoomLevel}
				setZoomLevel={setZoomLevel}
				onNavigatePrevious={navigatePrevious}
				onNavigateNext={navigateNext}
				onGoToToday={goToToday}
				taskCount={parentTasks.length}
			/>

			{/* FIXED: Timeline Container - Grouped with proper scrolling */}
			<div className="timeline-container" style={{ 
				display: "flex", 
				borderBottom: "2px solid #e5e7eb", 
				height: "calc(100vh - 200px)" 
			}}>
				
				{/* Fixed Left Panel */}
				<div className="timeline-left-panel" style={{ 
					width: "400px", 
					minWidth: "400px",
					background: "#f9fafb",
					borderRight: "2px solid #e5e7eb",
					display: "flex",
					flexDirection: "column"
				}}>
					{/* Fixed Header */}
					<div className="timeline-left-header" style={{ 
						padding: "1rem",
						borderBottom: "1px solid #e5e7eb",
						background: "#f9fafb",
						display: "flex",
						alignItems: "center",
						fontSize: "0.875rem",
						fontWeight: "600",
						color: "#374151",
						minHeight: "60px"
					}}>
						<div style={{ width: "50px" }}>ID</div>
						<div style={{ flex: 1 }}>Task name</div>
						<div style={{ width: "80px" }}>Assigned</div>
						<div style={{ width: "80px" }}>Progress</div>
					</div>

					{/* Scrollable Task List */}
					<div className="timeline-task-list" style={{ flex: 1, overflowY: "auto" }}>
						{parentTasks.map((task, taskIndex) => {
							const subtasks = getOrderedSubtasks(task.id);
							
							return (
								<div key={task.id}>
									{/* Parent Task Row */}
									<div style={{ 
										padding: "0.75rem", 
										borderBottom: "1px solid #f3f4f6",
										backgroundColor: taskIndex % 2 === 0 ? "#fff" : "#fafbfc",
										display: "flex",
										alignItems: "center",
										minHeight: "60px"
									}}>
										<div style={{ width: "50px", fontSize: "0.75rem", color: "#6b7280" }}>
											{taskIndex + 1}
										</div>
										<div style={{ flex: 1, display: "flex", alignItems: "center", gap: "0.5rem" }}>
											<div>
												<div style={{ 
													fontWeight: "600", 
													fontSize: "0.875rem",
													color: "#1f2937",
													cursor: "pointer"
												}} onClick={() => onTaskClick(task)}>
													{task.title}
												</div>
												{subtasks.length > 0 && (
													<div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
														{subtasks.length} subtask{subtasks.length !== 1 ? "s" : ""}
													</div>
												)}
											</div>
										</div>
										<div style={{ width: "80px", display: "flex", marginLeft: "0.5rem" }}>
											{task.assigneeAvatars?.slice(0, 2).map((employeeId, index) => (
												<div key={index} style={{ 
													width: "1.5rem", 
													height: "1.5rem", 
													borderRadius: "50%", 
													overflow: "hidden",
													marginLeft: index > 0 ? "-0.25rem" : 0,
													border: "1px solid white"
												}}>
													<Avatar employeeId={employeeId} fullName={task.assigneeNames?.[index] || "Unknown"} size="small" />
												</div>
											))}
											{task.assigneeAvatars && task.assigneeAvatars.length > 2 && (
												<div style={{
													width: "1.5rem", height: "1.5rem", borderRadius: "50%",
													background: "#f3f4f6", marginLeft: "-0.25rem",
													display: "flex", alignItems: "center", justifyContent: "center",
													fontSize: "0.625rem", color: "#6b7280", border: "1px solid white"
												}}>
													+{task.assigneeAvatars.length - 2}
												</div>
											)}
										</div>
										<div style={{ width: "80px", fontSize: "0.75rem", color: "#6b7280", textAlign: "center" }}>
											{task.progress || 0}%
										</div>
									</div>
									
									{/* Subtask Rows */}
									{subtasks.map((subtask, subtaskIndex) => {
										const isDragOver = dragOverIndex === subtaskIndex && dragOverParentId === task.id;
										const isDragging = draggedSubtask?.id === subtask.id;
										
										return (
											<div 
												key={subtask.id} 
												style={{ 
													padding: "0.75rem",
													borderBottom: "1px solid #f3f4f6",
													backgroundColor: isDragging ? "#fef3c7" : isDragOver ? "#e5e7eb" : "#f8fafc",
													opacity: isDragging ? 0.5 : 1,
													transition: "all 0.2s",
													position: "relative",
													display: "flex",
													alignItems: "center",
													minHeight: "60px"
												}}
												draggable
												onDragStart={(e) => handleSubtaskDragStart(e, subtask)}
												onDragOver={(e) => handleSubtaskDragOver(e, subtaskIndex, task.id)}
												onDragLeave={handleSubtaskDragLeave}
												onDrop={(e) => handleSubtaskDrop(e, subtaskIndex, task.id)}
											>
												{/* Drag indicator */}
												{isDragOver && (
													<div style={{
														position: "absolute", top: 0, left: 0, right: 0, height: "2px",
														background: "#3b82f6", zIndex: 10
													}} />
												)}
												
												{/* Drag handle */}
												<div style={{
													width: "20px", display: "flex", alignItems: "center", justifyContent: "center",
													cursor: "grab", color: "#9ca3af", fontSize: "12px"
												}}>
													⋮⋮
												</div>
												
												<div style={{ width: "30px", fontSize: "0.75rem", color: "#6b7280" }}>
													{taskIndex + 1}.{subtaskIndex + 1}
												</div>
												<div style={{ flex: 1, paddingLeft: "2rem", position: "relative" }}>
													{/* Hierarchy connectors */}
													<div style={{
														position: "absolute", left: "0.75rem", top: "50%", width: "1rem", height: "1px",
														background: "#d1d5db", transform: "translateY(-50%)"
													}} />
													<div style={{
														position: "absolute", left: "0.75rem", top: 0, width: "1px", height: "50%",
														background: "#d1d5db"
													}} />
													
													<div style={{ 
														fontWeight: "500", fontSize: "0.875rem", color: "#374151",
														cursor: "pointer", paddingLeft: "0.5rem"
													}} onClick={() => onTaskClick(subtask)}>
														{subtask.title}
													</div>
												</div>
												<div style={{ width: "80px", display: "flex", marginLeft: "0.5rem" }}>
													{subtask.assigneeAvatars?.slice(0, 2).map((employeeId, index) => (
														<div key={index} style={{ 
															width: "1.5rem", height: "1.5rem", borderRadius: "50%", overflow: "hidden",
															marginLeft: index > 0 ? "-0.25rem" : 0, border: "1px solid white"
														}}>
															<Avatar employeeId={employeeId} fullName={subtask.assigneeNames?.[index] || "Unknown"} size="small" />
														</div>
													))}
												</div>
												<div style={{ width: "80px", fontSize: "0.75rem", color: "#6b7280", textAlign: "center" }}>
													{subtask.progress || 0}%
												</div>
											</div>
										);
									})}
								</div>
							);
						})}
						
						{parentTasks.length === 0 && (
							<div style={{ padding: "3rem", textAlign: "center", color: "#6b7280" }}>
								<h3>No Tasks Available</h3>
								<p>Create tasks with start and due dates to see them in timeline view.</p>
							</div>
						)}
					</div>
				</div>
				
				{/* FIXED: Grouped Timeline Panel with proper scrolling */}
				<div className="timeline-right-panel" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
					
					{/* FIXED: Single scrollable container for both header and body */}
					<div 
						className="timeline-scroll-container"
						ref={timelineScrollRef}
						style={{ 
							flex: 1,
							overflowX: "auto",
							overflowY: "auto",
							position: "relative"
						}}
					>
						{/* FIXED: Combined content that scrolls together */}
						<div className="timeline-content" style={{ minWidth: `${totalContentWidth}px` }}>
							
							{/* Timeline Header */}
							<div className="timeline-header" style={{ 
								display: "flex", 
								background: "#f9fafb", 
								borderBottom: "1px solid #e5e7eb",
								position: "sticky",
								top: 0,
								zIndex: 10,
								minHeight: "60px"
							}}>
								{dateRange.map((date, index) => {
									const todayColumnIndex = getTodayColumnIndex();
									const isToday = index === todayColumnIndex;
									const isWeekend = zoomLevel === "days" && (date.getDay() === 0 || date.getDay() === 6);
									
									return (
										<div key={index} style={{
											minWidth: `${columnWidth}px`,
											width: `${columnWidth}px`,
											padding: "0.5rem 0.25rem",
											textAlign: "center",
											fontSize: "0.75rem",
											borderRight: "1px solid #e5e7eb",
											background: isWeekend ? "#f3f4f6" : "transparent",
											color: isToday ? "#ef4444" : isWeekend ? "#9ca3af" : "#6b7280",
											fontWeight: isToday ? "700" : "400"
										}}>
											{formatDateLabel(date)}
										</div>
									);
								})}
								
								{/* Today line in header */}
								{getTodayColumnIndex() !== -1 && (
									<div style={{
										position: "absolute", top: 0, bottom: 0,
										left: `${getTodayLinePosition()}px`,
										width: "2px", background: "#ef4444", zIndex: 15, pointerEvents: "none"
									}} />
								)}
							</div>
							
							{/* Timeline Body */}
							<div className="timeline-body" style={{ position: "relative" }}>
								{parentTasks.map((task, taskIndex) => {
									const subtasks = getOrderedSubtasks(task.id);
									const taskColor = getTaskColor(task.id);
									
									return (
										<div key={task.id}>
											{/* Parent Task Timeline Bar */}
											<div style={{ 
												minHeight: "60px", 
												borderBottom: "1px solid #f3f4f6",
												backgroundColor: taskIndex % 2 === 0 ? "#fff" : "#fafbfc",
												position: "relative",
												display: "flex",
												alignItems: "center"
											}}>
												{task.start_date && task.due_date && (
													<div style={{
														position: "absolute", top: "50%", transform: "translateY(-50%)",
														height: "1.75rem", background: taskColor, borderRadius: "0.25rem",
														display: "flex", alignItems: "center", paddingLeft: "0.5rem",
														color: "white", fontSize: "0.75rem", fontWeight: "500",
														cursor: "pointer", minWidth: "100px",
														...getTaskPosition(task.start_date, task.due_date)
													}} onClick={() => onTaskClick(task)}>
														<div style={{ 
															position: "absolute", left: 0, top: 0, bottom: 0,
															width: `${task.progress || 0}%`,
															background: getDarkerColor(taskColor),
															borderRadius: "0.25rem", transition: "width 0.3s ease"
														}} />
														
														<span style={{ position: "relative", zIndex: 1 }}>
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
														minHeight: "60px", borderBottom: "1px solid #f3f4f6",
														backgroundColor: "#f8fafc", position: "relative",
														display: "flex", alignItems: "center"
													}}>
														{subtask.start_date && subtask.due_date && (
															<div style={{
																position: "absolute", top: "50%", transform: "translateY(-50%)",
																height: "1.5rem", background: subtaskColor, borderRadius: "0.25rem",
																display: "flex", alignItems: "center", paddingLeft: "0.5rem",
																color: "white", fontSize: "0.75rem", fontWeight: "400",
																cursor: "pointer", opacity: 0.9, minWidth: "100px",
																...getTaskPosition(subtask.start_date, subtask.due_date)
															}} onClick={() => onTaskClick(subtask)}>
																<div style={{ 
																	position: "absolute", left: 0, top: 0, bottom: 0,
																	width: `${subtask.progress || 0}%`,
																	background: getDarkerColor(subtaskColor),
																	borderRadius: "0.25rem", transition: "width 0.3s ease"
																}} />
																
																<span style={{ position: "relative", zIndex: 1 }}>
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
								
								{/* Today line extends through body */}
								{getTodayColumnIndex() !== -1 && (
									<div style={{
										position: "absolute", top: 0, bottom: 0,
										left: `${getTodayLinePosition()}px`,
										width: "2px", background: "#ef4444", zIndex: 5, pointerEvents: "none"
									}} />
								)}
							</div>
							
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TimelineView;