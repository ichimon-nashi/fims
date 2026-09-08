// src/app/api/audit/routine/self-inspection/[id]/fatigue-upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

const BUCKET = "routine-audit-attachments";

// 附表's three items — fixed item_no per the original seed order
// (疲勞管理×5 + 系統查核×6 + 附表×3 = 14 total, global item_no, not
// display-restarted)
const ITEM_SUFFIX: Record<number, string> = {
	12: "班表",
	13: "到資訊摘要",
	14: "飛時清單",
};

export async function POST(
	req: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;

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

	const formData = await req.formData();
	const file = formData.get("file") as File | null;
	const attachmentId = formData.get("attachment_id") as string | null;
	const itemNoRaw = formData.get("item_no") as string | null;

	if (!file || !attachmentId || !itemNoRaw) {
		return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
	}
	const itemNo = Number(itemNoRaw);
	const suffix = ITEM_SUFFIX[itemNo];
	if (!suffix) {
		return NextResponse.json({ error: "無效的項次" }, { status: 400 });
	}

	// confirm the attachment actually belongs to this form, and get the
	// subject crew member for the filename
	const { data: attachment } = await supabase
		.from("audit_routine_form_attachments")
		.select("id, form_id, subject_crew_name, subject_employee_id")
		.eq("id", attachmentId)
		.eq("form_id", id)
		.single();

	if (!attachment) {
		return NextResponse.json({ error: "找不到對應的附加查核" }, { status: 404 });
	}

	const namePrefix = attachment.subject_employee_id
		? `${attachment.subject_employee_id}${attachment.subject_crew_name}`
		: attachment.subject_crew_name;
	const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
	const displayFilename = `${namePrefix}_${suffix}${ext}`;
	// fixed path per (attachment, item) slot — re-uploading overwrites in
	// place (upsert below) rather than accumulating old versions
	const storagePath = `${id}/${attachmentId}/${itemNo}${ext}`;

	const arrayBuffer = await file.arrayBuffer();
	const { error: uploadError } = await supabase.storage
		.from(BUCKET)
		.upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });

	if (uploadError) {
		return NextResponse.json({ error: uploadError.message }, { status: 500 });
	}

	const { error: dbError } = await supabase
		.from("routine_audit_fatigue_uploads")
		.upsert(
			{
				form_id: id,
				attachment_id: attachmentId,
				item_no: itemNo,
				storage_path: storagePath,
				display_filename: displayFilename,
				original_filename: file.name,
				uploaded_by: userRecord.employee_id,
				uploaded_at: new Date().toISOString(),
			},
			{ onConflict: "attachment_id,item_no" },
		);

	if (dbError) {
		return NextResponse.json({ error: dbError.message }, { status: 500 });
	}

	return NextResponse.json({ display_filename: displayFilename });
}

// lists uploads for a form — used both by the edit UI (show what's
// already uploaded) and the pending-review download-all flow
export async function GET(
	req: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const decoded = await verifyToken(token);
	if (!decoded) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("routine_audit_fatigue_uploads")
		.select("id, attachment_id, item_no, display_filename")
		.eq("form_id", id);

	if (error) return NextResponse.json({ error: error.message }, { status: 500 });
	return NextResponse.json({ uploads: data ?? [] });
}