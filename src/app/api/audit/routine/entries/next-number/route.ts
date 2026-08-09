// src/app/api/audit/routine/entries/next-number/route.ts
// Read-only preview of the next entry_no for a given prefix+year+month.
// Mirrors the atomic function's own numbering logic exactly, but this is
// advisory only — no lock, no reservation. The real number is only
// finalized atomically at actual insert time; if someone else creates an
// entry in the same month between this preview and the real save, the
// final number may differ by one. That's fine for a preview, not fine for
// the actual generation, which is why the atomic function does its own
// independent calculation rather than trusting this endpoint's result.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(req.url);
	const prefix = searchParams.get("prefix");
	const year = Number(searchParams.get("year"));
	const month = Number(searchParams.get("month"));

	if (!prefix || !year || !month) {
		return NextResponse.json({ error: "prefix, year, and month are required" }, { status: 400 });
	}

	const mm = String(month).padStart(2, "0");
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("routine_audit_entries")
		.select("entry_no")
		.eq("report_year", year)
		.eq("report_month", month)
		.like("entry_no", `${prefix}${mm}%`);

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });

	const seqs = (data ?? [])
		.map((r) => parseInt(r.entry_no.slice(4), 10))
		.filter((n) => !Number.isNaN(n));
	const nextSeq = (seqs.length ? Math.max(...seqs) : 0) + 1;
	const entry_no = `${prefix}${mm}${String(nextSeq).padStart(2, "0")}`;

	return NextResponse.json({ entry_no });
}