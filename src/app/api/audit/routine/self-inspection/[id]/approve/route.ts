// src/app/api/audit/routine/self-inspection/[id]/approve/route.ts
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

	const { data: form, error: formError } = await supabase
		.from("audit_routine_forms")
		.select("*")
		.eq("id", id)
		.eq("status", "pending")
		.single();

	if (formError || !form)
		return NextResponse.json({ error: "Pending submission not found" }, { status: 404 });

	const body = await req.json();
	const {
		finding, // supervisor-confirmed finding text — defaults to the submitted comment if omitted
		result, // "OK" | "NG" — required, supervisor's call
		corrective_action,
		report_year,
		report_month,
	} = body;

	if (!result || (result !== "OK" && result !== "NG")) {
		return NextResponse.json({ error: "result must be OK or NG" }, { status: 400 });
	}

	const findingText = finding ?? form.comments ?? "";
	if (!findingText) {
		return NextResponse.json(
			{ error: "No finding text — either the submission has no comment, or one must be provided" },
			{ status: 400 },
		);
	}

	const { data: submitterRecord } = await supabase
		.from("users")
		.select("full_name")
		.eq("employee_id", form.submitted_by)
		.single();

	const auditDate = new Date(form.audit_date);

	// unchanged RPC — same call every existing manual finding uses, so
	// this promotion is indistinguishable from a manually-entered finding
	// at the point of creation
	const { data: createdEntry, error: rpcError } = await supabase.rpc("create_routine_audit_finding", {
		p_existing_entry_no: null,
		p_manual_entry_no: null,
		p_prefix: "SA",
		p_audit_date: form.audit_date,
		p_report_year: report_year ?? auditDate.getFullYear(),
		p_report_month: report_month ?? auditDate.getMonth() + 1,
		p_auditor_name: submitterRecord?.full_name ?? form.submitted_by, // resolved from the submitter (created_by convention) — falls back to raw employee_id only if the users lookup somehow fails
		p_aircraft_tail: form.aircraft_tail,
		p_flight_no: form.flight_no,
		p_route: form.route,
		p_finding: findingText,
		p_corrective_action: corrective_action ?? null,
		p_sam_code: null, // left null deliberately — clerical classification happens later, in Routine Summary
		p_ef_code: null,
		p_is_non_flight_safety: false,
		p_special_remarks: [],
		p_created_by: form.submitted_by, // attributed to whoever filled out the checklist, not the approving supervisor — confirm this is the convention you want
	});

	if (rpcError)
		return NextResponse.json({ error: rpcError.message }, { status: 500 });

	// create_routine_audit_finding doesn't know about the new columns —
	// tag the created row for traceability and set the review-flag default
	// explicitly (flagged_item already defaults true at the DB level, so
	// this is really just source + self_inspection_form_id)
	const createdId = (createdEntry as any)?.id ?? (createdEntry as any)?.[0]?.id;
	if (createdId) {
		await supabase
			.from("routine_audit_entries")
			.update({ source: "self_inspection", self_inspection_form_id: form.id })
			.eq("id", createdId);
	}

	const { error: updateFormError } = await supabase
		.from("audit_routine_forms")
		.update({
			status: "approved",
			reviewed_by: userRecord.employee_id,
			reviewed_at: new Date().toISOString(),
			entry_no: (createdEntry as any)?.entry_no ?? (createdEntry as any)?.[0]?.entry_no ?? null,
		})
		.eq("id", form.id);

	if (updateFormError)
		return NextResponse.json({ error: updateFormError.message }, { status: 500 });

	return NextResponse.json({ record: createdEntry });
}