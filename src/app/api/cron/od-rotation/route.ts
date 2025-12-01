// src/app/api/cron/od-rotation/route.ts
import { NextRequest, NextResponse } from "next/server";

// This endpoint will be called by Vercel Cron on the 1st of each month
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
		
		// Calculate next month
		const now = new Date();
		const nextMonth = now.getMonth() + 2; // +1 for next month, +1 because getMonth() is 0-based
		const year = nextMonth > 12 ? now.getFullYear() + 1 : now.getFullYear();
		const month = nextMonth > 12 ? 1 : nextMonth;
		
		console.log(`Assigning OD duties for ${year}-${month.toString().padStart(2, '0')}`);
		
		// Import the assignment function from the utils file
		const { assignODForMonth } = await import("../od-utils");
		
		// Execute OD assignment with system user
		const result = await assignODForMonth(year, month, "system-cron");
		
		console.log("Cron OD rotation result:", result);
		
		return NextResponse.json({
			message: "Automated OD rotation completed successfully",
			executedAt: new Date().toISOString(),
			targetMonth: `${year}-${month.toString().padStart(2, '0')}`,
			result
		});
		
	} catch (error: any) {
		console.error("Cron OD rotation error:", error);
		
		return NextResponse.json(
			{ 
				message: "Automated OD rotation failed",
				error: error.message,
				executedAt: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
}

// GET endpoint for manual testing/triggering
export async function GET(request: NextRequest) {
	try {
		console.log("=== CRON: MANUAL TEST TRIGGER ===");
		
		// Only allow with secret key
		const testSecret = request.nextUrl.searchParams.get('secret');
		const cronSecret = process.env.CRON_SECRET;
		
		if (testSecret !== cronSecret) {
			console.log("Unauthorized manual test request");
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}
		
		// Get optional month/year parameters for testing
		const testYear = request.nextUrl.searchParams.get('year');
		const testMonth = request.nextUrl.searchParams.get('month');
		
		const now = new Date();
		const year = testYear ? parseInt(testYear) : now.getFullYear();
		const month = testMonth ? parseInt(testMonth) : now.getMonth() + 1;
		
		console.log(`[TEST] Manual OD assignment for ${year}-${month.toString().padStart(2, '0')}`);
		
		const { assignODForMonth } = await import("../od-utils");
		const result = await assignODForMonth(year, month, "manual-test");
		
		console.log("[TEST] Assignment completed:", result);
		
		return NextResponse.json({
			message: "Manual OD rotation test completed",
			executedAt: new Date().toISOString(),
			targetMonth: `${year}-${month.toString().padStart(2, '0')}`,
			result
		});
		
	} catch (error: any) {
		console.error("Manual OD test error:", error);
		console.error("Stack trace:", error.stack);
		
		return NextResponse.json(
			{ 
				message: "Manual OD test failed",
				error: error.message,
				stack: error.stack
			},
			{ status: 500 }
		);
	}
}