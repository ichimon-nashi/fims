// src/components/mdafaat/ScenarioManager.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Search, Eye, Edit2, Trash2, Plus, X, ArrowLeft, ChevronDown } from "lucide-react";
import LoadingScreen from "@/components/common/LoadingScreen";
import { createServiceClient } from "@/utils/supabase/service-client";
import styles from "./ScenarioEditor.module.css";

interface Scenario {
	id: number;
	scenario_code: string;
	core_scenario: string;
	title: string;
	category: string;
	flight_no: string;
	route: string;
	background: string;
	trigger: string;
	complication: string | null;
	outcome: string;
}

const CORE_SCENARIOS = [
	{ value: "bomb_threat", label: "爆裂物威脅" },
	{ value: "lithium_fire", label: "鋰電池火災" },
	{ value: "decompression", label: "失壓" },
	{ value: "incapacitation", label: "失能" },
	{ value: "unplanned_evacuation", label: "無預警緊急撤離" },
	{ value: "planned_evacuation", label: "客艙準備程序" },
];

const CODE_PREFIX: Record<string, string> = {
	bomb_threat: "bomb",
	lithium_fire: "lithiumfire",
	decompression: "decompression",
	incapacitation: "incapacitation",
	unplanned_evacuation: "evac",
	planned_evacuation: "cpp",
};

interface Props {
	onClose?: () => void;
}

