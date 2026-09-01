// src/app/api/cron/od-rotation/od-utils.ts
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

// Full known OD-capable roster, for reference only. Scheduling is driven by
// ACTIVE_ROTATION_INSTRUCTORS below, not this list.
export const OD_INSTRUCTORS = ["22018", "36639", "39426", "51892", "39462"];

// ✅ CURRENT ACTIVE ROTATION (as of this change). 39462 is now a full rotation
// member, not an emergency backup — his historical OD-days count toward
// fairness like everyone else's.
export const ACTIVE_ROTATION_INSTRUCTORS = ["22018", "39426", "39462", "51892"];

// Paused until reactivated. To bring 36639 back: move him into
// ACTIVE_ROTATION_INSTRUCTORS above.
export const PAUSED_INSTRUCTORS = ["36639"];

// Hard constraint: these two share one table at TSA base and must never both
// have OD in the same week. Add more pairs here if other base conflicts exist.
const MUTUALLY_EXCLUSIVE_PAIRS: Array<[string, string]> = [
	["22018", "39426"]
];

function violatesMutualExclusion(candidate: string, alreadyAssignedThisWeek: string[]): boolean {
	return MUTUALLY_EXCLUSIVE_PAIRS.some(([a, b]) => {
		if (candidate === a) return alreadyAssignedThisWeek.includes(b);
		if (candidate === b) return alreadyAssignedThisWeek.includes(a);
		return false;
	});
}

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
	let currentDate = new Date(Date.UTC(year, month - 1, 1));
	const lastDay = new Date(Date.UTC(year, month, 0));

	while (currentDate <= lastDay) {
		if (currentDate.getUTCDay() === 1) {
			const weekDates: string[] = [];
			const weekStart = new Date(currentDate);

			let checkDate = new Date(weekStart);
			for (let i = 0; i < 5; i++) {
				const dayOfWeek = checkDate.getUTCDay();
				const dateStr = checkDate.toISOString().split('T')[0];

				if (dayOfWeek >= 1 && dayOfWeek <= 5 && checkDate.getUTCMonth() === month - 1) {
					weekDates.push(dateStr);
				}

				checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
			}

			// Boundary weeks (month start/end) can legitimately have 3-4
			// weekdays instead of 5 — calendar fact, not a bug.
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

		currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
	}

	return weeks;
}

async function hasConflict(supabase: any, employeeId: string, dates: string[]): Promise<boolean> {
	for (const date of dates) {
		const { data: existing } = await supabase
			.from('fi_schedule')
			.select('duties')
			.eq('employee_id', employeeId)
			.eq('date', date)
			.maybeSingle();

		if (existing && existing.duties && existing.duties.length > 0) {
			return true;
		}
	}
	return false;
}

// Historical OD-day counts per instructor, counted strictly BEFORE the target
// month. This is what makes fairness self-correcting: whoever is behind
// (e.g. 51892 at ~3 vs 22018 at ~8) automatically gets picked first in every
// week they're conflict-free, until the gap closes.
async function getHistoricalOdCounts(
	supabase: any,
	instructors: string[],
	beforeDate: string
): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	instructors.forEach(id => { counts[id] = 0; });

	const { data, error } = await supabase
		.from('fi_schedule')
		.select('employee_id, duties, date')
		.in('employee_id', instructors)
		.lt('date', beforeDate);

	if (error) {
		console.error('Error fetching historical OD counts:', error);
		return counts;
	}

	for (const row of data ?? []) {
		if (row.duties && Array.isArray(row.duties) && row.duties.includes('OD')) {
			counts[row.employee_id] = (counts[row.employee_id] ?? 0) + 1;
		}
	}

	return counts;
}

async function assignInstructorToWeek(
	supabase: any,
	instructor: string,
	week: WeekInfo,
	year: number,
	executedBy: string
): Promise<boolean> {
	const { data: userData, error: userError } = await supabase
		.from('users')
		.select('full_name, rank, base')
		.eq('employee_id', instructor)
		.single();

	if (userError || !userData) {
		console.error(`Error getting user data for ${instructor}:`, userError);
		return false;
	}

	for (const date of week.dates) {
		try {
			const { data: existing } = await supabase
				.from('fi_schedule')
				.select('*')
				.eq('employee_id', instructor)
				.eq('date', date)
				.maybeSingle();

			if (existing && (!existing.duties || existing.duties.length === 0)) {
				const { error: updateError } = await supabase
					.from('fi_schedule')
					.update({ duties: ['OD'], updated_by: executedBy })
					.eq('employee_id', instructor)
					.eq('date', date);

				if (updateError) {
					console.error(`Error updating OD for ${instructor} on ${date}:`, updateError);
				} else {
					console.log(`✓ Updated OD for ${instructor} on ${date}`);
				}
			} else if (!existing) {
				const { error: insertError } = await supabase
					.from('fi_schedule')
					.insert({
						employee_id: instructor,
						full_name: userData.full_name,
						rank: userData.rank,
						base: userData.base,
						date,
						duties: ['OD'],
						year,
						created_by: executedBy,
						updated_by: executedBy
					});

				if (insertError) {
					console.error(`Error inserting OD for ${instructor} on ${date}:`, insertError);
				} else {
					console.log(`✓ Created OD for ${instructor} on ${date}`);
				}
			}
		} catch (err) {
			console.error(`Unexpected error for ${instructor} on ${date}:`, err);
		}
	}

	return true;
}

