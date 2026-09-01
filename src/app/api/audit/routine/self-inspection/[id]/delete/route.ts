// src/app/api/audit/routine/self-inspection/[id]/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { hasRoutineAction } from "@/lib/permissionHelpers";

export async function POST(
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
	if (!hasRoutineAction(user, "approve").granted)
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	// only pending submissions are deletable this way — an approved
	// submission already has a real finding tied to it in
	// routine_audit_entries and must go through that table's own
	// delete/edit flow, not this one
	const { data, error } = await supabase
		.from("audit_routine_forms")
		.delete()
		.eq("id", id)
		.eq("status", "pending")
		.select("id")
		.single();

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	if (!data)
		return NextResponse.json({ error: "Pending submission not found" }, { status: 404 });

	return NextResponse.json({ id: data.id, deleted: true });
}