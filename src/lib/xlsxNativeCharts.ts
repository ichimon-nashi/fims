// src/lib/xlsxNativeCharts.ts
//
// Hand-built native Excel chart injection. Used after exceljs writes the
// base workbook (data + sheets) — exceljs itself has no chart-writing
// support. office-chart was tried and abandoned (again): its published
// package does contain the template.xlsx it needs, but Next.js's
// server-side file tracing for API routes doesn't pick up a binary asset
// that's loaded via a runtime fs path rather than require()/import, so it
// gets dropped from what actually ships — ENOENT only at request time,
// not at build time. This depends only on exceljs and jszip, both already
// proven dependencies elsewhere in this codebase.
//
// Produces real chart{N}.xml / drawing{N}.xml OOXML parts, wires them
// into the worksheet's relationships + [Content_Types].xml, and inserts
// the <drawing> reference into the worksheet XML — the same structure
// Excel itself writes, so title/legend/colors/data are fully editable in
// Excel afterward.
//
// SCOPE: bar (incl. multi-series clustered) and pie only — the two chart
// types this app currently needs. Extend buildChartXml's dispatch if a
// third type is ever needed; the series/axis-building helpers below are
// written to be reusable for a "line" branch later, following the same
// shape as the bar branch.
//
// NOT verified by actually opening output in Excel — there's no way to do
// that in this environment. XML structure follows ECMA-376 element
// ordering as closely as I can without a validator; if Excel reports the
// file needs repair, the fix is localized to this file, not a black-box
// dependency.

import JSZip from "jszip";
import type { Worksheet } from "exceljs";

export interface ChartSeries {
	name: string;
	values: (number | null)[]; // null = genuine gap (e.g. future period, no data), NOT plotted as zero
	color: string; // hex, no '#', e.g. "4a9eff"
}

export interface ChartSpec {
	type: "bar" | "line" | "pie"; // "bar" = vertical column, matching Excel's own naming for this OOXML chart type
	title: string;
	sheetName: string; // must exactly match the exceljs-added worksheet name
	categories: string[]; // x-axis labels (bar/line) or slice labels (pie)
	series: ChartSeries[]; // pie only ever uses series[0]
	sliceColors?: string[]; // pie only — one color per category, cycled if shorter than categories
	categoryAxisTitle?: string; // bar/line only
	valueAxisTitle?: string; // bar/line only
	stacked?: boolean; // bar only — stacked instead of clustered, default false
	showPercentOnPie?: boolean; // pie only, default true
	// cell locations backing this chart — must match what was actually
	// written to the sheet via exceljs, since the chart's <c:f> formulas
	// reference these cells directly
	categoryColumn: string; // e.g. "A"
	firstDataRow: number; // 1-indexed row where categories/values start (row 1 is usually the header)
	seriesColumns: string[]; // one column letter per series, e.g. ["C"] or ["C","D"]
	// Chart placement — both default to the original hardcoded position
	// (col G, row 2) for full backward compatibility. Override anchorRow
	// for any table wider than ~6 columns, since the default column
	// position will otherwise sit directly on top of real data — this bit
	// the "風險緩解分析" sheet (10 columns) in production.
	anchorCol?: number; // 0-indexed starting column, default 6 (column G)
	anchorRow?: number; // 0-indexed starting row, default 1 (row 2)
}

