// src/components/mdafaat/TrainingRecords.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, ChevronDown, ChevronUp, Edit2, Download, RefreshCw } from "lucide-react";
import styles from "./TrainingRecords.module.css";

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
	onStartRedo: (redoStudents: Array<{ userId: string; name: string; employeeId: string; rank: string }>) => void;
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
	const [dateFrom, setDateFrom] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() - 30);
		return d.toISOString().split("T")[0];
	});
	const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
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

	// Parse extra_scenarios: stored as JSON array string or plain string
	const parseScenarios = (raw: string | null | undefined): string[] => {
		if (!raw) return [];
		try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw]; }
		catch { return raw.split(/[;,、]\s*/).map(s => s.trim()).filter(Boolean); }
	};
	const stringifyScenarios = (arr: string[]) => JSON.stringify(arr);

	// ── Fetch ────────────────────────────────────────────────────────────────
	const fetchSessions = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({ after: dateFrom, before: dateTo });
			const res = await fetch(`/api/mdafaat/training-sessions?${params}`);
			if (!res.ok) throw new Error("fetch failed");
			const data: TrainingSession[] = await res.json();
			setSessions(data);
		} catch (e) {
			console.error(e);
			setSessions([]);
		} finally {
			setLoading(false);
		}
	}, [dateFrom, dateTo]);

	useEffect(() => { fetchSessions(); }, [fetchSessions]);

	// ── Derived filtered list ────────────────────────────────────────────────
	const filtered = sessions.filter(s => {
		// "Unstarted" = TeamFormation-only save: no result, no elapsed_time, no scenario_path
		if (!s.result && !s.elapsed_time && !s.scenario_path) return false;
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

	const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

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

			pdf.save(`MDAfaat_訓練記錄_${dateFrom}_${dateTo}.pdf`);
		} catch (err: any) {
			console.error("PDF export error:", err);
			setToastMsg({ ok: false, text: `❌ 匯出失敗：${err.message}` });
			setTimeout(() => setToastMsg(null), 4000);
		}
	};

	// ── Stats bar ───────────────────────────────────────────────────────────
	const allGroups = Object.values(grouped).flatMap(dateGroups => Object.values(dateGroups));
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
							<button onClick={() => { setRedoConfirm(null); onStartRedo(redoConfirm.students); }} style={{
								padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
								background: 'linear-gradient(135deg, #4a9eff, #2563eb)',
								border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600,
							}}>確認啟動</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Toolbar ── */}
			<div className={styles.toolbar}>
				<div className={styles.dateRange}>
					<label className={styles.dateLabel}>從</label>
					<input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={styles.dateInput} />
					<label className={styles.dateLabel}>至</label>
					<input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={styles.dateInput} />
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
					<button className={styles.exportBtn} onClick={exportPDF}>
						<Download size={14} /> 匯出 PDF
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
									{Object.values(grouped[date]).length} 組
								</span>
							</div>

							{Object.entries(grouped[date])
								.sort(([a], [b]) => a.localeCompare(b))
								.map(([grpKey, grpSessions]) => (
									<div key={grpKey} className={styles.groupBlock}>
										<div className={styles.groupLabel}>
											{grpSessions[0]?.is_redo && <span className={styles.redoBadge}>重考</span>}
											{grpKey}
											<span className={styles.scenarioBadge}>
												{CORE_SCENARIO_LABELS[grpSessions[0]?.core_scenario] ?? grpSessions[0]?.core_scenario}
											</span>
										</div>

										{/* ── Extra scenarios — tag chips per group ── */}
										{(() => {
											const groupId = `${grpSessions[0]?.training_date}|${grpKey}`;
											const isEditingGroup = editingGroup === groupId;
											const tags = parseScenarios(grpSessions[0]?.extra_scenarios);
											const addTag = async () => {
												const val = editNotes.trim();
												if (!val) return;
												const next = [...tags, val];
												setEditNotes("");
												await saveGroupScenarios(grpSessions, next);
											};
											const removeTag = async (idx: number) => {
												const next = tags.filter((_, i) => i !== idx);
												await saveGroupScenarios(grpSessions, next);
											};
											return (
												<div className={styles.groupExtraRow}>
													<span className={styles.detailLabel}>額外情境</span>
													<div className={styles.tagList}>
														{tags.map((tag, idx) => (
															<span key={idx} className={styles.tagChip}>
																{tag}
																{canEdit && (
																	<button
																		className={styles.tagDeleteBtn}
																		onClick={() => removeTag(idx)}
																		title="刪除"
																	>×</button>
																)}
															</span>
														))}
														{canEdit && (
															isEditingGroup ? (
																<div className={styles.tagInputRow}>
																	<input
																		className={styles.tagInput}
																		value={editNotes}
																		onChange={e => setEditNotes(e.target.value)}
																		onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
																		placeholder="輸入情境後按 Enter..."
																		autoFocus
																	/>
																	<button className={styles.saveBtnSmall} onClick={addTag} disabled={savingId !== null}>
																		{savingId !== null ? "..." : "+ 新增"}
																	</button>
																	<button className={styles.cancelBtnSmall} onClick={() => setEditingGroup(null)}>完成</button>
																</div>
															) : (
																<button className={styles.tagAddBtn} onClick={() => startGroupEdit(groupId)}>
																	<Edit2 size={11} /> 新增
																</button>
															)
														)}
													</div>
												</div>
											);
										})()}

										{grpSessions.map(s => {
											const member = resolveMember(s);
											const expanded = expandedIds.has(s.id);

											return (
												<div key={s.id} className={`${styles.sessionRow} ${s.result === "redo" ? styles.sessionRedo : s.result === "pass" ? styles.sessionPass : ""}`}>
													{/* ── Row summary ── */}
													<div className={styles.sessionSummary} onClick={() => toggleExpand(s.id)}>
														<span className={styles.sessionEid}>{s.employee_id}</span>
														<span className={styles.sessionName}>{member?.name ?? "-"}</span>
														<span className={styles.sessionRank}>{member?.rank?.split(" - ")[0] ?? "-"}</span>
														<span className={`${styles.resultPill} ${s.result === "pass" ? styles.pillPass : s.result === "redo" ? styles.pillRedo : styles.pillNone}`}>
															{s.result === "pass" ? "✓ 通過" : s.result === "redo" ? "↺ 重考" : "—"}
														</span>
														<span className={styles.sessionTime}>{formatTime(s.elapsed_time ?? 0)}</span>
														<span className={styles.sessionInstructor}>{s.instructor}</span>
														<span className={styles.expandIcon}>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
													</div>

													{/* ── Expanded detail ── */}
													{expanded && (
														<div className={styles.sessionDetail}>
															{s.conditions && (
																<div className={styles.detailSection}>
																	<span className={styles.detailLabel}>初始條件</span>
																	<span>
																		{s.conditions.time === "morning" ? "🌅 早上" : s.conditions.time === "night" ? "🌙 晚上" : "☀️ 中午"}
																		{" "} · 客滿: {s.conditions.full ? "YES" : "NO"}
																		{" "} · 嬰兒: {s.conditions.infants ? "YES" : "NO"}
																		{s.conditions.specialPax && ` · ${s.conditions.specialPax}`}
																	</span>
																</div>
															)}

															{s.flight_info && (
																<div className={styles.detailSection}>
																	<span className={styles.detailLabel}>航班</span>
																	<span>{s.flight_info.flightNo} {s.flight_info.departure} → {s.flight_info.arrival} ({s.flight_info.aircraftType})</span>
																</div>
															)}

															{s.scenario_path && s.scenario_path.length > 0 && (
																<div className={styles.detailSection}>
																	<span className={styles.detailLabel}>情境路徑</span>
																	<div className={styles.scenarioPath}>
																		{s.scenario_path.map((step, i) => (
																			<div key={i} className={`${styles.scenarioStep} ${step.skipped ? styles.stepSkipped : ""}`}>
																				<span className={styles.stepCode}>{step.code}</span>
																				<div>
																					<div className={styles.stepTitle}>{step.title}{step.skipped && <span className={styles.skippedTag}> (略過)</span>}</div>
																					{step.description && !step.skipped && (
																						<div className={styles.stepDesc}>{step.description}</div>
																					)}
																				</div>
																			</div>
																		))}
																	</div>
																</div>
															)}
														</div>
													)}
												</div>
											);
										})}
									</div>
								))}
						</div>
					))}
				</div>
			)}
		</div>
	);
};

export default TrainingRecords;