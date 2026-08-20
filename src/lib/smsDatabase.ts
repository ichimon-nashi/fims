// src/lib/smsDatabase.ts
// Database functions for SMS (Safety Management System)
// Uses SERVICE CLIENT to bypass RLS (working with custom JWT authentication)

import { createServiceClient } from "@/utils/supabase/service-client";
import {
	RRSMSEntry,
	SRMTableEntry,
	SRMTableListItem,
	RRSMSFilters,
	SRMTableFilters,
	StatisticsFilters,
	MonthlyStatistics,
	CrewReportCategory,
	CrewReport,
	CrewReportFilters,
} from "./sms.types";

// ============================================================================
// RR SMS ENTRIES
// ============================================================================

export const getRRSMSEntries = async (
	filters: RRSMSFilters = {}
): Promise<RRSMSEntry[]> => {
	try {
		console.log("Getting RR SMS entries with filters:", filters);

		const supabase = createServiceClient();

		let query = supabase
			.from("rr_sms_entries")
			.select(
				`
        *,
        srm_table_link:srm_table_entries(id, number, file_date, hazard_description)
      `
			)
			.order("next_review", { ascending: true });

		if (filters.year) {
			const startDate = `${filters.year}-01-01`;
			const endDate = `${filters.year}-12-31`;
			query = query
				.gte("last_review", startDate)
				.lte("last_review", endDate);
		}

		if (filters.created_by) {
			query = query.eq("created_by", filters.created_by);
		}

		const { data, error } = await query;

		if (error) {
			console.error("Error getting RR SMS entries:", error);
			throw error;
		}

		console.log("Found RR SMS entries:", data?.length || 0);
		return data || [];
	} catch (error) {
		console.error("Error getting RR SMS entries:", error);
		throw new Error("Failed to fetch RR SMS entries");
	}
};

export const createRRSMSEntry = async (entryData: {
	srm_table_link_id?: string;
	rr_number: string;
	risk_id_barrier?: string;
	last_review?: string;
	next_review?: string;
	risk_id?: string;
	risk_last_review?: string;
	risk_next_review?: string;
	barrier_id?: string;
	barrier_last_review?: string;
	barrier_next_review?: string;
	created_by: string;
}): Promise<RRSMSEntry> => {
	try {
		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("rr_sms_entries")
			.insert([entryData])
			.select(
				`
        *,
        srm_table_link:srm_table_entries(id, number, file_date, hazard_description)
      `
			)
			.single();

		if (error) {
			console.error("Error creating RR SMS entry:", error);
			if (error.code === "23505") {
				throw new Error("An entry with this RR number already exists");
			}
			throw error;
		}

		console.log("RR SMS entry created successfully:", data.id);
		return data;
	} catch (error) {
		console.error("Error creating RR SMS entry:", error);
		throw error;
	}
};

export const updateRRSMSEntry = async (
	id: string,
	updates: Partial<{
		srm_table_link_id: string;
		rr_number: string;
		risk_id_barrier: string;
		last_review: string;
		next_review: string;
		risk_id: string;
		risk_last_review: string;
		risk_next_review: string;
		barrier_id: string;
		barrier_last_review: string;
		barrier_next_review: string;
	}>
): Promise<RRSMSEntry> => {
	try {
		console.log("Updating RR SMS entry:", id);

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("rr_sms_entries")
			.update(updates)
			.eq("id", id)
			.select(
				`
        *,
        srm_table_link:srm_table_entries(id, number, file_date, hazard_description)
      `
			)
			.single();

		if (error) {
			console.error("Error updating RR SMS entry:", error);
			throw error;
		}

		console.log("RR SMS entry updated successfully");
		return data;
	} catch (error) {
		console.error("Error updating RR SMS entry:", error);
		throw error;
	}
};

export const deleteRRSMSEntry = async (id: string): Promise<void> => {
	try {
		console.log("Deleting RR SMS entry:", id);

		const supabase = createServiceClient();

		const { error } = await supabase
			.from("rr_sms_entries")
			.delete()
			.eq("id", id);

		if (error) {
			console.error("Error deleting RR SMS entry:", error);
			throw error;
		}

		console.log("RR SMS entry deleted successfully");
	} catch (error) {
		console.error("Error deleting RR SMS entry:", error);
		throw error;
	}
};

// ============================================================================
// SRM TABLE ENTRIES
// ============================================================================

