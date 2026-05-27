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
		// No section filter — load all sections at once so client-side counts are accurate

		if (!cycleId)
			return NextResponse.json(
				{ error: "cycle_id required" },
				{ status: 400 },
			);

		const { data: isarps, error: isarpErr } = await supabase
			.from("audit_iosa_isarps")
			.select("*")
			.eq("cycle_id", cycleId)
			.eq("discipline", discipline)
			.order("row_order", { ascending: true });
		if (isarpErr) throw isarpErr;

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
		const { cycle_id, isarp_code, discipline } = body;

		if (!cycle_id || !isarp_code) {
			return NextResponse.json(
				{ error: "cycle_id and isarp_code required" },
				{ status: 400 },
			);
		}

		// Fetch existing record first so we never overwrite fields not included in patch
		const { data: existing } = await supabase
			.from("audit_iosa_records")
			.select("*")
			.eq("cycle_id", cycle_id)
			.eq("isarp_code", isarp_code)
			.maybeSingle();

		// Merge: start from existing, apply only the fields present in body
		const merged: any = {
			cycle_id,
			isarp_code,
			discipline: discipline || isarp_code.split(" ")[0],
			doc_references: existing?.doc_references ?? "",
			aa_responses: existing?.aa_responses ?? {},
			prep_flagged: existing?.prep_flagged ?? false,
			prep_flag_reason: existing?.prep_flag_reason ?? "",
			prep_status: existing?.prep_status ?? "not_started",
			conformance_status: existing?.conformance_status ?? null,
			nonconformity_desc: existing?.nonconformity_desc ?? "",
			root_cause: existing?.root_cause ?? "",
			corrective_action: existing?.corrective_action ?? "",
			last_audit_date: existing?.last_audit_date ?? null,
			last_auditor_name: existing?.last_auditor_name ?? null,
			updated_by: decoded.userId,
			updated_at: new Date().toISOString(),
		};

		// Apply only the fields explicitly sent in the body
		const patchableFields = [
			"doc_references",
			"aa_responses",
			"prep_flagged",
			"prep_flag_reason",
			"prep_status",
			"conformance_status",
			"nonconformity_desc",
			"root_cause",
			"corrective_action",
		];
		for (const field of patchableFields) {
			if (field in body) merged[field] = body[field];
		}

		const { data, error } = await supabase
			.from("audit_iosa_records")
			.upsert(merged, { onConflict: "cycle_id,isarp_code" })
			.select()
			.single();

		if (error) throw error;
		return NextResponse.json({ record: data });
	} catch (e: any) {
		console.error("[auditprep PATCH]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
