// src/app/api/sms/export-statistics/route.ts
//
// Produces a real .xlsx with native, editable Excel charts (title/legend/
// colors/data all editable in Excel afterward). Built with ExcelJS (data +
// sheets + styling) + a hand-written OOXML chart injector
// (src/lib/xlsxNativeCharts.ts) — office-chart was tried first and hit the
// exact same failure this codebase already abandoned it for once before:
// its template.xlsx asset gets dropped by Next.js's server file-tracing
// for API routes (ENOENT at request time, not build time). This depends
// only on exceljs and jszip, both already proven elsewhere in this
// codebase.
//
// Runs server-side because it writes a real .xlsx buffer; the client
// (StatisticsTab.tsx) POSTs its already-computed aggregates here rather
// than this route re-querying/re-aggregating from Supabase.
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { injectChart, ChartSpec } from "@/lib/xlsxNativeCharts";
import ExcelJS from "exceljs";
import JSZip from "jszip";

// Fixed 7-category palette, one hex per EF category (P/E/C/I/T/O/M) —
// matches the in-app pieSegment colors in StatisticsTab.tsx exactly, so
// the exported pie chart's slice colors correspond to what's on screen.
const CATEGORY_COLORS = ["4a9eff", "f59e0b", "10b981", "ef4444", "8b5cf6", "ec4899", "6366f1"];

interface StatisticsExportPayload {
	year: number;
	activeMonths: string[]; // "YYYY-MM"
	activeCodes: string[];
	efCodeDescriptions: Record<string, string>;
	monthlyStats: Record<string, Record<string, number>>; // code -> month -> count
	yearlyTotals: Record<string, number>; // code -> count
	categoryBreakdown: Record<string, number>; // category name -> count (all 7 categories always present, incl. zero)
	totalCases: number;
	compareYear1: number;
	compareYear2: number;
	comparisonData: {
		year1: Record<string, number>;
		year2: Record<string, number>;
	};
}

function styleHeaderRow(row: ExcelJS.Row) {
	row.font = { bold: true, color: { argb: "FFFFFFFF" } };
	row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A9EFF" } };
	row.alignment = { vertical: "middle", horizontal: "center" };
}

