// src/app/api/sms/crew-report-categories/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { updateCrewReportCategory } from "@/lib/smsDatabase";

// Handles rename, recolor, soft-delete (active: false), and restore (active: true).
// There is deliberately no DELETE handler — categories are never hard-deleted,
// so a report that already used a category keeps showing its real name/color
// even after that category is "deleted" (soft-deleted) from the management modal.
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
		if (body.name !== undefined) updates.name = body.name;
		if (body.color_hex !== undefined) updates.color_hex = body.color_hex;
		if (body.active !== undefined) updates.active = body.active;

		const category = await updateCrewReportCategory(id, updates);

		return NextResponse.json(category);
	} catch (error: any) {
		console.error(
			"Error in PUT /api/sms/crew-report-categories/[id]:",
			error,
		);

		if (error.message.includes("already exists")) {
			return NextResponse.json({ error: error.message }, { status: 409 });
		}

		return NextResponse.json(
			{ error: error.message || "Internal server error" },
			{ status: 500 },
		);
	}
}
