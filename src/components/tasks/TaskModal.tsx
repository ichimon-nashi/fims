// src/components/tasks/TaskModal.tsx
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

	// Handle task status update
	const updateTaskStatus = async (newColumnId: string) => {
		const currentColumnId = columns.find((col) =>
			col.tasks.some((t) => t.id === task.id)
		)?.id;
		if (!currentColumnId || currentColumnId === newColumnId) return;

		try {
			const supabase = createServiceClient();
			const { error } = await supabase
				.from("tasks")
				.update({ status: newColumnId })
				.eq("id", task.id);
			if (error)
				console.error("Error updating task status in database:", error);

			setColumns((prevColumns) => {
				return prevColumns.map((column) => {
					if (column.id === currentColumnId) {
						const newTasks = column.tasks.filter(
							(t) => t.id !== task.id
						);
						return {
							...column,
							tasks: newTasks,
							count: newTasks.filter((t) => !t.parent_id).length,
						};
					}
					if (column.id === newColumnId) {
						const updatedTask = {
							...task,
							status: newColumnId as any,
							updated_at: new Date().toISOString(),
						};
						const newTasks = [...column.tasks, updatedTask];
						return {
							...column,
							tasks: newTasks,
							count: newTasks.filter((t) => !t.parent_id).length,
						};
					}
					return column;
				});
			});

			onClose();
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
				<div className={styles.modalHeader}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
						}}
					>
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
							<h2>{selectedTask.title}</h2>
						)}
					</div>
					<div className={styles.headerActions}>
						{!isEditing ? (
							<>
								<button
									className={styles.editButton}
									onClick={() => setIsEditing(true)}
								>
									Edit
								</button>
								{isAdmin() && (
									<button
										className={styles.deleteButton}
										onClick={handleDeleteTask}
										disabled={savingTask}
									>
										{savingTask ? "Deleting..." : "Delete"}
									</button>
								)}
							</>
						) : (
							<div className={styles.editActions}>
								<button
									className={styles.saveButton}
									onClick={handleSaveEdit}
									disabled={savingTask}
								>
									{savingTask ? "Saving..." : "Save"}
								</button>
								<button
									className={styles.cancelButton}
									onClick={() => setIsEditing(false)}
									disabled={savingTask}
								>
									Cancel
								</button>
							</div>
						)}
						<button
							className={styles.closeButton}
							onClick={onClose}
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
									className={styles.editSelect}
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
								>
									<option value="main">Main Task</option>
									<option value="subtask">Subtask</option>
								</select>
							) : (
								<span>
									{selectedTask.task_type === "main"
										? "Main Task"
										: "Subtask"}
								</span>
							)}
						</div>

						{/* Status */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Status:</span>
							<div className={styles.statusButtons}>
								{columns.map((column) => (
									<button
										key={column.id}
										className={`${styles.statusButton} ${
											columns.find((col) =>
												col.tasks.some(
													(t) =>
														t.id === selectedTask.id
												)
											)?.id === column.id
												? styles.active
												: ""
										}`}
										style={
											{
												borderColor: column.color,
												"--border-color": column.color,
											} as React.CSSProperties
										}
										onClick={() =>
											updateTaskStatus(column.id)
										}
										disabled={isEditing}
									>
										{column.title}
									</button>
								))}
							</div>
						</div>

						{/* Parent Task Selection (only for subtasks) - Show in both edit and add modes */}
						{((isEditing && editTask?.task_type === "subtask") ||
							(!isEditing &&
								selectedTask.task_type === "subtask")) && (
							<div className={styles.taskDetailRow}>
								<span className={styles.label}>
									Parent Task:
								</span>
								{isEditing ? (
									<select
										className={styles.editSelect}
										value={editTask?.parent_id || ""}
										onChange={(e) =>
											setEditTask((prev) =>
												prev
													? {
															...prev,
															parent_id:
																e.target.value,
													  }
													: prev
											)
										}
									>
										<option value="">
											Select Parent Task
										</option>
										{allTasks
											.filter(
												(t) =>
													t.task_type === "main" &&
													t.id !== editTask?.id
											)
											.map((task) => (
												<option
													key={task.id}
													value={task.id}
												>
													{task.title}
												</option>
											))}
									</select>
								) : (
									<span>
										{selectedTask.parent_id
											? allTasks.find(
													(t) =>
														t.id ===
														selectedTask.parent_id
											  )?.title || "Unknown Parent"
											: "No parent selected"}
									</span>
								)}
							</div>
						)}

						{/* Priority */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Priority:</span>
							{isEditing ? (
								<select
									className={styles.editSelect}
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
								>
									<option value="low">Low</option>
									<option value="medium">Medium</option>
									<option value="high">High</option>
								</select>
							) : (
								<span
									className={styles.priorityBadge}
									style={{
										backgroundColor: getPriorityColor(
											selectedTask.priority
										),
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
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "1rem",
									}}
								>
									<input
										type="range"
										value={editTask?.progress || 0}
										onChange={(e) =>
											setEditTask((prev) =>
												prev
													? {
															...prev,
															progress: Number(
																e.target.value
															),
													  }
													: prev
											)
										}
										min="0"
										max="100"
										style={{ flex: 1 }}
									/>
									<span
										style={{
											fontSize: "0.875rem",
											color: "#6b7280",
											minWidth: "3rem",
										}}
									>
										{editTask?.progress || 0}%
									</span>
								</div>
							) : (
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "1rem",
									}}
								>
									<div
										style={{
											flex: 1,
											background: "#e5e7eb",
											borderRadius: "0.75rem",
											height: "0.5rem",
											maxWidth: "200px",
										}}
									>
										<div
											style={{
												background: "#10b981",
												height: "0.5rem",
												borderRadius: "0.75rem",
												width: `${
													selectedTask.progress || 0
												}%`,
											}}
										/>
									</div>
									<span
										style={{
											fontSize: "0.875rem",
											color: "#6b7280",
										}}
									>
										{selectedTask.progress || 0}%
									</span>
								</div>
							)}
						</div>

						{/* Start Date */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Start Date:</span>
							{isEditing ? (
								<input
									type="date"
									className={styles.editInput}
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
								/>
							) : (
								<span>
									{selectedTask.start_date
										? new Date(
												selectedTask.start_date
										  ).toLocaleDateString()
										: "Not set"}
								</span>
							)}
						</div>

						{/* Due Date */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Due Date:</span>
							{isEditing ? (
								<input
									type="date"
									className={styles.editInput}
									value={editTask?.due_date || ""}
									onChange={(e) =>
										setEditTask((prev) =>
											prev
												? {
														...prev,
														due_date:
															e.target.value,
												  }
												: prev
										)
									}
								/>
							) : selectedTask.due_date ? (
								<div className={styles.dueDateDisplay}>
									<span
										className={styles.dueDateBadge}
										style={{
											backgroundColor: getDueDateStatus(
												selectedTask.due_date
											).color,
										}}
									>
										{
											getDueDateStatus(
												selectedTask.due_date
											).text
										}
									</span>
									<span className={styles.dueDateFull}>
										{new Date(
											selectedTask.due_date
										).toLocaleDateString("en-US", {
											weekday: "long",
											year: "numeric",
											month: "long",
											day: "numeric",
										})}
									</span>
								</div>
							) : (
								<span className={styles.noDueDate}>
									No due date set
								</span>
							)}
						</div>

						{/* Assignees */}
						<div className={styles.taskDetailRow}>
							<span className={styles.label}>Assignees:</span>
							{isEditing ? (
								loadingUsers ? (
									<div>Loading users...</div>
								) : availableUsers.length === 0 ? (
									<div>No users available</div>
								) : (
									<div className={styles.assigneeList}>
										{availableUsers.map((user) => (
											<label
												key={user.id}
												className={
													styles.assigneeOption
												}
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
								<div className={styles.assigneeInfo}>
									{selectedTask.assigneeNames?.map(
										(name, index) => {
											const employeeId =
												selectedTask.assigneeAvatars?.[
													index
												] || "";
											return (
												<div
													key={index}
													className={
														styles.assigneeItem
													}
												>
													<span
														className={
															styles.assigneeAvatar
														}
													>
														<Avatar
															employeeId={
																employeeId
															}
															fullName={name}
															size="small"
														/>
													</span>
													<span>{name}</span>
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
										).map((subtask) => (
											<div
												key={subtask.id}
												style={{
													display: "flex",
													alignItems: "center",
													gap: "0.75rem",
													padding: "0.75rem",
													background: "#f9fafb",
													borderRadius: "0.5rem",
													cursor: "pointer",
													transition: "all 0.2s",
													border: "1px solid #e5e7eb",
												}}
												onClick={(e) => {
													e.stopPropagation();
													// Create a new task object with updated details
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
														"#f3f4f6";
													e.currentTarget.style.borderColor =
														"#d1d5db";
												}}
												onMouseLeave={(e) => {
													e.currentTarget.style.background =
														"#f9fafb";
													e.currentTarget.style.borderColor =
														"#e5e7eb";
												}}
											>
												<div style={{ flex: 1 }}>
													<div
														style={{
															fontWeight: "500",
															fontSize:
																"0.875rem",
															color: "#1f2937",
														}}
													>
														{subtask.title}
													</div>
													<div
														style={{
															fontSize: "0.75rem",
															color: "#6b7280",
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
														background: "#e5e7eb",
														borderRadius: "0.75rem",
														height: "0.5rem",
														width: "4rem",
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
									className={styles.editTextarea}
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
									rows={3}
								/>
							) : (
								<p className={styles.description}>
									{selectedTask.description}
								</p>
							)}
						</div>
					</div>

					{/* Comments Section */}
					<div className={styles.commentsSection}>
						<h3>Comments ({selectedTask.comments.length})</h3>

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
										: "Add Comment"}
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
										<strong>{comment.author_name}</strong>
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
