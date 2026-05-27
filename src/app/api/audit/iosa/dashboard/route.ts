// src/app/api/audit/iosa/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
);

const COMPLETED_STATUSES = [
	"Conformity (Documented and Implemented)",
	"Finding (Not Documented, Not Implemented)",
	"Finding (Not Documented, Implemented)",
	"Finding (Documented, Not Implemented)",
	"Observation (Not Documented, Not Implemented)",
	"Observation (Not Documented, Implemented)",
	"Observation (Documented, Not Implemented)",
	"N/A (Not Applicable)",
];
const FINDING_STATUSES = [
	"Finding (Not Documented, Not Implemented)",
	"Finding (Not Documented, Implemented)",
	"Finding (Documented, Not Implemented)",
];
const OBSERVATION_STATUSES = [
	"Observation (Not Documented, Not Implemented)",
	"Observation (Not Documented, Implemented)",
	"Observation (Documented, Not Implemented)",
];

const ALL_DISCIPLINES = [
	"CAB",
	"FLT",
	"DSP",
	"MNT",
	"GRH",
	"ORG",
	"CGO",
	"SEC",
];

export async function GET(req: NextRequest) {
	try {
		const token = extractTokenFromHeader(req.headers.get("authorization"));
		if (!token)
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		verifyToken(token);

		const cycleId = req.nextUrl.searchParams.get("cycle_id");

		let cycle: any = null;
		if (cycleId) {
			const { data, error } = await supabase
				.from("audit_iosa_cycles")
				.select("*")
				.eq("id", cycleId)
				.single();
			if (error) throw error;
			cycle = data;
		} else {
			const { data, error } = await supabase
				.from("audit_iosa_cycles")
				.select("*")
				.in("status", ["prep", "active"])
				.order("created_at", { ascending: false })
				.limit(1)
				.maybeSingle();
			if (error) throw error;
			cycle = data;
		}

		if (!cycle) {
			return NextResponse.json({
				cycle: null,
				disciplineStats: [],
				flaggedISARPs: [],
				linkedAlerts: [],
			});
		}

		// ISARPs are now cycle-scoped — get totals from audit_iosa_isarps for THIS cycle
		const { data: isarpCounts } = await supabase
			.from("audit_iosa_isarps")
			.select("discipline")
			.eq("cycle_id", cycle.id);

		// Build per-discipline totals from actual seeded ISARPs for this cycle
		const cycleTotals: Record<string, number> = {};
		for (const row of isarpCounts ?? []) {
			cycleTotals[row.discipline] =
				(cycleTotals[row.discipline] || 0) + 1;
		}

		// Records
		const { data: records, error: recErr } = await supabase
			.from("audit_iosa_records")
			.select(
				"discipline, conformance_status, prep_flagged, prep_flag_reason, isarp_code",
			)
			.eq("cycle_id", cycle.id);
		if (recErr) throw recErr;

		const allRecords = records ?? [];

		const disciplineStats = ALL_DISCIPLINES.map((disc) => {
			const dr = allRecords.filter((r) => r.discipline === disc);
			return {
				discipline: disc,
				// Use actual seeded count for this cycle, fallback to 0 if not imported yet
				total: cycleTotals[disc] ?? 0,
				completed: dr.filter(
					(r) =>
						r.conformance_status &&
						COMPLETED_STATUSES.includes(r.conformance_status),
				).length,
				findings: dr.filter(
					(r) =>
						r.conformance_status &&
						FINDING_STATUSES.includes(r.conformance_status),
				).length,
				observations: dr.filter(
					(r) =>
						r.conformance_status &&
						OBSERVATION_STATUSES.includes(r.conformance_status),
				).length,
				inScope: cycle.disciplines?.includes(disc) ?? false,
			};
		});

		const flaggedISARPs = [
			...allRecords
				.filter((r) => r.prep_flagged)
				.map((r) => ({
					isarp_code: r.isarp_code,
					discipline: r.discipline,
					reason: r.prep_flag_reason || "Flagged for review",
					flag_type: "prep" as const,
				})),
			...allRecords
				.filter(
					(r) =>
						r.conformance_status &&
						FINDING_STATUSES.includes(r.conformance_status),
				)
				.map((r) => ({
					isarp_code: r.isarp_code,
					discipline: r.discipline,
					reason: r.conformance_status!,
					flag_type: "finding" as const,
				})),
			...allRecords
				.filter(
					(r) =>
						r.conformance_status &&
						OBSERVATION_STATUSES.includes(r.conformance_status),
				)
				.map((r) => ({
					isarp_code: r.isarp_code,
					discipline: r.discipline,
					reason: r.conformance_status!,
					flag_type: "observation" as const,
				})),
		];

		return NextResponse.json({
			cycle,
			disciplineStats,
			flaggedISARPs,
			linkedAlerts: [],
		});
	} catch (e: any) {
		console.error("[dashboard GET]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
