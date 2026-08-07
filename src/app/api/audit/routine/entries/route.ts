// src/app/api/audit/routine/entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(req.url);
	const yearParam = searchParams.get("year");
	const monthFrom = searchParams.get("month_from");
	const monthTo = searchParams.get("month_to");

	if (!yearParam)
		return NextResponse.json({ error: "year is required" }, { status: 400 });
	const year = Number(yearParam);

	const supabase = createServiceClient();
	let query = supabase
		.from("routine_audit_entries")
		.select("*, sam_code:routine_audit_sam_codes(area, category, code, description_zh)")
		.eq("report_year", year);

	// non-nullable ints — safe to filter directly, unlike the SMS review date columns
	if (monthFrom) query = query.gte("report_month", Number(monthFrom));
	if (monthTo) query = query.lte("report_month", Number(monthTo));

	const { data, error } = await query.order("audit_date", { ascending: true });

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ records: data });
}

export async function POST(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();

	// employee_id isn't in the JWT — fetch it for created_by
	const { data: userRecord } = await supabase
		.from("users")
		.select("employee_id")
		.eq("id", user.userId)
		.single();
	if (!userRecord)
		return NextResponse.json({ error: "User not found" }, { status: 404 });

	const body = await req.json();
	const {
		existing_entry_no, // set when adding another finding to the same audit
		audit_date,
		report_year,
		report_month,
		auditor_name,
		aircraft_tail,
		flight_no,
		route,
		finding,
		corrective_action,
		result,
		sam_code_id,
		is_non_flight_safety,
	} = body;

	if (!audit_date || !report_year || !report_month || !auditor_name || !aircraft_tail || !finding) {
		return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
	}

	const MAX_ATTEMPTS = 5;
	let lastError: string | null = null;

	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		let entry_no: string;
		let finding_seq: number;

		if (existing_entry_no) {
			const { data: siblings, error: siblingsError } = await supabase
				.from("routine_audit_entries")
				.select("finding_seq")
				.eq("entry_no", existing_entry_no)
				.order("finding_seq", { ascending: false })
				.limit(1);

			if (siblingsError)
				return NextResponse.json({ error: siblingsError.message }, { status: 500 });
			if (!siblings || siblings.length === 0)
				return NextResponse.json({ error: "existing_entry_no not found" }, { status: 404 });

			entry_no = existing_entry_no;
			finding_seq = siblings[0].finding_seq + 1;
		} else {
			const mm = String(report_month).padStart(2, "0");
			const { data: monthEntries, error: monthError } = await supabase
				.from("routine_audit_entries")
				.select("entry_no")
				.eq("report_year", report_year)
				.eq("report_month", report_month)
				.like("entry_no", `SA${mm}%`);

			if (monthError)
				return NextResponse.json({ error: monthError.message }, { status: 500 });

			const seqs = (monthEntries ?? [])
				.map((r) => parseInt(r.entry_no.slice(4), 10))
				.filter((n) => !Number.isNaN(n));
			const nextSeq = (seqs.length ? Math.max(...seqs) : 0) + 1;
			entry_no = `SA${mm}${String(nextSeq).padStart(2, "0")}`;
			finding_seq = 1;
		}

		const { data, error } = await supabase
			.from("routine_audit_entries")
			.insert({
				entry_no,
				finding_seq,
				audit_date,
				report_year,
				report_month,
				auditor_name,
				aircraft_tail,
				flight_no,
				route,
				finding,
				corrective_action,
				result: result ?? "OK",
				sam_code_id: sam_code_id ?? null,
				is_non_flight_safety: is_non_flight_safety ?? false,
				created_by: userRecord.employee_id,
			})
			.select("*, sam_code:routine_audit_sam_codes(area, category, code, description_zh)")
			.single();

		if (!error) {
			return NextResponse.json({ record: data }, { status: 201 });
		}

		// 23505 = unique_violation — someone else's insert landed between our
		// read and our write (the exact race this codebase already accepted
		// as a known risk for single-person usage). Recompute and retry
		// rather than surfacing a raw DB error to the user.
		if (error.code === "23505") {
			lastError = error.message;
			continue;
		}

		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json(
		{ error: `新增失敗，請重試 (${MAX_ATTEMPTS} 次嘗試後仍發生衝突: ${lastError})` },
		{ status: 409 }
	);
}