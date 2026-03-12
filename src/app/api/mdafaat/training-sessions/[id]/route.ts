// src/app/api/mdafaat/training-sessions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const token = request.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const user = await verifyToken(token);
	if (!user) {
		return NextResponse.json({ error: "Invalid token" }, { status: 401 });
	}

	const { id: idStr } = await params;
	const id = Number(idStr);
	if (isNaN(id)) {
		return NextResponse.json({ error: "Invalid id" }, { status: 400 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	// Only allow patching these specific fields — never touch auth-sensitive columns
	const allowed = ["extra_scenarios", "result"] as const;
	const patch: Record<string, unknown> = {};
	for (const key of allowed) {
		if (key in body) patch[key] = body[key];
	}

	if (Object.keys(patch).length === 0) {
		return NextResponse.json({ error: "No patchable fields provided" }, { status: 400 });
	}

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("mdafaat_training_sessions")
		.update(patch)
		.eq("id", id)
		.select()
		.single();

	if (error) {
		console.error("Error patching training session:", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json({ success: true, data });
}