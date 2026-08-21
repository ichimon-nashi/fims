// src/app/api/sms/export-statistics/route.ts
//
// Produces a real .xlsx with native, editable Excel charts (title/legend/
// colors/data all editable in Excel afterward). Built with ExcelJS (data +
// sheets + styling) + a hand-written OOXML chart injector
// (src/lib/xlsxNativeCharts.ts).
//
// Runs server-side because it writes a real .xlsx buffer; the client
// (StatisticsTab.tsx) POSTs its already-computed aggregates here rather
// than this route re-querying/re-aggregating from Supabase.
//
// Six sheets, always all present regardless of what the user had toggled
// on screen when they clicked export:
//   1. 統計表 — EF table AND HFACS table, both always included
//   2. EF代碼統計 — EF codes + bar chart
//   3. HFACS代碼統計 — HFACS codes + bar chart
//   4. 類別分析 — EF category pie chart, category labels show Chinese
//      name + code e.g. "改變管理(M)" (件數 already shows on the pie
//      slice labels unconditionally — see xlsxNativeCharts.ts's pie
//      builder, this isn't new chart-spec work, just a label string change)
//   5. 年度比較(EF) — comparison table + bar chart, PLUS a 整體趨勢總覽
//      line chart added below it
//   6. 年度比較(HFACS) — same shape as sheet 5, HFACS data
//
// Sheets 5/6 each need TWO charts on one sheet — injectChart throws on a
// second call for the same sheet, so those two specifically use
// injectChartsForSheet instead, with charts explicitly anchored below
// each other with a generous gap (comparison table -> comparison chart
// (10 cols x 21 rows, matching injectChart's own default size) -> trend
// table -> trend chart) to avoid overlapping data or the previous chart.
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { injectChart, injectChartsForSheet, ChartSpec, ChartPlacement } from "@/lib/xlsxNativeCharts";
import ExcelJS from "exceljs";
import JSZip from "jszip";

// Fixed 7-category palette, one hex per EF category (P/E/C/I/T/O/M) —
// matches the in-app pieSegment colors in StatisticsTab.tsx exactly, so
// the exported pie chart's slice colors correspond to what's on screen.
const CATEGORY_COLORS = ["4a9eff", "f59e0b", "10b981", "ef4444", "8b5cf6", "ec4899", "6366f1"];
const TREND_LINE_COLORS = [
	"4a9eff", "f59e0b", "10b981", "ef4444", "8b5cf6",
	"ec4899", "6366f1", "fb923c", "1baf7a", "e87ba4",
];
// Default single-chart footprint (matches xlsxNativeCharts.ts's own
// buildDrawingXml default: fromCol+10, fromRow+21), reused here so
// multi-chart placements on the same sheet are sized consistently with
// every single-chart sheet elsewhere in this file.
const CHART_WIDTH_COLS = 10;
const CHART_HEIGHT_ROWS = 21;

interface TrendOverview {
	periods: string[];
	series: { code: string; description: string; values: (number | null)[] }[];
}

interface ComparisonRow {
	code: string;
	description: string;
	year1Count: number;
	year2Count: number;
}

interface TypeStats {
	activeMonths: string[];
	activeCodes: string[];
	codeDescriptions: Record<string, string>;
	monthlyStats: Record<string, Record<string, number>>;
	yearlyTotals: Record<string, number>;
	totalCases: number;
	categoryBreakdown: Record<string, number>;
	categoryNames?: Record<string, string>; // EF only — code -> Chinese name
}

interface StatisticsExportPayload {
	rangeLabel: string;
	ef: TypeStats;
	hfacs: TypeStats;
	compareYear1: number;
	compareYear2: number;
	efComparisonRows: ComparisonRow[];
	hfacsComparisonRows: ComparisonRow[];
	efTrendOverview: TrendOverview;
	hfacsTrendOverview: TrendOverview;
}

function styleHeaderRow(row: ExcelJS.Row) {
	row.font = { bold: true, color: { argb: "FFFFFFFF" } };
	row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A9EFF" } };
	row.alignment = { vertical: "middle", horizontal: "center" };
}

function addBorders(ws: ExcelJS.Worksheet, fromRow = 1, toRow?: number) {
	const last = toRow ?? ws.rowCount;
	for (let r = fromRow; r <= last; r++) {
		ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
			cell.border = {
				top: { style: "thin" },
				left: { style: "thin" },
				bottom: { style: "thin" },
				right: { style: "thin" },
			};
		});
	}
}

// Column index (0-based) -> letter. Only needs to cover up to ~11 columns
// here (period + up to 10 trend-overview codes), well under 26.
function colLetter(index0: number): string {
	return String.fromCharCode("A".charCodeAt(0) + index0);
}

