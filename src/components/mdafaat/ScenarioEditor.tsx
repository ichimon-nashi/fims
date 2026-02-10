// src/components/mdafaat/ScenarioEditor.tsx
"use client";

import React, { useState } from "react";
import { X, Save, Download, Upload, Plus, Trash2, Copy } from "lucide-react";
import { PiSirenFill } from "react-icons/pi";
import { FaPersonWalkingLuggage } from "react-icons/fa6";
import { FaTools } from "react-icons/fa";
import styles from "./ScenarioEditor.module.css";

interface Card {
	id: number;
	title: string;
	description: string;
	code: string;
	conflicts?: number[];
}

interface Outcome {
	probability: number;
	description: string;
	action?: string;
	duration?: string;
	escalates?: boolean;
}

interface CardEnhancement {
	synergies?: number[];
	escalates_to?: number[];
	crew_impact?: Record<string, Outcome>;
	passenger_impact?: Record<string, Outcome>;
	severity_levels?: Record<string, Outcome>;
	malfunction_outcomes?: Record<string, Outcome>;
	escalation_chance?: number;
}

interface CardData {
	emergency: Card[];
	passenger: Card[];
	equipment: Card[];
}

interface ScenarioEditorProps {
	onClose: () => void;
	initialData: CardData;
}

type CardType = "emergency" | "passenger" | "equipment";

