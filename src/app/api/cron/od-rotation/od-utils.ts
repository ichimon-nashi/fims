// src/app/api/cron/od-utils.ts
import { createClient } from "@supabase/supabase-js";

// Create service role client (bypasses RLS)
function getServiceClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
	const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
	
	return createClient(supabaseUrl, supabaseServiceKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});
}

// ✅ UPDATED: All 4 OD rotation instructors
export const OD_INSTRUCTORS = ["22018", "36639", "39426", "51892"];

// Base rotation state (September 2024)
const BASE_ROTATION: {
	year: number;
	month: number;
	assignments: Record<string, number>;
} = {
	year: 2024,
	month: 9,
	assignments: {
		"22018": 1,  // Week 1
		"36639": 2,  // Week 2
		"39426": 3,  // Week 3
		"51892": 4   // Week 4
	}
};

export interface WeekInfo {
	weekNumber: number;
	startDate: Date;
	endDate: Date;
	dates: string[];
}

// Get all Monday-Friday weeks in a month
export function getMonthWeeks(year: number, month: number): WeekInfo[] {
	const weeks: WeekInfo[] = [];
	
	let weekNumber = 1;
	// eslint-disable-next-line prefer-const
	let currentDate = new Date(Date.UTC(year, month - 1, 1));
	const lastDay = new Date(Date.UTC(year, month, 0));
	
	// Find all Mondays in the month
	while (currentDate <= lastDay) {
		// Only process if this is a Monday (day === 1) - use getUTCDay()
		if (currentDate.getUTCDay() === 1) {
			const weekDates: string[] = [];
			const weekStart = new Date(currentDate);
			
			// Collect ONLY Monday through Friday (5 consecutive weekdays)
			// eslint-disable-next-line prefer-const
			let checkDate = new Date(weekStart);
			for (let i = 0; i < 5; i++) {
				const dayOfWeek = checkDate.getUTCDay(); // Use UTC day
				const dateStr = checkDate.toISOString().split('T')[0];
				
				// Double-check: ONLY add if it's a weekday (1-5) AND in target month
				if (dayOfWeek >= 1 && dayOfWeek <= 5 && checkDate.getUTCMonth() === month - 1) {
					weekDates.push(dateStr);
				}
				
				// Move to next day using UTC
				checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
			}
			
			// Only add week if we got at least 3 weekdays
			if (weekDates.length >= 3) {
				weeks.push({
					weekNumber,
					startDate: weekStart,
					endDate: new Date(weekDates[weekDates.length - 1]),
					dates: weekDates
				});
				weekNumber++;
			}
		}
		
		// Move to next day using UTC
		currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
	}
	
	return weeks;
}

// Calculate months elapsed since base rotation
function getMonthsElapsed(year: number, month: number): number {
	const baseDate = new Date(BASE_ROTATION.year, BASE_ROTATION.month - 1);
	const targetDate = new Date(year, month - 1);
	
	const yearDiff = targetDate.getFullYear() - baseDate.getFullYear();
	const monthDiff = targetDate.getMonth() - baseDate.getMonth();
	
	return yearDiff * 12 + monthDiff;
}

// Get instructor assignment for a specific week
function getInstructorForWeek(year: number, month: number, weekNumber: number): string {
	const monthsElapsed = getMonthsElapsed(year, month);
	
	// Calculate rotated positions
	const rotatedAssignments: Record<string, number> = {};
	
	for (const instructor of OD_INSTRUCTORS) {
		const baseWeek = BASE_ROTATION.assignments[instructor];
		// Rotate: each month, instructor moves to next week position
		const newWeek = ((baseWeek - 1 + monthsElapsed) % 4) + 1;
		rotatedAssignments[instructor] = newWeek;
	}
	
	// Find which instructor is assigned to this week
	for (const instructor of OD_INSTRUCTORS) {
		if (rotatedAssignments[instructor] === weekNumber) {
			return instructor;
		}
	}
	
	// Fallback: shouldn't happen, but assign in order
	return OD_INSTRUCTORS[(weekNumber - 1) % OD_INSTRUCTORS.length];
}

