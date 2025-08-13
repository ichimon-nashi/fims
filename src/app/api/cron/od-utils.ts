// src/app/api/cron/od-utils.ts
import { createOrUpdateScheduleEntry, getScheduleEntry } from "@/lib/database";

// OD rotation instructors in order
export const OD_INSTRUCTORS = ["22018", "39426", "51892"];

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

	// Find first Monday of the month (or first day if it starts later in week)
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

		// Only add week if it has weekdays in the target month
		if (weekDates.length > 0) {
			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekStart.getDate() + 4); // Friday

			weeks.push({
				weekNumber,
				startDate: weekStart,
				endDate: weekEnd,
				dates: weekDates,
			});
		}

		// Move to next Monday
		currentDate.setDate(currentDate.getDate() + 7);
		weekNumber++;
	}

	return weeks;
}

// Get current rotation state for a specific month/year
export function getCurrentRotationState(
	year: number,
	month: number
): { [instructor: string]: number } {
	// Define the base rotation pattern (September 2024)
	const baseYear = 2024;
	const baseMonth = 9; // September
	const baseRotation = {
		"22018": 1, // Week 1
		"39426": 2, // Week 2
		"51892": 3, // Week 3
	};

	// Calculate months since base
	const monthsSinceBase = (year - baseYear) * 12 + (month - baseMonth);

	// Calculate rotation offset
	const rotationState: { [instructor: string]: number } = {};

	OD_INSTRUCTORS.forEach((instructor) => {
		const basePosition =
			baseRotation[instructor as keyof typeof baseRotation];
		// Rotation pattern: 1->4->3->2->1...
		const positions = [1, 4, 3, 2];
		const currentIndex = (basePosition - 1 + monthsSinceBase) % 4;
		rotationState[instructor] = positions[currentIndex];
	});

	return rotationState;
}

// Helper functions to get instructor details
export function getInstructorName(employeeId: string): string {
	const names: { [key: string]: string } = {
		"22018": "凌珂瑋",
		"39426": "柯台豐",
		"51892": "韓蕙愛",
	};
	return names[employeeId] || "Unknown Instructor";
}

export function getInstructorBase(employeeId: string): string {
	const bases: { [key: string]: string } = {
		"22018": "TSA",
		"39426": "TSA",
		"51892": "KHH",
	};
	return bases[employeeId] || "TSA";
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
	console.log(
		`[OD-CRON] Assigning OD duties for ${year}-${month
			.toString()
			.padStart(2, "0")}`
	);

	const weeks = getMonthWeeks(year, month);
	const rotationState = getCurrentRotationState(year, month);

	console.log(`[OD-CRON] Month weeks: ${weeks.length}`);
	console.log(`[OD-CRON] Rotation state:`, rotationState);

	let assigned = 0;
	let skipped = 0;
	const details: string[] = [];

	// Assign each instructor to their designated week
	for (const instructor of OD_INSTRUCTORS) {
		const assignedWeek = rotationState[instructor];

		// Check if this week exists in the month
		const weekInfo = weeks.find((w) => w.weekNumber === assignedWeek);
		if (!weekInfo) {
			const msg = `${instructor}: Week ${assignedWeek} not found in month`;
			details.push(msg);
			console.log(`[OD-CRON] ${msg}`);
			continue;
		}

		console.log(
			`[OD-CRON] Assigning ${instructor} to week ${assignedWeek} (${weekInfo.dates.length} days)`
		);

		// Assign OD duty for each weekday in the week
		for (const date of weekInfo.dates) {
			try {
				// Check if OD duty already exists for this instructor on this date
				const existingEntry = await getScheduleEntry(instructor, date);
				if (existingEntry && existingEntry.duties.includes("OD")) {
					const msg = `${instructor} ${date}: OD already assigned, skipped`;
					details.push(msg);
					console.log(`[OD-CRON] ${msg}`);
					skipped++;
					continue;
				}

				// Get existing duties (if any) and add OD
				const existingDuties = existingEntry?.duties || [];
				const newDuties = existingDuties.includes("OD")
					? existingDuties
					: [...existingDuties, "OD"];

				// Create/update schedule entry
				await createOrUpdateScheduleEntry({
					employee_id: instructor,
					full_name: getInstructorName(instructor),
					rank: "FI - Flight Attendant Instructor",
					base: getInstructorBase(instructor),
					date: date,
					duties: newDuties,
					created_by: createdBy,
				});

				const msg = `${instructor} ${date}: OD assigned`;
				details.push(msg);
				console.log(`[OD-CRON] ${msg}`);
				assigned++;
			} catch (error) {
				const msg = `${instructor} ${date}: Error - ${error}`;
				console.error(
					`[OD-CRON] Error assigning OD for ${instructor} on ${date}:`,
					error
				);
				details.push(msg);
				skipped++;
			}
		}
	}

	console.log(
		`[OD-CRON] Assignment complete. Assigned: ${assigned}, Skipped: ${skipped}`
	);
	return { assigned, skipped, details };
}