function addBorders(ws: ExcelJS.Worksheet) {
	ws.eachRow((row) => {
		row.eachCell((cell) => {
			cell.border = {
				top: { style: "thin" },
				left: { style: "thin" },
				bottom: { style: "thin" },
				right: { style: "thin" },
			};
		});
	});
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
		year,
		activeMonths,
		activeCodes,
		efCodeDescriptions,
		monthlyStats,
		yearlyTotals,
		categoryBreakdown,
		totalCases,
		compareYear1,
		compareYear2,
		comparisonData,
	} = body;

	const workbook = new ExcelJS.Workbook();
	workbook.creator = "SRM Statistics System";
	workbook.created = new Date();

	// ---- Sheet 1: 月度統計表 — data only, no chart, fully styled ----
	const monthHeaders = activeMonths.map((m) => `${parseInt(m.split("-")[1])}月`);
	const ws1 = workbook.addWorksheet(`${year}年月度統計`);
	ws1.addRow(["項目", "代碼", "內容", ...monthHeaders, "小計"]);
	styleHeaderRow(ws1.getRow(1));

	activeCodes.forEach((code, i) => {
		const monthCounts = activeMonths.map((m) => monthlyStats[code]?.[m] ?? 0);
		const subtotal = monthCounts.reduce((sum, c) => sum + c, 0);
		const row = ws1.addRow([i + 1, code, efCodeDescriptions[code] || code, ...monthCounts, subtotal]);
		row.alignment = { vertical: "middle", horizontal: "center" };
	});

	const monthTotals = activeMonths.map((m) =>
		activeCodes.reduce((sum, code) => sum + (monthlyStats[code]?.[m] ?? 0), 0)
	);
	const ws1TotalRow = ws1.addRow(["", "", "總計", ...monthTotals, totalCases]);
	ws1TotalRow.font = { bold: true, color: { argb: "FF4A9EFF" } };
	ws1TotalRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F2FF" } };
	ws1TotalRow.alignment = { vertical: "middle", horizontal: "center" };

	ws1.getColumn(1).width = 8;
	ws1.getColumn(2).width = 12;
	ws1.getColumn(3).width = 35;
	monthHeaders.forEach((_, i) => (ws1.getColumn(4 + i).width = 8));
	ws1.getColumn(4 + monthHeaders.length).width = 8;
	addBorders(ws1);

	// ---- Sheet 2: EF代碼統計圖 — data + native column chart ----
	const sortedCodes = [...activeCodes].sort((a, b) => (yearlyTotals[b] ?? 0) - (yearlyTotals[a] ?? 0));
	const ws2 = workbook.addWorksheet(`${year}年EF代碼統計`);
	ws2.addRow(["EF代碼", "內容", "件數"]);
	styleHeaderRow(ws2.getRow(1));
	sortedCodes.forEach((code) => {
		ws2.addRow([code, efCodeDescriptions[code] || code, yearlyTotals[code] ?? 0]);
	});
	ws2.getColumn(1).width = 12;
	ws2.getColumn(2).width = 35;
	ws2.getColumn(3).width = 10;

	// ---- Sheet 3: 類別分析 — data + native pie chart ----
	const categoryNames = Object.keys(categoryBreakdown);
	const ws3 = workbook.addWorksheet(`${year}年類別分析`);
	ws3.addRow(["類別", "件數", "百分比"]);
	styleHeaderRow(ws3.getRow(1));
	categoryNames.forEach((name) => {
		const count = categoryBreakdown[name] ?? 0;
		const pct = totalCases > 0 ? ((count / totalCases) * 100).toFixed(1) : "0.0";
		ws3.addRow([name, count, `${pct}%`]);
	});
	ws3.getColumn(1).width = 20;
	ws3.getColumn(2).width = 10;
	ws3.getColumn(3).width = 10;

	// ---- Sheet 4: 年度比較 — data + native clustered column chart ----
	const allComparisonCodes = Array.from(
		new Set([...Object.keys(comparisonData.year1), ...Object.keys(comparisonData.year2)])
	).sort();
	const ws4 = workbook.addWorksheet(`年度比較_${compareYear1}vs${compareYear2}`);
	ws4.addRow(["EF代碼", "內容", `${compareYear1}年`, `${compareYear2}年`, "差異"]);
	styleHeaderRow(ws4.getRow(1));
	allComparisonCodes.forEach((code) => {
		const y1 = comparisonData.year1[code] ?? 0;
		const y2 = comparisonData.year2[code] ?? 0;
		ws4.addRow([code, efCodeDescriptions[code] || code, y1, y2, y1 - y2]);
	});
	ws4.getColumn(1).width = 12;
	ws4.getColumn(2).width = 35;
	ws4.getColumn(3).width = 10;
	ws4.getColumn(4).width = 10;
	ws4.getColumn(5).width = 10;

	// ---- write base workbook, then inject native charts sheet by sheet ----
	const baseBuffer = await workbook.xlsx.writeBuffer();
	const zip = await JSZip.loadAsync(baseBuffer);
	let chartIndex = 1;

	if (sortedCodes.length > 0) {
		const spec: ChartSpec = {
			type: "bar",
			title: `${year}年 EF代碼統計圖`,
			sheetName: `${year}年EF代碼統計`,
			categories: sortedCodes,
			series: [{ name: "件數", values: sortedCodes.map((c) => yearlyTotals[c] ?? 0), color: "4a9eff" }],
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["C"],
			categoryAxisTitle: "EF代碼",
			valueAxisTitle: "件數",
		};
		await injectChart(zip, spec, chartIndex++);
	}

	if (categoryNames.length > 0) {
		const spec: ChartSpec = {
			type: "pie",
			title: `${year}年 類別分析`,
			sheetName: `${year}年類別分析`,
			categories: categoryNames,
			series: [{ name: "件數", values: categoryNames.map((n) => categoryBreakdown[n] ?? 0), color: "4a9eff" }],
			sliceColors: CATEGORY_COLORS,
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["B"],
		};
		await injectChart(zip, spec, chartIndex++);
	}

	if (allComparisonCodes.length > 0) {
		const spec: ChartSpec = {
			type: "bar",
			title: `年度比較 ${compareYear1}年 vs ${compareYear2}年`,
			sheetName: `年度比較_${compareYear1}vs${compareYear2}`,
			categories: allComparisonCodes,
			series: [
				{
					name: `${compareYear1}年`,
					values: allComparisonCodes.map((c) => comparisonData.year1[c] ?? 0),
					color: "4a9eff",
				},
				{
					name: `${compareYear2}年`,
					values: allComparisonCodes.map((c) => comparisonData.year2[c] ?? 0),
					color: "f59e0b",
				},
			],
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["C", "D"],
			categoryAxisTitle: "EF代碼",
			valueAxisTitle: "件數",
		};
		await injectChart(zip, spec, chartIndex++);
	}

	const finalBuffer = await zip.generateAsync({ type: "nodebuffer" });

	const filename = `SRM統計報表_${year}.xlsx`;

	return new NextResponse(finalBuffer, {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
		},
	});
}