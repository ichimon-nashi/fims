// src/components/mdafaat/TrainingRecords.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, ChevronDown, ChevronUp, Edit2, Download, RefreshCw } from "lucide-react";
import styles from "./TrainingRecords.module.css";
import Avatar from "@/components/ui/Avatar/Avatar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScenarioStep {
	code: string;
	title: string;
	description?: string;
	skipped: boolean;
}

interface TrainingSession {
	id: number;
	training_date: string;
	employee_id: string;
	group_type: string;
	group_number: number;
	core_scenario: string;
	result: "pass" | "redo" | null;
	is_redo: boolean;
	team_members: Array<{ userId: string; name: string; employeeId: string; rank: string }>;
	scenario_path: ScenarioStep[];
	conditions: { time: string; full: boolean; infants: boolean; specialPax: string | null } | null;
	elapsed_time: number;
	instructor: string;
	flight_info: { flightNo: string; departure: string; arrival: string; aircraftType: string } | null;
	extra_scenarios?: string; // instructor-added notes
	created_at: string;
}

interface Props {
	onStartRedo: (
		redoStudents: Array<{ userId: string; name: string; employeeId: string; rank: string }>,
		allSessionsForDate: Array<{ employee_id: string }>
	) => void;
	canEdit: boolean;
}

const CORE_SCENARIO_LABELS: Record<string, string> = {
	bomb_threat:          "爆裂物威脅",
	lithium_fire:         "鋰電池火災",
	decompression:        "失壓",
	incapacitation:       "失能",
	unplanned_evacuation: "無預警撤離",
	planned_evacuation:   "客艙準備 CPP",
};

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const formatDate = (iso: string) => {
	const d = new Date(iso);
	return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
};

