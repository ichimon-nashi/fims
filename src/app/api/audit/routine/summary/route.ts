// src/app/api/audit/routine/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { SAM_CODE_MAP, EF_CODE_MAP } from "@/lib/routineAudit.constants";

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
		.select("report_year, report_month, is_non_flight_safety, sam_code, ef_code")
		.in("report_year", years)
		.gte("report_month", monthFrom)
		.lte("report_month", monthTo);

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });

	// aggregate server-side in JS — small row count/year, no Postgres view needed
	const byCode: Record<string, Record<number, number>> = {};
	const byCategory: Record<string, Record<number, number>> = {};
	const byEfCode: Record<string, Record<number, number>> = {};
	const byEfMiddle: Record<string, Record<number, number>> = {};
	const byMonth: Record<number, Record<number, number>> = {};

	for (const row of data ?? []) {
		if (row.is_non_flight_safety) continue;

		const resolved = row.sam_code ? SAM_CODE_MAP[row.sam_code] : undefined;
		if (resolved) {
			byCode[resolved.code] ??= {};
			byCode[resolved.code][row.report_year] = (byCode[resolved.code][row.report_year] ?? 0) + 1;

			byCategory[resolved.category] ??= {};
			byCategory[resolved.category][row.report_year] =
				(byCategory[resolved.category][row.report_year] ?? 0) + 1;
		}

		if (row.ef_code) {
			byEfCode[row.ef_code] ??= {};
			byEfCode[row.ef_code][row.report_year] = (byEfCode[row.ef_code][row.report_year] ?? 0) + 1;

			const efResolved = EF_CODE_MAP[row.ef_code];
			if (efResolved) {
				byEfMiddle[efResolved.attributeName] ??= {};
				byEfMiddle[efResolved.attributeName][row.report_year] =
					(byEfMiddle[efResolved.attributeName][row.report_year] ?? 0) + 1;
			}
		}

		byMonth[row.report_year] ??= {};
		byMonth[row.report_year][row.report_month] =
			(byMonth[row.report_year][row.report_month] ?? 0) + 1;
	}

	return NextResponse.json({ byCode, byCategory, byEfCode, byEfMiddle, byMonth });
}