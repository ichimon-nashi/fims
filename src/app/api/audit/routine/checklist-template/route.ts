// src/app/api/audit/routine/checklist-template/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { hasAuditTabAccess } from "@/lib/permissionHelpers";

// No permission gate beyond authentication — reading the current
// checklist structure isn't sensitive, and both submit and approve
// flows need it (approve to render the original form for the 檢視完整表單 view).
export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();

	const { searchParams } = new URL(req.url);
	const templateId = searchParams.get("id");
	const type = searchParams.get("type"); // "attachment" — list all active attachment templates instead of the single active main one

	if (type === "attachment") {
		const { data: templates, error: templatesError } = await supabase
			.from("checklist_templates")
			.select("*")
			.eq("template_type", "attachment")
			.eq("active", true);
		if (templatesError)
			return NextResponse.json({ error: templatesError.message }, { status: 500 });

		const results = [];
		for (const template of templates ?? []) {
			const { data: items, error: itemsError } = await supabase
				.from("checklist_template_items")
				.select("*")
				.eq("template_id", template.id)
				.order("sort_order", { ascending: true });
			if (itemsError)
				return NextResponse.json({ error: itemsError.message }, { status: 500 });
			results.push({ template, items });
		}
		return NextResponse.json({ templates: results });
	}

	const templateQuery = templateId
		? supabase.from("checklist_templates").select("*").eq("id", templateId).single()
		: supabase
				.from("checklist_templates")
				.select("*")
				.eq("template_type", "main") // fixed — this was missing, meaning an attachment template with a later effective_date than main's would have silently won the "get active main template" lookup
				.eq("active", true)
				.order("effective_date", { ascending: false })
				.limit(1)
				.single();

	const { data: template, error: templateError } = await templateQuery;
	if (templateError || !template)
		return NextResponse.json({ error: "No active checklist template found" }, { status: 404 });

	const { data: items, error: itemsError } = await supabase
		.from("checklist_template_items")
		.select("*")
		.eq("template_id", template.id)
		.order("sort_order", { ascending: true });

	if (itemsError)
		return NextResponse.json({ error: itemsError.message }, { status: 500 });

	return NextResponse.json({ template, items });
}

// ── NEW ── create a new attachment-type template
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
	if (!hasAuditTabAccess(user, "routine").granted)
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const body = await req.json();
	const { code, name, always_required } = body;

	if (!code?.trim() || !name?.trim()) {
		return NextResponse.json({ error: "code and name are required" }, { status: 400 });
	}

	const { data: existing } = await supabase
		.from("checklist_templates")
		.select("id")
		.eq("code", code.trim())
		.eq("active", true)
		.maybeSingle();
	if (existing) {
		return NextResponse.json({ error: `代碼 "${code}" 已存在，請使用不同代碼` }, { status: 409 });
	}

	const { data, error } = await supabase
		.from("checklist_templates")
		.insert({
			template_type: "attachment",
			code: code.trim(),
			name: name.trim(),
			always_required: Boolean(always_required),
			version: 1,
			effective_date: new Date().toISOString().slice(0, 10),
			active: true,
		})
		.select()
		.single();

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ template: data }, { status: 201 });
}