// src/app/api/audit/routine/monthly-focus/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { hasRoutineAction } from "@/lib/permissionHelpers";

export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();

	const { searchParams } = new URL(req.url);
	const now = new Date();
	const year = Number(searchParams.get("year") ?? now.getFullYear());
	const month = Number(searchParams.get("month") ?? now.getMonth() + 1);

	const { data: focusSet, error: setError } = await supabase
		.from("monthly_focus_sets")
		.select("*")
		.eq("report_year", year)
		.eq("report_month", month)
		.maybeSingle();

	if (setError)
		return NextResponse.json({ error: setError.message }, { status: 500 });

	// no set for this month yet is a normal state (nobody's created it), not an error —
	// the form should still render, just with an empty 本月加強重點檢查 section
	if (!focusSet)
		return NextResponse.json({ focusSet: null, items: [] });

	const { data: items, error: itemsError } = await supabase
		.from("monthly_focus_items")
		.select("*")
		.eq("focus_set_id", focusSet.id)
		.order("sort_order", { ascending: true });

	if (itemsError)
		return NextResponse.json({ error: itemsError.message }, { status: 500 });

	return NextResponse.json({ focusSet, items });
}

// Create or replace a month's focus items in one call — the editor
// always submits the full list for the month rather than diffing
// individual add/remove operations, since it's at most a handful of
// short text rows.
export async function PUT(req: NextRequest) {
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

	// curating this list is a supervisor task per earlier discussion —
	// gated to 'approve', not 'submit'
	const user = { employee_id: userRecord.employee_id, app_permissions: userRecord.app_permissions } as any;
	if (!hasRoutineAction(user, "approve").granted)
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const body = await req.json();
	const { report_year, report_month, items } = body; // items: [{item_no, item_text}]

	if (!report_year || !report_month || !Array.isArray(items)) {
		return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
	}

	const { data: focusSet, error: upsertSetError } = await supabase
		.from("monthly_focus_sets")
		.upsert(
			{ report_year, report_month, created_by: userRecord.employee_id },
			{ onConflict: "report_year,report_month" },
		)
		.select("id")
		.single();

	if (upsertSetError)
		return NextResponse.json({ error: upsertSetError.message }, { status: 500 });

	// replace-all is simplest and safe here — small row count, no other
	// table references monthly_focus_items by id, so nothing dangles
	const { error: deleteError } = await supabase
		.from("monthly_focus_items")
		.delete()
		.eq("focus_set_id", focusSet.id);

	if (deleteError)
		return NextResponse.json({ error: deleteError.message }, { status: 500 });

	const rows = items.map((it: any, idx: number) => ({
		focus_set_id: focusSet.id,
		item_no: it.item_no ?? idx + 1,
		item_text: it.item_text,
		sort_order: idx,
	}));

	const { error: insertError } = await supabase.from("monthly_focus_items").insert(rows);
	if (insertError)
		return NextResponse.json({ error: insertError.message }, { status: 500 });

	return NextResponse.json({ id: focusSet.id }, { status: 200 });
}