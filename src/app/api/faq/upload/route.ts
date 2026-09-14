// src/app/api/faq/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

const ADMINS = ["admin", "51892"];
const MAX_BYTES = 3 * 1024 * 1024; // 3MB raw — base64 (~4MB) stays under Vercel's 4.5MB request-body cap
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function getAuth(req: NextRequest): { userId: string; email: string; authLevel: number } | null {
	const token = extractTokenFromHeader(req.headers.get("authorization"));
	if (!token) return null;
	try {
		return verifyToken(token) as any;
	} catch {
		return null;
	}
}

async function requireAdmin(req: NextRequest, supabase: ReturnType<typeof createServiceClient>) {
	const auth = getAuth(req);
	if (!auth) return null;

	const { data: userRow } = await supabase
		.from("users")
		.select("employee_id")
		.eq("id", auth.userId)
		.single();

	if (!userRow || !ADMINS.includes(userRow.employee_id)) return null;
	return auth;
}

/**
 * POST /api/faq/upload
 * Body: { fileName: string, fileType: string, dataBase64: string }
 *
 * JSON instead of multipart — req.formData() was failing to parse a
 * correctly-formed multipart body in this dev environment for reasons
 * that weren't pinned down (client Content-Type + boundary verified
 * correct, no fetch override, middleware never touches the body). This
 * routes around the parser entirely instead of chasing it further.
 */
export async function POST(req: NextRequest) {
	const supabase = createServiceClient();
	if (!(await requireAdmin(req, supabase)))
		return NextResponse.json({ error: "forbidden" }, { status: 403 });

	const body = await req.json();
	const { fileName, fileType, dataBase64 } = body || {};

	if (!fileName || !fileType || !dataBase64) {
		return NextResponse.json({ error: "缺少檔案資料" }, { status: 400 });
	}
	if (!ALLOWED_TYPES.includes(fileType)) {
		return NextResponse.json({ error: "僅支援 PNG / JPEG / WEBP / GIF" }, { status: 400 });
	}

	const buffer = Buffer.from(dataBase64, "base64");
	if (buffer.length > MAX_BYTES) {
		return NextResponse.json({ error: "檔案大小不可超過 3MB" }, { status: 400 });
	}

	const ext = fileName.split(".").pop() || "png";
	const path = `${crypto.randomUUID()}.${ext}`;

	const { error: uploadError } = await supabase.storage
		.from("faq-images")
		.upload(path, buffer, { contentType: fileType, upsert: false });

	if (uploadError) {
		console.error("POST /api/faq/upload storage error:", uploadError);
		return NextResponse.json({ error: uploadError.message }, { status: 500 });
	}

	const { data } = supabase.storage.from("faq-images").getPublicUrl(path);
	return NextResponse.json({ url: data.publicUrl }, { status: 201 });
}
