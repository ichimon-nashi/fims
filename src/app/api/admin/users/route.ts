// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

// Special employee IDs that should always be included
const SPECIAL_EMPLOYEE_IDS = [
	"22119", //徐永成
	"39462", //郭曉穎
	"60549", //陳心柔
	"admin",
];

export async function GET(request: NextRequest) {
	try {
		// Extract and verify JWT token
		const token = extractTokenFromHeader(
			request.headers.get("authorization"),
		);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 },
			);
		}

		let decoded;
		try {
			decoded = verifyToken(token);
		} catch (tokenError: unknown) {
			console.error("Token verification failed:", tokenError);
			return NextResponse.json(
				{ message: "Invalid token" },
				{ status: 401 },
			);
		}

		const supabase = await createClient();

		// Get current user's employee_id from database using the user_id from JWT
		const { data: currentUser, error: userError } = await supabase
			.from("users")
			.select("employee_id")
			.eq("id", decoded.userId)
			.single();

		if (userError || !currentUser) {
			console.error("Error fetching current user:", userError);
			return NextResponse.json(
				{ message: "User not found" },
				{ status: 404 },
			);
		}

		// Check if user is admin or 51892
		if (
			currentUser.employee_id !== "admin" &&
			currentUser.employee_id !== "51892"
		) {
			console.log(
				"Access denied for employee_id:",
				currentUser.employee_id,
			);
			return NextResponse.json(
				{ message: "Insufficient permissions to access this resource" },
				{ status: 403 },
			);
		}

		// Fetch users with FI, SC, MG ranks OR special employee IDs
		const { data: users, error: fetchError } = await supabase
			.from("users")
			.select(
				`
        id,
        employee_id,
        full_name,
        rank,
        base,
        authentication_level,
        app_permissions,
        gender
      `,
			)
			.or(
				`rank.in.("FI","FI - Flight Attendant Instructor","SC","SC - Section Chief","MG","MG - Manager"),employee_id.in.(${SPECIAL_EMPLOYEE_IDS.map((id) => `"${id}"`).join(",")})`,
			)
			.order("employee_id", { ascending: true });

		if (fetchError) {
			console.error("Error fetching users:", fetchError);
			return NextResponse.json(
				{ message: "Failed to fetch users", error: fetchError.message },
				{ status: 500 },
			);
		}

		return NextResponse.json(users || []);
	} catch (error: unknown) {
		console.error("Error in admin users endpoint:", error);
		return NextResponse.json(
			{
				message: "Internal server error",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 },
		);
	}
}
