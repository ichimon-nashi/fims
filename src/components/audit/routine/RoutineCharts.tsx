// src/components/audit/routine/RoutineCharts.tsx
// Bar for code-level (many items, skewed — bar shows that shape clearly),
// pie for category-level (few items, proportion-of-whole is the story).
// Both SAM and EF charts share one level toggle, owned by the parent
// (RoutineSummary), not each chart individually — flipping "類別" switches
// both breakdowns together instead of needing two separate controls.

import styles from "./RoutineCharts.module.css";
import { PieGroupLevel } from "@/lib/routineAudit.types";

interface CountItem {
	label: string;
	count: number;
}

const PIE_COLORS = ["#4a9eff", "#fb923c", "#1baf7a", "#e87ba4", "#eda100", "#6b7280"];
const OTHER_COLOR = "#6b7280";
const OTHER_LABEL = "其他";

// ============ shared: horizontal bar (code level) ============

function HorizontalBarChart({ data, color }: { data: CountItem[]; color: string }) {
	const sorted = [...data].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
	const top = sorted.slice(0, 8);
	const rest = sorted.slice(8);
	const otherTotal = rest.reduce((sum, d) => sum + d.count, 0);

	const bars = [...top];
	if (otherTotal > 0) bars.push({ label: OTHER_LABEL, count: otherTotal });

	if (bars.length === 0) {
		return <p className={styles.empty}>此區間無資料</p>;
	}

	const max = Math.max(...bars.map((b) => b.count));

	return (
		<div className={styles.barChart}>
			{bars.map((b) => (
				<div key={b.label} className={styles.barRow}>
					<span className={styles.barLabel} title={b.label}>{b.label}</span>
					<div className={styles.barTrack}>
						<div
							className={styles.barFill}
							style={{ width: `${(b.count / max) * 100}%`, background: b.label === OTHER_LABEL ? OTHER_COLOR : color }}
						/>
					</div>
					<span className={styles.barCount}>{b.count}</span>
				</div>
			))}
		</div>
	);
}

// ============ shared: pie (category level) ============

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
	const rad = ((angleDeg - 90) * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function PieChart({ data }: { data: CountItem[] }) {
	const sorted = [...data].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
	const top5 = sorted.slice(0, 5);
	const rest = sorted.slice(5);
	const otherTotal = rest.reduce((sum, d) => sum + d.count, 0);

	const slices = [...top5];
	if (otherTotal > 0) slices.push({ label: OTHER_LABEL, count: otherTotal });
	const total = slices.reduce((sum, s) => sum + s.count, 0);

	if (total === 0) {
		return <p className={styles.empty}>此區間無資料</p>;
	}

	const cx = 130, cy = 130, r = 85, labelR = 115;
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
			color: slice.label === OTHER_LABEL ? OTHER_COLOR : PIE_COLORS[i % PIE_COLORS.length],
			label: slice.label,
			count: slice.count,
			pct,
			labelPoint,
			leaderStart,
			isRight,
		};
	});

	return (
		<svg viewBox="0 0 340 260" className={styles.svg}>
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
							{s.label} ({s.count}, {s.pct}%)
						</text>
					</g>
				);
			})}
		</svg>
	);
}

function BreakdownChart({ data, level, color }: { data: CountItem[]; level: PieGroupLevel; color: string }) {
	return level === "category" ? <PieChart data={data} /> : <HorizontalBarChart data={data} color={color} />;
}

// ============ RoutineSamChart ============

export function RoutineSamChart({ data, year, level }: { data: CountItem[]; year: number; level: PieGroupLevel }) {
	const label = level === "category" ? "類別" : "SAM代碼";
	return (
		<div className={styles.wrap}>
			<p className={styles.title}>{year} {label} (不含非安全)</p>
			<BreakdownChart data={data} level={level} color="#4a9eff" />
		</div>
	);
}

// ============ RoutineEfChart ============

export function RoutineEfChart({ data, year, level }: { data: CountItem[]; year: number; level: PieGroupLevel }) {
	const label = level === "category" ? "EF類別" : "EF代碼";
	return (
		<div className={styles.wrap}>
			<p className={styles.title}>{year} {label} (不含非安全)</p>
			<BreakdownChart data={data} level={level} color="#1baf7a" />
		</div>
	);
}

// ============ RoutineTrendChart ============

interface Series {
	year: number;
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
	const maxVal = Math.max(1, ...allValues);

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
			<svg viewBox={`0 0 ${width} ${height}`} className={styles.svg}>
				{[0, 0.5, 1].map((f, i) => {
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
						<g key={s.year}>
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
					<div key={s.year} className={styles.legendItem}>
						<span className={styles.swatch} style={{ background: s.color }} />
						{s.year}
					</div>
				))}
			</div>
		</div>
	);
}