// Main function to assign OD for a month
export async function assignODForMonth(
	year: number, 
	month: number, 
	executedBy: string = 'cron'
): Promise<{
	year: number;
	month: number;
	totalWeeks: number;
	totalAssignments: number;
	assignments: Array<{
		date: string;
		instructor: string;
		week: number;
	}>;
}> {
	const monthStr = month < 10 ? `0${month}` : `${month}`;
	console.log(`\n=== Assigning OD for ${year}-${monthStr} ===`);
	console.log(`Executed by: ${executedBy}`);
	
	const supabase = getServiceClient();
	const weeks = getMonthWeeks(year, month);
	
	console.log(`Found ${weeks.length} weeks in ${year}-${month}`);
	
	const assignments = [];
	
	// ✅ FIX: Assign OD for ALL weeks, ensuring full week coverage
	for (const week of weeks) {
		const primaryInstructor = getInstructorForWeek(year, month, week.weekNumber);
		
		console.log(`Week ${week.weekNumber} (${week.dates[0]} to ${week.dates[week.dates.length-1]}): Primary = ${primaryInstructor}`);
		
		// Check if primary instructor has conflicts for this entire week
		let hasConflict = false;
		for (const date of week.dates) {
			const { data: existing } = await supabase
				.from('fi_schedule')
				.select('duties')
				.eq('employee_id', primaryInstructor)
				.eq('date', date)
				.maybeSingle();
			
			if (existing && existing.duties && existing.duties.length > 0) {
				console.log(`⚠ ${primaryInstructor} has conflict on ${date}: ${existing.duties.join(', ')}`);
				hasConflict = true;
				break; // Stop checking, we found a conflict
			}
		}
		
		// Determine which instructor will get this week
		let assignedInstructor = primaryInstructor;
		
		if (hasConflict) {
			console.log(`⚠ ${primaryInstructor} has conflicts in week ${week.weekNumber}, finding alternative...`);
			
			// Try to find an available instructor from the pool
			let foundAlternative = false;
			for (const altInstructor of OD_INSTRUCTORS) {
				if (altInstructor === primaryInstructor) continue; // Skip the one with conflict
				
				// Check if this alternative has conflicts
				let altHasConflict = false;
				for (const date of week.dates) {
					const { data: existing } = await supabase
						.from('fi_schedule')
						.select('duties')
						.eq('employee_id', altInstructor)
						.eq('date', date)
						.maybeSingle();
					
					if (existing && existing.duties && existing.duties.length > 0) {
						altHasConflict = true;
						break;
					}
				}
				
				if (!altHasConflict) {
					assignedInstructor = altInstructor;
					foundAlternative = true;
					console.log(`✓ Found alternative: ${altInstructor} for week ${week.weekNumber}`);
					break;
				}
			}
			
			if (!foundAlternative) {
				console.log(`❌ No available instructor for week ${week.weekNumber}, skipping entire week`);
				continue; // Skip this entire week
			}
		}
		
		// Get user details for the assigned instructor
		const { data: userData, error: userError } = await supabase
			.from('users')
			.select('full_name, rank, base')
			.eq('employee_id', assignedInstructor)
			.single();
		
		if (userError || !userData) {
			console.error(`Error getting user data for ${assignedInstructor}:`, userError);
			continue;
		}
		
		// Assign OD for the full week to this instructor
		for (const date of week.dates) {
			try {
				const { data: existing } = await supabase
					.from('fi_schedule')
					.select('*')
					.eq('employee_id', assignedInstructor)
					.eq('date', date)
					.maybeSingle();
				
				if (existing && (!existing.duties || existing.duties.length === 0)) {
					// Entry exists but has no duties - update with OD
					const { error: updateError } = await supabase
						.from('fi_schedule')
						.update({ 
							duties: ['OD'],
							updated_by: executedBy
						})
						.eq('employee_id', assignedInstructor)
						.eq('date', date);
					
					if (updateError) {
						console.error(`Error updating OD for ${assignedInstructor} on ${date}:`, updateError);
					} else {
						console.log(`✓ Updated OD for ${assignedInstructor} on ${date}`);
					}
				} else if (!existing) {
					// No entry exists - create new with OD
					const { error: insertError } = await supabase
						.from('fi_schedule')
						.insert({
							employee_id: assignedInstructor,
							full_name: userData.full_name,
							rank: userData.rank,
							base: userData.base,
							date: date,
							duties: ['OD'],
							year: year,
							created_by: executedBy,
							updated_by: executedBy
						});
					
					if (insertError) {
						console.error(`Error inserting OD for ${assignedInstructor} on ${date}:`, insertError);
					} else {
						console.log(`✓ Created OD for ${assignedInstructor} on ${date}`);
					}
				}
				
				assignments.push({
					date,
					instructor: assignedInstructor,
					week: week.weekNumber
				});
				
			} catch (err) {
				console.error(`Unexpected error for ${assignedInstructor} on ${date}:`, err);
			}
		}
	}
	
	console.log(`\n=== OD Assignment Complete ===`);
	console.log(`Total assignments: ${assignments.length}`);
	
	return {
		year,
		month,
		totalWeeks: weeks.length,
		totalAssignments: assignments.length,
		assignments
	};
}