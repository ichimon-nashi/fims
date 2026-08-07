// src/app/api/audit/routine/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(req.url);
	const yearsParam = searchParams.get("years"); // e.g. "2025,2026"
	const monthFrom = Number(searchParams.get("month_from") ?? 1);
	const monthTo = Number(searchParams.get("month_to") ?? 12);

	if (!yearsParam)
		return NextResponse.json({ error: "years is required" }, { status: 400 });
	const years = yearsParam.split(",").map(Number);

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("routine_audit_entries")
		.select("report_year, report_month, is_non_flight_safety, sam_code:routine_audit_sam_codes(category, area)")
		.in("report_year", years)
		.gte("report_month", monthFrom)
		.lte("report_month", monthTo);

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });

	// aggregate server-side in JS — small row count/year, no Postgres view needed
	const byCategory: Record<string, Record<number, number>> = {};
	const byArea: Record<string, Record<number, number>> = {};
	const byMonth: Record<number, Record<number, number>> = {};

	for (const row of data ?? []) {
		if (row.is_non_flight_safety) continue;
		const samCode = row.sam_code as { category?: string; area?: string } | null;
		if (samCode?.category) {
			byCategory[samCode.category] ??= {};
			byCategory[samCode.category][row.report_year] =
				(byCategory[samCode.category][row.report_year] ?? 0) + 1;
		}
		if (samCode?.area) {
			byArea[samCode.area] ??= {};
			byArea[samCode.area][row.report_year] = (byArea[samCode.area][row.report_year] ?? 0) + 1;
		}
		byMonth[row.report_year] ??= {};
		byMonth[row.report_year][row.report_month] =
			(byMonth[row.report_year][row.report_month] ?? 0) + 1;
	}

	return NextResponse.json({ byCategory, byArea, byMonth });
}