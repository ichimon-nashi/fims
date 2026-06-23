// src/app/api/audit/firstlevel/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await context.params;
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("audit_first_level")
		.select("*")
		.eq("id", id)
		.single();

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	if (!data)
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	return NextResponse.json({ record: data });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await context.params;
	const supabase = createServiceClient();

	const { data: existing } = await supabase
		.from("audit_first_level")
		.select("status")
		.eq("id", id)
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
	const updatePayload: Record<string, unknown> = { updated_at: now };

	const allowed = [
		"responses",
		"recommendations",
		"audit_date",
		"status",
		"auditors",
	];
	for (const key of allowed) {
		if (key in body) updatePayload[key] = body[key];
	}

	// Keep auditor_name + auditor_id in sync
	if (body.auditors) {
		const arr = body.auditors as {
			employee_id: string;
			full_name: string;
		}[];
		updatePayload.auditor_name = arr.map((a) => a.full_name).join(", ");
		updatePayload.auditor_id = arr[0]?.employee_id || "";
	}

	if (body.status === "submitted") updatePayload.submitted_at = now;

	const { data, error } = await supabase
		.from("audit_first_level")
		.update(updatePayload)
		.eq("id", id)
		.select()
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
		.from("audit_first_level")
		.select("status")
		.eq("id", id)
		.single();

	if (!existing)
		return NextResponse.json({ error: "Not found" }, { status: 404 });

	if (existing.status === "submitted") {
		// JWT only has userId — look up employee_id to check admin access
		const { data: userRecord } = await supabase
			.from("users")
			.select("employee_id")
			.eq("id", user.userId)
			.single();

		const isAdmin =
			userRecord?.employee_id === "51892" ||
			userRecord?.employee_id === "admin";

		if (!isAdmin) {
			return NextResponse.json(
				{ error: "Submitted audits cannot be deleted" },
				{ status: 403 },
			);
		}
	}

	const { error } = await supabase
		.from("audit_first_level")
		.delete()
		.eq("id", id);

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ success: true });
}