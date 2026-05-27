// src/app/api/audit/iosa/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";
import * as XLSX from "xlsx";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
);

const VALID_DISCIPLINES = [
	"ORG",
	"FLT",
	"DSP",
	"CAB",
	"GRH",
	"MNT",
	"CGO",
	"SEC",
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

function parseRows(buffer: Buffer) {
	const wb = XLSX.read(buffer, { type: "buffer" });
	const ws = wb.Sheets["Conformance Report"];
	if (!ws) return [];

	// sheet_to_json with header:1 gives array of arrays, defval:'' fills blanks
	const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
		header: 1,
		defval: "",
	});

	const rows: any[] = [];

	for (let i = 1; i < raw.length; i++) {
		// skip header row
		const cols = raw[i];
		const discipline = String(cols[0] || "")
			.trim()
			.toUpperCase();
		if (!VALID_DISCIPLINES.includes(discipline)) continue;

		const isarpCode = String(cols[1] || "").trim();
		if (!isarpCode) continue;

		const sectionMatch = isarpCode.match(/\s(\d+)\./);
		const section = sectionMatch ? parseInt(sectionMatch[1]) : 1;
		const standardText = String(cols[2] || "").trim();

		const hasSms = standardText.includes("[SMS]");
		const hasGm = standardText.includes("(GM)");
		const isRp =
			standardText.toLowerCase().includes(" should ") &&
			!standardText.toLowerCase().includes(" shall ");

		// AA cols 10–24 = AA1–AA15, col 25 = AA Other
		const aaResponses: Record<string, boolean> = {};
		for (let a = 0; a <= 14; a++) {
			const val = String(cols[10 + a] || "").trim();
			aaResponses[`AA${a + 1}`] =
				val === "ü" || val === "✓" || val === "v" || val === "1";
		}
		const aaOther = String(cols[25] || "").trim();

		rows.push({
			isarp_code: isarpCode,
			discipline,
			section,
			standard_text: standardText,
			isarp_type: isRp ? "Recommended Practice" : "Standard",
			has_gm: hasGm,
			has_sms: hasSms,
			last_audit_date: String(cols[3] || "").trim() || null,
			last_auditor_name: String(cols[4] || "").trim() || null,
			doc_references: String(cols[5] || "").trim() || null,
			conformance_status: String(cols[6] || "").trim() || null,
			nonconformity_desc: String(cols[7] || "").trim() || null,
			root_cause: String(cols[8] || "").trim() || null,
			corrective_action: String(cols[9] || "").trim() || null,
			aa_responses: aaResponses,
			aa_other: aaOther || null,
		});
	}
	return rows;
}

function buildAaJson(row: any) {
	const result: Record<string, { completed: boolean; remarks: string }> = {};
	for (let i = 1; i <= 15; i++) {
		result[`AA${i}`] = {
			completed: row.aa_responses[`AA${i}`] ?? false,
			remarks: "",
		};
	}
	result["AA_other"] = {
		completed: !!row.aa_other,
		remarks: row.aa_other || "",
	};
	return result;
}

