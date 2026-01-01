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
	const firstDay = new Date(year, month - 1, 1);
	const lastDay = new Date(year, month, 0);
	
	// Find first Monday of the month
	let currentDate = new Date(firstDay);
	while (currentDate.getDay() !== 1 && currentDate <= lastDay) {
		currentDate.setDate(currentDate.getDate() + 1);
	}
	
	let weekNumber = 1;
	
	// Process each week
	while (currentDate <= lastDay) {
		const weekDates: string[] = [];
		const weekStart = new Date(currentDate);
		
		// Collect Monday through Friday (5 days)
		for (let dayOfWeek = 1; dayOfWeek <= 5; dayOfWeek++) {
			if (currentDate.getMonth() === month - 1) { // Still in the target month
				const dateStr = currentDate.toISOString().split('T')[0];
				weekDates.push(dateStr);
			}
			currentDate.setDate(currentDate.getDate() + 1);
		}
		
		// Only add week if it has at least 3 work days
		if (weekDates.length >= 3) {
			weeks.push({
				weekNumber,
				startDate: weekStart,
				endDate: new Date(weekDates[weekDates.length - 1]),
				dates: weekDates
			});
			weekNumber++;
		}
		
		// Skip weekend (Saturday, Sunday) to get to next Monday
		while (currentDate.getDay() !== 1 && currentDate <= lastDay) {
			currentDate.setDate(currentDate.getDate() + 1);
		}
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
	
	// ✅ FIX: Assign OD for ALL weeks, not just week 2
	for (const week of weeks) {
		const assignedInstructor = getInstructorForWeek(year, month, week.weekNumber);
		
		console.log(`Week ${week.weekNumber} (${week.dates[0]} to ${week.dates[week.dates.length-1]}): ${assignedInstructor}`);
		
		// Get user details for this instructor
		const { data: userData, error: userError } = await supabase
			.from('users')
			.select('full_name, rank, base')
			.eq('employee_id', assignedInstructor)
			.single();
		
		if (userError || !userData) {
			console.error(`Error getting user data for ${assignedInstructor}:`, userError);
			continue; // Skip this instructor if we can't get their data
		}
		
		// Assign OD for each day of the week
		for (const date of week.dates) {
			try {
				// Check if entry exists
				const { data: existing } = await supabase
					.from('fi_schedule')
					.select('*')
					.eq('employee_id', assignedInstructor)
					.eq('date', date)
					.single();
				
				if (existing) {
					// Update existing entry - add OD if not already present
					const currentDuties = existing.duties || [];
					if (!currentDuties.includes('OD')) {
						const { error: updateError } = await supabase
							.from('fi_schedule')
							.update({ 
								duties: [...currentDuties, 'OD'],
								updated_by: executedBy
							})
							.eq('employee_id', assignedInstructor)
							.eq('date', date);
						
						if (updateError) {
							console.error(`Error updating OD for ${assignedInstructor} on ${date}:`, updateError);
						} else {
							console.log(`✓ Updated OD for ${assignedInstructor} on ${date}`);
						}
					} else {
						console.log(`- OD already exists for ${assignedInstructor} on ${date}`);
					}
				} else {
					// Create new entry with full user data
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