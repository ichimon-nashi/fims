// src/app/api/audit/routine/export/route.ts
//
// Produces a real .xlsx with native, editable Excel charts (title/legend/
// colors all editable in Excel afterward). Built with exceljs (data +
// sheets + styling) + a hand-written OOXML chart injector
// (src/lib/xlsxNativeCharts.ts) rather than a third-party chart library —
// two were tried first and didn't hold up: office-chart's published
// package is missing a required internal asset, and exceljs itself has no
// chart-writing support at all. This depends only on exceljs and jszip,
// both already proven elsewhere in this codebase.
//
// Native XLSX charts don't support horizontal bar the way the in-app
// SAM/EF breakdown charts render — so the combined 代碼統計 sheet uses
// vertical column charts. Same data, different orientation, not a bug.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { SAM_CODE_MAP, EF_CODE_MAP } from "@/lib/routineAudit.constants";
import { injectChartsForSheet, ChartPlacement } from "@/lib/xlsxNativeCharts";
import { isB738 } from "@/utils/routineAuditHelpers";
import ExcelJS from "exceljs";
import JSZip from "jszip";

const MONTH_LABELS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const PIE_COLORS = ["4a9eff", "fb923c", "1baf7a", "e87ba4", "eda100", "6b7280"];

// single year -> "2026年"; comparison -> "2025vs2026" (matches the sheet
// naming convention requested, no "年" suffix when comparing two years)
function yearsLabel(years: number[]): string {
	return years.length === 1 ? `${years[0]}年` : years.join("vs");
}

// ---- styling constants ----
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A9EFF" } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: "FFFFFFFF" } };
const MONTH_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3651" } };
const MONTH_FONT: Partial<ExcelJS.Font> = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
const THIN = { style: "thin" as const, color: { argb: "FFD0D0D0" } };
const CELL_BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const CENTER: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "center", wrapText: true };
const MIDDLE_LEFT: Partial<ExcelJS.Alignment> = { vertical: "middle", horizontal: "left", wrapText: true };
const MIDDLE: Partial<ExcelJS.Alignment> = { vertical: "middle" };
const EMPTY_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
const B738_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3B8" } };

const DATA_HEADER = ["序", "編號", "日期", "查核員", "機號", "班次", "航段", "記錄", "處置", "SAM代碼", "EF代碼", "非安全相關", "特殊標記"];
const MERGE_COLS = [1, 2, 3, 4, 5, 6, 7, 13]; // shared per-audit fields (incl. 序) — merged vertically across a multi-finding group
const GRAY_IF_EMPTY_COLS = [10, 11, 12, 13]; // SAM代碼, EF代碼, 非安全相關, 特殊標記
const CENTER_ALIGN_COLS = [10, 11, 12]; // SAM代碼, EF代碼, 非安全相關 — 特殊標記(13) is already centered via MERGE_COLS
const TAIL_COL = 5; // 機號
const COL_WIDTHS = [6, 10, 12, 10, 10, 10, 12, 40, 28, 12, 12, 11, 16];