export const getSRMTableEntries = async (
	filters: SRMTableFilters = {}
): Promise<SRMTableEntry[]> => {
	try {
		console.log("Getting SRM table entries with filters:", filters);

		const supabase = createServiceClient();

		let query = supabase
			.from("srm_table_entries")
			.select("*")
			.order("file_date", { ascending: false });

		if (filters.year) {
			query = query.eq("year", filters.year);
		}

		if (filters.month) {
			const startDate = `${filters.year}-${filters.month
				.toString()
				.padStart(2, "0")}-01`;
			const nextMonth = filters.month === 12 ? 1 : filters.month + 1;
			const nextYear =
				filters.month === 12
					? (filters.year || new Date().getFullYear()) + 1
					: filters.year;
			const endDate = `${nextYear}-${nextMonth
				.toString()
				.padStart(2, "0")}-01`;

			query = query
				.gte("occurrence_month", startDate)
				.lt("occurrence_month", endDate);
		}

		if (filters.source_type) {
			query = query.eq("identification_source_type", filters.source_type);
		}

		if (filters.created_by) {
			query = query.eq("created_by", filters.created_by);
		}

		if (filters.search) {
			query = query.or(
				`hazard_description.ilike.%${filters.search}%,possible_cause.ilike.%${filters.search}%,number.ilike.%${filters.search}%`
			);
		}

		const { data, error } = await query;

		if (error) {
			console.error("Error getting SRM table entries:", error);
			throw error;
		}

		console.log("Found SRM table entries:", data?.length || 0);
		return data || [];
	} catch (error) {
		console.error("Error getting SRM table entries:", error);
		throw new Error("Failed to fetch SRM table entries");
	}
};

export const getSRMTableListItems = async (
	year?: number
): Promise<SRMTableListItem[]> => {
	try {
		console.log("Getting SRM table list items for year:", year);

		const supabase = createServiceClient();

		let query = supabase
			.from("srm_table_entries")
			.select("id, number, file_date, hazard_description, year")
			.order("file_date", { ascending: false });

		if (year) {
			query = query.eq("year", year);
		}

		const { data, error } = await query;

		if (error) {
			console.error("Error getting SRM table list items:", error);
			throw error;
		}

		console.log("Found SRM table list items:", data?.length || 0);
		return data || [];
	} catch (error) {
		console.error("Error getting SRM table list items:", error);
		throw new Error("Failed to fetch SRM table list items");
	}
};

export const createSRMTableEntry = async (entryData: {
	file_date: string;
	number: string;
	identification_source_type: "SA" | "SRM";
	identification_source_detail?: string;
	occurrence_month?: string;
	hazard_description?: string;
	possible_cause?: string;
	hazard_impact?: string;
	existing_measures?: string;
	current_risk_assessment?: string;
	risk_mitigation_measures?: string;
	post_mitigation_assessment?: string;
	human_factors_codes?: string[];
	ef_attribute_codes?: string[];
	created_by: string;
}): Promise<SRMTableEntry> => {
	try {
		console.log("Creating SRM table entry:", entryData.number);

		const supabase = createServiceClient();

		// Extract year from file_date
		const year = new Date(entryData.file_date).getFullYear();

		const { data, error } = await supabase
			.from("srm_table_entries")
			.insert([{ ...entryData, year }])
			.select()
			.single();

		if (error) {
			console.error("Error creating SRM table entry:", error);
			if (error.code === "23505") {
				throw new Error("An entry with this number already exists");
			}
			throw error;
		}

		console.log("SRM table entry created successfully:", data.id);
		return data;
	} catch (error) {
		console.error("Error creating SRM table entry:", error);
		throw error;
	}
};

export const updateSRMTableEntry = async (
	id: string,
	updates: Partial<
		Omit<SRMTableEntry, "id" | "created_at" | "updated_at" | "created_by">
	>
): Promise<SRMTableEntry> => {
	try {
		console.log("Updating SRM table entry:", id);

		const supabase = createServiceClient();

		// If file_date is being updated, recalculate year
		if (updates.file_date) {
			updates.year = new Date(updates.file_date).getFullYear();
		}

		const { data, error } = await supabase
			.from("srm_table_entries")
			.update(updates)
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error updating SRM table entry:", error);
			throw error;
		}

		console.log("SRM table entry updated successfully");
		return data;
	} catch (error) {
		console.error("Error updating SRM table entry:", error);
		throw error;
	}
};

