// src/components/audit/routine/RoutineCategoryChart.tsx

import styles from "./RoutineCategoryChart.module.css";
import { PieGroupLevel } from "@/lib/routineAudit.types";

interface CategoryCount {
	label: string;
	count: number;
}

interface Props {
	data: CategoryCount[]; // full set, unsorted — component handles top-5 + 其他
	year: number;
	pieLevel: PieGroupLevel;
	onPieLevelChange: (level: PieGroupLevel) => void;
}

const COLORS = ["#4a9eff", "#fb923c", "#1baf7a", "#e87ba4", "#eda100", "#6b7280"];
const OTHER_COLOR = "#6b7280";
const LEVEL_LABELS: Record<PieGroupLevel, string> = {
	code: "SAM代碼",
	category: "類別",
	area: "四大領域",
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
	const rad = ((angleDeg - 90) * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export default function RoutineCategoryChart({ data, year, pieLevel, onPieLevelChange }: Props) {
	const sorted = [...data].filter((d) => d.count > 0).sort((a, b) => b.count - a.count);
	const top5 = sorted.slice(0, 5);
	const rest = sorted.slice(5);
	const otherTotal = rest.reduce((sum, d) => sum + d.count, 0);

	const slices = [...top5];
	if (otherTotal > 0) slices.push({ label: "其他", count: otherTotal });

	const total = slices.reduce((sum, s) => sum + s.count, 0);

	const header = (
		<div className={styles.header}>
			<p className={styles.title}>{year} {LEVEL_LABELS[pieLevel]} (不含非飛安)</p>
			<div className={styles.levelToggle}>
				{(["code", "category", "area"] as const).map((level) => (
					<button
						key={level}
						className={pieLevel === level ? styles.levelBtnActive : styles.levelBtn}
						onClick={() => onPieLevelChange(level)}
					>
						{LEVEL_LABELS[level]}
					</button>
				))}
			</div>
		</div>
	);

	if (total === 0) {
		return (
			<div className={styles.wrap}>
				{header}
				<p className={styles.empty}>此區間無資料</p>
			</div>
		);
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
			color: slice.label === "其他" ? OTHER_COLOR : COLORS[i % COLORS.length],
			label: slice.label,
			count: slice.count,
			pct,
			labelPoint,
			leaderStart,
			isRight,
		};
	});

	return (
		<div className={styles.wrap}>
			{header}
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
								className={styles.sliceLabel}
							>
								{s.label} ({s.count}, {s.pct}%)
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
}