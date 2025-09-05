// src/components/tasks/AddTaskModal.tsx
import React, { useState } from "react";
import Avatar from "@/components/ui/Avatar/Avatar";
import { Task, Column, AvailableUser } from "@/lib/task.types";
import { createServiceClient } from "@/utils/supabase/service-client";
import { useAuth } from "@/context/AuthContext";
import styles from "./TaskManager.module.css";

interface AddTaskModalProps {
	availableUsers: AvailableUser[];
	loadingUsers: boolean;
	selectedColumn: string;
	allTasks: Task[];
	columns: Column[];
	setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
	onClose: () => void;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({
	availableUsers,
	loadingUsers,
	selectedColumn,
	allTasks,
	columns,
	setColumns,
	onClose,
}) => {
	const { user } = useAuth();
	const [savingTask, setSavingTask] = useState(false);
	const [newTask, setNewTask] = useState<{
		title: string;
		description: string;
		priority: "low" | "medium" | "high";
		task_type: "main" | "subtask";
		parent_id: string;
		assignees: string[];
		due_date: string;
		start_date: string;
	}>({
		title: "",
		description: "",
		priority: "medium",
		task_type: "main",
		parent_id: "",
		assignees: [],
		due_date: "",
		start_date: "",
	});

	// Get main tasks for parent selection
	const getMainTasks = (): Task[] => {
		return allTasks.filter((t) => t.task_type === "main");
	};

	// Handle add task
	const handleAddTask = async () => {
		if (!newTask.title.trim()) return;

		try {
			setSavingTask(true);

			const taskData = {
				title: newTask.title,
				description: newTask.description || "",
				priority: newTask.priority,
				status: selectedColumn,
				task_type: newTask.task_type,
				parent_id: newTask.parent_id || null,
				start_date: newTask.start_date || null,
				progress: 0,
				assignees: newTask.assignees,
				due_date: newTask.due_date || null,
				created_by: user?.id,
				year: new Date().getFullYear(),
			};

			let createdTask;

			try {
				const supabase = createServiceClient();
				const { data, error } = await supabase
					.from("tasks")
					.insert([taskData])
					.select()
					.single();
				if (error) throw error;
				createdTask = data;
			} catch (dbError) {
				console.error("Database insert failed:", dbError);
				createdTask = {
					id: Date.now().toString(),
					...taskData,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};
			}

			const task: Task = {
				...createdTask,
				task_type: (createdTask.task_type as string) === "subtask" ? "subtask" : "main",
				progress: createdTask.progress || 0,
				dependencies: createdTask.dependencies || [],
				assigneeNames: (createdTask.assignees || []).map(
					(id: string) =>
						availableUsers.find((u) => u.id === id)?.full_name ||
						"Unknown User"
				),
				assigneeAvatars: (createdTask.assignees || []).map(
					(id: string) => {
						const user = availableUsers.find((u) => u.id === id);
						return user ? user.employee_id : "";
					}
				),
				comments: [],
			};

			setColumns((prevColumns) =>
				prevColumns.map((column) => {
					if (column.id === selectedColumn) {
						const newTasks = [...column.tasks, task];
						return {
							...column,
							tasks: newTasks,
							count: newTasks.filter((t) => !t.parent_id).length,
						};
					}
					return column;
				})
			);

			// Reset form and close modal
			setNewTask({
				title: "",
				description: "",
				priority: "medium",
				task_type: "main",
				parent_id: "",
				assignees: [],
				due_date: "",
				start_date: "",
			});
			onClose();
		} catch (error) {
			console.error("Error creating task:", error);
			alert(
				"Error creating task: " +
					(error instanceof Error ? error.message : String(error))
			);
		} finally {
			setSavingTask(false);
		}
	};

	// Toggle assignee
	const toggleAssignee = (userId: string) => {
		const currentAssignees = newTask.assignees;
		const updated = currentAssignees.includes(userId)
			? currentAssignees.filter((id) => id !== userId)
			: [...currentAssignees, userId];

		setNewTask({ ...newTask, assignees: updated });
	};

	return (
		<div className={styles.modal} onClick={onClose}>
			<div
				className={styles.modalContent}
				onClick={(e) => e.stopPropagation()}
			>
				<div className={styles.modalHeader}>
					<h2>Add New Task</h2>
					<button className={styles.closeButton} onClick={onClose}>
						×
					</button>
				</div>

				<div className={styles.modalBody}>
					{/* Task Title */}
					<div className={styles.formGroup}>
						<label>Task Title *</label>
						<input
							type="text"
							value={newTask.title}
							onChange={(e) =>
								setNewTask({
									...newTask,
									title: e.target.value,
								})
							}
							placeholder="Enter task title..."
							autoFocus
						/>
					</div>

					{/* Description */}
					<div className={styles.formGroup}>
						<label>Description</label>
						<textarea
							value={newTask.description}
							onChange={(e) =>
								setNewTask({
									...newTask,
									description: e.target.value,
								})
							}
							placeholder="Enter task description..."
							rows={3}
						/>
					</div>

					{/* Task Type and Priority Row */}
					<div className={styles.formRow}>
						<div className={styles.formGroup}>
							<label>Task Type</label>
							<select
								value={newTask.task_type}
								onChange={(e) =>
									setNewTask({
										...newTask,
										task_type: e.target.value as any,
									})
								}
							>
								<option value="main">Main Task</option>
								<option value="subtask">Subtask</option>
							</select>
						</div>

						<div className={styles.formGroup}>
							<label>Priority</label>
							<select
								value={newTask.priority}
								onChange={(e) =>
									setNewTask({
										...newTask,
										priority: e.target.value as any,
									})
								}
							>
								<option value="low">Low Priority</option>
								<option value="medium">Medium Priority</option>
								<option value="high">High Priority</option>
							</select>
						</div>
					</div>

					{/* Parent Task Selection (only for subtasks) */}
					{newTask.task_type === "subtask" && (
						<div className={styles.formGroup}>
							<label>Parent Task *</label>
							<select
								value={newTask.parent_id}
								onChange={(e) =>
									setNewTask({
										...newTask,
										parent_id: e.target.value,
									})
								}
							>
								<option value="">Select Parent Task</option>
								{getMainTasks().map((task) => (
									<option key={task.id} value={task.id}>
										{task.title}
									</option>
								))}
							</select>
							{getMainTasks().length === 0 && (
								<p
									style={{
										fontSize: "0.75rem",
										color: "#ef4444",
										margin: "0.25rem 0 0 0",
										fontStyle: "italic",
									}}
								>
									No main tasks available. Create a main task
									first.
								</p>
							)}
						</div>
					)}

					{/* Date Range Row */}
					<div className={styles.formRow}>
						<div className={styles.formGroup}>
							<label>Start Date</label>
							<input
								type="date"
								value={newTask.start_date}
								onChange={(e) =>
									setNewTask({
										...newTask,
										start_date: e.target.value,
									})
								}
							/>
						</div>
						<div className={styles.formGroup}>
							<label>Due Date</label>
							<input
								type="date"
								value={newTask.due_date}
								onChange={(e) =>
									setNewTask({
										...newTask,
										due_date: e.target.value,
									})
								}
							/>
						</div>
					</div>

					{/* Assignees */}
					<div className={styles.formGroup}>
						<label>Assignees</label>
						{loadingUsers ? (
							<div
								style={{
									padding: "1rem",
									textAlign: "center",
									color: "#6b7280",
								}}
							>
								Loading users...
							</div>
						) : availableUsers.length === 0 ? (
							<div
								style={{
									padding: "1rem",
									textAlign: "center",
									color: "#6b7280",
								}}
							>
								No users available
							</div>
						) : (
							<div className={styles.assigneeList}>
								{availableUsers.map((user) => (
									<label
										key={user.id}
										className={styles.assigneeOption}
									>
										<input
											type="checkbox"
											checked={newTask.assignees.includes(
												user.id
											)}
											onChange={() =>
												toggleAssignee(user.id)
											}
										/>
										<span className={styles.userAvatar}>
											<Avatar
												employeeId={user.employee_id}
												fullName={user.full_name}
												size="small"
											/>
										</span>
										<div className={styles.userInfo}>
											<span className={styles.userName}>
												{user.full_name}
											</span>
											<span
												className={styles.userDetails}
											>
												{user.employee_id} • {user.base}{" "}
												•{" "}
												{user.rank?.split(" - ")[0] ||
													"FI"}
											</span>
										</div>
									</label>
								))}
							</div>
						)}
					</div>

					{/* Selected Column Info */}
					<div
						style={{
							background: "#f8fafc",
							border: "1px solid #e5e7eb",
							borderRadius: "0.5rem",
							padding: "0.75rem",
							margin: "1rem 0",
						}}
					>
						<div
							style={{
								fontSize: "0.875rem",
								color: "#374151",
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
							}}
						>
							<span style={{ fontWeight: "600" }}>
								Will be added to:
							</span>
							<span
								style={{
									background:
										columns.find(
											(c) => c.id === selectedColumn
										)?.color || "#6b7280",
									color: "white",
									padding: "0.25rem 0.5rem",
									borderRadius: "0.25rem",
									fontSize: "0.75rem",
									fontWeight: "500",
								}}
							>
								{columns.find((c) => c.id === selectedColumn)
									?.title || "Unknown Column"}
							</span>
						</div>
					</div>
				</div>

				{/* Modal Footer */}
				<div className={styles.modalFooter}>
					<button
						className={styles.cancelButton}
						onClick={onClose}
						disabled={savingTask}
					>
						Cancel
					</button>
					<button
						className={styles.saveButton}
						onClick={handleAddTask}
						disabled={
							savingTask ||
							!newTask.title.trim() ||
							(newTask.task_type === "subtask" &&
								!newTask.parent_id)
						}
					>
						{savingTask ? "Adding..." : "Add Task"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default AddTaskModal;