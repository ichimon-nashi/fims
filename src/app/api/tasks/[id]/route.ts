// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getTaskById, updateTask, deleteTask } from "@/lib/taskDatabase";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		console.log("GET /api/tasks/[id] - Fetching task:", id);

		// Extract and verify token
		const authHeader = request.headers.get("authorization");
		const token = extractTokenFromHeader(authHeader);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token verified for user:", decoded.userId);

		const task = await getTaskById(id);

		if (!task) {
			return NextResponse.json(
				{ message: "Task not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json(task);
	} catch (error) {
		console.error("Error in GET /api/tasks/[id]:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch task",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		console.log("PUT /api/tasks/[id] - Updating task:", id);

		// Extract and verify token
		const authHeader = request.headers.get("authorization");
		const token = extractTokenFromHeader(authHeader);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token verified for user:", decoded.userId);

		const body = await request.json();
		console.log("Update data:", body);

		// Validate that at least one field is being updated
		const allowedFields = [
			"title",
			"description",
			"priority",
			"status",
			"assignees",
			"due_date",
		];
		const updates: any = {};

		allowedFields.forEach((field) => {
			if (body.hasOwnProperty(field)) {
				updates[field] = body[field];
			}
		});

		if (Object.keys(updates).length === 0) {
			return NextResponse.json(
				{ message: "No valid fields to update" },
				{ status: 400 }
			);
		}

		const task = await updateTask(id, updates);
		console.log("Task updated successfully:", task.id);

		return NextResponse.json(task);
	} catch (error) {
		console.error("Error in PUT /api/tasks/[id]:", error);
		return NextResponse.json(
			{
				message: "Failed to update task",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		console.log("DELETE /api/tasks/[id] - Deleting task:", id);

		// Extract and verify token
		const authHeader = request.headers.get("authorization");
		const token = extractTokenFromHeader(authHeader);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token verified for user:", decoded.userId);

		await deleteTask(id);
		console.log("Task deleted successfully:", id);

		return NextResponse.json({ message: "Task deleted successfully" });
	} catch (error) {
		console.error("Error in DELETE /api/tasks/[id]:", error);
		return NextResponse.json(
			{
				message: "Failed to delete task",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}