const ScenarioEditor: React.FC<ScenarioEditorProps> = ({ onClose, initialData }) => {
	const [cardType, setCardType] = useState<CardType>("emergency");
	const [cards, setCards] = useState<CardData>(initialData);
	const [selectedCard, setSelectedCard] = useState<Card | null>(null);
	const [editMode, setEditMode] = useState<"view" | "edit" | "new">("view");

	// Form state for editing
	const [formData, setFormData] = useState<Card>({
		id: 0,
		title: "",
		description: "",
		code: "",
		conflicts: []
	});

	const currentCards = cards[cardType];

	const handleSelectCard = (card: Card) => {
		setSelectedCard(card);
		setFormData(card);
		setEditMode("view");
	};

	const handleEdit = () => {
		setEditMode("edit");
	};

	const handleNew = () => {
		const newId = Math.max(...currentCards.map(c => c.id), 0) + 1;
		const newCode = `${cardType === "emergency" ? "E" : cardType === "passenger" ? "P" : "Q"}-${String(newId).padStart(2, "0")}`;
		
		setFormData({
			id: newId,
			title: "",
			description: "",
			code: newCode,
			conflicts: []
		});
		setSelectedCard(null);
		setEditMode("new");
	};

	const handleSave = () => {
		if (!formData.title || !formData.description) {
			alert("請填寫標題和描述");
			return;
		}

		const updatedCards = { ...cards };
		
		if (editMode === "new") {
			updatedCards[cardType] = [...updatedCards[cardType], formData];
		} else if (editMode === "edit" && selectedCard) {
			updatedCards[cardType] = updatedCards[cardType].map(c => 
				c.id === selectedCard.id ? formData : c
			);
		}

		setCards(updatedCards);
		setSelectedCard(formData);
		setEditMode("view");
	};

	const handleDelete = () => {
		if (!selectedCard) return;
		
		if (confirm(`確定要刪除「${selectedCard.title}」嗎？`)) {
			const updatedCards = { ...cards };
			updatedCards[cardType] = updatedCards[cardType].filter(c => c.id !== selectedCard.id);
			setCards(updatedCards);
			setSelectedCard(null);
			setEditMode("view");
		}
	};

	const handleDuplicate = () => {
		if (!selectedCard) return;
		
		const newId = Math.max(...currentCards.map(c => c.id), 0) + 1;
		const newCode = `${cardType === "emergency" ? "E" : cardType === "passenger" ? "P" : "Q"}-${String(newId).padStart(2, "0")}`;
		
		const duplicated = {
			...selectedCard,
			id: newId,
			code: newCode,
			title: `${selectedCard.title} (副本)`
		};
		
		const updatedCards = { ...cards };
		updatedCards[cardType] = [...updatedCards[cardType], duplicated];
		setCards(updatedCards);
		setSelectedCard(duplicated);
		setFormData(duplicated);
	};

	const handleExport = () => {
		const dataStr = JSON.stringify(cards, null, 2);
		const dataBlob = new Blob([dataStr], { type: "application/json" });
		const url = URL.createObjectURL(dataBlob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `mdafaat-scenarios-${new Date().toISOString().split('T')[0]}.json`;
		link.click();
		URL.revokeObjectURL(url);
	};

	const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const imported = JSON.parse(e.target?.result as string);
				setCards(imported);
				alert("匯入成功！");
			} catch (error) {
				alert("匯入失敗：格式錯誤");
			}
		};
		reader.readAsText(file);
	};

	const getCardIcon = (type: CardType) => {
		switch (type) {
			case "emergency": return <PiSirenFill size={20} />;
			case "passenger": return <FaPersonWalkingLuggage size={18} />;
			case "equipment": return <FaTools size={18} />;
		}
	};

	return (
		<div className={styles.modal}>
			<div className={styles.modalOverlay} onClick={onClose} />
			<div className={styles.modalContent}>
				{/* Header */}
				<div className={styles.header}>
					<h2 className={styles.title}>情境編輯器</h2>
					<button onClick={onClose} className={styles.closeButton}>
						<X size={24} />
					</button>
				</div>

				{/* Main Content */}
				<div className={styles.editorLayout}>
					{/* Left Sidebar - Card List */}
					<div className={styles.sidebar}>
						<div className={styles.typeSelector}>
							<button
								className={`${styles.typeButton} ${cardType === "emergency" ? styles.typeActive : ""}`}
								onClick={() => setCardType("emergency")}
							>
								<PiSirenFill size={18} />
								<span>緊急狀況</span>
								<span className={styles.count}>{cards.emergency.length}</span>
							</button>
							<button
								className={`${styles.typeButton} ${cardType === "passenger" ? styles.typeActive : ""}`}
								onClick={() => setCardType("passenger")}
							>
								<FaPersonWalkingLuggage size={16} />
								<span>旅客狀況</span>
								<span className={styles.count}>{cards.passenger.length}</span>
							</button>
							<button
								className={`${styles.typeButton} ${cardType === "equipment" ? styles.typeActive : ""}`}
								onClick={() => setCardType("equipment")}
							>
								<FaTools size={16} />
								<span>設備/環境</span>
								<span className={styles.count}>{cards.equipment.length}</span>
							</button>
						</div>

						<button onClick={handleNew} className={styles.newButton}>
							<Plus size={18} />
							新增情境
						</button>

						<div className={styles.cardList}>
							{currentCards.map(card => (
								<div
									key={card.id}
									className={`${styles.cardItem} ${selectedCard?.id === card.id ? styles.cardItemActive : ""}`}
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
												<button onClick={handleDuplicate} className={styles.iconButton} title="複製">
													<Copy size={18} />
												</button>
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
										<>
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
										</>
									) : (
										<>
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
											<div className={styles.formField}>
												<label>衝突情境 (選擇不能同時出現的情境)</label>
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
										</>
									)}
								</div>

								<div className={styles.note}>
									<strong>注意：</strong>進階設定（結果機率、協同效應、升級路徑）需直接編輯 scenarioData.ts 檔案。此編輯器主要用於管理基本卡片資訊。
								</div>
							</>
						) : (
							<div className={styles.emptyState}>
								<div className={styles.emptyIcon}>{getCardIcon(cardType)}</div>
								<p>請從左側選擇情境進行編輯</p>
								<p>或點擊「新增情境」建立新卡片</p>
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className={styles.footer}>
					<div className={styles.footerLeft}>
						<button onClick={handleExport} className={styles.footerButton}>
							<Download size={18} />
							匯出 JSON
						</button>
						<label className={styles.footerButton}>
							<Upload size={18} />
							匯入 JSON
							<input
								type="file"
								accept=".json"
								onChange={handleImport}
								style={{ display: "none" }}
							/>
						</label>
					</div>
					<div className={styles.footerRight}>
						<span className={styles.stats}>
							總計：{cards.emergency.length + cards.passenger.length + cards.equipment.length} 張卡片
						</span>
					</div>
				</div>
			</div>
		</div>
	);
};

export default ScenarioEditor;