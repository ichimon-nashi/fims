// src/lib/routineAudit.types.ts

export interface SamCode {
	id: string;
	area: string;
	category: string;
	code: string;
	description_en: string | null;
	description_zh: string | null;
	sort_order: number;
	active: boolean;
}

export interface RoutineAuditEntry {
	id: string;
	entry_no: string;
	finding_seq: number;
	audit_date: string; // ISO date
	report_year: number;
	report_month: number;
	auditor_name: string;
	aircraft_tail: string;
	flight_no: string | null;
	route: string | null;
	finding: string;
	corrective_action: string | null;
	result: "OK" | "NG";
	sam_code_id: string | null;
	sam_code: Pick<SamCode, "area" | "category" | "code" | "description_zh"> | null;
	is_non_flight_safety: boolean;
	created_by: string;
	created_at: string;
	updated_by: string | null;
	updated_at: string | null;
}

// payload for creating a finding — either a brand new audit or an additional
// finding under an existing one (see entries POST route)
export interface CreateEntryPayload {
	existing_entry_no?: string;
	audit_date: string;
	report_year: number;
	report_month: number;
	auditor_name: string;
	aircraft_tail: string;
	flight_no?: string;
	route?: string;
	finding: string;
	corrective_action?: string;
	result?: "OK" | "NG";
	sam_code_id?: string | null;
	is_non_flight_safety?: boolean;
}

export type UpdateEntryPayload = Partial<Omit<CreateEntryPayload, "existing_entry_no">>;

export interface RoutineSummaryResponse {
	byCode: Record<string, Record<number, number>>;      // SAM code -> year -> count
	byCategory: Record<string, Record<number, number>>; // category -> year -> count
	byArea: Record<string, Record<number, number>>;      // area -> year -> count
	byMonth: Record<number, Record<number, number>>;     // year -> month -> count
}

export type PieGroupLevel = "code" | "category" | "area";