// src/app/api/audit/firstlevel/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

export async function GET(
	req: NextRequest,
	{ params }: { params: { id: string } },
) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("audit_first_level")
		.select("*")
		.eq("id", params.id)
		.single();

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	if (!data)
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({ record: data });
}

export async function PATCH(
	req: NextRequest,
	{ params }: { params: { id: string } },
) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();

	// Verify record exists and is not already submitted
	const { data: existing } = await supabase
		.from("audit_first_level")
		.select("status, auditor_id")
		.eq("id", params.id)
		.single();

	if (!existing)
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	if (existing.status === "submitted") {
		return NextResponse.json(
			{ error: "Submitted audits cannot be modified" },
			{ status: 403 },
		);
	}

	const body = await req.json();
	const now = new Date().toISOString();

	const updatePayload: Record<string, unknown> = {
		updated_at: now,
	};

	// Only allow updating these fields
	const allowed = [
		"responses",
		"additional_remarks",
		"reviewer_name",
		"reviewer_date",
		"period_start",
		"period_end",
		"auditor_name",
		"status",
	];
	for (const key of allowed) {
		if (key in body) updatePayload[key] = body[key];
	}

	if (body.status === "submitted") {
		updatePayload.submitted_at = now;
	}

	const { data, error } = await supabase
		.from("audit_first_level")
		.update(updatePayload)
		.eq("id", params.id)
		.select()
		.single();

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ record: data });
}

export async function DELETE(
	req: NextRequest,
	{ params }: { params: { id: string } },
) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();

	const { data: existing } = await supabase
		.from("audit_first_level")
		.select("status")
		.eq("id", params.id)
		.single();

	if (!existing)
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	if (existing.status === "submitted") {
		return NextResponse.json(
			{ error: "Submitted audits cannot be deleted" },
			{ status: 403 },
		);
	}

	const { error } = await supabase
		.from("audit_first_level")
		.delete()
		.eq("id", params.id);

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ success: true });
}
