// src/app/api/audit/routine/fatigue-uploads/route.ts
// Lists every uploaded fatigue supporting document across ALL forms
// (pending, approved, everything) — not scoped to one form like the
// existing per-form endpoint. This is the data source for a "file
// manager" view where someone can browse and redownload past uploads
// without needing to find and reopen the original audit first.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();

	const { data: uploads, error } = await supabase
		.from("routine_audit_fatigue_uploads")
		.select("id, form_id, item_no, display_filename, uploaded_at")
		.order("uploaded_at", { ascending: false });

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	if (!uploads || uploads.length === 0) return NextResponse.json({ uploads: [] });

	// enrich with form context (date, tail, subject crew) so the file
	// manager can show something more useful than a bare filename list
	const formIds = Array.from(new Set(uploads.map((u) => u.form_id)));
	const { data: forms } = await supabase
		.from("audit_routine_forms")
		.select("id, audit_date, aircraft_tail, status")
		.in("id", formIds);
	const formMap = new Map<string, { audit_date: string; aircraft_tail: string; status: string }>(
		(forms ?? []).map((f) => [f.id, { audit_date: f.audit_date, aircraft_tail: f.aircraft_tail, status: f.status }]),
	);

	const enriched = uploads.map((u) => ({
		...u,
		audit_date: formMap.get(u.form_id)?.audit_date ?? null,
		aircraft_tail: formMap.get(u.form_id)?.aircraft_tail ?? null,
		status: formMap.get(u.form_id)?.status ?? null,
	}));

	return NextResponse.json({ uploads: enriched });
}