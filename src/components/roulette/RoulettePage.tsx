// src/components/roulette/RoulettePage.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Navbar from "@/components/common/Navbar";
import Avatar from "@/components/ui/Avatar/Avatar";
import styles from "./Roulette.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Employee {
	id: string;
	employee_id: string;
	full_name: string;
	rank: string;
	base: string;
	gender: string;
	aircraft_type_ratings: string[];
	filter: string[];
}

type IdMode = "any" | "gt" | "lt" | "between";
type Logic = "AND" | "OR";

interface FilterGroup {
	inc: string[];
	exc: string[];
	logic: Logic;
}

interface FilterState {
	rank: FilterGroup;
	base: FilterGroup;
	gender: FilterGroup;
	ac: FilterGroup;
	idMode: IdMode;
	idA: string;
	idB: string;
	globalLogic: Logic;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RANKS = ["FA/FS", "LF", "PR", "FI", "SC", "MG"];
const BASES = ["KHH", "RMQ", "TSA"];
const GENDERS: { val: string; label: string }[] = [
	{ val: "f", label: "女" },
	{ val: "m", label: "男" },
];
const AC_TYPES = ["ATR", "B738"];

const RANK_COLORS: Record<string, string> = {
	FA: "#64748b", FI: "#16a34a", FS: "#7c3aed",
	LF: "#0891b2", MG: "#9333ea", PR: "#d97706", SC: "#dc2626",
};

const BASE_COLORS: Record<string, string> = {
	TSA: "#10b981", KHH: "#06b6d4", RMQ: "#8b5cf6", TPE: "#3b82f6",
};

const DEFAULT_GROUP = (): FilterGroup => ({ inc: [], exc: [], logic: "AND" });
const DEFAULT_STATE = (): FilterState => ({
	rank: DEFAULT_GROUP(), base: DEFAULT_GROUP(),
	gender: DEFAULT_GROUP(), ac: DEFAULT_GROUP(),
	idMode: "any", idA: "", idB: "", globalLogic: "AND",
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function rankPrefix(rank: string): string {
	return rank?.split(" ")[0] ?? rank ?? "";
}

function resolveAc(emp: Employee): string[] {
	const base = emp.aircraft_type_ratings ?? [];
	const filterCol = emp.filter ?? [];
	const excluded = filterCol.includes("B738機種") ? ["B738"] : [];
	return base.filter((t) => !excluded.includes(t));
}

// ── Filter engine ─────────────────────────────────────────────────────────────

function testSimple(val: string, group: FilterGroup): boolean | null {
	const { inc, exc } = group;
	if (!inc.length && !exc.length) return null;
	// "FA/FS" tag matches either FA or FS
	const matchesExc = exc.some(e => e === val || (e === "FA/FS" && (val === "FA" || val === "FS")));
	if (matchesExc) return false;
	if (inc.length) return inc.some(i => i === val || (i === "FA/FS" && (val === "FA" || val === "FS")));
	return true;
}

function testAc(emp: Employee, group: FilterGroup): boolean | null {
	const { inc, exc, logic } = group;
	if (!inc.length && !exc.length) return null;
	const ratings = resolveAc(emp);
	if (exc.some((v) => ratings.includes(v))) return false;
	if (inc.length) {
		return logic === "AND"
			? inc.every((v) => ratings.includes(v))
			: inc.some((v) => ratings.includes(v));
	}
	return true;
}

function testId(emp: Employee, mode: IdMode, a: string, b: string): boolean | null {
	if (mode === "any") return null;
	const pid = parseInt(emp.employee_id, 10);
	const na = parseInt(a, 10);
	const nb = parseInt(b, 10);
	if (mode === "gt") return isNaN(na) ? null : pid > na;
	if (mode === "lt") return isNaN(na) ? null : pid < na;
	if (mode === "between") return isNaN(na) || isNaN(nb) ? null : pid >= na && pid <= nb;
	return null;
}

function getPool(employees: Employee[], f: FilterState): Employee[] {
	return employees.filter((emp) => {
		const tests = [
			testSimple(rankPrefix(emp.rank), f.rank),
			testSimple(emp.base?.toUpperCase(), f.base),
			testSimple(emp.gender, f.gender),
			testAc(emp, f.ac),
			testId(emp, f.idMode, f.idA, f.idB),
		].filter((t) => t !== null) as boolean[];
		if (!tests.length) return true;
		return f.globalLogic === "AND" ? tests.every(Boolean) : tests.some(Boolean);
	});
}

function buildSummary(f: FilterState): string {
	const parts: string[] = [];
	const push = (label: string, g: FilterGroup) => {
		if (g.inc.length) parts.push(`${label}: ${g.inc.join(g.logic === "OR" ? " or " : " + ")}`);
		if (g.exc.length) parts.push(`NOT ${label}: ${g.exc.join(", ")}`);
	};
	push("Rank", f.rank);
	push("Base", f.base);
	push("Gender", f.gender);
	if (f.ac.inc.length) parts.push(`AC: ${f.ac.logic === "AND" ? "all of " : "any of "}${f.ac.inc.join(", ")}`);
	if (f.ac.exc.length) parts.push(`NOT AC: ${f.ac.exc.join(", ")}`);
	if (f.idMode !== "any") {
		if (f.idMode === "gt" && f.idA) parts.push(`ID > ${f.idA}`);
		if (f.idMode === "lt" && f.idA) parts.push(`ID < ${f.idA}`);
		if (f.idMode === "between" && f.idA && f.idB) parts.push(`ID ${f.idA}–${f.idB}`);
	}
	if (!parts.length) return "No active filters — drawing from all employees";
	return parts.join("  ·  ");
}

// ── Main component ────────────────────────────────────────────────────────────

const RoulettePage = () => {
	const { user, loading, token } = useAuth();
	const router = useRouter();

	const [employees, setEmployees] = useState<Employee[]>([]);
	const [fetching, setFetching] = useState(true);
	const [filters, setFilters] = useState<FilterState>(DEFAULT_STATE());
	const [drawCount, setDrawCount] = useState(3);
	const [results, setResults] = useState<Employee[] | null>(null);
	const [poolSize, setPoolSize] = useState<number | null>(null);

	useEffect(() => {
		if (!loading && (!user || !token)) router.replace("/login");
	}, [user, token, loading, router]);

	useEffect(() => {
		if (!token) return;
		setFetching(true);
		fetch("/api/roulette/employees", {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((r) => r.json())
			.then((data) => setEmployees(data.employees ?? []))
			.catch(() => {})
			.finally(() => setFetching(false));
	}, [token]);

	const toggleTag = useCallback(
		(groupKey: "rank" | "base" | "gender" | "ac", val: string) => {
			setFilters((prev) => {
				const g = prev[groupKey];
				if (g.inc.includes(val)) return { ...prev, [groupKey]: { ...g, inc: g.inc.filter((x) => x !== val), exc: [...g.exc, val] } };
				if (g.exc.includes(val)) return { ...prev, [groupKey]: { ...g, exc: g.exc.filter((x) => x !== val) } };
				return { ...prev, [groupKey]: { ...g, inc: [...g.inc, val] } };
			});
			setResults(null);
		}, [],
	);

	const setGroupLogic = useCallback(
		(groupKey: "rank" | "base" | "gender" | "ac", logic: Logic) => {
			setFilters((prev) => ({ ...prev, [groupKey]: { ...prev[groupKey], logic } }));
			setResults(null);
		}, [],
	);

	const handleGenerate = useCallback(() => {
		const pool = getPool(employees, filters);
		setPoolSize(pool.length);
		if (pool.length === 0) { setResults([]); return; }
		const n = Math.max(1, Math.min(Number(drawCount) || 1, pool.length));
		const shuffled = [...pool].sort(() => Math.random() - 0.5);
		setResults(shuffled.slice(0, n));
	}, [employees, filters, drawCount]);

	const handleReset = useCallback(() => {
		setFilters(DEFAULT_STATE());
		setResults(null);
		setPoolSize(null);
		setDrawCount(5);
	}, []);

	const summary = buildSummary(filters);

	// ── Filter card helper ────────────────────────────────────────────────
	const FilterCard = ({
		label, groupKey, items, showLogic = true,
	}: {
		label: string;
		groupKey: "rank" | "base" | "gender" | "ac";
		items: { val: string; label: string }[];
		showLogic?: boolean;
	}) => {
		const g = filters[groupKey];
		return (
			<div className={styles.filterCard}>
				<div className={styles.filterHeader}>
					<span className={styles.filterLabel}>{label}</span>
					{showLogic && (
						<div className={styles.intraLogic}>
							{(["AND", "OR"] as Logic[]).map((l) => (
								<button key={l}
									className={`${styles.intraBtn} ${g.logic === l ? styles.intraBtnOn : ""}`}
									onClick={() => setGroupLogic(groupKey, l)}
								>{l}</button>
							))}
						</div>
					)}
				</div>
				<div className={styles.tagRow}>
					{items.map(({ val, label: lbl }) => (
						<div key={val}
							className={`${styles.tag} ${g.inc.includes(val) ? styles.tagInc : ""} ${g.exc.includes(val) ? styles.tagExc : ""}`}
							onClick={() => toggleTag(groupKey, val)}
						>
							<span className={styles.tagDot} />{lbl}
						</div>
					))}
				</div>
			</div>
		);
	};

	if (loading) return null;
	if (!user || !token) return null;

	return (
		<>
			<Navbar />
			<div className={styles.page}>
				<div className={styles.container}>

					{/* Page header */}
					<div className={styles.pageHeader}>
						<span className={styles.pageIcon}>🎲</span>
						<div>
							<h1 className={styles.pageTitle}>天選之人</h1>
							<p className={styles.pageSubtitle}>隨機抽籤 · Random Draw</p>
						</div>
						{fetching && <div className={styles.loadingSpinner} style={{ marginLeft: "auto" }} />}
						{!fetching && <span className={styles.employeeCount}>{employees.length} 人資料庫</span>}
					</div>

					{/* Filters row — horizontal on desktop */}
					<div className={styles.filtersGrid}>
						<FilterCard label="Rank" groupKey="rank" items={RANKS.map(r => ({ val: r, label: r }))} />
						<FilterCard label="Base" groupKey="base" items={BASES.map(b => ({ val: b, label: b }))} />
						<FilterCard label="Gender" groupKey="gender" items={GENDERS} showLogic={false} />
						<FilterCard label="Aircraft" groupKey="ac" items={AC_TYPES.map(t => ({ val: t, label: t }))} />
					</div>

					{/* ID range */}
					<div className={styles.filterCard}>
						<div className={styles.filterHeader}>
							<span className={styles.filterLabel}>Employee ID</span>
							<div className={styles.idModeRow}>
								{(["any", "gt", "lt", "between"] as IdMode[]).map((m) => (
									<button key={m}
										className={`${styles.idModeBtn} ${filters.idMode === m ? styles.idModeBtnOn : ""}`}
										onClick={() => { setFilters((prev) => ({ ...prev, idMode: m, idA: "", idB: "" })); setResults(null); }}
									>
										{m === "any" ? "Any" : m === "gt" ? ">" : m === "lt" ? "<" : "⇔"}
									</button>
								))}
							</div>
						</div>
						{filters.idMode !== "any" && (
							<div className={styles.idInputRow}>
								<span className={styles.idModeHint}>
									{filters.idMode === "gt" ? "Greater than" : filters.idMode === "lt" ? "Less than" : "Between"}
								</span>
								<input type="number" className={styles.idInput} placeholder="00000"
									min={10000} max={99999} maxLength={5}
									value={filters.idA}
									onChange={(e) => { setFilters((prev) => ({ ...prev, idA: e.target.value.slice(0,5) })); setResults(null); }}
								/>
								{filters.idMode === "between" && (
									<>
										<span className={styles.idSep}>—</span>
										<input type="number" className={styles.idInput} placeholder="00000"
											min={10000} max={99999} maxLength={5}
											value={filters.idB}
											onChange={(e) => { setFilters((prev) => ({ ...prev, idB: e.target.value.slice(0,5) })); setResults(null); }}
										/>
									</>
								)}
							</div>
						)}
					</div>

					{/* Between-groups logic + legend */}
					<div className={styles.betweenBar}>
						<div className={styles.legendGroup}>
							<span className={styles.legendItem}><span className={styles.legendDotInc} /> include</span>
							<span className={styles.legendItem}><span className={styles.legendDotExc} /> exclude</span>
							<span className={styles.legendItem}><span className={styles.legendDotClr} /> clear (3rd tap)</span>
						</div>
						<div className={styles.betweenRight}>
							<span className={styles.betweenLabel}>Between groups:</span>
							<div className={styles.globalLogicRow}>
								{(["AND", "OR"] as Logic[]).map((l) => (
									<button key={l}
										className={`${styles.globalBtn} ${filters.globalLogic === l ? styles.globalBtnOn : ""}`}
										onClick={() => { setFilters((prev) => ({ ...prev, globalLogic: l })); setResults(null); }}
									>{l}</button>
								))}
							</div>
						</div>
					</div>

					{/* Active summary */}
					<div className={styles.activeSummary}>{summary}</div>

					{/* Controls */}
					<div className={styles.bottomRow}>
						<span className={styles.drawLabel}>Draw</span>
						<div className={styles.stepper}>
							<button className={styles.stepBtn} onClick={() => setDrawCount(c => Math.max(1, c - 1))} aria-label="decrease">−</button>
							<span className={styles.stepValue}>{drawCount}</span>
							<button className={styles.stepBtn} onClick={() => setDrawCount(c => Math.min(200, c + 1))} aria-label="increase">+</button>
						</div>
						<span className={styles.drawLabel}>names</span>
						<button className={styles.btnGenerate} onClick={handleGenerate} disabled={fetching}>
							Generate 🎲
						</button>
						<button className={styles.btnReset} onClick={handleReset}>Reset</button>
					</div>

					{/* Results */}
					{results !== null && (
						<div className={styles.resultSection}>
							<div className={styles.resultHeader}>
								<span className={styles.resultTitle}>抽籤結果</span>
								{poolSize !== null && (
									<span className={styles.poolBadge}>
										符合 {poolSize} 人{results.length > 0 ? ` · 抽出 ${results.length} 人` : ""}
									</span>
								)}
							</div>
							{results.length === 0 ? (
								<div className={styles.emptyMsg}>No employees match these filters</div>
							) : (
								<div className={styles.resultGrid}>
									{results.map((emp, i) => {
										const rk = rankPrefix(emp.rank);
										const rankColor = RANK_COLORS[rk] || "#64748b";
										const baseColor = BASE_COLORS[emp.base?.toUpperCase()] || "#4a9eff";
										return (
											<div key={emp.employee_id} className={styles.resultCard}>
												<div className={styles.cardIndex}>{i + 1}</div>
												<div className={styles.cardAvatar}>
													<Avatar
														employeeId={emp.employee_id}
														fullName={emp.full_name}
														size="large"
													/>
												</div>
												<div className={styles.cardBody}>
													<div className={styles.cardName}>{emp.full_name}</div>
													<div className={styles.cardId}>{emp.employee_id}</div>
													<div className={styles.cardPills}>
														<span className={styles.rankPill} style={{ background: `${rankColor}22`, border: `1px solid ${rankColor}55`, color: rankColor }}>
															{rk}
														</span>
														<span className={styles.basePill} style={{ background: `${baseColor}22`, border: `1px solid ${baseColor}55`, color: baseColor }}>
															{emp.base}
														</span>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</>
	);
};

export default RoulettePage;