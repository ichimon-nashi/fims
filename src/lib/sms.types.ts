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

// Tab types
export type SMSTab = "rr-sms" | "srm-table" | "statistics";