// Writes one type's (EF or HFACS) monthly table starting at startRow,
// returns the row immediately after the table (for stacking a second
// table below it on the same sheet). Shared by sheet 1's combined EF +
// HFACS layout.
function writeMonthlyTable(
	ws: ExcelJS.Worksheet,
	stats: TypeStats,
	title: string,
	codeHeader: string,
	startRow: number
): number {
	const monthHeaders = stats.activeMonths.map((m) => `${parseInt(m.split("-")[1], 10)}月`);

	const titleRow = ws.getRow(startRow);
	titleRow.getCell(1).value = title;
	titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: "FF4A9EFF" } };
	ws.mergeCells(startRow, 1, startRow, 3 + monthHeaders.length + 1);

	const headerRowIdx = startRow + 1;
	const headerRow = ws.getRow(headerRowIdx);
	headerRow.values = ["項目", codeHeader, "內容", ...monthHeaders, "小計"];
	styleHeaderRow(headerRow);

	let r = headerRowIdx + 1;
	stats.activeCodes.forEach((code, i) => {
		const monthCounts = stats.activeMonths.map((m) => stats.monthlyStats[code]?.[m] ?? 0);
		const subtotal = monthCounts.reduce((sum, c) => sum + c, 0);
		const row = ws.getRow(r);
		row.values = [i + 1, code, stats.codeDescriptions[code] || code, ...monthCounts, subtotal];
		row.alignment = { vertical: "middle", horizontal: "center" };
		r++;
	});

	const monthTotals = stats.activeMonths.map((m) =>
		stats.activeCodes.reduce((sum, code) => sum + (stats.monthlyStats[code]?.[m] ?? 0), 0)
	);
	const totalRow = ws.getRow(r);
	totalRow.values = ["", "", "總計", ...monthTotals, stats.totalCases];
	totalRow.font = { bold: true, color: { argb: "FF4A9EFF" } };
	totalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2FF" } };
	totalRow.alignment = { vertical: "middle", horizontal: "center" };
	r++;

	addBorders(ws, headerRowIdx, r - 1);

	ws.getColumn(1).width = 8;
	ws.getColumn(2).width = 12;
	ws.getColumn(3).width = 35;
	monthHeaders.forEach((_, i) => (ws.getColumn(4 + i).width = 8));
	ws.getColumn(4 + monthHeaders.length).width = 8;

	return r + 2; // one blank row gap before whatever comes next
}

// Writes a code-statistics table (代碼/內容/件數, sorted by count desc)
// starting at row 1 and returns the sorted code list, for both the EF代碼
// 統計 and HFACS代碼統計 sheets. Data only — charts are injected
// separately in the main function body, after the workbook is converted
// to a zip buffer (chart injection can't happen before that point).
function writeCodeStatsSheet(
	workbook: ExcelJS.Workbook,
	sheetName: string,
	stats: TypeStats,
	codeHeader: string
): string[] {
	const sortedCodes = [...stats.activeCodes].sort(
		(a, b) => (stats.yearlyTotals[b] ?? 0) - (stats.yearlyTotals[a] ?? 0)
	);
	const ws = workbook.addWorksheet(sheetName);
	ws.addRow([codeHeader, "內容", "件數"]);
	styleHeaderRow(ws.getRow(1));
	sortedCodes.forEach((code) => {
		ws.addRow([code, stats.codeDescriptions[code] || code, stats.yearlyTotals[code] ?? 0]);
	});
	ws.getColumn(1).width = 12;
	ws.getColumn(2).width = 35;
	ws.getColumn(3).width = 10;
	addBorders(ws);

	return sortedCodes;
}

