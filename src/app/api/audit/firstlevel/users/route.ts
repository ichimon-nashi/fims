// src/app/api/audit/firstlevel/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

// Default ranks shown when no search query (exclude admin)
// Sorted order: MG → SC → FI → OTHER
const DEFAULT_RANKS = [
	"MG - Manager",
	"SC - Section Chief",
	"FI - Flight Attendant Instructor",
	"OTHER",
];

const RANK_SORT_ORDER: Record<string, number> = {
	"MG - Manager": 0,
	"SC - Section Chief": 1,
	"FI - Flight Attendant Instructor": 2,
	OTHER: 3,
};

function sortUsers(
	users: { employee_id: string; full_name: string; rank: string }[],
) {
	return users.sort((a, b) => {
		const ra = RANK_SORT_ORDER[a.rank] ?? 99;
		const rb = RANK_SORT_ORDER[b.rank] ?? 99;
		if (ra !== rb) return ra - rb;
		return a.employee_id.localeCompare(b.employee_id);
	});
}

export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(req.url);
	const query = searchParams.get("q")?.trim() || "";

	const supabase = createServiceClient();

	if (query === "") {
		const { data, error } = await supabase
			.from("users")
			.select("employee_id, full_name, rank")
			.in("rank", DEFAULT_RANKS);

		if (error)
			return NextResponse.json({ error: error.message }, { status: 500 });
		return NextResponse.json({ users: sortUsers(data || []) });
	}

	// Search — all ranks except admin
	const { data, error } = await supabase
		.from("users")
		.select("employee_id, full_name, rank")
		.neq("rank", "admin")
		.or(`full_name.ilike.%${query}%,employee_id.ilike.%${query}%`)
		.limit(20);

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ users: sortUsers(data || []) });
}
