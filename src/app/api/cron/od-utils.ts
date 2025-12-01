// src/app/api/cron/od-utils.ts
import { createServiceClient } from "@/utils/supabase/service-client";

// Direct database operations using service client (bypasses RLS and JWT)
async function getScheduleEntry(employeeId: string, date: string) {
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from('fi_schedule')
		.select('*')
		.eq('employee_id', employeeId)
		.eq('date', date)
		.single();
	
	if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
	return data;
}

async function createOrUpdateScheduleEntry(entryData: any) {
	const supabase = createServiceClient();
	
	// Add year field from date
	const year = new Date(entryData.date).getFullYear();
	
	const { data, error } = await supabase
		.from('fi_schedule')
		.upsert({
			...entryData,
			year,
			updated_at: new Date().toISOString()
		}, {
			onConflict: 'employee_id,date'
		})
		.select()
		.single();
	
	if (error) {
		console.error('[OD-CRON] Database error:', error);
		throw new Error(`Database error: ${error.message || JSON.stringify(error)}`);
	}
	return data;
}

// OD rotation instructors in order (4 instructors)
export const OD_INSTRUCTORS = ["39426", "22018", "51892", "36639"];

export interface WeekInfo {
	weekNumber: number;
	startDate: Date;
	endDate: Date;
	dates: string[];
}

// Helper functions to get instructor details
export function getInstructorName(employeeId: string): string {
	const names: { [key: string]: string } = {
		"22018": "凌誌謙",
		"39426": "柯佳華",
		"51892": "韓建豪",
		"36639": "李盈瑤", 
	};
	return names[employeeId] || "Unknown Instructor";
}

export function getInstructorBase(employeeId: string): string {
	const bases: { [key: string]: string } = {
		"22018": "TSA",
		"39426": "TSA",
		"51892": "KHH",
		"36639": "TSA",
	};
	return bases[employeeId] || "TSA";
}

// Get all Monday-Friday weeks in a month
export function getMonthWeeks(year: number, month: number): WeekInfo[] {
	const weeks: WeekInfo[] = [];
	const firstDay = new Date(year, month - 1, 1);
	const lastDay = new Date(year, month, 0);

	// Find first Monday of the month
	const currentDate = new Date(firstDay);
	while (currentDate.getDay() !== 1 && currentDate <= lastDay) {
		currentDate.setDate(currentDate.getDate() + 1);
	}

	let weekNumber = 1;

	while (currentDate <= lastDay) {
		const weekStart = new Date(currentDate);
		const weekDates: string[] = [];

		// Get Monday through Friday of this week
		for (let i = 0; i < 5; i++) {
			const workDay = new Date(weekStart);
			workDay.setDate(weekStart.getDate() + i);

			// Only include if it's still in the target month
			if (workDay.getMonth() === month - 1) {
				weekDates.push(workDay.toISOString().split("T")[0]);
			}
		}

		// Only add week if it has ALL 5 weekdays in the target month
		// This ensures OD weeks are complete Monday-Friday
		if (weekDates.length === 5) {
			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekStart.getDate() + 4); // Friday

			weeks.push({
				weekNumber,
				startDate: weekStart,
				endDate: weekEnd,
				dates: weekDates,
			});
			weekNumber++;
		}

		// Move to next Monday
		currentDate.setDate(currentDate.getDate() + 7);
	}

	return weeks;
}

// Check if a week has any conflicting duties for an instructor
async function hasConflictInWeek(
	employeeId: string,
	weekDates: string[]
): Promise<boolean> {
	for (const date of weekDates) {
		const existingEntry = await getScheduleEntry(employeeId, date);
		// Conflict if there are ANY duties on that day (excluding OD which we might be updating)
		if (existingEntry && existingEntry.duties.length > 0) {
			const nonOdDuties = existingEntry.duties.filter((d: string) => d !== "OD");
			if (nonOdDuties.length > 0) {
				console.log(`[OD-CRON] Conflict found for ${employeeId} on ${date}: ${nonOdDuties.join(", ")}`);
				return true;
			}
		}
	}
	return false;
}

