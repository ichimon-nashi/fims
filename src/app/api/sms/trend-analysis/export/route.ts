// src/app/api/sms/trend-analysis/export/route.ts
//
// Exports the 趨勢分析 tab to a native-chart .xlsx. Same pattern as
// export-statistics/route.ts: client POSTs its already-computed data
// (composition list, current trend selection already rolled up to
// whatever granularity is on screen, period comparison), server builds
// the workbook + charts. No re-querying — this route trusts the client's
// numbers because they're the same numbers the user is looking at on
// screen; re-deriving them here would risk the export silently disagreeing
// with what was actually displayed.
import { NextRequest, NextResponse } from "next/server";
import { checkSMSPermissions } from "@/lib/smsPermissions";
import { injectChart, ChartSpec } from "@/lib/xlsxNativeCharts";
import ExcelJS from "exceljs";
import JSZip from "jszip";

const SRM_COLOR = "4a9eff";
const SELF_COLOR = "fb923c";

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
	srm: number | null; // null = genuine gap (future period, no data yet) — write as blank cell, not 0
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
	type: "hfacs" | "ef";
	trendLabel: string; // e.g. "RM1 — 人力資源不足" or a category/area name
	granularityLabel: string; // "月" | "季" | "半年" | "年"
	codes: CodeBucket[]; // full composition list, not just the on-screen top 10
	trendSeries: PeriodPoint[];
	periodALabel: string | null;
	periodBLabel: string | null;
	topCodesComparison: CodeComparison[]; // top 10 codes, already sorted (most-improved first)
}

function styleHeaderRow(row: ExcelJS.Row) {
	row.font = { bold: true, color: { argb: "FFFFFFFF" } };
	row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4A9EFF" } };
	row.alignment = { vertical: "middle", horizontal: "center" };
}

