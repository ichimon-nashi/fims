// src/app/api/audit/iosa/export-cr/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import fs from "fs";
import path from "path";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
);

// Template lives in the repo, keyed by ism_edition so a future edition can be
// added without touching this route — just drop the new file in and add a key.
const TEMPLATE_PATHS: Record<string, string> = {
	"Ed.18 Rev1": path.join(
		process.cwd(),
		"public/templates/Conformance Report-Template-ISM-Ed-18Rev1.xlsx",
	),
};

// CR column letters (1-indexed) — fixed by the IATA template, not configurable.
const COL = {
	SECTION: 1,
	ISARP: 2,
	STD_TEXT: 3,
	LAST_AUDIT_DATE: 4,
	LAST_AUDITOR_NAME: 5,
	DOC_REFS: 6,
	STATUS: 7,
	NONCONFORMITY_DESC: 8,
	ROOT_CAUSE: 9,
	CORRECTIVE_ACTION: 10,
	AA_START: 11, // K = AA1 ... Y = AA15 (11..25)
	AA_OTHER: 26, // Z
};
const CHECK = "ü"; // Wingdings checkmark glyph the template's AA columns expect

// Maps audit_iosa_records.conformance_status (already disambiguated as Finding vs
// Observation by the importer, which reads that distinction directly from the docx's
// per-ISARP checkbox labels) to the CR's 8-value Assessment/Status of Conformity
// dropdown string. Source of the 8 strings: this exact template's AD3:AD10 range.
function mapConformanceStatus(status: string | null): string | null {
	switch (status) {
		case "conformity":
			return "Conformity (Documented and Implemented)";
		case "finding_doc_not_impl":
			return "Finding (Documented, Not Implemented)";
		case "finding_impl_not_doc":
			return "Finding (Not Documented, Implemented)";
		case "finding_not_doc_not_impl":
			return "Finding (Not Documented, Not Implemented)";
		case "obs_doc_not_impl":
			return "Observation (Documented, Not Implemented)";
		case "obs_impl_not_doc":
			return "Observation (Not Documented, Implemented)";
		case "obs_not_doc_not_impl":
			return "Observation (Not Documented, Not Implemented)";
		case "na":
			return "N/A (Not Applicable)";
		default:
			return null; // unknown/unmapped status — leave the cell blank rather than guess
	}
}

