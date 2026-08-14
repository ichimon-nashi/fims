// src/app/api/sms/trend-analysis/route.ts
//
// 趨勢分析 (Risk Analysis) tab data source. Combines two separate tables
// that were never designed to be queried together:
//   - srm_table_entries (SMS module): human_factors_codes[], ef_attribute_codes[]
//   - routine_audit_entries (Routine Audit module): sam_code, ef_code
//
// HFACS/human-factors codes differ in zero-padding between the two
// modules (SAM writes "RM01", SMS writes "RM1") — normalized via
// src/lib/hfacsCodeMap.ts. EF codes need no normalization; both modules
// already share the same EF_ATTRIBUTE_CATEGORIES constant.
//
// Source labeling: every srm_table_entries row counts as "SRM" (both its
// own SA/SRM sub-tags collapse into one bucket here), every
// routine_audit_entries row counts as "自督" — per [user]'s explicit
// naming decision. Rows with is_non_flight_safety=true are excluded from
// the routine side, matching every other aggregation route in this module.
//
// No caching (see design discussion) — this mirrors
// routine_summary_route.ts's own reasoning: small per-year row counts,
// plain per-request aggregation, no invalidation path to get wrong.
//
// Granularity (month/quarter/half-year/year) is entirely client-side —
// this route always returns month-level buckets, the finest grain the
// source data has, and the client sums adjacent months.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { SAM_CODE_MAP, EF_CODE_MAP } from "@/lib/routineAudit.constants";
import { CANONICAL_HFACS_MAP, normalizeHfacsCode } from "@/lib/hfacsCodeMap";

type Source = "srm" | "self"; // self = 自督

interface CodeBucket {
	code: string;
	description: string;
	category: string;
	srm: number;
	self: number;
	total: number;
	inSam: boolean;
	inSms: boolean;
}

interface CategoryBucket {
	category: string;
	srm: number;
	self: number;
	total: number;
}

interface AreaBucket {
	area: string;
	srm: number;
	self: number;
	total: number;
}

// month -> { srm, self }
type MonthSplit = Record<string, { srm: number; self: number }>;

function monthKey(year: number, month: number): string {
	return `${year}-${String(month).padStart(2, "0")}`;
}

function efCategoryName(code: string): string {
	// EF codes are "P1-01" — the letter before the first digit is the
	// top-level category, same derivation StatisticsTab.tsx already uses.
	const prefix = code.charAt(0);
	const found = EF_CODE_MAP[code];
	return found?.categoryName ?? prefix;
}

