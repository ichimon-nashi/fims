import React, { useRef } from "react";
import TaskCard from "./TaskCard";
import { Task, Column } from "@/lib/task.types";
import { getSubtasks, calculateParentProgress } from "@/utils/taskHelpers";
import { createServiceClient } from "@/utils/supabase/service-client";
import styles from "./TaskManager.module.css";

interface BoardViewProps {
	columns: Column[];
	setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
	onTaskClick: (task: Task) => void;
	onAddTask: (columnId: string) => void;
}

const BoardView: React.FC<BoardViewProps> = ({
	columns,
	setColumns,
	onTaskClick,
	onAddTask,
}) => {
	const draggedTask = useRef<Task | null>(null);
	const draggedFromColumn = useRef<string | null>(null);

	const handleDragStart = (
		e: React.DragEvent,
		task: Task,
		columnId: string
	) => {
		draggedTask.current = task;
		draggedFromColumn.current = columnId;
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
		e.preventDefault();
		if (!draggedTask.current || !draggedFromColumn.current) return;
		if (draggedFromColumn.current === targetColumnId) return;

		const task = draggedTask.current;
		const sourceColumnId = draggedFromColumn.current;

		try {
			const supabase = createServiceClient();
			const { error } = await supabase
				.from("tasks")
				.update({ status: targetColumnId })
				.eq("id", task.id);
			if (error) console.error("Error updating task status:", error);

			setColumns((prevColumns) => {
				return prevColumns.map((column) => {
					if (column.id === sourceColumnId) {
						const newTasks = column.tasks.filter(
							(t) => t.id !== task.id
						);
						return {
							...column,
							tasks: newTasks,
							count: newTasks.filter((t) => !t.parent_id).length,
						};
					}
					if (column.id === targetColumnId) {
						const updatedTask = {
							...task,
							status: targetColumnId as any,
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
		} catch (error) {
			console.error("Error in drag and drop:", error);
		}

		draggedTask.current = null;
		draggedFromColumn.current = null;
	};

	const getTasksByStatus = (status: string): Task[] => {
		return (
			columns
				.find((col) => col.id === status)
				?.tasks.filter((task) => !task.parent_id) || []
		);
	};

	const getAllTasks = (): Task[] => {
		return columns.flatMap((col) => col.tasks);
	};

	return (
		<div className={styles.kanbanBoard}>
			{columns.map((column) => {
				const boardTasks = getTasksByStatus(column.id);

				return (
					<div
						key={column.id}
						className={styles.column}
						onDragOver={handleDragOver}
						onDrop={(e) => handleDrop(e, column.id)}
					>
						<div className={styles.columnHeader}>
							<div
								className={styles.columnTitle}
								style={{ borderTopColor: column.color }}
							>
								<span>{column.title}</span>
								<span className={styles.taskCount}>
									{boardTasks.length}
								</span>
							</div>
						</div>

						<div className={styles.taskList}>
							{boardTasks.map((task) => {
								const subtasks = getSubtasks(
									getAllTasks(),
									task.id
								);
								const calculatedProgress =
									calculateParentProgress(
										getAllTasks(),
										task.id
									);

								return (
									<TaskCard
										key={task.id}
										task={task}
										columnColor={column.color}
										columnId={column.id}
										subtaskCount={subtasks.length}
										calculatedProgress={calculatedProgress}
										onTaskClick={onTaskClick}
										onDragStart={handleDragStart}
									/>
								);
							})}

							<button
								className={styles.addTaskInColumn}
								onClick={() => onAddTask(column.id)}
							>
								+ Add task
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export default BoardView;
