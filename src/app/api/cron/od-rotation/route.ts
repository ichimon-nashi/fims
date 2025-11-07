// src/app/api/cron/od-rotation/route.ts
import { NextRequest, NextResponse } from "next/server";

// This endpoint will be called by Vercel Cron on the 1st of each month at midnight UTC+8
export async function POST(request: NextRequest) {
	try {
		console.log("=== CRON: OD ROTATION TRIGGER ===");
		console.log("Triggered at:", new Date().toISOString());
		
		// Verify this is a legitimate cron request
		const authHeader = request.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;
		
		if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
			console.log("Unauthorized cron request");
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}
		
		// Calculate next month based on UTC+8 timezone
		const now = new Date();
		// Convert to UTC+8
		const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
		
		// Next month calculation
		const currentMonth = utc8Time.getMonth() + 1; // 1-based month
		const currentYear = utc8Time.getFullYear();
		
		const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
		const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
		
		console.log(`Current time (UTC+8): ${utc8Time.toISOString()}`);
		console.log(`Assigning OD duties for ${nextYear}-${nextMonth.toString().padStart(2, '0')}`);
		
		// Import the assignment function from the utils file
		const { assignODForMonth } = await import("../od-utils");
		
		// Execute OD assignment with system user
		const result = await assignODForMonth(nextYear, nextMonth, "system-cron");
		
		console.log("Cron OD rotation result:", result);
		
		return NextResponse.json({
			message: "Automated OD rotation completed successfully",
			executedAt: utc8Time.toISOString(),
			executedAtUtc: now.toISOString(),
			targetMonth: `${nextYear}-${nextMonth.toString().padStart(2, '0')}`,
			result
		});
		
	} catch (error: any) {
		console.error("Cron OD rotation error:", error);
		console.error("Stack trace:", error.stack);
		
		// You might want to send an alert/notification here
		// For example, send email or Slack notification
		// await sendErrorNotification(error);
		
		return NextResponse.json(
			{ 
				message: "Automated OD rotation failed",
				error: error.message,
				stack: error.stack,
				executedAt: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
}

// Optional: Add GET endpoint for manual testing/triggering
export async function GET(request: NextRequest) {
	try {
		// Only allow in development or with secret key
		const isDev = process.env.NODE_ENV === 'development';
		const testSecret = request.nextUrl.searchParams.get('secret');
		const cronSecret = process.env.CRON_SECRET;
		
		if (!isDev && testSecret !== cronSecret) {
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}
		
		// Get optional month/year parameters for testing
		const testYear = request.nextUrl.searchParams.get('year');
		const testMonth = request.nextUrl.searchParams.get('month');
		
		const now = new Date();
		const utc8Time = new Date(now.getTime() + (8 * 60 * 60 * 1000));
		
		const year = testYear ? parseInt(testYear) : utc8Time.getFullYear();
		const month = testMonth ? parseInt(testMonth) : utc8Time.getMonth() + 1;
		
		console.log(`[TEST] Manual OD assignment for ${year}-${month.toString().padStart(2, '0')}`);
		
		const { assignODForMonth } = await import("../od-utils");
		const result = await assignODForMonth(year, month, "manual-test");
		
		return NextResponse.json({
			message: "Manual OD rotation test completed",
			executedAt: utc8Time.toISOString(),
			targetMonth: `${year}-${month.toString().padStart(2, '0')}`,
			result
		});
		
	} catch (error: any) {
		console.error("Manual OD test error:", error);
		return NextResponse.json(
			{ 
				message: "Manual OD test failed",
				error: error.message 
			},
			{ status: 500 }
		);
	}
}