// Get the last OD assignment for an instructor
async function getLastOdAssignment(
	employeeId: string,
	beforeYear: number,
	beforeMonth: number
): Promise<{ year: number; month: number; weekNumber: number } | null> {
	// Search backwards through previous months to find last OD assignment
	let searchYear = beforeMonth === 1 ? beforeYear - 1 : beforeYear;
	let searchMonth = beforeMonth === 1 ? 12 : beforeMonth - 1;
	
	// Search up to 6 months back
	for (let i = 0; i < 6; i++) {
		const weeks = getMonthWeeks(searchYear, searchMonth);
		
		// Check each week for OD assignment
		for (const week of weeks) {
			// Check if this instructor has OD on ANY day of this week
			let hasOdInWeek = false;
			for (const date of week.dates) {
				const entry = await getScheduleEntry(employeeId, date);
				if (entry && entry.duties.includes("OD")) {
					hasOdInWeek = true;
					break;
				}
			}
			
			if (hasOdInWeek) {
				console.log(`[OD-CRON] Found last OD for ${employeeId}: ${searchYear}-${searchMonth} week ${week.weekNumber}`);
				return {
					year: searchYear,
					month: searchMonth,
					weekNumber: week.weekNumber
				};
			}
		}
		
		// Move to previous month
		searchMonth--;
		if (searchMonth === 0) {
			searchMonth = 12;
			searchYear--;
		}
	}
	
	return null;
}

// Calculate next OD week for an instructor based on rotation
// Rotation moves BACKWARD: Week 2 → Week 1, Week 1 → Week 4, etc.
function calculateNextOdWeek(
	lastWeekNumber: number,
	totalWeeksInLastMonth: number,
	totalWeeksInTargetMonth: number
): number {
	// Move to PREVIOUS week in rotation (backward/earlier)
	let nextWeek = lastWeekNumber - 1;
	
	// If we go below week 1, wrap to last week of target month
	if (nextWeek < 1) {
		nextWeek = totalWeeksInTargetMonth;
	}
	
	// If the calculated week doesn't exist in target month, wrap around
	if (nextWeek > totalWeeksInTargetMonth) {
		nextWeek = totalWeeksInTargetMonth;
	}
	
	return nextWeek;
}

