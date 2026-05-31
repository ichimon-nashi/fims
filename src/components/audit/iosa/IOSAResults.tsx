// src/components/audit/iosa/IOSAResults.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/context/AuthContext";
import styles from "./IOSAResults.module.css";

interface ActiveCycle {
	id: string;
	name: string;
	disciplines: string[];
	ism_edition: string;
	status: string;
}
interface AuditRecord {
	isarp_code: string;
	discipline: string;
	conformance_status: string | null;
	nonconformity_desc: string;
	root_cause: string;
	corrective_action: string;
	doc_references: string;
}
interface ISARPWithRecord {
	isarp_code: string;
	discipline: string;
	isarp_type: string;
	standard_text: string;
	record: AuditRecord | null;
}
interface DiscStat {
	disc: string;
	total: number;
	assessed: number;
	conformities: number;
	findings: number;
	observations: number;
	findingItems: ISARPWithRecord[];
	obsItems: ISARPWithRecord[];
}

function catOf(s: string | null) {
	if (!s) return null;
	if (s.startsWith("Conformity")) return "conformity";
	if (s.startsWith("Finding")) return "finding";
	if (s.startsWith("Observation")) return "observation";
	if (s.startsWith("N/A")) return "na";
	return null;
}

// Short form for UI display only
function shortStatus(s: string | null) {
	if (!s) return "";
	return s
		.replace(
			"Finding (Not Documented, Not Implemented)",
			"Not Doc · Not Impl",
		)
		.replace("Finding (Not Documented, Implemented)", "Not Doc · Impl")
		.replace("Finding (Documented, Not Implemented)", "Doc · Not Impl")
		.replace(
			"Observation (Not Documented, Not Implemented)",
			"Not Doc · Not Impl",
		)
		.replace("Observation (Not Documented, Implemented)", "Not Doc · Impl")
		.replace("Observation (Documented, Not Implemented)", "Doc · Not Impl")
		.replace("Conformity (Documented and Implemented)", "Conformity")
		.replace("N/A (Not Applicable)", "N/A");
}

// Full form for Excel export — no abbreviations
function fullStatus(s: string | null) {
	if (!s) return "";
	return s
		.replace(
			"Finding (Not Documented, Not Implemented)",
			"Finding — Not Documented, Not Implemented",
		)
		.replace(
			"Finding (Not Documented, Implemented)",
			"Finding — Not Documented, Implemented",
		)
		.replace(
			"Finding (Documented, Not Implemented)",
			"Finding — Documented, Not Implemented",
		)
		.replace(
			"Observation (Not Documented, Not Implemented)",
			"Observation — Not Documented, Not Implemented",
		)
		.replace(
			"Observation (Not Documented, Implemented)",
			"Observation — Not Documented, Implemented",
		)
		.replace(
			"Observation (Documented, Not Implemented)",
			"Observation — Documented, Not Implemented",
		)
		.replace(
			"Conformity (Documented and Implemented)",
			"Conformity — Documented and Implemented",
		)
		.replace("N/A (Not Applicable)", "N/A — Not Applicable");
}

