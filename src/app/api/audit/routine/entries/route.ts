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
	// no join needed anymore — sam_code is a plain text column, resolved to
	// category/area/description client-side via SAM_CODE_MAP
	let query = supabase
		.from("routine_audit_entries")
		.select("*")
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
		manual_entry_no, // user-chosen/edited entry_no for a brand new audit
		prefix, // "SA" or "GA" — fallback if manual_entry_no is empty
		audit_date,
		report_year,
		report_month,
		auditor_name,
		aircraft_tail,
		flight_no,
		route,
		finding,
		corrective_action,
		sam_code,
		ef_code,
		is_non_flight_safety,
		special_remarks,
	} = body;

	if (!audit_date || !report_year || !report_month || !auditor_name || !aircraft_tail || !finding) {
		return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
	}

	// entry_no/finding_seq generation + insert happen atomically inside the
	// DB function via pg_advisory_xact_lock — this replaces the old
	// "read max, retry on 23505" pattern, which only handled transient
	// races and failed deterministically on non-transient collisions
	const { data, error } = await supabase.rpc("create_routine_audit_finding", {
		p_existing_entry_no: existing_entry_no ?? null,
		p_manual_entry_no: manual_entry_no ?? null,
		p_prefix: prefix ?? "SA",
		p_audit_date: audit_date,
		p_report_year: report_year,
		p_report_month: report_month,
		p_auditor_name: auditor_name,
		p_aircraft_tail: aircraft_tail,
		p_flight_no: flight_no ?? null,
		p_route: route ?? null,
		p_finding: finding,
		p_corrective_action: corrective_action ?? null,
		p_sam_code: sam_code ?? null,
		p_ef_code: ef_code ?? null,
		p_is_non_flight_safety: is_non_flight_safety ?? false,
		p_special_remarks: special_remarks ?? [],
		p_created_by: userRecord.employee_id,
	});

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ record: data }, { status: 201 });
}