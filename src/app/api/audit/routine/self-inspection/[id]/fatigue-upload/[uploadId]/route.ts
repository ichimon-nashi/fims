// src/app/api/audit/routine/self-inspection/[id]/fatigue-upload/[uploadId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

const BUCKET = "routine-audit-attachments";

export async function GET(
	req: NextRequest,
	context: { params: Promise<{ id: string; uploadId: string }> },
) {
	const { id, uploadId } = await context.params;
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();
	const { data: upload } = await supabase
		.from("routine_audit_fatigue_uploads")
		.select("storage_path, display_filename")
		.eq("id", uploadId)
		.eq("form_id", id)
		.single();

	if (!upload) return NextResponse.json({ error: "找不到檔案" }, { status: 404 });

	const { data: fileBlob, error } = await supabase.storage.from(BUCKET).download(upload.storage_path);
	if (error || !fileBlob) return NextResponse.json({ error: error?.message ?? "下載失敗" }, { status: 500 });

	// Supabase Storage's .download() can return a "successful" blob that
	// actually contains a JSON error payload (auth/policy/missing-object
	// issues at the storage layer) without the SDK surfacing it as a JS
	// error. The Content-Disposition filename below comes from the
	// database independently of this blob's real content, so such a
	// failure would previously download with a correct-looking PDF
	// filename while the bytes inside are garbage JSON text. Catching it
	// here surfaces the real problem instead of silently serving it.
	if (fileBlob.type === "application/json") {
		const errorText = await fileBlob.text();
		return NextResponse.json(
			{ error: `儲存空間回傳錯誤，而非檔案內容：${errorText}` },
			{ status: 502 },
		);
	}

	const arrayBuffer = await fileBlob.arrayBuffer();
	return new NextResponse(new Uint8Array(arrayBuffer), {
		status: 200,
		headers: {
			"Content-Type": fileBlob.type || "application/octet-stream",
			"Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(upload.display_filename)}`,
		},
	});
}

// allows replacing a wrong upload — removes both the stored file and its
// tracking row so a fresh upload to the same slot starts clean
export async function DELETE(
	req: NextRequest,
	context: { params: Promise<{ id: string; uploadId: string }> },
) {
	const { id, uploadId } = await context.params;
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();
	const { data: upload } = await supabase
		.from("routine_audit_fatigue_uploads")
		.select("storage_path")
		.eq("id", uploadId)
		.eq("form_id", id)
		.single();

	if (!upload) return NextResponse.json({ error: "找不到檔案" }, { status: 404 });

	await supabase.storage.from(BUCKET).remove([upload.storage_path]);
	const { error } = await supabase.from("routine_audit_fatigue_uploads").delete().eq("id", uploadId);
	if (error) return NextResponse.json({ error: error.message }, { status: 500 });

	return NextResponse.json({ success: true });
}
