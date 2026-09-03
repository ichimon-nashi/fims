// src/components/audit/routine/RoutineCharts.tsx
// Bar for code-level (many items, skewed — bar shows that shape clearly),
// pie for category-level (few items, proportion-of-whole is the story).
// Both SAM and EF charts share one level toggle, owned by the parent
// (RoutineSummary), not each chart individually — flipping "類別" switches
// both breakdowns together instead of needing two separate controls.
//
// Compare charts (grouped bar / radar) are a separate family added for
// year-over-year comparison — same level toggle applies, plus a
// bar/radar ChartStyle toggle also owned by the parent.

import { useMemo } from "react";
import styles from "./RoutineCharts.module.css";
import { PieGroupLevel, ChartStyle } from "@/lib/routineAudit.types";

interface CountItem {
	label: string;
	count: number;
}

const PIE_COLORS = ["#4a9eff", "#fb923c", "#1baf7a", "#e87ba4", "#eda100", "#6b7280"];
const OTHER_COLOR = "#6b7280";
const OTHER_LABEL = "其他";
const COMPARE_COLORS = ["#4a9eff", "#fb923c"];

// ============ shared: horizontal bar (code level) ============

// descriptions is optional: code -> plain-language meaning (e.g.
// "I1-13" -> "組員因個人未依標準程序規定作業，造成違反內規"), rendered as
// a small caption under each row so the code isn't the only thing shown
function HorizontalBarChart({
	data,
	color,
	descriptions,
}: {
	data: CountItem[];
	color: string;
	descriptions?: Record<string, string>;
}) {
	const bars = [...data].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);

	if (bars.length === 0) {
		return <p className={styles.empty}>此區間無資料</p>;
	}

	const max = Math.max(...bars.map((b) => b.count));

	return (
		<div className={styles.barChart}>
			{bars.map((b) => {
				const description = descriptions?.[b.label];
				return (
					<div key={b.label} className={styles.barGroup}>
						<div className={styles.barLabelRow} title={description || b.label}>{b.label}</div>
						<div className={styles.barRow}>
							<div className={styles.barTrack}>
								<div
									className={styles.barFill}
									style={{ width: `${(b.count / max) * 100}%`, background: color }}
								/>
							</div>
							<span className={styles.barCount}>{b.count}</span>
						</div>
						{description && <p className={styles.barDescription}>{description}</p>}
					</div>
				);
			})}
		</div>
	);
}

// ============ shared: pie (category level) ============

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
	const rad = ((angleDeg - 90) * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// "安全程序/訓練 (Procedure/Training)" -> "安全程序/訓練 (P)" — display-only
// shortening for pie labels specifically, where the full bilingual EF
// middle-tier name was too long to fit any reasonable viewBox width
// without clipping. Only touches the rendered <text>, not the underlying
// label used for the color map / delta badges / data matching elsewhere.
// SAM labels (plain English, no parenthetical) pass through unchanged.
function shortenParenthetical(label: string): string {
	return label.replace(/\(([A-Za-z])[^)]*\)/, "($1)");
}

