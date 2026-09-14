// src/app/api/faq/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

const ADMINS = ["admin", "51892"]; // same gate as 使用者管理

/** Extracts + verifies the Bearer token, returning the decoded payload or null. */
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

/**
 * GET /api/faq            → all entries (client filters by permission)
 * GET /api/faq?app=sms    → entries for one app
 *
 * Returns ALL entries the app knows about. Permission filtering happens
 * client-side against usePermissions(), exactly like the quick-actions
 * grid — help content for an app the user can't open is simply never
 * rendered because that app isn't in their tile list.
 */
export async function GET(req: NextRequest) {
	const auth = getAuth(req);
	if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

	const appId = req.nextUrl.searchParams.get("app");
	const supabase = createServiceClient();

	let query = supabase
		.from("fims_faq_entries")
		.select("id, app_id, title, type, sections, sort_order, updated_at")
		.order("updated_at", { ascending: false });

	if (appId) query = query.eq("app_id", appId);

	const { data, error } = await query;
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });

	return NextResponse.json({ entries: data ?? [] });
}

/**
 * POST /api/faq → create a new entry. Admin-only, same gate as PUT/DELETE
 * on /api/faq/[id]. Not part of the original drop-in package — there was
 * no way to create an entry at all until this was added.
 */
export async function POST(req: NextRequest) {
	const supabase = createServiceClient();
	if (!(await requireAdmin(req, supabase)))
		return NextResponse.json({ error: "forbidden" }, { status: 403 });

	const body = await req.json();

	if (!body.app_id?.trim()) return NextResponse.json({ error: "缺少 app_id" }, { status: 400 });
	if (!body.title?.trim()) return NextResponse.json({ error: "缺少標題" }, { status: 400 });
	if (body.type !== "說明" && body.type !== "更新")
		return NextResponse.json({ error: "type 必須是 說明 或 更新" }, { status: 400 });

	const { data, error } = await supabase
		.from("fims_faq_entries")
		.insert({
			app_id: body.app_id.trim(),
			title: body.title.trim(),
			type: body.type,
			sections: body.sections ?? [],
			sort_order: body.sort_order ?? 0,
		})
		.select()
		.single();

	if (error) {
		console.error("POST /api/faq insert error:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	return NextResponse.json({ entry: data }, { status: 201 });
}
