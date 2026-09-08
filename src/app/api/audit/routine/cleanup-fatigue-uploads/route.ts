// src/app/api/audit/routine/cleanup-fatigue-uploads/route.ts
//
// Deletes fatigue-attachment uploads older than 30 days. Originally
// designed to be triggered by an external scheduler (Vercel Cron /
// pg_cron), since Supabase Storage has no native lifecycle expiration —
// per instruction, this is now instead triggered manually by an admin
// via a button on the pending-review page. Simpler: no external
// scheduling infrastructure or environment variable needed at all.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

const BUCKET = "routine-audit-attachments";
const RETENTION_DAYS = 30;

export async function POST(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();
	const { data: userRecord } = await supabase
		.from("users")
		.select("employee_id")
		.eq("id", decoded.userId)
		.single();
	if (!userRecord) return NextResponse.json({ error: "User not found" }, { status: 404 });

	// same admin-check convention used throughout this codebase
	const isAdmin = userRecord.employee_id === "admin" || userRecord.employee_id === "51892";
	if (!isAdmin) {
		return NextResponse.json({ error: "權限不足：僅限管理員" }, { status: 403 });
	}

	const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

	const { data: expired, error } = await supabase
		.from("routine_audit_fatigue_uploads")
		.select("id, storage_path")
		.lt("uploaded_at", cutoff);

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	if (!expired || expired.length === 0) return NextResponse.json({ deleted: 0 });

	const paths = expired.map((e) => e.storage_path);
	const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
	if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 });

	const ids = expired.map((e) => e.id);
	const { error: deleteError } = await supabase.from("routine_audit_fatigue_uploads").delete().in("id", ids);
	if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

	return NextResponse.json({ deleted: expired.length });
}