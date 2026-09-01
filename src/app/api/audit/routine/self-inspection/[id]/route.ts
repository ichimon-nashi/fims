// src/app/api/audit/routine/self-inspection/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { hasRoutineAction } from "@/lib/permissionHelpers";

export async function GET(
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

	const { data: form, error: formError } = await supabase
		.from("audit_routine_forms")
		.select("*, audit_routine_form_attachments(id, subject_crew_name, subject_employee_id, checklist_templates(id, code, name))")
		.eq("id", id)
		.single();

	if (formError || !form)
		return NextResponse.json({ error: "Submission not found" }, { status: 404 });

	// gate: approve permission, or the original submitter viewing their own
	const canApprove = hasRoutineAction(user, "approve").granted;
	const isOwner = form.submitted_by === userRecord.employee_id;
	if (!canApprove && !isOwner)
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const { data: allItems, error: itemsError } = await supabase
		.from("audit_routine_items")
		.select("*")
		.eq("form_id", id);

	if (itemsError)
		return NextResponse.json({ error: itemsError.message }, { status: 500 });

	const { data: mainTemplateItems } = await supabase
		.from("checklist_template_items")
		.select("*")
		.eq("template_id", form.template_id)
		.order("sort_order", { ascending: true });

	let focusTemplateItems: any[] = [];
	if (form.focus_set_id) {
		const { data } = await supabase
			.from("monthly_focus_items")
			.select("*")
			.eq("focus_set_id", form.focus_set_id)
			.order("sort_order", { ascending: true });
		focusTemplateItems = data ?? [];
	}

	// attachment item text comes from checklist_template_items too, keyed
	// by whichever template each attachment instance uses
	const attachmentTemplateIds = (form.audit_routine_form_attachments ?? []).map((a: any) => a.checklist_templates?.id).filter(Boolean);
	const { data: attachmentTemplateItems } = attachmentTemplateIds.length
		? await supabase.from("checklist_template_items").select("*").in("template_id", attachmentTemplateIds).order("sort_order", { ascending: true })
		: { data: [] };

	function mergeAnswers(templateItems: any[], itemType: string, attachmentId: string | null = null) {
		return templateItems.map((ti) => {
			const answer = (allItems ?? []).find(
				(it) => it.item_type === itemType && it.item_no === ti.item_no && it.attachment_id === attachmentId,
			);
			return {
				item_no: ti.item_no,
				category: ti.category,
				item_text: ti.item_text,
				ccom_ref: ti.ccom_ref,
				result: answer?.result ?? null,
				remark: answer?.remark ?? null,
			};
		});
	}

	const main = mergeAnswers(mainTemplateItems ?? [], "main");
	const focus = mergeAnswers(
		focusTemplateItems.map((f) => ({ item_no: f.item_no, category: null, item_text: f.item_text, ccom_ref: null })),
		"focus",
	);
	const attachments = (form.audit_routine_form_attachments ?? []).map((att: any) => ({
		id: att.id,
		template_id: att.checklist_templates?.id,
		subject_crew_name: att.subject_crew_name,
		subject_employee_id: att.subject_employee_id,
		template_name: att.checklist_templates?.name,
		items: mergeAnswers(
			(attachmentTemplateItems ?? []).filter((ti) => ti.template_id === att.checklist_templates?.id),
			"attachment",
			att.id,
		),
	}));

	return NextResponse.json({
		form: {
			audit_date: form.audit_date,
			aircraft_tail: form.aircraft_tail,
			flight_no: form.flight_no,
			route: form.route,
			ca_name: form.ca_name,
			fo_name: form.fo_name,
			cabin_crew: form.cabin_crew,
			comments: form.comments,
			status: form.status,
			template_id: form.template_id,
			focus_set_id: form.focus_set_id,
			submitted_by: form.submitted_by,
			submitted_at: form.submitted_at,
			// reviewed_by intentionally omitted — internal only
		},
		main,
		focus,
		attachments,
	});
}