// Builds the comparison table + 整體趨勢總覽 table (both data only, no
// charts yet — charts are injected together afterward via
// injectChartsForSheet since this sheet needs two) for one type (EF or
// HFACS). Returns the row ranges needed to compute chart anchors.
function writeComparisonSheet(
	workbook: ExcelJS.Workbook,
	sheetName: string,
	rows: ComparisonRow[],
	trend: TrendOverview,
	year1: number,
	year2: number
): {
	ws: ExcelJS.Worksheet;
	comparisonLastRow: number;
	trendHeaderRow: number;
	trendLastRow: number;
} {
	const ws = workbook.addWorksheet(sheetName);

	// ---- comparison table ----
	ws.addRow(["代碼", "內容", `${year1}年`, `${year2}年`, "差異"]);
	styleHeaderRow(ws.getRow(1));
	rows.forEach((r) => {
		ws.addRow([r.code, r.description, r.year1Count, r.year2Count, r.year2Count - r.year1Count]);
	});
	const comparisonLastRow = 1 + rows.length;
	addBorders(ws, 1, comparisonLastRow);
	ws.getColumn(1).width = 12;
	ws.getColumn(2).width = 35;
	ws.getColumn(3).width = 10;
	ws.getColumn(4).width = 10;
	ws.getColumn(5).width = 10;

	// ---- 整體趨勢總覽 table, stacked below where the comparison chart
	// will go (comparison chart occupies comparisonLastRow+2 through
	// +2+CHART_HEIGHT_ROWS) ----
	const trendHeaderRow = comparisonLastRow + 2 + CHART_HEIGHT_ROWS + 3;
	const headerRow = ws.getRow(trendHeaderRow);
	headerRow.values = [
		"期間",
		...trend.series.map((s) => (s.description ? `${s.code} - ${s.description}` : s.code)),
	];
	styleHeaderRow(headerRow);

	trend.periods.forEach((period, i) => {
		const row = ws.getRow(trendHeaderRow + 1 + i);
		row.values = [period, ...trend.series.map((s) => s.values[i])];
	});
	const trendLastRow = trendHeaderRow + trend.periods.length;
	if (trend.periods.length > 0) {
		addBorders(ws, trendHeaderRow, trendLastRow);
	}
	ws.getColumn(1).width = 14;
	trend.series.forEach((_, i) => (ws.getColumn(2 + i).width = 12));

	return { ws, comparisonLastRow, trendHeaderRow, trendLastRow };
}