export async function GET(req: NextRequest) {
	try {
		const token = extractTokenFromHeader(req.headers.get("authorization"));
		if (!token)
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		verifyToken(token);

		const { searchParams } = req.nextUrl;
		const cycleId = searchParams.get("cycle_id");
		const ismEdition = searchParams.get("ism_edition") || "Ed.18 Rev1";

		if (!cycleId) {
			return NextResponse.json(
				{ error: "cycle_id required" },
				{ status: 400 },
			);
		}

		const templatePath = TEMPLATE_PATHS[ismEdition];
		if (!templatePath) {
			return NextResponse.json(
				{
					error: `No CR template available for ISM edition "${ismEdition}"`,
				},
				{ status: 400 },
			);
		}

		// conformance_status in audit_iosa_records is already disambiguated as Finding
		// vs Observation by the importer (which reads that distinction directly from
		// the docx's per-ISARP checkbox labels) — no isarp_type lookup needed here.
		const { data: records, error: recErr } = await supabase
			.from("audit_iosa_records")
			.select("*")
			.eq("cycle_id", cycleId);
		if (recErr) throw recErr;

		if (!records || records.length === 0) {
			return NextResponse.json(
				{ error: "No audit data found for this cycle yet" },
				{ status: 400 },
			);
		}

		const wb = new ExcelJS.Workbook();
		await wb.xlsx.readFile(templatePath);
		const ws = wb.getWorksheet("Conformance Report");
		if (!ws)
			throw new Error(
				'Template is missing the "Conformance Report" sheet',
			);

		// exceljs reads each of this template's 4 data-validation ranges (AD4:AD9,
		// G2:G918, G920:G925, K2:Y925) and internally expands them into one entry
		// PER CELL. On save it tries to re-coalesce those into ranges but produces
		// overlapping/duplicated sqref values, which Excel's stricter OOXML parser
		// rejects — "repair this file?" on open. Replacing the model with clean,
		// range-level entries before any cell writes avoids the corruption entirely.
		// exceljs's own bundled type definitions have `dataValidations` commented out
		// despite the property existing and working at runtime (confirmed directly
		// against the installed library) — narrow `as any` to work around the gap.
		(ws as any).dataValidations.model = {
			"AD4:AD9": {
				type: "list",
				formulae: ["$C$65385:$C$65390"],
				allowBlank: true,
				showInputMessage: true,
				showErrorMessage: true,
			},
			"G2:G918": {
				type: "list",
				formulae: ["$AD$3:$AD$10"],
				allowBlank: true,
				showInputMessage: true,
				showErrorMessage: true,
			},
			"G920:G925": {
				type: "list",
				formulae: ["$AD$3:$AD$10"],
				allowBlank: true,
				showInputMessage: true,
				showErrorMessage: true,
			},
			"K2:Y925": {
				type: "list",
				formulae: ["$AD$12:$AD$13"],
				allowBlank: true,
				showInputMessage: true,
				showErrorMessage: true,
			},
		};

		// Build isarp_code -> row number map from the template itself (column B),
		// so we never assume row order — we look up exactly where each code lives.
		const rowByCode = new Map<string, number>();
		ws.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return; // header
			const code = row.getCell(COL.ISARP).value;
			if (typeof code === "string" && code.trim())
				rowByCode.set(code.trim(), rowNumber);
		});

		let written = 0;
		let skippedNoRow = 0;

		for (const rec of records) {
			const rowNum = rowByCode.get(rec.isarp_code);
			if (!rowNum) {
				// ISARP code in our data doesn't exist in this template — surface it
				// rather than silently dropping the row, since that would mean an audit
				// result never makes it into the submitted CR.
				skippedNoRow++;
				continue;
			}
			const row = ws.getRow(rowNum);

			if (rec.last_audit_date)
				row.getCell(COL.LAST_AUDIT_DATE).value = new Date(
					rec.last_audit_date,
				);
			if (rec.last_auditor_name)
				row.getCell(COL.LAST_AUDITOR_NAME).value =
					rec.last_auditor_name;
			if (rec.doc_references)
				row.getCell(COL.DOC_REFS).value = rec.doc_references;

			const mappedStatus = mapConformanceStatus(rec.conformance_status);
			if (mappedStatus) row.getCell(COL.STATUS).value = mappedStatus;

			if (rec.nonconformity_desc)
				row.getCell(COL.NONCONFORMITY_DESC).value =
					rec.nonconformity_desc;
			if (rec.root_cause)
				row.getCell(COL.ROOT_CAUSE).value = rec.root_cause;
			if (rec.corrective_action)
				row.getCell(COL.CORRECTIVE_ACTION).value =
					rec.corrective_action;

			const aa = rec.aa_responses as Record<
				string,
				{ completed: boolean; remarks: string }
			> | null;
			if (aa) {
				for (let n = 1; n <= 15; n++) {
					const item = aa[`AA${n}`];
					if (item?.completed)
						row.getCell(COL.AA_START + (n - 1)).value = CHECK;
				}
				if (aa["AA_other"]?.completed)
					row.getCell(COL.AA_OTHER).value = CHECK;
			}

			written++;
		}

		const rawBuffer = await wb.xlsx.writeBuffer();
		const buffer = await restoreLegacyParts(
			Buffer.from(rawBuffer),
			templatePath,
		);

		return new NextResponse(new Uint8Array(buffer), {
			status: 200,
			headers: {
				"Content-Type":
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				"Content-Disposition": `attachment; filename="Conformance Report - ${cycleId}.xlsx"`,
				"X-Rows-Written": String(written),
				"X-Rows-Skipped": String(skippedNoRow),
			},
		});
	} catch (e: any) {
		console.error("[export-cr GET]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}

/**
 * exceljs does a lossy round-trip on this template's "Conformance Report" sheet:
 * it drops the sheet's .rels file (and the VML logo drawing, customProperty, and
 * printerSettings parts it points to), plus the <phoneticPr>, <customProperties>,
 * and <legacyDrawingHF> body elements that reference them. The missing/dangling
 * references make Excel's strict OOXML parser reject the file outright (confirmed
 * via a real "repair this file?" dialog) even though more lenient parsers (LibreOffice,
 * openpyxl) accept it silently. This restores those exact parts from the original,
 * untouched template after exceljs has written its buffer — it does not depend on
 * exceljs's internal sheet-file numbering, since that's resolved dynamically by
 * matching sheetId="1" (Conformance Report) in both the original and exported
 * workbook.xml, rather than assumed to be any particular "sheetN.xml" filename.
 */
async function restoreLegacyParts(
	exportedBuffer: Buffer,
	templatePath: string,
): Promise<Buffer> {
	const exportedZip = await JSZip.loadAsync(exportedBuffer);
	const origZip = await JSZip.loadAsync(fs.readFileSync(templatePath));

	const findSheetPath = async (zip: JSZip) => {
		const workbookXml = await zip.file("xl/workbook.xml")!.async("text");
		const sheetMatch = workbookXml.match(
			/<sheet[^>]*sheetId="1"[^>]*r:id="(rId\d+)"/,
		);
		if (!sheetMatch)
			throw new Error(
				'Could not find sheetId="1" (Conformance Report) in workbook.xml',
			);
		const relsXml = await zip
			.file("xl/_rels/workbook.xml.rels")!
			.async("text");
		const targetMatch = relsXml.match(
			new RegExp(`Id="${sheetMatch[1]}"[^>]*Target="([^"]+)"`),
		);
		if (!targetMatch)
			throw new Error(
				`Could not resolve relationship target for ${sheetMatch[1]}`,
			);
		return "xl/" + targetMatch[1];
	};

	const exportedSheetPath = await findSheetPath(exportedZip);
	const exportedSheetFile = exportedSheetPath.split("/").pop()!;
	const origSheetPath = await findSheetPath(origZip);
	const origSheetFile = origSheetPath.split("/").pop()!;

	const origSheetRelsPath = `xl/worksheets/_rels/${origSheetFile}.rels`;
	const origSheetRelsFile = origZip.file(origSheetRelsPath);
	if (!origSheetRelsFile) {
		// Original sheet has no .rels — nothing to restore, exceljs's output stands as-is.
		return Buffer.from(
			await exportedZip.generateAsync({ type: "nodebuffer" }),
		);
	}

	const origRelsContent = await origSheetRelsFile.async("text");
	exportedZip.file(
		`xl/worksheets/_rels/${exportedSheetFile}.rels`,
		origRelsContent,
	);

	const relTargets = [...origRelsContent.matchAll(/Target="([^"]+)"/g)].map(
		(m) => m[1],
	);
	for (const rel of relTargets) {
		const resolvedPath = new URL(
			rel,
			"https://_/xl/worksheets/",
		).pathname.slice(1);
		const part = origZip.file(resolvedPath);
		if (!part) continue; // referenced part genuinely absent from the template — skip silently
		exportedZip.file(resolvedPath, await part.async("nodebuffer"));
		const partRelsPath = resolvedPath.replace(/([^/]+)$/, "_rels/$1.rels");
		const partRels = origZip.file(partRelsPath);
		if (partRels)
			exportedZip.file(partRelsPath, await partRels.async("nodebuffer"));
	}

	let sheetXml = await exportedZip.file(exportedSheetPath)!.async("text");

	// exceljs writes <dimension ref="A1:AD925"/> — the range of cells it actually
	// wrote to — but the sheet's own <cols> section still declares width/style
	// definitions out to column AV (48), which the ORIGINAL template's dimension
	// also covers. A dimension that's narrower than the cols it sits alongside is
	// an internal inconsistency real Excel's strict parser can reject even though
	// more lenient parsers treat <dimension> as an optional hint. Restore the
	// original template's dimension value rather than trust exceljs's narrower one.
	const origSheetXmlForDim = await origZip.file(origSheetPath)!.async("text");
	const origDimMatch = origSheetXmlForDim.match(
		/<dimension ref="([^"]+)"\/>/,
	);
	if (origDimMatch) {
		sheetXml = sheetXml.replace(
			/<dimension ref="[^"]*"\/>/,
			`<dimension ref="${origDimMatch[1]}"/>`,
		);
	}

	if (!sheetXml.includes("<phoneticPr")) {
		sheetXml = sheetXml.replace(
			/(<autoFilter\b[^>]*\/>)/,
			'$1<phoneticPr fontId="3" type="noConversion"/>',
		);
	}
	if (
		sheetXml.includes("</headerFooter>") &&
		!sheetXml.includes("<customProperties>")
	) {
		sheetXml = sheetXml.replace(
			"</headerFooter>",
			'</headerFooter><customProperties><customPr name="_pios_id" r:id="rId2"/></customProperties><legacyDrawingHF r:id="rId3"/>',
		);
	}
	exportedZip.file(exportedSheetPath, sheetXml);

	let contentTypesXml = await exportedZip
		.file("[Content_Types].xml")!
		.async("text");
	let ctChanged = false;
	if (!contentTypesXml.includes('Extension="bin"')) {
		contentTypesXml = contentTypesXml.replace(
			/(<Types[^>]*>)/,
			'$1<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.printerSettings"/>',
		);
		ctChanged = true;
	}
	if (!contentTypesXml.includes("customProperty6.bin")) {
		contentTypesXml = contentTypesXml.replace(
			"</Types>",
			'<Override PartName="/xl/customProperty6.bin" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.customProperty"/></Types>',
		);
		ctChanged = true;
	}
	if (ctChanged) exportedZip.file("[Content_Types].xml", contentTypesXml);

	return Buffer.from(await exportedZip.generateAsync({ type: "nodebuffer" }));
}
