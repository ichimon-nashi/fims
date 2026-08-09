// src/app/api/audit/routine/entries/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await context.params;
	const supabase = createServiceClient();

	const { data: userRecord } = await supabase
		.from("users")
		.select("employee_id")
		.eq("id", user.userId)
		.single();
	if (!userRecord)
		return NextResponse.json({ error: "User not found" }, { status: 404 });

	const { data: existing } = await supabase
		.from("routine_audit_entries")
		.select("id")
		.eq("id", id)
		.single();
	if (!existing)
		return NextResponse.json({ error: "Not found" }, { status: 404 });

	const body = await req.json();
	const updatePayload: Record<string, unknown> = {
		updated_at: new Date().toISOString(),
		updated_by: userRecord.employee_id,
	};

	const allowed = [
		"entry_no",
		"audit_date",
		"report_year",
		"report_month",
		"auditor_name",
		"aircraft_tail",
		"flight_no",
		"route",
		"finding",
		"corrective_action",
		"result",
		"sam_code",
		"ef_code",
		"is_non_flight_safety",
		"is_special_audit",
	];
	for (const key of allowed) {
		if (key in body) updatePayload[key] = body[key];
	}

	const { data, error } = await supabase
		.from("routine_audit_entries")
		.update(updatePayload)
		.eq("id", id)
		.select("*")
		.single();

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ record: data });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await context.params;
	const supabase = createServiceClient();

	const { data: existing } = await supabase
		.from("routine_audit_entries")
		.select("id")
		.eq("id", id)
		.single();
	if (!existing)
		return NextResponse.json({ error: "Not found" }, { status: 404 });

	const { error } = await supabase
		.from("routine_audit_entries")
		.delete()
		.eq("id", id);

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ success: true });
}