export async function GET(req: NextRequest) {
	const permissions = await checkSMSPermissions(req.headers.get("authorization"));
	if (!permissions.canView) {
		return NextResponse.json(
			{ error: permissions.error || "Access denied: No SMS permissions" },
			{ status: permissions.status || 403 }
		);
	}

	const { searchParams } = new URL(req.url);
	const yearsParam = searchParams.get("years");
	const monthFrom = Number(searchParams.get("month_from") ?? 1);
	const monthTo = Number(searchParams.get("month_to") ?? 12);
	const type = (searchParams.get("type") as "hfacs" | "ef") || "hfacs";

	if (!yearsParam) {
		return NextResponse.json({ error: "years is required" }, { status: 400 });
	}
	const years = yearsParam.split(",").map(Number);

	const supabase = createServiceClient();

	// ---- fetch both sources in parallel ----
	const [srmResult, routineResult] = await Promise.all([
		supabase
			.from("srm_table_entries")
			.select("human_factors_codes, ef_attribute_codes, occurrence_month, year")
			.in("year", years),
		supabase
			.from("routine_audit_entries")
			.select("sam_code, ef_code, report_year, report_month, is_non_flight_safety")
			.in("report_year", years)
			.gte("report_month", monthFrom)
			.lte("report_month", monthTo),
	]);

	if (srmResult.error) {
		return NextResponse.json({ error: srmResult.error.message }, { status: 500 });
	}
	if (routineResult.error) {
		return NextResponse.json({ error: routineResult.error.message }, { status: 500 });
	}

	const srmRows = srmResult.data ?? [];
	const routineRows = routineResult.data ?? [];

	// month_from/month_to filtering for SRM happens here in JS, not via a
	// Supabase range filter on occurrence_month — this codebase has
	// already documented that pattern as unreliable on nullable date
	// columns (see src/lib/xlsxNativeCharts.ts sibling learnings / project
	// notes). The reliable "year" column above already narrows the fetch;
	// this just tightens to the requested month window.
	const srmRowsInRange = srmRows.filter((r) => {
		if (!r.occurrence_month) return false;
		const month = parseInt(String(r.occurrence_month).split("-")[1], 10);
		return month >= monthFrom && month <= monthTo;
	});

	// ---- accumulate ----
	const codeBuckets = new Map<string, CodeBucket>();
	const categoryBuckets = new Map<string, CategoryBucket>();
	const areaBuckets = new Map<string, AreaBucket>();
	const codeMonthSplit = new Map<string, MonthSplit>();
	const categoryMonthSplit = new Map<string, MonthSplit>();
	const areaMonthSplit = new Map<string, MonthSplit>();

	function record(code: string, category: string, description: string, source: Source, mKey: string, extra?: Partial<CodeBucket> & { area?: string }) {
		if (!codeBuckets.has(code)) {
			codeBuckets.set(code, {
				code,
				description,
				category,
				srm: 0,
				self: 0,
				total: 0,
				inSam: extra?.inSam ?? false,
				inSms: extra?.inSms ?? false,
			});
		}
		const cb = codeBuckets.get(code)!;
		cb[source === "srm" ? "srm" : "self"] += 1;
		cb.total += 1;

		if (!categoryBuckets.has(category)) {
			categoryBuckets.set(category, { category, srm: 0, self: 0, total: 0 });
		}
		const catB = categoryBuckets.get(category)!;
		catB[source === "srm" ? "srm" : "self"] += 1;
		catB.total += 1;

		if (!codeMonthSplit.has(code)) codeMonthSplit.set(code, {});
		const cms = codeMonthSplit.get(code)!;
		cms[mKey] ??= { srm: 0, self: 0 };
		cms[mKey][source === "srm" ? "srm" : "self"] += 1;

		if (!categoryMonthSplit.has(category)) categoryMonthSplit.set(category, {});
		const cats = categoryMonthSplit.get(category)!;
		cats[mKey] ??= { srm: 0, self: 0 };
		cats[mKey][source === "srm" ? "srm" : "self"] += 1;

		if (extra?.area) {
			const area = extra.area;
			if (!areaBuckets.has(area)) {
				areaBuckets.set(area, { area, srm: 0, self: 0, total: 0 });
			}
			const ab = areaBuckets.get(area)!;
			ab[source === "srm" ? "srm" : "self"] += 1;
			ab.total += 1;

			if (!areaMonthSplit.has(area)) areaMonthSplit.set(area, {});
			const as = areaMonthSplit.get(area)!;
			as[mKey] ??= { srm: 0, self: 0 };
			as[mKey][source === "srm" ? "srm" : "self"] += 1;
		}
	}

	if (type === "hfacs") {
		srmRowsInRange.forEach((row) => {
			const year = row.year;
			const month = parseInt(String(row.occurrence_month).split("-")[1], 10);
			const mKey = monthKey(year, month);
			(row.human_factors_codes ?? []).forEach((raw: string) => {
				if (!raw) return;
				const norm = normalizeHfacsCode(raw);
				const canon = CANONICAL_HFACS_MAP[norm];
				record(norm, canon?.category ?? norm, canon?.description ?? raw, "srm", mKey, {
					inSam: canon?.inSam,
					inSms: canon?.inSms,
					area: canon?.area,
				});
			});
		});
		routineRows.forEach((row) => {
			if (row.is_non_flight_safety) return;
			if (!row.sam_code) return;
			const norm = normalizeHfacsCode(row.sam_code);
			const canon = CANONICAL_HFACS_MAP[norm];
			const mKey = monthKey(row.report_year, row.report_month);
			record(norm, canon?.category ?? norm, canon?.description ?? row.sam_code, "self", mKey, {
				inSam: canon?.inSam,
				inSms: canon?.inSms,
				area: canon?.area,
			});
		});
	} else {
		srmRowsInRange.forEach((row) => {
			const year = row.year;
			const month = parseInt(String(row.occurrence_month).split("-")[1], 10);
			const mKey = monthKey(year, month);
			(row.ef_attribute_codes ?? []).forEach((code: string) => {
				if (!code) return;
				const resolved = EF_CODE_MAP[code];
				record(code, efCategoryName(code), resolved?.description ?? code, "srm", mKey, {
					inSam: true,
					inSms: true,
				});
			});
		});
		routineRows.forEach((row) => {
			if (row.is_non_flight_safety) return;
			if (!row.ef_code) return;
			const resolved = EF_CODE_MAP[row.ef_code];
			const mKey = monthKey(row.report_year, row.report_month);
			record(row.ef_code, efCategoryName(row.ef_code), resolved?.description ?? row.ef_code, "self", mKey, {
				inSam: true,
				inSms: true,
			});
		});
	}

	const codes = Array.from(codeBuckets.values()).sort((a, b) => b.total - a.total);
	const categories = Array.from(categoryBuckets.values()).sort((a, b) => b.total - a.total);
	const areas = Array.from(areaBuckets.values()).sort((a, b) => b.total - a.total);

	const allMonths = new Set<string>();
	codeMonthSplit.forEach((split) => Object.keys(split).forEach((m) => allMonths.add(m)));
	const months = Array.from(allMonths).sort();

	return NextResponse.json({
		type,
		months,
		codes,
		categories,
		areas,
		trendByCode: Object.fromEntries(codeMonthSplit),
		trendByCategory: Object.fromEntries(categoryMonthSplit),
		trendByArea: Object.fromEntries(areaMonthSplit),
	});
}