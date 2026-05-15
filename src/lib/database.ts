import { createClient } from "@/utils/supabase/server";
import { User, ScheduleEntry, ScheduleFilters, ExportData } from "./types";

export const getAllUsers = async (): Promise<User[]> => {
	try {
		console.log("Getting all users from database");
		
		const supabase = await createClient();
		
		const { data: users, error } = await supabase
			.from('users')
			.select(`
				id,
				employee_id,
				full_name,
				rank,
				base,
				email,
				filter,
				handicap_level,
				authentication_level,
				app_permissions,
				gender,
				password_hash,
				created_at,
				updated_at
			`)
			.order('employee_id', { ascending: true });

		if (error) {
			console.error("Supabase error getting users:", error);
			throw new Error(`Failed to fetch users: ${error.message}`);
		}

		console.log("Found", users?.length || 0, "users");
		return users || [];
	} catch (error) {
		console.error("Error getting all users:", error);
		throw new Error("Failed to fetch users from database");
	}
};

// User lookup functions
export async function getUserByEmail(email: string): Promise<User | null> {
	console.log("Getting user by email:", email);
	
	const supabase = await createClient();
	
	const { data, error } = await supabase
		.from("users")
		.select("*")
		.eq("email", email)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			// No rows returned
			console.log("User not found with email:", email);
			return null;
		}
		console.error("Error getting user by email:", error);
		throw error;
	}

	console.log("User found:", data.id);
	return data;
}

export async function getUserById(id: string): Promise<User | null> {
	console.log("Getting user by id:", id);
	
	const supabase = await createClient();
	
	const { data, error } = await supabase
		.from("users")
		.select("*")
		.eq("id", id)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			console.log("User not found with id:", id);
			return null;
		}
		console.error("Error getting user by id:", error);
		throw error;
	}

	console.log("User found:", data.id);
	return data;
}

// Get user by employee ID
export async function getUserByEmployeeId(employeeId: string): Promise<User | null> {
	console.log("Getting user by employee ID:", employeeId);
	
	const supabase = await createClient();
	
	const { data, error } = await supabase
		.from("users")
		.select("*")
		.eq("employee_id", employeeId)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			console.log("User not found with employee ID:", employeeId);
			return null;
		}
		console.error("Error getting user by employee ID:", error);
		throw error;
	}

	console.log("User found:", data.id);
	return data;
}

// User creation function
export async function createUser(userData: {
	employee_id: string;
	full_name: string;
	rank: string;
	base: string;
	email: string;
	password_hash: string;
	filter: string[];
	handicap_level: number;
	authentication_level: number;
}): Promise<User> {
	console.log("Creating user with email:", userData.email);
	
	const supabase = await createClient();
	
	const { data, error } = await supabase
		.from("users")
		.insert([userData])
		.select()
		.single();

	if (error) {
		console.error("Error creating user:", error);
		
		if (error.code === "23505") { // unique_violation
			if (error.message.includes("employee_id")) {
				throw new Error("A user with this employee ID already exists");
			} else if (error.message.includes("email")) {
				throw new Error("A user with this email already exists");
			} else {
				throw new Error("This user information already exists in the system");
			}
		}
		
		throw error;
	}

	console.log("User created successfully:", data.id);
	return data;
}

// Get FI instructors (rank = 'FI' and employee_id = '22119')
export async function getFIInstructors(): Promise<User[]> {
	console.log("Getting FI instructors");
	
	const supabase = await createClient();
	
	const { data, error } = await supabase
		.from("users")
		.select("id, employee_id, full_name, rank, base, email, filter, handicap_level, authentication_level, app_permissions, gender, created_at, updated_at")
		.eq("rank", "FI")
		.eq("employee_id", "22119")
		.order("full_name");

	if (error) {
		console.error("Error getting FI instructors:", error);
		throw error;
	}

	console.log("Found FI instructors:", data.length);
	return data;
}

// Create or update schedule entry
export async function createOrUpdateScheduleEntry(scheduleData: {
	employee_id: string;
	full_name: string;
	rank: string;
	base: string;
	date: string;
	duties: string[];
	created_by?: string;
}): Promise<ScheduleEntry> {
	console.log("Creating/updating schedule entry for:", scheduleData.employee_id, "on", scheduleData.date);
	
	const supabase = await createClient();
	
	const year = new Date(scheduleData.date).getFullYear();
	
	const entryData = {
		...scheduleData,
		year,
	};
	
	// Use upsert to handle both insert and update
	const { data, error } = await supabase
		.from("fi_schedule")
		.upsert(entryData, {
			onConflict: "employee_id,date",
			ignoreDuplicates: false
		})
		.select()
		.single();

	if (error) {
		console.error("Error creating/updating schedule entry:", error);
		throw error;
	}

	console.log("Schedule entry created/updated successfully:", data.id);
	return data;
}

