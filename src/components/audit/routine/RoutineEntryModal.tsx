// src/components/audit/routine/RoutineEntryModal.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./RoutineEntryModal.module.css";
import { RoutineAuditEntry, SamCode, CreateEntryPayload } from "@/lib/routineAudit.types";

interface FindingDraft {
	finding: string;
	corrective_action: string;
	result: "OK" | "NG";
	sam_code_id: string | null;
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
	editingEntry: RoutineAuditEntry | null;
	prefillEntryNo: string | null; // set when adding finding(s) to an existing audit
	samCodes: SamCode[];
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
	sam_code_id: null,
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
}

function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
	const [y, m, d] = value ? value.split("-") : ["", "", ""];
	const yearRef = useRef<HTMLInputElement>(null);
	const monthRef = useRef<HTMLInputElement>(null);
	const dayRef = useRef<HTMLInputElement>(null);

	function emit(ny: string, nm: string, nd: string) {
		if (ny.length === 4 && nm.length >= 1 && nd.length >= 1) {
			onChange(`${ny}-${nm.padStart(2, "0")}-${nd.padStart(2, "0")}`);
		} else {
			onChange(""); // incomplete — don't hand the parent a partial/invalid date
		}
	}

	return (
		<div className={styles.dateWrap}>
			<input
				ref={yearRef}
				className={styles.dateYear}
				value={y}
				placeholder="yyyy"
				inputMode="numeric"
				onChange={(e) => {
					const v = e.target.value.replace(/\D/g, "").slice(0, 4);
					emit(v, m, d);
					if (v.length === 4) monthRef.current?.focus();
				}}
			/>
			<span className={styles.dateSep}>/</span>
			<input
				ref={monthRef}
				className={styles.dateSmall}
				value={m}
				placeholder="mm"
				inputMode="numeric"
				onChange={(e) => {
					const v = e.target.value.replace(/\D/g, "").slice(0, 2);
					emit(y, v, d);
					if (v.length === 2) dayRef.current?.focus();
				}}
			/>
			<span className={styles.dateSep}>/</span>
			<input
				ref={dayRef}
				className={styles.dateSmall}
				value={d}
				placeholder="dd"
				inputMode="numeric"
				onChange={(e) => {
					const v = e.target.value.replace(/\D/g, "").slice(0, 2);
					emit(y, m, v);
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
							<span>{u.full_name}</span>
							<span className={styles.auditorMeta}>{u.employee_id}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function SamCodeField({
	samCodes,
	value,
	onChange,
}: {
	samCodes: SamCode[];
	value: string | null;
	onChange: (id: string | null) => void;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [popStyle, setPopStyle] = useState<React.CSSProperties>({});
	const triggerRef = useRef<HTMLButtonElement>(null);

	const selected = samCodes.find((c) => c.id === value) ?? null;

	const grouped = useMemo(() => {
		const map = new Map<string, SamCode[]>();
		for (const c of samCodes) {
			if (!map.has(c.category)) map.set(c.category, []);
			map.get(c.category)!.push(c);
		}
		return map;
	}, [samCodes]);

	const filtered = useMemo(() => {
		if (!query.trim()) return null;
		const q = query.trim().toLowerCase();
		return samCodes.filter(
			(c) =>
				c.code.toLowerCase().includes(q) ||
				c.category.toLowerCase().includes(q) ||
				(c.description_zh ?? "").toLowerCase().includes(q) ||
				(c.description_en ?? "").toLowerCase().includes(q)
		);
	}, [samCodes, query]);

	function toggleOpen() {
		if (!open) setPopStyle(computePopoverStyle(triggerRef.current, 360));
		setOpen((o) => !o);
	}

	function select(id: string | null) {
		onChange(id);
		setOpen(false);
		setQuery("");
	}

	return (
		<div className={styles.samWrap}>
			<button ref={triggerRef} type="button" className={styles.samTrigger} onClick={toggleOpen}>
				{selected ? (
					<span>
						<span className={styles.samCode}>{selected.code}</span>
						{" — "}
						{selected.description_zh}
					</span>
				) : (
					<span className={styles.samPlaceholder}>選擇SAM代碼</span>
				)}
				<span className={styles.samChevron}>{open ? "▲" : "▼"}</span>
			</button>

			{open && (
				<>
					<div className={styles.samBackdrop} onMouseDown={() => setOpen(false)} />
					<div className={styles.samPopover} style={popStyle}>
						<input
							autoFocus
							className={styles.samSearch}
							placeholder="搜尋代碼、分類或關鍵字..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
						<div className={styles.samList}>
							<div className={styles.samOption} onMouseDown={() => select(null)}>
								<span className={styles.samCode}>-</span>
								<span className={styles.samDesc}>無 (正常/無發現)</span>
							</div>

							{filtered ? (
								filtered.length === 0 ? (
									<p className={styles.samEmpty}>查無符合的代碼</p>
								) : (
									filtered.map((c) => (
										<div key={c.id} className={styles.samOption} onMouseDown={() => select(c.id)}>
											<span className={styles.samCode}>{c.code}</span>
											<span className={styles.samDesc}>{c.description_zh}</span>
											<span className={styles.samCategory}>{c.category}</span>
										</div>
									))
								)
							) : (
								Array.from(grouped.entries()).map(([category, codes]) => (
									<details key={category} className={styles.samGroup}>
										<summary>{category}</summary>
										{codes.map((c) => (
											<div key={c.id} className={styles.samOption} onMouseDown={() => select(c.id)}>
												<span className={styles.samCode}>{c.code}</span>
												<span className={styles.samDesc}>{c.description_zh}</span>
											</div>
										))}
									</details>
								))
							)}
						</div>
					</div>
				</>
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

// --- main modal ---

export default function RoutineEntryModal({
	open,
	mode,
	editingEntry,
	prefillEntryNo,
	samCodes,
	onClose,
	onSaved,
}: Props) {
	const [header, setHeader] = useState<HeaderDraft>(emptyHeader);
	const [findings, setFindings] = useState<FindingDraft[]>([{ ...emptyFinding }]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const submittingRef = useRef(false);

	const isEdit = mode === "edit" && editingEntry;

	useEffect(() => {
		if (!open) return;
		setError(null);
		if (isEdit && editingEntry) {
			setHeader({
				audit_date: editingEntry.audit_date,
				report_year: editingEntry.report_year,
				report_month: editingEntry.report_month,
				auditor_name: editingEntry.auditor_name,
				aircraft_tail: editingEntry.aircraft_tail,
				flight_no: editingEntry.flight_no ?? "",
				route: editingEntry.route ?? "",
			});
			setFindings([
				{
					finding: editingEntry.finding,
					corrective_action: editingEntry.corrective_action ?? "",
					result: editingEntry.result,
					sam_code_id: editingEntry.sam_code_id,
					is_non_flight_safety: editingEntry.is_non_flight_safety,
				},
			]);
		} else {
			setHeader(emptyHeader);
			setFindings([{ ...emptyFinding }]);
		}
	}, [open, isEdit, editingEntry]);

	if (!open) return null;

	function updateHeader<K extends keyof HeaderDraft>(key: K, val: HeaderDraft[K]) {
		setHeader((h) => ({ ...h, [key]: val }));
	}
	function updateFinding<K extends keyof FindingDraft>(idx: number, key: K, val: FindingDraft[K]) {
		setFindings((list) => list.map((f, i) => (i === idx ? { ...f, [key]: val } : f)));
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
	function removeFindingCard(idx: number) {
		setFindings((list) => (list.length > 1 ? list.filter((_, i) => i !== idx) : list));
	}

	async function handleSubmit() {
		if (submittingRef.current) return; // synchronous guard — setSaving(true) below isn't fast enough to stop a rapid double-click
		if (!header.audit_date || !header.auditor_name || !header.aircraft_tail) {
			setError("請填寫日期、查核員、機號");
			return;
		}
		if (findings.some((f) => !f.finding.trim())) {
			setError("每一項發現都需要填寫記錄內容");
			return;
		}

		submittingRef.current = true;
		setSaving(true);
		setError(null);
		const token = localStorage.getItem("token");

		try {
			if (isEdit && editingEntry) {
				const payload = { ...header, ...findings[0] };
				const res = await fetch(`/api/audit/routine/entries/${editingEntry.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
					body: JSON.stringify(payload),
				});
				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					throw new Error(data.error || "儲存失敗");
				}
			} else {
				let entryNo = prefillEntryNo;
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
						{isEdit ? "編輯紀錄" : prefillEntryNo ? `新增發現 (${prefillEntryNo})` : "新增查核紀錄"}
					</h3>
					<button className={styles.closeBtn} onClick={onClose}>×</button>
				</div>

				<div className={styles.body}>
					<div className={styles.headerSection}>
						<p className={styles.sectionLabel}>共用資訊 (此次稽核僅需填寫一次)</p>
						<div className={styles.row}>
							<div className={styles.field}>
								<label>稽核日期</label>
								<DateField value={header.audit_date} onChange={handleDateChange} />
							</div>
							<div className={styles.field}>
								<label>查核員</label>
								<AuditorField value={header.auditor_name} onChange={(name) => updateHeader("auditor_name", name)} />
							</div>
						</div>
						<div className={styles.row}>
							<div className={styles.field}>
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
						<p className={styles.sectionLabel}>發現事項 {!isEdit && "(每項可各自指定SAM代碼)"}</p>
						{findings.map((f, idx) => (
							<div key={idx} className={styles.findingCard}>
								{!isEdit && (
									<div className={styles.findingCardHeader}>
										<span>第 {idx + 1} 項</span>
										{findings.length > 1 && (
											<button className={styles.removeBtn} onClick={() => removeFindingCard(idx)}>移除</button>
										)}
									</div>
								)}
								<textarea rows={3} placeholder="輸入此項發現..." value={f.finding} onChange={(e) => updateFinding(idx, "finding", e.target.value)} />
								<textarea rows={2} placeholder="處置作為" value={f.corrective_action} onChange={(e) => updateFinding(idx, "corrective_action", e.target.value)} />
								<div className={styles.row}>
									<div className={styles.field}>
										<label>結果</label>
										<select value={f.result} onChange={(e) => updateFinding(idx, "result", e.target.value as "OK" | "NG")}>
											<option value="OK">OK</option>
											<option value="NG">NG</option>
										</select>
									</div>
									<label className={styles.checkboxLabel}>
										<input type="checkbox" checked={f.is_non_flight_safety} onChange={(e) => updateFinding(idx, "is_non_flight_safety", e.target.checked)} />
										非飛安相關
									</label>
								</div>
								<div className={styles.field}>
									<label>SAM代碼</label>
									<SamCodeField samCodes={samCodes} value={f.sam_code_id} onChange={(id) => updateFinding(idx, "sam_code_id", id)} />
								</div>
							</div>
						))}
						{!isEdit && (
							<button className={styles.addFindingBtn} onClick={addFindingCard}>+ 新增一項發現</button>
						)}
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