// otherLabel lets a caller localize the "everything past top-5" bucket —
// SAM's category pie shows it in English ("Others"), EF's keeps "其他"
function PieChart({ data, otherLabel = OTHER_LABEL }: { data: CountItem[]; otherLabel?: string }) {
	const sorted = [...data].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
	const top5 = sorted.slice(0, 5);
	const rest = sorted.slice(5);
	const otherTotal = rest.reduce((sum, d) => sum + d.count, 0);

	const slices = [...top5];
	if (otherTotal > 0) slices.push({ label: otherLabel, count: otherTotal });
	const total = slices.reduce((sum, s) => sum + s.count, 0);

	if (total === 0) {
		return <p className={styles.empty}>此區間無資料</p>;
	}

	const cx = 150, cy = 140, r = 78, labelR = 128;
	let cumulative = 0;
	const paths = slices.map((slice, i) => {
		const startAngle = (cumulative / total) * 360;
		cumulative += slice.count;
		const endAngle = (cumulative / total) * 360;
		const midAngle = (startAngle + endAngle) / 2;

		const start = polarToCartesian(cx, cy, r, startAngle);
		const end = polarToCartesian(cx, cy, r, endAngle);
		const largeArc = endAngle - startAngle > 180 ? 1 : 0;
		const path = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;

		const labelPoint = polarToCartesian(cx, cy, labelR, midAngle);
		const leaderStart = polarToCartesian(cx, cy, r, midAngle);
		const pct = Math.round((slice.count / total) * 100);
		const isRight = labelPoint.x >= cx;

		return {
			path,
			color: slice.label === otherLabel ? OTHER_COLOR : PIE_COLORS[i % PIE_COLORS.length],
			label: slice.label,
			count: slice.count,
			pct,
			labelPoint,
			leaderStart,
			isRight,
		};
	});

	return (
		<svg viewBox="0 0 420 280" className={styles.svg}>
			{paths.map((s, i) => (
				<path key={i} d={s.path} fill={s.color} stroke="#1a1f35" strokeWidth={1.5} />
			))}
			{paths.map((s, i) => {
				const textX = s.isRight ? s.labelPoint.x + 6 : s.labelPoint.x - 6;
				return (
					<g key={`label-${i}`}>
						<line
							x1={s.leaderStart.x}
							y1={s.leaderStart.y}
							x2={s.labelPoint.x}
							y2={s.labelPoint.y}
							stroke="rgba(232,233,237,0.35)"
							strokeWidth={1}
						/>
						<text
							x={textX}
							y={s.labelPoint.y}
							textAnchor={s.isRight ? "start" : "end"}
							dominantBaseline="middle"
							fill="#e8e9ed"
							fontSize="11"
						>
							{shortenParenthetical(s.label)} ({s.count}, {s.pct}%)
						</text>
					</g>
				);
			})}
		</svg>
	);
}

function BreakdownChart({
	data,
	level,
	color,
	otherLabel,
	descriptions,
	forceBar,
}: {
	data: CountItem[];
	level: PieGroupLevel;
	color: string;
	otherLabel?: string;
	descriptions?: Record<string, string>;
	forceBar?: boolean;
}) {
	return level === "category" && !forceBar ? (
		<PieChart data={data} otherLabel={otherLabel} />
	) : (
		<HorizontalBarChart data={data} color={color} descriptions={descriptions} />
	);
}

// ============ RoutineSamChart ============

export function RoutineSamChart({
	data,
	year,
	level,
	descriptions,
	forceBar,
}: {
	data: CountItem[];
	year: number;
	level: PieGroupLevel;
	descriptions?: Record<string, string>;
	forceBar?: boolean;
}) {
	const label = level === "category" ? "SAM類別" : "SAM代碼";
	return (
		<div className={styles.wrap}>
			<p className={styles.title}>{year} {label} (安全類)</p>
			<BreakdownChart data={data} level={level} color="#4a9eff" otherLabel="Others" descriptions={descriptions} forceBar={forceBar} />
		</div>
	);
}

// ============ RoutineEfChart ============

export function RoutineEfChart({
	data,
	year,
	level,
	descriptions,
	forceBar,
}: {
	data: CountItem[];
	year: number;
	level: PieGroupLevel;
	descriptions?: Record<string, string>;
	forceBar?: boolean;
}) {
	const label = level === "category" ? "EF類別" : "EF代碼";
	return (
		<div className={styles.wrap}>
			<p className={styles.title}>{year} {label} (安全類)</p>
			<BreakdownChart data={data} level={level} color="#1baf7a" descriptions={descriptions} forceBar={forceBar} />
		</div>
	);
}

// ============ category comparison: twin pies + delta badges ============
// Colors must be assigned by category identity, not by position in each
// period's own sorted data — the same category can rank differently (and
// thus get a different color) in period A vs period B. Building one
// shared map from the alphabetically-sorted union of both periods' labels
// keeps a category's color stable regardless of which side has more
// cases. Exact same fix already established in StatisticsTab.tsx for the
// identical problem — replicated here, not reinvented.
function buildStableColorMap(dataA: CountItem[], dataB: CountItem[]): Record<string, string> {
	const names = new Set<string>();
	dataA.forEach((d) => names.add(d.label));
	dataB.forEach((d) => names.add(d.label));
	const sorted = Array.from(names).sort();
	const map: Record<string, string> = {};
	// evenly-spaced hues guarantee every label gets a genuinely distinct
	// color regardless of count — the old PIE_COLORS[i % 6] wrapped after
	// 6 labels, so a 10-code comparison silently gave code #7 the same
	// color as code #1 (confirmed: EV02 and TN01 both rendering green)
	sorted.forEach((name, i) => {
		map[name] = `hsl(${Math.round((i * 360) / sorted.length)}, 65%, 58%)`;
	});
	return map;
}

