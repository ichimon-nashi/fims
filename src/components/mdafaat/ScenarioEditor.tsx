// ScenarioEditor.tsx - SIMPLE VERSION
// Only: Basic fields, outcomes with side effects (specific card or random category)

import React, { useState } from "react";
import styles from "./ScenarioEditor.module.css";
import { Plus, X, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { PiSirenFill } from "react-icons/pi";
import { FaPersonWalkingLuggage, FaLocationDot } from "react-icons/fa6";
import { FaTools, FaDoorClosed } from "react-icons/fa";

// Card interface - ONLY database fields
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
}

interface Outcome {
	id: string;
	probability: number;
	description: string;
	next_card_id: number;
	side_effects?: SideEffect[];
}

interface SideEffect {
	type: 'specific' | 'random_category';
	card_id?: number | null;
	category?: string | null;
	trigger_rate: number; // 0-100
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
		outcomes: []
	});

	

	// Expandable sections state
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
		basic: true,
		relationships: false
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

	const currentCards = cards[cardType] || [];

	const toggleSection = (section: string) => {
		if (expandedSections[section]) {
			setExpandedSections({ ...expandedSections, [section]: false });
		} else {
			setExpandedSections({ ...expandedSections, [section]: true });
		}
	};

	const handleNewCard = () => {
		// ID ranges: Emergency 1-99, Passenger 101-199, Equipment 201-299, Door 301-399, Position 401-499
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
		
		let newId = offset + 1;
		while (existingIds.includes(newId)) {
			newId++;
		}

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
			outcomes: []
		});
		setEditMode("new");
		setSelectedCard(null);
		setExpandedSections({ basic: true, relationships: false });
	};

	const handleSelectCard = (card: Card) => {
		setSelectedCard(card);
		setFormData({...card});
		setEditMode("view");
	};

	const handleEdit = () => {
		setEditMode("edit");
	};

	const handleSave = async () => {
		if (!formData.title || !formData.description) {
			alert("請填寫標題和描述");
			return;
		}

		// Validate outcomes probabilities sum to 100%
		if (formData.outcomes && formData.outcomes.length > 0) {
			const total = formData.outcomes.reduce((sum, o) => sum + o.probability, 0);
			if (Math.abs(total - 100) > 1) {
				alert(`結果機率總和必須等於 100% (目前: ${total.toFixed(0)}%)`);
				return;
			}
		}

		try {
			const token = localStorage.getItem("token");
			
			if (!token) {
				alert("請先登入");
				return;
			}

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

			// Refresh cards
			const refreshResponse = await fetch("/api/mdafaat/cards", {
				headers: {
					"Authorization": `Bearer ${token}`
				}
			});

			if (refreshResponse.ok) {
				const updatedCards = await refreshResponse.json();
				setCards({
					...updatedCards,
					door: updatedCards.door || [],
					position: updatedCards.position || []
				});
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
					setCards({
						...updatedCards,
						door: updatedCards.door || [],
						position: updatedCards.position || []
					});
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

	// Outcome management
	const addOutcome = () => {
		const newOutcome: Outcome = {
			id: `outcome-${Date.now()}`,
			probability: 0,
			description: "",
			next_card_id: 99,
			side_effects: []
		};
		setFormData({
			...formData,
			outcomes: [...(formData.outcomes || []), newOutcome]
		});
	};

	const updateOutcome = (index: number, field: keyof Outcome, value: any) => {
		const updated = [...(formData.outcomes || [])];
		updated[index] = { ...updated[index], [field]: value };
		setFormData({ ...formData, outcomes: updated });
	};

	const removeOutcome = (index: number) => {
		const updated = formData.outcomes?.filter((_, i) => i !== index) || [];
		setFormData({ ...formData, outcomes: updated });
	};

	// Side effect management
	const addSideEffect = (outcomeIndex: number) => {
		const updated = [...(formData.outcomes || [])];
		if (!updated[outcomeIndex].side_effects) {
			updated[outcomeIndex].side_effects = [];
		}
		updated[outcomeIndex].side_effects!.push({
			type: 'specific',
			card_id: null,
			category: null,
			trigger_rate: 100
		});
		setFormData({ ...formData, outcomes: updated });
	};

	const updateSideEffect = (outcomeIndex: number, sideIndex: number, field: keyof SideEffect, value: any) => {
		const updated = [...(formData.outcomes || [])];
		const sideEffects = [...(updated[outcomeIndex].side_effects || [])];
		sideEffects[sideIndex] = { ...sideEffects[sideIndex], [field]: value };
		updated[outcomeIndex].side_effects = sideEffects;
		setFormData({ ...formData, outcomes: updated });
	};

	const removeSideEffect = (outcomeIndex: number, sideIndex: number) => {
		const updated = [...(formData.outcomes || [])];
		updated[outcomeIndex].side_effects = updated[outcomeIndex].side_effects?.filter((_, i) => i !== sideIndex) || [];
		setFormData({ ...formData, outcomes: updated });
	};

	const categories = ["fire", "medical", "security", "equipment", "passenger", "turbulence", "decompression", "evacuation", "emergency", "OTHER"];

	return (
		<div className={styles.modal}>
			<div className={styles.modalOverlay} />
			<div className={styles.modalContent}>
				<div className={styles.header}>
					<h2 style={{ color: '#ffffff' }}>情境編輯器</h2>
					<button onClick={onClose} className={styles.closeButton}>
						<X size={24} />
					</button>
				</div>

				<div className={styles.editorLayout}>
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
									<div className={styles.cardCode}>{card.code}</div>
									<div className={styles.cardItemTitle}>{card.title}</div>
								</div>
							))}
						</div>
					</div>

					<div className={styles.editorPanel}>
						{editMode === "view" && selectedCard ? (
							<div className={styles.viewMode}>
								<div className={styles.cardDetail}>
									<h3>{selectedCard.code}: {selectedCard.title}</h3>
									<p>{selectedCard.description}</p>
									<div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
										{selectedCard.is_shiny && <span className={styles.badge}>✨ Shiny</span>}
										{selectedCard.can_be_initial && <span className={styles.badge}>🎲 Initial</span>}
										{selectedCard.category && <span className={styles.badge}>📂 {selectedCard.category}</span>}
									</div>

									{selectedCard.outcomes && selectedCard.outcomes.length > 0 && (
										<div style={{ marginTop: '1.5rem' }}>
											<strong style={{ color: '#ffffff' }}>Outcomes:</strong>
											{selectedCard.outcomes.map((outcome, idx) => (
												<div key={outcome.id} style={{ marginLeft: '1rem', marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem' }}>
													<div style={{ color: '#e2e8f0' }}>{idx + 1}. {outcome.description} ({outcome.probability}%)</div>
													<div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>→ Next: {outcome.next_card_id}</div>
													{outcome.side_effects && outcome.side_effects.length > 0 && (
														<div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#a78bfa' }}>
															Side Effects:
															{outcome.side_effects.map((se, seIdx) => (
																<div key={seIdx} style={{ marginLeft: '1rem' }}>
																	• {se.type === 'specific' ? `Card ${se.card_id}` : `Random ${se.category}`} ({se.trigger_rate}% trigger)
																</div>
															))}
														</div>
													)}
												</div>
											))}
										</div>
									)}
								</div>

								<div className={styles.buttonGroup}>
									<button onClick={handleEdit} className={styles.iconButton}>編輯</button>
									<button onClick={handleDelete} className={styles.iconButtonDanger}>刪除</button>
								</div>
							</div>
						) : (editMode === "edit" || editMode === "new") ? (
							<div className={styles.editMode}>
								{/* Basic Info Section */}
								<div className={styles.section}>
									<div className={styles.sectionHeader} onClick={() => toggleSection('basic')}>
										<h4>基本資訊</h4>
										{expandedSections.basic ? <ChevronUp size={20} color="#ffffff" /> : <ChevronDown size={20} color="#ffffff" />}
									</div>
									{expandedSections.basic && (
										<div className={styles.sectionContent}>
											<div className={styles.formField}>
												<label>ID (自動編碼)</label>
												<input
													type="number"
													value={formData.id}
													onChange={(e) => setFormData({ ...formData, id: parseInt(e.target.value) })}
													disabled={editMode === "edit"}
												/>
											</div>

											<div className={styles.formField}>
												<label>Code (自動編碼)</label>
												<input
													type="text"
													value={formData.code}
													onChange={(e) => setFormData({ ...formData, code: e.target.value })}
												/>
											</div>

											<div className={styles.formField}>
												<label>Title</label>
												<input
													type="text"
													value={formData.title}
													onChange={(e) => setFormData({ ...formData, title: e.target.value })}
												/>
											</div>

											<div className={styles.formField}>
												<label>Description</label>
												<input
													type="text"
													value={formData.description}
													onChange={(e) => setFormData({ ...formData, description: e.target.value })}
												/>
											</div>

											<div className={styles.checkboxGroup} style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
												<label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
													<input
														type="checkbox"
														checked={formData.is_shiny || false}
														onChange={(e) => setFormData({ ...formData, is_shiny: e.target.checked })}
													/>
													<span style={{ color: '#e2e8f0' }}>Shiny Card (閃卡)</span>
												</label>
												<label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
													<input
														type="checkbox"
														checked={formData.can_be_initial || false}
														onChange={(e) => setFormData({ ...formData, can_be_initial: e.target.checked })}
													/>
													<span style={{ color: '#e2e8f0' }}>Can be Initial Card (可作為起始卡)</span>
												</label>
											</div>

											<div className={styles.formField}>
												<label>Category (for random selection)</label>
												<select
													value={formData.category || ""}
													onChange={(e) => setFormData({ ...formData, category: e.target.value || null })}
												>
													<option value="">-- None --</option>
													{categories.map(cat => (
														<option key={cat} value={cat}>{cat}</option>
													))}
												</select>
											</div>
										</div>
									)}
								</div>

								{/* Conflicts Section */}
								<div className={styles.section}>
									<div className={styles.sectionHeader} onClick={() => toggleSection('relationships')}>
										<h4>關聯設定</h4>
										{expandedSections.relationships ? <ChevronUp size={20} color="#ffffff" /> : <ChevronDown size={20} color="#ffffff" />}
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

											{/* Outcomes - inside 關聯設定 */}
											<div className={styles.formField} style={{ marginTop: '1.5rem' }}>
												<label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
													<span>Outcomes</span>
													<button onClick={addOutcome} className={styles.addBtn}>
														<Plus size={16} /> Add
													</button>
												</label>
												{formData.outcomes?.map((outcome, oIdx) => (
											<div key={outcome.id} className={styles.outcomeCard}>
												<div className={styles.outcomeHeader}>
													<span>Outcome {oIdx + 1}</span>
													<button onClick={() => removeOutcome(oIdx)} className={styles.removeBtn}>
														<Trash2 size={16} />
													</button>
												</div>

												<div className={styles.formRow}>
													<div className={styles.formField} style={{ flex: 2 }}>
														<label>Description</label>
														<input
															type="text"
															value={outcome.description}
															onChange={(e) => updateOutcome(oIdx, 'description', e.target.value)}
														/>
													</div>
													<div className={styles.formField} style={{ flex: 1 }}>
														<label>Probability: {outcome.probability}%</label>
														<input
															type="range"
															min="0"
															max="100"
															step="5"
															value={outcome.probability}
															onChange={(e) => updateOutcome(oIdx, 'probability', parseInt(e.target.value))}
															style={{ width: '100%' }}
														/>
													</div>
													<div className={styles.formField} style={{ flex: 1 }}>
														<label>Next Card ID</label>
														<select
															value={outcome.next_card_id}
															onChange={(e) => updateOutcome(oIdx, 'next_card_id', parseInt(e.target.value))}
														>
															<option value="">-- Select Card --</option>
															{currentCards.map(card => (
																<option key={card.id} value={card.id}>
																	{card.code}: {card.title}
																</option>
															))}
														</select>
													</div>
												</div>

												{/* Side Effects */}
												<div className={styles.sideEffectsSection}>
													<label>
														Side Effects
														<button onClick={() => addSideEffect(oIdx)} className={styles.addBtn} style={{ marginLeft: '0.5rem' }}>
															<Plus size={14} /> Add
														</button>
													</label>
													{outcome.side_effects?.map((sideEffect, sIdx) => (
														<div key={sIdx} className={styles.sideEffectCard}>
															<div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
																<div style={{ flex: 1 }}>
																	<div className={styles.formRow}>
																		<div className={styles.formField}>
																			<label>Type</label>
																			<select
																				value={sideEffect.type}
																				onChange={(e) => updateSideEffect(oIdx, sIdx, 'type', e.target.value)}
																			>
																				<option value="specific">Specific Card</option>
																				<option value="random_category">Random Category</option>
																			</select>
																		</div>

																		{sideEffect.type === 'specific' ? (
																			<div className={styles.formField}>
																				<label>Card ID</label>
																				<select
																					value={sideEffect.card_id || ''}
																					onChange={(e) => updateSideEffect(oIdx, sIdx, 'card_id', parseInt(e.target.value) || null)}
																				>
																					<option value="">-- Select Card --</option>
																					<optgroup label="緊急 Emergency">
																						{cards.emergency.map(card => (
																							<option key={card.id} value={card.id}>
																								{card.code}: {card.title}
																							</option>
																						))}
																					</optgroup>
																					<optgroup label="旅客 Passenger">
																						{cards.passenger.map(card => (
																							<option key={card.id} value={card.id}>
																								{card.code}: {card.title}
																							</option>
																						))}
																					</optgroup>
																					<optgroup label="設備 Equipment">
																						{cards.equipment.map(card => (
																							<option key={card.id} value={card.id}>
																								{card.code}: {card.title}
																							</option>
																						))}
																					</optgroup>
																					<optgroup label="Door">
																						{cards.door?.map(card => (
																							<option key={card.id} value={card.id}>
																								{card.code}: {card.title}
																							</option>
																						))}
																					</optgroup>
																					<optgroup label="Position">
																						{cards.position?.map(card => (
																							<option key={card.id} value={card.id}>
																								{card.code}: {card.title}
																							</option>
																						))}
																					</optgroup>
																				</select>
																			</div>
																		) : (
																			<div className={styles.formField}>
																				<label>Category (RANDOM)</label>
																				<select
																					value={sideEffect.category || ''}
																					onChange={(e) => updateSideEffect(oIdx, sIdx, 'category', e.target.value)}
																				>
																					<option value="">-- Select --</option>
																					{categories.map(cat => (
																						<option key={cat} value={cat}>{cat}</option>
																					))}
																				</select>
																			</div>
																		)}

																		<div className={styles.formField}>
																			<label>Trigger Rate: {sideEffect.trigger_rate}%</label>
																			<input
																				type="range"
																				min="0"
																				max="100"
																				step="5"
																				value={sideEffect.trigger_rate}
																				onChange={(e) => updateSideEffect(oIdx, sIdx, 'trigger_rate', parseInt(e.target.value))}
																				style={{ width: '100%' }}
																			/>
																		</div>
																	</div>
																</div>

																<button onClick={() => removeSideEffect(oIdx, sIdx)} className={styles.removeBtn} style={{ marginTop: '1.75rem' }}>
																	<X size={14} />
																</button>
															</div>
														</div>
													))}
												</div>
											</div>
										))}
									</div>
								</div>
									)}
								</div>

								<div className={styles.buttonGroup}>
									<button onClick={handleSave} className={styles.saveBtn}>儲存</button>
									<button onClick={() => setEditMode("view")} className={styles.cancelBtn}>取消</button>
								</div>
							</div>
						) : (
							<div className={styles.emptyState}>
								<p>請選擇一張卡片或新增情境</p>
							</div>
						)}
					</div>
				</div>

				<div className={styles.footer} style={{ color: '#ffffff' }}>
					總計: 緊急: {cards.emergency.length} | 旅客: {cards.passenger.length} | 設備: {cards.equipment.length} | Door: {cards.door?.length || 0} | Position: {cards.position?.length || 0}
				</div>
			</div>
		</div>
	);
};

export default ScenarioEditor;