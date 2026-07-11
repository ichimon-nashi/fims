// src/app/api/roulette/employees/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
	try {
		const authHeader = req.headers.get("authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const token = authHeader.slice(7);
		const payload = verifyToken(token);
		if (!payload) {
			return NextResponse.json({ error: "Invalid token" }, { status: 401 });
		}

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("users")
			.select("id, employee_id, full_name, rank, base, gender, aircraft_type_ratings, filter")
			.neq("employee_id", "admin")
			.eq("is_inactive", false)
			.order("employee_id", { ascending: true });

		if (error) {
			console.error("[roulette/employees] Supabase error:", error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		const employees = (data ?? []).map((row: any) => ({
			...row,
			aircraft_type_ratings: Array.isArray(row.aircraft_type_ratings)
				? row.aircraft_type_ratings
				: [],
			filter: Array.isArray(row.filter) ? row.filter : [],
		}));

		return NextResponse.json({ employees });
	} catch (err) {
		console.error("[roulette/employees] Unexpected error:", err);
		return NextResponse.json({ error: "Server error" }, { status: 500 });
	}
}