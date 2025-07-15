// src/app/api/schedule/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from "next/server";
import { 
	getScheduleEntries, 
	createOrUpdateScheduleEntry 
} from "@/lib/database";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

// Special accounts that can modify all schedules
const ADMIN_ACCOUNTS = ["admin", "21986", "51892"];

export async function GET(request: NextRequest) {
	try {
		console.log("=== SCHEDULE API GET ===");
		
		const token = extractTokenFromHeader(
			request.headers.get("authorization")
		);

		if (!token) {
			console.log("No token provided");
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token verified for user:", decoded.userId);

		if (decoded.authLevel < 1) {
			return NextResponse.json(
				{ message: "Insufficient permissions" },
				{ status: 403 }
			);
		}

		const { searchParams } = new URL(request.url);
		const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
		const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : undefined;
		const employeeId = searchParams.get("employeeId") || undefined;

		console.log("Fetching schedule entries with filters:", { year, month, employeeId });

		const scheduleEntries = await getScheduleEntries({ year, month, employeeId });
		console.log("Found schedule entries:", scheduleEntries.length);

		// Transform data for frontend consumption
		const scheduleData: { [key: string]: any[] } = {};
		
		scheduleEntries.forEach(entry => {
			const key = `${entry.employee_id}-${entry.date}`;
			if (!scheduleData[key]) {
				scheduleData[key] = [];
			}
			scheduleData[key].push(entry);
		});

		console.log("Transformed schedule data keys:", Object.keys(scheduleData).length);
		return NextResponse.json(scheduleData);
	} catch (error: any) {
		console.error("Get schedule entries error:", error);
		return NextResponse.json(
			{ 
				message: "Failed to get schedule entries",
				error: error.message 
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		console.log("=== SCHEDULE API POST DEBUG ===");
		
		const token = extractTokenFromHeader(
			request.headers.get("authorization")
		);

		if (!token) {
			console.log("No token provided");
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("🔍 DEBUGGING TOKEN:");
		console.log("Full decoded token:", JSON.stringify(decoded, null, 2));
		
		if (decoded.authLevel < 1) {
			return NextResponse.json(
				{ message: "Insufficient permissions" },
				{ status: 403 }
			);
		}

		const scheduleData = await request.json();
		console.log("📋 Schedule data received:", scheduleData);

		// Get user's employee_id from database using the UUID  
		const supabase = await createClient();
		const { data: user, error: userError } = await supabase
			.from("users")
			.select("employee_id, full_name")
			.eq("id", decoded.userId)
			.single();

		if (userError || !user) {
			console.log("❌ User not found in database:", decoded.userId);
			return NextResponse.json(
				{ message: "User not found" },
				{ status: 404 }
			);
		}

		const userEmployeeId = user.employee_id;
		console.log("✅ Found user:", {
			uuid: decoded.userId,
			employee_id: userEmployeeId,
			name: user.full_name
		});

		// Permission check: Users can only modify their own schedule unless they are admin
		const isAdmin = ADMIN_ACCOUNTS.includes(userEmployeeId);
		const canModify = isAdmin || scheduleData.employee_id === userEmployeeId;
		
		console.log("🔒 Permission check:", {
			userEmployeeId,
			targetEmployeeId: scheduleData.employee_id,
			isAdmin,
			canModify,
			adminAccounts: ADMIN_ACCOUNTS
		});
		
		if (!canModify) {
			console.log("❌ Permission denied: User trying to modify another user's schedule");
			return NextResponse.json(
				{ message: "您只能修改自己的排程" },
				{ status: 403 }
			);
		}

		// Validate required fields
		const required = ["employee_id", "date", "duties"];
		for (const field of required) {
			if (!scheduleData[field]) {
				console.log(`❌ Missing required field: ${field}`);
				return NextResponse.json(
					{ message: `${field} is required` },
					{ status: 400 }
				);
			}
		}

		// Validate date format
		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(scheduleData.date)) {
			console.log("❌ Invalid date format:", scheduleData.date);
			return NextResponse.json(
				{ message: "Date must be in YYYY-MM-DD format" },
				{ status: 400 }
			);
		}

		// Validate duties is an array
		if (!Array.isArray(scheduleData.duties)) {
			console.log("❌ Duties is not an array:", scheduleData.duties);
			return NextResponse.json(
				{ message: "Duties must be an array" },
				{ status: 400 }
			);
		}

		// If duties array is empty, delete the entry instead of creating/updating
		if (scheduleData.duties.length === 0) {
			console.log("🗑️ Duties array is empty, deleting entry instead");
			try {
				const { deleteScheduleEntry } = await import("@/lib/database");
				await deleteScheduleEntry(scheduleData.employee_id, scheduleData.date);
				
				return NextResponse.json({
					message: "Schedule entry deleted (empty duties)",
					action: "deleted"
				}, { status: 200 });
			} catch (deleteError) {
				console.log("⚠️ Failed to delete entry, but continuing:", deleteError);
				// Continue to create/update with empty array if delete fails
			}
		}

		// Use the actual user employee_id
		const userEmployeeIdForTracking = userEmployeeId;

		// Ensure we have all required fields with defaults
		const entryData = {
			employee_id: scheduleData.employee_id,
			full_name: scheduleData.full_name || 'Unknown Instructor',
			rank: scheduleData.rank || 'FI',
			base: scheduleData.base || 'Unknown',
			date: scheduleData.date,
			duties: scheduleData.duties,
			created_by: scheduleData.created_by || userEmployeeIdForTracking,
			updated_by: userEmployeeIdForTracking,
			updated_at: new Date().toISOString()
		};

		console.log("📝 Processed entry data:", entryData);

		const newScheduleEntry = await createOrUpdateScheduleEntry(entryData);
		console.log("✅ Schedule entry created/updated successfully:", newScheduleEntry.id);

		return NextResponse.json({
			message: "Schedule entry created/updated successfully",
			data: newScheduleEntry,
			debug: {
				userEmployeeId: userEmployeeIdForTracking,
				isAdmin,
				adminAccounts: ADMIN_ACCOUNTS
			}
		}, { status: 201 });
	} catch (error: any) {
		console.error("❌ Create schedule entry error:", error);
		console.error("Error details:", {
			code: error.code,
			message: error.message,
			details: error.details,
			hint: error.hint
		});
		
		// Handle specific Supabase RLS errors
		if (error.code === '42501') {
			console.log("🚫 RLS policy violation detected");
			return NextResponse.json(
				{ 
					message: "Permission denied. Row Level Security policy blocks this operation.",
					error: "You may need to disable RLS or create proper policies for the fi_schedule table.",
					hint: "Run 'ALTER TABLE fi_schedule DISABLE ROW LEVEL SECURITY;' in Supabase SQL editor"
				},
				{ status: 403 }
			);
		}
		
		// Handle duplicate key errors
		if (error.message?.includes("duplicate key") || error.message?.includes("duplicate")) {
			return NextResponse.json(
				{ message: "Schedule entry for this date already exists" },
				{ status: 409 }
			);
		}

		// Handle other specific errors
		if (error.code === 'PGRST301') {
			return NextResponse.json(
				{ message: "Database table or column not found" },
				{ status: 500 }
			);
		}

		return NextResponse.json(
			{ 
				message: "Failed to create/update schedule entry",
				error: error.message,
				code: error.code
			},
			{ status: 500 }
		);
	}
}

export async function DELETE(request: NextRequest) {
	try {
		console.log("=== SCHEDULE API DELETE ===");
		
		const token = extractTokenFromHeader(
			request.headers.get("authorization")
		);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token verified for user:", decoded.userId);

		// Get user's employee_id from database using the UUID  
		const supabase = await createClient();
		const { data: user, error: userError } = await supabase
			.from("users")
			.select("employee_id, full_name")
			.eq("id", decoded.userId)
			.single();

		if (userError || !user) {
			console.log("❌ User not found in database:", decoded.userId);
			return NextResponse.json(
				{ message: "User not found" },
				{ status: 404 }
			);
		}

		const userEmployeeId = user.employee_id;

		// Check if user has permission to delete schedules
		const isAdmin = ADMIN_ACCOUNTS.includes(userEmployeeId);
		
		console.log("Delete permission check:", {
			userEmployeeId,
			isAdmin,
			authLevel: decoded.authLevel
		});
		
		if (!isAdmin && decoded.authLevel < 5) {
			return NextResponse.json(
				{ message: "Insufficient permissions to delete schedules" },
				{ status: 403 }
			);
		}

		const { searchParams } = new URL(request.url);
		const employeeId = searchParams.get("employeeId");
		const date = searchParams.get("date");

		if (!employeeId || !date) {
			return NextResponse.json(
				{ message: "Missing required parameters: employeeId and date" },
				{ status: 400 }
			);
		}

		// Additional permission check: Users can only delete their own schedule unless they are admin
		if (!isAdmin && employeeId !== userEmployeeId) {
			return NextResponse.json(
				{ message: "您只能刪除自己的排程" },
				{ status: 403 }
			);
		}

		console.log("Deleting schedule entry for:", employeeId, "on", date);

		// Import the delete function from database
		const { deleteScheduleEntry } = await import("@/lib/database");
		await deleteScheduleEntry(employeeId, date);
		
		console.log("Schedule entry deleted successfully");

		return NextResponse.json({
			message: "Schedule entry deleted successfully"
		});

	} catch (error: any) {
		console.error("Delete schedule entry error:", error);
		
		if (error.code === '42501') {
			return NextResponse.json(
				{ 
					message: "Permission denied. Row Level Security policy blocks this operation.",
					error: "RLS policy violation"
				},
				{ status: 403 }
			);
		}
		
		return NextResponse.json(
			{
				message: "Failed to delete schedule entry",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}