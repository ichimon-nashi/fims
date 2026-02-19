// src/components/mdafaat/ScenarioEditorEnhanced.tsx
// Full editor with outcomes, probabilities, synergies, escalations
"use client";

import React, { useState } from "react";
import { X, Save, Download, Upload, Plus, Trash2, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { PiSirenFill } from "react-icons/pi";
import { FaPersonWalkingLuggage, FaLocationDot } from "react-icons/fa6";
import { FaTools, FaDoorClosed } from "react-icons/fa";
import styles from "./ScenarioEditor.module.css";

// Full card interface with all enhancement fields
interface Card {
	id: number;
	title: string;
	description: string;
	code: string;
	is_shiny?: boolean;
	can_be_initial?: boolean;
	category?: string | null;
	conflicts?: number[];
	outcomes?: Outcome[];
	synergies?: number[];
	escalates_to?: number[];
	escalation_chance?: number;
	crew_impact?: Record<string, Outcome>;
	passenger_impact?: Record<string, Outcome>;
	severity_levels?: Record<string, Outcome>;
	malfunction_outcomes?: Record<string, Outcome>;
}

interface Outcome {
	probability: number;
	description: string;
	action?: string;
	duration?: string;
	escalates?: boolean;
}

interface CardData {
	emergency: Card[];
	passenger: Card[];
	equipment: Card[];
	door: Card[];
	position: Card[];
}

interface ScenarioEditorProps {
	onClose: () => void;
	initialData: CardData;
}

type CardType = "emergency" | "passenger" | "equipment" | "door" | "position";
type OutcomeType = "crew_impact" | "passenger_impact" | "severity_levels" | "malfunction_outcomes";

const ScenarioEditor: React.FC<ScenarioEditorProps> = ({ onClose, initialData }) => {
	const [cards, setCards] = useState<CardData>(initialData);
	const [cardType, setCardType] = useState<CardType>("emergency");
	const [selectedCard, setSelectedCard] = useState<Card | null>(null);
	const [editMode, setEditMode] = useState<"view" | "edit" | "new">("view");
	const [formData, setFormData] = useState<Card>({
		id: 0,
		title: "",
		description: "",
		code: "",
		is_shiny: false,
		can_be_initial: false,
		category: null,
		conflicts: [],
		outcomes: [],
		synergies: [],
		escalates_to: [],
		escalation_chance: 30, // 30%
		crew_impact: {},
		passenger_impact: {},
		severity_levels: {},
		malfunction_outcomes: {}
	});

	// Ensure door and position arrays exist
	React.useEffect(() => {
		if (!cards.door || !cards.position) {
			setCards(prev => ({
				...prev,
				door: prev.door || [],
				position: prev.position || []
			}));
		}
	}, [cards]);

	// Expandable sections state
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
		basic: true,
		relationships: false,
		crew_impact: false,
		passenger_impact: false,
		severity_levels: false,
		malfunction_outcomes: false
	});

	const currentCards = cards[cardType] || [];

	const toggleSection = (section: string) => {
		// Close all sections, then open the clicked one
		if (expandedSections[section]) {
			// If clicking an open section, close it
			setExpandedSections(prev => ({ ...prev, [section]: false }));
		} else {
			// Close all others, open this one
			const allClosed = Object.keys(expandedSections).reduce((acc, key) => {
				acc[key] = false;
				return acc;
			}, {} as Record<string, boolean>);
			setExpandedSections({ ...allClosed, [section]: true });
		}
	};

	const handleSelectCard = (card: Card) => {
		setSelectedCard(card);
		setFormData(card);
		setEditMode("view");
	};

	const handleEdit = () => {
		setEditMode("edit");
	};

	const handleNewCard = () => {
		// Use offset per card type to avoid ID conflicts across types
		// Emergency: 1-99, Passenger: 101-199, Equipment: 201-299, Door: 301-399, Position: 401-499
		const getIdOffset = () => {
			switch (cardType) {
				case "emergency": return 0;
				case "passenger": return 100;
				case "equipment": return 200;
				case "door": return 300;
				case "position": return 400;
				default: return 0;
			}
		};

		const offset = getIdOffset();
		const existingIds = currentCards.map(c => c.id);
		
		// Find next available ID in this range
		let newId = offset + 1;
		while (existingIds.includes(newId)) {
			newId++;
		}

		// Generate code prefix
		const getCodePrefix = () => {
			switch (cardType) {
				case "emergency": return "E";
				case "passenger": return "P";
				case "equipment": return "Q";
				case "door": return "D";
				case "position": return "POS";
				default: return "X";
			}
		};

		const newCode = `${getCodePrefix()}-${String(newId - offset).padStart(2, "0")}`;
		
		setFormData({
			id: newId,
			title: "",
			description: "",
			code: newCode,
			is_shiny: false,
			can_be_initial: false,
			category: null,
			conflicts: [],
			outcomes: [],
			synergies: [],
			escalates_to: [],
			escalation_chance: 30, // 30%
			crew_impact: {},
			passenger_impact: {},
			severity_levels: {},
			malfunction_outcomes: {}
		});
		setEditMode("new");
		setSelectedCard(null);
		// Expand basic info section
		setExpandedSections({ 
			basic: true,
			relationships: false,
			crew_impact: false,
			passenger_impact: false,
			severity_levels: false,
			malfunction_outcomes: false
		});
	};

	const handleSave = async () => {
		if (!formData.title || !formData.description) {
			alert("請填寫標題和描述");
			return;
		}

		// Validate probabilities for each outcome type (convert from percentage to decimal for validation)
		const outcomeTypes: OutcomeType[] = ["crew_impact", "passenger_impact", "severity_levels", "malfunction_outcomes"];
		for (const type of outcomeTypes) {
			const outcomes = formData[type];
			if (outcomes && Object.keys(outcomes).length > 0) {
				const total = Object.values(outcomes).reduce((sum, o) => sum + o.probability, 0);
				if (Math.abs(total - 100) > 1) {
					alert(`${type} 的機率總和必須等於 100% (目前: ${total.toFixed(0)}%)`);
					return;
				}
			}
		}

		try {
			const token = localStorage.getItem("token");
			
			if (!token) {
				alert("請先登入");
				return;
			}

			// Convert percentages to decimals for API
			const convertToDecimal = (outcomes: Record<string, Outcome>) => {
				const converted: Record<string, Outcome> = {};
				for (const [key, outcome] of Object.entries(outcomes)) {
					converted[key] = {
						...outcome,
						probability: outcome.probability / 100
					};
				}
				return converted;
			};

			if (editMode === "new") {
				const response = await fetch("/api/mdafaat/cards", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${token}`
					},
					body: JSON.stringify({
						id: formData.id,
						card_type: cardType,
						code: formData.code,
						title: formData.title,
						description: formData.description,
						is_shiny: formData.is_shiny || false,
						can_be_initial: formData.can_be_initial || false,
						category: formData.category || null,
						conflicts: formData.conflicts || [],
						outcomes: formData.outcomes || []
					})
				});

				if (!response.ok) {
					const error = await response.json();
					if (response.status === 409) {
						// ID conflict - suggest next available ID
						const getIdOffset = () => {
							switch (cardType) {
								case "emergency": return 0;
								case "passenger": return 100;
								case "equipment": return 200;
								case "door": return 300;
								case "position": return 400;
								default: return 0;
							}
						};
						const offset = getIdOffset();
						const existingIds = currentCards.map(c => c.id);
						let nextId = offset + 1;
						while (existingIds.includes(nextId)) {
							nextId++;
						}
						alert(`ID ${formData.id} 已存在！\n\n建議使用 ID: ${nextId}\n(${cardType === "emergency" ? "緊急" : cardType === "passenger" ? "旅客" : "設備"}卡片 ID 範圍: ${offset + 1}-${offset + 99})`);
						return;
					}
					throw new Error(error.error || "Failed to create card");
				}

				alert("新增成功！");

			} else if (editMode === "edit" && selectedCard) {
				const response = await fetch(`/api/mdafaat/cards/${selectedCard.id}`, {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${token}`
					},
					body: JSON.stringify({
						title: formData.title,
						description: formData.description,
						code: formData.code,
						is_shiny: formData.is_shiny || false,
						can_be_initial: formData.can_be_initial || false,
						category: formData.category || null,
						conflicts: formData.conflicts || [],
						outcomes: formData.outcomes || []
					})
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to update card");
				}

				alert("更新成功！");
			}

			// Refresh cards from API and convert decimals to percentages
			const refreshResponse = await fetch("/api/mdafaat/cards", {
				headers: {
					"Authorization": `Bearer ${token}`
				}
			});

			if (refreshResponse.ok) {
				const updatedCards = await refreshResponse.json();
				
				// Convert all probabilities from decimal to percentage for display
				const convertToPercentage = (cards: CardData): CardData => {
					const convert = (outcomes: Record<string, Outcome>) => {
						const converted: Record<string, Outcome> = {};
						for (const [key, outcome] of Object.entries(outcomes)) {
							converted[key] = {
								...outcome,
								probability: outcome.probability * 100
							};
						}
						return converted;
					};

					return {
						emergency: cards.emergency.map(c => ({
							...c,
							escalation_chance: c.escalation_chance ? c.escalation_chance * 100 : 30,
							crew_impact: c.crew_impact ? convert(c.crew_impact) : {},
							passenger_impact: c.passenger_impact ? convert(c.passenger_impact) : {},
							severity_levels: c.severity_levels ? convert(c.severity_levels) : {},
							malfunction_outcomes: c.malfunction_outcomes ? convert(c.malfunction_outcomes) : {}
						})),
						passenger: cards.passenger.map(c => ({
							...c,
							escalation_chance: c.escalation_chance ? c.escalation_chance * 100 : 30,
							crew_impact: c.crew_impact ? convert(c.crew_impact) : {},
							passenger_impact: c.passenger_impact ? convert(c.passenger_impact) : {},
							severity_levels: c.severity_levels ? convert(c.severity_levels) : {},
							malfunction_outcomes: c.malfunction_outcomes ? convert(c.malfunction_outcomes) : {}
						})),
						equipment: cards.equipment.map(c => ({
							...c,
							escalation_chance: c.escalation_chance ? c.escalation_chance * 100 : 30,
							crew_impact: c.crew_impact ? convert(c.crew_impact) : {},
							passenger_impact: c.passenger_impact ? convert(c.passenger_impact) : {},
							severity_levels: c.severity_levels ? convert(c.severity_levels) : {},
							malfunction_outcomes: c.malfunction_outcomes ? convert(c.malfunction_outcomes) : {}
						})),
						door: cards.door || [],
						position: cards.position || []
					};
				};

				setCards(convertToPercentage(updatedCards));
				setSelectedCard(formData);
			}

			setEditMode("view");

		} catch (error) {
			console.error("Save failed:", error);
			alert(`儲存失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
		}
	};

	const handleDelete = async () => {
		if (!selectedCard) return;
		
		if (confirm(`確定要刪除「${selectedCard.title}」嗎？`)) {
			try {
				const token = localStorage.getItem("token");
				
				if (!token) {
					alert("請先登入");
					return;
				}

				const response = await fetch(`/api/mdafaat/cards/${selectedCard.id}`, {
					method: "DELETE",
					headers: {
						"Authorization": `Bearer ${token}`
					}
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Failed to delete card");
				}

				const refreshResponse = await fetch("/api/mdafaat/cards", {
					headers: {
						"Authorization": `Bearer ${token}`
					}
				});

				if (refreshResponse.ok) {
					const updatedCards = await refreshResponse.json();
					setCards(updatedCards);
				}

				setSelectedCard(null);
				setEditMode("view");
				alert("刪除成功！");

			} catch (error) {
				console.error("Delete failed:", error);
				alert(`刪除失敗: ${error instanceof Error ? error.message : "未知錯誤"}`);
			}
		}
	};

	// Add/Edit/Remove outcome
	const addOutcome = (type: OutcomeType) => {
		const outcomes = formData[type] || {};
		const newKey = `outcome_${Object.keys(outcomes).length + 1}`;
		setFormData({
			...formData,
			[type]: {
				...outcomes,
				[newKey]: {
					probability: 0,
					description: ""
				}
			}
		});
	};

	const updateOutcome = (type: OutcomeType, key: string, field: keyof Outcome, value: any) => {
		const outcomes = formData[type] || {};
		setFormData({
			...formData,
			[type]: {
				...outcomes,
				[key]: {
					...outcomes[key],
					[field]: value
				}
			}
		});
	};

	const removeOutcome = (type: OutcomeType, key: string) => {
		const outcomes = { ...formData[type] };
		delete outcomes[key];
		setFormData({
			...formData,
			[type]: outcomes
		});
	};

	const getCardIcon = (type: CardType) => {
		switch (type) {
			case "emergency": return <PiSirenFill size={20} />;
			case "passenger": return <FaPersonWalkingLuggage size={18} />;
			case "equipment": return <FaTools size={18} />;
		}
	};

	const getOutcomeTypeLabel = (type: OutcomeType) => {
		switch (type) {
			case "crew_impact": return "組員影響";
			case "passenger_impact": return "旅客影響";
			case "severity_levels": return "嚴重程度";
			case "malfunction_outcomes": return "故障結果";
		}
	};

	const getOutcomeTypeHelp = (type: OutcomeType) => {
		switch (type) {
			case "crew_impact": return "定義此情境對組員的影響程度 (例: 無影響、輕傷、中度傷害、嚴重)";
			case "passenger_impact": return "定義此情境對旅客的反應 (例: 冷靜、焦慮、恐慌)";
			case "severity_levels": return "適用於醫療/緊急事件的嚴重程度分級";
			case "malfunction_outcomes": return "適用於設備故障的可能結果";
		}
	};

	return (
		<div className={styles.modal}>
			<div className={styles.modalOverlay} onClick={onClose} />
			<div className={styles.modalContent}>
				{/* Header */}
				<div className={styles.header}>
					<h2 className={styles.title}>情境編輯器 (完整版)</h2>
					<button onClick={onClose} className={styles.closeButton}>
						<X size={24} />
					</button>
				</div>

				{/* Main Content */}
				<div className={styles.editorLayout}>
					{/* Left Sidebar */}
					<div className={styles.sidebar}>
						<div className={styles.typeSelector}>
							<button
								className={cardType === "emergency" ? styles.typeBtnActive : styles.typeBtn}
								onClick={() => setCardType("emergency")}
							>
								<PiSirenFill size={18} />
								緊急 ({cards.emergency.length})
							</button>
							<button
								className={cardType === "passenger" ? styles.typeBtnActive : styles.typeBtn}
								onClick={() => setCardType("passenger")}
							>
								<FaPersonWalkingLuggage size={18} />
								旅客 ({cards.passenger.length})
							</button>
							<button
								className={cardType === "equipment" ? styles.typeBtnActive : styles.typeBtn}
								onClick={() => setCardType("equipment")}
							>
								<FaTools size={18} />
								設備 ({cards.equipment.length})
							</button>
							<button
								className={cardType === "door" ? styles.typeBtnActive : styles.typeBtn}
								onClick={() => setCardType("door")}
							>
								<FaDoorClosed size={18} />
								Door ({cards.door?.length || 0})
							</button>
							<button
								className={cardType === "position" ? styles.typeBtnActive : styles.typeBtn}
								onClick={() => setCardType("position")}
							>
								<FaLocationDot size={18} />
								Position ({cards.position?.length || 0})
							</button>
						</div>

						<button onClick={handleNewCard} className={styles.newCardButton}>
							<Plus size={18} />
							新增情境
						</button>

						<div className={styles.cardList}>
							{currentCards.map(card => (
								<div
									key={card.id}
									className={selectedCard?.id === card.id ? styles.cardItemActive : styles.cardItem}
									onClick={() => handleSelectCard(card)}
								>
									<div className={styles.cardItemHeader}>
										<span className={styles.cardCode}>{card.code}</span>
										{getCardIcon(cardType)}
									</div>
									<div className={styles.cardItemTitle}>{card.title}</div>
								</div>
							))}
						</div>
					</div>

					{/* Right Panel - Card Editor */}
					<div className={styles.editorPanel}>
						{selectedCard || editMode === "new" ? (
							<>
								<div className={styles.editorHeader}>
									<h3>{editMode === "new" ? "新增情境" : formData.title || "選擇情境"}</h3>
									<div className={styles.editorActions}>
										{editMode === "view" && (
											<>
												<button onClick={handleEdit} className={styles.iconButton} title="編輯">
													編輯
												</button>
												<button onClick={handleDelete} className={styles.iconButtonDanger} title="刪除">
													<Trash2 size={18} />
												</button>
											</>
										)}
										{(editMode === "edit" || editMode === "new") && (
											<>
												<button onClick={() => setEditMode("view")} className={styles.iconButton}>
													取消
												</button>
												<button onClick={handleSave} className={styles.saveButton}>
													<Save size={18} />
													儲存
												</button>
											</>
										)}
									</div>
								</div>

								<div className={styles.editorForm}>
									{editMode === "view" ? (
										// VIEW MODE - Show all data
										<div className={styles.viewMode}>
											<div className={styles.viewField}>
												<label>代碼</label>
												<div className={styles.codeDisplay}>{formData.code}</div>
											</div>
											<div className={styles.viewField}>
												<label>標題</label>
												<div>{formData.title}</div>
											</div>
											<div className={styles.viewField}>
												<label>描述</label>
												<div className={styles.description}>{formData.description}</div>
											</div>
											{formData.conflicts && formData.conflicts.length > 0 && (
												<div className={styles.viewField}>
													<label>衝突情境</label>
													<div className={styles.conflicts}>
														{formData.conflicts.map(id => {
															const conflictCard = currentCards.find(c => c.id === id);
															return conflictCard ? (
																<span key={id} className={styles.conflictTag}>
																	{conflictCard.code}: {conflictCard.title}
																</span>
															) : null;
														})}
													</div>
												</div>
											)}
											{formData.synergies && formData.synergies.length > 0 && (
												<div className={styles.viewField}>
													<label>協同效應</label>
													<div className={styles.conflicts}>
														{formData.synergies.map(id => {
															const synergyCard = currentCards.find(c => c.id === id);
															return synergyCard ? (
																<span key={id} className={styles.conflictTag}>
																	{synergyCard.code}: {synergyCard.title}
																</span>
															) : null;
														})}
													</div>
												</div>
											)}
											{formData.escalates_to && formData.escalates_to.length > 0 && (
												<div className={styles.viewField}>
													<label>可能升級為</label>
													<div className={styles.conflicts}>
														{formData.escalates_to.map(id => {
															const escalateCard = currentCards.find(c => c.id === id);
															return escalateCard ? (
																<span key={id} className={styles.conflictTag}>
																	{escalateCard.code}: {escalateCard.title}
																</span>
															) : null;
														})}
													</div>
												</div>
											)}
											<div className={styles.viewField}>
												<label>升級機率</label>
												<div>{(formData.escalation_chance || 0).toFixed(0)}%</div>
											</div>
										</div>
									) : (
										// EDIT MODE - Collapsible sections
										<div className={styles.editMode}>
											{/* Basic Info Section */}
											<div className={styles.section}>
												<div className={styles.sectionHeader} onClick={() => toggleSection('basic')}>
													<h4>基本資訊</h4>
													{expandedSections.basic ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
												</div>
												{expandedSections.basic && (
													<div className={styles.sectionContent}>
														<div className={styles.formField}>
															<label>代碼</label>
															<input
																type="text"
																value={formData.code}
																onChange={e => setFormData({ ...formData, code: e.target.value })}
																className={styles.input}
															/>
														</div>
														<div className={styles.formField}>
															<label>標題 *</label>
															<input
																type="text"
																value={formData.title}
																onChange={e => setFormData({ ...formData, title: e.target.value })}
																className={styles.input}
																placeholder="例：客艙火災"
															/>
														</div>
														<div className={styles.formField}>
															<label>描述 *</label>
															<textarea
																value={formData.description}
																onChange={e => setFormData({ ...formData, description: e.target.value })}
																className={styles.textarea}
																placeholder="例：置物櫃旅客行李起火！"
																rows={4}
															/>
														</div>
													</div>
												)}
											</div>

											{/* Relationships Section */}
											<div className={styles.section}>
												<div className={styles.sectionHeader} onClick={() => toggleSection('relationships')}>
													<h4>關聯設定</h4>
													{expandedSections.relationships ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
												</div>
												{expandedSections.relationships && (
													<div className={styles.sectionContent}>
														<div className={styles.formField}>
															<label>衝突情境 (不能同時出現)</label>
															<small style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem', display: 'block' }}>
																選擇不能與此情境同時發生的卡片
															</small>
															<div className={styles.checkboxGroup}>
																{currentCards
																	.filter(c => c.id !== formData.id)
																	.map(card => (
																		<label key={card.id} className={styles.checkbox}>
																			<input
																				type="checkbox"
																				checked={formData.conflicts?.includes(card.id) || false}
																				onChange={e => {
																					const conflicts = formData.conflicts || [];
																					if (e.target.checked) {
																						setFormData({ ...formData, conflicts: [...conflicts, card.id] });
																					} else {
																						setFormData({ ...formData, conflicts: conflicts.filter(id => id !== card.id) });
																					}
																				}}
																			/>
																			<span>{card.code}: {card.title}</span>
																		</label>
																	))}
															</div>
														</div>

														<div className={styles.formField}>
															<label>協同效應 (配合良好)</label>
															<small style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem', display: 'block' }}>
																選擇與此情境配合效果更好的卡片
															</small>
															<div className={styles.checkboxGroup}>
																{currentCards
																	.filter(c => c.id !== formData.id)
																	.map(card => (
																		<label key={card.id} className={styles.checkbox}>
																			<input
																				type="checkbox"
																				checked={formData.synergies?.includes(card.id) || false}
																				onChange={e => {
																					const synergies = formData.synergies || [];
																					if (e.target.checked) {
																						setFormData({ ...formData, synergies: [...synergies, card.id] });
																					} else {
																						setFormData({ ...formData, synergies: synergies.filter(id => id !== card.id) });
																					}
																				}}
																			/>
																			<span>{card.code}: {card.title}</span>
																		</label>
																	))}
															</div>
														</div>

														<div className={styles.formField}>
															<label>可能升級為</label>
															<small style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem', display: 'block' }}>
																此情境可能升級成哪些更嚴重的情境
															</small>
															<div className={styles.checkboxGroup}>
																{currentCards
																	.filter(c => c.id !== formData.id)
																	.map(card => (
																		<label key={card.id} className={styles.checkbox}>
																			<input
																				type="checkbox"
																				checked={formData.escalates_to?.includes(card.id) || false}
																				onChange={e => {
																					const escalates_to = formData.escalates_to || [];
																					if (e.target.checked) {
																						setFormData({ ...formData, escalates_to: [...escalates_to, card.id] });
																					} else {
																						setFormData({ ...formData, escalates_to: escalates_to.filter(id => id !== card.id) });
																					}
																				}}
																			/>
																			<span>{card.code}: {card.title}</span>
																		</label>
																	))}
															</div>
														</div>

														<div className={styles.formField}>
															<label>升級機率: {(formData.escalation_chance || 0).toFixed(0)}%</label>
															<small style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem', display: 'block' }}>
																此情境升級為更嚴重情境的機率
															</small>
															<input
																type="range"
																min="0"
																max="100"
																step="5"
																value={formData.escalation_chance || 30}
																onChange={e => setFormData({ ...formData, escalation_chance: parseFloat(e.target.value) })}
																className={styles.slider}
															/>
														</div>
													</div>
												)}
											</div>

											{/* Outcome Sections */}
											{(["crew_impact", "passenger_impact", "severity_levels", "malfunction_outcomes"] as OutcomeType[]).map(type => (
												<div key={type} className={styles.section}>
													<div className={styles.sectionHeader} onClick={() => toggleSection(type)}>
														<div>
															<h4>{getOutcomeTypeLabel(type)}</h4>
															<small style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
																{getOutcomeTypeHelp(type)}
															</small>
														</div>
														{expandedSections[type] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
													</div>
													{expandedSections[type] && (
														<div className={styles.sectionContent}>
															{Object.entries(formData[type] || {}).map(([key, outcome]) => (
																<div key={key} className={styles.outcomeItem}>
																	<div className={styles.outcomeHeader}>
																		<input
																			type="text"
																			value={key}
																			className={styles.outcomeKey}
																			disabled
																		/>
																		<button
																			onClick={() => removeOutcome(type, key)}
																			className={styles.removeOutcome}
																		>
																			<Trash2 size={16} />
																		</button>
																	</div>
																	<div className={styles.formField}>
																		<label>機率: {outcome.probability.toFixed(0)}%</label>
																		<input
																			type="range"
																			min="0"
																			max="100"
																			step="1"
																			value={outcome.probability}
																			onChange={e => updateOutcome(type, key, 'probability', parseFloat(e.target.value))}
																			className={styles.slider}
																		/>
																	</div>
																	<div className={styles.formField}>
																		<label>描述</label>
																		<textarea
																			value={outcome.description}
																			onChange={e => updateOutcome(type, key, 'description', e.target.value)}
																			className={styles.textarea}
																			rows={2}
																		/>
																	</div>
																	<div className={styles.formField}>
																		<label>行動 (選填)</label>
																		<input
																			type="text"
																			value={outcome.action || ''}
																			onChange={e => updateOutcome(type, key, 'action', e.target.value)}
																			className={styles.input}
																		/>
																	</div>
																	<div className={styles.formField}>
																		<label>持續時間 (選填)</label>
																		<input
																			type="text"
																			value={outcome.duration || ''}
																			onChange={e => updateOutcome(type, key, 'duration', e.target.value)}
																			className={styles.input}
																		/>
																	</div>
																</div>
															))}
															<button
																onClick={() => addOutcome(type)}
																className={styles.addOutcomeButton}
															>
																<Plus size={16} />
																新增結果
															</button>
															{Object.keys(formData[type] || {}).length > 0 && (
																<div className={styles.probabilitySum}>
																	機率總和: {Object.values(formData[type] || {}).reduce((sum, o) => sum + o.probability, 0).toFixed(0)}%
																	{Math.abs(Object.values(formData[type] || {}).reduce((sum, o) => sum + o.probability, 0) - 100) > 1 && (
																		<span className={styles.warning}> ⚠️ 必須等於 100%</span>
																	)}
																</div>
															)}
														</div>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							</>
						) : (
							<div className={styles.emptyState}>
								<p>請選擇或新增情境</p>
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className={styles.footer}>
					<div className={styles.stats}>
						緊急: {cards.emergency.length} | 旅客: {cards.passenger.length} | 設備: {cards.equipment.length} | Door: {cards.door?.length || 0} | Position: {cards.position?.length || 0}
					</div>
				</div>
			</div>
		</div>
	);
};

export default ScenarioEditor;