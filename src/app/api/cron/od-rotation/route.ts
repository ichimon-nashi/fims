// src/app/api/cron/od-rotation/route.ts
// MODIFIED: Combined OD Rotation + RR Review Reminders
// Location: Replace your existing src/app/api/cron/od-rotation/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		console.log("\n========================================");
		console.log("=== CRON: COMBINED DAILY TRIGGER ===");
		console.log("========================================");
		console.log("Triggered at:", new Date().toISOString());
		console.log("Taiwan time:", new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
		
		// Verify this is a legitimate cron request
		const authHeader = request.headers.get('authorization');
		const cronSecret = process.env.CRON_SECRET;
		
		if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
			console.log("❌ Unauthorized cron request");
			return NextResponse.json(
				{ message: "Unauthorized" },
				{ status: 401 }
			);
		}
		
		const results: any = {
			executedAt: new Date().toISOString(),
			taiwanTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
			tasks: []
		};
		
		// ===========================================
		// TASK 1: Check RR Reviews (EVERY DAY)
		// ===========================================
		console.log("\n--- TASK 1: Checking RR Reviews ---");
		
		try {
			const { findDueReviews, getEmailRecipients } = await import("./rr-notification-utils");
			
			// Find items due today (excludes deprecated items)
			const dueItems = await findDueReviews();
			
			if (dueItems.length > 0) {
				console.log(`Found ${dueItems.length} items due for review today`);
				
				// Get email recipients
				const recipients = await getEmailRecipients();
				console.log('Email recipients:', recipients);
				
				// Send email notification
				const emailResponse = await fetch(
					`${process.env.NEXT_PUBLIC_APP_URL}/api/send-rr-review-reminder`,
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							dueItems,
							recipients
						})
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
		
		// ===========================================
		// TASK 2: OD Rotation (ONLY ON 1ST OF MONTH)
		// ===========================================
		const now = new Date();
		const taiwanNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
		const dayOfMonth = taiwanNow.getDate();
		
		if (dayOfMonth === 1) {
			console.log("\n--- TASK 2: OD Rotation (1st of month) ---");
			
			try {
				// Calculate next month
				const nextMonth = taiwanNow.getMonth() + 2; // +1 for next month, +1 because getMonth() is 0-based
				const year = nextMonth > 12 ? taiwanNow.getFullYear() + 1 : taiwanNow.getFullYear();
				const month = nextMonth > 12 ? 1 : nextMonth;
				
				console.log(`Assigning OD duties for ${year}-${month.toString().padStart(2, '0')}`);
				
				// Import the assignment function from the utils file
				const { assignODForMonth } = await import("./od-utils");
				
				// Execute OD assignment with system user
				const odResult = await assignODForMonth(year, month, "system-cron");
				
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
		
		// ===========================================
		// SUMMARY
		// ===========================================
		console.log("\n========================================");
		console.log("=== CRON EXECUTION SUMMARY ===");
		console.log("========================================");
		console.log(JSON.stringify(results, null, 2));
		console.log("========================================\n");
		
		return NextResponse.json({
			success: true,
			message: "Combined cron job completed",
			...results
		});
		
	} catch (error: any) {
		console.error("\n========================================");
		console.error("=== CRON EXECUTION FAILED ===");
		console.error("========================================");
		console.error('Error:', error);
		console.error('Stack:', error.stack);
		console.error("========================================\n");
		
		return NextResponse.json(
			{ 
				success: false,
				message: "Combined cron job failed",
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
		
		// Allow forcing OD rotation for testing
		const forceOD = request.nextUrl.searchParams.get('forceOD') === 'true';
		const testYear = request.nextUrl.searchParams.get('year');
		const testMonth = request.nextUrl.searchParams.get('month');
		
		console.log("[TEST] Manual test trigger");
		console.log("[TEST] Force OD:", forceOD);
		
		const results: any = {
			executedAt: new Date().toISOString(),
			taiwanTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
			tasks: [],
			testMode: true
		};
		
		// Test RR Review check
		try {
			const { findDueReviews, getEmailRecipients } = await import("./rr-notification-utils");
			const dueItems = await findDueReviews();
			const recipients = await getEmailRecipients();
			
			results.tasks.push({
				task: 'RR Review Check (Test)',
				itemsFound: dueItems.length,
				recipients,
				items: dueItems
			});
		} catch (rrError: any) {
			results.tasks.push({
				task: 'RR Review Check (Test)',
				status: 'error',
				error: rrError.message
			});
		}
		
		// Test OD rotation if forced or if it's actually the 1st
		const now = new Date();
		const taiwanNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
		
		if (forceOD || taiwanNow.getDate() === 1) {
			try {
				const year = testYear ? parseInt(testYear) : taiwanNow.getFullYear();
				const month = testMonth ? parseInt(testMonth) : taiwanNow.getMonth() + 1;
				
				const { assignODForMonth } = await import("./od-utils");
				const odResult = await assignODForMonth(year, month, "manual-test");
				
				results.tasks.push({
					task: 'OD Rotation (Test)',
					status: 'success',
					targetMonth: `${year}-${month.toString().padStart(2, '0')}`,
					result: odResult
				});
			} catch (odError: any) {
				results.tasks.push({
					task: 'OD Rotation (Test)',
					status: 'error',
					error: odError.message
				});
			}
		}
		
		return NextResponse.json(results);
		
	} catch (error: any) {
		console.error("Manual test error:", error);
		
		return NextResponse.json(
			{ 
				message: "Manual test failed",
				error: error.message,
				stack: error.stack
			},
			{ status: 500 }
		);
	}
}