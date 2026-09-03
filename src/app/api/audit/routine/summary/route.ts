// src/app/api/audit/routine/summary/route.ts
//
// Single-period aggregation — accepts one (year, month_from, month_to)
// per call, matching the exact pattern /api/sms/trend-analysis already
// uses (see StatisticsTab.tsx's loadCompareData: it calls that single-
// period endpoint twice, once per compared period, rather than a combined
// multi-range request). This route previously accepted a `years` list
// with one month range shared across all of them — that was the actual
// bug behind "comparison can't use different month windows per side."
// The caller (RoutineSummary.tsx) is responsible for calling this twice
// and combining the two results when in comparison mode.
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
	const year = Number(searchParams.get("year"));
	const monthFrom = Number(searchParams.get("month_from") ?? 1);
	const monthTo = Number(searchParams.get("month_to") ?? 12);

	if (!year)
		return NextResponse.json({ error: "year is required" }, { status: 400 });

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("routine_audit_entries")
		.select("report_month, is_non_flight_safety, sam_code, ef_code")
		.eq("report_year", year)
		.gte("report_month", monthFrom)
		.lte("report_month", monthTo);

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });

	// single-period aggregation — flat Record<label, count>, not the old
	// nested Record<label, Record<year, count>>, since a single call is
	// now always exactly one period. Comparison mode combines two of
	// these responses on the client, one per side.
	const byCode: Record<string, number> = {};
	const byCategory: Record<string, number> = {}; // SAM category, e.g. "Resource Management" — single-period pie
	const byArea: Record<string, number> = {}; // SAM area / HFACS top tier, e.g. "組織影響" — comparison view only
	const byEfCode: Record<string, number> = {};
	const byEfMiddle: Record<string, number> = {}; // EF top-level attribute category, e.g. "個人 (Individual)"
	const byMonth: Record<number, number> = {};

	for (const row of data ?? []) {
		if (row.is_non_flight_safety) continue;

		const resolved = row.sam_code ? SAM_CODE_MAP[row.sam_code] : undefined;
		if (resolved) {
			byCode[resolved.code] = (byCode[resolved.code] ?? 0) + 1;
			byCategory[resolved.category] = (byCategory[resolved.category] ?? 0) + 1;
			byArea[resolved.area] = (byArea[resolved.area] ?? 0) + 1;
		}

		if (row.ef_code) {
			byEfCode[row.ef_code] = (byEfCode[row.ef_code] ?? 0) + 1;
			const efResolved = EF_CODE_MAP[row.ef_code];
			if (efResolved) {
				// top-tier grouping (e.g. "個人 (Individual)"), not the middle
				// tier (e.g. "客艙組員行為") — matches the same change made in
				// the export route so the in-app chart and the exported Excel
				// agree on what "EF類別" means
				byEfMiddle[efResolved.categoryName] = (byEfMiddle[efResolved.categoryName] ?? 0) + 1;
			}
		}

		byMonth[row.report_month] = (byMonth[row.report_month] ?? 0) + 1;
	}

	return NextResponse.json({ year, monthFrom, monthTo, byCode, byCategory, byArea, byEfCode, byEfMiddle, byMonth });
}