export default function ScenarioManager({ onClose }: Props) {
	const [scenarios, setScenarios] = useState<Scenario[]>([]);
	const [filteredScenarios, setFilteredScenarios] = useState<Scenario[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
		null,
	);
	const [isEditing, setIsEditing] = useState(false);
	const [isViewing, setIsViewing] = useState(false);
	const [isCreating, setIsCreating] = useState(false);
	const [loading, setLoading] = useState(true);
	const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
	const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(CORE_SCENARIOS.map(c => c.value)));

	const BLANK_SCENARIO: Omit<Scenario, 'id'> = {
		scenario_code: '',
		core_scenario: 'bomb_threat',
		title: '標準複訓情境',
		category: '爆裂物威脅',
		flight_no: '',
		route: '',
		background: '',
		trigger: '',
		complication: null,
		outcome: '',
	};

	// Returns next available code for a given core_scenario, e.g. "bomb-11"
	const getNextCode = (coreScenario: string): string => {
		const prefix = CODE_PREFIX[coreScenario] || coreScenario;
		const existing = scenarios
			.filter(s => s.core_scenario === coreScenario)
			.map(s => {
				const parts = s.scenario_code.split('-');
				return parseInt(parts[parts.length - 1], 10);
			})
			.filter(n => !isNaN(n));
		const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
		return `${prefix}-${String(next).padStart(2, '0')}`;
	};

	// Helper: when core_scenario changes, sync category and auto-increment code in create mode
	// Only overwrites scenario_code if the user hasn't manually edited it
	const handleCoreScenarioChange = (value: string) => {
		const label = CORE_SCENARIOS.find(c => c.value === value)?.label || value;
		setSelectedScenario(prev => {
			if (!prev) return prev;
			const updates: Partial<Scenario> = { core_scenario: value, category: label };
			if (isCreating && !codeManuallyEdited) updates.scenario_code = getNextCode(value);
			return { ...prev, ...updates };
		});
	};

	useEffect(() => {
		loadScenarios();
	}, []);

	useEffect(() => {
		filterScenarios();
	}, [searchQuery, scenarios]);

	const loadScenarios = async () => {
		setLoading(true);
		try {
			const supabase = createServiceClient();
			const { data, error } = await supabase
				.from("mdafaat_cards")
				.select("*")
				.order("scenario_code");

			if (error) throw error;
			setScenarios(data || []);
		} catch (error) {
			console.error("Error loading scenarios:", error);
			alert("載入情境失敗");
		} finally {
			setLoading(false);
		}
	};

	const filterScenarios = () => {
		if (!searchQuery.trim()) {
			setFilteredScenarios(scenarios);
			return;
		}

		const query = searchQuery.toLowerCase();
		const filtered = scenarios.filter(
			(s) =>
				s.scenario_code.toLowerCase().includes(query) ||
				s.category.toLowerCase().includes(query) ||
				s.core_scenario.toLowerCase().includes(query),
		);
		setFilteredScenarios(filtered);
	};

	const handleCreate = () => {
		const defaultCore = 'bomb_threat';
		setSelectedScenario({ id: -1, ...BLANK_SCENARIO, scenario_code: getNextCode(defaultCore) });
		setCodeManuallyEdited(false);
		setIsCreating(true);
		setIsEditing(false);
		setIsViewing(false);
	};

	const handleSaveNew = async () => {
		if (!selectedScenario) return;
		if (!selectedScenario.scenario_code.trim()) {
			alert('請輸入情境代碼');
			return;
		}
		try {
			const supabase = createServiceClient();
			const { error } = await supabase
				.from('mdafaat_cards')
				.insert({
					scenario_code: selectedScenario.scenario_code,
					core_scenario: selectedScenario.core_scenario,
					title: selectedScenario.title,
					category: selectedScenario.category,
					flight_no: selectedScenario.flight_no,
					route: selectedScenario.route,
					background: selectedScenario.background,
					trigger: selectedScenario.trigger,
					complication: selectedScenario.complication,
					outcome: selectedScenario.outcome,
				});
			if (error) throw error;
			alert('✅ 新增成功');
			setIsCreating(false);
			setSelectedScenario(null);
			loadScenarios();
		} catch (error) {
			console.error('Error creating scenario:', error);
			alert('❌ 新增失敗');
		}
	};

	const handleView = (scenario: Scenario) => {
		setSelectedScenario(scenario);
		setIsViewing(true);
		setIsEditing(false);
	};

	const handleEdit = (scenario: Scenario) => {
		setSelectedScenario(scenario);
		setIsEditing(true);
		setIsViewing(false);
	};

	const handleDelete = async (scenario: Scenario) => {
		if (!confirm(`確定要刪除 ${scenario.scenario_code}？`)) return;

		try {
			const supabase = createServiceClient();
			const { error } = await supabase
				.from("mdafaat_cards")
				.delete()
				.eq("id", scenario.id);

			if (error) throw error;
			alert("✅ 刪除成功");
			loadScenarios();
		} catch (error) {
			console.error("Error deleting scenario:", error);
			alert("❌ 刪除失敗");
		}
	};

	const handleSave = async () => {
		if (!selectedScenario) return;

		try {
			const supabase = createServiceClient();
			const { error } = await supabase
				.from("mdafaat_cards")
				.update({
					category: selectedScenario.category,
					core_scenario: selectedScenario.core_scenario,
					background: selectedScenario.background,
					trigger: selectedScenario.trigger,
					complication: selectedScenario.complication,
					outcome: selectedScenario.outcome,
					updated_at: new Date().toISOString(),
				})
				.eq("id", selectedScenario.id);

			if (error) throw error;
			alert("✅ 儲存成功");
			setIsEditing(false);
			setIsViewing(false);
			setSelectedScenario(null);
			loadScenarios();
		} catch (error) {
			console.error("Error saving scenario:", error);
			alert("❌ 儲存失敗");
		}
	};

	const closeModal = () => {
		setIsViewing(false);
		setIsEditing(false);
		setIsCreating(false);
		setSelectedScenario(null);
	};

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				{onClose && (
					<button onClick={onClose} className={styles.closeButton} title="返回">
						<ArrowLeft size={20} />
					</button>
				)}
				<h2 className={styles.title}>情境編輯 Scenario Editor</h2>
				<button onClick={handleCreate} className={styles.addButton}>
					<Plus size={16} /> 新增情境
				</button>
			</div>

			{/* Search Bar */}
			<div className={styles.searchSection}>
				<div className={styles.searchBar}>
					<Search className={styles.searchIcon} />
					<input
						type="text"
						placeholder="搜尋情境代碼或分類... (Search by code or category)"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className={styles.searchInput}
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery("")}
							className={styles.clearButton}
						>
							<X size={18} />
						</button>
					)}
				</div>
			</div>

			{/* Scenarios — grouped by core scenario type */}
			{loading ? (
				<LoadingScreen message="載入情境中..." />
			) : filteredScenarios.length === 0 ? (
				<div className={styles.noResults}>無符合條件的情境</div>
			) : (
				<div className={styles.groupList}>
					{CORE_SCENARIOS.map(({ value, label }) => {
						const rows = filteredScenarios.filter(s => s.core_scenario === value);
						if (rows.length === 0) return null;
						const isOpen = openGroups.has(value);
						const toggleGroup = () => setOpenGroups(prev => {
							const next = new Set(prev);
							isOpen ? next.delete(value) : next.add(value);
							return next;
						});
						return (
							<div key={value} className={styles.group}>
								{/* Group header */}
								<div className={styles.groupHeader} onClick={toggleGroup}>
									<div className={styles.groupHeaderLeft}>
										<span className={styles.groupTitle}>{label}</span>
										<span className={styles.groupCount}>{rows.length}</span>
									</div>
									<ChevronDown size={16} className={`${styles.groupChevron} ${isOpen ? styles.open : ''}`} />
								</div>

								{isOpen && (
									<>
										{/* Column headers */}
										<div className={styles.colHeader}>
											<span className={styles.colHeaderCell}>代碼</span>
											<span className={styles.colHeaderCell}>背景 A</span>
											<span className={styles.colHeaderCell}>觸發 B</span>
											<span className={styles.colHeaderCell}>併發 C</span>
											<span className={styles.colHeaderCell}>結果 D</span>
											<span className={styles.colHeaderCell} style={{ textAlign: 'right' }}>操作</span>
										</div>
										{/* Rows */}
										{rows.map(scenario => (
											<div key={scenario.id} className={styles.scenarioRow}>
												<span className={styles.codeCell}>{scenario.scenario_code}</span>
												<span className={styles.previewCell}>{scenario.background}</span>
												<span className={styles.previewCell}>{scenario.trigger}</span>
												<span className={scenario.complication ? styles.previewCellComplication : styles.previewEmpty}>
													{scenario.complication || '—'}
												</span>
												<span className={styles.previewCell}>{scenario.outcome}</span>
												<div className={styles.actionsCell}>
													<button onClick={() => handleView(scenario)} className={styles.actionButton} title="檢視"><Eye size={14} /></button>
													<button onClick={() => handleEdit(scenario)} className={styles.actionButton} title="編輯"><Edit2 size={14} /></button>
													<button onClick={() => handleDelete(scenario)} className={styles.actionButtonDanger} title="刪除"><Trash2 size={14} /></button>
												</div>
											</div>
										))}
									</>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* View/Edit Modal */}
			{(isViewing || isEditing) && selectedScenario && (
				<div className={styles.modal}>
					<div className={styles.modalContent} style={{ maxWidth: '960px' }}>
						<div className={styles.modalHeader}>
							<h3>
								{isEditing ? "編輯情境" : "檢視情境"}: {selectedScenario.scenario_code}
							</h3>
							<button onClick={closeModal} className={styles.closeButton}>
								<X size={24} />
							</button>
						</div>

						<div className={styles.modalBody}>
							{/* Section: 基本資訊 */}
							<div className={styles.section}>
								<div className={styles.sectionHeader}>
									<span className={styles.sectionTitle}>基本資訊 Basic Info</span>
								</div>
								<div className={`${styles.sectionBody} ${styles.oneCol}`}>
									<div className={styles.field}>
										<label>情境分類</label>
										{isEditing ? (
											<select value={selectedScenario.core_scenario} onChange={(e) => handleCoreScenarioChange(e.target.value)} className={styles.select}>
												{CORE_SCENARIOS.map((c) => (
													<option key={c.value} value={c.value}>{c.label}</option>
												))}
											</select>
										) : (
											<div className={styles.readOnly}>{CORE_SCENARIOS.find(c => c.value === selectedScenario.core_scenario)?.label || selectedScenario.core_scenario}</div>
										)}
									</div>
								</div>
							</div>
							{/* Section: 情境內容 */}
							<div className={styles.section}>
								<div className={styles.sectionHeader}>
									<span className={styles.sectionTitle}>情境內容 Scenario Content</span>
								</div>
								<div className={`${styles.sectionBody} ${styles.twoCol}`}>
									<div className={styles.field}>
										<label>A. 背景 Background</label>
										{isEditing ? (
											<textarea value={selectedScenario.background} onChange={(e) => setSelectedScenario({ ...selectedScenario, background: e.target.value })} className={styles.textarea} rows={5} />
										) : (
											<div className={styles.readOnly}>{selectedScenario.background}</div>
										)}
									</div>
									<div className={styles.field}>
										<label>B. 觸發事件 Trigger</label>
										{isEditing ? (
											<textarea value={selectedScenario.trigger} onChange={(e) => setSelectedScenario({ ...selectedScenario, trigger: e.target.value })} className={styles.textarea} rows={5} />
										) : (
											<div className={styles.readOnly}>{selectedScenario.trigger}</div>
										)}
									</div>
									<div className={styles.field}>
										<label>C. 併發 Complication <span className={styles.optionalBadge}>OPTIONAL</span></label>
										{isEditing ? (
											<textarea value={selectedScenario.complication || ""} onChange={(e) => setSelectedScenario({ ...selectedScenario, complication: e.target.value || null })} className={styles.textarea} rows={4} />
										) : (
											<div className={styles.readOnly}>{selectedScenario.complication || "(無)"}</div>
										)}
									</div>
									<div className={styles.field}>
										<label>D. Outcome</label>
										{isEditing ? (
											<textarea value={selectedScenario.outcome} onChange={(e) => setSelectedScenario({ ...selectedScenario, outcome: e.target.value })} className={styles.textarea} rows={4} />
										) : (
											<div className={styles.readOnly}>{selectedScenario.outcome}</div>
										)}
									</div>
								</div>
							</div>
						</div>

						<div className={styles.modalFooter}>
							{isEditing ? (
								<>
									<button onClick={handleSave} className={styles.saveButton}>儲存 Save</button>
									<button onClick={closeModal} className={styles.cancelButton}>取消 Cancel</button>
								</>
							) : (
								<button onClick={closeModal} className={styles.cancelButton}>關閉 Close</button>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Create New Modal */}
			{isCreating && selectedScenario && (
				<div className={styles.modal}>
					<div className={styles.modalContent} style={{ maxWidth: '960px' }}>
						<div className={styles.modalHeader}>
							<h3>新增情境 New Scenario</h3>
							<button onClick={closeModal} className={styles.closeButton}>
								<X size={24} />
							</button>
						</div>

						<div className={styles.modalBody}>
							{/* Section: 基本資訊 */}
							<div className={styles.section}>
								<div className={styles.sectionHeader}>
									<span className={styles.sectionTitle}>基本資訊 Basic Info</span>
								</div>
								<div className={`${styles.sectionBody} ${styles.twoCol}`}>
									<div className={styles.field}>
										<label>情境代碼 Code <span style={{ color: '#ef4444' }}>*</span></label>
										<input
											type="text"
											value={selectedScenario.scenario_code}
											onChange={(e) => {
												setCodeManuallyEdited(true);
												setSelectedScenario({ ...selectedScenario, scenario_code: e.target.value });
											}}
											className={styles.select}
											placeholder="e.g. bomb-03"
										/>
										<div className={styles.hint}>自動產生，可手動覆蓋</div>
									</div>
									<div className={styles.field}>
										<label>情境分類</label>
										<select value={selectedScenario.core_scenario} onChange={(e) => handleCoreScenarioChange(e.target.value)} className={styles.select}>
											{CORE_SCENARIOS.map((c) => (
												<option key={c.value} value={c.value}>{c.label}</option>
											))}
										</select>
									</div>
								</div>
							</div>
							{/* Section: 情境內容 */}
							<div className={styles.section}>
								<div className={styles.sectionHeader}>
									<span className={styles.sectionTitle}>情境內容 Scenario Content</span>
								</div>
								<div className={`${styles.sectionBody} ${styles.twoCol}`}>
									<div className={styles.field}>
										<label>A. 背景 Background</label>
										<textarea value={selectedScenario.background} onChange={(e) => setSelectedScenario({ ...selectedScenario, background: e.target.value })} className={styles.textarea} rows={5} />
									</div>
									<div className={styles.field}>
										<label>B. 觸發事件 Trigger</label>
										<textarea value={selectedScenario.trigger} onChange={(e) => setSelectedScenario({ ...selectedScenario, trigger: e.target.value })} className={styles.textarea} rows={5} />
									</div>
									<div className={styles.field}>
										<label>C. 併發 Complication <span className={styles.optionalBadge}>OPTIONAL</span></label>
										<textarea value={selectedScenario.complication || ""} onChange={(e) => setSelectedScenario({ ...selectedScenario, complication: e.target.value || null })} className={styles.textarea} rows={4} />
									</div>
									<div className={styles.field}>
										<label>D. Outcome</label>
										<textarea value={selectedScenario.outcome} onChange={(e) => setSelectedScenario({ ...selectedScenario, outcome: e.target.value })} className={styles.textarea} rows={4} />
									</div>
								</div>
							</div>
						</div>

						<div className={styles.modalFooter}>
							<button onClick={handleSaveNew} className={styles.saveButton}>新增 Create</button>
							<button onClick={closeModal} className={styles.cancelButton}>取消 Cancel</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}