// one pie, colored from an externally-supplied stable map — no top-5
// truncation (unlike the single-period PieChart above), since this
// operates at the category/area tier where the label count is already
// small, not the long-tail code tier
function ComparePieSvg({ data, colorMap }: { data: CountItem[]; colorMap: Record<string, string> }) {
	const slices = [...data].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
	const total = slices.reduce((sum, s) => sum + s.count, 0);

	if (total === 0) {
		return <p className={styles.empty}>此區間無資料</p>;
	}

	// wider canvas + smaller radius-to-label ratio than the single-period
	// pie above — this view routinely has more, longer (English) category
	// names, which was clipping against the old tighter viewBox and
	// colliding vertically when slice angles were close together
	const cx = 230, cy = 195, r = 95, labelR = 172;
	let cumulative = 0;
	const paths = slices.map((slice) => {
		const startAngle = (cumulative / total) * 360;
		cumulative += slice.count;
		const endAngle = (cumulative / total) * 360;
		const midAngle = (startAngle + endAngle) / 2;

		const start = polarToCartesian(cx, cy, r, startAngle);
		const end = polarToCartesian(cx, cy, r, endAngle);
		const largeArc = endAngle - startAngle > 180 ? 1 : 0;
		const path = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;

		const labelPoint = polarToCartesian(cx, cy, labelR, midAngle);
		const leaderStart = polarToCartesian(cx, cy, r, midAngle);
		const pct = Math.round((slice.count / total) * 100);
		const isRight = labelPoint.x >= cx;

		return {
			path,
			color: colorMap[slice.label] ?? OTHER_COLOR,
			label: slice.label,
			count: slice.count,
			pct,
			labelPoint,
			leaderStart,
			isRight,
			midAngle,
		};
	});

	// nudge labels apart vertically when their angles put them too close
	// together — a cheap pass, not a full layout solver, but enough to
	// stop the worst overlaps seen in practice with 6-8 category slices
	const MIN_GAP = 20;
	const leftLabels = paths.filter((p) => !p.isRight).sort((a, b) => a.labelPoint.y - b.labelPoint.y);
	const rightLabels = paths.filter((p) => p.isRight).sort((a, b) => a.labelPoint.y - b.labelPoint.y);
	for (const group of [leftLabels, rightLabels]) {
		for (let i = 1; i < group.length; i++) {
			if (group[i].labelPoint.y - group[i - 1].labelPoint.y < MIN_GAP) {
				group[i].labelPoint.y = group[i - 1].labelPoint.y + MIN_GAP;
			}
		}
	}

	return (
		<svg viewBox="0 0 480 400" className={styles.svgComparePie}>
			{paths.map((s, i) => (
				<path key={i} d={s.path} fill={s.color} stroke="#1a1f35" strokeWidth={1.5} />
			))}
			{paths.map((s, i) => {
				const textX = s.isRight ? s.labelPoint.x + 6 : s.labelPoint.x - 6;
				return (
					<g key={`label-${i}`}>
						<line
							x1={s.leaderStart.x}
							y1={s.leaderStart.y}
							x2={s.labelPoint.x}
							y2={s.labelPoint.y}
							stroke="rgba(232,233,237,0.35)"
							strokeWidth={1}
						/>
						<text
							x={textX}
							y={s.labelPoint.y}
							textAnchor={s.isRight ? "start" : "end"}
							dominantBaseline="middle"
							fill={s.color}
							fontSize="9.5"
						>
							{shortenParenthetical(s.label)} -{s.count}筆 ({s.pct}%)
						</text>
					</g>
				);
			})}
		</svg>
	);
}

