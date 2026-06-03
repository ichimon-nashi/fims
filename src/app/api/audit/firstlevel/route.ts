// src/app/api/audit/firstlevel/route.ts
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
	const year = searchParams.get("year");
	const half = searchParams.get("half");
	const section = searchParams.get("section");
	const status = searchParams.get("status");

	const supabase = createServiceClient();
	let query = supabase
		.from("audit_first_level")
		.select(
			"id, year, half, section, auditor_id, auditor_name, status, created_at, updated_at, submitted_at, period_start, period_end",
		)
		.order("created_at", { ascending: false });

	if (year) query = query.eq("year", parseInt(year));
	if (half) query = query.eq("half", parseInt(half));
	if (section) query = query.eq("section", section);
	if (status) query = query.eq("status", status);

	const { data, error } = await query;
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

	const body = await req.json();
	const {
		year,
		half,
		section,
		period_start,
		period_end,
		auditor_id,
		auditor_name,
		status,
		responses,
		additional_remarks,
		reviewer_name,
		reviewer_date,
	} = body;

	if (!year || !half || !section || !auditor_id || !auditor_name) {
		return NextResponse.json(
			{ error: "Missing required fields" },
			{ status: 400 },
		);
	}

	const supabase = createServiceClient();
	const now = new Date().toISOString();

	const { data, error } = await supabase
		.from("audit_first_level")
		.insert({
			year,
			half,
			section,
			period_start: period_start || null,
			period_end: period_end || null,
			auditor_id,
			auditor_name,
			status: status || "draft",
			responses: responses || {},
			additional_remarks: additional_remarks || null,
			reviewer_name: reviewer_name || null,
			reviewer_date: reviewer_date || null,
			submitted_at: status === "submitted" ? now : null,
			updated_at: now,
		})
		.select()
		.single();

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ record: data });
}
