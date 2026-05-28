// src/app/api/audit/iosa/tables/route.ts
// Returns a named table from audit_iosa_tables for a cycle
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
		const tableRef = searchParams.get("table_ref");

		if (!cycleId || !tableRef) {
			return NextResponse.json(
				{ error: "cycle_id and table_ref required" },
				{ status: 400 },
			);
		}

		const { data, error } = await supabase
			.from("audit_iosa_tables")
			.select("*")
			.eq("cycle_id", cycleId)
			.eq("table_ref", tableRef)
			.maybeSingle();

		if (error) throw error;

		return NextResponse.json({ table: data ?? null });
	} catch (e: any) {
		console.error("[tables GET]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
