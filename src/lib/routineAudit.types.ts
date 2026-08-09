// src/lib/routineAudit.types.ts
// SamCode / sam_code_id are gone — SAM codes now live as a plain TS
// constant (src/lib/routineAudit.constants.ts), same pattern as EF codes.
// Entries store the code string directly.

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
	sam_code: string | null; // e.g. "RM01" — resolve via SAM_CODE_MAP for category/area/description
	ef_code: string | null; // e.g. "P4-03" — resolve via EF_CODE_MAP for attribute/description
	is_non_flight_safety: boolean;
	is_special_audit: boolean; // e.g. 春節加強查核 — header-level, shared across all findings in the group
	created_by: string;
	created_at: string;
	updated_by: string | null;
	updated_at: string | null;
}

// payload for creating a finding — either a brand new audit or an additional
// finding under an existing one (see entries POST route)
export interface CreateEntryPayload {
	existing_entry_no?: string;
	manual_entry_no?: string; // user-chosen/edited entry_no for a brand new audit, overrides prefix-based auto-generation
	prefix?: string; // "SA" or "GA" — fallback if manual_entry_no is somehow empty
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
	sam_code?: string | null;
	ef_code?: string | null;
	is_non_flight_safety?: boolean;
	is_special_audit?: boolean;
}

export type UpdateEntryPayload = Partial<Omit<CreateEntryPayload, "existing_entry_no">>;

export interface RoutineSummaryResponse {
	byCode: Record<string, Record<number, number>>;      // SAM code -> year -> count
	byCategory: Record<string, Record<number, number>>; // category -> year -> count
	byEfCode: Record<string, Record<number, number>>;    // EF code -> year -> count
	byEfMiddle: Record<string, Record<number, number>>;  // EF middle category (attribute) -> year -> count
	byMonth: Record<number, Record<number, number>>;     // year -> month -> count
}

export type PieGroupLevel = "code" | "category";