// Get schedule entries by filters
export async function getScheduleEntries(filters: ScheduleFilters): Promise<ScheduleEntry[]> {
	console.log("Getting schedule entries with filters:", filters);
	
	const supabase = await createClient();
	
	let query = supabase
		.from("fi_schedule")
		.select("*")
		.eq("year", filters.year);
	
	if (filters.employeeId) {
		query = query.eq("employee_id", filters.employeeId);
	}
	
	if (filters.month) {
		// Filter by month (1-12)
		const startDate = `${filters.year}-${filters.month.toString().padStart(2, '0')}-01`;
		const nextMonth = filters.month === 12 ? 1 : filters.month + 1;
		const nextYear = filters.month === 12 ? filters.year + 1 : filters.year;
		const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
		
		query = query.gte("date", startDate).lt("date", endDate);
	}
	
	query = query.order("date", { ascending: true });

	const { data, error } = await query;

	if (error) {
		console.error("Error getting schedule entries:", error);
		throw error;
	}

	console.log("Found schedule entries:", data.length);
	return data || [];
}

// Get schedule entry for specific date and employee
export async function getScheduleEntry(employeeId: string, date: string): Promise<ScheduleEntry | null> {
	console.log("Getting schedule entry for employee:", employeeId, "on date:", date);
	
	const supabase = await createClient();
	
	const { data, error } = await supabase
		.from("fi_schedule")
		.select("*")
		.eq("employee_id", employeeId)
		.eq("date", date)
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			console.log("No schedule entry found for:", employeeId, "on", date);
			return null;
		}
		console.error("Error getting schedule entry:", error);
		throw error;
	}

	console.log("Schedule entry found:", data.id);
	return data;
}

// Delete schedule entry
export async function deleteScheduleEntry(employeeId: string, date: string): Promise<void> {
	console.log("Deleting schedule entry for employee:", employeeId, "on date:", date);
	
	const supabase = await createClient();
	
	const { error } = await supabase
		.from("fi_schedule")
		.delete()
		.eq("employee_id", employeeId)
		.eq("date", date);

	if (error) {
		console.error("Error deleting schedule entry:", error);
		throw error;
	}

	console.log("Schedule entry deleted successfully");
}

// Clean up old schedule records (older than 3 years)
export async function cleanupOldScheduleRecords(): Promise<number> {
	console.log("Cleaning up old schedule records");
	
	const supabase = await createClient();
	
	const currentYear = new Date().getFullYear();
	const cutoffYear = currentYear - 2; // Keep current year, previous year, and next year
	
	const { data, error } = await supabase
		.from("fi_schedule")
		.delete()
		.lt("year", cutoffYear)
		.select("id");

	if (error) {
		console.error("Error cleaning up old schedule records:", error);
		throw error;
	}

	console.log("Cleaned up schedule records:", data?.length || 0);
	return data?.length || 0;
}

// Get schedule data for Excel export
export async function getScheduleForExport(year: number, month?: number): Promise<ExportData[]> {
	console.log("Getting schedule data for export, year:", year, "month:", month);
	
	const scheduleEntries = await getScheduleEntries({ year, month });
	
	// Group by employee
	const exportData: Record<string, ExportData> = {};
	
	scheduleEntries.forEach(entry => {
		if (!exportData[entry.employee_id]) {
			exportData[entry.employee_id] = {
				employee_id: entry.employee_id,
				full_name: entry.full_name,
				rank: entry.rank,
				base: entry.base,
				schedule: {}
			};
		}
		
		exportData[entry.employee_id].schedule[entry.date] = entry.duties;
	});
	
	return Object.values(exportData);
}

// Get monthly summary for a specific employee
export async function getMonthlyScheduleSummary(employeeId: string, year: number, month: number): Promise<{
	totalDays: number;
	dutyCounts: Record<string, number>;
	entries: ScheduleEntry[];
}> {
	console.log("Getting monthly schedule summary for:", employeeId, year, month);
	
	const scheduleEntries = await getScheduleEntries({ year, month, employeeId });
	
	// Count duties by type
	const dutyCounts: Record<string, number> = {};
	const totalDays = scheduleEntries.length;
	
	scheduleEntries.forEach(entry => {
		entry.duties.forEach(duty => {
			dutyCounts[duty] = (dutyCounts[duty] || 0) + 1;
		});
	});
	
	return {
		totalDays,
		dutyCounts,
		entries: scheduleEntries
	};
}