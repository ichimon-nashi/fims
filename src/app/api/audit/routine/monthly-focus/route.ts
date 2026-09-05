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
	const yearParam = searchParams.get("year");
	const monthParam = searchParams.get("month");

	// ── NEW: list mode — no year/month given at all means "list every
	// existing focus set," used by the editor's new browse view. Counting
	// items in a separate plain query rather than a Supabase relational
	// count aggregate, since I can't verify the exact FK alias Supabase
	// would expect here without access to the live schema — this is
	// slightly less efficient but unambiguous and safe. Table sizes here
	// are inherently small (a handful of items per month), so the cost is
	// negligible.
	if (!yearParam && !monthParam) {
		const { data: sets, error: setsError } = await supabase
			.from("monthly_focus_sets")
			.select("id, report_year, report_month")
			.order("report_year", { ascending: false })
			.order("report_month", { ascending: false });

		if (setsError)
			return NextResponse.json({ error: setsError.message }, { status: 500 });

		// full item rows now, not just a count — the list view shows every
		// item's actual text inline so reusing a past item doesn't require
		// clicking into that month first
		const { data: allItems, error: itemsError } = await supabase
			.from("monthly_focus_items")
			.select("focus_set_id, item_no, item_text, required_attachment_template_id")
			.order("sort_order", { ascending: true });

		if (itemsError)
			return NextResponse.json({ error: itemsError.message }, { status: 500 });

		const itemsBySet = new Map<string, { item_no: number; item_text: string; required_attachment_template_id: string | null }[]>();
		for (const it of allItems ?? []) {
			if (!itemsBySet.has(it.focus_set_id)) itemsBySet.set(it.focus_set_id, []);
			itemsBySet.get(it.focus_set_id)!.push({
				item_no: it.item_no,
				item_text: it.item_text,
				required_attachment_template_id: it.required_attachment_template_id,
			});
		}

		const list = (sets ?? []).map((s) => ({
			id: s.id,
			report_year: s.report_year,
			report_month: s.report_month,
			items: itemsBySet.get(s.id) ?? [],
		}));

		return NextResponse.json({ sets: list });
	}

	// ── EXISTING single-month lookup — unchanged ──
	const now = new Date();
	const year = Number(yearParam ?? now.getFullYear());
	const month = Number(monthParam ?? now.getMonth() + 1);

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
		required_attachment_template_id: it.required_attachment_template_id ?? null,
	}));

	const { error: insertError } = await supabase.from("monthly_focus_items").insert(rows);
	if (insertError)
		return NextResponse.json({ error: insertError.message }, { status: 500 });

	return NextResponse.json({ id: focusSet.id }, { status: 200 });
}