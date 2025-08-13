// src/app/api/dashboard/schedule-stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
	try {
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

		// Initialize Supabase client using your server setup
		const supabase = await createClient();

		// Get current month date range
		const now = new Date();
		const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const lastDayOfMonth = new Date(
			now.getFullYear(),
			now.getMonth() + 1,
			0
		);

		const startDate = firstDayOfMonth.toISOString().split("T")[0];
		const endDate = lastDayOfMonth.toISOString().split("T")[0];

		// Query your fi_schedule table for user's duties in current month
		const { data, error } = await supabase
			.from("fi_schedule")
			.select("date, duties")
			.eq("employee_id", userId)
			.gte("date", startDate)
			.lte("date", endDate)
			.not("duties", "eq", "{}") // Empty array check
			.not("duties", "is", null);

		if (error) {
			console.error("Supabase query error:", error);
			return NextResponse.json(
				{ error: "Database query failed", details: error.message },
				{ status: 500 }
			);
		}

		// Count unique dates where user has duties
		const datesWithDuties =
			data?.filter(
				(row) =>
					row.duties &&
					Array.isArray(row.duties) &&
					row.duties.length > 0
			) || [];

		const uniqueDates = new Set(datesWithDuties.map((row) => row.date));
		const monthlyScheduleCount = uniqueDates.size;

		return NextResponse.json({
			monthlyScheduleCount,
			period: `${now.getFullYear()}年${now.getMonth() + 1}月`,
			dateRange: {
				start: startDate,
				end: endDate,
			},
			debug: {
				totalRecords: data?.length || 0,
				recordsWithDuties: datesWithDuties.length,
				uniqueDates: uniqueDates.size,
				userId: userId,
				sampleData: datesWithDuties.slice(0, 3), // First 3 records for debugging
			},
		});
	} catch (error) {
		console.error("Dashboard schedule stats error:", error);
		return NextResponse.json(
			{
				error: "Failed to fetch schedule statistics",
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}