interface CategoryComparePiesProps {
	dataA: CountItem[];
	dataB: CountItem[];
	labelA: string; // e.g. "2025年1-6月"
	labelB: string;
	title: string; // e.g. "SAM類別 (安全類)" / "EF類別 (安全類)"
}

// Shared implementation behind RoutineSamCategoryComparePies /
// RoutineEfCategoryComparePies below — those two exist only to match the
// existing SAM/EF export-naming convention (RoutineSamChart/RoutineEfChart
// etc.), the actual rendering is identical either way.
function CategoryComparePies({ dataA, dataB, labelA, labelB, title }: CategoryComparePiesProps) {
	const colorMap = useMemo(() => buildStableColorMap(dataA, dataB), [dataA, dataB]);

	// per-category A->B deltas, sorted by |diff| descending so the
	// biggest movers are seen first, not buried alphabetically — same
	// reasoning and sort as StatisticsTab.tsx's categoryDeltaRows
	const deltaRows = useMemo(() => {
		const names = new Set<string>();
		dataA.forEach((d) => names.add(d.label));
		dataB.forEach((d) => names.add(d.label));
		const mapA = new Map(dataA.map((d) => [d.label, d.count]));
		const mapB = new Map(dataB.map((d) => [d.label, d.count]));
		return Array.from(names)
			.map((label) => {
				const a = mapA.get(label) ?? 0;
				const b = mapB.get(label) ?? 0;
				return { label, color: colorMap[label] ?? OTHER_COLOR, a, b, diff: b - a };
			})
			.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
	}, [dataA, dataB, colorMap]);

	const totalA = dataA.reduce((sum, d) => sum + d.count, 0);
	const totalB = dataB.reduce((sum, d) => sum + d.count, 0);

	if (totalA === 0 && totalB === 0) {
		return (
			<div className={styles.wrap}>
				<p className={styles.title}>{labelA} vs {labelB} {title}</p>
				<p className={styles.empty}>此區間無資料</p>
			</div>
		);
	}

	return (
		<div className={styles.wrap}>
			<p className={styles.title}>{labelA} vs {labelB} {title}</p>

			<div className={styles.presetSummary}>
				<span className={styles.presetSummaryRange}>{labelA} 總案件數：{totalA}</span>
				<span className={styles.vsLabel}>vs</span>
				<span className={styles.presetSummaryRange}>{labelB} 總案件數：{totalB}</span>
			</div>

			<div className={styles.categoryDeltaGrid}>
				{deltaRows.map((row) => (
					<div key={row.label} className={styles.categoryDeltaChip}>
						<span className={styles.categoryDeltaDot} style={{ background: row.color }} />
						<span className={styles.categoryDeltaName}>{row.label}</span>
						<span className={styles.categoryDeltaCounts}>{row.a} → {row.b}</span>
						<span className={row.diff === 0 ? styles.deltaNeutral : row.diff > 0 ? styles.deltaBad : styles.deltaGood}>
							{row.diff > 0 ? "▲" : row.diff < 0 ? "▼" : "—"} {row.diff > 0 ? "+" : ""}{row.diff}
						</span>
					</div>
				))}
			</div>

			<div className={styles.comparePieGrid}>
				<div className={styles.comparePieColumn}>
					<div className={styles.comparePieColumnLabel}>{labelA}</div>
					<ComparePieSvg data={dataA} colorMap={colorMap} />
				</div>
				<div className={styles.comparePieColumn}>
					<div className={styles.comparePieColumnLabel}>{labelB}</div>
					<ComparePieSvg data={dataB} colorMap={colorMap} />
				</div>
			</div>
		</div>
	);
}

export function RoutineSamCategoryComparePies(props: Omit<CategoryComparePiesProps, "title">) {
	return <CategoryComparePies {...props} title="SAM類別 (安全類)" />;
}

export function RoutineEfCategoryComparePies(props: Omit<CategoryComparePiesProps, "title">) {
	return <CategoryComparePies {...props} title="EF類別 (安全類)" />;
}

