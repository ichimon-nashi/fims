// src/components/audit/routine/RoutineTrendChart.tsx

import { useState } from "react";
import styles from "./RoutineTrendChart.module.css";

interface Series {
	year: number;
	color: string;
	values: number[]; // 12 entries, index 0 = Jan
}

interface Props {
	series: Series[];
	monthFrom: number; // 1-12
	monthTo: number;
	compareYear: number | null;
	availableYears: number[];
	primaryYear: number;
	onCompareYearChange: (year: number | null) => void;
}

const MONTH_LABELS = ["1","2","3","4","5","6","7","8","9","10","11","12"];

export default function RoutineTrendChart({
	series,
	monthFrom,
	monthTo,
	compareYear,
	availableYears,
	primaryYear,
	onCompareYearChange,
}: Props) {
	const [picking, setPicking] = useState(false);

	const months = MONTH_LABELS.slice(monthFrom - 1, monthTo);
	const monthIndices = Array.from({ length: monthTo - monthFrom + 1 }, (_, i) => monthFrom - 1 + i);

	const allValues = series.flatMap((s) => monthIndices.map((i) => s.values[i] ?? 0));
	const maxVal = Math.max(1, ...allValues);

	const width = 600, height = 240, padL = 36, padB = 28, padT = 16, padR = 16;
	const plotW = width - padL - padR;
	const plotH = height - padT - padB;
	const stepX = months.length > 1 ? plotW / (months.length - 1) : 0;

	function pointFor(value: number, idx: number) {
		const x = padL + idx * stepX;
		const y = padT + plotH - (value / maxVal) * plotH;
		return { x, y };
	}

	const header = (
		<div className={styles.header}>
			<p className={styles.title}>月度趨勢</p>
			{compareYear === null ? (
				picking ? (
					<select
						autoFocus
						className={styles.compareSelect}
						onChange={(e) => {
							onCompareYearChange(Number(e.target.value));
							setPicking(false);
						}}
						onBlur={() => setPicking(false)}
					>
						<option value="">選擇年度...</option>
						{availableYears
							.filter((y) => y !== primaryYear)
							.map((y) => (
								<option key={y} value={y}>{y}</option>
							))}
					</select>
				) : (
					<button className={styles.compareChip} onClick={() => setPicking(true)}>
						+ 比較年度
					</button>
				)
			) : (
				<button className={styles.compareChipActive} onClick={() => onCompareYearChange(null)}>
					vs {compareYear} ×
				</button>
			)}
		</div>
	);

	if (series.length === 0) {
		return (
			<div className={styles.wrap}>
				{header}
				<p className={styles.empty}>請選擇年度</p>
			</div>
		);
	}

	return (
		<div className={styles.wrap}>
			{header}
			<svg viewBox={`0 0 ${width} ${height}`} className={styles.svg}>
				{/* y-axis gridlines */}
				{[0, 0.5, 1].map((f, i) => {
					const y = padT + plotH * (1 - f);
					return (
						<g key={i}>
							<line x1={padL} y1={y} x2={width - padR} y2={y} stroke="rgba(232,233,237,0.08)" />
							<text x={padL - 8} y={y} textAnchor="end" dominantBaseline="middle" className={styles.axisLabel}>
								{Math.round(maxVal * f)}
							</text>
						</g>
					);
				})}

				{/* x-axis labels */}
				{months.map((m, i) => (
					<text
						key={m}
						x={padL + i * stepX}
						y={height - 8}
						textAnchor="middle"
						className={styles.axisLabel}
					>
						{m}月
					</text>
				))}

				{/* lines */}
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