// POST — parse CR xlsx, seed cycle-scoped ISARPs, populate records
export async function POST(req: NextRequest) {
	try {
		const token = extractTokenFromHeader(req.headers.get("authorization"));
		if (!token)
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		const decoded = verifyToken(token);

		const formData = await req.formData();
		const file = formData.get("file") as File | null;
		const cycleId = formData.get("cycle_id") as string | null;
		const ismEdition =
			(formData.get("ism_edition") as string) || "Ed.18 Rev1";
		const crVersion = (formData.get("cr_version") as string) || "";
		const mode = (formData.get("mode") as string) || "with_records";

		if (!file)
			return NextResponse.json(
				{ error: "No file provided" },
				{ status: 400 },
			);
		if (!cycleId)
			return NextResponse.json(
				{ error: "cycle_id required" },
				{ status: 400 },
			);

		// Read file into buffer — no temp files, no shell commands
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const parsed = parseRows(buffer);
		if (parsed.length === 0) {
			return NextResponse.json(
				{
					error: "No valid ISARP rows found. Make sure this is a CR xlsx file.",
				},
				{ status: 400 },
			);
		}

		// ── Step 1: Upsert cycle-scoped ISARPs ──────────────────────────
		const isarpRows = parsed.map((r) => ({
			cycle_id: cycleId,
			isarp_code: r.isarp_code,
			discipline: r.discipline,
			section: r.section,
			standard_text: r.standard_text,
			isarp_type: r.isarp_type,
			has_gm: r.has_gm,
			has_sms: r.has_sms,
			ism_edition: ismEdition,
			cr_version: crVersion,
			linked_isarps: [],
			auditor_actions: [],
		}));

		const { error: upsertErr } = await supabase
			.from("audit_iosa_isarps")
			.upsert(isarpRows, { onConflict: "cycle_id,isarp_code" });

		if (upsertErr) throw upsertErr;

		// Update cycle cr_version
		if (crVersion) {
			await supabase
				.from("audit_iosa_cycles")
				.update({ cr_version: crVersion })
				.eq("id", cycleId);
		}

		// ── Step 2: Populate records ─────────────────────────────────────
		let conflicts: any[] = [];
		let autoImported = 0;

		if (mode === "with_records") {
			const { data: existing } = await supabase
				.from("audit_iosa_records")
				.select("*")
				.eq("cycle_id", cycleId);

			const existingMap = new Map(
				(existing ?? []).map((r) => [r.isarp_code, r]),
			);
			const toInsert: any[] = [];

			for (const row of parsed) {
				const hasFileData =
					row.doc_references ||
					row.conformance_status ||
					row.nonconformity_desc ||
					row.root_cause ||
					row.corrective_action;
				if (!hasFileData) continue;

				const ex = existingMap.get(row.isarp_code);

				if (!ex) {
					toInsert.push({
						cycle_id: cycleId,
						isarp_code: row.isarp_code,
						discipline: row.discipline,
						doc_references: row.doc_references || "",
						conformance_status: row.conformance_status || null,
						nonconformity_desc: row.nonconformity_desc || "",
						root_cause: row.root_cause || "",
						corrective_action: row.corrective_action || "",
						last_audit_date: row.last_audit_date || null,
						last_auditor_name: row.last_auditor_name || null,
						aa_responses: buildAaJson(row),
						prep_status: row.conformance_status
							? "ready"
							: "in_progress",
						updated_by: decoded.userId,
					});
					autoImported++;
				} else {
					const fieldConflicts: any[] = [];
					const checkField = (
						field: string,
						fv: string | null,
						sv: string | null,
					) => {
						const f = (fv || "").trim(),
							s = (sv || "").trim();
						if (f && s && f !== s)
							fieldConflicts.push({
								field,
								file_value: f,
								system_value: s,
							});
					};
					checkField(
						"doc_references",
						row.doc_references,
						ex.doc_references,
					);
					checkField(
						"conformance_status",
						row.conformance_status,
						ex.conformance_status,
					);
					checkField(
						"nonconformity_desc",
						row.nonconformity_desc,
						ex.nonconformity_desc,
					);
					checkField("root_cause", row.root_cause, ex.root_cause);
					checkField(
						"corrective_action",
						row.corrective_action,
						ex.corrective_action,
					);

					if (fieldConflicts.length > 0) {
						conflicts.push({
							isarp_code: row.isarp_code,
							discipline: row.discipline,
							field_conflicts: fieldConflicts,
							file_row: row,
							system_record: ex,
						});
					} else {
						const patch: any = {};
						if (!ex.doc_references && row.doc_references)
							patch.doc_references = row.doc_references;
						if (!ex.conformance_status && row.conformance_status)
							patch.conformance_status = row.conformance_status;
						if (!ex.nonconformity_desc && row.nonconformity_desc)
							patch.nonconformity_desc = row.nonconformity_desc;
						if (!ex.root_cause && row.root_cause)
							patch.root_cause = row.root_cause;
						if (!ex.corrective_action && row.corrective_action)
							patch.corrective_action = row.corrective_action;
						if (Object.keys(patch).length > 0) {
							await supabase
								.from("audit_iosa_records")
								.update({
									...patch,
									updated_by: decoded.userId,
									updated_at: new Date().toISOString(),
								})
								.eq("id", ex.id);
							autoImported++;
						}
					}
				}
			}

			if (toInsert.length > 0) {
				const { error: insErr } = await supabase
					.from("audit_iosa_records")
					.insert(toInsert);
				if (insErr) throw insErr;
			}
		}

		return NextResponse.json({
			success: true,
			isarps_seeded: parsed.length,
			auto_imported: autoImported,
			conflicts,
		});
	} catch (e: any) {
		console.error("[import POST]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}

// PATCH — resolve conflicts
export async function PATCH(req: NextRequest) {
	try {
		const token = extractTokenFromHeader(req.headers.get("authorization"));
		if (!token)
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		const decoded = verifyToken(token);

		const { resolutions } = await req.json();

		for (const res of resolutions) {
			const patch: any = {
				updated_by: decoded.userId,
				updated_at: new Date().toISOString(),
			};
			for (const [field, choice] of Object.entries(res.fields)) {
				if (choice === "file")
					patch[field] = (res.file_row as any)[field] || "";
			}
			if (Object.keys(patch).length > 2) {
				await supabase
					.from("audit_iosa_records")
					.update(patch)
					.eq("cycle_id", res.cycle_id)
					.eq("isarp_code", res.isarp_code);
			}
		}

		return NextResponse.json({ success: true });
	} catch (e: any) {
		console.error("[import PATCH]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
