// src/app/tasks/page.tsx - Fixed to use global auth context
import { Metadata } from "next";
import TaskManager from "@/components/tasks/TaskManager";

export const metadata: Metadata = {
	title: "FIMS - Task Manager",
	description: "Kanban 任務看板",
};

export default function TasksPage() {
	return <TaskManager />;
}
