// src/app/api/audit/routine/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import * as XLSX from "xlsx";

const HEADER_COLS = ["序", "日期", "編號", "查核員", "機號", "班次", "航段", "記錄", "處置", "結果", "SAM分類", "SAM代碼", "非飛安相關"];
const MONTH_TITLE_RE = /^(\d{4})年(\d{1,2})月$/;
const SHEET_RE = /^查核紀錄_\d{4}$/;

interface ParsedRow {
	entry_no: string;
	finding_seq: number;
	audit_date: string;
	report_year: number;
	report_month: number;
	auditor_name: string;
	aircraft_tail: string;
	flight_no: string | null;
	route: string | null;
	finding: string;
	corrective_action: string | null;
	result: "OK" | "NG";
	sam_code_raw: string | null;
	is_non_flight_safety: boolean;
}

function cellText(v: unknown): string {
	if (v === null || v === undefined) return "";
	if (v instanceof Date) return v.toISOString().slice(0, 10);
	return String(v).trim();
}

export async function POST(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const formData = await req.formData();
	const file = formData.get("file");
	if (!file || !(file instanceof File)) {
		return NextResponse.json({ error: "缺少檔案" }, { status: 400 });
	}
	const filename = file.name.toLowerCase();
	if (!filename.endsWith(".xls") && !filename.endsWith(".xlsx")) {
		return NextResponse.json({ error: "僅支援 .xls 或 .xlsx 檔案" }, { status: 400 });
	}

	const supabase = createServiceClient();
	const { data: userRecord } = await supabase
		.from("users")
		.select("employee_id")
		.eq("id", user.userId)
		.single();
	if (!userRecord)
		return NextResponse.json({ error: "User not found" }, { status: 404 });

	const buffer = Buffer.from(await file.arrayBuffer());
	// SheetJS (not ExcelJS) — ExcelJS cannot read legacy binary .xls at all,
	// SheetJS reads both .xls and .xlsx through the same API
	let workbook: XLSX.WorkBook;
	try {
		workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
	} catch {
		return NextResponse.json({ error: "無法讀取檔案，請確認檔案未毀損" }, { status: 400 });
	}

	const { data: samCodes, error: samError } = await supabase
		.from("routine_audit_sam_codes")
		.select("id, code");
	if (samError)
		return NextResponse.json({ error: samError.message }, { status: 500 });
	const codeMap = new Map((samCodes ?? []).map((c) => [c.code.trim().toUpperCase(), c.id]));

	const parsedRows: ParsedRow[] = [];
	const warnings: string[] = [];
	const findingSeqByEntry = new Map<string, number>();

	for (const sheetName of workbook.SheetNames) {
		if (!SHEET_RE.test(sheetName)) continue;
		const sheet = workbook.Sheets[sheetName];
		const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

		let currentYear: number | null = null;
		let currentMonth: number | null = null;
		let inDataBlock = false;

		rows.forEach((row, idx) => {
			const rowNumber = idx + 1;
			const colA = cellText(row[0]);

			const monthMatch = colA.match(MONTH_TITLE_RE);
			if (monthMatch) {
				currentYear = Number(monthMatch[1]);
				currentMonth = Number(monthMatch[2]);
				inDataBlock = false;
				return;
			}

			if (colA === HEADER_COLS[0] && cellText(row[1]) === HEADER_COLS[1]) {
				inDataBlock = true;
				return;
			}

			if (!inDataBlock || currentYear === null || currentMonth === null) return;

			const entryNo = cellText(row[2]);
			const finding = cellText(row[7]);
			if (!entryNo || !finding) return;

			const samCodeRaw = cellText(row[11]).trim();
			const flagRaw = cellText(row[12]).trim().toLowerCase();

			const seq = (findingSeqByEntry.get(entryNo) ?? 0) + 1;
			findingSeqByEntry.set(entryNo, seq);

			if (samCodeRaw && samCodeRaw !== "-" && !codeMap.has(samCodeRaw.toUpperCase())) {
				warnings.push(`第${rowNumber}列 (${entryNo}): SAM代碼 "${samCodeRaw}" 找不到對應項目，已略過代碼`);
			}

			parsedRows.push({
				entry_no: entryNo,
				finding_seq: seq,
				audit_date: cellText(row[1]),
				report_year: currentYear as number,
				report_month: currentMonth as number,
				auditor_name: cellText(row[3]),
				aircraft_tail: cellText(row[4]),
				flight_no: cellText(row[5]) || null,
				route: cellText(row[6]) || null,
				finding,
				corrective_action: cellText(row[8]) || null,
				result: cellText(row[9]) === "NG" ? "NG" : "OK",
				sam_code_raw: samCodeRaw || null,
				is_non_flight_safety: flagRaw === "v",
			});
		});
	}

	if (parsedRows.length === 0) {
		return NextResponse.json(
			{ error: "找不到任何資料列 — 請確認檔案是否為此系統匯出的範本格式", warnings },
			{ status: 400 }
		);
	}

	const upsertPayload = parsedRows.map((r) => ({
		entry_no: r.entry_no,
		finding_seq: r.finding_seq,
		audit_date: r.audit_date,
		report_year: r.report_year,
		report_month: r.report_month,
		auditor_name: r.auditor_name,
		aircraft_tail: r.aircraft_tail,
		flight_no: r.flight_no,
		route: r.route,
		finding: r.finding,
		corrective_action: r.corrective_action,
		result: r.result,
		sam_code_id: r.sam_code_raw && r.sam_code_raw !== "-" ? codeMap.get(r.sam_code_raw.toUpperCase()) ?? null : null,
		is_non_flight_safety: r.is_non_flight_safety,
		created_by: userRecord.employee_id,
	}));

	const { error: insertError } = await supabase
		.from("routine_audit_entries")
		.upsert(upsertPayload, { onConflict: "entry_no,finding_seq" });

	if (insertError)
		return NextResponse.json({ error: insertError.message, warnings }, { status: 500 });

	return NextResponse.json({
		imported: upsertPayload.length,
		warnings,
	});
}