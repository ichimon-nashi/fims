// src/app/api/faq/[id]/route.ts  — admin write endpoints
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

const ADMINS = ["admin", "51892"]; // same gate as 使用者管理

function getAuth(req: NextRequest): { userId: string; email: string; authLevel: number } | null {
	const token = extractTokenFromHeader(req.headers.get("authorization"));
	if (!token) return null;
	try {
		return verifyToken(token) as any;
	} catch {
		return null;
	}
}

async function requireAdmin(req: NextRequest, supabase: ReturnType<typeof createServiceClient>) {
	const auth = getAuth(req);
	if (!auth) return null;

	// JWT payload is { userId, email, authLevel } — employee_id isn't on
	// the token, it has to come from the users table.
	const { data: userRow } = await supabase
		.from("users")
		.select("employee_id")
		.eq("id", auth.userId)
		.single();

	if (!userRow || !ADMINS.includes(userRow.employee_id)) return null;
	return auth;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const supabase = createServiceClient();
	if (!(await requireAdmin(req, supabase)))
		return NextResponse.json({ error: "forbidden" }, { status: 403 });

	const { id } = await params;
	const body = await req.json();
	const { data, error } = await supabase
		.from("fims_faq_entries")
		.update({
			app_id: body.app_id,
			title: body.title,
			type: body.type,
			sections: body.sections,
			sort_order: body.sort_order ?? 0,
		})
		.eq("id", id)
		.select()
		.single();

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ entry: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const supabase = createServiceClient();
	if (!(await requireAdmin(req, supabase)))
		return NextResponse.json({ error: "forbidden" }, { status: 403 });

	const { id } = await params;
	const { error } = await supabase.from("fims_faq_entries").delete().eq("id", id);
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ ok: true });
}