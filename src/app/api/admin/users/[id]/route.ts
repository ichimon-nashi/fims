// src/app/api/admin/users/[id]/route.ts
// NEW FILE — handles DELETE for a single user.
// Place this at the [id] segment alongside the existing permissions/route.ts.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

export async function DELETE(
	request: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await context.params;
		const supabase = await createClient();

		// Auth check
		const token = extractTokenFromHeader(request.headers.get("authorization"));
		if (!token) return NextResponse.json({ message: "未授權" }, { status: 401 });

		let decoded: any;
		try { decoded = verifyToken(token); }
		catch { return NextResponse.json({ message: "無效的認證 token" }, { status: 401 }); }

		const { data: authUser, error: authErr } = await supabase
			.from("users")
			.select("employee_id")
			.eq("id", decoded.userId)
			.single();

		if (authErr || !authUser) return NextResponse.json({ message: "找不到使用者" }, { status: 404 });

		if (authUser.employee_id !== "admin" && authUser.employee_id !== "51892") {
			return NextResponse.json({ message: "權限不足：僅限管理員" }, { status: 403 });
		}

		// Safety: don't allow deleting the admin account itself
		const { data: targetUser } = await supabase
			.from("users")
			.select("employee_id")
			.eq("id", id)
			.single();

		if (targetUser?.employee_id === "admin" || targetUser?.employee_id === "51892") {
			return NextResponse.json({ message: "無法刪除管理員帳號" }, { status: 403 });
		}

		const { error: deleteError } = await supabase
			.from("users")
			.delete()
			.eq("id", id);

		if (deleteError) {
			return NextResponse.json({ message: "刪除失敗", error: deleteError.message }, { status: 500 });
		}

		return NextResponse.json({ message: "使用者已刪除" });
	} catch (error: unknown) {
		return NextResponse.json(
			{ message: "伺服器錯誤", error: error instanceof Error ? error.message : String(error) },
			{ status: 500 },
		);
	}
}