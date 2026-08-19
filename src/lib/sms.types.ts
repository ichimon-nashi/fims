// src/lib/sms.types.ts
// SMS (Safety Management System) Types

export interface RRSMSEntry {
	id: string;
	srm_table_link_id?: string;
	srm_table_link?: SRMTableEntry; // Populated when fetched with join
	rr_number: string; // Format: XX/RR/XX
	
	// OLD fields (deprecated but kept for backward compatibility)
	risk_id_barrier?: string;
	last_review?: string; // ISO date string
	next_review?: string; // ISO date string
	
	// NEW fields (use these going forward)
	risk_id?: string;
	risk_last_review?: string;
	risk_next_review?: string;
	barrier_id?: string;
	barrier_last_review?: string;
	barrier_next_review?: string;
	
	year?: number;
	created_at: string;
	updated_at: string;
	created_by?: string;
	is_deprecated?: boolean;
}

export interface SRMTableEntry {
	id: string;
	file_date: string; // 建檔日期 - ISO date string
	number: string; // Format: XXXXTZXX-XX
	identification_source_type: "SA" | "SRM";
	identification_source_detail?: string;
	occurrence_month?: string; // ISO date string (year-month)
	hazard_description?: string; // 危害描述
	possible_cause?: string; // 可能肇因
	hazard_impact?: string; // 危害影響
	existing_measures?: string; // 現有措施
	current_risk_assessment?: string; // e.g., "2A", "3B"
	risk_mitigation_measures?: string; // 風險緩解措施
	post_mitigation_assessment?: string; // e.g., "2A", "3B"
	human_factors_codes?: string[]; // e.g., ["RM1", "OC2", "SE1"]
	ef_attribute_codes?: string[]; // e.g., ["P1-01", "P2-03"]
	year: number;
	created_at: string;
	updated_at: string;
	created_by?: string;
}

// For dropdown list display
export interface SRMTableListItem {
	id: string;
	number: string;
	file_date: string;
	hazard_description?: string;
	year: number;
}

// Risk Assessment Matrix
export type RiskLikelihood = "1" | "2" | "3" | "4" | "5";
export type RiskSeverity = "A" | "B" | "C" | "D" | "E";
export type RiskLevel = "Low" | "Medium" | "High";

export interface RiskMatrixCell {
	likelihood: RiskLikelihood;
	severity: RiskSeverity;
	level: RiskLevel;
	color: string;
}

// Human Factors Codes
export interface HumanFactorCategory {
	code: string; // e.g., "RM", "OC", "OP"
	name: string; // e.g., "Resource Management"
	subcodes: HumanFactorSubcode[];
}

export interface HumanFactorSubcode {
	code: string; // e.g., "RM1", "RM2"
	description: string; // e.g., "Insufficient human resources"
}

// EF Attribute Codes
export interface EFAttributeCategory {
	code: string; // e.g., 'P', 'E', 'C'
	name: string; // e.g., '安全程序/訓練 (Procedure/Training)'
	subcodes: {
		code: string; // e.g., 'P1-01'
		description: string; // e.g., '相關資格訓練未執行'
	}[];
}

// Statistics
export interface StatisticsFilters {
	year: number;
	month?: number;
	source_type?: "SA" | "SRM" | "all";
}

export interface MonthlyStatistics {
	month: string; // YYYY-MM
	sa_count: number;
	srm_count: number;
	total_count: number;
	ef_categories: Record<string, number>; // Category code -> count
}

export interface CategoryStatistics {
	category_name: string;
	category_code: string;
	count: number;
	percentage: number;
}

// Excel Export Data
export interface SMSExportData {
	summary: {
		year: number;
		total_events: number;
		sa_events: number;
		srm_events: number;
		monthly_breakdown: MonthlyStatistics[];
	};
	category_stats: CategoryStatistics[];
}

// Filters for queries
export interface RRSMSFilters {
	year?: number;
	created_by?: string;
}

export interface SRMTableFilters {
	year?: number;
	month?: number;
	source_type?: "SA" | "SRM";
	created_by?: string;
	search?: string; // For searching in descriptions
}

// ============================================================================
// CREW REPORTS (組員報告)
// ============================================================================

export interface CrewReportCategory {
	id: string;
	name: string;
	color_hex: string;
	active: boolean;
	created_at: string;
	created_by?: string;
}

export interface CrewReport {
	id: string;
	report_code?: string | null; // AQD Code — always populated for new entries as of the 報告來源 removal; legacy records may still be null, displayed as "NIL"
	report_year: number;
	report_month: number; // 1-12
	title: string; // 標題 — from AQD's Title column
	description: string; // 描述 — from AQD's Description column
	hazard_type?: string | null; // OF分類 — from AQD's Hazard Type column. Distinct from EF分類 (category_ids below), which is this app's own department-defined tagging system, not an AQD import field.
	action_taken?: string | null; // 辦理情形 — from AQD's Synopsis column
	category_ids: string[]; // EF分類 — FK into crew_report_categories.id, multiple allowed
	created_at: string;
	created_by?: string;
}

export interface CrewReportFilters {
	year?: number;
	month?: number;
	category_id?: string;
	search?: string; // matches description / report_code / action_taken
}

// Reserved 10-color palette for the category-creation color picker.
// 5 reuse existing app colors; 5 are new (lime/cyan/pink/tan/stone) — the one
// documented exception to "no invented color values," since categories are a
// new concept with no precedent in the existing palette. Re-picked for max hue
// separation + legibility against the #1a1f35->#2d3651 dark background.
export const CREW_REPORT_CATEGORY_COLORS: string[] = [
	"#4a9eff", // blue
	"#ef4444", // red
	"#f59e0b", // amber
	"#10b981", // emerald
	"#8b5cf6", // purple
	"#a3e635", // lime
	"#22d3ee", // cyan
	"#f472b6", // pink
	"#d4a373", // tan
	"#a8a29e", // stone (neutral - good default for "其他"-style categories)
];

// Tab types
export type SMSTab = "rr-sms" | "srm-table" | "statistics" | "crew-report";