// Excel worksheet names are capped at 31 characters. With range-based
// period labels (e.g. "2025-01~2025-06") this is now a common case, not
// a rare edge case — a plain slice() produces an ugly mid-word cut, so an
// ellipsis is used instead to make the truncation visible rather than
// looking like a typo.
function safeSheetName(name: string): string {
	return name.length > 31 ? name.slice(0, 30) + "…" : name;
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
	const { type, trendLabel, granularityLabel, codes, trendSeries, periodALabel, periodBLabel, topCodesComparison } = body;

	const workbook = new ExcelJS.Workbook();
	workbook.creator = "SMS Trend Analysis";
	workbook.created = new Date();

	// ---- Sheet 1: 代碼組成分析 — full list, styled table + clustered bar ----
	const ws1 = workbook.addWorksheet("代碼組成分析");
	ws1.addRow(["代碼", "內容", "分類", "SRM", "自督", "小計"]);
	styleHeaderRow(ws1.getRow(1));
	codes.forEach((c) => {
		ws1.addRow([c.code, c.description, c.category, c.srm, c.self, c.total]);
	});
	ws1.getColumn(1).width = 12;
	ws1.getColumn(2).width = 35;
	ws1.getColumn(3).width = 30;
	ws1.getColumn(4).width = 10;
	ws1.getColumn(5).width = 10;
	ws1.getColumn(6).width = 10;

	// ---- Sheet 2: 趨勢分析 — current selection's rolled-up series + line chart ----
	const ws2 = workbook.addWorksheet("趨勢分析");
	ws2.addRow([`${granularityLabel}份`, "SRM", "自督"]);
	styleHeaderRow(ws2.getRow(1));
	trendSeries.forEach((p) => {
		ws2.addRow([p.period, p.srm, p.self]);
	});
	ws2.getColumn(1).width = 16;
	ws2.getColumn(2).width = 10;
	ws2.getColumn(3).width = 10;

	// ---- Sheet 2b: 整體趨勢總覽 — risks as rows, one column per range's
	// combined total — mirrors the on-screen redesign where the overview
	// toggle plots codes on the x-axis with a line per range, not time.
	if (topCodesComparison.length > 0) {
		const ws2b = workbook.addWorksheet("整體趨勢總覽");
		ws2b.addRow(["代碼", "內容", `${periodALabel} 合計`, `${periodBLabel} 合計`]);
		styleHeaderRow(ws2b.getRow(1));
		topCodesComparison.forEach((c) => {
			ws2b.addRow([c.code, c.description, c.a.srm + c.a.self, c.b.srm + c.b.self]);
		});
		ws2b.getColumn(1).width = 12;
		ws2b.getColumn(2).width = 30;
		ws2b.getColumn(3).width = 14;
		ws2b.getColumn(4).width = 14;
	}

	// ---- Sheet 3: 風險緩解分析 — top 10 codes, full A/B/diff table ----
	const mergedSheetName = safeSheetName(`${periodALabel} vs ${periodBLabel}區間分析`);
	if (topCodesComparison.length > 0) {
		const ws3 = workbook.addWorksheet("風險緩解分析");
		ws3.addRow([
			"代碼",
			"內容",
			`${periodALabel} SRM`,
			`${periodALabel} 自督`,
			`${periodALabel} 小計`,
			`${periodBLabel} SRM`,
			`${periodBLabel} 自督`,
			`${periodBLabel} 小計`,
			"差異",
			"變化%",
		]);
		styleHeaderRow(ws3.getRow(1));
		topCodesComparison.forEach((c) => {
			const totalA = c.a.srm + c.a.self;
			const totalB = c.b.srm + c.b.self;
			const diff = totalB - totalA;
			const pct = totalA > 0 ? Math.round((diff / totalA) * 100) : null;
			ws3.addRow([
				c.code,
				c.description,
				c.a.srm,
				c.a.self,
				totalA,
				c.b.srm,
				c.b.self,
				totalB,
				diff,
				pct !== null ? `${pct}%` : "N/A",
			]);
		});
		ws3.getColumn(1).width = 12;
		ws3.getColumn(2).width = 30;
		[3, 4, 5, 6, 7, 8, 9, 10].forEach((i) => (ws3.getColumn(i).width = 12));

		// ---- Merged composition sheet: both periods, one stacked chart.
		// A true "code x period" two-level category axis isn't something
		// this injector builds, so instead each code gets TWO adjacent
		// category slots (one per period) on a single-level axis — same
		// visual result (stacked SRM/自督 bars, period pairs side by side
		// per code), built entirely with the stacked-bar support that's
		// already verified to work.
		const wsMerged = workbook.addWorksheet(mergedSheetName);
		wsMerged.addRow(["代碼", "期間", "SRM", "自督", "小計"]);
		styleHeaderRow(wsMerged.getRow(1));
		topCodesComparison.forEach((c) => {
			wsMerged.addRow([c.code, c.a.period, c.a.srm, c.a.self, c.a.srm + c.a.self]);
			wsMerged.addRow([c.code, c.b.period, c.b.srm, c.b.self, c.b.srm + c.b.self]);
		});
		wsMerged.getColumn(1).width = 12;
		wsMerged.getColumn(2).width = 14;
		wsMerged.getColumn(3).width = 10;
		wsMerged.getColumn(4).width = 10;
		wsMerged.getColumn(5).width = 10;
	}

	// ---- write base workbook, then inject native charts ----
	const baseBuffer = await workbook.xlsx.writeBuffer();
	const zip = await JSZip.loadAsync(baseBuffer);
	let chartIndex = 1;

	if (codes.length > 0) {
		const spec: ChartSpec = {
			type: "bar",
			title: `代碼組成分析 (${type === "hfacs" ? "HFACS" : "EF"})`,
			sheetName: "代碼組成分析",
			categories: codes.map((c) => c.code),
			series: [
				{ name: "SRM", values: codes.map((c) => c.srm), color: SRM_COLOR },
				{ name: "自督", values: codes.map((c) => c.self), color: SELF_COLOR },
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
			categoryAxisTitle: granularityLabel,
			valueAxisTitle: "件數",
		};
		await injectChart(zip, spec, chartIndex++);
	}

	if (topCodesComparison.length > 0) {
		const spec: ChartSpec = {
			type: "line",
			title: "整體趨勢總覽 — 風險比較",
			sheetName: "整體趨勢總覽",
			categories: topCodesComparison.map((c) => c.code),
			series: [
				{
					name: String(periodALabel),
					values: topCodesComparison.map((c) => c.a.srm + c.a.self),
					color: SRM_COLOR,
				},
				{
					name: String(periodBLabel),
					values: topCodesComparison.map((c) => c.b.srm + c.b.self),
					color: SELF_COLOR,
				},
			],
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["C", "D"],
			categoryAxisTitle: "代碼",
			valueAxisTitle: "件數",
		};
		await injectChart(zip, spec, chartIndex++);
	}

	if (topCodesComparison.length > 0) {
		const summarySpec: ChartSpec = {
			type: "bar",
			title: "風險緩解分析 — 期間總數比較",
			sheetName: "風險緩解分析",
			categories: topCodesComparison.map((c) => c.code),
			series: [
				{
					name: String(periodALabel),
					values: topCodesComparison.map((c) => c.a.srm + c.a.self),
					color: SRM_COLOR,
				},
				{
					name: String(periodBLabel),
					values: topCodesComparison.map((c) => c.b.srm + c.b.self),
					color: SELF_COLOR,
				},
			],
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["E", "H"],
			categoryAxisTitle: "代碼",
			valueAxisTitle: "件數",
		};
		await injectChart(zip, summarySpec, chartIndex++);

		// Merged composition chart: category axis alternates code+period
		// (2 rows per code), stacked SRM/自督 — adjacent bars per code are
		// directly comparable, both periods visible in one chart.
		const mergedCategories = topCodesComparison.flatMap((c) => [
			`${c.code} (${c.a.period})`,
			`${c.code} (${c.b.period})`,
		]);
		const mergedSrmValues = topCodesComparison.flatMap((c) => [c.a.srm, c.b.srm]);
		const mergedSelfValues = topCodesComparison.flatMap((c) => [c.a.self, c.b.self]);
		const mergedSpec: ChartSpec = {
			type: "bar",
			title: mergedSheetName,
			sheetName: mergedSheetName,
			categories: mergedCategories,
			series: [
				{ name: "SRM", values: mergedSrmValues, color: SRM_COLOR },
				{ name: "自督", values: mergedSelfValues, color: SELF_COLOR },
			],
			categoryColumn: "A",
			firstDataRow: 2,
			seriesColumns: ["C", "D"],
			stacked: true,
			categoryAxisTitle: "代碼 (期間)",
			valueAxisTitle: "件數",
		};
		await injectChart(zip, mergedSpec, chartIndex++);
	}

	const finalBuffer = await zip.generateAsync({ type: "nodebuffer" });

	const filename = `趨勢分析_${trendLabel}.xlsx`;

	return new NextResponse(new Uint8Array(finalBuffer), {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			// encodeURIComponent is required here — raw Chinese characters in a
			// header value throw "Cannot convert to ByteString" (hit this exact
			// bug on the statistics export route already).
			"Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
		},
	});
}