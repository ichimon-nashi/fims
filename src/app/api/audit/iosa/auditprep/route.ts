// src/app/api/audit/iosa/auditprep/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
	try {
		const token = extractTokenFromHeader(req.headers.get("authorization"));
		if (!token)
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		verifyToken(token);

		const { searchParams } = req.nextUrl;
		const cycleId = searchParams.get("cycle_id");
		const discipline = searchParams.get("discipline") || "CAB";
		const section = searchParams.get("section");

		if (!cycleId)
			return NextResponse.json(
				{ error: "cycle_id required" },
				{ status: 400 },
			);

		// ISARPs are now cycle-scoped — filter by cycle_id + discipline
		let isarpQuery = supabase
			.from("audit_iosa_isarps")
			.select("*")
			.eq("cycle_id", cycleId)
			.eq("discipline", discipline)
			.order("isarp_code", { ascending: true });

		if (section) isarpQuery = isarpQuery.eq("section", parseInt(section));

		const { data: isarps, error: isarpErr } = await isarpQuery;
		if (isarpErr) throw isarpErr;

		// Records are cycle-scoped already
		const { data: records, error: recErr } = await supabase
			.from("audit_iosa_records")
			.select("*")
			.eq("cycle_id", cycleId)
			.eq("discipline", discipline);
		if (recErr) throw recErr;

		const recordMap = new Map(
			(records ?? []).map((r) => [r.isarp_code, r]),
		);

		const merged = (isarps ?? []).map((isarp) => ({
			...isarp,
			record: recordMap.get(isarp.isarp_code) ?? null,
		}));

		return NextResponse.json({ isarps: merged });
	} catch (e: any) {
		console.error("[auditprep GET]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}

export async function PATCH(req: NextRequest) {
	try {
		const token = extractTokenFromHeader(req.headers.get("authorization"));
		if (!token)
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		const decoded = verifyToken(token);

		const body = await req.json();
		const {
			cycle_id,
			isarp_code,
			discipline,
			doc_references,
			aa_responses,
			prep_flagged,
			prep_flag_reason,
			prep_status,
		} = body;

		if (!cycle_id || !isarp_code) {
			return NextResponse.json(
				{ error: "cycle_id and isarp_code required" },
				{ status: 400 },
			);
		}

		const { data, error } = await supabase
			.from("audit_iosa_records")
			.upsert(
				{
					cycle_id,
					isarp_code,
					discipline: discipline || isarp_code.split(" ")[0],
					doc_references: doc_references ?? "",
					aa_responses: aa_responses ?? {},
					prep_flagged: prep_flagged ?? false,
					prep_flag_reason: prep_flag_reason ?? "",
					prep_status: prep_status ?? "in_progress",
					updated_by: decoded.userId,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: "cycle_id,isarp_code" },
			)
			.select()
			.single();

		if (error) throw error;
		return NextResponse.json({ record: data });
	} catch (e: any) {
		console.error("[auditprep PATCH]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
