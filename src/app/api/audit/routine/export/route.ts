// src/app/api/audit/routine/export/route.ts
//
// Produces a real .xlsx with native, editable Excel charts (title/legend/
// colors all editable in Excel afterward) via office-chart, not images.
// One caveat worth knowing: office-chart's XLSX charts support
// column/line/pie/scatter, not horizontal bar — so the SAM/EF breakdowns
// that render as horizontal bars in-app become column (vertical bar)
// charts here. Same data, different orientation, not a bug.
//
// Uses the confirmed file-write API (generate(path, "file")) rather than
// office-chart's buffer-generation path, since the buffer method's exact
// signature isn't documented anywhere I could verify — writing to a temp
// file and reading it back only depends on the API the README actually
// shows working.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";
import { SAM_CODE_MAP, EF_CODE_MAP } from "@/lib/routineAudit.constants";
import { XlsxGenerator, IData } from "office-chart";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const MONTH_LABELS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

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
	const years = yearsParam.split(",").map(Number);

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from("routine_audit_entries")
		.select("*")
		.in("report_year", years)
		.gte("report_month", monthFrom)
		.lte("report_month", monthTo)
		.order("audit_date", { ascending: true });

	if (error)
		return NextResponse.json({ error: error.message }, { status: 500 });

	const rows = data ?? [];

	// ---- aggregate for the three charts (same logic as summary/route.ts) ----
	const byCategory: Record<string, number> = {};
	const byEfMiddle: Record<string, number> = {};
	const byMonth: Record<number, Record<number, number>> = {};

	for (const row of rows) {
		if (row.is_non_flight_safety) continue;

		const resolved = row.sam_code ? SAM_CODE_MAP[row.sam_code] : undefined;
		if (resolved) byCategory[resolved.category] = (byCategory[resolved.category] ?? 0) + 1;

		if (row.ef_code) {
			const efResolved = EF_CODE_MAP[row.ef_code];
			if (efResolved) byEfMiddle[efResolved.attributeName] = (byEfMiddle[efResolved.attributeName] ?? 0) + 1;
		}

		byMonth[row.report_year] ??= {};
		byMonth[row.report_year][row.report_month] = (byMonth[row.report_year][row.report_month] ?? 0) + 1;
	}

	const gen = new XlsxGenerator();
	await gen.createWorkbook();

	// ---- sheet 1: raw data listing, one row per finding ----
	const dataSheet = await gen.createWorksheet("查核紀錄");
	const dataHeader = [
		"編號", "日期", "查核員", "機號", "班次", "航段",
		"記錄", "處置", "SAM代碼", "EF代碼", "非安全相關", "特殊標記",
	];
	const dataRows = rows.map((r) => [
		r.entry_no,
		r.audit_date,
		r.auditor_name,
		r.aircraft_tail,
		r.flight_no ?? "",
		r.route ?? "",
		r.finding,
		r.corrective_action ?? "",
		r.sam_code ?? "",
		r.ef_code ?? "",
		r.is_non_flight_safety ? "v" : "",
		(r.special_remarks ?? []).join(", "),
	]);
	await dataSheet.addTable([dataHeader, ...dataRows]);

	// ---- sheet 2: SAM 類別 breakdown (column chart — XLSX charts don't
	// support horizontal bar, see note at top of file) ----
	const samEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
	if (samEntries.length > 0) {
		const samSheet = await gen.createWorksheet("SAM分類統計");
		const samTable = [["類別", "數量"], ...samEntries.map(([label, count]) => [label, count])];
		await samSheet.addTable(samTable);
		const samChart: IData = {
			title: { name: "SAM分類統計", color: "4a9eff", size: 2400 },
			range: `B1:B${samTable.length}`,
			type: "column",
			rgbColors: ["4a9eff"],
			labels: true,
		};
		await samSheet.addChart(samChart);
	}

	// ---- sheet 3: EF 屬性 breakdown ----
	const efEntries = Object.entries(byEfMiddle).sort((a, b) => b[1] - a[1]);
	if (efEntries.length > 0) {
		const efSheet = await gen.createWorksheet("EF屬性統計");
		const efTable = [["屬性", "數量"], ...efEntries.map(([label, count]) => [label, count])];
		await efSheet.addTable(efTable);
		const efChart: IData = {
			title: { name: "EF屬性統計", color: "1baf7a", size: 2400 },
			range: `B1:B${efTable.length}`,
			type: "column",
			rgbColors: ["1baf7a"],
			labels: true,
		};
		await efSheet.addChart(efChart);
	}

	// ---- sheet 4: monthly trend, one column per year (multi-series line,
	// matching the office-chart README's own worked example shape) ----
	const trendSheet = await gen.createWorksheet("月度趨勢");
	const trendHeader = ["月份", ...years.map(String)];
	const trendRows = MONTH_LABELS.slice(monthFrom - 1, monthTo).map((label, i) => {
		const month = monthFrom + i;
		return [label, ...years.map((y) => byMonth[y]?.[month] ?? 0)];
	});
	await trendSheet.addTable([trendHeader, ...trendRows]);
	const lastCol = String.fromCharCode("B".charCodeAt(0) + years.length - 1); // B for 1 year, C for 2, etc.
	const trendChart: IData = {
		title: { name: "月度趨勢", color: "4a9eff", size: 2400 },
		range: `B1:${lastCol}${trendRows.length + 1}`,
		type: "line",
		rgbColors: ["4a9eff", "fb923c"],
		labels: true,
		marker: { size: 4, shape: "circle" },
		lineWidth: 20000,
	};
	await trendSheet.addChart(trendChart);

	// ---- write to a temp file, read back as a buffer, clean up ----
	const tmpBase = path.join(os.tmpdir(), `routine-export-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	await gen.generate(tmpBase, "file");
	const tmpFile = `${tmpBase}.xlsx`;
	const buffer = await fs.readFile(tmpFile);
	await fs.unlink(tmpFile).catch(() => {}); // best-effort cleanup — a leftover temp file isn't worth failing the request over

	return new NextResponse(buffer, {
		status: 200,
		headers: {
			"Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"Content-Disposition": `attachment; filename="routine_audit_export_${years.join("-")}.xlsx"`,
		},
	});
}