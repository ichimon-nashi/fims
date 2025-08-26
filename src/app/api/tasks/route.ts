// src/app/api/tasks/route.ts - Debug Version
import { NextRequest, NextResponse } from "next/server";
import { getTasks, createTask } from "@/lib/taskDatabase";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
	try {
		console.log("GET /api/tasks - Fetching tasks");

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

		// Get query parameters
		const { searchParams } = new URL(request.url);
		const year = searchParams.get("year");
		const status = searchParams.get("status");
		const priority = searchParams.get("priority");
		const assignee = searchParams.get("assignee");
		const created_by = searchParams.get("created_by");

		// Build filters
		const filters: Record<string, any> = {};
		if (year) filters.year = parseInt(year);
		if (status) filters.status = status;
		if (priority) filters.priority = priority;
		if (assignee) filters.assignee = assignee;
		if (created_by) filters.created_by = created_by;

		const tasks = await getTasks(filters);
		console.log("Retrieved tasks:", tasks.length);

		return NextResponse.json(tasks);
	} catch (error) {
		console.error("Error in GET /api/tasks:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch tasks",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		console.log("POST /api/tasks - Creating new task");

		// Extract and verify token
		const authHeader = request.headers.get("authorization");
		console.log("Auth header present:", !!authHeader);

		const token = extractTokenFromHeader(authHeader);
		console.log("Token extracted:", !!token);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token verified for user:", decoded.userId);

		const body = await request.json();
		console.log("Request body received:", JSON.stringify(body, null, 2));

		// Validate required fields
		if (!body.title) {
			console.log("Missing title field");
			return NextResponse.json(
				{ message: "Missing required field: title" },
				{ status: 400 }
			);
		}

		if (!body.status) {
			console.log("Missing status field");
			return NextResponse.json(
				{ message: "Missing required field: status" },
				{ status: 400 }
			);
		}

		if (!body.priority) {
			console.log("Missing priority field");
			return NextResponse.json(
				{ message: "Missing required field: priority" },
				{ status: 400 }
			);
		}

		// Create task data
		const taskData = {
			title: body.title,
			description: body.description || "",
			priority: body.priority,
			status: body.status,
			assignees: body.assignees || [],
			due_date: body.due_date || null,
			created_by: body.created_by || decoded.userId,
		};

		console.log("Task data to create:", JSON.stringify(taskData, null, 2));

		const task = await createTask(taskData);
		console.log("Task created successfully:", task.id);

		return NextResponse.json(task, { status: 201 });
	} catch (error) {
		console.error("Detailed error in POST /api/tasks:", {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			name: error instanceof Error ? error.name : undefined,
		});

		return NextResponse.json(
			{
				message: "Failed to create task",
				error: error instanceof Error ? error.message : String(error),
				details: error instanceof Error ? error.stack : undefined,
			},
			{ status: 500 }
		);
	}
}