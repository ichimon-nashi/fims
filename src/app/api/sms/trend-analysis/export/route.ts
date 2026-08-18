// src/app/api/sms/trend-analysis/export/route.ts
//
// Exports the 趨勢分析 tab. Restructured per SMS-analyst review:
//   - 代碼組成分析 now ALWAYS includes both HFACS and EF composition,
//     regardless of which one happens to be toggled on screen — a safety
//     board export shouldn't silently drop one audit programme's codes.
//   - 整體趨勢總覽 puts time back on the x-axis with one line per top-10
//     risk (was briefly x-axis=risks, which was wrong: a line connecting
//     unrelated categories has no meaningful slope).
//   - 風險緩解分析 is now the single home for period-range comparison —
//     merged what used to be a separate "{A} vs {B}區間分析" sheet into
//     it, and dropped the plain period-totals bar chart as redundant next
//     to the stacked source-composition chart (total height there already
//     equals the stacked bar's height, so the second chart added no
//     information, just another sheet to scroll past).
//   - Every wide/tall table gets its chart anchored BELOW the data
//     instead of the old fixed column-G position, which silently
//     overlapped real data on any table wider than ~6 columns.
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { injectChart, ChartSpec } from "@/lib/xlsxNativeCharts";
import ExcelJS from "exceljs";
import JSZip from "jszip";

const SRM_COLOR = "4a9eff";
const SELF_COLOR = "fb923c";
// Top-10 trend line palette — reuses hex values already established
// elsewhere in this app (StatisticsTab category colors, SRM/SELF colors)
// rather than inventing new ones.
const TREND_LINE_COLORS = [
	"4a9eff", "f59e0b", "10b981", "ef4444", "8b5cf6",
	"ec4899", "6366f1", "fb923c", "1baf7a", "e87ba4",
];

interface CodeBucket {
	code: string;
	description: string;
	category: string;
	srm: number;
	self: number;
	total: number;
}

interface PeriodPoint {
	period: string;
	srm: number | null; // null = genuine gap (future period, no data yet)
	self: number | null;
}

interface RangeTotal {
	period: string;
	srm: number;
	self: number;
}

interface CodeComparison {
	code: string;
	description: string;
	a: RangeTotal;
	b: RangeTotal;
}

interface TrendExportPayload {
	hfacsCodes: CodeBucket[];
	efCodes: CodeBucket[];
	trendLabel: string;
	trendGranularityLabel: string; // "月" | "季" | "半年" | "年" — for the 趨勢分析 sheet
	comparisonGranularityLabel: string; // for the 整體趨勢總覽 sheet — independently scoped, not necessarily the same as above
	trendSeries: PeriodPoint[];
	topCodesForTrend: { code: string; description: string }[];
	topCodesTrendSeries: Array<Record<string, string | number | null>>; // one row per period, one key per code
	periodALabel: string | null;
	periodBLabel: string | null;
	topCodesComparison: CodeComparison[];
}

function styleHeaderRow(row: ExcelJS.Row) {
	row.font = { bold: true, color: { argb: "FFFFFFFF" } };
	row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A9EFF" } };
	row.alignment = { vertical: "middle", horizontal: "center" };
}

// Excel worksheet names are capped at 31 characters. With range-based
// period labels this is a common case, not a rare edge case — an
// ellipsis makes the truncation visible rather than looking like a typo.
function safeSheetName(name: string): string {
	return name.length > 31 ? name.slice(0, 30) + "…" : name;
}

function addCompositionSheet(workbook: ExcelJS.Workbook, sheetName: string, codes: CodeBucket[]): ExcelJS.Worksheet {
	const ws = workbook.addWorksheet(sheetName);
	ws.addRow(["代碼", "內容", "分類", "SRM", "自督", "小計"]);
	styleHeaderRow(ws.getRow(1));
	codes.forEach((c) => ws.addRow([c.code, c.description, c.category, c.srm, c.self, c.total]));
	ws.getColumn(1).width = 12;
	ws.getColumn(2).width = 35;
	ws.getColumn(3).width = 30;
	ws.getColumn(4).width = 10;
	ws.getColumn(5).width = 10;
	ws.getColumn(6).width = 10;
	return ws;
}