// Assign OD duties for a month
export async function assignODForMonth(
	year: number,
	month: number,
	createdBy: string
): Promise<{
	assigned: number;
	skipped: number;
	details: string[];
}> {
	console.log(`[OD-CRON] ═══════════════════════════════════════`);
	console.log(`[OD-CRON] Assigning OD duties for ${year}-${month.toString().padStart(2, "0")}`);
	console.log(`[OD-CRON] ═══════════════════════════════════════`);

	const weeks = getMonthWeeks(year, month);
	console.log(`[OD-CRON] Available complete weeks in month: ${weeks.length}`);
	weeks.forEach((w: WeekInfo) => {
		console.log(`[OD-CRON]   Week ${w.weekNumber}: ${w.dates[0]} to ${w.dates[4]}`);
	});

	let assigned = 0;
	let skipped = 0;
	const details: string[] = [];
	const weekAssignments: { [weekNumber: number]: string } = {};
	
	// Track which instructors are available for each week (no conflicts)
	const instructorAvailability: { [weekNumber: number]: string[] } = {};
	
	// Pre-calculate availability for all instructors and weeks
	console.log(`[OD-CRON] ───────────────────────────────────────`);
	console.log(`[OD-CRON] Phase 0: Checking availability for all instructors`);
	for (const week of weeks) {
		instructorAvailability[week.weekNumber] = [];
		for (const instructor of OD_INSTRUCTORS) {
			const hasConflict = await hasConflictInWeek(instructor, week.dates);
			if (!hasConflict) {
				instructorAvailability[week.weekNumber].push(instructor);
			}
		}
		console.log(`[OD-CRON]   Week ${week.weekNumber}: ${instructorAvailability[week.weekNumber].length} available instructors - ${instructorAvailability[week.weekNumber].join(', ') || 'NONE'}`);
	}

	// PHASE 1: Try to assign instructors to their target weeks (based on rotation)
	console.log(`[OD-CRON] ───────────────────────────────────────`);
	console.log(`[OD-CRON] Phase 1: Rotation-based assignment`);
	
	for (let instructorIndex = 0; instructorIndex < OD_INSTRUCTORS.length; instructorIndex++) {
		const instructor = OD_INSTRUCTORS[instructorIndex];
		console.log(`[OD-CRON] ───────────────────────────────────────`);
		console.log(`[OD-CRON] Processing instructor: ${instructor} (${getInstructorName(instructor)})`);

		// Find their last OD assignment
		const lastOd = await getLastOdAssignment(instructor, year, month);
		
		let targetWeek: number;
		
		if (!lastOd) {
			// New instructor with no previous OD - find first available week
			console.log(`[OD-CRON]   No previous OD found - new instructor, will find first available week`);
			targetWeek = 1; // Start from week 1, will search for available week
		} else {
			// Get previous month's total weeks for calculation
			const prevMonth = month === 1 ? 12 : month - 1;
			const prevYear = month === 1 ? year - 1 : year;
			const prevMonthWeeks = getMonthWeeks(prevYear, prevMonth);

			// Calculate next week in rotation
			targetWeek = calculateNextOdWeek(
				lastOd.weekNumber,
				prevMonthWeeks.length,
				weeks.length
			);

			console.log(`[OD-CRON]   Last OD: ${lastOd.year}-${lastOd.month} week ${lastOd.weekNumber}`);
		}
		
		console.log(`[OD-CRON]   Target week: ${targetWeek}`);

		// Try to find an available week (check for conflicts and already-assigned weeks)
		let weekFound = false;
		let attemptCount = 0;
		const maxAttempts = weeks.length;

		while (!weekFound && attemptCount < maxAttempts) {
			const weekInfo = weeks.find((w: WeekInfo) => w.weekNumber === targetWeek);

			if (!weekInfo) {
				console.log(`[OD-CRON]   Week ${targetWeek} doesn't exist, trying next week`);
				targetWeek = (targetWeek % weeks.length) + 1;
				attemptCount++;
				continue;
			}

			// Check if week is already assigned to another instructor
			if (weekAssignments[targetWeek]) {
				console.log(`[OD-CRON]   Week ${targetWeek} already assigned to ${weekAssignments[targetWeek]}, trying next week`);
				targetWeek = (targetWeek % weeks.length) + 1;
				attemptCount++;
				continue;
			}

			// Check for duty conflicts
			const hasConflict = await hasConflictInWeek(instructor, weekInfo.dates);
			
			if (hasConflict) {
				console.log(`[OD-CRON]   Week ${targetWeek} has conflicts, trying next week`);
				targetWeek = (targetWeek % weeks.length) + 1;
				attemptCount++;
				continue;
			}

			// Week is available!
			weekFound = true;
			weekAssignments[targetWeek] = instructor;
			console.log(`[OD-CRON]   ✓ Assigning week ${targetWeek} (${weekInfo.dates[0]} to ${weekInfo.dates[4]})`);

			// Assign OD for each day in the week
			for (const date of weekInfo.dates) {
				try {
					const existingEntry = await getScheduleEntry(instructor, date);
					const existingDuties = existingEntry?.duties || [];

					// Skip if OD already assigned
					if (existingDuties.includes("OD")) {
						console.log(`[OD-CRON]     ${date}: OD already exists, skipping`);
						skipped++;
						continue;
					}

					// Add OD to duties
					const newDuties = [...existingDuties, "OD"];

					await createOrUpdateScheduleEntry({
						employee_id: instructor,
						full_name: getInstructorName(instructor),
						rank: "FI - Flight Attendant Instructor",
						base: getInstructorBase(instructor),
						date: date,
						duties: newDuties,
						created_by: createdBy,
					});

					console.log(`[OD-CRON]     ${date}: OD assigned ✓`);
					assigned++;
				} catch (error: any) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					const msg = `${instructor} ${date}: Error - ${errorMsg}`;
					console.error(`[OD-CRON]     ${date}: Error assigning OD:`, error);
					details.push(msg);
					skipped++;
				}
			}

			const msg = `${instructor}: Assigned to week ${targetWeek} (${weekInfo.dates[0]} to ${weekInfo.dates[4]})`;
			details.push(msg);
		}

		if (!weekFound) {
			const msg = `${instructor}: Could not find available week after ${maxAttempts} attempts`;
			console.log(`[OD-CRON]   ✗ ${msg}`);
			details.push(msg);
		}
	}

	// PHASE 2: Fill any unassigned weeks with available instructors
	console.log(`[OD-CRON] ───────────────────────────────────────`);
	console.log(`[OD-CRON] Phase 2: Filling unassigned weeks`);
	
	const unassignedWeeks = weeks.filter((w: WeekInfo) => !weekAssignments[w.weekNumber]);
	
	if (unassignedWeeks.length > 0) {
		console.log(`[OD-CRON]   Found ${unassignedWeeks.length} unassigned weeks`);
		
		for (const week of unassignedWeeks) {
			console.log(`[OD-CRON]   Trying to fill Week ${week.weekNumber} (${week.dates[0]} to ${week.dates[4]})`);
			
			// Find available instructors for this week who aren't assigned yet
			const availableInstructors = instructorAvailability[week.weekNumber].filter(
				(instructor: string) => !Object.values(weekAssignments).includes(instructor)
			);
			
			if (availableInstructors.length === 0) {
				const msg = `Week ${week.weekNumber}: ❌ NO INSTRUCTOR AVAILABLE - all have conflicts or already assigned`;
				console.log(`[OD-CRON]     ${msg}`);
				details.push(msg);
				continue;
			}
			
			// Assign the first available instructor
			const instructor = availableInstructors[0];
			weekAssignments[week.weekNumber] = instructor;
			console.log(`[OD-CRON]     ✓ Assigning ${instructor} to Week ${week.weekNumber}`);
			
			// Assign OD for each day in the week
			for (const date of week.dates) {
				try {
					const existingEntry = await getScheduleEntry(instructor, date);
					const existingDuties = existingEntry?.duties || [];

					// Skip if OD already assigned
					if (existingDuties.includes("OD")) {
						console.log(`[OD-CRON]       ${date}: OD already exists, skipping`);
						skipped++;
						continue;
					}

					// Add OD to duties
					const newDuties = [...existingDuties, "OD"];

					await createOrUpdateScheduleEntry({
						employee_id: instructor,
						full_name: getInstructorName(instructor),
						rank: "FI - Flight Attendant Instructor",
						base: getInstructorBase(instructor),
						date: date,
						duties: newDuties,
						created_by: createdBy,
					});

					console.log(`[OD-CRON]       ${date}: OD assigned ✓`);
					assigned++;
				} catch (error: any) {
					const errorMsg = error instanceof Error ? error.message : String(error);
					const msg = `${instructor} ${date}: Error - ${errorMsg}`;
					console.error(`[OD-CRON]       ${date}: Error assigning OD:`, error);
					details.push(msg);
					skipped++;
				}
			}
			
			const msg = `Week ${week.weekNumber}: Filled with ${instructor} (${week.dates[0]} to ${week.dates[4]})`;
			details.push(msg);
		}
	} else {
		console.log(`[OD-CRON]   ✓ All weeks assigned in Phase 1`);
	}

	console.log(`[OD-CRON] ═══════════════════════════════════════`);
	console.log(`[OD-CRON] Assignment complete`);
	console.log(`[OD-CRON]   Assigned: ${assigned} days`);
	console.log(`[OD-CRON]   Skipped: ${skipped} days`);
	console.log(`[OD-CRON]   Week coverage: ${Object.keys(weekAssignments).length}/${weeks.length} weeks`);
	console.log(`[OD-CRON] ═══════════════════════════════════════`);
	
	return { assigned, skipped, details };
}