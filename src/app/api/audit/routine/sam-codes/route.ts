// src/app/api/audit/routine/sam-codes/route.ts
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

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("routine_audit_sam_codes")
		.select("*")
		.eq("active", true)
		.order("sort_order", { ascending: true });

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ records: data });
}