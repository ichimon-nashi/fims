// src/app/api/sms/srm-entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { getSRMTableEntries } from "@/lib/smsDatabase";

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
			created_by: permissions.userId!,
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