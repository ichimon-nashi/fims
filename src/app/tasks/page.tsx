// src/app/tasks/page.tsx - Protected with PermissionGuard
import { Metadata } from "next";
import PermissionGuard from "@/components/common/PermissionGuard";
import TaskManager from "@/components/tasks/TaskManager";

export const metadata: Metadata = {
	title: "FIMS - Task Manager",
	description: "Kanban 任務看板",
};

export default function TasksPage() {
	return (
		<PermissionGuard app="tasks">
			<TaskManager />
		</PermissionGuard>
	);
}