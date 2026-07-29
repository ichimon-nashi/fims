// src/app/api/sms/crew-report-categories/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { getCrewReportCategories } from "@/lib/smsDatabase";

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

		const searchParams = request.nextUrl.searchParams;
		const includeInactive = searchParams.get("includeInactive") !== "false";

		const categories = await getCrewReportCategories(includeInactive);

		return NextResponse.json(categories);
	} catch (error: any) {
		console.error("Error in GET /api/sms/crew-report-categories:", error);
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
		if (!body.name || !body.color_hex) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const { createCrewReportCategory } = await import("@/lib/smsDatabase");

		const category = await createCrewReportCategory({
			name: body.name,
			color_hex: body.color_hex,
			created_by: permissions.userId!,
		});

		return NextResponse.json(category, { status: 201 });
	} catch (error: any) {
		console.error("Error in POST /api/sms/crew-report-categories:", error);

		if (error.message.includes("already exists")) {
			return NextResponse.json({ error: error.message }, { status: 409 });
		}

		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 }
		);
	}
}