// ============ year-over-year comparison charts (bar / radar) ============
// Separate from BreakdownChart above — comparison always needs 2 series
// (one per year) plotted against the same category set, which pie/single
// -series bar can't represent. GroupedBarChart mirrors HorizontalBarChart's
// row layout (one row per category, now with one sub-row per year).
// RadarChart reuses polarToCartesian from the pie chart above.

interface CompareItem {
	label: string;
	values: number[]; // one entry per compared period, same order as the `periods` prop
}

function GroupedBarChart({
	data,
	periods,
	colors,
	descriptions,
	onViewRecords,
}: {
	data: CompareItem[];
	periods: string[]; // display labels, e.g. "2025年1-6月" — was years:number[], too narrow for partial-month or same-year comparisons
	colors: string[];
	descriptions?: Record<string, string>;
	onViewRecords?: (label: string) => void; // "查看自督相關紀錄" per row
}) {
	const items = [...data]
		.filter((d) => d.values.some((v) => v > 0))
		.sort((a, b) => Math.max(...b.values) - Math.max(...a.values));

	if (items.length === 0) {
		return <p className={styles.empty}>此區間無資料</p>;
	}

	const max = Math.max(...items.flatMap((d) => d.values));

	return (
		<div>
			<div className={styles.legend}>
				{periods.map((p, pi) => (
					<div key={p} className={styles.legendItem}>
						<span className={styles.swatch} style={{ background: colors[pi % colors.length] }} />
						{p}
					</div>
				))}
			</div>
			<div className={styles.barChart}>
			{items.map((d) => {
				const description = descriptions?.[d.label];
				return (
					<div key={d.label} className={styles.compareBarGroup}>
						<span className={styles.compareBarLabel} title={description || d.label}>{d.label}</span>
						{description && <p className={styles.compareBarDescription}>{description}</p>}
						<div className={styles.compareBarRows}>
							{periods.map((p, pi) => (
								<div key={p} className={styles.compareBarRow}>
									<div className={styles.barTrack}>
										<div
											className={styles.barFill}
											style={{
												width: `${((d.values[pi] ?? 0) / max) * 100}%`,
												background: colors[pi % colors.length],
											}}
										/>
									</div>
									<span className={styles.barCount}>{d.values[pi] ?? 0}</span>
								</div>
							))}
						</div>
						{onViewRecords && (
							<button className={styles.viewRecordsBtn} onClick={() => onViewRecords(d.label)}>
								🔍 查看自督相關紀錄
							</button>
						)}
					</div>
				);
			})}
			</div>
		</div>
	);
}