export async function GET(req: NextRequest) {
	const token = req.headers.get("authorization")?.replace("Bearer ", "");
	if (!token)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const user = await verifyToken(token);
	if (!user)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { searchParams } = new URL(req.url);
	const yearsParam = searchParams.get("years");
	const monthFrom = Number(searchParams.get("month_from") ?? 1);
	const monthTo = Number(searchParams.get("month_to") ?? 12);

	if (!yearsParam)
		return NextResponse.json({ error: "years is required" }, { status: 400 });
	const years = yearsParam.split(",").map(Number).sort((a, b) => a - b);

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("routine_audit_entries")
		.select("*")
		.in("report_year", years)
		.gte("report_month", monthFrom)
		.lte("report_month", monthTo)
		.order("report_month", { ascending: true })
		.order("audit_date", { ascending: true })
		.order("entry_no", { ascending: true });

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });

	const rows = data ?? [];

	// ---- aggregate for the charts — year-aware throughout, since a
	// comparison export needs per-year breakdowns, not one combined total
	// silently merging both years (which is what byCategory/byEfMiddle used
	// to do before this — a real bug, not just a chart-type preference) ----
	const byCategory: Record<string, Record<number, number>> = {}; // category -> year -> count
	const byEfMiddle: Record<string, Record<number, number>> = {}; // EF attribute -> year -> count
	const byCode: Record<string, Record<number, number>> = {}; // SAM code -> year -> count
	const byEfCode: Record<string, Record<number, number>> = {}; // EF code -> year -> count
	const byMonth: Record<number, Record<number, number>> = {};

	for (const row of rows) {
		if (row.is_non_flight_safety) continue;
		const resolved = row.sam_code ? SAM_CODE_MAP[row.sam_code] : undefined;
		if (resolved) {
			byCategory[resolved.category] ??= {};
			byCategory[resolved.category][row.report_year] = (byCategory[resolved.category][row.report_year] ?? 0) + 1;
			byCode[resolved.code] ??= {};
			byCode[resolved.code][row.report_year] = (byCode[resolved.code][row.report_year] ?? 0) + 1;
		}
		if (row.ef_code) {
			const efResolved = EF_CODE_MAP[row.ef_code];
			if (efResolved) {
				byEfMiddle[efResolved.attributeName] ??= {};
				byEfMiddle[efResolved.attributeName][row.report_year] = (byEfMiddle[efResolved.attributeName][row.report_year] ?? 0) + 1;
			}
			byEfCode[row.ef_code] ??= {};
			byEfCode[row.ef_code][row.report_year] = (byEfCode[row.ef_code][row.report_year] ?? 0) + 1;
		}
		byMonth[row.report_year] ??= {};
		byMonth[row.report_year][row.report_month] = (byMonth[row.report_year][row.report_month] ?? 0) + 1;
	}

	function buildYearBreakdown(byLabelYear: Record<string, Record<number, number>>) {
		return Object.entries(byLabelYear)
			.map(([label, byYear]) => ({
				label,
				perYear: years.map((y) => byYear[y] ?? 0),
				total: years.reduce((sum, y) => sum + (byYear[y] ?? 0), 0),
			}))
			.filter((e) => e.total > 0)
			.sort((a, b) => b.total - a.total);
	}
	// 代碼統計's overview stays a combined total across whichever years are
	// selected — it's a general-purpose overview, not a comparison; the
	// dedicated comparison sheets below are where the per-year breakdown lives
	const samBreakdown = buildYearBreakdown(byCategory);
	const efBreakdown = buildYearBreakdown(byEfMiddle);
	const samCodeBreakdown = buildYearBreakdown(byCode);
	const efCodeBreakdown = buildYearBreakdown(byEfCode);
	const samEntries: [string, number][] = samBreakdown.map((e) => [e.label, e.total]);
	const efEntries: [string, number][] = efBreakdown.map((e) => [e.label, e.total]);

	const isComparison = years.length > 1;

	const workbook = new ExcelJS.Workbook();
	const allPlacements: { sheetName: string; placements: ChartPlacement[] }[] = [];
	let nextChartIndex = 1;

	// ==== sheet 1: 查核紀錄 — grouped by month, merged cells per audit ====
	const dataSheet = workbook.addWorksheet("查核紀錄");
	dataSheet.columns = COL_WIDTHS.map((width) => ({ width }));

	// bucket rows by month, then by entry_no, preserving the DB's sort order
	const byMonthGroups = new Map<number, Map<string, typeof rows>>();
	for (const r of rows) {
		if (!byMonthGroups.has(r.report_month)) byMonthGroups.set(r.report_month, new Map());
		const monthMap = byMonthGroups.get(r.report_month)!;
		if (!monthMap.has(r.entry_no)) monthMap.set(r.entry_no, []);
		monthMap.get(r.entry_no)!.push(r);
	}

	let currentRow = 1;
	for (const month of Array.from(byMonthGroups.keys()).sort((a, b) => a - b)) {
		// month title row, merged across all columns
		dataSheet.mergeCells(currentRow, 1, currentRow, DATA_HEADER.length);
		const titleCell = dataSheet.getCell(currentRow, 1);
		titleCell.value = `${month}月`;
		titleCell.fill = MONTH_FILL;
		titleCell.font = MONTH_FONT;
		titleCell.alignment = CENTER;
		dataSheet.getRow(currentRow).height = 22;
		currentRow++;

		// column header row
		DATA_HEADER.forEach((label, i) => {
			const cell = dataSheet.getCell(currentRow, i + 1);
			cell.value = label;
			cell.fill = HEADER_FILL;
			cell.font = HEADER_FONT;
			cell.alignment = CENTER;
			cell.border = CELL_BORDER;
		});
		currentRow++;

		// data rows, grouped by entry_no with shared fields merged
		let monthSeq = 1;
		for (const [, findings] of byMonthGroups.get(month)!) {
			const groupStartRow = currentRow;
			const isB738Tail = isB738(findings[0].aircraft_tail);
			for (const f of findings) {
				const values = [
					monthSeq, f.entry_no, f.audit_date, f.auditor_name, f.aircraft_tail, f.flight_no ?? "", f.route ?? "",
					f.finding, f.corrective_action ?? "", f.sam_code ?? "", f.ef_code ?? "",
					f.is_non_flight_safety ? "v" : "", (f.special_remarks ?? []).join(", "),
				];
				values.forEach((v, i) => {
					const col = i + 1;
					const cell = dataSheet.getCell(currentRow, col);
					// merged columns only get a value on the group's first row —
					// writing into a cell that's about to be merged away is
					// harmless, but leaving it empty is clearer intent
					if (MERGE_COLS.includes(col) && currentRow !== groupStartRow) return;
					cell.value = v;
					cell.border = CELL_BORDER;
					cell.alignment = (MERGE_COLS.includes(col) || CENTER_ALIGN_COLS.includes(col)) ? CENTER : MIDDLE_LEFT;
					if (GRAY_IF_EMPTY_COLS.includes(col) && !v) cell.fill = EMPTY_FILL;
					if (col === TAIL_COL && isB738Tail) cell.fill = B738_FILL;
				});
				currentRow++;
			}
			monthSeq++;
			const groupEndRow = currentRow - 1;
			if (groupEndRow > groupStartRow) {
				// multiple findings under one audit — merge the shared fields so
				// it reads as one audit, not several, matching the same
				// convention as the original import template
				for (const col of MERGE_COLS) {
					dataSheet.mergeCells(groupStartRow, col, groupEndRow, col);
				}
			}
		}
		currentRow++; // blank spacer row between months
	}

	// ==== sheet 2: 代碼統計 — SAM + EF tables and bar charts, one sheet ====
	if (samEntries.length > 0 || efEntries.length > 0) {
		const codeSheet = workbook.addWorksheet("代碼統計");
		codeSheet.columns = [{ width: 24 }, { width: 10 }];
		const placements: ChartPlacement[] = [];
		let cursorRow = 1;

		if (samEntries.length > 0) {
			codeSheet.getCell(cursorRow, 1).value = "類別";
			codeSheet.getCell(cursorRow, 2).value = "數量";
			[1, 2].forEach((c) => {
				const cell = codeSheet.getCell(cursorRow, c);
				cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = CENTER; cell.border = CELL_BORDER;
			});
			const samFirstDataRow = cursorRow + 1;
			samEntries.forEach(([label, count], i) => {
				const r = samFirstDataRow + i;
				codeSheet.getCell(r, 1).value = label;
				codeSheet.getCell(r, 2).value = count;
				codeSheet.getCell(r, 1).border = CELL_BORDER;
				codeSheet.getCell(r, 2).border = CELL_BORDER;
				codeSheet.getCell(r, 1).alignment = MIDDLE;
				codeSheet.getCell(r, 2).alignment = MIDDLE;
			});
			placements.push({
				chartIndex: nextChartIndex++,
				anchor: { fromCol: 3, fromRow: cursorRow - 1, toCol: 13, toRow: cursorRow - 1 + Math.max(20, samEntries.length + 2) },
				spec: {
					type: "bar",
					title: "SAM分類統計",
					sheetName: "代碼統計",
					categories: samEntries.map(([l]) => l),
					series: [{ name: "數量", values: samEntries.map(([, c]) => c), color: "4a9eff" }],
					categoryColumn: "A",
					firstDataRow: samFirstDataRow,
					seriesColumns: ["B"],
				},
			});
			cursorRow = samFirstDataRow + samEntries.length + 3; // gap before EF section
		}

		if (efEntries.length > 0) {
			codeSheet.getCell(cursorRow, 1).value = "屬性";
			codeSheet.getCell(cursorRow, 2).value = "數量";
			[1, 2].forEach((c) => {
				const cell = codeSheet.getCell(cursorRow, c);
				cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = CENTER; cell.border = CELL_BORDER;
			});
			const efFirstDataRow = cursorRow + 1;
			efEntries.forEach(([label, count], i) => {
				const r = efFirstDataRow + i;
				codeSheet.getCell(r, 1).value = label;
				codeSheet.getCell(r, 2).value = count;
				codeSheet.getCell(r, 1).border = CELL_BORDER;
				codeSheet.getCell(r, 2).border = CELL_BORDER;
				codeSheet.getCell(r, 1).alignment = MIDDLE;
				codeSheet.getCell(r, 2).alignment = MIDDLE;
			});
			placements.push({
				chartIndex: nextChartIndex++,
				anchor: { fromCol: 3, fromRow: cursorRow - 1, toCol: 13, toRow: cursorRow - 1 + Math.max(20, efEntries.length + 2) },
				spec: {
					type: "bar",
					title: "EF屬性統計",
					sheetName: "代碼統計",
					categories: efEntries.map(([l]) => l),
					series: [{ name: "數量", values: efEntries.map(([, c]) => c), color: "1baf7a" }],
					categoryColumn: "A",
					firstDataRow: efFirstDataRow,
					seriesColumns: ["B"],
				},
			});
		}

		allPlacements.push({ sheetName: "代碼統計", placements });
	}

	// ==== sheets 3+4: {year}SAM分類統計 / {year}EF屬性統計 ====
	// Single year -> pie, matching the app's pie mode. Comparing years ->
	// grouped bar (one bar per year, per category) instead — a pie can only
	// ever show one year's proportions, it has no way to show change
	// between years, which is the whole point of a comparison export.
	const BAR_COMPARE_COLORS = ["4a9eff", "fb923c"];
	function addCategoryStatsSheet(
		sheetName: string,
		headerLabel: string,
		breakdown: { label: string; perYear: number[]; total: number }[],
		pieColor: string
	) {
		if (breakdown.length === 0) return;
		const sheet = workbook.addWorksheet(sheetName);
		sheet.columns = [{ width: 24 }, ...years.map(() => ({ width: 10 }))];

		const headerRow = [headerLabel, ...years.map(String)];
		headerRow.forEach((label, i) => {
			const cell = sheet.getCell(1, i + 1);
			cell.value = label; cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = CENTER; cell.border = CELL_BORDER;
		});
		breakdown.forEach((entry, i) => {
			const r = i + 2;
			sheet.getCell(r, 1).value = entry.label;
			sheet.getCell(r, 1).border = CELL_BORDER;
			sheet.getCell(r, 1).alignment = MIDDLE;
			entry.perYear.forEach((v, yi) => {
				const cell = sheet.getCell(r, yi + 2);
				cell.value = v;
				cell.border = CELL_BORDER;
				cell.alignment = MIDDLE;
			});
		});

		const anchorFromCol = years.length + 2;
		const spec: ChartPlacement["spec"] = isComparison
			? {
					type: "bar",
					title: sheetName,
					sheetName,
					categories: breakdown.map((e) => e.label),
					series: years.map((y, yi) => ({
						name: String(y),
						values: breakdown.map((e) => e.perYear[yi]),
						color: BAR_COMPARE_COLORS[yi % BAR_COMPARE_COLORS.length],
					})),
					categoryColumn: "A",
					firstDataRow: 2,
					seriesColumns: years.map((_, i) => String.fromCharCode("B".charCodeAt(0) + i)),
				}
			: {
					type: "pie",
					title: sheetName,
					sheetName,
					categories: breakdown.map((e) => e.label),
					series: [{ name: "數量", values: breakdown.map((e) => e.total), color: pieColor }],
					sliceColors: PIE_COLORS,
					categoryColumn: "A",
					firstDataRow: 2,
					seriesColumns: ["B"],
				};

		allPlacements.push({
			sheetName,
			placements: [{
				chartIndex: nextChartIndex++,
				anchor: { fromCol: anchorFromCol, fromRow: 0, toCol: anchorFromCol + 11, toRow: Math.max(20, breakdown.length + 2) },
				spec,
			}],
		});
	}

	addCategoryStatsSheet(`${yearsLabel(years)}SAM分類統計`, "類別", samBreakdown, "4a9eff");
	addCategoryStatsSheet(`${yearsLabel(years)}EF屬性統計`, "屬性", efBreakdown, "1baf7a");

	// ==== sheets: SAM代碼比較 / EF代碼比較 — code-level (not category-level)
	// comparison, only meaningful when actually comparing years ====
	if (isComparison) {
		addCategoryStatsSheet(`${yearsLabel(years)}SAM代碼比較`, "代碼", samCodeBreakdown, "4a9eff");
		addCategoryStatsSheet(`${yearsLabel(years)}EF代碼比較`, "代碼", efCodeBreakdown, "1baf7a");
	}

	// ==== sheet 5: 趨勢分析 — line, one series per compared year ====
	const trendSheet = workbook.addWorksheet("趨勢分析");
	trendSheet.columns = [{ width: 10 }, ...years.map(() => ({ width: 10 }))];
	const trendHeader = ["月份", ...years.map(String)];
	trendHeader.forEach((label, i) => {
		const cell = trendSheet.getCell(1, i + 1);
		cell.value = label; cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = CENTER; cell.border = CELL_BORDER;
	});
	const monthLabelsInRange = MONTH_LABELS.slice(monthFrom - 1, monthTo);
	monthLabelsInRange.forEach((label, i) => {
		const month = monthFrom + i;
		const r = i + 2;
		trendSheet.getCell(r, 1).value = label;
		trendSheet.getCell(r, 1).border = CELL_BORDER;
		trendSheet.getCell(r, 1).alignment = MIDDLE;
		years.forEach((y, yi) => {
			const cell = trendSheet.getCell(r, yi + 2);
			cell.value = byMonth[y]?.[month] ?? 0;
			cell.border = CELL_BORDER;
			cell.alignment = MIDDLE;
		});
	});
	const trendColors = ["4a9eff", "fb923c"];
	const trendSeriesColumns = years.map((_, i) => String.fromCharCode("B".charCodeAt(0) + i));
	allPlacements.push({
		sheetName: "趨勢分析",
		placements: [{
			chartIndex: nextChartIndex++,
			anchor: { fromCol: years.length + 2, fromRow: 0, toCol: years.length + 12, toRow: Math.max(20, monthLabelsInRange.length + 2) },
			spec: {
				type: "line",
				title: "趨勢分析",
				sheetName: "趨勢分析",
				categories: monthLabelsInRange,
				series: years.map((y, i) => ({
					name: String(y),
					values: monthLabelsInRange.map((_, mi) => byMonth[y]?.[monthFrom + mi] ?? 0),
					color: trendColors[i % trendColors.length],
				})),
				categoryColumn: "A",
				firstDataRow: 2,
				seriesColumns: trendSeriesColumns,
			},
		}],
	});

	// ---- write base workbook, then inject native charts sheet by sheet ----
	const baseBuffer = await workbook.xlsx.writeBuffer();
	const zip = await JSZip.loadAsync(baseBuffer);
	let drawingIndex = 1;
	for (const { sheetName, placements } of allPlacements) {
		await injectChartsForSheet(zip, sheetName, placements, drawingIndex++);
	}
	const finalBuffer = await zip.generateAsync({ type: "nodebuffer" });

	const today = new Date();
	const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
	const filename = `例行性查核彙整_${dateStr}.xlsx`;

	return new NextResponse(new Uint8Array(finalBuffer), {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"Content-Disposition": `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
		},
	});
}