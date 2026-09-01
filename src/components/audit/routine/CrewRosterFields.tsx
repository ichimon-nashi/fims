// src/components/audit/routine/CrewRosterFields.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./CrewRosterFields.module.css";
import { useAuth } from "@/context/AuthContext";

export interface CabinCrewMember {
	position: string; // e.g. "F1", "1L" — from a fixed list per fleet, see DUTY_OPTIONS
	name: string;
	employee_id?: string; // set when picked from the crew search, absent if hand-typed
}

// Only two fleets exist today — confirmed, not guessed. A tail matching
// neither prefix falls back to free-text duty entry rather than silently
// picking one or the other.
const DUTY_OPTIONS: Record<string, string[]> = {
	ATR: ["F1", "F2"],
	B738: ["1L", "1R", "3L", "3R", "Z2", "3RA"],
};

function fleetFromTail(tail: string): "ATR" | "B738" | null {
	if (/^B168/i.test(tail)) return "ATR";
	if (/^B186/i.test(tail)) return "B738";
	return null;
}

export interface RosterHeaderData {
	audit_date: string;
	aircraft_tail: string;
	flight_no: string;
	route: string;
	ca_name: string;
	fo_name: string;
	cabin_crew: CabinCrewMember[];
}

interface Props {
	value: RosterHeaderData;
	onChange: (value: RosterHeaderData) => void;
	showErrors?: boolean; // true after a failed submit attempt — highlights empty required fields
}

// required for the summary line to render as "complete" and auto-collapse —
// cabin crew list can be empty (some aircraft types/configs may have none
// entered at header-fill time and added later), everything else must have content
function isComplete(v: RosterHeaderData): boolean {
	return Boolean(v.audit_date && v.aircraft_tail && v.ca_name);
}

