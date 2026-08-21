// src/app/api/sms/trend-analysis/route.ts
//
// 趨勢分析 (Risk Analysis) tab data source. SRM only — srm_table_entries
// (human_factors_codes[], ef_attribute_codes[]). Previously also unioned
// routine_audit_entries (自督) from the Routine Audit module; that source
// was intentionally dropped per explicit upper-management decision (SMS
// Statistics doc), since with SRM as the only source this tab's data
// became equivalent in scope to SMS統計分析, prompting a page merge.
//
// The payload shape (CodeBucket.srm/self, MonthSplit.srm/self, etc.) is
// deliberately UNCHANGED — TrendAnalysisTab.tsx, TrendRecordsModal.tsx,
// and trend-analysis-export-route.ts all consume that exact shape, and
// changing it would require updating all three in the same pass. `self`
// simply computes to 0 everywhere now, which satisfies "SRM only"
// without a coordinated multi-file shape change. A follow-up cleanup
// pass to actually remove the dead srm/self split (collapsing to a
// single `total`) is optional future work, not required for correctness.
//
// HFACS/human-factors codes are normalized via src/lib/hfacsCodeMap.ts
// (SRM writes zero-padded and unpadded forms inconsistently). EF codes
// need no normalization.
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
import { EF_CODE_MAP } from "@/lib/routineAudit.constants";
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
	const startYear = Number(searchParams.get("start_year"));
	const startMonth = Number(searchParams.get("start_month") ?? 1);
	const endYear = Number(searchParams.get("end_year"));
	const endMonth = Number(searchParams.get("end_month") ?? 12);
	const type = (searchParams.get("type") as "hfacs" | "ef") || "hfacs";

	if (!startYear || !endYear) {
		return NextResponse.json({ error: "start_year and end_year are required" }, { status: 400 });
	}
	if (startYear > endYear) {
		return NextResponse.json({ error: "start_year must not be after end_year" }, { status: 400 });
	}

	const years: number[] = [];
	for (let y = startYear; y <= endYear; y++) years.push(y);

	const supabase = createServiceClient();

	// ---- SRM only — routine_audit_entries (自督) intentionally dropped
	// per explicit decision. The srm/self split in the payload shape below
	// is kept as-is rather than removed, since TrendAnalysisTab.tsx,
	// TrendRecordsModal.tsx, and trend-analysis-export-route.ts all
	// consume that exact shape — self now always computes to 0, which is
	// a safe, non-breaking way to satisfy "SRM only" without a
	// coordinated multi-file shape change. ----
	const srmResult = await supabase
		.from("srm_table_entries")
		.select("human_factors_codes, ef_attribute_codes, occurrence_month, year")
		.in("year", years);

	if (srmResult.error) {
		return NextResponse.json({ error: srmResult.error.message }, { status: 500 });
	}

	const srmRows = srmResult.data ?? [];

	// Genuine cross-year range filter via "YYYY-MM" string comparison —
	// zero-padded YYYY-MM strings sort lexicographically in chronological
	// order, so a plain string range check correctly handles a span like
	// start=2025-01, end=2026-08 (all of 2025 plus Jan-Aug 2026), which a
	// per-row numeric month check applied uniformly across every year
	// could not express. Matches this codebase's own documented pattern
	// of doing month-window filtering in JS rather than a Supabase range
	// filter on occurrence_month (unreliable on nullable date columns).
	const startKey = `${startYear}-${String(startMonth).padStart(2, "0")}`;
	const endKey = `${endYear}-${String(endMonth).padStart(2, "0")}`;
	const srmRowsInRange = srmRows.filter((r) => {
		if (!r.occurrence_month) return false;
		const key = String(r.occurrence_month).slice(0, 7); // "YYYY-MM" prefix, robust to any trailing time component
		return key >= startKey && key <= endKey;
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