export async function assignODForMonth(
	year: number,
	month: number,
	executedBy: string = 'cron'
): Promise<{
	year: number;
	month: number;
	totalWeeks: number;
	totalAssignments: number;
	assignments: Array<{ date: string; instructor: string; week: number }>;
	unfilledWeeks: number[];
	finalOdDayCounts: Record<string, number>;
}> {
	const monthStr = month < 10 ? `0${month}` : `${month}`;
	console.log(`\n=== Assigning OD for ${year}-${monthStr} ===`);
	console.log(`Executed by: ${executedBy}`);
	console.log(`Active rotation: ${ACTIVE_ROTATION_INSTRUCTORS.join(', ')}`);
	if (PAUSED_INSTRUCTORS.length > 0) {
		console.log(`Paused (excluded): ${PAUSED_INSTRUCTORS.join(', ')}`);
	}

	const supabase = getServiceClient();
	const weeks = getMonthWeeks(year, month);
	const monthStart = `${year}-${monthStr}-01`;

	const counts = await getHistoricalOdCounts(supabase, ACTIVE_ROTATION_INSTRUCTORS, monthStart);
	console.log('Starting OD-day counts (all history before this month):', counts);

	const assignments: Array<{ date: string; instructor: string; week: number }> = [];
	const unfilledWeeks: WeekInfo[] = [];

	for (const week of weeks) {
		console.log(`\nWeek ${week.weekNumber} (${week.dates[0]} to ${week.dates[week.dates.length - 1]})`);

		const candidates: string[] = [];
		for (const id of ACTIVE_ROTATION_INSTRUCTORS) {
			if (!(await hasConflict(supabase, id, week.dates))) {
				candidates.push(id);
			}
		}

		if (candidates.length === 0) {
			console.log(`⚠ IMPOSSIBLE: no active instructor is conflict-free for week ${week.weekNumber}`);
			unfilledWeeks.push(week);
			continue;
		}

		// Fewest OD-days first; 51892 wins ties; then stable roster order.
		candidates.sort((a, b) => {
			if (counts[a] !== counts[b]) return counts[a] - counts[b];
			if (a === "51892" && b !== "51892") return -1;
			if (b === "51892" && a !== "51892") return 1;
			return ACTIVE_ROTATION_INSTRUCTORS.indexOf(a) - ACTIVE_ROTATION_INSTRUCTORS.indexOf(b);
		});

		const assigned = candidates[0];

		// Defensive guard for the TSA shared-table constraint. Inert under
		// the current one-instructor-per-week model (nothing is ever in
		// "alreadyAssignedThisWeek" yet), but keeps the constraint enforced
		// if this ever becomes a multi-assignee-per-week model.
		if (violatesMutualExclusion(assigned, [])) {
			console.error(`⚠ Mutual exclusion would be violated for week ${week.weekNumber} — skipping ${assigned}, marking gap`);
			unfilledWeeks.push(week);
			continue;
		}

		const ok = await assignInstructorToWeek(supabase, assigned, week, year, executedBy);
		if (ok) {
			counts[assigned] = (counts[assigned] ?? 0) + week.dates.length;
			for (const date of week.dates) {
				assignments.push({ date, instructor: assigned, week: week.weekNumber });
			}
			console.log(`✓ Assigned ${assigned} (running OD-days: ${counts[assigned]})`);
		}
	}

	console.log(`\n=== OD Assignment Complete ===`);
	console.log(`Total assignments: ${assignments.length}`);
	console.log('Final OD-day counts:', counts);
	if (unfilledWeeks.length > 0) {
		console.log(`⚠ Unfilled weeks: ${unfilledWeeks.map(w => w.weekNumber).join(', ')}`);
	}

	return {
		year,
		month,
		totalWeeks: weeks.length,
		totalAssignments: assignments.length,
		assignments,
		unfilledWeeks: unfilledWeeks.map(w => w.weekNumber),
		finalOdDayCounts: counts
	};
}