function RadarChart({ data, periods, colors }: { data: CompareItem[]; periods: string[]; colors: string[] }) {
	const items = data.filter((d) => d.values.some((v) => v > 0));

	if (items.length === 0) {
		return <p className={styles.empty}>此區間無資料</p>;
	}

	// radar gets cluttered past ~8 spokes — fold the remainder into "其他",
	// same convention as the pie chart's top-5-plus-other
	const ranked = [...items].sort((a, b) => Math.max(...b.values) - Math.max(...a.values));
	const top8 = ranked.slice(0, 8);
	const rest = ranked.slice(8);

	let slices = top8;
	if (rest.length > 0) {
		const otherValues = periods.map((_, pi) => rest.reduce((sum, r) => sum + (r.values[pi] ?? 0), 0));
		slices = [...top8, { label: OTHER_LABEL, values: otherValues }];
	}

	const allValues = slices.flatMap((s) => s.values);
	const rawMax = Math.max(1, ...allValues);
	const step = rawMax <= 5 ? 1 : rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : rawMax <= 50 ? 10 : 20;
	const maxVal = Math.ceil(rawMax / step) * step;
	const ringCount = Math.min(5, Math.max(1, maxVal / step));

	const cx = 190, cy = 170, r = 115;
	const n = slices.length;
	const angleStep = 360 / n;

	const rings = Array.from({ length: ringCount }, (_, i) => {
		const frac = (i + 1) / ringCount;
		return slices.map((_, si) => polarToCartesian(cx, cy, r * frac, si * angleStep));
	});

	const seriesPolygons = periods.map((p, pi) => {
		const points = slices.map((s, si) => {
			const val = s.values[pi] ?? 0;
			const frac = val / maxVal;
			return polarToCartesian(cx, cy, r * frac, si * angleStep);
		});
		return { period: p, color: colors[pi % colors.length], points };
	});

	const labelPositions = slices.map((s, si) => {
		const p = polarToCartesian(cx, cy, r + 25, si * angleStep);
		return { ...p, label: s.label };
	});

	return (
		<svg viewBox="0 0 380 340" className={styles.svgRadar}>
			{rings.map((ring, i) => (
				<polygon
					key={i}
					points={ring.map((p) => `${p.x},${p.y}`).join(" ")}
					fill="none"
					stroke="rgba(232,233,237,0.12)"
					strokeWidth={1}
				/>
			))}
			{slices.map((_, si) => {
				const edge = polarToCartesian(cx, cy, r, si * angleStep);
				return (
					<line
						key={si}
						x1={cx}
						y1={cy}
						x2={edge.x}
						y2={edge.y}
						stroke="rgba(232,233,237,0.12)"
						strokeWidth={1}
					/>
				);
			})}
			{seriesPolygons.map((s) => (
				<polygon
					key={s.period}
					points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
					fill={s.color}
					fillOpacity={0.15}
					stroke={s.color}
					strokeWidth={2}
				/>
			))}
			{seriesPolygons.map((s) =>
				s.points.map((p, i) => (
					<circle key={`${s.period}-${i}`} cx={p.x} cy={p.y} r={3} fill={s.color} />
				))
			)}
			{labelPositions.map((l, i) => (
				<text
					key={i}
					x={l.x}
					y={l.y}
					textAnchor="middle"
					dominantBaseline="middle"
					fill="#e8e9ed"
					fontSize="10"
				>
					{l.label}
				</text>
			))}
		</svg>
	);
}

function CompareBreakdownChart({
	data,
	periods,
	chartStyle,
	descriptions,
	onViewRecords,
}: {
	data: CompareItem[];
	periods: string[];
	chartStyle: ChartStyle;
	descriptions?: Record<string, string>;
	onViewRecords?: (label: string) => void;
}) {
	// radar has no room for a description line per spoke — descriptions
	// only apply to the bar rendering
	return chartStyle === "radar" ? (
		<RadarChart data={data} periods={periods} colors={COMPARE_COLORS} />
	) : (
		<GroupedBarChart data={data} periods={periods} colors={COMPARE_COLORS} descriptions={descriptions} onViewRecords={onViewRecords} />
	);
}

// ============ RoutineSamCompareChart / RoutineEfCompareChart ============

export function RoutineSamCompareChart({
	data,
	periods,
	level,
	chartStyle,
	descriptions,
	onViewRecords,
}: {
	data: CompareItem[];
	periods: string[]; // display labels, e.g. ["2025年1-6月", "2026年1-6月"] — was years:number[]
	level: PieGroupLevel;
	chartStyle: ChartStyle;
	descriptions?: Record<string, string>;
	onViewRecords?: (label: string) => void;
}) {
	const label = level === "category" ? "SAM類別" : "SAM代碼";
	return (
		<div className={styles.wrap}>
			<p className={styles.title}>{periods.join(" vs ")} {label} (安全類) 比較</p>
			<CompareBreakdownChart data={data} periods={periods} chartStyle={chartStyle} descriptions={descriptions} onViewRecords={onViewRecords} />
		</div>
	);
}

export function RoutineEfCompareChart({
	data,
	periods,
	level,
	chartStyle,
	descriptions,
	onViewRecords,
}: {
	data: CompareItem[];
	periods: string[];
	level: PieGroupLevel;
	chartStyle: ChartStyle;
	descriptions?: Record<string, string>;
	onViewRecords?: (label: string) => void;
}) {
	const label = level === "category" ? "EF類別" : "EF代碼";
	return (
		<div className={styles.wrap}>
			<p className={styles.title}>{periods.join(" vs ")} {label} (安全類) 比較</p>
			<CompareBreakdownChart data={data} periods={periods} chartStyle={chartStyle} descriptions={descriptions} onViewRecords={onViewRecords} />
		</div>
	);
}

// ============ RoutineTrendChart ============