// ─── Component ────────────────────────────────────────────────────────────────
const TrainingRecords: React.FC<Props> = ({ onStartRedo, canEdit }) => {
	const [sessions, setSessions] = useState<TrainingSession[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
	const [availableDates, setAvailableDates] = useState<string[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [resultFilter, setResultFilter] = useState<"all" | "pass" | "redo">("all");
	const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
	const [editNotes, setEditNotes] = useState("");       // new tag input field
	const printRef = useRef<HTMLDivElement>(null);
	const [savingId, setSavingId] = useState<number | null>(null);
	const [toastMsg, setToastMsg] = useState<{ ok: boolean; text: string } | null>(null);
	const [redoConfirm, setRedoConfirm] = useState<{
		students: Array<{ userId: string; name: string; employeeId: string; rank: string }>;
	} | null>(null);
	const [trainingTypeModal, setTrainingTypeModal] = useState(false);
	const [selectedTrainingType, setSelectedTrainingType] = useState<string>("FAAT");
	// scenarioOrder: 6 core_scenario keys in instructor-chosen order (index 0 = scenario #1)
	const ALL_CORE_SCENARIOS = [
		"bomb_threat", "lithium_fire", "decompression",
		"incapacitation", "unplanned_evacuation", "planned_evacuation",
	];
	const CORE_SCENARIO_NAMES: Record<string, string> = {
		bomb_threat:          "爆裂物威脅",
		lithium_fire:         "鋰電池火災",
		decompression:        "失壓",
		incapacitation:       "失能",
		unplanned_evacuation: "無預警撤離",
		planned_evacuation:   "客艙準備 CPP",
	};
	const [scenarioOrder, setScenarioOrder] = useState<string[]>([...ALL_CORE_SCENARIOS]);

	// Parse extra_scenarios: stored as JSON array string or plain string
	const parseScenarios = (raw: string | null | undefined): string[] => {
		if (!raw) return [];
		try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw]; }
		catch { return raw.split(/[;,、]\s*/).map(s => s.trim()).filter(Boolean); }
	};
	const stringifyScenarios = (arr: string[]) => JSON.stringify(arr);

	// ── Fetch: loads all sessions, derives available dates dropdown ─────────
	const fetchSessions = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/mdafaat/training-sessions`);
			if (!res.ok) throw new Error("fetch failed");
			const data: TrainingSession[] = await res.json();
			setSessions(data);
			// Build sorted list of unique dates that have completed sessions
			const dates = Array.from(
				new Set(
					data
						.filter(s => s.result || s.elapsed_time || s.scenario_path)
						.map(s => s.training_date)
				)
			).sort((a, b) => b.localeCompare(a)); // newest first
			setAvailableDates(dates);
			// Select the most recent date by default (or keep current if still valid)
			if (dates.length > 0) {
				setSelectedDate(prev => dates.includes(prev) ? prev : dates[0]);
			}
		} catch (e) {
			console.error(e);
			setSessions([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { fetchSessions(); }, [fetchSessions]);

	// ── Derived filtered list ────────────────────────────────────────────────
	const filtered = sessions.filter(s => {
		// "Unstarted" = TeamFormation-only save: no result, no elapsed_time, no scenario_path
		if (!s.result && !s.elapsed_time && !s.scenario_path) return false;
		// Filter by selected date
		if (s.training_date !== selectedDate) return false;
		if (resultFilter !== "all" && s.result !== resultFilter) return false;
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			const nameMatch = s.team_members?.some(m =>
				m.name?.toLowerCase().includes(q) || m.employeeId?.toLowerCase().includes(q)
			);
			const empMatch = s.employee_id.toLowerCase().includes(q);
			if (!nameMatch && !empMatch) return false;
		}
		return true;
	});

	// Group by date then group_number for display
	const grouped = filtered.reduce<Record<string, Record<string, TrainingSession[]>>>((acc, s) => {
		const date = s.training_date;
		const grp = `${s.group_type} ${s.group_number}`;
		if (!acc[date]) acc[date] = {};
		if (!acc[date][grp]) acc[date][grp] = [];
		acc[date][grp].push(s);
		return acc;
	}, {});

	// Within each group, deduplicate by employee_id keeping only the latest row (highest id).
	// This handles legacy duplicate saves that may already exist in the DB.
	const deduped = Object.fromEntries(
		Object.entries(grouped).map(([date, dateGroups]) => [
			date,
			Object.fromEntries(
				Object.entries(dateGroups).map(([grp, rows]) => {
					const latest = new Map<string, TrainingSession>();
					for (const row of rows) {
						const existing = latest.get(row.employee_id);
						if (!existing || row.id > existing.id) {
							latest.set(row.employee_id, row);
						}
					}
					return [grp, Array.from(latest.values())];
				})
			),
		])
	);

	const sortedDates = Object.keys(deduped).sort((a, b) => b.localeCompare(a));

	// ── Helpers ──────────────────────────────────────────────────────────────
	const toggleExpand = (id: number) => {
		setExpandedIds(prev => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	};

	// Resolve member name/rank from team_members — may be plain string IDs or full objects
	const resolveMember = (s: TrainingSession) => {
		if (!s.team_members || s.team_members.length === 0) return null;
		const first = (s.team_members as any[])[0];
		if (typeof first === "string") return null; // plain IDs — no name available
		return (s.team_members as any[]).find(
			m => String(m.employeeId ?? m.employee_id) === String(s.employee_id)
		) ?? null;
	};

	// Group-level extra_scenarios — one note per group, patched to all rows in group
	const [editingGroup, setEditingGroup] = useState<string | null>(null);

	// ── Edit modal state (admin only) ────────────────────────────────────────
	const [editModal, setEditModal] = useState<{
		grpKey: string;
		sessions: TrainingSession[];
	} | null>(null);
	const [editSaving, setEditSaving] = useState(false);
	// Edit form fields
	const [editScenario,  setEditScenario]  = useState("");
	const [editCondTime,  setEditCondTime]  = useState<"morning"|"midday"|"night">("morning");
	const [editCondFull,  setEditCondFull]  = useState(false);
	const [editCondInfants, setEditCondInfants] = useState(false);
	const [editCondPax,   setEditCondPax]   = useState<string>("");
	const [editFlightNo,  setEditFlightNo]  = useState("");
	const [editDeparture, setEditDeparture] = useState("");
	const [editArrival,   setEditArrival]   = useState("");
	const [editAcType,    setEditAcType]    = useState("");
	// Per-member result map: employee_id → 'pass'|'redo'
	const [editResults,   setEditResults]   = useState<Record<string, "pass"|"redo">>({});
	// Members list (editable)
	const [editMembers,   setEditMembers]   = useState<Array<{employeeId:string;name:string;rank:string;userId:string}>>([]);
	const [editScenarioPath, setEditScenarioPath] = useState<any[]>([]);
	const [editExtraScenarios, setEditExtraScenarios] = useState<string[] | null>(null);
	const [editTagInput, setEditTagInput] = useState("");
	const [fetchingDeck,  setFetchingDeck]  = useState(false);
	const [availableDecks, setAvailableDecks] = useState<Array<{
		scenario_code:string; background:string; trigger:string;
		complication:string|null; outcome:string;
	}>>([]);
	const [selectedDeckCode, setSelectedDeckCode] = useState<string|null>(null);
	const [includeComp, setIncludeComp] = useState(true); // include complication card by default
	const [showCardChooser, setShowCardChooser] = useState(false);

	const fetchDeckForEdit = async (scenario: string) => {
		setFetchingDeck(true);
		try {
			const token = localStorage.getItem("token");
			const res = await fetch(`/api/mdafaat/scenarios?core_scenario=${scenario}&list=1`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (!data.error && data.decks?.length > 0) {
				setAvailableDecks(data.decks);
				setSelectedDeckCode(null); // no pre-selection — admin must choose
				setEditScenarioPath([]);
				setShowCardChooser(true);
			}
		} catch (e) { console.error('fetchDeckForEdit:', e); }
		finally { setFetchingDeck(false); }
	};

	// Build scenario_path from a chosen deck
	const buildPathFromDeck = (deck: typeof availableDecks[number], withComp: boolean) => [
		{ code: `${deck.scenario_code}-BG`,   title: 'A. 背景 Background',     description: deck.background,   skipped: false },
		{ code: `${deck.scenario_code}-TR`,   title: 'B. 觸發事件 Trigger',    description: deck.trigger,      skipped: false },
		...(deck.complication && withComp ? [{ code: `${deck.scenario_code}-COMP`, title: 'C. 併發 Complication', description: deck.complication, skipped: false }] : []),
		{ code: `${deck.scenario_code}-OUT`,  title: 'D. Outcome',              description: deck.outcome,      skipped: false },
	];

	const applyDeckSelection = () => {
		const deck = availableDecks.find(d => d.scenario_code === selectedDeckCode);
		if (!deck) return;
		setEditScenarioPath(buildPathFromDeck(deck, includeComp));
		setShowCardChooser(false);
	};

	const SPECIAL_PAX_OPTIONS = [
		"AGED - 長者",
		"BLND - 視障旅客",
		"DEAF - 聽障旅客",
		"DEPA - 受戒護人員",
		"DPNA - 自閉症",
		"DPNA - 腦性麻痺",
		"DRUN - 酒醉旅客",
		"POXY - 需氧旅客",
		"PRGN - 孕婦旅客",
		"UM - 單獨旅行孩童",
		"WCHC - 客艙輪椅旅客",
		"WCHR - 輪椅旅客",
	];

	const openEditModal = (grpKey: string, grpSessions: TrainingSession[]) => {
		const s0 = grpSessions[0];
		setEditScenario(s0?.core_scenario ?? "bomb_threat");
		setEditCondTime((s0?.conditions?.time as any) ?? "morning");
		setEditCondFull(s0?.conditions?.full ?? false);
		setEditCondInfants(s0?.conditions?.infants ?? false);
		setEditCondPax(s0?.conditions?.specialPax ?? "");
		setEditFlightNo(s0?.flight_info?.flightNo ?? "");
		setEditDeparture(s0?.flight_info?.departure ?? "");
		setEditArrival(s0?.flight_info?.arrival ?? "");
		setEditAcType(s0?.flight_info?.aircraftType ?? "");
		const resultMap: Record<string,"pass"|"redo"> = {};
		grpSessions.forEach(s => { if (s.result) resultMap[s.employee_id] = s.result; });
		setEditResults(resultMap);
		const members = s0?.team_members
			?.filter((m:any) => typeof m === "object" && m.employeeId)
			?.map((m:any) => ({ employeeId: String(m.employeeId), name: m.name ?? m.employeeId, rank: m.rank ?? "", userId: m.userId ?? "" }))
			?? [];
		setEditMembers(members);
		setEditScenarioPath([]);
		setEditExtraScenarios(parseScenarios(s0?.extra_scenarios)); // pre-populate from existing tags
		setEditTagInput("");
		setEditModal({ grpKey, sessions: grpSessions });
	};

	const saveEditModal = async () => {
		if (!editModal) return;
		setEditSaving(true);
		try {
			const s0 = editModal.sessions[0];
			const token = localStorage.getItem("token");
			const body = {
				training_date: s0.training_date,
				group_type:    s0.group_type,
				group_number:  s0.group_number,
				updates: {
					core_scenario: editScenario,
					...(editScenarioPath.length > 0 ? { scenario_path: editScenarioPath } : {}),
					...(editExtraScenarios !== null ? { extra_scenarios: JSON.stringify(editExtraScenarios) } : {}),
					conditions: {
						time:       editCondTime,
						full:       editCondFull,
						infants:    editCondInfants,
						specialPax: editCondPax || null,
					},
					flight_info: {
						flightNo:    editFlightNo,
						departure:   editDeparture,
						arrival:     editArrival,
						aircraftType: editAcType,
					},
					result_map:   editResults,
					team_members: editMembers,
				},
			};
			const res = await fetch("/api/mdafaat/training-sessions", {
				method: "PATCH",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify(body),
			});
			if (!res.ok) throw new Error("Save failed");
			setEditModal(null);
			setShowCardChooser(false);
			setAvailableDecks([]);
			setSelectedDeckCode(null);
			setIncludeComp(true);
			setToastMsg({ ok: true, text: "✅ 已更新訓練記錄" });
			setTimeout(() => setToastMsg(null), 3000);
			await fetchSessions();
		} catch (e: any) {
			setToastMsg({ ok: false, text: `❌ 更新失敗：${e.message}` });
			setTimeout(() => setToastMsg(null), 4000);
		} finally {
			setEditSaving(false);
		}
	};

	const startGroupEdit = (groupId: string) => {
		setEditingGroup(groupId);
		setEditNotes(""); // input for new tag only
	};

	const saveGroupScenarios = async (grpSessions: TrainingSession[], newArr: string[]) => {
		setSavingId(grpSessions[0]?.id ?? null);
		const value = stringifyScenarios(newArr);
		try {
			const token = localStorage.getItem("token");
			await Promise.all(grpSessions.map(s =>
				fetch(`/api/mdafaat/training-sessions/${s.id}`, {
					method: "PATCH",
					headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
					body: JSON.stringify({ extra_scenarios: value }),
				})
			));
			setSessions(prev => prev.map(s =>
				grpSessions.some(gs => gs.id === s.id) ? { ...s, extra_scenarios: value } : s
			));
		} catch (e) {
			console.error(e);
			setToastMsg({ ok: false, text: "❌ 額外情境儲存失敗" });
			setTimeout(() => setToastMsg(null), 4000);
		} finally {
			setSavingId(null);
		}
	};

	// ── Redo collection ──────────────────────────────────────────────────────
	const collectRedoStudents = () => {
		// Gather unique students marked redo in the current filtered date range
		const seen = new Set<string>();
		const redoStudents: Array<{ userId: string; name: string; employeeId: string; rank: string }> = [];
		filtered
			.filter(s => s.result === "redo")
			.forEach(s => {
				if (!seen.has(s.employee_id)) {
					seen.add(s.employee_id);
					const member = (s.team_members as any[])?.find(
						m => typeof m === "object" && String(m.employeeId ?? m.employee_id) === String(s.employee_id)
					);
					redoStudents.push(member ?? { userId: s.employee_id, name: "-", employeeId: s.employee_id, rank: "-" });
				}
			});
		return redoStudents;
	};

	// ── Export: screenshot the records div → canvas → PDF via jsPDF ────────
	const exportPDF = async () => {
		const el = printRef.current;
		if (!el) { setToastMsg({ ok: false, text: "找不到記錄區塊" }); setTimeout(() => setToastMsg(null), 3000); return; }
		try {
			const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
				import("html2canvas"),
				import("jspdf"),
			]);

			// Snapshot full scrollable height
			const canvas = await html2canvas(el, {
				scale: 2,
				useCORS: true,
				backgroundColor: "#1a1f35",
				scrollY: 0,
				windowWidth: el.scrollWidth,
				width: el.scrollWidth,
				height: el.scrollHeight,
			});

			const imgData = canvas.toDataURL("image/png");
			const imgW = canvas.width;
			const imgH = canvas.height;

			// Fit image width to A4 landscape, split into pages by height
			const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
			const pageW = pdf.internal.pageSize.getWidth();
			const pageH = pdf.internal.pageSize.getHeight();
			const ratio = pageW / imgW;
			const scaledH = imgH * ratio;

			let yOffset = 0;
			const pageImgH = pageH / ratio;   // canvas pixels per page

			while (yOffset < imgH) {
				if (yOffset > 0) pdf.addPage();
				// Crop canvas slice for this page
				const sliceCanvas = document.createElement("canvas");
				const sliceH = Math.min(pageImgH, imgH - yOffset);
				sliceCanvas.width = imgW;
				sliceCanvas.height = sliceH;
				const ctx = sliceCanvas.getContext("2d")!;
				ctx.drawImage(canvas, 0, yOffset, imgW, sliceH, 0, 0, imgW, sliceH);
				pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 0, 0, pageW, sliceH * ratio);
				yOffset += pageImgH;
			}

			pdf.save(`MDAfaat_訓練記錄_${selectedDate}.pdf`);
		} catch (err: any) {
			console.error("PDF export error:", err);
			setToastMsg({ ok: false, text: `❌ 匯出失敗：${err.message}` });
			setTimeout(() => setToastMsg(null), 4000);
		}
	};

	// ── Export: fill CCTM Appendix 1.18 form image → PDF ─────────────────────
	// All coordinates stored as fractions of source image (10200×13200px).
	// Multiplied by actual image dimensions at runtime → resolution-independent.
	const exportFormPDF = async (trainingType: string, scenarioOrder: string[]) => {
		if (sortedDates.length === 0 || !deduped[selectedDate]) {
			setToastMsg({ ok: false, text: "沒有可匯出的記錄" });
			setTimeout(() => setToastMsg(null), 3000);
			return;
		}
		try {
			const { default: jsPDF } = await import("jspdf");

			// ── Build flat ordered student list for this date ────────────────
			// ONE row per unique employee across ALL groups.
			// Each appearance (group session) adds a scenario number + duty to that employee's row.
			const getRankOrder = (rank: string) => {
				const r = (rank ?? "").toLowerCase();
				if (r.includes("mg") || r.includes("manager"))    return 1;
				if (r.includes("sc") || r.includes("section"))    return 2;
				if (r.includes("fi") || r.includes("instructor")) return 3;
				if (r.includes("pr") || r.includes("purser"))     return 4;
				if (r.includes("lf") || r.includes("leading"))    return 5;
				return 6;
			};
			const ATR_DUTIES  = ["F1", "F2"];
			const B738_DUTIES = ["1L", "1R", "3L", "3R", "Z2", "3RA"];

			// scenarioNumMap: core_scenario key → number 1-6 (based on instructor-chosen order)
			const scenarioNumMap: Record<string, number> = {};
			scenarioOrder.forEach((key, i) => { scenarioNumMap[key] = i + 1; });

			const dateGroups = deduped[selectedDate];

			// employee data store: one entry per unique employee
			interface EmpEntry {
				employeeId: string;
				name: string;
				rank: string;
				scenarioNums: number[];  // scenario numbers in order of appearance
				duties: string[];        // duty per appearance, parallel to scenarioNums
				results: Array<"pass" | "redo" | null>;
			}
			const empMap = new Map<string, EmpEntry>();

			// Sort groups by group_number first
			const sortedGroups = Object.entries(dateGroups).sort(([, a], [, b]) =>
				(a[0]?.group_number ?? 0) - (b[0]?.group_number ?? 0)
			);

			for (const [, grpSessions] of sortedGroups) {
				if (!grpSessions.length) continue;
				const grpType  = grpSessions[0].group_type;
				const dutyList = grpType === "B738" ? B738_DUTIES : ATR_DUTIES;

				// Sort within group by rank then employeeId
				const sorted = [...grpSessions].sort((a, b) => {
					const mA = a.team_members?.find((m: any) => String(m.employeeId) === String(a.employee_id));
					const mB = b.team_members?.find((m: any) => String(m.employeeId) === String(b.employee_id));
					const rd = getRankOrder(mA?.rank ?? "") - getRankOrder(mB?.rank ?? "");
					return rd !== 0 ? rd : parseInt(a.employee_id) - parseInt(b.employee_id);
				});

				sorted.forEach((s, posIdx) => {
					const member = s.team_members?.find((m: any) => String(m.employeeId) === String(s.employee_id));
					const duty   = dutyList[posIdx] ?? `P${posIdx + 1}`;
					const scenNum = scenarioNumMap[s.core_scenario] ?? 0;

					if (empMap.has(s.employee_id)) {
						const e = empMap.get(s.employee_id)!;
						e.scenarioNums.push(scenNum);
						e.duties.push(duty);
						e.results.push(s.result);
					} else {
						empMap.set(s.employee_id, {
							employeeId: s.employee_id,
							name:  member?.name ?? "-",
							rank:  member?.rank ?? "",
							scenarioNums: [scenNum],
							duties: [duty],
							results: [s.result],
						});
					}
				});
			}

			// Sort final list by rank then employeeId
			const formRows = Array.from(empMap.values()).sort((a, b) => {
				const rd = getRankOrder(a.rank) - getRankOrder(b.rank);
				return rd !== 0 ? rd : parseInt(a.employeeId) - parseInt(b.employeeId);
			});

			// ═══════════════════════════════════════════════════════════════
			// COORDINATE FINE-TUNING — edit these fractions to adjust layout
			// All values are fractions of image dimensions (0.0 – 1.0).
			// Multiply fraction × imgW for x positions, × imgH for y positions.
			// Original measurements taken from 10200×13200px source image.
			// ───────────────────────────────────────────────────────────────

			// ── HEADER ROW (訓練日期 / 訓練類別 / 機種) ──────────────────
			// Vertical position of the header text line
			const F_HEADER_Y     = 0.157652;  // ← adjust up/down for header row
			// Horizontal start of each header field value
			const F_DATE_X       = 0.243725;  // ← 訓練日期 value x position
			const F_TYPE_X       = 0.513039;  // ← 訓練類別 value x position
			const F_AIRCRAFT_X   = 0.745784;  // ← 機種 value x position

			// ── TABLE ROWS ────────────────────────────────────────────────
			// Y position of the FIRST data row (row 1)
			const F_ROW_Y_START  = 0.259545;  // ← move all rows up/down together
			// Vertical distance between each row
			const F_ROW_STEP     = 0.026667;  // ← 352/13200 — row height fraction
			// Extra downward nudge applied from row 5 onward (rows drift lower in the printed form)
			const ROW_DRIFT      = 0.006;     // ← increase if rows 5-20 are still too high; set 0 to disable

			// ── PER-ROW Y OVERRIDES ───────────────────────────────────────
			// To fine-tune a specific row, add an entry here (0-indexed, so row 1 = index 0).
			// Example: if row 3 (index 2) needs to move 5px lower on a 2200px image → add 5/2200 = 0.00227
			// Leave empty ({}) to use automatic spacing for all rows.
			const ROW_Y_OVERRIDES: Record<number, number> = {
				// 0: 0.000,   // row 1  — add fraction offset here (positive = lower)
				// 1: 0.000,   // row 2
				// 2: 0.000,   // row 3
				// 3: 0.000,   // row 4
				4: -0.00318,   // row 5
				5: -0.00318,   // row 6
				// 6: 0.000,   // row 7
				// 7: 0.000,   // row 8
				// 8: 0.000,   // row 9
				// 9: 0.000,   // row 10
				// 10: 0.000,  // row 11
				// 11: 0.000,  // row 12
				// 12: 0.000,  // row 13
				// 13: 0.000,  // row 14
				// 14: 0.000,  // row 15
				// 15: 0.000,  // row 16
				// 16: 0.000,  // row 17
				// 17: 0.000,  // row 18
				// 18: 0.000,  // row 19
				// 19: 0.000,  // row 20
			};

			// ── COLUMNS (x positions) ─────────────────────────────────────
			// Each column is defined by its left and right boundary fraction.
			// Text is centered within the range (or left-aligned for header fields).
			const F_EID_MID      = (0.190882 + 0.279216) / 2;  // ← 員工號 center  (range: 0.190882–0.279216)
			const F_NAME_MID     = (0.290980 + 0.409216) / 2;  // ← 姓名 center    (range: 0.290980–0.409216)
			const F_NAME_MAXW    = (0.409216 - 0.290980);      // ← 姓名 max width fraction
			const F_CHECK_X      = 0.447549;                    // ← Check ✓/✗ center x
			const F_RC_X         = 0.513431;                    // ← R/C ✓ center x
			const F_SCEN_MID     = (0.553137 + 0.702255) / 2;  // ← Scenario center (range: 0.553137–0.702255)
			const F_SCEN_MAXW    = (0.702255 - 0.553137);      // ← Scenario max width fraction
			const F_DUTY_MID     = (0.714902 + 0.894412) / 2;  // ← Duty center    (range: 0.714902–0.894412)
			const F_DUTY_MAXW    = (0.894412 - 0.714902);      // ← Duty max width fraction

			// ── FONT SIZE — defined after imgW is available (see below) ──────
			// ← to change font size, edit the multipliers after the image loads
			// ═══════════════════════════════════════════════════════════════

			// Resolve fractions to pixels (do not edit these lines)
			const HEADER_Y    = () => imgH * F_HEADER_Y;
			const DATE_X      = () => imgW * F_DATE_X;
			const TYPE_X      = () => imgW * F_TYPE_X;
			const AIRCRAFT_X  = () => imgW * F_AIRCRAFT_X;
			const ROW_Y       = (i: number) => imgH * (
				F_ROW_Y_START
				+ i * F_ROW_STEP
				+ (i >= 4 ? ROW_DRIFT : 0)
				+ (ROW_Y_OVERRIDES[i] ?? 0)
			);
			const EID_MID     = () => imgW * F_EID_MID;
			const NAME_MID    = () => imgW * F_NAME_MID;
			const NAME_MAXW   = () => imgW * F_NAME_MAXW;
			const CHECK_X     = () => imgW * F_CHECK_X;
			const RC_X        = () => imgW * F_RC_X;
			const SCEN_MID    = () => imgW * F_SCEN_MID;
			const SCEN_MAXW   = () => imgW * F_SCEN_MAXW;
			const DUTY_MID    = () => imgW * F_DUTY_MID;
			const DUTY_MAXW   = () => imgW * F_DUTY_MAXW;

			// ── Determine aircraft type label ────────────────────────────────
			const hasB738 = formRows.some(r => r.groupType === "B738");
			const aircraftLabel = hasB738 ? "ATR/B738" : "ATR";

			// ── Load the form image ──────────────────────────────────────────
			const formRes = await fetch("/images/cctm_appendix_1_18.png");
			if (!formRes.ok) throw new Error("找不到表單圖片 /images/cctm_appendix_1_18.png");
			const formBlob = await formRes.blob();
			const formUrl  = URL.createObjectURL(formBlob);

			// Draw onto canvas
			const formImg = await new Promise<HTMLImageElement>((res, rej) => {
				const img = new window.Image();
				img.onload = () => res(img);
				img.onerror = rej;
				img.src = formUrl;
			});

			const imgW = formImg.naturalWidth;
			const imgH = formImg.naturalHeight;

			// ── FONT SIZE ─────────────────────────────────────────────────
			const FONT_SIZE    = Math.round(imgW * 0.016);  // ← increase multiplier for larger text
			const FONT_SIZE_SM = Math.round(imgW * 0.013);  // ← small font for long scenario/duty text

			const canvas = document.createElement("canvas");
			canvas.width  = imgW;
			canvas.height = imgH;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(formImg, 0, 0);
			URL.revokeObjectURL(formUrl);

			ctx.fillStyle = "#000000";
			ctx.textBaseline = "middle";

			const drawCentered = (text: string, cx: number, y: number, maxW?: number, small = false) => {
				ctx.font = `${small ? FONT_SIZE_SM : FONT_SIZE}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
				const w = ctx.measureText(text).width;
				ctx.fillText(text, cx - w / 2, y, maxW);
			};
			const drawLeft = (text: string, x: number, y: number, maxW?: number, small = false) => {
				ctx.font = `${small ? FONT_SIZE_SM : FONT_SIZE}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
				ctx.fillText(text, x, y, maxW);
			};

			// ── Header ───────────────────────────────────────────────────────
			const dateLabel = selectedDate.replace(/-/g, "/");
			drawLeft(dateLabel,     DATE_X(),    HEADER_Y());
			drawLeft(trainingType,  TYPE_X(),    HEADER_Y());
			drawLeft(aircraftLabel, AIRCRAFT_X(), HEADER_Y());

			// ── Table rows ───────────────────────────────────────────────────
			formRows.slice(0, 20).forEach((row, idx) => {
				const y = ROW_Y(idx);

				// Employee ID and Name
				drawCentered(row.employeeId, EID_MID(),  y);
				drawCentered(row.name,       NAME_MID(), y, NAME_MAXW());

				// Check = ✓ if all results pass, ✗ if any redo
				// R/C = ✓ if any result was redo (attempted recheck)
				const anyRedo = row.results.some(r => r === "redo");
				const allPass = row.results.every(r => r === "pass");
				const checkMark = allPass ? "✓" : "✗";
				const rcMark    = anyRedo ? "✓" : "";

				// Scenario numbers: "1", "1, 3", etc. (deduplicated, sorted)
				const uniqueScenNums = [...new Set(row.scenarioNums)].sort((a, b) => a - b);
				const scenarioLabel  = uniqueScenNums.map(n => n > 0 ? String(n) : "?").join(", ");

				// Duties: "F1", "F1, F2", etc.
				const dutyLabel = row.duties.join(", ");

				// Draw check marks
				const checkColor = checkMark === "✗" ? "#cc0000" : "#006600";
				ctx.fillStyle = checkColor;
				drawCentered(checkMark, CHECK_X(), y);

				if (rcMark) {
					ctx.fillStyle = "#006600";
					drawCentered(rcMark, RC_X(), y);
				}

				ctx.fillStyle = "#000000";

				// Scenario numbers — centered
				drawCentered(scenarioLabel, SCEN_MID(), y, SCEN_MAXW());

				// Duties — centered, small font if multiple
				drawCentered(dutyLabel, DUTY_MID(), y, DUTY_MAXW(), dutyLabel.length > 4);
			});

			// ── Export canvas → PDF ──────────────────────────────────────────
			// Use jsPDF — add the canvas as image, fit to A4 portrait
			const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
			const pageW = pdf.internal.pageSize.getWidth();
			const pageH = pdf.internal.pageSize.getHeight();

			// Scale image to fit page width, may need multiple pages if tall
			const ratio   = pageW / imgW;
			const scaledH = imgH * ratio;

			let yOff = 0;
			const pageImgH = pageH / ratio;

			while (yOff < imgH) {
				if (yOff > 0) pdf.addPage();
				const sliceH  = Math.min(pageImgH, imgH - yOff);
				const sliceC  = document.createElement("canvas");
				sliceC.width  = imgW;
				sliceC.height = sliceH;
				const sCtx = sliceC.getContext("2d")!;
				sCtx.drawImage(canvas, 0, yOff, imgW, sliceH, 0, 0, imgW, sliceH);
				pdf.addImage(sliceC.toDataURL("image/png"), "PNG", 0, 0, pageW, sliceH * ratio);
				yOff += pageImgH;
			}

			pdf.save(`CCTM_1.18_${selectedDate}.pdf`);
			setToastMsg({ ok: true, text: "✅ CCTM 表單匯出成功" });
			setTimeout(() => setToastMsg(null), 3000);

		} catch (err: any) {
			console.error("Form PDF export error:", err);
			setToastMsg({ ok: false, text: `❌ 表單匯出失敗：${err.message}` });
			setTimeout(() => setToastMsg(null), 4000);
		}
	};

	// ── Stats bar ───────────────────────────────────────────────────────────
	const allGroups = Object.values(deduped).flatMap(dateGroups => Object.values(dateGroups));
	const totalSessions = allGroups.length;                                // groups
	const passCount  = filtered.filter(s => s.result === "pass").length;  // individual students
	const redoCount  = filtered.filter(s => s.result === "redo").length;  // individual students
	const noResultCount = filtered.filter(s => !s.result).length;

	// ── Render ────────────────────────────────────────────────────────────────
	return (
		<div className={styles.container}>
			{/* ── Toast ── */}
			{toastMsg && (
				<div style={{
					position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
					zIndex: 9998, padding: '0.6rem 1.25rem', borderRadius: '0.5rem',
					fontWeight: 600, fontSize: '0.95rem', pointerEvents: 'none',
					background: toastMsg.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
					color: toastMsg.ok ? '#10b981' : '#ef4444',
					border: `1px solid ${toastMsg.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
				}}>
					{toastMsg.text}
				</div>
			)}
			{/* ── Redo Confirm Modal ── */}
			{redoConfirm && (
				<div style={{
					position: 'fixed', inset: 0, zIndex: 9999,
					background: 'rgba(0,0,0,0.7)',
					display: 'flex', alignItems: 'center', justifyContent: 'center',
				}}>
					<div style={{
						background: '#1e293b', border: '1px solid rgba(74,158,255,0.4)',
						borderRadius: '0.75rem', padding: '2rem', maxWidth: '360px', width: '90%',
						textAlign: 'center',
					}}>
						<p style={{ color: '#4a9eff', fontWeight: 700, marginBottom: '0.5rem', fontSize: '1.1rem' }}>
							🔄 啟動重考模式
						</p>
						<p style={{ color: '#a0aec0', marginBottom: '1.5rem' }}>
							{redoConfirm.students.length} 位學員將進入重考流程
						</p>
						<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
							<button onClick={() => setRedoConfirm(null)} style={{
								padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
								background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
								color: '#e8e9ed', cursor: 'pointer', fontWeight: 600,
							}}>取消</button>
							<button onClick={() => { setRedoConfirm(null); onStartRedo(redoConfirm.students, sessions.filter(s => s.training_date === selectedDate)); }} style={{
								padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
								background: 'linear-gradient(135deg, #4a9eff, #2563eb)',
								border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600,
							}}>確認啟動</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Admin Edit Training Record Modal ── */}
			{editModal && (
				<div style={{ position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem',overflowY:'auto' }}>
					<div style={{ background:'#1e293b',border:'1px solid rgba(74,158,255,0.3)',borderRadius:'0.75rem',padding:'1.75rem',width:'100%',maxWidth:'560px',maxHeight:'90vh',overflowY:'auto',display:'flex',flexDirection:'column',gap:'1rem' }}>
						<div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
							<p style={{ color:'#60a5fa',fontWeight:700,fontSize:'1.05rem',margin:0 }}>✏️ 編輯訓練記錄 — {editModal.grpKey}</p>
							<button onClick={()=>{setEditModal(null);setShowCardChooser(false);setAvailableDecks([]);setSelectedDeckCode(null);setIncludeComp(true);}} style={{ background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:'1.2rem' }}>✕</button>
						</div>

						{/* Scenario */}
						<div>
							<label style={{ color:'#94a3b8',fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.3rem' }}>情境 Card Deck</label>
							<div style={{ display:'flex',gap:'0.5rem',alignItems:'center' }}>
								<select value={editScenario} onChange={e=>{
									setEditScenario(e.target.value);
									setEditScenarioPath([]);
									setAvailableDecks([]);
									setSelectedDeckCode(null);
									setIncludeComp(true);
									setShowCardChooser(false);
								}}
									style={{ flex:1,background:'#0f172a',border:'1px solid rgba(148,163,184,0.2)',borderRadius:'0.375rem',color:'#e2e8f0',padding:'0.5rem 0.6rem',fontSize:'0.9rem' }}>
									{Object.entries(CORE_SCENARIO_LABELS).map(([k,v])=>(
										<option key={k} value={k}>{v}</option>
									))}
								</select>
								<button onClick={()=>fetchDeckForEdit(editScenario)} disabled={fetchingDeck}
									style={{ padding:'0.45rem 0.75rem',borderRadius:'0.375rem',border:`1px solid ${editScenarioPath.length>0?'rgba(74,222,128,0.3)':'rgba(74,158,255,0.3)'}`,background:editScenarioPath.length>0?'rgba(74,222,128,0.1)':'rgba(74,158,255,0.1)',color:editScenarioPath.length>0?'#4ade80':'#60a5fa',fontSize:'0.78rem',fontWeight:600,cursor:fetchingDeck?'not-allowed':'pointer',whiteSpace:'nowrap',opacity:fetchingDeck?0.6:1 }}>
									{fetchingDeck?'載入中...':editScenarioPath.length>0?'✓ 已選牌組 (點擊重選)':'🎴 選擇牌組'}
								</button>
							</div>
							{editScenarioPath.length>0 && (
								<div style={{ marginTop:'0.3rem',fontSize:'0.7rem',color:'#4ade80',fontFamily:'monospace' }}>
									{editScenarioPath.filter((p:any)=>!p.skipped).map((p:any)=>p.code).join(' → ')}
								</div>
							)}
							{/* Card chooser panel */}
							{showCardChooser && availableDecks.length > 0 && (
								<div style={{ marginTop:'0.5rem',background:'#0f172a',border:'1px solid rgba(74,158,255,0.2)',borderRadius:'0.5rem',overflow:'hidden' }}>
									<div style={{ padding:'0.4rem 0.75rem',background:'rgba(74,158,255,0.08)',borderBottom:'1px solid rgba(74,158,255,0.15)' }}>
										<span style={{ color:'#60a5fa',fontSize:'0.75rem',fontWeight:700 }}>選擇牌組 ({availableDecks.length} 組可選)</span>
									</div>
									<div style={{ maxHeight:'260px',overflowY:'auto' }}>
										{[...availableDecks].sort((a,b)=>a.scenario_code.localeCompare(b.scenario_code)).map(deck => (
											<label key={deck.scenario_code} style={{ display:'flex',alignItems:'flex-start',gap:'0.6rem',padding:'0.6rem 0.75rem',borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer',background:selectedDeckCode===deck.scenario_code?'rgba(74,158,255,0.08)':'transparent' }}>
												<input type="radio" name="deckChoice" checked={selectedDeckCode===deck.scenario_code}
													onChange={()=>setSelectedDeckCode(deck.scenario_code)}
													style={{ accentColor:'#4a9eff',marginTop:'0.25rem',flexShrink:0 }}/>
												<div style={{ minWidth:0 }}>
													<div style={{ color:'#4a9eff',fontFamily:'monospace',fontSize:'0.8rem',fontWeight:700,marginBottom:'0.3rem' }}>{deck.scenario_code}</div>
													<div style={{ display:'flex',flexDirection:'column',gap:'0.2rem' }}>
														<div style={{ fontSize:'0.75rem' }}><span style={{ color:'#4a9eff',fontWeight:600,marginRight:'0.35rem' }}>BG</span><span style={{ color:'#e2e8f0' }}>{deck.background}</span></div>
														<div style={{ fontSize:'0.75rem' }}><span style={{ color:'#4a9eff',fontWeight:600,marginRight:'0.35rem' }}>TR</span><span style={{ color:'#e2e8f0' }}>{deck.trigger}</span></div>
														{deck.complication && <div style={{ fontSize:'0.75rem' }}><span style={{ color:'#db2777',fontWeight:600,marginRight:'0.35rem' }}>COMP</span><span style={{ color:'#e2e8f0' }}>{deck.complication}</span></div>}
														<div style={{ fontSize:'0.75rem' }}><span style={{ color:'#64748b',fontWeight:600,marginRight:'0.35rem' }}>OUT</span><span style={{ color:'#e2e8f0' }}>{deck.outcome}</span></div>
													</div>
												</div>
											</label>
										))}
									</div>
									<div style={{ padding:'0.4rem 0.75rem',display:'flex',justifyContent:'space-between',alignItems:'center',gap:'0.5rem',borderTop:'1px solid rgba(255,255,255,0.05)',flexWrap:'wrap' }}>
										{availableDecks.find(d=>d.scenario_code===selectedDeckCode)?.complication ? (
											<label style={{ display:'flex',alignItems:'center',gap:'0.4rem',cursor:'pointer',fontSize:'0.78rem',color:includeComp?'#db2777':'#64748b' }}>
												<input type="checkbox" checked={includeComp} onChange={e=>setIncludeComp(e.target.checked)} style={{ accentColor:'#db2777' }}/>
												包含 C. 併發 Complication
											</label>
										) : <div/>}
										<div style={{ display:'flex',gap:'0.4rem' }}>
											<button onClick={()=>{setShowCardChooser(false);setSelectedDeckCode(null);setIncludeComp(true);}} style={{ padding:'0.3rem 0.75rem',fontSize:'0.78rem',background:'rgba(100,116,139,0.15)',border:'1px solid rgba(100,116,139,0.2)',color:'#94a3b8',borderRadius:'0.375rem',cursor:'pointer' }}>取消</button>
											<button onClick={applyDeckSelection} disabled={!selectedDeckCode}
												style={{ padding:'0.3rem 0.75rem',fontSize:'0.78rem',fontWeight:700,background:'linear-gradient(135deg,#16a34a,#15803d)',border:'none',color:'#fff',borderRadius:'0.375rem',cursor:selectedDeckCode?'pointer':'not-allowed',opacity:selectedDeckCode?1:0.5 }}>✓ 套用牌組</button>
										</div>
									</div>
								</div>
							)}
						</div>

						{/* Conditions */}
						<div>
							<label style={{ color:'#94a3b8',fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.4rem' }}>飛行條件</label>
							<div style={{ display:'flex',gap:'0.5rem',flexWrap:'wrap',alignItems:'center' }}>
								{(['morning','midday','night'] as const).map(t=>(
									<button key={t} onClick={()=>setEditCondTime(t)}
										style={{ padding:'0.35rem 0.75rem',borderRadius:'0.375rem',border:'1px solid',fontSize:'0.82rem',fontWeight:600,cursor:'pointer',
											background: editCondTime===t ? 'rgba(74,158,255,0.2)' : 'rgba(30,41,59,0.6)',
											borderColor: editCondTime===t ? '#4a9eff' : 'rgba(148,163,184,0.2)',
											color: editCondTime===t ? '#60a5fa' : '#94a3b8' }}>
										{t==='morning'?'🌅 早上':t==='midday'?'☀️ 中午':'🌙 晚上'}
									</button>
								))}
								<label style={{ display:'flex',alignItems:'center',gap:'0.3rem',color:'#94a3b8',fontSize:'0.82rem',cursor:'pointer' }}>
									<input type="checkbox" checked={editCondFull} onChange={e=>setEditCondFull(e.target.checked)}/> ✈️ 客滿
								</label>
								<label style={{ display:'flex',alignItems:'center',gap:'0.3rem',color:'#94a3b8',fontSize:'0.82rem',cursor:'pointer' }}>
									<input type="checkbox" checked={editCondInfants} onChange={e=>setEditCondInfants(e.target.checked)}/> 👶 嬰兒
								</label>
							</div>
							<div style={{ marginTop:'0.5rem' }}>
								<label style={{ color:'#94a3b8',fontSize:'0.78rem',display:'block',marginBottom:'0.25rem' }}>特殊旅客</label>
								<select value={editCondPax} onChange={e=>setEditCondPax(e.target.value)}
									style={{ width:'100%',background:'#0f172a',border:'1px solid rgba(148,163,184,0.2)',borderRadius:'0.375rem',color:'#e2e8f0',padding:'0.45rem 0.6rem',fontSize:'0.85rem' }}>
									<option value="">— 無特殊旅客 —</option>
									{SPECIAL_PAX_OPTIONS.map(p=>(<option key={p} value={p}>{p}</option>))}
								</select>
							</div>
						</div>

						{/* Flight info */}
						<div>
							<label style={{ color:'#94a3b8',fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.4rem' }}>航班資訊</label>
							<div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem' }}>
								{[['航班號',editFlightNo,setEditFlightNo],['機型',editAcType,setEditAcType],['出發',editDeparture,setEditDeparture],['到達',editArrival,setEditArrival]].map(([label,val,setter]:any)=>(
									<div key={label}>
										<label style={{ color:'#64748b',fontSize:'0.75rem',display:'block',marginBottom:'0.2rem' }}>{label}</label>
										<input value={val} onChange={e=>setter(e.target.value)}
											style={{ width:'100%',background:'#0f172a',border:'1px solid rgba(148,163,184,0.2)',borderRadius:'0.375rem',color:'#e2e8f0',padding:'0.4rem 0.6rem',fontSize:'0.85rem',boxSizing:'border-box' }}/>
									</div>
								))}
							</div>
						</div>

						{/* Per-member results */}
						<div>
							<label style={{ color:'#94a3b8',fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.4rem' }}>成員結果</label>
							<div style={{ display:'flex',flexDirection:'column',gap:'0.35rem' }}>
								{[...editModal.sessions].sort((a,b)=>{
									const rankOrder = (s: typeof a) => {
										const r = (resolveMember(s)?.rank ?? '').toLowerCase();
										if (r.includes('mg')||r.includes('manager')) return 1;
										if (r.includes('sc')||r.includes('section')) return 2;
										if (r.includes('fi')||r.includes('instructor')) return 3;
										if (r.includes('pr')||r.includes('purser')) return 4;
										if (r.includes('lf')||r.includes('leading')) return 5;
										return 6;
									};
									const rd = rankOrder(a) - rankOrder(b);
									return rd !== 0 ? rd : parseInt(a.employee_id) - parseInt(b.employee_id);
								}).map(s=>{
									const m = resolveMember(s);
									return (
										<div key={s.employee_id} style={{ display:'flex',alignItems:'center',gap:'0.6rem',padding:'0.4rem 0.6rem',background:'rgba(0,0,0,0.2)',borderRadius:'0.375rem' }}>
											<span style={{ color:'#4a9eff',fontFamily:'monospace',fontSize:'0.82rem',minWidth:'56px' }}>{s.employee_id}</span>
											<span style={{ color:'#e2e8f0',fontSize:'0.85rem',flex:1 }}>{m?.name ?? '—'}</span>
											{(['pass','redo'] as const).map(r=>(
												<button key={r} onClick={()=>setEditResults(prev=>({...prev,[s.employee_id]:r}))}
													style={{ padding:'0.25rem 0.65rem',borderRadius:'0.375rem',border:'1px solid',fontSize:'0.78rem',fontWeight:700,cursor:'pointer',
														background: editResults[s.employee_id]===r ? (r==='pass'?'rgba(74,222,128,0.2)':'rgba(248,113,113,0.2)') : 'rgba(30,41,59,0.6)',
														borderColor: editResults[s.employee_id]===r ? (r==='pass'?'rgba(74,222,128,0.4)':'rgba(248,113,113,0.4)') : 'rgba(148,163,184,0.2)',
														color: editResults[s.employee_id]===r ? (r==='pass'?'#4ade80':'#f87171') : '#64748b' }}>
													{r==='pass'?'✓ 通過':'↺ 重考'}
												</button>
											))}
										</div>
									);
								})}
							</div>
						</div>

						{/* Members */}
						<div>
							<label style={{ color:'#94a3b8',fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.4rem' }}>組員名單</label>
							<div style={{ display:'flex',flexDirection:'column',gap:'0.3rem',marginBottom:'0.4rem' }}>
								{editMembers.map((m,i)=>(
									<div key={m.employeeId} style={{ display:'flex',alignItems:'center',gap:'0.5rem',padding:'0.35rem 0.6rem',background:'rgba(0,0,0,0.2)',borderRadius:'0.375rem' }}>
										<span style={{ color:'#4a9eff',fontFamily:'monospace',fontSize:'0.8rem',minWidth:'56px' }}>{m.employeeId}</span>
										<span style={{ color:'#e2e8f0',fontSize:'0.84rem',flex:1 }}>{m.name}</span>
										<span style={{ color:'#64748b',fontSize:'0.75rem' }}>{m.rank?.split(' - ')[0]}</span>
										<button onClick={()=>setEditMembers(prev=>prev.filter((_,j)=>j!==i))}
											style={{ background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'0.85rem' }}>✕</button>
									</div>
								))}
							</div>
						</div>

						{/* Extra scenarios */}
						<div>
							<label style={{ color:'#94a3b8',fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:'0.4rem' }}>額外情境 Tags</label>
							<div style={{ display:'flex',flexWrap:'wrap',gap:'0.35rem',marginBottom:'0.4rem' }}>
								{(editExtraScenarios ?? []).map((tag,idx) => (
									<span key={idx} className={styles.tagChip}>{tag}
										<button className={styles.tagDeleteBtn} onClick={()=>setEditExtraScenarios(prev=>(prev??[]).filter((_,i)=>i!==idx))}>×</button>
									</span>
								))}
							</div>
							<div style={{ display:'flex',gap:'0.4rem' }}>
								<input
									value={editTagInput}
									onChange={e=>setEditTagInput(e.target.value)}
									onKeyDown={e=>{ if(e.key==="Enter"&&editTagInput.trim()){ e.preventDefault(); setEditExtraScenarios(prev=>[...(prev??[]),editTagInput.trim()]); setEditTagInput(""); }}}
									placeholder="輸入額外情境後按 Enter..."
									style={{ flex:1,background:'#0f172a',border:'1px solid rgba(74,158,255,0.3)',borderRadius:'0.375rem',color:'#e2e8f0',fontSize:'0.82rem',padding:'0.38rem 0.6rem' }}
								/>
								<button
									onClick={()=>{ if(editTagInput.trim()){ setEditExtraScenarios(prev=>[...(prev??[]),editTagInput.trim()]); setEditTagInput(""); }}}
									style={{ padding:'0.38rem 0.75rem',borderRadius:'0.375rem',background:'rgba(74,158,255,0.12)',border:'1px solid rgba(74,158,255,0.3)',color:'#60a5fa',fontSize:'0.82rem',fontWeight:600,cursor:'pointer' }}>
									+ 新增
								</button>
							</div>
						</div>

						{/* Save / Cancel */}
						<div style={{ display:'flex',gap:'0.75rem',justifyContent:'flex-end',marginTop:'0.5rem' }}>
							<button onClick={()=>{setEditModal(null);setShowCardChooser(false);setAvailableDecks([]);setSelectedDeckCode(null);setIncludeComp(true);}} style={{ padding:'0.5rem 1.25rem',borderRadius:'0.5rem',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',color:'#e8e9ed',cursor:'pointer',fontWeight:600 }}>取消</button>
							<button onClick={saveEditModal} disabled={editSaving}
								style={{ padding:'0.5rem 1.25rem',borderRadius:'0.5rem',background:'linear-gradient(135deg,#16a34a,#15803d)',border:'none',color:'#fff',cursor:'pointer',fontWeight:700,opacity:editSaving?0.7:1 }}>
								{editSaving ? '儲存中...' : '💾 儲存'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Training Type + Scenario Order Modal ── */}
			{trainingTypeModal && (
				<div style={{
					position: 'fixed', inset: 0, zIndex: 9999,
					background: 'rgba(0,0,0,0.7)',
					display: 'flex', alignItems: 'center', justifyContent: 'center',
					overflowY: 'auto', padding: '1rem',
				}}>
					<div style={{
						background: '#1e293b', border: '1px solid rgba(16,185,129,0.4)',
						borderRadius: '0.75rem', padding: '2rem', maxWidth: '420px', width: '90%',
						textAlign: 'center',
					}}>
						<p style={{ color: '#34d399', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
							📋 選擇訓練類別
						</p>
						{(() => {
							const TYPE_COLORS: Record<string, { active: string; border: string; bg: string }> = {
								FABT: { active: '#f87171', border: 'rgba(248,113,113,0.5)', bg: 'rgba(239,68,68,0.15)' },
								FALT: { active: '#fb923c', border: 'rgba(251,146,60,0.5)',  bg: 'rgba(234,88,12,0.15)'  },
								FAPT: { active: '#22d3ee', border: 'rgba(34,211,238,0.5)',  bg: 'rgba(6,182,212,0.15)'  },
								FAAT: { active: '#34d399', border: 'rgba(52,211,153,0.5)',  bg: 'rgba(16,185,129,0.15)' },
								FATT: { active: '#60a5fa', border: 'rgba(96,165,250,0.5)',  bg: 'rgba(59,130,246,0.15)' },
								FAQT: { active: '#fbbf24', border: 'rgba(251,191,36,0.5)',  bg: 'rgba(245,158,11,0.15)' },
								FAOT: { active: '#c084fc', border: 'rgba(192,132,252,0.5)', bg: 'rgba(139,92,246,0.15)' },
							};
							return (
								<div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
									{(["FABT", "FALT", "FAPT", "FAAT", "FATT", "FAQT", "FAOT"] as const).map(type => {
										const c = TYPE_COLORS[type];
										const selected = selectedTrainingType === type;
										return (
											<button
												key={type}
												onClick={() => setSelectedTrainingType(type)}
												style={{
													padding: '0.6rem 1rem',
													borderRadius: '0.5rem',
													border: selected ? `2px solid ${c.border}` : '1px solid rgba(255,255,255,0.08)',
													background: selected ? c.bg : 'rgba(255,255,255,0.03)',
													color: selected ? c.active : '#64748b',
													fontWeight: selected ? 700 : 500,
													fontSize: '1rem',
													cursor: 'pointer',
													transition: 'all 0.15s',
													letterSpacing: '0.05em',
												}}
											>
												{type}
											</button>
										);
									})}
								</div>
							);
						})()}
						{/* ── Scenario numbering ── */}
						<div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
							<p style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
								情境編號順序 (1–6)
							</p>
							{scenarioOrder.map((key, idx) => (
								<div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
									<span style={{
										minWidth: '1.5rem', height: '1.5rem', borderRadius: '50%',
										background: 'rgba(74,158,255,0.2)', color: '#60a5fa',
										display: 'flex', alignItems: 'center', justifyContent: 'center',
										fontWeight: 700, fontSize: '0.8rem',
									}}>{idx + 1}</span>
									<select
										value={key}
										onChange={e => {
											const newOrder = [...scenarioOrder];
											// Swap with whatever was in the target position
											const swapIdx = newOrder.indexOf(e.target.value);
											if (swapIdx !== -1) newOrder[swapIdx] = newOrder[idx];
											newOrder[idx] = e.target.value;
											setScenarioOrder(newOrder);
										}}
										style={{
											flex: 1, background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)',
											borderRadius: '0.375rem', color: '#e2e8f0', padding: '0.3rem 0.5rem',
											fontSize: '0.85rem', cursor: 'pointer',
										}}
									>
										{ALL_CORE_SCENARIOS.map(s => (
											<option key={s} value={s}>{CORE_SCENARIO_NAMES[s]}</option>
										))}
									</select>
								</div>
							))}
						</div>

						<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
							<button onClick={() => setTrainingTypeModal(false)} style={{
								padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
								background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
								color: '#e8e9ed', cursor: 'pointer', fontWeight: 600,
							}}>取消</button>
							<button onClick={() => { setTrainingTypeModal(false); exportFormPDF(selectedTrainingType, scenarioOrder); }} style={{
								padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
								background: 'linear-gradient(135deg, #10b981, #059669)',
								border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600,
							}}>匯出 PDF</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Toolbar ── */}
			<div className={styles.toolbar}>
				<div className={styles.dateRange}>
					<label className={styles.dateLabel}>日期</label>
					<select
						value={selectedDate}
						onChange={e => setSelectedDate(e.target.value)}
						className={styles.dateInput}
						style={{ minWidth: '130px' }}
					>
						{availableDates.length === 0 && (
							<option value="">（無記錄）</option>
						)}
						{availableDates.map(d => (
							<option key={d} value={d}>{d}</option>
						))}
					</select>
					<button className={styles.refreshBtn} onClick={fetchSessions} title="重新整理">
						<RefreshCw size={15} />
					</button>
				</div>

				<div className={styles.searchBar}>
					<Search size={14} className={styles.searchIcon} />
					<input
						className={styles.searchInput}
						placeholder="搜尋姓名 / 工號..."
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
					/>
					{searchQuery && (
						<button className={styles.clearBtn} onClick={() => setSearchQuery("")}><X size={13} /></button>
					)}
				</div>

				<div className={styles.filterGroup}>
					{(["all", "pass", "redo"] as const).map(f => (
						<button
							key={f}
							className={`${styles.filterBtn} ${resultFilter === f ? styles.filterActive : ""}`}
							onClick={() => setResultFilter(f)}
						>
							{f === "all" ? "全部" : f === "pass" ? "✓ 通過" : "↺ 重考"}
						</button>
					))}

				</div>

				<div className={styles.actions}>
					{canEdit && redoCount > 0 && (
						<button
							className={styles.redoBtn}
							onClick={() => {
								const students = collectRedoStudents();
								if (students.length === 0) {
									setToastMsg({ ok: false, text: "沒有待重考學員" });
									setTimeout(() => setToastMsg(null), 3000);
									return;
								}
								setRedoConfirm({ students });
							}}
						>
							🔄 啟動重考 ({redoCount} 人)
						</button>
					)}
					<button className={styles.exportBtn} onClick={() => setTrainingTypeModal(true)} style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}>
						<Download size={14} /> 匯出表單
					</button>
				</div>
			</div>

			{/* ── Stats ── */}
			<div className={styles.statsBar}>
				<span className={styles.statItem}>共 <strong>{totalSessions}</strong> 組</span>
				<span className={`${styles.statItem} ${styles.statPass}`}>通過 <strong>{passCount}</strong> 人</span>
				<span className={`${styles.statItem} ${styles.statRedo}`}>重考 <strong>{redoCount}</strong> 人</span>
				{noResultCount > 0 && <span className={styles.statItem}>未記錄 <strong>{noResultCount}</strong></span>}
			</div>

			{/* ── Content ── */}
			{loading ? (
				<div className={styles.loading}>載入中...</div>
			) : sortedDates.length === 0 ? (
				<div className={styles.empty}>此區間沒有訓練記錄</div>
			) : (
				<div className={styles.recordList} ref={printRef}>
					{sortedDates.map(date => (
						<div key={date} className={styles.dateGroup}>
							<div className={styles.dateGroupHeader}>
								{formatDate(date)}
								<span className={styles.dateGroupCount}>
									{Object.values(deduped[date]).length} 組
								</span>
							</div>

							{Object.entries(deduped[date])
								.sort(([, a], [, b]) => {
									const numA = a[0]?.group_number ?? 0;
									const numB = b[0]?.group_number ?? 0;
									if (numA !== numB) return numA - numB;
									return (a[0]?.group_type ?? '').localeCompare(b[0]?.group_type ?? '');
								})
								.map(([grpKey, grpSessions]) => {
									// Sort members by rank then employeeId
									const getRankOrd = (rank: string) => {
										const r = (rank ?? "").toLowerCase();
										if (r.includes("mg")||r.includes("manager")) return 1;
										if (r.includes("sc")||r.includes("section")) return 2;
										if (r.includes("fi")||r.includes("instructor")) return 3;
										if (r.includes("pr")||r.includes("purser")) return 4;
										if (r.includes("lf")||r.includes("leading")) return 5;
										return 6;
									};
									const grpType = grpSessions[0]?.group_type ?? "ATR";
									const dutyList = grpType === "B738" ? ["1L","1R","3L","3R","Z2","3RA"] : ["F1","F2"];
									const sorted = [...grpSessions].sort((a, b) => {
										const mA = resolveMember(a), mB = resolveMember(b);
										const rd = getRankOrd(mA?.rank ?? "") - getRankOrd(mB?.rank ?? "");
										return rd !== 0 ? rd : parseInt(a.employee_id) - parseInt(b.employee_id);
									});
									const s0 = sorted[0];
									const allPass = sorted.every(s => s.result === "pass");
									const anyRedo = sorted.some(s => s.result === "redo");
									const grpCardId = -(grpSessions[0]?.id ?? 0);
									// Compact scenario path: show step codes inline
									const path: ScenarioStep[] = s0?.scenario_path ?? [];
									const pathSummary = path.filter(p => !p.skipped).map(p => p.code).join(" → ");
										// Scenario colour accent
										const SCEN_COLORS: Record<string,[string,string,string]> = {
											bomb_threat:          ['rgba(239,68,68,0.15)',  '#f87171', 'rgba(239,68,68,0.4)'],
											lithium_fire:         ['rgba(251,146,60,0.15)', '#fb923c', 'rgba(251,146,60,0.4)'],
											decompression:        ['rgba(99,102,241,0.15)', '#818cf8', 'rgba(99,102,241,0.4)'],
											incapacitation:       ['rgba(234,179,8,0.15)',  '#fbbf24', 'rgba(234,179,8,0.4)'],
											unplanned_evacuation: ['rgba(34,197,94,0.15)',  '#4ade80', 'rgba(34,197,94,0.4)'],
											planned_evacuation:   ['rgba(14,165,233,0.15)', '#38bdf8', 'rgba(14,165,233,0.4)'],
										};
										const [sBg, sColor, sBorder] = SCEN_COLORS[s0?.core_scenario ?? ''] ?? ['rgba(100,116,139,0.15)', '#94a3b8', 'rgba(100,116,139,0.4)'];
										const groupId = `${s0?.training_date}|${grpKey}`;
										const isEditingG = editingGroup === groupId;
										const tags = parseScenarios(s0?.extra_scenarios);
									return (
									<div key={grpKey} className={styles.groupCard}>
										{/* ── Header: scenario colour strip ── */}
										<div style={{ background:sBg, borderBottom:`1px solid ${sBorder}`, padding:'0.5rem 0.9rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'0.5rem', flexWrap:'wrap' }}>
											<div style={{ display:'flex', alignItems:'center', gap:'0.4rem', flexWrap:'wrap' }}>
												<span style={{ fontWeight:800, fontSize:'0.82rem', color:'#e2e8f0', letterSpacing:'0.05em', textTransform:'uppercase' }}>{grpKey}</span>
												{s0?.is_redo && <span className={styles.redoBadge}>重考</span>}
												<span style={{ background:sBg, color:sColor, border:`1px solid ${sBorder}`, borderRadius:'0.25rem', padding:'0.1rem 0.5rem', fontSize:'0.73rem', fontWeight:700 }}>
													{CORE_SCENARIO_LABELS[s0?.core_scenario] ?? s0?.core_scenario}
												</span>
												<span className={`${styles.resultPill} ${allPass?styles.pillPass:anyRedo?styles.pillRedo:styles.pillNone}`}>
													{allPass?"✓ 全通過":anyRedo?"↺ 含重考":"—"}
												</span>
											</div>
											{s0?.elapsed_time ? <span className={styles.sessionTime}>{formatTime(s0.elapsed_time)}</span> : null}
										</div>
									
										{/* ── Two-column body ── */}
										<div className={styles.cardBody}>
											{/* Left: members */}
											<div className={styles.cardMembersCol}>
												{sorted.map((s, posIdx) => {
													const member = resolveMember(s);
													const duty = dutyList[posIdx] ?? `P${posIdx+1}`;
													const isPassed = s.result === "pass";
													const isRedo   = s.result === "redo";
													return (
														<div key={s.id} className={styles.memberCard}>
															<span className={styles.memberDutyBadge} style={{ color:sColor, borderColor:sBorder }}>{duty}</span>
															<div style={{ width:'2rem', height:'2rem', borderRadius:'50%', overflow:'hidden', flexShrink:0 }}>
																<Avatar employeeId={s.employee_id} size={32} />
															</div>
															<div className={styles.memberCardInfo}>
																<span className={styles.sessionName}>{member?.name ?? "—"}</span>
																<span className={styles.memberCardMeta}>{s.employee_id} · {member?.rank?.split(" - ")[0] ?? "—"}</span>
															</div>
															<span className={`${styles.resultPill} ${isPassed?styles.pillPass:isRedo?styles.pillRedo:styles.pillNone}`}>
																{isPassed?"✓ 通過":isRedo?"↺ 重考":"—"}
															</span>
														</div>
													);
												})}
											</div>
									
											{/* Right: flight details panel */}
											<div className={styles.cardDetailsCol}>
												{s0?.conditions && (
													<div className={styles.detailRow}>
														<span className={styles.detailKey}>時間</span>
														<span className={styles.detailVal}>
															{s0.conditions.time==="morning"?"🌅 早上":s0.conditions.time==="night"?"🌙 晚上":"☀️ 中午"}
														</span>
													</div>
												)}
												{s0?.flight_info && (
													<div className={styles.detailRow}>
														<span className={styles.detailKey}>航班</span>
														<span className={styles.detailVal} style={{ fontFamily:'monospace', color:'#60a5fa' }}>
															{s0.flight_info.flightNo} {s0.flight_info.departure}→{s0.flight_info.arrival}
														</span>
													</div>
												)}
												{s0?.conditions && (
													<div className={styles.detailRow}>
														<span className={styles.detailKey}>客況</span>
														<span className={styles.detailVal}>
															{[s0.conditions.full?"客滿✈️":null, s0.conditions.infants?"嬰兒👶":null, s0.conditions.specialPax||null].filter(Boolean).join("  ") || "—"}
														</span>
													</div>
												)}
												{s0?.instructor && (
													<div className={styles.detailRow}>
														<span className={styles.detailKey}>教師</span>
														<span className={styles.detailVal}>{s0.instructor}</span>
													</div>
												)}
											</div>
										</div>
									
										{/* ── Scenario path: always fully expanded ── */}
										{path.length > 0 && (
											<div className={styles.groupCardPath}>
												<div className={styles.pathSummaryLine}>
													{path.filter(p=>!p.skipped).map(p=>p.code).join(" → ")}
												</div>
												<div className={styles.scenarioPath} style={{ marginTop:'0.4rem' }}>
													{path.map((step, i) => (
														<div key={i} className={`${styles.scenarioStep} ${step.skipped?styles.stepSkipped:""}`}>
															<span className={styles.stepCode}>{step.code}</span>
															<div>
																<span className={styles.stepTitle}>{step.title}{step.skipped&&<span className={styles.skippedTag}> (略過)</span>}</span>
																{step.description&&<div className={styles.stepDesc}>{step.description}</div>}
															</div>
														</div>
													))}
												</div>
											</div>
										)}
									
										{/* ── Footer: extra tags + merged edit button ── */}
										<div className={styles.groupCardFooter}>
											<div className={styles.tagList}>
												{tags.map((tag,idx) => (
													<span key={idx} className={styles.tagChip}>{tag}</span>
												))}
											</div>
											{canEdit && (
												<button className={styles.adminEditBtn} onClick={()=>openEditModal(grpKey, grpSessions)}>
													<Edit2 size={12}/> 編輯
												</button>
											)}
										</div>
									</div>
									);
								}
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default TrainingRecords;