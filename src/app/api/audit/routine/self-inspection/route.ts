// src/app/api/audit/routine/self-inspection/route.ts
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

	const { data: userRecord } = await supabase
		.from("users")
		.select("employee_id, app_permissions")
		.eq("id", decoded.userId)
		.single();
	if (!userRecord)
		return NextResponse.json({ error: "User not found" }, { status: 404 });

	const user = { employee_id: userRecord.employee_id, app_permissions: userRecord.app_permissions } as any;

	const { searchParams } = new URL(req.url);
	const scope = searchParams.get("scope"); // "own" | null (all)
	const status = searchParams.get("status") ?? "pending";

	let query = supabase
		.from("audit_routine_forms")
		.select("*, audit_routine_form_attachments(id, subject_crew_name, subject_crew_position, checklist_templates(code, name))")
		.eq("status", status);

	if (scope === "own") {
		if (!hasRoutineAction(user, "submit").granted)
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		query = query.eq("submitted_by", userRecord.employee_id);
	} else {
		if (!hasRoutineAction(user, "approve").granted)
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		// reviewed_by intentionally not selected — internal only, not surfaced to the client
	}

	const { data, error } = await query.order("submitted_at", { ascending: true });

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });

	// submitted_by is a plain text employee_id column, not a real FK to
	// users — PostgREST can't auto-embed it, so resolve names manually
	const submitterIds = [...new Set((data ?? []).map((f) => f.submitted_by))];
	const { data: submitters } = submitterIds.length
		? await supabase.from("users").select("employee_id, full_name").in("employee_id", submitterIds)
		: { data: [] };
	const nameMap = new Map((submitters ?? []).map((u) => [u.employee_id, u.full_name]));

	// strip internal-only fields defensively even for the "own" scope,
	// in case a future column addition forgets this rule
	const records = (data ?? []).map(({ reviewed_by, ...rest }) => ({
		...rest,
		submitted_by_name: nameMap.get(rest.submitted_by) ?? rest.submitted_by,
	}));

	return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
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

	const body = await req.json();
	const isEdit = Boolean(body.existing_form_id);

	if (isEdit) {
		if (!hasRoutineAction(user, "approve").granted)
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	} else {
		if (!hasRoutineAction(user, "submit").granted)
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const {
		client_uuid,
		existing_form_id,
		audit_date,
		aircraft_tail,
		flight_no,
		route,
		ca_name,
		fo_name,
		cabin_crew,
		template_id,
		focus_set_id,
		comments,
		items,
		attachments,
	} = body;

	if (!audit_date || !aircraft_tail || !template_id || !Array.isArray(items)) {
		return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
	}
	if (!isEdit && !client_uuid) {
		return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
	}

	let formId: string;

	if (isEdit) {
		// editing an existing pending submission — must still be pending,
		// approving/rejecting is a separate action and shouldn't be
		// re-openable for editing after the fact through this route
		const { data: existingForm, error: fetchError } = await supabase
			.from("audit_routine_forms")
			.select("id, status")
			.eq("id", existing_form_id)
			.single();
		if (fetchError || !existingForm)
			return NextResponse.json({ error: "Submission not found" }, { status: 404 });
		if (existingForm.status !== "pending")
			return NextResponse.json({ error: "Only pending submissions can be edited" }, { status: 409 });

		const { error: updateError } = await supabase
			.from("audit_routine_forms")
			.update({
				audit_date,
				aircraft_tail,
				flight_no: flight_no ?? null,
				route: route ?? null,
				ca_name: ca_name ?? null,
				fo_name: fo_name ?? null,
				cabin_crew: cabin_crew ?? [],
				comments: comments ?? null,
			})
			.eq("id", existing_form_id);
		if (updateError)
			return NextResponse.json({ error: updateError.message }, { status: 500 });

		formId = existing_form_id;
	} else {
		// idempotent on client_uuid — an offline-queued submission that syncs
		// twice (flaky connection, retried request) must not create two forms
		const { data: inserted, error: insertError } = await supabase
			.from("audit_routine_forms")
			.insert({
				client_uuid,
				audit_date,
				aircraft_tail,
				flight_no: flight_no ?? null,
				route: route ?? null,
				ca_name: ca_name ?? null,
				fo_name: fo_name ?? null,
				cabin_crew: cabin_crew ?? [],
				template_id,
				focus_set_id: focus_set_id ?? null,
				comments: comments ?? null,
				submitted_by: userRecord.employee_id,
			})
			.select("id")
			.single();

		if (insertError) {
			// 23505 = unique violation on client_uuid — already submitted, not a new error
			if (insertError.code === "23505") {
				const { data: existing, error: fetchError2 } = await supabase
					.from("audit_routine_forms")
					.select("id")
					.eq("client_uuid", client_uuid)
					.single();
				if (fetchError2 || !existing)
					return NextResponse.json({ error: insertError.message }, { status: 500 });
				formId = existing.id;
			} else {
				return NextResponse.json({ error: insertError.message }, { status: 500 });
			}
		} else {
			formId = inserted.id;
		}
	}

	// delete-then-insert, not upsert — the unique constraint includes
	// attachment_id, which is NULL for every main/focus item, and NULL is
	// never equal to NULL for Postgres uniqueness purposes. ON CONFLICT
	// silently never matched on edit, inserting duplicate rows instead of
	// updating. This is safe for both create (nothing to delete) and edit
	// (correctly replaces) since the client always resubmits the full set.
	const { error: deleteMainFocusError } = await supabase
		.from("audit_routine_items")
		.delete()
		.eq("form_id", formId)
		.in("item_type", ["main", "focus"]);

	if (deleteMainFocusError)
		return NextResponse.json({ error: deleteMainFocusError.message }, { status: 500 });

	const itemRows = items.map((it: any) => ({
		form_id: formId,
		item_type: it.item_type,
		item_no: it.item_no,
		result: it.result,
		remark: it.remark ?? null,
	}));

	if (itemRows.length > 0) {
		const { error: itemsError } = await supabase.from("audit_routine_items").insert(itemRows);
		if (itemsError)
			return NextResponse.json({ error: itemsError.message }, { status: 500 });
	}

	// attachments — each is at most one per (form, template) per the schema
	// constraint, upserted the same way as the form itself for offline-retry safety
	for (const att of attachments ?? []) {
		if (!att.subject_crew_name) continue; // an added-but-unfilled attachment (e.g. fatigue with no subject picked yet) shouldn't be persisted as a real instance

		const { data: attRow, error: attError } = await supabase
			.from("audit_routine_form_attachments")
			.upsert(
				{
					form_id: formId,
					template_id: att.template_id,
					subject_crew_name: att.subject_crew_name,
					subject_employee_id: att.subject_employee_id ?? null,
				},
				{ onConflict: "form_id,template_id" },
			)
			.select("id")
			.single();

		if (attError)
			return NextResponse.json({ error: attError.message }, { status: 500 });

		const attItemRows = (att.items ?? []).map((it: any) => ({
			form_id: formId,
			item_type: "attachment",
			attachment_id: attRow.id,
			item_no: it.item_no,
			result: it.result,
			remark: it.remark ?? null,
		}));

		const { error: deleteAttItemsError } = await supabase
			.from("audit_routine_items")
			.delete()
			.eq("form_id", formId)
			.eq("item_type", "attachment")
			.eq("attachment_id", attRow.id);
		if (deleteAttItemsError)
			return NextResponse.json({ error: deleteAttItemsError.message }, { status: 500 });

		if (attItemRows.length > 0) {
			const { error: attItemsError } = await supabase.from("audit_routine_items").insert(attItemRows);
			if (attItemsError)
				return NextResponse.json({ error: attItemsError.message }, { status: 500 });
		}
	}

	return NextResponse.json({ id: formId }, { status: 201 });
}