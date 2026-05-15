// src/app/api/mdafaat/pending-groups/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

// GET: Fetch pending groups for a specific date
export async function GET(request: NextRequest) {
	const date = request.nextUrl.searchParams.get("date");
	if (!date) {
		return NextResponse.json({ error: "date param required" }, { status: 400 });
	}

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("mdafaat_pending_groups")
		.select("*")
		.eq("training_date", date)
		.order("group_number", { ascending: true });

	if (error) {
		console.error("Error fetching pending groups:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json(data || []);
}

// POST: Save pending groups for a date (replaces existing pending groups for that date)
export async function POST(request: NextRequest) {
	const token = request.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const user = await verifyToken(token);
	if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

	let body: { groups: any[]; training_date: string };
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const { groups, training_date } = body;
	if (!groups || !Array.isArray(groups) || !training_date) {
		return NextResponse.json({ error: "Invalid data" }, { status: 400 });
	}

	const supabase = createServiceClient();

	// Delete existing pending groups for this date first (replace all)
	await supabase
		.from("mdafaat_pending_groups")
		.delete()
		.eq("training_date", training_date)
		.eq("created_by", user.employee_id ?? user.id ?? "unknown");

	if (groups.length === 0) {
		// Just clearing — return success
		return NextResponse.json({ success: true, count: 0 });
	}

	const rows = groups.map(g => ({
		training_date,
		group_type:      g.group_type,
		group_number:    g.group_number,
		core_scenario:   g.core_scenario ?? null,
		aircraft_type:   g.aircraft_type,
		aircraft_number: g.aircraft_number,
		members:         g.members,
		created_by:      user.employee_id ?? user.id ?? "unknown",
	}));

	const { data, error } = await supabase
		.from("mdafaat_pending_groups")
		.insert(rows)
		.select();

	if (error) {
		console.error("Error saving pending groups:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({ success: true, count: data?.length ?? 0, data });
}

// DELETE: Remove a single pending group by id (called by ScenarioMode on completion)
export async function DELETE(request: NextRequest) {
	const token = request.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const user = await verifyToken(token);
	if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

	const id = request.nextUrl.searchParams.get("id");
	if (!id) return NextResponse.json({ error: "id param required" }, { status: 400 });

	const supabase = createServiceClient();
	const { error } = await supabase
		.from("mdafaat_pending_groups")
		.delete()
		.eq("id", Number(id));

	if (error) {
		console.error("Error deleting pending group:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({ success: true });
}