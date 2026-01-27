// src/app/api/admin/users/[id]/permissions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken } from "@/lib/auth";

export async function PATCH(
	request: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	try {
		// Await params in Next.js 15+
		const { id } = await context.params;

		console.log("[Permissions API] Starting PATCH request for user:", id);

		const supabase = await createClient();

		// Get the authorization header
		const authHeader = request.headers.get("authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			console.log("[Permissions API] No valid auth header");
			return NextResponse.json({ message: "未授權" }, { status: 401 });
		}

		const token = authHeader.replace("Bearer ", "");

		// Verify the JWT token
		let decoded;
		try {
			decoded = verifyToken(token);
			console.log(
				"[Permissions API] Token verified for user:",
				decoded.userId,
			);
		} catch (error) {
			console.error(
				"[Permissions API] Token verification failed:",
				error,
			);
			return NextResponse.json(
				{ message: "無效的認證 token" },
				{ status: 401 },
			);
		}

		// Get the authenticated user's data from users table
		const { data: authUserData, error: authUserError } = await supabase
			.from("users")
			.select("rank, employee_id")
			.eq("id", decoded.userId)
			.single();

		if (authUserError || !authUserData) {
			console.error(
				"[Permissions API] Auth user not found:",
				authUserError,
			);
			return NextResponse.json(
				{ message: "找不到使用者資料" },
				{ status: 404 },
			);
		}

		console.log(
			"[Permissions API] Auth user:",
			authUserData.employee_id,
			"Rank:",
			authUserData.rank,
		);

		// Check if user is admin or employee_id 51892
		const isAdmin =
			authUserData.rank === "admin" ||
			authUserData.employee_id === "admin";
		const is51892 = authUserData.employee_id === "51892";

		if (!isAdmin && !is51892) {
			console.log("[Permissions API] Insufficient permissions");
			return NextResponse.json(
				{ message: "權限不足：僅限管理員" },
				{ status: 403 },
			);
		}

		// Get the request body
		const body = await request.json();
		console.log(
			"[Permissions API] Request body:",
			JSON.stringify(body, null, 2),
		);

		const { authentication_level, app_permissions } = body;

		// Validate input
		if (authentication_level === undefined || !app_permissions) {
			console.error("[Permissions API] Missing required parameters");
			return NextResponse.json(
				{ message: "缺少必要參數" },
				{ status: 400 },
			);
		}

		console.log("[Permissions API] Updating user:", id);
		console.log("[Permissions API] New auth level:", authentication_level);
		console.log(
			"[Permissions API] New permissions:",
			JSON.stringify(app_permissions, null, 2),
		);

		// Update user permissions - using the awaited id variable
		const { data, error } = await supabase
			.from("users")
			.update({
				authentication_level,
				app_permissions,
				updated_at: new Date().toISOString(),
			})
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("[Permissions API] Database error:", error);
			return NextResponse.json(
				{ message: "更新權限失敗", error: error.message },
				{ status: 500 },
			);
		}

		console.log("[Permissions API] Update successful");
		return NextResponse.json({
			message: "權限更新成功",
			user: data,
		});
	} catch (error: any) {
		console.error("[Permissions API] Unexpected error:", error);
		return NextResponse.json(
			{ message: "伺服器錯誤", error: error.message },
			{ status: 500 },
		);
	}
}
