// src/app/api/sms/available-years/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getUserById } from "@/lib/database";
import { createServiceClient } from "@/utils/supabase/service-client";

const ADMIN_ACCOUNTS = ["admin", "21986", "51892"];

async function checkAdminAccess(authHeader: string | null) {
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return { isAdmin: false, error: "Unauthorized", status: 401 };
	}

	const token = authHeader.substring(7);
	const decoded = verifyToken(token);

	// Get user from database to check employee_id
	const user = await getUserById(decoded.userId);

	if (!user) {
		return { isAdmin: false, error: "User not found", status: 404 };
	}

	// Check if user is admin using employee_id
	const isAdmin =
		ADMIN_ACCOUNTS.includes(user.employee_id) ||
		ADMIN_ACCOUNTS.includes(user.email);

	if (!isAdmin) {
		return { isAdmin: false, error: "Access denied", status: 403 };
	}

	return { isAdmin: true };
}

export async function GET(request: NextRequest) {
	try {
		// Verify authentication and admin status
		const authCheck = await checkAdminAccess(
			request.headers.get("authorization")
		);

		if (!authCheck.isAdmin) {
			return NextResponse.json(
				{ error: authCheck.error },
				{ status: authCheck.status }
			);
		}

		const supabase = createServiceClient();

		// Get distinct years from both tables
		const [rrResult, srmResult] = await Promise.all([
			supabase
				.from("rr_sms_entries")
				.select("last_review")
				.not("last_review", "is", null),
			supabase
				.from("srm_table_entries")
				.select("year")
				.not("year", "is", null),
		]);

		const years = new Set<number>();

		// Extract years from RR entries' last_review dates
		if (rrResult.data) {
			rrResult.data.forEach((entry) => {
				const year = new Date(entry.last_review).getFullYear();
				if (!isNaN(year)) {
					years.add(year);
				}
			});
		}

		// Extract years from SRM entries
		if (srmResult.data) {
			srmResult.data.forEach((entry) => {
				years.add(entry.year);
			});
		}

		return NextResponse.json({
			years: Array.from(years).sort((a, b) => b - a),
		});
	} catch (error: any) {
		console.error("Error in GET /api/sms/available-years:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