interface Series {
	label: string; // display label, e.g. "2026年" or "2025年1-6月" — was year:number, too narrow for partial-month periods
	color: string;
	values: number[]; // 12 entries, index 0 = Jan
}

interface TrendChartProps {
	series: Series[];
	monthFrom: number; // 1-12
	monthTo: number;
}

const MONTH_LABELS = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const AXIS_FILL = "rgba(232, 233, 237, 0.55)";

export function RoutineTrendChart({ series, monthFrom, monthTo }: TrendChartProps) {
	const months = MONTH_LABELS.slice(monthFrom - 1, monthTo);
	const monthIndices = Array.from({ length: monthTo - monthFrom + 1 }, (_, i) => monthFrom - 1 + i);

	const allValues = series.flatMap((s) => monthIndices.map((i) => s.values[i] ?? 0));
	const rawMax = Math.max(1, ...allValues);
	// round the axis ceiling to a "nice" step so labels read as a scale
	// (0/5/10/15) rather than looking like a specific data callout — showing
	// the raw max (e.g. "14") made it look like a real data point instead
	// of a gridline, which is what was actually confusing here
	const step = rawMax <= 5 ? 1 : rawMax <= 10 ? 2 : rawMax <= 25 ? 5 : rawMax <= 50 ? 10 : 20;
	const maxVal = Math.ceil(rawMax / step) * step;
	const tickCount = Math.min(5, maxVal / step);

	const width = 900, height = 220, padL = 36, padB = 28, padT = 16, padR = 16;
	const plotW = width - padL - padR;
	const plotH = height - padT - padB;
	const stepX = months.length > 1 ? plotW / (months.length - 1) : 0;

	function pointFor(value: number, idx: number) {
		const x = padL + idx * stepX;
		const y = padT + plotH - (value / maxVal) * plotH;
		return { x, y };
	}

	if (series.length === 0) {
		return (
			<div className={styles.wrap}>
				<p className={styles.title}>月度趨勢</p>
				<p className={styles.empty}>請選擇年度</p>
			</div>
		);
	}

	return (
		<div className={styles.wrap}>
			<p className={styles.title}>月度趨勢</p>
			<div className={styles.trendLayout}>
				<div className={styles.trendChartCol}>
					<svg viewBox={`0 0 ${width} ${height}`} className={styles.svg}>
						{Array.from({ length: tickCount + 1 }, (_, i) => i / tickCount).map((f, i) => {
							const y = padT + plotH * (1 - f);
							return (
								<g key={i}>
									<line x1={padL} y1={y} x2={width - padR} y2={y} stroke="rgba(232,233,237,0.08)" />
									<text x={padL - 8} y={y} textAnchor="end" dominantBaseline="middle" fill={AXIS_FILL} fontSize="11">
										{Math.round(maxVal * f)}
									</text>
								</g>
							);
						})}

						{months.map((m, i) => (
							<text
								key={m}
								x={padL + i * stepX}
								y={height - 8}
								textAnchor="middle"
								fill={AXIS_FILL}
								fontSize="11"
							>
								{m}月
							</text>
						))}

						{series.map((s) => {
							const points = monthIndices.map((idx, i) => pointFor(s.values[idx] ?? 0, i));
							const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
							return (
								<g key={s.label}>
									<path d={d} fill="none" stroke={s.color} strokeWidth={2} />
									{points.map((p, i) => (
										<circle key={i} cx={p.x} cy={p.y} r={3} fill={s.color} />
									))}
								</g>
							);
						})}
					</svg>
					<div className={styles.legend}>
						{series.map((s) => (
							<div key={s.label} className={styles.legendItem}>
								<span className={styles.swatch} style={{ background: s.color }} />
								{s.label}
							</div>
						))}
					</div>
				</div>

				<div className={styles.trendTableCol}>
					<table className={styles.trendTable}>
						<thead>
							<tr>
								<th>月份</th>
								{series.map((s) => (
									<th key={s.label} style={{ color: s.color }}>{s.label}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{monthIndices.map((idx, i) => (
								<tr key={idx}>
									<td>{months[i]}月</td>
									{series.map((s) => (
										<td key={s.label}>{s.values[idx] ?? 0}</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}