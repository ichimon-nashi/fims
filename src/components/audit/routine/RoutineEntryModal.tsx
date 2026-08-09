// src/components/audit/routine/RoutineEntryModal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./RoutineEntryModal.module.css";
import { RoutineAuditEntry, CreateEntryPayload } from "@/lib/routineAudit.types";
import { EF_ATTRIBUTE_CATEGORIES } from "@/lib/sms.constants";
import { SAM_AREAS, SAM_CODE_MAP, EF_CODE_MAP } from "@/lib/routineAudit.constants";

interface FindingDraft {
	id?: string; // present = existing DB row (PATCH/DELETE on save/remove); absent = new draft (POST on save, local-only on remove)
	finding: string;
	corrective_action: string;
	result: "OK" | "NG";
	sam_code: string | null;
	ef_code: string | null;
	is_non_flight_safety: boolean;
}

interface HeaderDraft {
	entry_no?: string; // present only when editing — create mode auto-generates via the atomic function, never set here
	audit_date: string;
	report_year: number;
	report_month: number;
	auditor_name: string;
	aircraft_tail: string;
	flight_no: string;
	route: string;
	special_remarks: string[]; // e.g. ["春節加強查核", "一級自我督察"]
}

interface Props {
	open: boolean;
	mode: "create" | "edit";
	editingEntries: RoutineAuditEntry[] | null; // all findings sharing one entry_no
	onClose: () => void;
	onSaved: () => void;
}

const emptyHeader: HeaderDraft = {
	audit_date: "",
	report_year: new Date().getFullYear(),
	report_month: new Date().getMonth() + 1,
	auditor_name: "",
	aircraft_tail: "",
	flight_no: "",
	route: "",
	special_remarks: [],
};

const emptyFinding: FindingDraft = {
	finding: "",
	corrective_action: "",
	result: "OK",
	sam_code: null,
	ef_code: null,
	is_non_flight_safety: false,
};

// known recurring markers — add a new label here when one surfaces; no
// schema change needed unless it's a genuinely new kind of data, not just
// another label
const KNOWN_SPECIAL_REMARKS = ["春節加強查核", "一級自我督察"];


// Popovers are rendered inside a scrolling modal body, so plain
// `position: absolute` breaks once the trigger is near the bottom of that
// scroll area (it did — visibly clipped the SAM code list against the
// viewport edge instead of the panel). Computing viewport coordinates from
// the trigger's real position and flipping upward when there isn't room
// below fixes it regardless of where the field sits.
// Excel prefixes a cell with a leading ' to force text formatting (e.g. so
// a tail number or flight number isn't auto-converted to a number). That
// character survives copy-paste into a plain text input, so every field
// likely to receive pasted spreadsheet data strips it on the way in.
function stripExcelQuote(value: string): string {
	return value.startsWith("'") ? value.slice(1) : value;
}

// lets someone type "16855" instead of "B16855" — strips any leading B
// first (case-insensitive) so re-prepending never doubles up regardless of
// whether they typed the B themselves
function normalizeTail(raw: string): string {
	const cleaned = stripExcelQuote(raw).trim().toUpperCase().replace(/^B/, "");
	return cleaned ? `B${cleaned}` : "";
}

// Matches the exact column order from the import template's 查核紀錄 sheets:
// 序,日期,編號,查核員,機號,班次,航段,記錄,處置,結果,SAM分類,SAM代碼,非飛安相關
interface ParsedDate {
	iso: string | null; // full YYYY-MM-DD, only when a year was present
	month: number | null;
	day: number | null;
}