export const deleteSRMTableEntry = async (id: string): Promise<void> => {
	try {
		console.log("Deleting SRM table entry:", id);

		const supabase = createServiceClient();

		const { error } = await supabase
			.from("srm_table_entries")
			.delete()
			.eq("id", id);

		if (error) {
			console.error("Error deleting SRM table entry:", error);
			throw error;
		}

		console.log("SRM table entry deleted successfully");
	} catch (error) {
		console.error("Error deleting SRM table entry:", error);
		throw error;
	}
};

// ============================================================================
// STATISTICS
// ============================================================================

export const getMonthlyStatistics = async (
	filters: StatisticsFilters
): Promise<MonthlyStatistics[]> => {
	try {
		console.log("Getting monthly statistics with filters:", filters);

		const supabase = createServiceClient();

		let query = supabase
			.from("srm_table_entries")
			.select(
				"occurrence_month, identification_source_type, ef_attribute_codes"
			)
			.eq("year", filters.year)
			.not("occurrence_month", "is", null);

		if (filters.month) {
			const startDate = `${filters.year}-${filters.month
				.toString()
				.padStart(2, "0")}-01`;
			const nextMonth = filters.month === 12 ? 1 : filters.month + 1;
			const nextYear =
				filters.month === 12 ? filters.year + 1 : filters.year;
			const endDate = `${nextYear}-${nextMonth
				.toString()
				.padStart(2, "0")}-01`;

			query = query
				.gte("occurrence_month", startDate)
				.lt("occurrence_month", endDate);
		}

		if (filters.source_type && filters.source_type !== "all") {
			query = query.eq("identification_source_type", filters.source_type);
		}

		const { data, error } = await query;

		if (error) {
			console.error("Error getting monthly statistics:", error);
			throw error;
		}

		// Group by month and calculate statistics
		const monthlyMap = new Map<string, MonthlyStatistics>();

		data?.forEach((entry) => {
			const month = entry.occurrence_month?.substring(0, 7); // YYYY-MM
			if (!month) return;

			if (!monthlyMap.has(month)) {
				monthlyMap.set(month, {
					month,
					sa_count: 0,
					srm_count: 0,
					total_count: 0,
					ef_categories: {},
				});
			}

			const stats = monthlyMap.get(month)!;
			stats.total_count++;

			if (entry.identification_source_type === "SA") {
				stats.sa_count++;
			} else if (entry.identification_source_type === "SRM") {
				stats.srm_count++;
			}

			// Count EF attribute codes by category
			entry.ef_attribute_codes?.forEach((code) => {
				const category = code.split("-")[0]; // e.g., "P1-01" -> "P1"
				stats.ef_categories[category] =
					(stats.ef_categories[category] || 0) + 1;
			});
		});

		const result = Array.from(monthlyMap.values()).sort((a, b) =>
			a.month.localeCompare(b.month)
		);

		console.log("Monthly statistics calculated:", result.length, "months");
		return result;
	} catch (error) {
		console.error("Error getting monthly statistics:", error);
		throw new Error("Failed to fetch monthly statistics");
	}
};

export const getSRMTableEntryById = async (
	id: string
): Promise<SRMTableEntry | null> => {
	try {
		console.log("Getting SRM table entry by ID:", id);

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("srm_table_entries")
			.select("*")
			.eq("id", id)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				console.log("SRM table entry not found:", id);
				return null;
			}
			console.error("Error getting SRM table entry:", error);
			throw error;
		}

		console.log("SRM table entry found");
		return data;
	} catch (error) {
		console.error("Error getting SRM table entry by ID:", error);
		throw new Error("Failed to fetch SRM table entry");
	}
};

// ============================================================================
// CREW REPORT CATEGORIES (組員報告分類)
// ============================================================================

export const getCrewReportCategories = async (
	includeInactive: boolean = true
): Promise<CrewReportCategory[]> => {
	try {
		console.log("Getting crew report categories, includeInactive:", includeInactive);

		const supabase = createServiceClient();

		let query = supabase
			.from("crew_report_categories")
			.select("*")
			.order("created_at", { ascending: true });

		if (!includeInactive) {
			query = query.eq("active", true);
		}

		const { data, error } = await query;

		if (error) {
			console.error("Error getting crew report categories:", error);
			throw error;
		}

		console.log("Found crew report categories:", data?.length || 0);
		return data || [];
	} catch (error) {
		console.error("Error getting crew report categories:", error);
		throw new Error("Failed to fetch crew report categories");
	}
};

