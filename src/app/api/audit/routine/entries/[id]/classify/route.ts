// src/app/api/audit/routine/entries/[id]/classify/route.ts
// Deliberately separate from the existing entries edit endpoint (unseen,
// presumably called by RoutineEntryModal's full-record edit, gated by
// broader edit permission). This route only touches the three fields a
// 'classify'-permission user should be able to change — it does not
// grant access to finding text, dates, or any other field.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { hasRoutineAction } from "@/lib/permissionHelpers";

export async function PATCH(
	req: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;

	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();

	const { data: userRecord } = await supabase
		.from("users")
		.select("employee_id, app_permissions")
		.eq("id", decoded.userId)
		.single();
	if (!userRecord)
		return NextResponse.json({ error: "User not found" }, { status: 404 });

	const user = { employee_id: userRecord.employee_id, app_permissions: userRecord.app_permissions } as any;
	if (!hasRoutineAction(user, "classify").granted)
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const body = await req.json();
	const updatePayload: Record<string, unknown> = { updated_by: userRecord.employee_id, updated_at: new Date().toISOString() };

	// partial update — only touch fields actually sent, so toggling the
	// flag alone doesn't require also resending sam_code/ef_code
	if ("sam_code" in body) updatePayload.sam_code = body.sam_code;
	if ("ef_code" in body) updatePayload.ef_code = body.ef_code;
	if ("flagged_item" in body) updatePayload.flagged_item = body.flagged_item;

	if (Object.keys(updatePayload).length === 2) {
		// only updated_by/updated_at present — nothing to actually change
		return NextResponse.json({ error: "No classify fields provided" }, { status: 400 });
	}

	const { data, error } = await supabase
		.from("routine_audit_entries")
		.update(updatePayload)
		.eq("id", id)
		.select()
		.single();

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	if (!data)
		return NextResponse.json({ error: "Entry not found" }, { status: 404 });

	return NextResponse.json({ record: data });
}