// src/app/api/cron/od-rotation/route.ts

import { NextRequest, NextResponse } from "next/server";

// Core logic shared by both automatic (GET) and manual (POST) triggers
async function runCronTasks(forceOD: boolean, testYear?: string, testMonth?: string, executedBy: string = 'system-cron') {
	const results: any = {
		executedAt: new Date().toISOString(),
		taiwanTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
		tasks: []
	};

	// TASK 1: Check RR Reviews (EVERY DAY)
	console.log("\n--- TASK 1: Checking RR Reviews ---");

	try {
		const { findDueReviews, getEmailRecipients } = await import("./rr-notification-utils");
		const dueItems = await findDueReviews();

		if (dueItems.length > 0) {
			console.log(`Found ${dueItems.length} items due for review today`);

			const recipients = await getEmailRecipients();
			console.log('Email recipients:', recipients);

			const emailResponse = await fetch(
				`${process.env.NEXT_PUBLIC_APP_URL}/api/send-rr-review-reminder`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ dueItems, recipients })
				}
			);

			const emailResult = await emailResponse.json();

			if (emailResult.success) {
				console.log('✅ Email sent successfully:', emailResult.messageId);
				results.tasks.push({
					task: 'RR Review Check',
					status: 'success',
					itemsFound: dueItems.length,
					emailSent: true,
					messageId: emailResult.messageId,
					recipients
				});
			} else {
				console.error('❌ Email failed:', emailResult.error);
				results.tasks.push({
					task: 'RR Review Check',
					status: 'email_failed',
					itemsFound: dueItems.length,
					emailSent: false,
					error: emailResult.error
				});
			}
		} else {
			console.log('✓ No items due for review today');
			results.tasks.push({
				task: 'RR Review Check',
				status: 'success',
				itemsFound: 0,
				emailSent: false,
				message: 'No items due today'
			});
		}

	} catch (rrError: any) {
		console.error('❌ RR Review check error:', rrError);
		results.tasks.push({
			task: 'RR Review Check',
			status: 'error',
			error: rrError.message
		});
	}

	// TASK 2: OD Rotation (ONLY ON 1ST OF MONTH, or if forced)
	const now = new Date();
	const taiwanNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
	const dayOfMonth = taiwanNow.getDate();

	if (forceOD || dayOfMonth === 1) {
		console.log("\n--- TASK 2: OD Rotation ---");

		try {
			const nextMonth = taiwanNow.getMonth() + 2;
			const calculatedYear = nextMonth > 12 ? taiwanNow.getFullYear() + 1 : taiwanNow.getFullYear();
			const calculatedMonth = nextMonth > 12 ? 1 : nextMonth;

			const year = testYear ? parseInt(testYear) : calculatedYear;
			const month = testMonth ? parseInt(testMonth) : calculatedMonth;

			console.log(`Assigning OD duties for ${year}-${month.toString().padStart(2, '0')}`);

			const { assignODForMonth } = await import("./od-utils");
			const odResult = await assignODForMonth(year, month, executedBy);

			console.log("✅ OD rotation completed:", odResult);

			results.tasks.push({
				task: 'OD Rotation',
				status: 'success',
				targetMonth: `${year}-${month.toString().padStart(2, '0')}`,
				result: odResult
			});

		} catch (odError: any) {
			console.error('❌ OD rotation error:', odError);
			results.tasks.push({
				task: 'OD Rotation',
				status: 'error',
				error: odError.message
			});
		}
	} else {
		console.log(`\n--- TASK 2: OD Rotation SKIPPED (not 1st of month, today is ${dayOfMonth}th) ---`);
		results.tasks.push({
			task: 'OD Rotation',
			status: 'skipped',
			reason: `Not 1st of month (today is ${dayOfMonth}th)`
		});
	}

	return results;
}

// ✅ GET — called automatically by Vercel cron runner every day
export async function GET(request: NextRequest) {
	try {
		console.log("\n========================================");
		console.log("=== CRON: GET TRIGGER ===");
		console.log("========================================");
		console.log("Triggered at:", new Date().toISOString());
		console.log("Taiwan time:", new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

		const authHeader = request.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;

		if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
			// Check if this is a manual test via query param
			const testSecret = request.nextUrl.searchParams.get('secret');
			if (testSecret !== cronSecret) {
				console.log("❌ Unauthorized request");
				return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
			}
			// Manual test via browser — allow forceOD and month overrides
			console.log("✅ Manual test trigger via query param");
			const forceOD = request.nextUrl.searchParams.get('forceOD') === 'true';
			const testYear = request.nextUrl.searchParams.get('year') ?? undefined;
			const testMonth = request.nextUrl.searchParams.get('month') ?? undefined;

			const results = await runCronTasks(forceOD, testYear, testMonth, 'manual-test');
			return NextResponse.json({ success: true, testMode: true, ...results });
		}

		// ✅ Vercel automatic cron invocation
		console.log("✅ Vercel cron invocation authenticated");
		const results = await runCronTasks(false, undefined, undefined, 'system-cron');

		console.log("\n========================================");
		console.log("=== CRON EXECUTION SUMMARY ===");
		console.log("========================================");
		console.log(JSON.stringify(results, null, 2));

		return NextResponse.json({
			success: true,
			message: "Cron job completed",
			...results
		});

	} catch (error: any) {
		console.error("=== CRON EXECUTION FAILED ===", error);
		return NextResponse.json(
			{
				success: false,
				message: "Cron job failed",
				error: error.message,
				executedAt: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
}

// POST — kept for any legacy manual triggers (e.g. curl with Bearer token)
export async function POST(request: NextRequest) {
	try {
		const authHeader = request.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;

		if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
			return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
		}

		const results = await runCronTasks(false, undefined, undefined, 'manual-post');

		return NextResponse.json({
			success: true,
			message: "Cron job completed via POST",
			...results
		});

	} catch (error: any) {
		console.error("POST cron error:", error);
		return NextResponse.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}