export const createCrewReportCategory = async (categoryData: {
	name: string;
	color_hex: string;
	created_by: string;
}): Promise<CrewReportCategory> => {
	try {
		console.log("Creating crew report category:", categoryData.name);

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("crew_report_categories")
			.insert([categoryData])
			.select()
			.single();

		if (error) {
			console.error("Error creating crew report category:", error);
			if (error.code === "23505") {
				throw new Error("A category with this name already exists");
			}
			throw error;
		}

		console.log("Crew report category created successfully:", data.id);
		return data;
	} catch (error) {
		console.error("Error creating crew report category:", error);
		throw error;
	}
};

export const updateCrewReportCategory = async (
	id: string,
	updates: Partial<{
		name: string;
		color_hex: string;
		active: boolean;
	}>
): Promise<CrewReportCategory> => {
	try {
		console.log("Updating crew report category:", id);

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("crew_report_categories")
			.update(updates)
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error updating crew report category:", error);
			if (error.code === "23505") {
				throw new Error("A category with this name already exists");
			}
			throw error;
		}

		console.log("Crew report category updated successfully");
		return data;
	} catch (error) {
		console.error("Error updating crew report category:", error);
		throw error;
	}
};

// Note: no hard-delete function — categories are only ever soft-deleted via
// updateCrewReportCategory(id, { active: false }), so a category's name and
// color remain resolvable for any report that already references it.

// ============================================================================
// CREW REPORTS (組員報告)

// ============================================================================

export const getCrewReports = async (
	filters: CrewReportFilters = {}
): Promise<CrewReport[]> => {
	try {
		console.log("Getting crew reports with filters:", filters);

		const supabase = createServiceClient();

		let query = supabase
			.from("crew_reports")
			.select("*")
			.order("report_year", { ascending: false })
			.order("report_month", { ascending: false })
			.order("created_at", { ascending: false });

		if (filters.year) {
			query = query.eq("report_year", filters.year);
		}

		if (filters.month) {
			query = query.eq("report_month", filters.month);
		}

		if (filters.category_id) {
			query = query.contains("category_ids", [filters.category_id]);
		}

		if (filters.search) {
			query = query.or(
				`description.ilike.%${filters.search}%,report_code.ilike.%${filters.search}%,action_taken.ilike.%${filters.search}%`
			);
		}

		const { data, error } = await query;

		if (error) {
			console.error("Error getting crew reports:", error);
			throw error;
		}

		console.log("Found crew reports:", data?.length || 0);
		return data || [];
	} catch (error) {
		console.error("Error getting crew reports:", error);
		throw new Error("Failed to fetch crew reports");
	}
};

export const createCrewReport = async (reportData: {
	report_code?: string | null;
	report_year: number;
	report_month: number;
	title: string;
	description: string;
	hazard_type?: string | null;
	action_taken?: string | null;
	category_ids: string[];
	occurrence_date?: string | null;
	registered_date?: string | null;
	aircraft?: string | null;
	flight_no?: string | null;
	departure?: string | null;
	arrival?: string | null;
	location?: string | null;
	potential_consequence?: string | null;
	reporter_name?: string | null;
	operational_category?: string | null;
	assessment_code?: string | null;
	risk_assessment_calculation?: string | null;
	risk_assessment?: string | null;
	closed_status?: string | null;
	created_by: string;
}): Promise<CrewReport> => {
	try {
		console.log("Creating crew report:", reportData.report_code || "NIL");

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("crew_reports")
			.insert([reportData])
			.select()
			.single();

		if (error) {
			console.error("Error creating crew report:", error);
			throw error;
		}

		console.log("Crew report created successfully:", data.id);
		return data;
	} catch (error) {
		console.error("Error creating crew report:", error);
		throw error;
	}
};

export const updateCrewReport = async (
	id: string,
	updates: Partial<
		Omit<CrewReport, "id" | "created_at" | "created_by">
	>
): Promise<CrewReport> => {
	try {
		console.log("Updating crew report:", id);

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("crew_reports")
			.update(updates)
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error updating crew report:", error);
			throw error;
		}

		console.log("Crew report updated successfully");
		return data;
	} catch (error) {
		console.error("Error updating crew report:", error);
		throw error;
	}
};

export const deleteCrewReport = async (id: string): Promise<void> => {
	try {
		console.log("Deleting crew report:", id);

		const supabase = createServiceClient();

		const { error } = await supabase
			.from("crew_reports")
			.delete()
			.eq("id", id);

		if (error) {
			console.error("Error deleting crew report:", error);
			throw error;
		}

		console.log("Crew report deleted successfully");
	} catch (error) {
		console.error("Error deleting crew report:", error);
		throw error;
	}
};