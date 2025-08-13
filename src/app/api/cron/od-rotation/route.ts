// src/app/api/cron/od-rotation/route.ts
import { NextRequest, NextResponse } from "next/server";

// This endpoint will be called by Vercel Cron on the 1st of each month
export async function POST(request: NextRequest) {
	try {
		console.log("=== CRON: OD ROTATION TRIGGER ===");
		console.log("Triggered at:", new Date().toISOString());

		// Verify this is a legitimate cron request
		const authHeader = request.headers.get("authorization");
		const cronSecret = process.env.CRON_SECRET;

		if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
			console.log("Unauthorized cron request");
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}

		// Calculate next month
		const now = new Date();
		const nextMonth = now.getMonth() + 2; // +1 for next month, +1 because getMonth() is 0-based
		const year = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
		const month = nextMonth > 12 ? 1 : nextMonth;

		console.log(
			`Assigning OD duties for ${year}-${month
				.toString()
				.padStart(2, "0")}`
		);

		// Import the assignment function from the utils file
		const { assignODForMonth } = await import("./od-utils");

		// Execute OD assignment with system user
		const result = await assignODForMonth(year, month, "system-cron");

		console.log("Cron OD rotation result:", result);

		return NextResponse.json({
			message: "Automated OD rotation completed successfully",
			executedAt: new Date().toISOString(),
			targetMonth: `${year}-${month.toString().padStart(2, "0")}`,
			result,
		});
	} catch (error: any) {
		console.error("Cron OD rotation error:", error);

		// You might want to send an alert/notification here
		// await sendErrorNotification(error);

		return NextResponse.json(
			{
				message: "Automated OD rotation failed",
				error: error.message,
				executedAt: new Date().toISOString(),
			},
			{ status: 500 }
		);
	}
}
