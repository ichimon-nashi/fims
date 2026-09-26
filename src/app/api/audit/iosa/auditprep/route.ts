// src/app/api/audit/iosa/auditprep/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SECRET_KEY!,
);

// ── Activity log (live conformance stream) ──────────────────────
// Enum-like fields log every change; free-text fields autosave while typing,
// so edits by the same person within COALESCE_MS update one row instead of
// flooding the stream.
const EVENT_FIELDS = ["conformance_status", "open_item", "prep_flagged", "prep_status"];
const TEXT_FIELDS = [
	"auditor_comments",
	"nonconformity_desc",
	"root_cause",
	"corrective_action",
	"doc_references",
	"prep_flag_reason",
];
const COALESCE_MS = 5 * 60 * 1000;
const clip = (v: unknown) =>
	v === null || v === undefined ? null : String(v).slice(0, 500);

async function logActivity(
	existing: any,
	merged: any,
	body: any,
	actorId: string,
	actorName: string | null,
) {
	const base = {
		cycle_id: merged.cycle_id,
		isarp_code: merged.isarp_code,
		discipline: merged.discipline,
		actor_id: String(actorId),
		actor_name: actorName,
	};
	const inserts: any[] = [];

	for (const f of EVENT_FIELDS) {
		if (!(f in body)) continue;
		const oldV = existing?.[f] ?? null;
		const newV = merged[f] ?? null;
		if (oldV === newV) continue;
		inserts.push({ ...base, field: f, old_value: clip(oldV), new_value: clip(newV) });
	}

	// Auditor actions: log completion ticks only
	if ("aa_responses" in body) {
		const before = existing?.aa_responses ?? {};
		const after = merged.aa_responses ?? {};
		for (const num of new Set([...Object.keys(before), ...Object.keys(after)])) {
			const a = !!before[num]?.completed;
			const b = !!after[num]?.completed;
			if (a !== b)
				inserts.push({ ...base, field: "aa", old_value: num, new_value: b ? "completed" : "unchecked" });
		}
	}

	if (inserts.length) {
		const { error } = await supabase.from("audit_iosa_activity").insert(inserts);
		if (error) throw error;
	}

	for (const f of TEXT_FIELDS) {
		if (!(f in body)) continue;
		const oldV = existing?.[f] ?? "";
		const newV = merged[f] ?? "";
		if (oldV === newV) continue;
		const { data: recent } = await supabase
			.from("audit_iosa_activity")
			.select("id, updated_at")
			.eq("cycle_id", base.cycle_id)
			.eq("isarp_code", base.isarp_code)
			.eq("field", f)
			.eq("actor_id", base.actor_id)
			.order("updated_at", { ascending: false })
			.limit(1)
			.maybeSingle();
		if (recent && Date.now() - new Date(recent.updated_at).getTime() < COALESCE_MS) {
			await supabase
				.from("audit_iosa_activity")
				.update({ new_value: clip(newV), updated_at: new Date().toISOString() })
				.eq("id", recent.id);
		} else {
			await supabase
				.from("audit_iosa_activity")
				.insert({ ...base, field: f, old_value: clip(oldV), new_value: clip(newV) });
		}
	}

	// Data-less ping: clients refetch through the authenticated GET, so no
	// audit content ever travels over the public anon-key channel.
	await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			apikey: process.env.SUPABASE_SECRET_KEY!,
		},
		body: JSON.stringify({
			messages: [
				{
					topic: `iosa-activity-${base.cycle_id}`,
					event: "activity",
					payload: { cycle_id: base.cycle_id },
				},
			],
		}),
	});
}

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
		// Optional: live-update refetch of a single ISARP (see PATCH ping)
		const isarpCode = searchParams.get("isarp_code");
		const onlyCode = isarpCode ? { isarp_code: isarpCode } : {};
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
			.match(onlyCode)
			.order("row_order", { ascending: true });
		if (isarpErr) throw isarpErr;

		const { data: records, error: recErr } = await supabase
			.from("audit_iosa_records")
			.select("*")
			.eq("cycle_id", cycleId)
			.eq("discipline", discipline)
			.match(onlyCode);
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

		// Server-side discipline permission — mirrors the client rule in
		// IOSAAuditPrep (null or [] = unrestricted). Checks both the body
		// discipline and the ISARP code prefix so neither can be spoofed alone.
		const { data: userRow, error: userErr } = await supabase
			.from("users")
			.select("*")
			.eq("id", decoded.userId)
			.maybeSingle();
		if (userErr) throw userErr;
		if (!userRow)
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		const editDiscs: string[] | null =
			(userRow.app_permissions as any)?.audit?.iosa_edit_disciplines ??
			null;
		if (editDiscs && editDiscs.length > 0) {
			const targets = new Set<string>([
				discipline || isarp_code.split(" ")[0],
				isarp_code.split(" ")[0],
			]);
			for (const d of targets) {
				if (!editDiscs.includes(d)) {
					return NextResponse.json(
						{ error: `No edit permission for ${d}` },
						{ status: 403 },
					);
				}
			}
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
			open_item: existing?.open_item ?? false,
			auditor_comments: existing?.auditor_comments ?? "",
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
			"open_item",
			"auditor_comments",
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

		// Never let logging break a save — the record is already written.
		// Only the Audit page tags its saves with source:"audit"; AuditPrep
		// saves are intentionally not logged. `source` is not a patchable
		// field, so it is never stored on the record.
		if (body.source === "audit") try {
			const u: any = userRow;
			await logActivity(
				existing,
				merged,
				body,
				decoded.userId,
				u.full_name ?? u.name ?? u.display_name ?? u.employee_id ?? null,
			);
		} catch (logErr) {
			console.error("[auditprep PATCH] activity log failed", logErr);
		}

		// Content-free ping for live updates on the Audit page (every save,
		// from any page). Clients refetch the one ISARP through the
		// authenticated GET. Never let the ping break a save.
		try {
			await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					apikey: process.env.SUPABASE_SECRET_KEY!,
				},
				body: JSON.stringify({
					messages: [
						{
							topic: `audit-records-${cycle_id}-${merged.discipline}`,
							event: "record",
							payload: { isarp_code },
						},
					],
				}),
			});
		} catch (pingErr) {
			console.error("[auditprep PATCH] record ping failed", pingErr);
		}

		return NextResponse.json({ record: data });
	} catch (e: any) {
		console.error("[auditprep PATCH]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