function escapeXml(str: string): string {
	return String(str)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

// Excel requires sheet names in formula references to be single-quoted
// whenever they contain anything outside [A-Za-z0-9_.] — always true here
// since every sheet name is Chinese text
function quotedSheetRef(sheetName: string): string {
	return `'${sheetName.replace(/'/g, "''")}'`;
}

function titleXml(text: string): string {
	return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(
		text
	)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
}

function buildBarSeriesXml(spec: ChartSpec, series: ChartSeries, idx: number): string {
	const sheetRef = quotedSheetRef(spec.sheetName);
	const lastRow = spec.firstDataRow + spec.categories.length - 1;
	const col = spec.seriesColumns[idx];
	const nameCell = `${col}${spec.firstDataRow - 1}`; // header row, one above the data
	const valRange = `${col}$${spec.firstDataRow}:${col}$${lastRow}`;
	const catRange = `${spec.categoryColumn}$${spec.firstDataRow}:${spec.categoryColumn}$${lastRow}`;

	const catPts = spec.categories
		.map((c, i) => `<c:pt idx="${i}"><c:v>${escapeXml(c)}</c:v></c:pt>`)
		.join("");
	const valPts = series.values
		.map((v, i) => (v === null ? "" : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`))
		.join("");

	const spPr =
		spec.type === "line"
			? `<c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="${series.color}"/></a:solidFill></a:ln></c:spPr>
				<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${series.color}"/></a:solidFill></c:spPr></c:marker>`
			: `<c:spPr><a:solidFill><a:srgbClr val="${series.color}"/></a:solidFill></c:spPr>`;

	return `
		<c:ser>
			<c:idx val="${idx}"/>
			<c:order val="${idx}"/>
			<c:tx><c:strRef><c:f>${sheetRef}!$${nameCell.charAt(0)}$${nameCell.slice(1)}</c:f>
				<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(series.name)}</c:v></c:pt></c:strCache>
			</c:strRef></c:tx>
			${spPr}
			<c:dLbls>
				<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/>
				<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>
			</c:dLbls>
			<c:cat><c:strRef><c:f>${sheetRef}!$${catRange}</c:f>
				<c:strCache><c:ptCount val="${spec.categories.length}"/>${catPts}</c:strCache>
			</c:strRef></c:cat>
			<c:val><c:numRef><c:f>${sheetRef}!$${valRange}</c:f>
				<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${series.values.length}"/>${valPts}</c:numCache>
			</c:numRef></c:val>
		</c:ser>`;
}

function buildBarOrLineChartXml(spec: ChartSpec): string {
	const seriesXml = spec.series.map((s, i) => buildBarSeriesXml(spec, s, i)).join("");
	const axId1 = 111111111;
	const axId2 = 222222222;

	const chartBody =
		spec.type === "line"
			? `<c:lineChart>
					<c:grouping val="standard"/>
					<c:varyColors val="0"/>
					${seriesXml}
					<c:marker val="1"/>
					<c:axId val="${axId1}"/>
					<c:axId val="${axId2}"/>
				</c:lineChart>`
			: `<c:barChart>
					<c:barDir val="col"/>
					<c:grouping val="${spec.stacked ? "stacked" : "clustered"}"/>
					<c:varyColors val="0"/>
					${seriesXml}
					${spec.stacked ? '<c:overlap val="100"/>' : ""}
					<c:axId val="${axId1}"/>
					<c:axId val="${axId2}"/>
				</c:barChart>`;

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
	<c:chart>
		${titleXml(spec.title)}
		<c:autoTitleDeleted val="0"/>
		<c:plotArea>
			<c:layout/>
			${chartBody}
			<c:catAx>
				<c:axId val="${axId1}"/>
				<c:scaling><c:orientation val="minMax"/></c:scaling>
				<c:delete val="0"/>
				<c:axPos val="b"/>
				${spec.categoryAxisTitle ? titleXml(spec.categoryAxisTitle) : ""}
				<c:crossAx val="${axId2}"/>
			</c:catAx>
			<c:valAx>
				<c:axId val="${axId2}"/>
				<c:scaling><c:orientation val="minMax"/></c:scaling>
				<c:delete val="0"/>
				<c:axPos val="l"/>
				${spec.valueAxisTitle ? titleXml(spec.valueAxisTitle) : ""}
				<c:crossAx val="${axId1}"/>
			</c:valAx>
		</c:plotArea>
		<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
		<c:plotVisOnly val="1"/>
		<c:dispBlanksAs val="gap"/>
	</c:chart>
</c:chartSpace>`;
}

function buildPieChartXml(spec: ChartSpec): string {
	const sheetRef = quotedSheetRef(spec.sheetName);
	const lastRow = spec.firstDataRow + spec.categories.length - 1;
	const col = spec.seriesColumns[0];
	const nameCell = `${col}${spec.firstDataRow - 1}`;
	const valRange = `${col}$${spec.firstDataRow}:${col}$${lastRow}`;
	const catRange = `${spec.categoryColumn}$${spec.firstDataRow}:${spec.categoryColumn}$${lastRow}`;
	const series = spec.series[0];
	const colors = spec.sliceColors && spec.sliceColors.length > 0 ? spec.sliceColors : ["4a9eff"];
	const showPercent = spec.showPercentOnPie !== false;

	const catPts = spec.categories
		.map((c, i) => `<c:pt idx="${i}"><c:v>${escapeXml(c)}</c:v></c:pt>`)
		.join("");
	const valPts = series.values
		.map((v, i) => `<c:pt idx="${i}"><c:v>${v ?? 0}</c:v></c:pt>`)
		.join("");
	const dPts = spec.categories
		.map(
			(_, i) =>
				`<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${
					colors[i % colors.length]
				}"/></a:solidFill></c:spPr></c:dPt>`
		)
		.join("");

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
	<c:chart>
		${titleXml(spec.title)}
		<c:autoTitleDeleted val="0"/>
		<c:plotArea>
			<c:layout/>
			<c:pieChart>
				<c:varyColors val="1"/>
				<c:ser>
					<c:idx val="0"/>
					<c:order val="0"/>
					<c:tx><c:strRef><c:f>${sheetRef}!$${nameCell.charAt(0)}$${nameCell.slice(1)}</c:f>
						<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(series.name)}</c:v></c:pt></c:strCache>
					</c:strRef></c:tx>
					${dPts}
					<c:dLbls>
						<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/>
						<c:showSerName val="0"/><c:showPercent val="${showPercent ? "1" : "0"}"/><c:showBubbleSize val="0"/>
					</c:dLbls>
					<c:cat><c:strRef><c:f>${sheetRef}!$${catRange}</c:f>
						<c:strCache><c:ptCount val="${spec.categories.length}"/>${catPts}</c:strCache>
					</c:strRef></c:cat>
					<c:val><c:numRef><c:f>${sheetRef}!$${valRange}</c:f>
						<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${series.values.length}"/>${valPts}</c:numCache>
					</c:numRef></c:val>
				</c:ser>
				<c:firstSliceAng val="0"/>
			</c:pieChart>
		</c:plotArea>
		<c:legend><c:legendPos val="r"/><c:overlay val="0"/></c:legend>
		<c:plotVisOnly val="1"/>
	</c:chart>
</c:chartSpace>`;
}

export function buildChartXml(spec: ChartSpec): string {
	return spec.type === "pie" ? buildPieChartXml(spec) : buildBarOrLineChartXml(spec);
}

function buildDrawingXml(chartRelId: string, fromCol: number = 6, fromRow: number = 1): string {
	const toCol = fromCol + 10;
	const toRow = fromRow + 21;
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
	<xdr:twoCellAnchor>
		<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
		<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
		<xdr:graphicFrame macro="">
			<xdr:nvGraphicFramePr>
				<xdr:cNvPr id="2" name="Chart 1"/>
				<xdr:cNvGraphicFramePr/>
			</xdr:nvGraphicFramePr>
			<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
			<a:graphic>
				<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
					<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${chartRelId}"/>
				</a:graphicData>
			</a:graphic>
		</xdr:graphicFrame>
		<xdr:clientData/>
	</xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function buildDrawingRelsXml(chartFileName: string): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/${chartFileName}"/>
</Relationships>`;
}

// Reads workbook.xml + workbook.xml.rels to resolve a sheet name to its
// actual worksheet part filename — exceljs writes these in insertion
// order in practice, but resolving it properly avoids a subtle bug if
// that ever isn't true
async function resolveSheetPath(zip: JSZip, sheetName: string): Promise<string> {
	const workbookXml = await zip.file("xl/workbook.xml")!.async("string");
	const escapedName = sheetName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const sheetMatch = new RegExp(`<sheet[^>]*name="${escapedName}"[^>]*r:id="([^"]+)"`).exec(workbookXml)
		|| new RegExp(`<sheet[^>]*r:id="([^"]+)"[^>]*name="${escapedName}"`).exec(workbookXml);
	if (!sheetMatch) throw new Error(`Sheet "${sheetName}" not found in workbook.xml`);
	const rId = sheetMatch[1];

	const relsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
	const relMatch = new RegExp(`<Relationship[^>]*Id="${rId}"[^>]*Target="([^"]+)"`).exec(relsXml);
	if (!relMatch) throw new Error(`Relationship "${rId}" not found in workbook.xml.rels`);
	return `xl/${relMatch[1]}`; // targets are stored relative to xl/
}

function nextAvailableRelId(relsXml: string): string {
	const ids = Array.from(relsXml.matchAll(/Id="rId(\d+)"/g)).map((m) => parseInt(m[1], 10));
	const max = ids.length > 0 ? Math.max(...ids) : 0;
	return `rId${max + 1}`;
}

async function addContentTypeOverrides(zip: JSZip, chartFileName: string, drawingFileName: string): Promise<void> {
	const ctPath = "[Content_Types].xml";
	let ctXml = await zip.file(ctPath)!.async("string");
	const overrides = `<Override PartName="/xl/charts/${chartFileName}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/${drawingFileName}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
	ctXml = ctXml.replace("</Types>", `${overrides}</Types>`);
	zip.file(ctPath, ctXml);
}

async function wireDrawingIntoWorksheet(zip: JSZip, sheetPath: string, drawingFileName: string): Promise<void> {
	const sheetFileName = sheetPath.split("/").pop()!;
	const sheetRelsPath = `xl/worksheets/_rels/${sheetFileName}.rels`;

	let relsXml: string;
	const existingRels = zip.file(sheetRelsPath);
	if (existingRels) {
		relsXml = await existingRels.async("string");
	} else {
		relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
	}

	const rId = nextAvailableRelId(relsXml);
	const newRel = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/${drawingFileName}"/>`;
	relsXml = relsXml.replace("</Relationships>", `${newRel}</Relationships>`);
	zip.file(sheetRelsPath, relsXml);

	let sheetXml = await zip.file(sheetPath)!.async("string");
	if (sheetXml.includes("<drawing ")) {
		throw new Error(
			`Sheet "${sheetPath}" already has a <drawing> reference — a worksheet can only reference one drawing part. injectChart was called twice for the same sheet.`
		);
	}
	const drawingTag = `<drawing r:id="${rId}"/>`;
	if (sheetXml.includes("<tableParts")) {
		sheetXml = sheetXml.replace("<tableParts", `${drawingTag}<tableParts`);
	} else if (sheetXml.includes("<extLst")) {
		sheetXml = sheetXml.replace("<extLst", `${drawingTag}<extLst`);
	} else {
		sheetXml = sheetXml.replace("</worksheet>", `${drawingTag}</worksheet>`);
	}
	zip.file(sheetPath, sheetXml);
}

/**
 * Injects one native chart into an already-exceljs-built workbook zip.
 * chartIndex must be unique per call (1, 2, 3, ...) across the whole
 * export. Each sheet may only receive one chart via this function (a
 * worksheet can only carry one <drawing> reference) — throws if called
 * twice for the same sheet.
 */
export async function injectChart(zip: JSZip, spec: ChartSpec, chartIndex: number): Promise<void> {
	const chartFileName = `chart${chartIndex}.xml`;
	const drawingFileName = `drawing${chartIndex}.xml`;

	zip.file(`xl/charts/${chartFileName}`, buildChartXml(spec));
	zip.file(`xl/drawings/${drawingFileName}`, buildDrawingXml("rId1", spec.anchorCol ?? 6, spec.anchorRow ?? 1));
	zip.file(`xl/drawings/_rels/${drawingFileName}.rels`, buildDrawingRelsXml(chartFileName));

	const sheetPath = await resolveSheetPath(zip, spec.sheetName);
	await wireDrawingIntoWorksheet(zip, sheetPath, drawingFileName);
	await addContentTypeOverrides(zip, chartFileName, drawingFileName);
}

export interface ChartPlacement {
	chartIndex: number;
	anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number };
	spec: ChartSpec;
}