// ── Export ────────────────────────────────────────────────────
function doExport(
	cycle: ActiveCycle,
	all: ISARPWithRecord[],
	findings: ISARPWithRecord[],
	obs: ISARPWithRecord[],
	discStats: DiscStat[],
) {
	const wb = XLSX.utils.book_new();
	const ws1 = XLSX.utils.aoa_to_sheet([
		["IOSA Audit Results"],
		[`Cycle: ${cycle.name}`],
		[
			`Edition: ${cycle.ism_edition}`,
			"",
			`Exported: ${new Date().toLocaleDateString()}`,
		],
		[],
		[
			"Discipline",
			"Total",
			"Assessed",
			"Conformities",
			"Findings",
			"Observations",
		],
		...discStats.map((d) => [
			d.disc,
			d.total,
			d.assessed,
			d.conformities,
			d.findings,
			d.observations,
		]),
		[],
		[
			"TOTAL",
			discStats.reduce((s, d) => s + d.total, 0),
			discStats.reduce((s, d) => s + d.assessed, 0),
			discStats.reduce((s, d) => s + d.conformities, 0),
			discStats.reduce((s, d) => s + d.findings, 0),
			discStats.reduce((s, d) => s + d.observations, 0),
		],
	]);
	ws1["!cols"] = [
		{ wch: 14 },
		{ wch: 8 },
		{ wch: 10 },
		{ wch: 14 },
		{ wch: 10 },
		{ wch: 14 },
	];
	XLSX.utils.book_append_sheet(wb, ws1, "Summary");
	const ws2 = XLSX.utils.aoa_to_sheet([
		[
			"#",
			"Discipline",
			"ISARP",
			"ISARP Description",
			"Document Reference",
			"Status",
			"Nonconformity",
			"Root Cause",
			"Corrective Action",
		],
		...findings.map((i, n) => [
			n + 1,
			i.discipline,
			i.isarp_code,
			i.standard_text?.split("\n")[0]?.slice(0, 200) ?? "",
			i.record?.doc_references ?? "",
			fullStatus(i.record?.conformance_status ?? null),
			i.record?.nonconformity_desc ?? "",
			i.record?.root_cause ?? "",
			i.record?.corrective_action ?? "",
		]),
	]);
	ws2["!cols"] = [
		{ wch: 5 },
		{ wch: 12 },
		{ wch: 14 },
		{ wch: 50 },
		{ wch: 28 },
		{ wch: 40 },
		{ wch: 45 },
		{ wch: 35 },
		{ wch: 35 },
	];
	XLSX.utils.book_append_sheet(wb, ws2, "Findings");
	const ws3 = XLSX.utils.aoa_to_sheet([
		[
			"#",
			"Discipline",
			"ISARP",
			"ISARP Description",
			"Document Reference",
			"Status",
			"Observation",
			"Root Cause",
			"Corrective Action",
		],
		...obs.map((i, n) => [
			n + 1,
			i.discipline,
			i.isarp_code,
			i.standard_text?.split("\n")[0]?.slice(0, 200) ?? "",
			i.record?.doc_references ?? "",
			fullStatus(i.record?.conformance_status ?? null),
			i.record?.nonconformity_desc ?? "",
			i.record?.root_cause ?? "",
			i.record?.corrective_action ?? "",
		]),
	]);
	ws3["!cols"] = [
		{ wch: 5 },
		{ wch: 12 },
		{ wch: 14 },
		{ wch: 50 },
		{ wch: 28 },
		{ wch: 40 },
		{ wch: 45 },
		{ wch: 35 },
		{ wch: 35 },
	];
	XLSX.utils.book_append_sheet(wb, ws3, "Observations");
	// Per-discipline detail sheets for disciplines with findings/observations
	discStats.forEach((d) => {
		const items = [...d.findingItems, ...d.obsItems];
		if (!items.length) return;
		const rows = [
			[
				"ISARP",
				"Type",
				"Status",
				"Nonconformity / Observation",
				"Root Cause",
				"Corrective Action",
				"Doc References",
			],
			...items.map((i) => {
				const isFinding =
					i.record?.conformance_status?.startsWith("Finding") ??
					false;
				return [
					i.isarp_code,
					isFinding ? "Finding" : "Observation",
					fullStatus(i.record?.conformance_status ?? null),
					i.record?.nonconformity_desc ?? "",
					isFinding ? (i.record?.root_cause ?? "") : "",
					isFinding ? (i.record?.corrective_action ?? "") : "",
					i.record?.doc_references ?? "",
				];
			}),
		];
		const ws = XLSX.utils.aoa_to_sheet(rows);
		ws["!cols"] = [
			{ wch: 14 },
			{ wch: 12 },
			{ wch: 22 },
			{ wch: 45 },
			{ wch: 35 },
			{ wch: 35 },
			{ wch: 28 },
		];
		XLSX.utils.book_append_sheet(wb, ws, d.disc);
	});
	XLSX.writeFile(wb, `IOSA_results_${new Date().getFullYear()}.xlsx`);
}

