// src/app/api/sms/crew-reports/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { updateCrewReport, deleteCrewReport } from "@/lib/smsDatabase";

export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		// Check SMS permissions - need EDIT access
		const permissions = await checkSMSPermissions(
			request.headers.get("authorization"),
		);

		if (!permissions.canEdit) {
			return NextResponse.json(
				{ error: "Access denied: Edit permission required" },
				{ status: 403 },
			);
		}

		const { id } = await params;
		const body = await request.json();

		const updates: any = {};
		if (body.report_code !== undefined)
			updates.report_code = body.report_code || null;
		if (body.report_year !== undefined)
			updates.report_year = body.report_year;
		if (body.report_month !== undefined)
			updates.report_month = body.report_month;
		if (body.title !== undefined)
			updates.title = body.title;
		if (body.description !== undefined)
			updates.description = body.description;
		if (body.hazard_type !== undefined)
			updates.hazard_type = body.hazard_type || null;
		if (body.action_taken !== undefined)
			updates.action_taken = body.action_taken || null;
		if (body.category_ids !== undefined)
			updates.category_ids = body.category_ids;
		if (body.occurrence_date !== undefined)
			updates.occurrence_date = body.occurrence_date || null;
		if (body.registered_date !== undefined)
			updates.registered_date = body.registered_date || null;
		if (body.aircraft !== undefined)
			updates.aircraft = body.aircraft || null;
		if (body.flight_no !== undefined)
			updates.flight_no = body.flight_no || null;
		if (body.departure !== undefined)
			updates.departure = body.departure || null;
		if (body.arrival !== undefined)
			updates.arrival = body.arrival || null;
		if (body.location !== undefined)
			updates.location = body.location || null;
		if (body.potential_consequence !== undefined)
			updates.potential_consequence = body.potential_consequence || null;
		if (body.reporter_name !== undefined)
			updates.reporter_name = body.reporter_name || null;
		if (body.operational_category !== undefined)
			updates.operational_category = body.operational_category || null;
		if (body.assessment_code !== undefined)
			updates.assessment_code = body.assessment_code || null;
		if (body.risk_assessment_calculation !== undefined)
			updates.risk_assessment_calculation = body.risk_assessment_calculation || null;
		if (body.risk_assessment !== undefined)
			updates.risk_assessment = body.risk_assessment || null;
		if (body.closed_status !== undefined)
			updates.closed_status = body.closed_status || null;

		const report = await updateCrewReport(id, updates);

		return NextResponse.json(report);
	} catch (error: any) {
		console.error("Error in PUT /api/sms/crew-reports/[id]:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 },
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		// Check SMS permissions - need EDIT access
		const permissions = await checkSMSPermissions(
			request.headers.get("authorization"),
		);

		if (!permissions.canEdit) {
			return NextResponse.json(
				{ error: "Access denied: Edit permission required" },
				{ status: 403 },
			);
		}

		const { id } = await params;

		await deleteCrewReport(id);

		return NextResponse.json({ message: "Entry deleted successfully" });
	} catch (error: any) {
		console.error("Error in DELETE /api/sms/crew-reports/[id]:", error);
		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 },
		);
	}
}