export async function POST(req: NextRequest) {
	const permissions = await checkSMSPermissions(req.headers.get("authorization"));
	if (!permissions.canView) {
		return NextResponse.json(
			{ error: permissions.error || "Access denied: No SMS permissions" },
			{ status: permissions.status || 403 }
		);
	}

	const body: StatisticsExportPayload = await req.json();
	const {
		rangeLabel,
		ef,
		hfacs,
		compareYear1,
		compareYear2,
		efComparisonRows,
		hfacsComparisonRows,
		efTrendOverview,
		hfacsTrendOverview,
	} = body;

	const workbook = new ExcelJS.Workbook();
	workbook.creator = "SRM Statistics System";
	workbook.created = new Date();

	// ---- Sheet 1: 統計表 — EF table AND HFACS table, always both ----
	const ws1 = workbook.addWorksheet("統計表");
	const afterEf = writeMonthlyTable(ws1, ef, `${rangeLabel} EF統計表`, "EF代碼", 1);
	writeMonthlyTable(ws1, hfacs, `${rangeLabel} HFACS統計表`, "HFACS代碼", afterEf);

	// ---- Sheet 2/3: EF代碼統計 / HFACS代碼統計 — each own bar chart ----
	const efSortedCodes = writeCodeStatsSheet(workbook, "EF代碼統計", ef, "EF代碼");
	const hfacsSortedCodes = writeCodeStatsSheet(workbook, "HFACS代碼統計", hfacs, "HFACS代碼");

	// ---- Sheet 4: 類別分析 — EF only (HFACS has no equivalent fixed
	// category scheme), category label includes the code e.g. "改變管理(M)".
	// 件數 already shows on the pie slice labels unconditionally — see
	// xlsxNativeCharts.ts's pie builder (showVal is hardcoded true), not
	// something this route needs to configure. ----
	const categoryCodes = Object.keys(ef.categoryBreakdown);
	const categoryLabels = categoryCodes.map((code) => {
		const name = ef.categoryNames?.[code] || code;
		return name === code ? code : `${name}(${code})`;
	});
	const ws4 = workbook.addWorksheet("類別分析");
	ws4.addRow(["類別", "件數", "百分比"]);
	styleHeaderRow(ws4.getRow(1));
	categoryCodes.forEach((code, i) => {
		const count = ef.categoryBreakdown[code] ?? 0;
		const pct = ef.totalCases > 0 ? ((count / ef.totalCases) * 100).toFixed(1) : "0.0";
		ws4.addRow([categoryLabels[i], count, `${pct}%`]);
	});
	ws4.getColumn(1).width = 24;
	ws4.getColumn(2).width = 10;
	ws4.getColumn(3).width = 10;
	addBorders(ws4);

	// ---- Sheet 5/6: 年度比較(EF) / 年度比較(HFACS) — comparison table +
	// bar chart, PLUS 整體趨勢總覽 line chart, both charts on one sheet ----
	const efCmp = writeComparisonSheet(workbook, "年度比較(EF)", efComparisonRows, efTrendOverview, compareYear1, compareYear2);
	const hfacsCmp = writeComparisonSheet(
		workbook,
		"年度比較(HFACS)",
		hfacsComparisonRows,
		hfacsTrendOverview,
		compareYear1,
		compareYear2
	);

	// ---- write base workbook, then inject native charts ----
	const baseBuffer = await workbook.xlsx.writeBuffer();
	const zip = await JSZip.loadAsync(baseBuffer);
	let chartIndex = 1;

	if (efSortedCodes.length > 0) {
		await injectChart(
			zip,
			{
				type: "bar",
				title: "EF代碼統計",
				sheetName: "EF代碼統計",
				categories: efSortedCodes,
				series: [{ name: "件數", values: efSortedCodes.map((c) => ef.yearlyTotals[c] ?? 0), color: "4a9eff" }],
				categoryColumn: "A",
				firstDataRow: 2,
				seriesColumns: ["C"],
				categoryAxisTitle: "EF代碼",
				valueAxisTitle: "件數",
			},
			chartIndex++
		);
	}

	if (hfacsSortedCodes.length > 0) {
		await injectChart(
			zip,
			{
				type: "bar",
				title: "HFACS代碼統計",
				sheetName: "HFACS代碼統計",
				categories: hfacsSortedCodes,
				series: [
					{ name: "件數", values: hfacsSortedCodes.map((c) => hfacs.yearlyTotals[c] ?? 0), color: "10b981" },
				],
				categoryColumn: "A",
				firstDataRow: 2,
				seriesColumns: ["C"],
				categoryAxisTitle: "HFACS代碼",
				valueAxisTitle: "件數",
			},
			chartIndex++
		);
	}

	if (categoryCodes.length > 0) {
		await injectChart(
			zip,
			{
				type: "pie",
				title: "類別分析",
				sheetName: "類別分析",
				categories: categoryLabels,
				series: [{ name: "件數", values: categoryCodes.map((c) => ef.categoryBreakdown[c] ?? 0), color: "4a9eff" }],
				sliceColors: CATEGORY_COLORS,
				categoryColumn: "A",
				firstDataRow: 2,
				seriesColumns: ["B"],
			},
			chartIndex++
		);
	}

	// Sheets 5/6 each need two charts — injectChart throws on a second
	// call for the same sheet, so both charts per sheet go through
	// injectChartsForSheet in one call instead.
	for (const [sheetName, cmpRows, trend, cmp] of [
		["年度比較(EF)", efComparisonRows, efTrendOverview, efCmp],
		["年度比較(HFACS)", hfacsComparisonRows, hfacsTrendOverview, hfacsCmp],
	] as const) {
		const placements: ChartPlacement[] = [];

		if (cmpRows.length > 0) {
			placements.push({
				chartIndex: chartIndex++,
				anchor: { fromCol: 0, fromRow: cmp.comparisonLastRow + 1, toCol: CHART_WIDTH_COLS, toRow: cmp.comparisonLastRow + 1 + CHART_HEIGHT_ROWS },
				spec: {
					type: "bar",
					title: `年度比較 ${compareYear1}年 vs ${compareYear2}年`,
					sheetName,
					categories: cmpRows.map((r) => r.code),
					series: [
						{ name: `${compareYear1}年`, values: cmpRows.map((r) => r.year1Count), color: "4a9eff" },
						{ name: `${compareYear2}年`, values: cmpRows.map((r) => r.year2Count), color: "fb923c" },
					],
					categoryColumn: "A",
					firstDataRow: 2,
					seriesColumns: ["C", "D"],
					categoryAxisTitle: "代碼",
					valueAxisTitle: "件數",
				},
			});
		}

		if (trend.periods.length > 0 && trend.series.length > 0) {
			placements.push({
				chartIndex: chartIndex++,
				anchor: {
					fromCol: 0,
					fromRow: cmp.trendLastRow + 1,
					toCol: CHART_WIDTH_COLS,
					toRow: cmp.trendLastRow + 1 + CHART_HEIGHT_ROWS,
				},
				spec: {
					type: "line",
					title: "整體趨勢總覽 — 前10大風險趨勢",
					sheetName,
					categories: trend.periods,
					series: trend.series.map((s, i) => ({
						name: s.description ? `${s.code} - ${s.description}` : s.code,
						values: s.values,
						color: TREND_LINE_COLORS[i % TREND_LINE_COLORS.length],
					})),
					categoryColumn: "A",
					firstDataRow: cmp.trendHeaderRow + 1,
					seriesColumns: trend.series.map((_, i) => colLetter(i + 1)),
					categoryAxisTitle: "期間",
					valueAxisTitle: "件數",
				},
			});
		}

		if (placements.length > 0) {
			await injectChartsForSheet(zip, sheetName, placements, chartIndex);
		}
	}

	const finalBuffer = await zip.generateAsync({ type: "nodebuffer" });

	const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
	const filename = `SRM統計報表_${dateStamp}.xlsx`;

	return new NextResponse(new Uint8Array(finalBuffer), {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
		},
	});
}