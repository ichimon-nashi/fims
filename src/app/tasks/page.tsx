// src/app/tasks/page.tsx - Fixed to use global auth context
import { Metadata } from "next";
import TaskManager from "@/components/tasks/TaskManager";

export const metadata: Metadata = {
	title: "任務管理 - 豪神教師管理系統",
	description: "Kanban 任務看板",
};

export default function TasksPage() {
	return <TaskManager />;
}
