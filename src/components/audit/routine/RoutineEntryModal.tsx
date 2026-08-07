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
	audit_date: string;
	report_year: number;
	report_month: number;
	auditor_name: string;
	aircraft_tail: string;
	flight_no: string;
	route: string;
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
};

const emptyFinding: FindingDraft = {
	finding: "",
	corrective_action: "",
	result: "OK",
	sam_code: null,
	ef_code: null,
	is_non_flight_safety: false,
};

const ORIGIN_OPTIONS = ["TSA", "TPE", "RMQ", "KHH"];

// Popovers are rendered inside a scrolling modal body, so plain
// `position: absolute` breaks once the trigger is near the bottom of that
// scroll area (it did — visibly clipped the SAM code list against the
// viewport edge instead of the panel). Computing viewport coordinates from
// the trigger's real position and flipping upward when there isn't room
// below fixes it regardless of where the field sits.
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

	function update(next: { y: string; m: string; d: string }) {
		setSegs(next);
		if (next.y.length === 4 && next.m.length >= 1 && next.d.length >= 1) {
			onChange(`${next.y}-${next.m.padStart(2, "0")}-${next.d.padStart(2, "0")}`);
		}
		// incomplete — deliberately don't call onChange; parent keeps its
		// last valid value until this field is actually complete
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
					update({ ...segs, y: v });
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
					update({ ...segs, m: v });
					if (v.length === 2) dayRef.current?.focus();
				}}
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
					update({ ...segs, d: v });
				}}
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

function RouteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	const [origin = "", destination = ""] = value.split("-");

	function setOrigin(o: string) {
		onChange(`${o}-${destination}`);
	}
	function setDestination(raw: string) {
		const cleaned = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
		onChange(`${origin}-${cleaned}`);
	}

	return (
		<div className={styles.routeWrap}>
			<select value={origin} onChange={(e) => setOrigin(e.target.value)}>
				<option value="">-</option>
				{ORIGIN_OPTIONS.map((o) => (
					<option key={o} value={o}>{o}</option>
				))}
			</select>
			<span className={styles.routeArrow}>⇄</span>
			<input
				value={destination}
				onChange={(e) => setDestination(e.target.value)}
				placeholder="MZG"
				maxLength={3}
				className={styles.routeDestInput}
			/>
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

	const isEdit = mode === "edit" && editingEntries && editingEntries.length > 0;

	useEffect(() => {
		if (!open) return;
		setError(null);
		setFieldErrors({});
		if (isEdit && editingEntries) {
			const first = editingEntries[0];
			setHeader({
				audit_date: first.audit_date,
				report_year: first.report_year,
				report_month: first.report_month,
				auditor_name: first.auditor_name,
				aircraft_tail: first.aircraft_tail,
				flight_no: first.flight_no ?? "",
				route: first.route ?? "",
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
			audit_date: !header.audit_date,
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
				const entryNo = editingEntries[0].entry_no;

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
					<div className={styles.headerSection}>
						<p className={styles.sectionLabel}>共用資訊 (此次稽核僅需填寫一次)</p>
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
									onChange={(e) => updateHeader("aircraft_tail", e.target.value.toUpperCase())}
									placeholder="B16855"
								/>
							</div>
							<div className={styles.field}>
								<label>班次</label>
								<input
									value={header.flight_no}
									onChange={(e) => updateHeader("flight_no", e.target.value)}
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
									onChange={(e) => updateFinding(idx, "finding", e.target.value)}
									className={fieldErrors.findings?.has(idx) ? styles.fieldInvalidTextarea : undefined}
								/>
								<textarea rows={2} placeholder="處置作為" value={f.corrective_action} onChange={(e) => updateFinding(idx, "corrective_action", e.target.value)} />
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