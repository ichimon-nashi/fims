// src/app/api/sms/crew-reports/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { getCrewReports } from "@/lib/smsDatabase";

export async function GET(request: NextRequest) {
	try {
		// Check SMS permissions - need VIEW access
		const permissions = await checkSMSPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canView) {
			return NextResponse.json(
				{ error: permissions.error },
				{ status: permissions.status || 403 }
			);
		}

		// Get query parameters
		const searchParams = request.nextUrl.searchParams;
		const year = searchParams.get("year");
		const month = searchParams.get("month");
		const categoryId = searchParams.get("category_id");
		const search = searchParams.get("search");

		const filters: any = {};
		if (year) filters.year = parseInt(year);
		if (month) filters.month = parseInt(month);
		if (categoryId) filters.category_id = categoryId;
		if (search) filters.search = search;

		const reports = await getCrewReports(filters);

		return NextResponse.json(reports);
	} catch (error: any) {
		console.error("Error in GET /api/sms/crew-reports:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		// Check SMS permissions - need EDIT access
		const permissions = await checkSMSPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canEdit) {
			return NextResponse.json(
				{ error: "Access denied: Edit permission required" },
				{ status: 403 }
			);
		}

		const body = await request.json();

		// Validate required fields. report_code is intentionally NOT required —
		// legacy "其他來源" reports have no code, even though new entries always
		// get one now. category_ids is also NOT required — EF分類 is optional.
		// hazard_type (OF分類) is also NOT required — not every report has an
		// AQD-sourced hazard type.
		if (!body.report_year || !body.report_month || !body.title || !body.description) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const { createCrewReport } = await import("@/lib/smsDatabase");

		const report = await createCrewReport({
			report_code: body.report_code || null,
			report_year: body.report_year,
			report_month: body.report_month,
			title: body.title,
			description: body.description,
			hazard_type: body.hazard_type || null,
			action_taken: body.action_taken || null,
			category_ids: Array.isArray(body.category_ids) ? body.category_ids : [],
			occurrence_date: body.occurrence_date || null,
			registered_date: body.registered_date || null,
			aircraft: body.aircraft || null,
			flight_no: body.flight_no || null,
			departure: body.departure || null,
			arrival: body.arrival || null,
			location: body.location || null,
			potential_consequence: body.potential_consequence || null,
			reporter_name: body.reporter_name || null,
			operational_category: body.operational_category || null,
			assessment_code: body.assessment_code || null,
			risk_assessment_calculation: body.risk_assessment_calculation || null,
			risk_assessment: body.risk_assessment || null,
			closed_status: body.closed_status || null,
			created_by: permissions.userId!,
		});

		return NextResponse.json(report, { status: 201 });
	} catch (error: any) {
		console.error("Error in POST /api/sms/crew-reports:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}