// src/app/api/sms/crew-reports/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import ExcelJS from "exceljs";
import { getCrewReports, createCrewReport } from "@/lib/smsDatabase";

// AQD Excel column header -> our field name. Only headers we actually
// capture are listed here; anything else in the source file (Reporter
// Department, Confidentiality, Attachments, Occurrence Code, Assigned
// Department, Due Date, Close Date 回覆提報人, Security) is intentionally
// ignored, per the field set already agreed for the manual-entry form.
const HEADER_MAP: Record<string, string> = {
	"AQD Code": "report_code",
	"Occurrence Date": "occurrence_date",
	"Title": "title",
	"Description": "description",
	"Potential Consequence": "potential_consequence",
	"Reporter": "reporter_name",
	"Registered Date": "registered_date",
	"Hazard Type": "hazard_type",
	"Operational Category": "operational_category",
	"Assessment Code": "assessment_code",
	"Synopsis": "action_taken",
	"Closed": "closed_status",
	"A/C": "aircraft",
	"Flight no.": "flight_no",
	"DEP": "departure",
	"ARR": "arrival",
	"Location": "location",
	"Risk Assessment Calculations": "risk_assessment_calculation",
	"Risk Assessment": "risk_assessment",
};

const DATE_FIELDS = new Set(["occurrence_date", "registered_date"]);

function excelDateToISO(value: unknown): string | null {
	if (!value) return null;
	if (value instanceof Date) {
		if (isNaN(value.getTime())) return null;
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === "string") {
		const parsed = new Date(value);
		if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
	}
	return null;
}

// Cell values can be plain strings/numbers, or ExcelJS rich-text objects
// ({ richText: [...] }) / hyperlink objects ({ text, hyperlink }).
function cellText(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "object") {
		const v: any = value;
		if (typeof v.text === "string") return v.text.trim() || null;
		if (Array.isArray(v.richText)) {
			return v.richText.map((r: any) => r.text).join("").trim() || null;
		}
		return null;
	}
	const str = String(value).trim();
	return str || null;
}

export async function POST(req: NextRequest) {
	const permissions = await checkSMSPermissions(req.headers.get("authorization"));
	if (!permissions.canEdit) {
		return NextResponse.json(
			{ error: "Access denied: Edit permission required" },
			{ status: 403 }
		);
	}

	try {
		const formData = await req.formData();
		const file = formData.get("file") as File | null;
		if (!file) {
			return NextResponse.json({ error: "未提供檔案" }, { status: 400 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer as any);

		// Existing report_codes, for dedup — importing the same file (or an
		// overlapping month range) twice shouldn't create duplicate rows.
		const existingReports = await getCrewReports({});
		const existingCodes = new Set(
			existingReports
				.map((r) => (r.report_code || "").trim().toUpperCase())
				.filter(Boolean)
		);

		let imported = 0;
		let skippedDuplicate = 0;
		let skippedNoDate = 0;
		let skippedNoTitle = 0;
		const errors: string[] = [];

		for (const worksheet of workbook.worksheets) {
			const headerRow = worksheet.getRow(1);
			const colIndexToField: Record<number, string> = {};
			headerRow.eachCell((cell, colNumber) => {
				const header = cellText(cell.value);
				if (header && HEADER_MAP[header]) {
					colIndexToField[colNumber] = HEADER_MAP[header];
				}
			});

			// Sheets with none of our known headers aren't data sheets —
			// skip rather than error, since some workbooks include notes/
			// summary sheets alongside the monthly data sheets.
			if (Object.keys(colIndexToField).length === 0) continue;

			for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
				const row = worksheet.getRow(rowNumber);
				if (row.cellCount === 0) continue;

				const record: Record<string, string | null> = {};
				row.eachCell((cell, colNumber) => {
					const field = colIndexToField[colNumber];
					if (!field) return;
					record[field] = DATE_FIELDS.has(field)
						? excelDateToISO(cell.value)
						: cellText(cell.value);
				});

				if (Object.values(record).every((v) => !v)) continue; // blank row

				if (!record.occurrence_date) {
					skippedNoDate++;
					continue;
				}
				if (!record.title) {
					skippedNoTitle++;
					continue;
				}

				const code = record.report_code ? record.report_code.trim().toUpperCase() : "";
				if (code && existingCodes.has(code)) {
					skippedDuplicate++;
					continue;
				}

				const occDate = new Date(record.occurrence_date);

				try {
					await createCrewReport({
						report_code: record.report_code || null,
						report_year: occDate.getFullYear(),
						report_month: occDate.getMonth() + 1,
						title: record.title,
						// AQD occasionally leaves Description blank while Title is
						// populated; falls back to title rather than skip the row,
						// since description is a required field downstream.
						description: record.description || record.title,
						hazard_type: record.hazard_type || null,
						action_taken: record.action_taken || null,
						category_ids: [],
						occurrence_date: record.occurrence_date,
						registered_date: record.registered_date || null,
						aircraft: record.aircraft || null,
						flight_no: record.flight_no || null,
						departure: record.departure || null,
						arrival: record.arrival || null,
						location: record.location || null,
						potential_consequence: record.potential_consequence || null,
						reporter_name: record.reporter_name || null,
						operational_category: record.operational_category || null,
						assessment_code: record.assessment_code || null,
						risk_assessment_calculation: record.risk_assessment_calculation || null,
						risk_assessment: record.risk_assessment || null,
						closed_status: record.closed_status || null,
						created_by: permissions.userId!,
					});
					if (code) existingCodes.add(code); // prevent dupes within this same import run
					imported++;
				} catch (err: any) {
					errors.push(
						`工作表「${worksheet.name}」第 ${rowNumber} 列：${err.message || "匯入失敗"}`
					);
				}
			}
		}

		return NextResponse.json({
			imported,
			skippedDuplicate,
			skippedNoDate,
			skippedNoTitle,
			errors,
		});
	} catch (error: any) {
		console.error("Error importing crew reports:", error);
		return NextResponse.json(
			{ error: error.message || "匯入失敗" },
			{ status: 500 }
		);
	}
}