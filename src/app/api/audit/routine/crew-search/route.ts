// src/app/api/audit/routine/crew-search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

const CABIN_CREW_RANKS = [
	"FA - Flight Attendant",
	"FS - Flight Stewardess",
	"LF - Leading Flight Attendant",
	"PR - Purser",
	"FI - Flight Attendant Instructor",
];

export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(req.url);
	const q = searchParams.get("q")?.trim();
	const fleet = searchParams.get("fleet"); // "ATR" | "B738" — optional, narrows to crew qualified for this audit's aircraft

	const supabase = createServiceClient();

	let query = supabase
		.from("users")
		.select("employee_id, full_name, aircraft_type_ratings")
		.in("rank", CABIN_CREW_RANKS)
		.eq("is_inactive", false)
		.order("employee_id", { ascending: true })
		.limit(20);

	if (q) query = query.or(`employee_id.ilike.%${q}%,full_name.ilike.%${q}%`);
	if (fleet) query = query.contains("aircraft_type_ratings", [fleet]);

	const { data, error } = await query;

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ records: data ?? [] });
}