// ── NC inline row ─────────────────────────────────────────────
function NCRow({
	isarp,
	globalIdx,
	isFinding,
}: {
	isarp: ISARPWithRecord;
	globalIdx: number;
	isFinding: boolean;
}) {
	const [open, setOpen] = useState(false);
	const r = isarp.record!;
	const color = isFinding ? styles.ncFinding : styles.ncObs;
	const hasBody = r.nonconformity_desc || r.root_cause || r.corrective_action;
	return (
		<div className={`${styles.ncRow} ${color}`}>
			<div
				className={styles.ncRowTop}
				onClick={() => hasBody && setOpen((o) => !o)}
			>
				<span className={styles.ncIdx}>
					{String(globalIdx).padStart(2, "0")}
				</span>
				<span className={styles.ncCode}>{isarp.isarp_code}</span>
				<span
					className={`${styles.ncStatusPill} ${isFinding ? styles.ncStatusPillF : styles.ncStatusPillO}`}
				>
					{isFinding ? "F" : "O"} ·{" "}
					{shortStatus(r.conformance_status)}
				</span>
				{r.nonconformity_desc && !open && (
					<span className={styles.ncPreview}>
						{r.nonconformity_desc.slice(0, 90)}
						{r.nonconformity_desc.length > 90 ? "…" : ""}
					</span>
				)}
				{hasBody && (
					<span
						className={styles.ncChevron}
						style={{ transform: open ? "rotate(180deg)" : "none" }}
					>
						▾
					</span>
				)}
			</div>
			{open && (
				<div className={styles.ncBody}>
					{r.nonconformity_desc && (
						<div className={styles.ncField}>
							<div className={styles.ncFL}>
								{isFinding ? "Nonconformity" : "Observation"}
							</div>
							<div className={styles.ncFV}>
								{r.nonconformity_desc}
							</div>
						</div>
					)}
					{isFinding && r.root_cause && (
						<div className={styles.ncField}>
							<div className={styles.ncFL}>Root Cause</div>
							<div className={styles.ncFV}>{r.root_cause}</div>
						</div>
					)}
					{isFinding && r.corrective_action && (
						<div className={styles.ncField}>
							<div className={styles.ncFL}>Corrective Action</div>
							<div className={styles.ncFV}>
								{r.corrective_action}
							</div>
						</div>
					)}
					{r.doc_references && (
						<div className={styles.ncField}>
							<div className={styles.ncFL}>Doc References</div>
							<div className={styles.ncFV}>
								{r.doc_references}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ── Discipline row ────────────────────────────────────────────
function DiscRow({
	d,
	fStart,
	oStart,
}: {
	d: DiscStat;
	fStart: number;
	oStart: number;
}) {
	const pct = d.total > 0 ? Math.round((d.assessed / d.total) * 100) : 0;
	const hasNC = d.findings > 0 || d.observations > 0;
	return (
		<div className={`${styles.discRow} ${hasNC ? styles.discRowNC : ""}`}>
			{/* Main row */}
			<div className={styles.discMain}>
				<span className={styles.discCode}>{d.disc}</span>
				<div className={styles.discTrackWrap}>
					<div className={styles.discTrack}>
						<div
							className={styles.discFill}
							style={{ width: `${pct}%` }}
						/>
					</div>
				</div>
				<div className={styles.discPills}>
					{d.conformities > 0 && (
						<span className={`${styles.pill} ${styles.pillG}`}>
							{d.conformities} ✓
						</span>
					)}
					<span
						className={`${styles.pill} ${d.findings > 0 ? styles.pillR : styles.pillX}`}
					>
						{d.findings} F
					</span>
					<span
						className={`${styles.pill} ${d.observations > 0 ? styles.pillA : styles.pillX}`}
					>
						{d.observations} O
					</span>
				</div>
				<span
					className={styles.discPct}
					style={{ color: pct === 100 ? "#48bb78" : "#a0aec0" }}
				>
					{pct}%
				</span>
			</div>
			{/* Inline NC rows */}
			{hasNC && (
				<div className={styles.discNCs}>
					{d.findingItems.map((i, idx) => (
						<NCRow
							key={i.isarp_code}
							isarp={i}
							globalIdx={fStart + idx + 1}
							isFinding={true}
						/>
					))}
					{d.obsItems.map((i, idx) => (
						<NCRow
							key={i.isarp_code}
							isarp={i}
							globalIdx={oStart + idx + 1}
							isFinding={false}
						/>
					))}
				</div>
			)}
		</div>
	);
}

// ── Main ──────────────────────────────────────────────────────
export default function IOSAResults({
	activeCycle,
}: {
	activeCycle: ActiveCycle | null;
}) {
	const { token } = useAuth();
	const [allIsarps, setAllIsarps] = useState<ISARPWithRecord[]>([]);
	const [loading, setLoading] = useState(false);
	const [exporting, setExporting] = useState(false);

	useEffect(() => {
		if (!activeCycle?.id || !token) return;
		setLoading(true);
		Promise.all(
			activeCycle.disciplines.map((disc) =>
				fetch(
					`/api/audit/iosa/auditprep?cycle_id=${activeCycle.id}&discipline=${disc}`,
					{
						headers: { Authorization: `Bearer ${token}` },
					},
				)
					.then((r) => r.json())
					.then(({ isarps }) => isarps ?? []),
			),
		)
			.then((r) => setAllIsarps(r.flat()))
			.catch(console.error)
			.finally(() => setLoading(false));
	}, [activeCycle?.id, token]);

	const findings = allIsarps.filter(
		(i) => catOf(i.record?.conformance_status ?? null) === "finding",
	);
	const observations = allIsarps.filter(
		(i) => catOf(i.record?.conformance_status ?? null) === "observation",
	);
	const conformities = allIsarps.filter(
		(i) => catOf(i.record?.conformance_status ?? null) === "conformity",
	);
	const assessed = allIsarps.filter((i) => i.record?.conformance_status);
	const pct =
		allIsarps.length > 0
			? Math.round((assessed.length / allIsarps.length) * 100)
			: 0;

	const discStats: DiscStat[] = (activeCycle?.disciplines ?? []).map(
		(disc) => {
			const d = allIsarps.filter((i) => i.discipline === disc);
			return {
				disc,
				total: d.length,
				assessed: d.filter((i) => i.record?.conformance_status).length,
				conformities: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"conformity",
				).length,
				findings: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"finding",
				).length,
				observations: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"observation",
				).length,
				findingItems: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"finding",
				),
				obsItems: d.filter(
					(i) =>
						catOf(i.record?.conformance_status ?? null) ===
						"observation",
				),
			};
		},
	);

	const handleExport = useCallback(async () => {
		if (!activeCycle) return;
		setExporting(true);
		try {
			doExport(activeCycle, allIsarps, findings, observations, discStats);
		} catch (e) {
			console.error(e);
		} finally {
			setExporting(false);
		}
	}, [activeCycle, allIsarps, findings, observations, discStats]);

	if (!activeCycle) {
		return (
			<div className={styles.empty}>
				<span className={styles.emptyIcon}>📋</span>
				<p>No active cycle selected.</p>
			</div>
		);
	}

	let fIdx = 0,
		oIdx = 0;

	return (
		<div className={styles.results}>
			{/* Header */}
			<div className={styles.header}>
				<div className={styles.headerLeft}>
					<span className={styles.cycleName}>{activeCycle.name}</span>
					<div className={styles.headerMeta}>
						<span className={styles.badge}>
							{activeCycle.ism_edition}
						</span>
						<span
							className={`${styles.badge} ${activeCycle.status === "active" ? styles.badgeActive : ""}`}
						>
							{activeCycle.status}
						</span>
					</div>
				</div>
				<button
					className={styles.exportBtn}
					onClick={handleExport}
					disabled={exporting || loading || allIsarps.length === 0}
				>
					{exporting ? "Exporting…" : "↓ Export xlsx"}
				</button>
			</div>

			{loading ? (
				<div className={styles.loadingWrap}>
					<div className={styles.spinner} />
				</div>
			) : (
				<>
					{/* Summary strip */}
					<div className={styles.summaryStrip}>
						<div className={styles.stripBlock}>
							<span className={styles.stripVal}>
								{allIsarps.length}
							</span>
							<span className={styles.stripLbl}>Total</span>
						</div>
						<div className={styles.stripDivider} />
						<div className={styles.stripBlock}>
							<span
								className={styles.stripVal}
								style={{ color: "#4a9eff" }}
							>
								{assessed.length}
							</span>
							<span className={styles.stripLbl}>Assessed</span>
						</div>
						<div className={styles.stripBlock}>
							<div className={styles.stripProgress}>
								<div
									className={styles.stripProgressFill}
									style={{ width: `${pct}%` }}
								/>
							</div>
							<span className={styles.stripPct}>{pct}%</span>
						</div>
						<div className={styles.stripDivider} />
						<div className={styles.stripBlock}>
							<span
								className={styles.stripVal}
								style={{
									color:
										conformities.length > 0
											? "#48bb78"
											: undefined,
								}}
							>
								{conformities.length}
							</span>
							<span className={styles.stripLbl}>
								Conformities
							</span>
						</div>
						<div className={styles.stripDivider} />
						<div className={styles.stripBlock}>
							<span
								className={styles.stripVal}
								style={{
									color:
										findings.length > 0
											? "#fc8181"
											: undefined,
								}}
							>
								{findings.length}
							</span>
							<span className={styles.stripLbl}>Findings</span>
						</div>
						<div className={styles.stripBlock}>
							<span
								className={styles.stripVal}
								style={{
									color:
										observations.length > 0
											? "#f6ad55"
											: undefined,
								}}
							>
								{observations.length}
							</span>
							<span className={styles.stripLbl}>
								Observations
							</span>
						</div>
					</div>

					{/* Discipline rows */}
					<div className={styles.discList}>
						{discStats.map((d) => {
							const card = (
								<DiscRow
									key={d.disc}
									d={d}
									fStart={fIdx}
									oStart={oIdx}
								/>
							);
							fIdx += d.findings;
							oIdx += d.observations;
							return card;
						})}
					</div>
				</>
			)}
		</div>
	);
}
