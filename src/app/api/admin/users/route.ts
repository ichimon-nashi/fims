// src/app/api/admin/users/route.ts
// DROP-IN REPLACEMENT — adds POST (create user) to the existing GET handler.
// GET: fetches users with ranks FI / SC / MG / OTHER plus hardcoded special IDs.
// Users added via the add-user form with those ranks will appear on next fetch.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";

const SPECIAL_EMPLOYEE_IDS = [
	"22119",
	"39462",
	"60549",
	"admin",
];

// ── Auth guard (shared) ───────────────────────────────────────────────────────
async function assertAdmin(request: NextRequest, supabase: any) {
	const token = extractTokenFromHeader(request.headers.get("authorization"));
	if (!token) return { error: NextResponse.json({ message: "No token provided" }, { status: 401 }) };

	let decoded: any;
	try {
		decoded = verifyToken(token);
	} catch {
		return { error: NextResponse.json({ message: "Invalid token" }, { status: 401 }) };
	}

	const { data: currentUser, error: userError } = await supabase
		.from("users")
		.select("employee_id")
		.eq("id", decoded.userId)
		.single();

	if (userError || !currentUser) {
		return { error: NextResponse.json({ message: "User not found" }, { status: 404 }) };
	}

	if (currentUser.employee_id !== "admin" && currentUser.employee_id !== "51892") {
		return { error: NextResponse.json({ message: "Insufficient permissions" }, { status: 403 }) };
	}

	return { decoded, currentUser };
}

// ── GET — fetch manageable users ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
	try {
		const supabase = await createClient();
		const auth = await assertAdmin(request, supabase);
		if (auth.error) return auth.error;

		// Fetch users with FI / SC / MG / OTHER ranks, OR special employee IDs.
		// "OTHER" catches any manually-created custom rank via the add-user form.
		const specialIdList = SPECIAL_EMPLOYEE_IDS.map((id) => `"${id}"`).join(",");
		const { data: users, error: fetchError } = await supabase
			.from("users")
			.select("id, employee_id, full_name, rank, base, authentication_level, app_permissions, gender")
			.or(
				`rank.in.("FI","FI - Flight Attendant Instructor","SC","SC - Section Chief","MG","MG - Manager","OTHER"),employee_id.in.(${specialIdList})`,
			)
			.order("employee_id", { ascending: true });

		if (fetchError) {
			return NextResponse.json({ message: "Failed to fetch users", error: fetchError.message }, { status: 500 });
		}

		return NextResponse.json(users || []);
	} catch (error: unknown) {
		return NextResponse.json(
			{ message: "Internal server error", error: error instanceof Error ? error.message : String(error) },
			{ status: 500 },
		);
	}
}

// ── POST — create a new user ──────────────────────────────────────────────────
export async function POST(request: NextRequest) {
	try {
		const supabase = await createClient();
		const auth = await assertAdmin(request, supabase);
		if (auth.error) return auth.error;

		const body = await request.json();
		const { employee_id, full_name, rank, base, password, gender, avatar_gif, app_permissions } = body;

		// Validate required fields
		if (!employee_id?.trim()) return NextResponse.json({ message: "缺少員工編號" }, { status: 400 });
		if (!full_name?.trim())   return NextResponse.json({ message: "缺少姓名" }, { status: 400 });
		if (!rank?.trim())        return NextResponse.json({ message: "缺少職稱" }, { status: 400 });
		if (!base?.trim())        return NextResponse.json({ message: "缺少基地" }, { status: 400 });
		if (!password || password.length < 6) return NextResponse.json({ message: "密碼至少 6 個字元" }, { status: 400 });

		// Check for duplicate employee_id
		const { data: existing } = await supabase
			.from("users")
			.select("id")
			.eq("employee_id", employee_id.trim())
			.maybeSingle();

		if (existing) {
			return NextResponse.json({ message: `員工編號 ${employee_id} 已存在` }, { status: 409 });
		}

		const password_hash = await hashPassword(password);

		const insertPayload: any = {
			employee_id:          employee_id.trim(),
			full_name:            full_name.trim(),
			rank:                 rank.trim(),
			base:                 base.trim(),
			// email is NOT NULL — derive a placeholder from employee_id
			email:                `${employee_id.trim()}@fims.internal`,
			password_hash,
			authentication_level: 1,
			app_permissions:      app_permissions ?? null,
			created_at:           new Date().toISOString(),
			updated_at:           new Date().toISOString(),
		};

		if (gender) insertPayload.gender = gender;
		// avatar_gif is not a DB column — omit from insert

		const { data: newUser, error: insertError } = await supabase
			.from("users")
			.insert(insertPayload)
			.select("id, employee_id, full_name, rank, base, authentication_level, app_permissions, gender")
			.single();

		if (insertError) {
			console.error("Insert error:", insertError);
			return NextResponse.json({ message: "新增使用者失敗", error: insertError.message }, { status: 500 });
		}

		return NextResponse.json({ message: "使用者已新增", user: newUser }, { status: 201 });
	} catch (error: unknown) {
		return NextResponse.json(
			{ message: "Internal server error", error: error instanceof Error ? error.message : String(error) },
			{ status: 500 },
		);
	}
}