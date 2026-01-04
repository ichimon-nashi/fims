// src/app/api/sms/srm-entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getUserById } from "@/lib/database";
import { getSRMTableEntries } from "@/lib/smsDatabase";

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

	return { isAdmin: true, userId: decoded.userId };
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

		// Get query parameters
		const searchParams = request.nextUrl.searchParams;
		const year = searchParams.get("year");
		const search = searchParams.get("search");

		const filters: any = {};
		if (year) {
			filters.year = parseInt(year);
		}
		if (search) {
			filters.search = search;
		}

		const entries = await getSRMTableEntries(filters);

		return NextResponse.json(entries);
	} catch (error: any) {
		console.error("Error in GET /api/sms/srm-entries:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
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

		const body = await request.json();

		// Validate required fields
		if (
			!body.number ||
			!body.file_date ||
			!body.identification_source_type ||
			!body.hazard_description
		) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const { createSRMTableEntry } = await import("@/lib/smsDatabase");

		const entry = await createSRMTableEntry({
			file_date: body.file_date,
			number: body.number,
			identification_source_type: body.identification_source_type,
			identification_source_detail: body.identification_source_detail,
			occurrence_month: body.occurrence_month,
			hazard_description: body.hazard_description,
			possible_cause: body.possible_cause,
			hazard_impact: body.hazard_impact,
			existing_measures: body.existing_measures,
			current_risk_assessment: body.current_risk_assessment,
			risk_mitigation_measures: body.risk_mitigation_measures,
			post_mitigation_assessment: body.post_mitigation_assessment,
			human_factors_codes: body.human_factors_codes,
			ef_attribute_codes: body.ef_attribute_codes,
			created_by: authCheck.userId!,
		});

		return NextResponse.json(entry, { status: 201 });
	} catch (error: any) {
		console.error("Error in POST /api/sms/srm-entries:", error);

		if (error.message.includes("already exists")) {
			return NextResponse.json({ error: error.message }, { status: 409 });
		}

		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}