export default function CrewRosterFields({ value, onChange, showErrors }: Props) {
	// explicit state, not derived from isComplete() on every render — that
	// was the bug: recalculating "should collapse" on every keystroke meant
	// the component collapsed the instant the 3rd required field got its
	// first character, unmounting the input being actively typed into.
	// Collapse now only happens via onBlur (below) or explicit button clicks.
	const [expanded, setExpanded] = useState(true);
	const { token } = useAuth();

	function collapseIfComplete() {
		if (isComplete(value)) setExpanded(false);
	}

	const fleet = fleetFromTail(value.aircraft_tail);
	const dutyOptions = fleet ? DUTY_OPTIONS[fleet] : null;

	// only one row's dropdown open at a time — simplest interaction, and
	// nothing about entering a roster needs two searches open simultaneously
	const [searchIndex, setSearchIndex] = useState<number | null>(null);
	const [searchResults, setSearchResults] = useState<
		{ employee_id: string; full_name: string }[]
	>([]);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	function searchCrew(index: number, query: string) {
		setSearchIndex(index);
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(async () => {
			if (!token) return;
			const params = new URLSearchParams();
			if (query.trim()) params.set("q", query.trim());
			if (fleet) params.set("fleet", fleet);
			const res = await fetch(`/api/audit/routine/crew-search?${params}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			setSearchResults(data.records ?? []);
		}, 300);
	}

	function set<K extends keyof RosterHeaderData>(key: K, val: RosterHeaderData[K]) {
		onChange({ ...value, [key]: val });
	}

	function addCrew() {
		set("cabin_crew", [...value.cabin_crew, { position: "", name: "" }]);
	}

	function updateCrew(index: number, field: keyof CabinCrewMember, val: string) {
		const next = value.cabin_crew.slice();
		next[index] = { ...next[index], [field]: val };
		set("cabin_crew", next);
	}

	function removeCrew(index: number) {
		set(
			"cabin_crew",
			value.cabin_crew.filter((_, i) => i !== index),
		);
	}

	if (!expanded) {
		return (
			<div className={styles.summaryBar}>
				<div className={styles.summaryText}>
					<span className={styles.checkIcon}>✓</span>
					<span>{value.audit_date}</span>
					<span className={styles.dot}>·</span>
					<span>{value.aircraft_tail}</span>
					{(value.flight_no || value.route) && (
						<>
							<span className={styles.dot}>·</span>
							<span>
								{value.flight_no} {value.route}
							</span>
						</>
					)}
					<span className={styles.dot}>·</span>
					<span>組員 {value.cabin_crew.length + (value.fo_name ? 2 : 1)} 人</span>
				</div>
				<button className={styles.editBtn} onClick={() => setExpanded(true)}>
					編輯
				</button>
			</div>
		);
	}

	return (
		<div
			className={styles.expanded}
			onBlur={(e) => {
				// only collapse if focus is leaving the whole section, not
				// moving to another field inside it (e.g. CA → FO via Tab)
				if (!e.currentTarget.contains(e.relatedTarget as Node)) {
					collapseIfComplete();
				}
			}}
		>
			<div className={styles.infoGrid}>
				<div className={styles.field}>
					<label>日期</label>
					<input
						type="date"
						className={showErrors && !value.audit_date ? styles.inputError : undefined}
						value={value.audit_date}
						onChange={(e) => set("audit_date", e.target.value)}
					/>
				</div>

				<div className={styles.field}>
					<label>機號</label>
					<div className={showErrors && !value.aircraft_tail ? styles.tailInputWrapError : styles.tailInputWrap}>
						<span className={styles.tailPrefix}>B</span>
						<input
							className={styles.tailInput}
							value={value.aircraft_tail.replace(/^B/i, "")}
							onChange={(e) => set("aircraft_tail", "B" + e.target.value.toUpperCase().replace(/^B/i, ""))}
							placeholder="18317"
						/>
					</div>
				</div>

				<div className={styles.field}>
					<label>班號</label>
					<input value={value.flight_no} onChange={(e) => set("flight_no", e.target.value)} />
				</div>
				<div className={styles.field}>
					<label>航段</label>
					<input value={value.route} onChange={(e) => set("route", e.target.value.toUpperCase())} placeholder="TPE-NRT" />
				</div>
			</div>

			<div className={styles.compactRow}>
				<div className={styles.compactField}>
					<label>CA</label>
					<input
						className={showErrors && !value.ca_name ? styles.inputError : undefined}
						value={value.ca_name}
						onChange={(e) => set("ca_name", e.target.value)}
					/>
				</div>
				<div className={styles.compactField}>
					<label>FO</label>
					<input value={value.fo_name} onChange={(e) => set("fo_name", e.target.value)} />
				</div>
			</div>

			<div className={styles.crewSection}>
				<p className={styles.crewLabel}>客艙組員{!fleet && value.aircraft_tail && "（機號未對應機隊，職務將以手動輸入）"}</p>
				{value.cabin_crew.map((c, i) => (
					<div key={i} className={styles.crewRowWrap}>
						<div className={styles.crewRow}>
							{dutyOptions ? (
								<select
									className={styles.crewPosition}
									value={c.position}
									onChange={(e) => updateCrew(i, "position", e.target.value)}
								>
									<option value="">職務</option>
									{dutyOptions.map((d) => (
										<option key={d} value={d}>
											{d}
										</option>
									))}
								</select>
							) : (
								<input
									className={styles.crewPosition}
									value={c.position}
									onChange={(e) => updateCrew(i, "position", e.target.value)}
									placeholder="職務"
								/>
							)}
							<input
								className={styles.crewName}
								value={c.name}
								onChange={(e) => {
									const val = e.target.value;
									const next = value.cabin_crew.slice();
									next[i] = { ...next[i], name: val, employee_id: "" }; // single atomic update — two separate updateCrew calls here previously clobbered each other via stale closures
									set("cabin_crew", next);
									searchCrew(i, val);
								}}
								onFocus={() => searchCrew(i, c.name)}
								placeholder="搜尋員編或姓名"
							/>
							<button className={styles.removeCrewBtn} onClick={() => removeCrew(i)}>
								✕
							</button>
						</div>
						{searchIndex === i && searchResults.length > 0 && (
							<div className={styles.crewDropdown}>
								{searchResults
									.filter(
										(r) => !value.cabin_crew.some((c, idx) => idx !== i && c.employee_id === r.employee_id),
									)
									.map((r) => (
									<button
										key={r.employee_id}
										className={styles.crewOption}
										onClick={() => {
											const next = value.cabin_crew.slice();
											next[i] = { ...next[i], name: r.full_name, employee_id: r.employee_id };
											set("cabin_crew", next);
											setSearchIndex(null);
											setSearchResults([]);
										}}
									>
										<img
											className={styles.crewAvatar}
											src={`https://rhdpkxkmugimtlbdizfp.supabase.co/storage/v1/object/public/avatars/${r.employee_id}.png`}
											onError={(e) => {
												(e.target as HTMLImageElement).src =
													"https://rhdpkxkmugimtlbdizfp.supabase.co/storage/v1/object/public/avatars/avatar-default.png";
											}}
											alt=""
										/>
										<span>
											{r.employee_id} · {r.full_name}
										</span>
									</button>
								))}
							</div>
						)}
					</div>
				))}
				<button className={styles.addCrewBtn} onClick={addCrew}>
					+ 新增組員
				</button>
			</div>

			{isComplete(value) && (
				<button className={styles.doneBtn} onClick={() => setExpanded(false)}>
					完成
				</button>
			)}
		</div>
	);
}