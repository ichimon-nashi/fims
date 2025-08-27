// src/app/api/dashboard/task-stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";
import { createServiceClient } from "@/utils/supabase/service-client";

export async function GET(request: NextRequest) {
	try {
		console.log('Task stats API called - Database URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
		
		// Extract token from Authorization header
		const token = extractTokenFromHeader(
			request.headers.get("authorization")
		);

		if (!token) {
			return NextResponse.json(
				{ error: "No token provided" },
				{ status: 401 }
			);
		}

		// Verify the token
		const decoded = verifyToken(token);
		if (!decoded) {
			return NextResponse.json(
				{ error: "Invalid or expired token" },
				{ status: 401 }
			);
		}

		const { searchParams } = new URL(request.url);
		const userId = searchParams.get("user_id");

		if (!userId) {
			return NextResponse.json(
				{ error: "User ID required" },
				{ status: 400 }
			);
		}

		// Initialize Supabase client - CHANGED TO USE SERVICE CLIENT
		const supabase = createServiceClient();

		// First, get the user's internal UUID from the users table
		// This is needed because tasks use the internal UUID, not employee_id
		const { data: userData, error: userError } = await supabase
			.from("users")
			.select("id")
			.eq("employee_id", userId)
			.single();

		let userUuid = userId; // Fallback to provided userId

		if (userError) {
			console.error("User lookup error:", userError);
			console.log("Trying to use provided userId as UUID directly:", userId);
		} else if (userData) {
			userUuid = userData.id;
			console.log("Found user UUID:", userUuid, "for employee_id:", userId);
		}

		console.log("Using userUuid for task query:", userUuid);

		// Query tasks table for tasks assigned to the current user
		// Use a simpler approach - get all incomplete tasks first, then filter in JavaScript
		const { data: allIncompleteTasks, error: tasksError } = await supabase
			.from("tasks")
			.select("id, status, assignees, title")
			.neq("status", "complete"); // Get all incomplete tasks

		if (tasksError) {
			console.error("Tasks query error:", tasksError);
			return NextResponse.json(
				{ error: "Database query failed", details: tasksError.message },
				{ status: 500 }
			);
		}

		// Filter tasks assigned to current user in JavaScript
		const tasks = (allIncompleteTasks || []).filter(task => {
			const assignees = task.assignees || [];
			const isAssigned = assignees.includes(userUuid);
			console.log(`Task "${task.title}": assignees=`, assignees, "includes user?", isAssigned);
			return isAssigned;
		});

		console.log("Tasks assigned to user after JS filter:", tasks.length);

		// Debug: Let's see what tasks exist in the database
		const { data: allTasks, error: allTasksError } = await supabase
			.from("tasks")
			.select("id, status, assignees, title, created_by")
			.limit(10); // Just get first 10 tasks for debugging

		console.log("DEBUG - All tasks in database (first 10):", allTasks?.map(task => ({
			id: task.id,
			title: task.title,
			assignees: task.assignees,
			status: task.status,
			created_by: task.created_by
		})));

		console.log("DEBUG - Looking for user UUID in assignees:", userUuid);
		console.log("DEBUG - Found tasks for user:", tasks?.map(task => ({
			id: task.id,
			title: task.title,
			assignees: task.assignees,
			status: task.status
		})));

		// Count the unfinished tasks
		const unfinishedTasksCount = tasks?.length || 0;

		// Get additional stats for debugging
		const { data: allUserTasks, error: allUserTasksError } = await supabase
			.from("tasks")
			.select("id, status")
			.contains("assignees", [userUuid]);

		const totalUserTasks = allUserTasks?.length || 0;
		const completedTasks = allUserTasks?.filter(task => task.status === 'complete').length || 0;

		return NextResponse.json({
			unfinishedTasksCount,
			totalUserTasks,
			completedTasks,
			debug: {
				userEmployeeId: userId,
				userUuid: userUuid,
				foundUser: !!userData,
				sampleTasks: tasks?.slice(0, 3).map(task => ({
					id: task.id,
					status: task.status,
					title: task.title
				})) || [],
			},
		});

	} catch (error) {
		console.error("Task stats API error:", error);
		return NextResponse.json(
			{
				error: "Failed to fetch task statistics",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}