// Column index (0-based) -> letter, only needs to cover up to ~10 columns
// here (top-10 risks) so no need for double-letter (AA, AB, ...) handling.
function colLetter(index0: number): string {
	return String.fromCharCode("A".charCodeAt(0) + index0);
}

export async function POST(req: NextRequest) {
	const permissions = await checkSMSPermissions(req.headers.get("authorization"));
	if (!permissions.canView) {
		return NextResponse.json(
			{ error: permissions.error || "Access denied: No SMS permissions" },
			{ status: permissions.status || 403 }
		);
	}

	const body: TrendExportPayload = await req.json();
	const {
		hfacsCodes,
		efCodes,
		trendLabel,
		trendGranularityLabel,
		comparisonGranularityLabel,
		trendSeries,
		topCodesForTrend,
		topCodesTrendSeries,
		periodALabel,
		periodBLabel,
		topCodesComparison,
	} = body;

	const workbook = new ExcelJS.Workbook();
	workbook.creator = "SMS Trend Analysis";
	workbook.created = new Date();

	// ---- Sheet 1a/1b: both code taxonomies, always both ----
	addCompositionSheet(workbook, "代碼組成分析(HFACS)", hfacsCodes);
	addCompositionSheet(workbook, "代碼組成分析(EF)", efCodes);

	// ---- Sheet 2: 趨勢分析 — current single-entity selection over time ----
	const ws2 = workbook.addWorksheet("趨勢分析");
	ws2.addRow([`${trendGranularityLabel}份`, "SRM", "自督"]);
	styleHeaderRow(ws2.getRow(1));
	trendSeries.forEach((p) => ws2.addRow([p.period, p.srm, p.self]));
	ws2.getColumn(1).width = 16;
	ws2.getColumn(2).width = 10;
	ws2.getColumn(3).width = 10;

	// ---- Sheet 3: 整體趨勢總覽 — time as rows, one column per top-10 risk ----
	const ws3 = workbook.addWorksheet("整體趨勢總覽");
	ws3.addRow([
		`${comparisonGranularityLabel}份`,
		...topCodesForTrend.map((c) => (c.description ? `${c.code} - ${c.description}` : c.code)),
	]);
	styleHeaderRow(ws3.getRow(1));
	topCodesTrendSeries.forEach((row) => {
		ws3.addRow([row.period, ...topCodesForTrend.map((c) => (row[c.code] as number | null) ?? null)]);
	});
	ws3.getColumn(1).width = 14;
	topCodesForTrend.forEach((_, i) => (ws3.getColumn(i + 2).width = 10));

	// ---- Sheet 4: 風險緩解分析 — detail table (10 cols), chart reads
	// straight from its 小計 columns rather than a separate long-format
	// table (removed — it existed only to feed the old alternating-
	// category chart, and duplicated data already in this table) ----
	if (topCodesComparison.length > 0) {
		const ws4 = workbook.addWorksheet("風險緩解分析");
		ws4.addRow([
			"代碼", "內容",
			`${periodALabel} SRM`, `${periodALabel} 自督`, `${periodALabel} 小計`,
			`${periodBLabel} SRM`, `${periodBLabel} 自督`, `${periodBLabel} 小計`,
			"差異", "變化%",
		]);
		styleHeaderRow(ws4.getRow(1));
		topCodesComparison.forEach((c) => {
			const totalA = c.a.srm + c.a.self;
			const totalB = c.b.srm + c.b.self;
			const diff = totalB - totalA;
			const pct = totalA > 0 ? Math.round((diff / totalA) * 100) : null;
			ws4.addRow([
				c.code, c.description,
				c.a.srm, c.a.self, totalA,
				c.b.srm, c.b.self, totalB,
				diff, pct !== null ? `${pct}%` : "N/A",
			]);
		});
		ws4.getColumn(1).width = 12;
		ws4.getColumn(2).width = 30;
		[3, 4, 5, 6, 7, 8, 9, 10].forEach((i) => (ws4.getColumn(i).width = 12));
	}

	// ---- write base workbook, then inject native charts ----
	const baseBuffer = await workbook.xlsx.writeBuffer();
	const zip = await JSZip.loadAsync(baseBuffer);
	let chartIndex = 1;

	if (hfacsCodes.length > 0) {
		const spec: ChartSpec = {
			type: "bar",
			title: "代碼組成分析 (HFACS)",
			sheetName: "代碼組成分析(HFACS)",
			categories: hfacsCodes.map((c) => c.code),
			series: [
				{ name: "SRM", values: hfacsCodes.map((c) => c.srm), color: SRM_COLOR },
				{ name: "自督", values: hfacsCodes.map((c) => c.self), color: SELF_COLOR },
			],
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["D", "E"],
			categoryAxisTitle: "代碼",
			valueAxisTitle: "件數",
		};
		await injectChart(zip, spec, chartIndex++);
	}

	if (efCodes.length > 0) {
		const spec: ChartSpec = {
			type: "bar",
			title: "代碼組成分析 (EF)",
			sheetName: "代碼組成分析(EF)",
			categories: efCodes.map((c) => c.code),
			series: [
				{ name: "SRM", values: efCodes.map((c) => c.srm), color: SRM_COLOR },
				{ name: "自督", values: efCodes.map((c) => c.self), color: SELF_COLOR },
			],
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["D", "E"],
			categoryAxisTitle: "代碼",
			valueAxisTitle: "件數",
		};
		await injectChart(zip, spec, chartIndex++);
	}

	if (trendSeries.length > 0) {
		const spec: ChartSpec = {
			type: "line",
			title: `趨勢分析 — ${trendLabel}`,
			sheetName: "趨勢分析",
			categories: trendSeries.map((p) => p.period),
			series: [
				{ name: "SRM", values: trendSeries.map((p) => p.srm), color: SRM_COLOR },
				{ name: "自督", values: trendSeries.map((p) => p.self), color: SELF_COLOR },
			],
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["B", "C"],
			categoryAxisTitle: trendGranularityLabel,
			valueAxisTitle: "件數",
		};
		await injectChart(zip, spec, chartIndex++);
	}

	if (topCodesForTrend.length > 0 && topCodesTrendSeries.length > 0) {
		// Table is 1 (period) + N (up to 10) columns wide — wider than the
		// default column-G anchor tolerates once N > 5, so it goes below
		// the data instead in that case.
		const wideTable = topCodesForTrend.length > 5;
		const spec: ChartSpec = {
			type: "line",
			title: "整體趨勢總覽 — 前10大風險趨勢",
			sheetName: "整體趨勢總覽",
			categories: topCodesTrendSeries.map((r) => String(r.period)),
			series: topCodesForTrend.map((c, i) => ({
				name: c.description ? `${c.code} - ${c.description}` : c.code,
				values: topCodesTrendSeries.map((r) => (r[c.code] as number | null) ?? null),
				color: TREND_LINE_COLORS[i % TREND_LINE_COLORS.length],
			})),
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: topCodesForTrend.map((_, i) => colLetter(i + 1)), // B, C, D, ...
			categoryAxisTitle: comparisonGranularityLabel,
			valueAxisTitle: "件數",
			anchorCol: wideTable ? 0 : 6,
			anchorRow: wideTable ? topCodesTrendSeries.length + 3 : 1,
		};
		await injectChart(zip, spec, chartIndex++);
	}

	if (topCodesComparison.length > 0) {
		const spec: ChartSpec = {
			type: "bar",
			title: `風險緩解分析 (${periodALabel} vs ${periodBLabel})`,
			sheetName: "風險緩解分析",
			categories: topCodesComparison.map((c) => c.code),
			series: [
				{ name: String(periodALabel), values: topCodesComparison.map((c) => c.a.srm + c.a.self), color: SRM_COLOR },
				{ name: String(periodBLabel), values: topCodesComparison.map((c) => c.b.srm + c.b.self), color: SELF_COLOR },
			],
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["E", "H"],
			categoryAxisTitle: "代碼",
			valueAxisTitle: "件數",
			anchorCol: 0,
			anchorRow: topCodesComparison.length + 3,
		};
		await injectChart(zip, spec, chartIndex++);
	}

	const finalBuffer = await zip.generateAsync({ type: "nodebuffer" });
	const filename = `趨勢分析_${trendLabel}.xlsx`;

	return new NextResponse(new Uint8Array(finalBuffer), {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			// encodeURIComponent required — raw Chinese characters in a
			// header value throw "Cannot convert to ByteString".
			"Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
		},
	});
}