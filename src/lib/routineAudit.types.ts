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
	special_remarks: string[]; // e.g. ["春節加強查核", "一級自我督察"] — header-level, shared across all findings in the group
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
	special_remarks?: string[];
}

export type UpdateEntryPayload = Partial<Omit<CreateEntryPayload, "existing_entry_no">>;

// ── CHANGED ──────────────────────────────────────
// Was Record<string, Record<number, number>> (label -> year -> count),
// built for a single request covering multiple years with one shared
// month range. The summary route now returns exactly one period per
// call (year + month_from + month_to all fixed for that response) — the
// caller fetches twice and combines client-side for comparison, matching
// the same pattern /api/sms/trend-analysis already uses. Flat
// Record<label, count> replaces the year-keyed nesting. byArea added —
// the route always computed this, the type just never declared it.
export interface RoutineSummaryResponse {
	year: number;
	monthFrom: number;
	monthTo: number;
	byCode: Record<string, number>;      // SAM code -> count
	byCategory: Record<string, number>;  // SAM category -> count
	byArea: Record<string, number>;      // SAM area / HFACS top tier -> count
	byEfCode: Record<string, number>;    // EF code -> count
	byEfMiddle: Record<string, number>;  // EF middle category (attribute) -> count
	byMonth: Record<number, number>;     // month -> count
}
// ─────────────────────────────────────────────────

export type PieGroupLevel = "code" | "category";

// Chart style for the year-over-year category comparison view
export type ChartStyle = "bar" | "radar";