function parseDatePasted(raw: string): ParsedDate {
	const cleaned = raw.trim();
	// full date: YYYY-MM-DD or YYYY/M/D (with or without leading zeros)
	const full = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
	if (full) {
		const [, y, mo, d] = full;
		return {
			iso: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`,
			month: Number(mo),
			day: Number(d),
		};
	}
	// partial: M/D with no year (common when the source sheet has no year
	// column) — month/day are still usable, year has to come from the user
	const partial = cleaned.match(/^(\d{1,2})[-/](\d{1,2})$/);
	if (partial) {
		const [, mo, d] = partial;
		return { iso: null, month: Number(mo), day: Number(d) };
	}
	return { iso: null, month: null, day: null };
}

interface ParsedPaste {
	header: Partial<HeaderDraft>;
	findings: FindingDraft[];
	warnings: string[];
}

function parseExcelPaste(text: string): ParsedPaste {
	const warnings: string[] = [];
	let lines = text
		.split(/\r?\n/)
		.map((l) => l.split("\t").map((c) => stripExcelQuote(c.trim())))
		.filter((cols) => cols.some((c) => c !== ""));

	// tolerate a copied header row (序, 日期, ...) by skipping it
	if (lines.length > 0 && lines[0][0] === "序") lines = lines.slice(1);

	if (lines.length === 0) {
		return { header: {}, findings: [], warnings: ["未偵測到任何資料列"] };
	}

	const parsedFindings: FindingDraft[] = [];
	let header: Partial<HeaderDraft> = {};

	lines.forEach((cols, i) => {
		const [, dateRaw, , auditorRaw, tailRaw, flightRaw, routeRaw, findingRaw, correctiveRaw, , , samRaw, flagRaw] = cols;

		if (i === 0) {
			const parsed = dateRaw ? parseDatePasted(dateRaw) : { iso: null, month: null, day: null };
			let audit_date = "";
			let report_year = new Date().getFullYear();
			let report_month = new Date().getMonth() + 1;

			if (parsed.iso) {
				audit_date = parsed.iso;
				report_year = Number(parsed.iso.slice(0, 4));
				report_month = parsed.month!;
			} else if (parsed.month && parsed.day) {
				// no year in the source (e.g. "2/11") — represent as "-MM-DD"
				// so DateField shows month/day filled and year genuinely
				// blank for the user to complete, rather than guessing a
				// year that might be wrong
				audit_date = `-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}`;
				report_month = parsed.month;
				warnings.push(`日期「${dateRaw}」未包含年份，已填入月/日，請手動選擇年度`);
			} else if (dateRaw) {
				warnings.push(`日期「${dateRaw}」格式無法辨識，請手動選擇`);
			}

			// source stores routes as "TSA/KNH" — normalize to the internal
			// "TSA-KNH" format regardless of which separator was used, since
			// RouteField splits on "-" and previously left destination empty
			// when it got a "/"-separated value it didn't recognize
			const routeParts = routeRaw ? routeRaw.split(/[/-]/).filter(Boolean) : [];
			const route = routeParts.length >= 2 ? routeParts.join("-") : routeRaw ?? "";

			header = {
				audit_date,
				report_year,
				report_month,
				auditor_name: auditorRaw ?? "",
				aircraft_tail: tailRaw ? normalizeTail(tailRaw) : "",
				flight_no: flightRaw ?? "",
				route,
			};
		}

		const samCode = samRaw?.trim().toUpperCase();
		const resolvedSam = samCode && samCode !== "-" ? SAM_CODE_MAP[samCode] : undefined;
		if (samCode && samCode !== "-" && !resolvedSam) {
			warnings.push(`第${i + 1}列：SAM代碼「${samCode}」找不到對應項目，已略過`);
		}

		if (!findingRaw) {
			warnings.push(`第${i + 1}列缺少記錄內容，已略過此列`);
			return;
		}

		parsedFindings.push({
			finding: findingRaw,
			corrective_action: correctiveRaw ?? "",
			result: "OK",
			sam_code: resolvedSam ? samCode! : null,
			ef_code: null, // not part of the excel template — pick manually after paste
			is_non_flight_safety: flagRaw?.trim().toLowerCase() === "v",
		});
	});

	if (parsedFindings.length === 0 && lines.length > 0) {
		warnings.push("所有列都缺少記錄內容，無法解析");
	}

	return { header, findings: parsedFindings, warnings };
}

function computePopoverStyle(
	triggerEl: HTMLElement | null,
	estimatedHeight: number
): React.CSSProperties {
	if (!triggerEl) return { display: "none" };
	const rect = triggerEl.getBoundingClientRect();
	const spaceBelow = window.innerHeight - rect.bottom;
	const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;

	return {
		position: "fixed",
		left: rect.left,
		width: rect.width,
		maxHeight: Math.max(160, (openUp ? rect.top : spaceBelow) - 16),
		...(openUp
			? { bottom: window.innerHeight - rect.top + 4 }
			: { top: rect.bottom + 4 }),
	};
}

// --- inline sub-components: each is only ever used inside this modal, so
// they stay here rather than becoming standalone files (matches the
// ProgressDeck/AudioPlayButton-in-TestInterface convention) ---

interface UserOption {
	employee_id: string;
	full_name: string;
	rank: string;
	avatar_url: string;
}

function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
	const [segs, setSegs] = useState(() => {
		const [y, m, d] = value ? value.split("-") : ["", "", ""];
		return { y: y || "", m: m || "", d: d || "" };
	});
	const yearRef = useRef<HTMLInputElement>(null);
	const monthRef = useRef<HTMLInputElement>(null);
	const dayRef = useRef<HTMLInputElement>(null);

	// only resync from the parent on a genuine external change (e.g. loading
	// an existing record into edit mode) — never mid-typing, since a partial
	// date intentionally does NOT round-trip through onChange below
	useEffect(() => {
		const [y, m, d] = value ? value.split("-") : ["", "", ""];
		setSegs({ y: y || "", m: m || "", d: d || "" });
	}, [value]);

	function commitIfComplete(next: { y: string; m: string; d: string }) {
		// only when every segment is at FULL length — not just non-empty.
		// Committing on a single digit (length >= 1) was the bug: it round-
		// tripped "1" through the parent as "01" mid-keystroke, and the
		// resync-from-parent effect then overwrote the user's own typing.
		if (next.y.length === 4 && next.m.length === 2 && next.d.length === 2) {
			onChange(`${next.y}-${next.m}-${next.d}`);
		}
	}

	// blur is the one safe place to pad a shorthand single digit (e.g. "1"
	// for January) to "01" — it only fires once, when the user is actually
	// done with that field, never mid-typing
	function padOnBlur(field: "m" | "d") {
		setSegs((s) => {
			const v = s[field];
			if (v.length === 1) {
				const next = { ...s, [field]: v.padStart(2, "0") };
				commitIfComplete(next);
				return next;
			}
			commitIfComplete(s);
			return s;
		});
	}

	return (
		<div className={styles.dateWrap}>
			<input
				ref={yearRef}
				className={styles.dateYear}
				value={segs.y}
				placeholder="yyyy"
				inputMode="numeric"
				maxLength={4}
				onChange={(e) => {
					const v = e.target.value.replace(/\D/g, "").slice(0, 4);
					const next = { ...segs, y: v };
					setSegs(next);
					commitIfComplete(next);
					if (v.length === 4) monthRef.current?.focus();
				}}
			/>
			<span className={styles.dateSep}>/</span>
			<input
				ref={monthRef}
				className={styles.dateSmall}
				value={segs.m}
				placeholder="mm"
				inputMode="numeric"
				maxLength={2}
				onChange={(e) => {
					const v = e.target.value.replace(/\D/g, "").slice(0, 2);
					const next = { ...segs, m: v };
					setSegs(next);
					commitIfComplete(next);
					if (v.length === 2) dayRef.current?.focus();
				}}
				onBlur={() => padOnBlur("m")}
			/>
			<span className={styles.dateSep}>/</span>
			<input
				ref={dayRef}
				className={styles.dateSmall}
				value={segs.d}
				placeholder="dd"
				inputMode="numeric"
				maxLength={2}
				onChange={(e) => {
					const v = e.target.value.replace(/\D/g, "").slice(0, 2);
					const next = { ...segs, d: v };
					setSegs(next);
					commitIfComplete(next);
				}}
				onBlur={() => padOnBlur("d")}
			/>
		</div>
	);
}

function AuditorField({ value, onChange }: { value: string; onChange: (name: string) => void }) {
	const [query, setQuery] = useState(value);
	const [options, setOptions] = useState<UserOption[]>([]);
	const [open, setOpen] = useState(false);
	const [popStyle, setPopStyle] = useState<React.CSSProperties>({});
	const [searchError, setSearchError] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => setQuery(value), [value]);

	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			const token = localStorage.getItem("token");
			if (!token) return;
			const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
			fetch(`/api/audit/firstlevel/users${params}`, {
				headers: { Authorization: `Bearer ${token}` },
			})
				.then(async (res) => {
					if (!res.ok) {
						const body = await res.json().catch(() => ({}));
						throw new Error(body.error || `HTTP ${res.status}`);
					}
					return res.json();
				})
				.then((data) => {
					setOptions(data.users ?? []);
					setSearchError(false);
				})
				.catch((err) => {
					console.error("查核員搜尋失敗:", err);
					setOptions([]);
					setSearchError(true);
				});
		}, 200);
	}, [query]);

	function openDropdown() {
		setPopStyle(computePopoverStyle(inputRef.current, 200));
		setOpen(true);
	}

	function select(u: UserOption) {
		setQuery(u.full_name);
		onChange(u.full_name);
		setOpen(false);
	}

	return (
		<div className={styles.auditorWrap}>
			<input
				ref={inputRef}
				value={query}
				onFocus={openDropdown}
				onChange={(e) => {
					setQuery(e.target.value);
					onChange(e.target.value); // stays valid free text even with no match
					openDropdown();
				}}
				onBlur={() => setTimeout(() => setOpen(false), 120)}
				placeholder="輸入姓名或員編"
			/>
			{open && searchError && (
				<div className={styles.auditorDropdown} style={popStyle}>
					<div className={styles.auditorError}>搜尋失敗，請檢查網路或稍後再試</div>
				</div>
			)}
			{open && !searchError && options.length > 0 && (
				<div className={styles.auditorDropdown} style={popStyle}>
					{options.map((u) => (
						<div key={u.employee_id} className={styles.auditorOption} onMouseDown={() => select(u)}>
							<img
								src={u.avatar_url}
								alt=""
								className={styles.auditorAvatar}
								onError={(e) => {
									(e.target as HTMLImageElement).style.visibility = "hidden";
								}}
							/>
							<span>{u.full_name}</span>
							<span className={styles.auditorMeta}>{u.employee_id}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function SamCodeField({ value, onChange }: { value: string | null; onChange: (code: string | null) => void }) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string>(
		SAM_AREAS[0]?.categories[0]?.name ?? ""
	);

	const selected = value ? SAM_CODE_MAP[value] : null;

	// flatten to a single category list for tier 1 — area is kept in the
	// data for the pie chart's 四大領域 grouping, but the picker itself is
	// two tiers (分類/代碼), not three
	const categories = useMemo(
		() => SAM_AREAS.flatMap((area) => area.categories.map((cat) => ({ ...cat, areaCode: area.code }))),
		[]
	);
	const currentCategory = categories.find((c) => c.name === selectedCategory);

	const searchResults = useMemo(() => {
		if (!query.trim()) return null;
		const q = query.trim().toLowerCase();
		return Object.values(SAM_CODE_MAP).filter(
			(c) =>
				c.code.toLowerCase().includes(q) ||
				c.category.toLowerCase().includes(q) ||
				c.description_zh.toLowerCase().includes(q) ||
				c.description_en.toLowerCase().includes(q)
		);
	}, [query]);

	function openPicker() {
		setQuery("");
		if (selected) setSelectedCategory(selected.category);
		setOpen(true);
	}

	function select(code: string | null) {
		onChange(code);
		setOpen(false);
	}

	return (
		<div className={styles.efWrap}>
			<div className={styles.triggerRow}>
				<button type="button" className={styles.samTrigger} onClick={openPicker}>
					{selected ? (
						<span>
							<span className={styles.samCode}>{selected.code}</span>
							{" — "}
							{selected.description_zh}
						</span>
					) : (
						<span className={styles.samPlaceholder}>選擇SAM代碼</span>
					)}
				</button>
				{selected && (
					<button
						type="button"
						className={styles.clearBtn}
						onClick={() => onChange(null)}
						title="清除選擇"
					>
						×
					</button>
				)}
			</div>

			{open && (
				<div className={styles.efOverlay} onMouseDown={() => setOpen(false)}>
					<div className={styles.efModal} onMouseDown={(e) => e.stopPropagation()}>
						<div className={styles.efHeader}>
							<h4>SAM代碼</h4>
							<button className={styles.closeBtn} onClick={() => setOpen(false)}>×</button>
						</div>

						<input
							autoFocus
							className={styles.efSearch}
							placeholder="搜尋代碼、分類或關鍵字..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>

						{searchResults ? (
							<div className={styles.efSearchResults}>
								{searchResults.length === 0 ? (
									<p className={styles.samEmpty}>查無符合的代碼</p>
								) : (
									searchResults.map((c) => (
										<div key={c.code} className={styles.efSearchOption} onMouseDown={() => select(c.code)}>
											<span>
												<strong>{c.code}</strong> {c.description_zh}
												<span className={styles.efSearchMeta}>{c.category}</span>
											</span>
										</div>
									))
								)}
							</div>
						) : (
							<div className={styles.samPanels}>
								<div className={styles.efPanelCol}>
									<p className={styles.efPanelLabel}>分類</p>
									<div
										className={!selectedCategory ? styles.efCatBtnActive : styles.efCatBtn}
										onMouseDown={() => select(null)}
										role="button"
									>
										<strong>-</strong>
										<span>無 (正常/無發現)</span>
									</div>
									{categories.map((cat) => (
										<button
											key={cat.name}
											className={selectedCategory === cat.name ? styles.efCatBtnActive : styles.efCatBtn}
											onClick={() => setSelectedCategory(cat.name)}
										>
											<span>{cat.name}</span>
										</button>
									))}
								</div>

								<div className={styles.efPanelColWide}>
									<p className={styles.efPanelLabel}>代碼</p>
									{currentCategory?.codes.map((c) => (
										<div
											key={c.code}
											className={styles.efSearchOption}
											onMouseDown={() => select(c.code)}
										>
											<span>
												<strong>{c.code}</strong> {c.description_zh}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

const MAX_ROUTE_SEGMENTS = 5;

function RouteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	const segments = value ? value.split("-") : ["", ""];
	// always at least 2 segments (origin + destination) even if the stored
	// value is momentarily empty or malformed
	const padded = segments.length >= 2 ? segments : ["", ""];

	function setSegment(index: number, raw: string) {
		const cleaned = stripExcelQuote(raw).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
		const next = [...padded];
		next[index] = cleaned;
		onChange(next.join("-"));
	}
	function addSegment() {
		if (padded.length >= MAX_ROUTE_SEGMENTS) return;
		onChange([...padded, ""].join("-"));
	}
	function removeSegment(index: number) {
		if (padded.length <= 2) return; // origin + destination is the minimum
		onChange(padded.filter((_, i) => i !== index).join("-"));
	}

	return (
		<div className={styles.routeWrap}>
			{padded.map((seg, i) => (
				<div key={i} className={styles.routeSegment}>
					{i > 0 && <span className={styles.routeArrow}>⇄</span>}
					<input
						value={seg}
						onChange={(e) => setSegment(i, e.target.value)}
						placeholder={i === 0 ? "TSA" : "MZG"}
						maxLength={3}
						className={styles.routeDestInput}
					/>
					{padded.length > 2 && (
						<button
							type="button"
							className={styles.routeRemoveBtn}
							onClick={() => removeSegment(i)}
							title="移除此站"
						>
							×
						</button>
					)}
				</div>
			))}
			{padded.length < MAX_ROUTE_SEGMENTS && (
				<button type="button" className={styles.routeAddBtn} onClick={addSegment} title="新增經停站">
					+
				</button>
			)}
		</div>
	);
}

function EfCodeField({ value, onChange }: { value: string | null; onChange: (code: string | null) => void }) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState(EF_ATTRIBUTE_CATEGORIES[0]?.code ?? "");
	const [selectedMiddle, setSelectedMiddle] = useState(
		EF_ATTRIBUTE_CATEGORIES[0]?.middleCategories[0]?.code ?? ""
	);

	const selected = value ? EF_CODE_MAP[value] : null;

	function openPicker() {
		setQuery("");
		if (selected) {
			// jump straight to the currently-selected code's location on reopen
			const cat = EF_ATTRIBUTE_CATEGORIES.find((c) =>
				c.middleCategories.some((m) => m.code === selected.attributeName || m.subcodes.some((s) => s.code === value))
			);
			if (cat) {
				setSelectedCategory(cat.code);
				const mid = cat.middleCategories.find((m) => m.subcodes.some((s) => s.code === value));
				if (mid) setSelectedMiddle(mid.code);
			}
		}
		setOpen(true);
	}

	function select(code: string | null) {
		onChange(code);
		setOpen(false);
	}

	const category = EF_ATTRIBUTE_CATEGORIES.find((c) => c.code === selectedCategory);
	const middle = category?.middleCategories.find((m) => m.code === selectedMiddle);

	const searchResults = useMemo(() => {
		if (!query.trim()) return null;
		const q = query.trim().toLowerCase();
		return EF_ATTRIBUTE_CATEGORIES.flatMap((cat) =>
			cat.middleCategories.flatMap((mid) =>
				mid.subcodes
					.filter((s) => s.code.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
					.map((s) => ({ ...s, categoryName: cat.name, middleName: mid.name }))
			)
		);
	}, [query]);

	return (
		<div className={styles.efWrap}>
			<div className={styles.triggerRow}>
				<button type="button" className={styles.samTrigger} onClick={openPicker}>
					{selected ? (
						<span>
							<span className={styles.samCode}>{selected.code}</span>
							{" — "}
							{selected.description}
						</span>
					) : (
						<span className={styles.samPlaceholder}>選擇EF屬性代碼</span>
					)}
				</button>
				{selected && (
					<button
						type="button"
						className={styles.clearBtn}
						onClick={() => onChange(null)}
						title="清除選擇"
					>
						×
					</button>
				)}
			</div>

			{open && (
				<div className={styles.efOverlay} onMouseDown={() => setOpen(false)}>
					<div className={styles.efModal} onMouseDown={(e) => e.stopPropagation()}>
						<div className={styles.efHeader}>
							<h4>EF屬性代碼</h4>
							<button className={styles.closeBtn} onClick={() => setOpen(false)}>×</button>
						</div>

						<input
							autoFocus
							className={styles.efSearch}
							placeholder="搜尋代碼或描述..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>

						{searchResults ? (
							<div className={styles.efSearchResults}>
								{searchResults.length === 0 ? (
									<p className={styles.samEmpty}>查無符合的代碼</p>
								) : (
									searchResults.map((s) => (
										<div key={s.code} className={styles.efSearchOption} onMouseDown={() => select(s.code)}>
											<span>
												<strong>{s.code}</strong> {s.description}
												<span className={styles.efSearchMeta}>{s.categoryName} / {s.middleName}</span>
											</span>
										</div>
									))
								)}
							</div>
						) : (
							<div className={styles.efPanels}>
								<div className={styles.efPanelCol}>
									<p className={styles.efPanelLabel}>分類</p>
									{EF_ATTRIBUTE_CATEGORIES.map((cat) => (
										<button
											key={cat.code}
											className={selectedCategory === cat.code ? styles.efCatBtnActive : styles.efCatBtn}
											onClick={() => {
												setSelectedCategory(cat.code);
												setSelectedMiddle(cat.middleCategories[0]?.code ?? "");
											}}
										>
											<strong>{cat.code}</strong>
											<span>{cat.name}</span>
										</button>
									))}
								</div>

								<div className={styles.efPanelCol}>
									<p className={styles.efPanelLabel}>屬性</p>
									{category?.middleCategories.map((mid) => (
										<button
											key={mid.code}
											className={selectedMiddle === mid.code ? styles.efCatBtnActive : styles.efCatBtn}
											onClick={() => setSelectedMiddle(mid.code)}
										>
											<strong>{mid.code}</strong>
											<span>{mid.name}</span>
										</button>
									))}
								</div>

								<div className={styles.efPanelColWide}>
									<p className={styles.efPanelLabel}>代碼</p>
									{middle?.subcodes.map((s) => (
										<div key={s.code} className={styles.efSearchOption} onMouseDown={() => select(s.code)}>
											<span>
												<strong>{s.code}</strong> {s.description}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

// --- main modal ---

export default function RoutineEntryModal({
	open,
	mode,
	editingEntries,
	onClose,
	onSaved,
}: Props) {
	const [header, setHeader] = useState<HeaderDraft>(emptyHeader);
	const [findings, setFindings] = useState<FindingDraft[]>([{ ...emptyFinding }]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<{
		audit_date?: boolean;
		auditor_name?: boolean;
		aircraft_tail?: boolean;
		findings?: Set<number>; // indices of finding cards missing 記錄 text
	}>({});
	const submittingRef = useRef(false);
	const [pasteOpen, setPasteOpen] = useState(false);
	const [prefix, setPrefix] = useState<"SA" | "GA">("SA");
	const [entryNoTouched, setEntryNoTouched] = useState(false);
	const [pasteText, setPasteText] = useState("");
	const [pasteWarnings, setPasteWarnings] = useState<string[]>([]);

	const isEdit = mode === "edit" && editingEntries && editingEntries.length > 0;

	useEffect(() => {
		if (!open) return;
		setError(null);
		setFieldErrors({});
		setPasteOpen(false);
		setPasteText("");
		setPasteWarnings([]);
		setPrefix("SA");
		setEntryNoTouched(false);
		if (isEdit && editingEntries) {
			const first = editingEntries[0];
			setHeader({
				entry_no: first.entry_no,
				audit_date: first.audit_date,
				report_year: first.report_year,
				report_month: first.report_month,
				auditor_name: first.auditor_name,
				aircraft_tail: first.aircraft_tail,
				flight_no: first.flight_no ?? "",
				route: first.route ?? "",
				special_remarks: first.special_remarks ?? [],
			});
			setFindings(
				[...editingEntries]
					.sort((a, b) => a.finding_seq - b.finding_seq)
					.map((e) => ({
						id: e.id,
						finding: e.finding,
						corrective_action: e.corrective_action ?? "",
						result: e.result,
						sam_code: e.sam_code,
						ef_code: e.ef_code,
						is_non_flight_safety: e.is_non_flight_safety,
					}))
			);
		} else {
			setHeader(emptyHeader);
			setFindings([{ ...emptyFinding }]);
		}
	}, [open, isEdit, editingEntries]);

	useEffect(() => {
		if (!open || isEdit || entryNoTouched) return;
		const token = localStorage.getItem("token");
		if (!token) return;
		const params = new URLSearchParams({
			prefix,
			year: String(header.report_year),
			month: String(header.report_month),
		});
		fetch(`/api/audit/routine/entries/next-number?${params}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((res) => (res.ok ? res.json() : null))
			.then((data) => {
				if (data?.entry_no) setHeader((h) => ({ ...h, entry_no: data.entry_no }));
			})
			.catch(() => {});
	}, [open, isEdit, entryNoTouched, prefix, header.report_year, header.report_month]);

	if (!open) return null;

	function updateHeader<K extends keyof HeaderDraft>(key: K, val: HeaderDraft[K]) {
		setHeader((h) => ({ ...h, [key]: val }));
		if (val && (key === "audit_date" || key === "auditor_name" || key === "aircraft_tail")) {
			setFieldErrors((fe) => ({ ...fe, [key]: false }));
		}
	}
	function updateFinding<K extends keyof FindingDraft>(idx: number, key: K, val: FindingDraft[K]) {
		setFindings((list) => list.map((f, i) => (i === idx ? { ...f, [key]: val } : f)));
		if (key === "finding" && typeof val === "string" && val.trim()) {
			setFieldErrors((fe) => {
				if (!fe.findings?.has(idx)) return fe;
				const next = new Set(fe.findings);
				next.delete(idx);
				return { ...fe, findings: next };
			});
		}
	}
	function handleDateChange(dateStr: string) {
		updateHeader("audit_date", dateStr);
		if (dateStr) {
			const d = new Date(dateStr);
			updateHeader("report_year", d.getFullYear());
			updateHeader("report_month", d.getMonth() + 1);
		}
	}
	function addFindingCard() {
		setFindings((list) => [...list, { ...emptyFinding }]);
	}
	function handleApplyPaste() {
		const result = parseExcelPaste(pasteText);
		if (result.findings.length === 0) {
			setPasteWarnings(result.warnings.length ? result.warnings : ["找不到可解析的資料"]);
			return;
		}
		if (!isEdit) {
			// create mode — paste replaces the header too, since there's
			// nothing shared to preserve yet
			setHeader((h) => ({ ...h, ...result.header }));
			setFindings(result.findings);
		} else {
			// edit mode — header belongs to the existing audit; paste only
			// appends findings, never overwrites shared fields you already set
			setFindings((list) => [...list, ...result.findings]);
		}
		setPasteWarnings(result.warnings);
		if (result.warnings.length === 0) {
			setPasteOpen(false);
			setPasteText("");
		}
	}
	async function removeFindingCard(idx: number) {
		const f = findings[idx];
		if (findings.length <= 1) return; // an audit needs at least one finding

		if (f.id) {
			// this is a persisted row, not a local draft — removing it means
			// deleting it now, not deferring to the eventual save. There's no
			// "undo on cancel" here; the delete already happened.
			if (!confirm("此項發現已儲存，移除將立即刪除，確定要繼續嗎？")) return;
			const token = localStorage.getItem("token");
			const res = await fetch(`/api/audit/routine/entries/${f.id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) {
				alert("刪除失敗");
				return;
			}
			onSaved(); // parent list needs to reflect this immediately, independent of the eventual "儲存" click
		}
		setFindings((list) => list.filter((_, i) => i !== idx));
	}

	async function handleSubmit() {
		if (submittingRef.current) return; // synchronous guard — setSaving(true) below isn't fast enough to stop a rapid double-click

		const missingHeader = {
			audit_date: !/^\d{4}-\d{2}-\d{2}$/.test(header.audit_date),
			auditor_name: !header.auditor_name,
			aircraft_tail: !header.aircraft_tail,
		};
		const missingFindings = new Set(
			findings.map((f, i) => (f.finding.trim() ? -1 : i)).filter((i) => i >= 0)
		);

		if (missingHeader.audit_date || missingHeader.auditor_name || missingHeader.aircraft_tail) {
			setFieldErrors({ ...missingHeader, findings: missingFindings });
			setError("請填寫日期、查核員、機號");
			return;
		}
		if (missingFindings.size > 0) {
			setFieldErrors({ findings: missingFindings });
			setError("每一項發現都需要填寫記錄內容");
			return;
		}

		setFieldErrors({});
		submittingRef.current = true;
		setSaving(true);
		setError(null);
		const token = localStorage.getItem("token");

		try {
			if (isEdit && editingEntries) {
				const entryNo = header.entry_no ?? editingEntries[0].entry_no;

				for (const f of findings) {
					if (f.id) {
						// existing row — PATCH, including header fields, so header
						// edits propagate to every finding in the group instead of
						// only the one that happened to be open when you changed it
						const patchPayload = { ...header, ...f };
						const res = await fetch(`/api/audit/routine/entries/${f.id}`, {
							method: "PATCH",
							headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
							body: JSON.stringify(patchPayload),
						});
						if (!res.ok) {
							const data = await res.json().catch(() => ({}));
							throw new Error(data.error || "儲存失敗");
						}
					} else {
						// new card added during this edit session — attach to the
						// same audit rather than starting a new entry_no
						const payload: CreateEntryPayload = {
							...header,
							...f,
							existing_entry_no: entryNo,
						};
						const addRes = await fetch("/api/audit/routine/entries", {
							method: "POST",
							headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
							body: JSON.stringify(payload),
						});
						if (!addRes.ok) {
							const data = await addRes.json().catch(() => ({}));
							throw new Error(data.error || "儲存失敗");
						}
					}
				}
			} else {
				let entryNo: string | null = null;
				for (const f of findings) {
					const payload: CreateEntryPayload = {
						...header,
						...f,
						existing_entry_no: entryNo ?? undefined,
						manual_entry_no: entryNo ? undefined : header.entry_no,
						prefix,
					};
					const res = await fetch("/api/audit/routine/entries", {
						method: "POST",
						headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
						body: JSON.stringify(payload),
					});
					if (!res.ok) {
						const data = await res.json().catch(() => ({}));
						throw new Error(data.error || "儲存失敗");
					}
					const saved = await res.json();
					entryNo = saved.record.entry_no;
				}
			}

			onSaved();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "儲存失敗");
		} finally {
			submittingRef.current = false;
			setSaving(false);
		}
	}

	return (
		<div className={styles.overlay}>
			<div className={styles.panel}>
				<div className={styles.header}>
					<h3>
						{isEdit ? "編輯紀錄" : "新增查核紀錄"}
					</h3>
					<button className={styles.closeBtn} onClick={onClose}>×</button>
				</div>

				<div className={styles.body}>
					<div className={styles.pasteSection}>
						<button className={styles.pasteToggle} onClick={() => setPasteOpen((o) => !o)}>
							{pasteOpen ? "取消貼上" : "📋 貼上Excel資料列"}
						</button>
						{pasteOpen && (
							<div className={styles.pasteBox}>
								<p className={styles.pasteHint}>
									直接從Excel複製一列或多列並貼上，欄位順序需與範本一致：序/日期/編號/查核員/機號/班次/航段/記錄/處置/結果/SAM分類/SAM代碼/非飛安相關。
									{isEdit && "（編輯模式下僅新增記錄，不會覆蓋共用資訊）"}
								</p>
								<textarea
									className={styles.pasteTextarea}
									rows={4}
									placeholder="在此貼上..."
									value={pasteText}
									onChange={(e) => setPasteText(e.target.value)}
									onPaste={(e) => {
										// apply immediately on paste so review/edit happens in the
										// actual form fields right away, not in this intermediate box
										const text = e.clipboardData.getData("text");
										setTimeout(() => {
											setPasteText(text);
											const result = parseExcelPaste(text);
											if (result.findings.length === 0) {
												setPasteWarnings(result.warnings.length ? result.warnings : ["找不到可解析的資料"]);
												return;
											}
											if (!isEdit) {
												setHeader((h) => ({ ...h, ...result.header }));
												setFindings(result.findings);
											} else {
												setFindings((list) => [...list, ...result.findings]);
											}
											setPasteWarnings(result.warnings);
											if (result.warnings.length === 0) {
												setPasteOpen(false);
												setPasteText("");
											}
										}, 0);
									}}
								/>
								{pasteText && (
									<button className={styles.pasteApplyBtn} onClick={handleApplyPaste}>
										重新解析
									</button>
								)}
								{pasteWarnings.length > 0 && (
									<ul className={styles.pasteWarnings}>
										{pasteWarnings.map((w, i) => (
											<li key={i}>{w}</li>
										))}
									</ul>
								)}
							</div>
						)}
					</div>

					<div className={styles.headerSection}>
						<p className={styles.sectionLabel}>共用資訊 (此次稽核僅需填寫一次)</p>
						<div className={styles.row}>
							<div className={styles.field}>
								<label>查核編號</label>
								<div className={styles.entryNoSplit}>
									<select
										value={header.entry_no?.slice(0, 2) ?? prefix}
										onChange={(e) => {
											const newPrefix = e.target.value as "SA" | "GA";
											if (!isEdit) setPrefix(newPrefix);
											updateHeader("entry_no", `${newPrefix}${header.entry_no?.slice(2) ?? ""}`);
										}}
									>
										<option value="SA">SA</option>
										<option value="GA">GA</option>
									</select>
									<input
										value={header.entry_no?.slice(2) ?? ""}
										onChange={(e) => {
											if (!isEdit) setEntryNoTouched(true);
											updateHeader(
												"entry_no",
												`${header.entry_no?.slice(0, 2) ?? prefix}${stripExcelQuote(e.target.value).toUpperCase()}`
											);
										}}
										placeholder="0106"
									/>
								</div>
							</div>
							<div className={styles.specialRemarks}>
								{KNOWN_SPECIAL_REMARKS.map((remark) => (
									<label key={remark} className={styles.checkboxLabel}>
										<input
											type="checkbox"
											checked={header.special_remarks.includes(remark)}
											onChange={(e) => {
												const next = e.target.checked
													? [...header.special_remarks, remark]
													: header.special_remarks.filter((r) => r !== remark);
												updateHeader("special_remarks", next);
											}}
										/>
										{remark}
									</label>
								))}
							</div>
						</div>
						<div className={styles.row}>
							<div className={fieldErrors.audit_date ? styles.fieldInvalid : styles.field}>
								<label>稽核日期</label>
								<DateField value={header.audit_date} onChange={handleDateChange} />
							</div>
							<div className={fieldErrors.auditor_name ? styles.fieldInvalid : styles.field}>
								<label>查核員</label>
								<AuditorField value={header.auditor_name} onChange={(name) => updateHeader("auditor_name", name)} />
							</div>
						</div>
						<div className={styles.row}>
							<div className={fieldErrors.aircraft_tail ? styles.fieldInvalid : styles.field}>
								<label>機號</label>
								<input
									value={header.aircraft_tail}
									onChange={(e) => updateHeader("aircraft_tail", normalizeTail(e.target.value))}
									placeholder="B16855"
								/>
							</div>
							<div className={styles.field}>
								<label>班次</label>
								<input
									value={header.flight_no}
									onChange={(e) => updateHeader("flight_no", stripExcelQuote(e.target.value))}
									placeholder="343/344"
								/>
							</div>
						</div>
						<div className={styles.field}>
							<label>航段</label>
							<RouteField value={header.route} onChange={(v) => updateHeader("route", v)} />
						</div>
					</div>

					<div className={styles.findingsSection}>
						<p className={styles.sectionLabel}>紀錄 (每項可各自指定SAM代碼)</p>
						{findings.map((f, idx) => (
							<div key={f.id ?? `new-${idx}`} className={styles.findingCard}>
								{findings.length > 1 && (
									<div className={styles.findingCardHeader}>
										<span>第 {idx + 1} 項</span>
										<button className={styles.removeBtn} onClick={() => removeFindingCard(idx)}>移除</button>
									</div>
								)}
								<textarea
									rows={3}
									placeholder="輸入此項發現..."
									value={f.finding}
									onChange={(e) => updateFinding(idx, "finding", stripExcelQuote(e.target.value))}
									className={fieldErrors.findings?.has(idx) ? styles.fieldInvalidTextarea : undefined}
								/>
								<textarea rows={2} placeholder="處置作為" value={f.corrective_action} onChange={(e) => updateFinding(idx, "corrective_action", stripExcelQuote(e.target.value))} />
								<label className={styles.checkboxLabel}>
									<input type="checkbox" checked={f.is_non_flight_safety} onChange={(e) => updateFinding(idx, "is_non_flight_safety", e.target.checked)} />
									非安全相關
								</label>
								<div className={styles.row}>
									<div className={styles.field}>
										<label>SAM代碼</label>
										<SamCodeField value={f.sam_code} onChange={(code) => updateFinding(idx, "sam_code", code)} />
									</div>
									<div className={styles.field}>
										<label>EF屬性代碼</label>
										<EfCodeField value={f.ef_code} onChange={(code) => updateFinding(idx, "ef_code", code)} />
									</div>
								</div>
							</div>
						))}
						<button className={styles.addFindingBtn} onClick={addFindingCard}>
							{isEdit ? "+ 新增一筆記錄到此次稽核" : "+ 新增一筆記錄"}
						</button>
					</div>

					{error && <p className={styles.error}>{error}</p>}
				</div>

				<div className={styles.footer}>
					<button className={styles.cancelBtn} onClick={onClose} disabled={saving}>取消</button>
					<button className={styles.saveBtn} onClick={handleSubmit} disabled={saving}>
						{saving ? "儲存中..." : isEdit ? "儲存" : "儲存全部"}
					</button>
				</div>
			</div>
		</div>
	);
}