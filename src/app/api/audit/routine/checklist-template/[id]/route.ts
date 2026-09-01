// src/app/api/audit/routine/checklist-template/[id]/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { hasAuditTabAccess } from "@/lib/permissionHelpers";

export async function PUT(
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
	if (!hasAuditTabAccess(user, "routine").granted)
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const body = await req.json();
	const { items } = body; // [{item_no, category, item_text, ccom_ref}]
	if (!Array.isArray(items)) {
		return NextResponse.json({ error: "items must be an array" }, { status: 400 });
	}

	// confirm the template actually exists and is an attachment type —
	// this route shouldn't be usable to blow away the main checklist's
	// items via a mistaken id
	const { data: template } = await supabase
		.from("checklist_templates")
		.select("id, template_type")
		.eq("id", id)
		.single();
	if (!template)
		return NextResponse.json({ error: "Template not found" }, { status: 404 });
	if (template.template_type !== "attachment") {
		return NextResponse.json({ error: "This endpoint only edits attachment-type templates" }, { status: 400 });
	}

	// replace-all — same reasoning as monthly-focus: short, infrequently
	// edited lists, no other table references these items by id, so
	// nothing dangles when they're deleted and reinserted
	const { error: deleteError } = await supabase.from("checklist_template_items").delete().eq("template_id", id);
	if (deleteError)
		return NextResponse.json({ error: deleteError.message }, { status: 500 });

	if (items.length > 0) {
		const rows = items.map((it: any, idx: number) => ({
			template_id: id,
			item_no: it.item_no ?? idx + 1,
			category: it.category || null,
			item_text: it.item_text,
			ccom_ref: it.ccom_ref || null,
			sort_order: idx,
		}));
		const { error: insertError } = await supabase.from("checklist_template_items").insert(rows);
		if (insertError)
			return NextResponse.json({ error: insertError.message }, { status: 500 });
	}

	return NextResponse.json({ id, count: items.length });
}