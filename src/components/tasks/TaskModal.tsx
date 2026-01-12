// src/components/tasks/TaskModal.tsx - UPDATED: Better UI/UX with blue headings and improved button placement
import React, { useState } from "react";
import Avatar from "@/components/ui/Avatar/Avatar";
import { Task, TaskComment, Column, AvailableUser } from "@/lib/task.types";
import {
	getDueDateStatus,
	getPriorityColor,
	getPriorityLabel,
	getSubtasks,
} from "@/utils/taskHelpers";
import { createServiceClient } from "@/utils/supabase/service-client";
import { useAuth } from "@/context/AuthContext";
import styles from "./TaskManager.module.css";

interface TaskModalProps {
	task: Task;
	availableUsers: AvailableUser[];
	loadingUsers: boolean;
	columns: Column[];
	setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
	allTasks: Task[];
	onClose: () => void;
}

const TaskModal: React.FC<TaskModalProps> = ({
	task,
	availableUsers,
	loadingUsers,
	columns,
	setColumns,
	allTasks,
	onClose,
}) => {
	const { user } = useAuth();
	const [isEditing, setIsEditing] = useState(false);
	const [editTask, setEditTask] = useState<Task>({ ...task });
	const [savingTask, setSavingTask] = useState(false);
	const [newComment, setNewComment] = useState("");
	const [addingComment, setAddingComment] = useState(false);
	const [selectedTask, setSelectedTask] = useState<Task>(task);

	// Admin check
	const isAdmin = () => {
		if (!user) return false;
		const adminEmployeeIds = ["51892", "admin", "21986"];
		const specialAdminIds = ["22119", "59976", "21701", "39426", "36639"];
		const adminRanks = ["SC - Section Chief", "MG - Manager"];
		return (
			adminEmployeeIds.includes(user.employee_id) ||
			specialAdminIds.includes(user.employee_id) ||
			(user.rank && adminRanks.includes(user.rank))
		);
	};

	// Handle task status update - FIXED: Use selectedTask instead of task prop
	const updateTaskStatus = async (newColumnId: string) => {
		const currentColumnId = columns.find((col) =>
			col.tasks.some((t) => t.id === selectedTask.id)
		)?.id;
		if (!currentColumnId || currentColumnId === newColumnId) return;

		try {
			const supabase = createServiceClient();
			const { error } = await supabase
				.from("tasks")
				.update({ status: newColumnId })
				.eq("id", selectedTask.id);
			if (error)
				console.error("Error updating task status in database:", error);

			setColumns((prevColumns) => {
				return prevColumns.map((column) => {
					if (column.id === currentColumnId) {
						const newTasks = column.tasks.filter(
							(t) => t.id !== selectedTask.id
						);
						return {
							...column,
							tasks: newTasks,
							count: newTasks.filter((t) => !t.parent_id).length,
						};
					}
					if (column.id === newColumnId) {
						const updatedTask = {
							...selectedTask,
							status: newColumnId as any,
							updated_at: new Date().toISOString(),
						};
						const newTasks = [...column.tasks, updatedTask];
						
						// FIXED: Update selectedTask and editTask to reflect new status
						setSelectedTask(updatedTask);
						setEditTask(updatedTask);
						
						return {
							...column,
							tasks: newTasks,
							count: newTasks.filter((t) => !t.parent_id).length,
						};
					}
					return column;
				});
			});

			// FIXED: Don't close modal - allow user to continue editing
			// onClose();
		} catch (error) {
			console.error("Error updating task status:", error);
		}
	};

	// Handle save edit
	const handleSaveEdit = async () => {
		try {
			setSavingTask(true);

			const updates = {
				title: editTask.title,
				description: editTask.description,
				priority: editTask.priority,
				task_type: editTask.task_type,
				parent_id: editTask.parent_id || null,
				start_date: editTask.start_date || null,
				progress: editTask.progress || 0,
				assignees: editTask.assignees,
				due_date: editTask.due_date,
			};

			const supabase = createServiceClient();
			const { error } = await supabase
				.from("tasks")
				.update(updates)
				.eq("id", selectedTask.id);
			if (error) throw error;

			const updatedTask = {
				...editTask,
				assigneeNames: editTask.assignees.map(
					(id) =>
						availableUsers.find((u) => u.id === id)?.full_name ||
						"Unknown User"
				),
				assigneeAvatars: editTask.assignees.map((id) => {
					const user = availableUsers.find((u) => u.id === id);
					return user ? user.employee_id : "";
				}),
				updated_at: new Date().toISOString(),
			};

			setColumns((prevColumns) =>
				prevColumns.map((column) => ({
					...column,
					tasks: column.tasks.map((task) =>
						task.id === selectedTask.id ? updatedTask : task
					),
				}))
			);

			setSelectedTask(updatedTask);
			setIsEditing(false);
		} catch (error) {
			console.error("Error updating task:", error);
			alert(
				"Failed to save changes: " +
					(error instanceof Error ? error.message : String(error))
			);
		} finally {
			setSavingTask(false);
		}
	};

	// Handle delete task
	const handleDeleteTask = async () => {
		if (!isAdmin()) return;
		if (
			!confirm(
				`Are you sure you want to delete the task "${selectedTask.title}"? This action cannot be undone.`
			)
		)
			return;

		try {
			setSavingTask(true);

			const supabase = createServiceClient();
			await supabase
				.from("task_comments")
				.delete()
				.eq("task_id", selectedTask.id);
			const { error: taskError } = await supabase
				.from("tasks")
				.delete()
				.eq("id", selectedTask.id);
			if (taskError) throw taskError;

			setColumns((prevColumns) =>
				prevColumns.map((column) => ({
					...column,
					tasks: column.tasks.filter(
						(task) => task.id !== selectedTask.id
					),
					count: column.tasks.filter(
						(task) => task.id !== selectedTask.id && !task.parent_id
					).length,
				}))
			);

			onClose();
		} catch (error) {
			console.error("Error deleting task:", error);
			alert(
				"Failed to delete task: " +
					(error instanceof Error ? error.message : String(error))
			);
		} finally {
			setSavingTask(false);
		}
	};

	// Handle add comment
	const handleAddComment = async () => {
		if (!newComment.trim()) return;

		try {
			setAddingComment(true);

			const commentData = {
				task_id: selectedTask.id,
				comment_text: newComment,
				author_id: user?.id,
				author_name: user?.full_name || "Current User",
			};

			const supabase = createServiceClient();
			const { data, error } = await supabase
				.from("task_comments")
				.insert([commentData])
				.select()
				.single();
			if (error) throw error;

			const comment: TaskComment = {
				id: data.id,
				task_id: data.task_id,
				comment_text: data.comment_text,
				author_id: data.author_id,
				author_name: data.author_name,
				created_at: data.created_at,
			};

			const updatedTask = {
				...selectedTask,
				comments: [...selectedTask.comments, comment],
			};
			setSelectedTask(updatedTask);

			setColumns((prevColumns) =>
				prevColumns.map((column) => ({
					...column,
					tasks: column.tasks.map((task) =>
						task.id === selectedTask.id ? updatedTask : task
					),
				}))
			);

			setNewComment("");
		} catch (error) {
			console.error("Error adding comment:", error);
			alert(
				"Error adding comment: " +
					(error instanceof Error ? error.message : String(error))
			);
		} finally {
			setAddingComment(false);
		}
	};

	// Toggle assignee
	const toggleAssignee = (userId: string) => {
		const currentAssignees = editTask.assignees || [];
		const newAssignees = currentAssignees.includes(userId)
			? currentAssignees.filter((id) => id !== userId)
			: [...currentAssignees, userId];

		setEditTask({
			...editTask,
			assignees: newAssignees,
			assigneeNames: newAssignees.map(
				(id) =>
					availableUsers.find((u) => u.id === id)?.full_name ||
					"Unknown User"
			),
			assigneeAvatars: newAssignees.map((id) => {
				const user = availableUsers.find((u) => u.id === id);
				return user ? user.employee_id : "";
			}),
		});
	};

	return (
		<div className={styles.modal} onClick={onClose}>
			<div
				className={styles.modalContent}
				onClick={(e) => e.stopPropagation()}
			>
				{/* UPDATED: Better header with blue title and improved button layout */}
				<div className={styles.modalHeader}>
					<div style={{ flex: 1, minWidth: 0 }}>
						{isEditing ? (
							<input
								className={styles.editTitle}
								value={editTask?.title || ""}
								onChange={(e) =>
									setEditTask((prev) =>
										prev
											? { ...prev, title: e.target.value }
											: prev
									)
								}
								placeholder="Enter task title..."
							/>
						) : (
							<h2 style={{ 
								margin: 0, 
								color: '#60a5fa',
								fontSize: '1.5rem',
								fontWeight: '700',
								textShadow: '0 2px 8px rgba(96, 165, 250, 0.3)'
							}}>
								{selectedTask.title}
							</h2>
						)}
					</div>
					
					{/* UPDATED: Better button placement - right side of header */}
					<div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '1rem' }}>
						{!isEditing ? (
							<>
								<button
									className={styles.editButton}
									onClick={() => setIsEditing(true)}
									style={{ minWidth: '80px' }}
								>
									✏️ Edit
								</button>
								{isAdmin() && (
									<button
										className={styles.deleteButton}
										onClick={handleDeleteTask}
										disabled={savingTask}
										style={{ minWidth: '80px' }}
									>
										{savingTask ? "..." : "🗑️ Delete"}
									</button>
								)}
							</>
						) : (
							<>
								<button
									className={styles.saveButton}
									onClick={handleSaveEdit}
									disabled={savingTask}
									style={{ minWidth: '80px' }}
								>
									{savingTask ? "..." : "💾 Save"}
								</button>
								<button
									className={styles.cancelButton}
									onClick={() => {
										setIsEditing(false);
										setEditTask({ ...selectedTask });
									}}
									disabled={savingTask}
									style={{ minWidth: '80px' }}
								>
									Cancel
								</button>
							</>
						)}
						<button
							className={styles.closeButton}
							onClick={onClose}
							style={{ 
								marginLeft: '0.5rem',
								fontSize: '1.75rem',
								padding: '0.25rem 0.5rem'
							}}
						>
							×
						</button>
					</div>
				</div>

				<div className={styles.modalBody}>
					<div className={styles.taskDetailInfo}>
						{/* Task Type */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Task Type:</span>
							{isEditing ? (
								<select
									value={editTask?.task_type || "main"}
									onChange={(e) =>
										setEditTask((prev) =>
											prev
												? {
														...prev,
														task_type: e.target
															.value as any,
												  }
												: prev
										)
									}
									style={{
										padding: '0.5rem',
										borderRadius: '0.375rem',
										border: '1px solid rgba(148, 163, 184, 0.2)',
										background: 'rgba(15, 23, 42, 0.6)',
										color: '#e2e8f0',
										fontSize: '0.875rem'
									}}
								>
									<option value="main">Main Task</option>
									<option value="subtask">Subtask</option>
								</select>
							) : (
								<span style={{ color: '#cbd5e1' }}>
									{selectedTask.task_type === "main"
										? "Main Task"
										: "Subtask"}
								</span>
							)}
						</div>

						{/* Status */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Status:</span>
							<div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
								{columns.map((column) => {
									const isActive = columns.find((col) =>
										col.tasks.some((t) => t.id === selectedTask.id)
									)?.id === column.id;
									
									return (
										<button
											key={column.id}
											onClick={() => updateTaskStatus(column.id)}
											style={{
												padding: '0.5rem 1rem',
												borderRadius: '0.375rem',
												border: isActive 
													? `2px solid ${column.color}` 
													: '1px solid rgba(148, 163, 184, 0.2)',
												background: isActive 
													? column.color 
													: 'rgba(51, 65, 85, 0.5)',
												color: isActive ? 'white' : '#cbd5e1',
												fontSize: '0.875rem',
												fontWeight: '600',
												cursor: 'pointer',
												transition: 'all 0.2s'
											}}
											onMouseEnter={(e) => {
												if (!isActive) {
													e.currentTarget.style.background = 'rgba(71, 85, 105, 0.7)';
												}
											}}
											onMouseLeave={(e) => {
												if (!isActive) {
													e.currentTarget.style.background = 'rgba(51, 65, 85, 0.5)';
												}
											}}
										>
											{column.title}
										</button>
									);
								})}
							</div>
						</div>

						{/* Priority */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Priority:</span>
							{isEditing ? (
								<select
									value={editTask?.priority || "medium"}
									onChange={(e) =>
										setEditTask((prev) =>
											prev
												? {
														...prev,
														priority: e.target
															.value as any,
												  }
												: prev
										)
									}
									style={{
										padding: '0.5rem',
										borderRadius: '0.375rem',
										border: '1px solid rgba(148, 163, 184, 0.2)',
										background: 'rgba(15, 23, 42, 0.6)',
										color: '#e2e8f0',
										fontSize: '0.875rem'
									}}
								>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
								</select>
							) : (
								<span
									style={{
										padding: '0.5rem 1rem',
										borderRadius: '0.375rem',
										background: getPriorityColor(selectedTask.priority),
										color: 'white',
										fontSize: '0.875rem',
										fontWeight: '600',
										display: 'inline-block'
									}}
								>
									{getPriorityLabel(selectedTask.priority)}
								</span>
							)}
						</div>

						{/* Progress */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Progress:</span>
							{isEditing ? (
								<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
									<input
										type="range"
										min="0"
										max="100"
										value={editTask?.progress || 0}
										onChange={(e) =>
											setEditTask((prev) =>
												prev
													? {
															...prev,
															progress: parseInt(
																e.target.value
															),
													  }
													: prev
											)
										}
										style={{ flex: 1 }}
									/>
									<span style={{ 
										color: '#60a5fa', 
										fontWeight: '600', 
										minWidth: '50px',
										fontSize: '1rem'
									}}>
										{editTask?.progress || 0}%
									</span>
								</div>
							) : (
								<div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
									<div style={{
										flex: 1,
										height: '0.75rem',
										background: 'rgba(51, 65, 85, 0.5)',
										borderRadius: '0.5rem',
										overflow: 'hidden',
										border: '1px solid rgba(148, 163, 184, 0.2)'
									}}>
										<div style={{
											height: '100%',
											width: `${selectedTask.progress || 0}%`,
											background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
											transition: 'width 0.3s ease',
											boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
										}} />
									</div>
									<span style={{ 
										color: '#10b981', 
										fontWeight: '700', 
										minWidth: '50px',
										fontSize: '1rem'
									}}>
										{selectedTask.progress || 0}%
									</span>
								</div>
							)}
						</div>

						{/* Date Range */}
						<div className={styles.formRow} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
							<div className={styles.taskDetailRow}>
								<span className={styles.label}>Start Date:</span>
								{isEditing ? (
									<input
										type="date"
										value={editTask?.start_date || ""}
										onChange={(e) =>
											setEditTask((prev) =>
												prev
													? {
															...prev,
															start_date:
																e.target.value,
													  }
													: prev
											)
										}
										style={{
											padding: '0.5rem',
											borderRadius: '0.375rem',
											border: '1px solid rgba(148, 163, 184, 0.2)',
											background: 'rgba(15, 23, 42, 0.6)',
											color: '#e2e8f0',
											fontSize: '0.875rem',
											colorScheme: 'dark'
										}}
									/>
								) : (
									<span style={{ color: '#cbd5e1' }}>
										{selectedTask.start_date
											? new Date(
													selectedTask.start_date
											  ).toLocaleDateString()
											: "Not set"}
									</span>
								)}
							</div>

							<div className={styles.taskDetailRow}>
								<span className={styles.label}>Due Date:</span>
								{isEditing ? (
									<input
										type="date"
										value={editTask?.due_date || ""}
										onChange={(e) =>
											setEditTask((prev) =>
												prev
													? {
															...prev,
															due_date: e.target.value,
													  }
													: prev
											)
										}
										style={{
											padding: '0.5rem',
											borderRadius: '0.375rem',
											border: '1px solid rgba(148, 163, 184, 0.2)',
											background: 'rgba(15, 23, 42, 0.6)',
											color: '#e2e8f0',
											fontSize: '0.875rem',
											colorScheme: 'dark'
										}}
									/>
								) : selectedTask.due_date ? (
									<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
										<span style={{ color: '#cbd5e1' }}>
											{new Date(
												selectedTask.due_date
											).toLocaleDateString()}
										</span>
										<span
											style={{
												padding: '0.25rem 0.5rem',
												borderRadius: '0.25rem',
												background: getDueDateStatus(
													selectedTask.due_date
												).color,
												color: 'white',
												fontSize: '0.75rem',
												fontWeight: '600'
											}}
										>
											{
												getDueDateStatus(
													selectedTask.due_date
												).text
											}
										</span>
									</div>
								) : (
									<span style={{ color: '#64748b', fontStyle: 'italic' }}>
										No due date set
									</span>
								)}
							</div>
						</div>

						{/* Assignees */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Assignees:</span>
							{isEditing ? (
								loadingUsers ? (
									<div style={{ color: '#94a3b8' }}>Loading users...</div>
								) : availableUsers.length === 0 ? (
									<div style={{ color: '#94a3b8' }}>No users available</div>
								) : (
									<div className={styles.assigneeList}>
										{availableUsers.map((user) => (
											<label
												key={user.id}
												className={styles.assigneeOption}
											>
												<input
													type="checkbox"
													checked={
														editTask?.assignees?.includes(
															user.id
														) || false
													}
													onChange={() =>
														toggleAssignee(user.id)
													}
												/>
												<span
													className={
														styles.userAvatar
													}
												>
													<Avatar
														employeeId={
															user.employee_id
														}
														fullName={
															user.full_name
														}
														size="small"
													/>
												</span>
												<div
													className={styles.userInfo}
												>
													<span
														className={
															styles.userName
														}
													>
														{user.full_name}
													</span>
													<span
														className={
															styles.userDetails
														}
													>
														{user.employee_id} •{" "}
														{user.base} •{" "}
														{user.rank?.split(
															" - "
														)[0] || "FI"}
													</span>
												</div>
											</label>
										))}
									</div>
								)
							) : (
								<div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
									{selectedTask.assigneeNames?.map(
										(name, index) => {
											const employeeId =
												selectedTask.assigneeAvatars?.[
													index
												] || "";
											return (
												<div
													key={index}
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: '0.5rem',
														background: 'rgba(51, 65, 85, 0.5)',
														padding: '0.5rem 0.75rem',
														borderRadius: '0.5rem',
														border: '1px solid rgba(148, 163, 184, 0.2)'
													}}
												>
													<Avatar
														employeeId={
															employeeId
														}
														fullName={name}
														size="small"
													/>
													<span style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>{name}</span>
												</div>
											);
										}
									)}
								</div>
							)}
						</div>

						{/* Subtasks */}
						{!isEditing &&
							getSubtasks(allTasks, selectedTask.id).length >
								0 && (
								<div className={styles.taskDetailRow}>
									<span className={styles.label}>
										Subtasks:
									</span>
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "0.5rem",
										}}
									>
										{getSubtasks(
											allTasks,
											selectedTask.id
										)
										.sort((a, b) => {
											// Sort by start_date: oldest first, newest at bottom
											if (!a.start_date && !b.start_date) return 0;
											if (!a.start_date) return 1; // Tasks without dates go to bottom
											if (!b.start_date) return -1;
											return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
										})
										.map((subtask) => (
											<div
												key={subtask.id}
												style={{
													display: "flex",
													alignItems: "center",
													gap: "0.75rem",
													padding: "0.75rem",
													background: "rgba(51, 65, 85, 0.5)",
													borderRadius: "0.5rem",
													cursor: "pointer",
													transition: "all 0.2s",
													border: "1px solid rgba(148, 163, 184, 0.2)",
												}}
												onClick={(e) => {
													e.stopPropagation();
													const updatedSubtask =
														allTasks.find(
															(t) =>
																t.id ===
																subtask.id
														) || subtask;
													setSelectedTask(
														updatedSubtask
													);
													setEditTask({
														...updatedSubtask,
													});
												}}
												onMouseEnter={(e) => {
													e.currentTarget.style.background =
														"rgba(71, 85, 105, 0.7)";
													e.currentTarget.style.borderColor =
														"rgba(148, 163, 184, 0.3)";
												}}
												onMouseLeave={(e) => {
													e.currentTarget.style.background =
														"rgba(51, 65, 85, 0.5)";
													e.currentTarget.style.borderColor =
														"rgba(148, 163, 184, 0.2)";
												}}
											>
												<div style={{ flex: 1 }}>
													<div
														style={{
															fontWeight: "500",
															fontSize:
																"0.875rem",
															color: "#e2e8f0",
														}}
													>
														{subtask.title}
													</div>
													<div
														style={{
															fontSize: "0.75rem",
															color: "#94a3b8",
														}}
													>
														{subtask.progress || 0}%
														complete • Due:{" "}
														{subtask.due_date
															? new Date(
																	subtask.due_date
															  ).toLocaleDateString()
															: "Not set"}
													</div>
												</div>
												<div
													style={{
														background: "rgba(51, 65, 85, 0.7)",
														borderRadius: "0.75rem",
														height: "0.5rem",
														width: "4rem",
														overflow: 'hidden'
													}}
												>
													<div
														style={{
															background:
																"#10b981",
															height: "0.5rem",
															borderRadius:
																"0.75rem",
															width: `${
																subtask.progress ||
																0
															}%`,
														}}
													/>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

						{/* Description */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Description:</span>
							{isEditing ? (
								<textarea
									value={editTask?.description || ""}
									onChange={(e) =>
										setEditTask((prev) =>
											prev
												? {
														...prev,
														description:
															e.target.value,
												  }
												: prev
										)
									}
									placeholder="Enter task description..."
									rows={4}
									style={{
										width: '100%',
										padding: '0.75rem',
										borderRadius: '0.5rem',
										border: '1px solid rgba(148, 163, 184, 0.2)',
										background: 'rgba(15, 23, 42, 0.6)',
										color: '#e2e8f0',
										fontSize: '0.875rem',
										resize: 'vertical',
										fontFamily: 'inherit'
									}}
								/>
							) : (
								<p style={{ color: '#cbd5e1', lineHeight: '1.6', margin: 0 }}>
									{selectedTask.description || "No description provided"}
								</p>
							)}
						</div>
					</div>

					{/* Comments Section */}
					<div className={styles.commentsSection}>
						<h3 style={{ 
							color: '#60a5fa', 
							fontSize: '1.125rem',
							fontWeight: '700',
							marginBottom: '1rem',
							textShadow: '0 2px 8px rgba(96, 165, 250, 0.3)'
						}}>
							Comments ({selectedTask.comments.length})
						</h3>

						<div className={styles.addComment}>
							<textarea
								value={newComment}
								onChange={(e) => setNewComment(e.target.value)}
								placeholder="Add a comment..."
								rows={3}
								className={styles.commentTextarea}
								disabled={addingComment}
							/>
							<div className={styles.commentActions}>
								<button
									className={styles.addCommentButton}
									onClick={handleAddComment}
									disabled={
										!newComment.trim() || addingComment
									}
								>
									{addingComment
										? "Adding..."
										: "💬 Add Comment"}
								</button>
							</div>
						</div>

						<div className={styles.commentsList}>
							{selectedTask.comments.map((comment) => (
								<div
									key={comment.id}
									className={styles.comment}
								>
									<div className={styles.commentHeader}>
										<strong style={{ color: '#e2e8f0' }}>{comment.author_name}</strong>
										<span className={styles.commentDate}>
											{new Date(
												comment.created_at
											).toLocaleDateString()}
										</span>
									</div>
									<p className={styles.commentText}>
										{comment.comment_text}
									</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default TaskModal;