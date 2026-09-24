// src/app/api/audit/iosa/activity/route.ts
// Read side of the live conformance stream. Writes happen in the auditprep
// PATCH route (single write path), which also broadcasts a data-less ping.
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
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		verifyToken(token);

		const cycleId = req.nextUrl.searchParams.get("cycle_id");
		if (!cycleId)
			return NextResponse.json({ error: "cycle_id required" }, { status: 400 });
		const limit = Math.min(
			Number(req.nextUrl.searchParams.get("limit")) || 60,
			200,
		);

		const { data, error } = await supabase
			.from("audit_iosa_activity")
			.select("*")
			.eq("cycle_id", cycleId)
			.order("updated_at", { ascending: false })
			.limit(limit);
		if (error) throw error;

		return NextResponse.json({ activity: data ?? [] });
	} catch (e: any) {
		console.error("[activity GET]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}

// ── Clear a cycle's stream — 51892/admin only (testing & demo period) ──
export async function DELETE(req: NextRequest) {
	try {
		const token = extractTokenFromHeader(req.headers.get("authorization"));
		if (!token)
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		const decoded = verifyToken(token);

		// JWT carries only userId — employee_id must come from the users table
		const { data: u, error: uErr } = await supabase
			.from("users")
			.select("employee_id")
			.eq("id", decoded.userId)
			.maybeSingle();
		if (uErr) throw uErr;
		if (!u || !["51892", "admin"].includes(String(u.employee_id)))
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });

		const cycleId = req.nextUrl.searchParams.get("cycle_id");
		if (!cycleId)
			return NextResponse.json({ error: "cycle_id required" }, { status: 400 });

		const { error, count } = await supabase
			.from("audit_iosa_activity")
			.delete({ count: "exact" })
			.eq("cycle_id", cycleId);
		if (error) throw error;

		// Ping other open dashboards so they empty too (data-less, as in auditprep)
		try {
			await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					apikey: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
					Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!}`,
				},
				body: JSON.stringify({
					messages: [{ topic: `iosa-activity-${cycleId}`, event: "activity", payload: { cycle_id: cycleId } }],
				}),
			});
		} catch (pingErr) {
			console.error("[activity DELETE] broadcast failed", pingErr);
		}

		return NextResponse.json({ deleted: count ?? 0 });
	} catch (e: any) {
		console.error("[activity DELETE]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
