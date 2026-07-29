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
		if (body.description !== undefined)
			updates.description = body.description;
		if (body.action_taken !== undefined)
			updates.action_taken = body.action_taken || null;
		if (body.category_ids !== undefined)
			updates.category_ids = body.category_ids;

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
