// src/app/api/audit/routine/flagged-count/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();
	// count DISTINCT entry_no, not raw rows — a flag is set on every
	// finding row sharing one entry_no (per the group-level toggle), so one
	// flagged audit visit with 3 findings under it was counting as 3
	const { data, error } = await supabase
		.from("routine_audit_entries")
		.select("entry_no")
		.eq("flagged_item", true);

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });

	const distinctCount = new Set((data ?? []).map((r) => r.entry_no)).size;
	return NextResponse.json({ count: distinctCount });
}