function buildMultiDrawingXml(entries: { relId: string; anchor: ChartPlacement["anchor"] }[]): string {
	const anchorsXml = entries
		.map(
			({ relId, anchor }, i) => `
	<xdr:twoCellAnchor>
		<xdr:from><xdr:col>${anchor.fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
		<xdr:to><xdr:col>${anchor.toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${anchor.toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
		<xdr:graphicFrame macro="">
			<xdr:nvGraphicFramePr>
				<xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/>
				<xdr:cNvGraphicFramePr/>
			</xdr:nvGraphicFramePr>
			<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
			<a:graphic>
				<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
					<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${relId}"/>
				</a:graphicData>
			</a:graphic>
		</xdr:graphicFrame>
		<xdr:clientData/>
	</xdr:twoCellAnchor>`
		)
		.join("");

	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchorsXml}
</xdr:wsDr>`;
}

function buildMultiDrawingRelsXml(chartFileNames: string[]): string {
	const rels = chartFileNames
		.map(
			(name, i) =>
				`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/${name}"/>`
		)
		.join("");
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

async function addContentTypeOverridesMulti(zip: JSZip, chartFileNames: string[], drawingFileName: string): Promise<void> {
	const ctPath = "[Content_Types].xml";
	let ctXml = await zip.file(ctPath)!.async("string");
	const chartOverrides = chartFileNames
		.map(
			(name) =>
				`<Override PartName="/xl/charts/${name}" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
		)
		.join("");
	const drawingOverride = `<Override PartName="/xl/drawings/${drawingFileName}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`;
	ctXml = ctXml.replace("</Types>", `${chartOverrides}${drawingOverride}</Types>`);
	zip.file(ctPath, ctXml);
}

/**
 * Injects one or more native charts onto the SAME sheet, all anchored
 * within a single shared drawing part — unlike injectChart (exactly one
 * chart per sheet, throws on a second call), this is for sheets that
 * need multiple charts at once (e.g. routine audit's 代碼統計 sheet:
 * both a SAM bar chart and an EF bar chart on one sheet). Reuses
 * buildChartXml for each placement's actual chart content, so both this
 * and injectChart produce identical, already-verified bar/line/pie/
 * stacked XML — only the drawing/anchor plumbing differs.
 */
export async function injectChartsForSheet(
	zip: JSZip,
	sheetName: string,
	placements: ChartPlacement[],
	drawingIndex: number
): Promise<void> {
	if (placements.length === 0) return;

	const drawingFileName = `drawing${drawingIndex}.xml`;
	const chartFileNames: string[] = [];
	const entries: { relId: string; anchor: ChartPlacement["anchor"] }[] = [];

	placements.forEach((p, i) => {
		const chartFileName = `chart${p.chartIndex}.xml`;
		zip.file(`xl/charts/${chartFileName}`, buildChartXml(p.spec));
		chartFileNames.push(chartFileName);
		entries.push({ relId: `rId${i + 1}`, anchor: p.anchor });
	});

	zip.file(`xl/drawings/${drawingFileName}`, buildMultiDrawingXml(entries));
	zip.file(`xl/drawings/_rels/${drawingFileName}.rels`, buildMultiDrawingRelsXml(chartFileNames));

	const sheetPath = await resolveSheetPath(zip, sheetName);
	await wireDrawingIntoWorksheet(zip, sheetPath, drawingFileName);
	await addContentTypeOverridesMulti(zip, chartFileNames, drawingFileName);
}

/**
 * For a chart shape this injector doesn't build natively (e.g. a true
 * two-level category axis, per-bar conditional coloring, chart types
 * beyond bar/line/pie) — writes a clear "how to build this by hand"
 * remark into the sheet instead of silently omitting the visualization.
 * Call this BEFORE injectChart-ing anything else onto the same sheet if
 * both are used (it just writes cells, no drawing — doesn't conflict with
 * the one-chart-per-sheet limit above).
 */
export function addManualChartNote(
	ws: Worksheet,
	opts: {
		row: number; // first row to write the note at (1-indexed)
		col: number; // first column (1-indexed) — pick one well clear of the actual data table
		dataRange: string; // e.g. "A1:C11" — exact range to select in Excel
		chartTypeLabel: string; // e.g. "堆疊直條圖 (Stacked Column)" — Excel's own menu name
		tooltipTip?: string; // optional: how to enable data labels/tooltips manually
	}
): void {
	const { row, col, dataRange, chartTypeLabel, tooltipTip } = opts;
	const noteCell = ws.getCell(row, col);
	noteCell.value = "⚠ 此圖表類型無法自動產生，請依下列步驟手動建立：";
	noteCell.font = { bold: true, color: { argb: "FFEF4444" } };

	ws.getCell(row + 1, col).value = `1. 選取儲存格範圍 ${dataRange}`;
	ws.getCell(row + 2, col).value = `2. 插入 → 圖表 → ${chartTypeLabel}`;
	if (tooltipTip) {
		ws.getCell(row + 3, col).value = `3. 顯示數值標籤/提示：${tooltipTip}`;
	}
}