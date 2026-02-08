// src/components/mdafaat/MDAfaatGame.tsx - WITH TEAM FORMATION + ORIGINAL GAME LOGIC PRESERVED
"use client";

import React, { useState } from "react";
import { Shuffle, RotateCcw, Plus, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import TeamFormation from "./TeamFormation";
import styles from "./MDAfaatGame.module.css";

interface Card {
	id: number;
	title: string;
	description: string;
	code: string;
	conflicts: number[];
}

interface CardData {
	emergency: Card[];
	passenger: Card[];
	equipment: Card[];
}

interface DrawnCard extends Card {
	type: "emergency" | "passenger" | "equipment";
	originalId: number;
	timestamp: number;
	id: string;
}

interface PlayingCardProps {
	card: Partial<DrawnCard>;
	onRemove?: ((cardId: string) => void) | null;
	isInDeck?: boolean;
}

const MDAfaatGame = () => {
	// NEW: Game mode state
	const [gameMode, setGameMode] = useState<"formation" | "game">("formation");

	// ORIGINAL card data - UNCHANGED
	const cardData: CardData = {
		emergency: [
			{
				id: 1,
				title: "客艙火災",
				description: "置物櫃旅客行李起火！",
				code: "E-01",
				conflicts: [2, 6],
			},
			{
				id: 2,
				title: "客艙失壓",
				description: "客艙破洞造成快速失壓！",
				code: "E-02",
				conflicts: [1, 4, 6, 8],
			},
			{
				id: 3,
				title: "亂流受傷",
				description: "旅客因通過無預警亂流受傷！",
				code: "E-03",
				conflicts: [],
			},
			{
				id: 4,
				title: "PED電子用品起火",
				description: "手機電池發熱冒煙！",
				code: "E-04",
				conflicts: [2],
			},
			{
				id: 5,
				title: "醫療事件",
				description: "旅客昏倒，無心跳！",
				code: "E-05",
				conflicts: [],
			},
			{
				id: 6,
				title: "客艙冒煙",
				description: "隱藏性火災，客艙冒煙！",
				code: "E-06",
				conflicts: [2],
			},
			{
				id: 7,
				title: "組員失能",
				description: "前艙組員失能！",
				code: "E-07",
				conflicts: [],
			},
			{
				id: 8,
				title: "CPP",
				description: "雙引擎失效，準備迫降！",
				code: "E-08",
				conflicts: [1, 2, 6],
			},
			{
				id: 9,
				title: "滑出跑道",
				description: "飛機滑出跑道！",
				code: "E-09",
				conflicts: [],
			},
			{
				id: 10,
				title: "機場關閉",
				description: "目的地機場關閉！",
				code: "E-10",
				conflicts: [],
			},
		],
		passenger: [
			{
				id: 1,
				title: "酒醉旅客",
				description: "酒醉旅客騷擾其他旅客！",
				code: "P-01",
				conflicts: [],
			},
			{
				id: 2,
				title: "嬰兒啼哭",
				description: "嬰兒持續啼哭不停！",
				code: "P-02",
				conflicts: [],
			},
			{
				id: 3,
				title: "寵物脫逃",
				description: "客艙寵物脫逃四處亂竄！",
				code: "P-03",
				conflicts: [],
			},
			{
				id: 4,
				title: "座位糾紛",
				description: "旅客爭奪座位發生爭執！",
				code: "P-04",
				conflicts: [],
			},
			{
				id: 5,
				title: "暈機嘔吐",
				description: "多位旅客暈機嘔吐！",
				code: "P-05",
				conflicts: [],
			},
			{
				id: 6,
				title: "過敏反應",
				description: "旅客食物過敏！",
				code: "P-06",
				conflicts: [],
			},
			{
				id: 7,
				title: "行李掉落",
				description: "行李櫃行李掉落砸傷旅客！",
				code: "P-07",
				conflicts: [],
			},
			{
				id: 8,
				title: "恐慌發作",
				description: "旅客恐慌發作呼吸困難！",
				code: "P-08",
				conflicts: [],
			},
			{
				id: 9,
				title: "語言障礙",
				description: "旅客不會說中英文！",
				code: "P-09",
				conflicts: [],
			},
			{
				id: 10,
				title: "特殊餐點",
				description: "特殊餐點漏備！",
				code: "P-10",
				conflicts: [],
			},
		],
		equipment: [
			{
				id: 1,
				title: "廁所故障",
				description: "廁所馬桶阻塞溢水！",
				code: "Q-01",
				conflicts: [],
			},
			{
				id: 2,
				title: "娛樂系統",
				description: "全機娛樂系統當機！",
				code: "Q-02",
				conflicts: [],
			},
			{
				id: 3,
				title: "空調失效",
				description: "客艙空調系統失效！",
				code: "Q-03",
				conflicts: [],
			},
			{
				id: 4,
				title: "照明故障",
				description: "客艙照明突然熄滅！",
				code: "Q-04",
				conflicts: [],
			},
			{
				id: 5,
				title: "座椅損壞",
				description: "旅客座椅無法調整！",
				code: "Q-05",
				conflicts: [],
			},
			{
				id: 6,
				title: "餐車卡住",
				description: "餐車輪子卡住無法移動！",
				code: "Q-06",
				conflicts: [],
			},
			{
				id: 7,
				title: "烤箱故障",
				description: "烤箱冒煙停止運作！",
				code: "Q-07",
				conflicts: [],
			},
			{
				id: 8,
				title: "門把損壞",
				description: "艙門把手鬆脫！",
				code: "Q-08",
				conflicts: [],
			},
			{
				id: 9,
				title: "氧氣面罩",
				description: "氧氣面罩意外掉落！",
				code: "Q-09",
				conflicts: [],
			},
			{
				id: 10,
				title: "通話系統",
				description: "機組通話系統故障！",
				code: "Q-10",
				conflicts: [],
			},
		],
	};

	// ORIGINAL state - UNCHANGED
	const [allDrawnCards, setAllDrawnCards] = useState<DrawnCard[]>([]);
	const [availableCards, setAvailableCards] = useState<CardData>(cardData);
	const [shuffling, setShuffling] = useState(false);
	const [dealingAnimation, setDealingAnimation] = useState(false);
	const [cardTypeFilter, setCardTypeFilter] = useState<
		"all" | "emergency" | "passenger" | "equipment"
	>("all");

	// ORIGINAL functions - UNCHANGED
	const getShuffleRadius = () => {
		if (typeof window !== "undefined") {
			const width = window.innerWidth;
			if (width < 1024) return 120;
			if (width < 1440) return 150;
			return 200;
		}
		return 200;
	};

	const canDrawCard = (
		newCard: Card,
		existingCards: DrawnCard[],
		cardType: "emergency" | "passenger" | "equipment",
	): boolean => {
		const existingIds = existingCards
			.filter((card) => card.type === cardType)
			.map((card) => card.originalId);
		if (existingIds.includes(newCard.id)) return false;

		for (const existingCard of existingCards) {
			if (
				existingCard.conflicts &&
				existingCard.conflicts.includes(newCard.id)
			)
				return false;
			if (
				newCard.conflicts &&
				newCard.conflicts.includes(existingCard.originalId)
			)
				return false;
		}
		return true;
	};

	const getAvailableCardsForType = (
		cardType: "emergency" | "passenger" | "equipment",
	): Card[] => {
		return availableCards[cardType].filter((card) =>
			canDrawCard(card, allDrawnCards, cardType),
		);
	};

	const getAllAvailableCards = (): (Card & {
		type: "emergency" | "passenger" | "equipment";
	})[] => {
		const emergency = getAvailableCardsForType("emergency").map((card) => ({
			...card,
			type: "emergency" as const,
		}));
		const passenger = getAvailableCardsForType("passenger").map((card) => ({
			...card,
			type: "passenger" as const,
		}));
		const equipment = getAvailableCardsForType("equipment").map((card) => ({
			...card,
			type: "equipment" as const,
		}));
		return [...emergency, ...passenger, ...equipment];
	};

	const drawRandomCard = () => {
		let allAvailable: (Card & {
			type: "emergency" | "passenger" | "equipment";
		})[];

		if (cardTypeFilter === "all") {
			allAvailable = getAllAvailableCards();
		} else {
			allAvailable = getAvailableCardsForType(cardTypeFilter).map(
				(card) => ({ ...card, type: cardTypeFilter }),
			);
		}

		if (allAvailable.length === 0) return;

		const randomCard =
			allAvailable[Math.floor(Math.random() * allAvailable.length)];
		const newCard: DrawnCard = {
			...randomCard,
			originalId: randomCard.id,
			timestamp: Date.now(),
			id: `${randomCard.type}-${randomCard.id}-${Date.now()}`,
		};

		setAllDrawnCards((prev) => [...prev, newCard]);
	};

	const dealDefaultScenario = async () => {
		setShuffling(true);
		setDealingAnimation(true);

		await new Promise((resolve) => setTimeout(resolve, 1500));
		setShuffling(false);

		const cardTypes: ("emergency" | "passenger" | "equipment")[] = [
			"emergency",
			"passenger",
			"equipment",
		];

		for (let i = 0; i < cardTypes.length; i++) {
			await new Promise((resolve) => setTimeout(resolve, 600));
			const cardType = cardTypes[i];
			const availableForType = getAvailableCardsForType(cardType);

			if (availableForType.length > 0) {
				const randomCard =
					availableForType[
						Math.floor(Math.random() * availableForType.length)
					];
				const newCard: DrawnCard = {
					...randomCard,
					type: cardType,
					originalId: randomCard.id,
					timestamp: Date.now(),
					id: `${cardType}-${randomCard.id}-${Date.now()}`,
				};
				setAllDrawnCards((prev) => [...prev, newCard]);
			}
		}

		setDealingAnimation(false);
	};

	const resetAll = () => {
		setAllDrawnCards([]);
		setAvailableCards(cardData);
		setShuffling(false);
		setDealingAnimation(false);
	};

	const removeCard = (cardId: string) => {
		setAllDrawnCards((prev) => prev.filter((card) => card.id !== cardId));
	};

	// ORIGINAL PlayingCard component - UNCHANGED
	const PlayingCard: React.FC<PlayingCardProps> = ({
		card,
		onRemove,
		isInDeck = false,
	}) => {
		const getSymbol = (type?: string) => {
			switch (type) {
				case "emergency":
					return "♦";
				case "passenger":
					return "♠";
				case "equipment":
					return "♣";
				default:
					return "";
			}
		};

		const getCardClass = () => {
			if (isInDeck) return styles.deckCard;
			switch (card.type) {
				case "emergency":
					return styles.emergencyCard;
				case "passenger":
					return styles.passengerCard;
				case "equipment":
					return styles.equipmentCard;
				default:
					return "";
			}
		};

		if (isInDeck) {
			return (
				<div className={`${styles.card} ${getCardClass()}`}>
					<div className={styles.deckContent}>
						<Image
							src="/images/deckback.png"
							alt="Card Back"
							width={256}
							height={344}
							className={styles.deckImage}
							priority
						/>
					</div>
				</div>
			);
		}

		return (
			<div
				className={`${styles.card} ${getCardClass()} ${styles.playingCard}`}
			>
				{onRemove && (
					<button
						className={styles.removeButton}
						onClick={() => onRemove(card.id!)}
					>
						×
					</button>
				)}
				<div className={styles.cardHeader}>
					<div className={styles.cardSymbol}>
						{getSymbol(card.type)}
					</div>
					<div className={styles.cardCode}>{card.code}</div>
				</div>
				<div className={styles.cardSymbolTopRight}>
					{getSymbol(card.type)}
				</div>
				<div className={styles.cardContent}>
					<div className={styles.cardTitle}>{card.title}</div>
					<div className={styles.cardDescription}>
						{card.description}
					</div>
				</div>
				<div className={styles.cardSymbolBottomLeft}>
					{getSymbol(card.type)}
				</div>
				<div className={styles.cardFooter}>
					<div className={styles.cardSymbolFooter}>
						{getSymbol(card.type)}
					</div>
					<div className={styles.cardCodeFooter}>{card.code}</div>
				</div>
			</div>
		);
	};

	// NEW: Handler for starting game from team formation
	const handleStartGame = () => {
		setGameMode("game");
	};

	// NEW: Handler for going back to team formation
	const handleBackToFormation = () => {
		setGameMode("formation");
	};

	// Render team formation mode
	if (gameMode === "formation") {
		return (
			<div className={styles.container}>
				<div className={styles.background}></div>
				<div className={styles.mainContent}>
					<TeamFormation onStartGame={handleStartGame} />
				</div>
			</div>
		);
	}

	// ORIGINAL game render - UNCHANGED
	return (
		<div
			className={`${styles.container} ${shuffling ? styles.shuffling : ""}`}
		>
			<div className={styles.background}></div>

			<div className={styles.mainContent}>
				<header className={styles.header}>
					<h1 className={styles.title}>
						<span className={styles.titleAccent}>♠</span>
						客艙組員情境演練卡牌
						<span className={styles.titleAccent}>♠</span>
					</h1>
					<p className={styles.subtitle}>
						🎰 組員緊急應變訓練 • 撲克牌風格 🎰
					</p>
				</header>

				<div className={styles.controlPanel}>
					<div className={styles.controlsRow}>
						{/* NEW: Back to Team Formation button */}
						<button
							onClick={handleBackToFormation}
							className={`${styles.button} ${styles.backButton}`}
						>
							<ArrowLeft className={styles.buttonIcon} />
							返回分組
						</button>

						<button
							onClick={dealDefaultScenario}
							disabled={dealingAnimation || shuffling}
							className={`${styles.button} ${styles.dealButton} ${dealingAnimation || shuffling ? styles.disabled : ""}`}
						>
							<Shuffle className={styles.buttonIcon} />
							發牌
						</button>

						<button
							onClick={resetAll}
							className={`${styles.button} ${styles.resetButton}`}
						>
							<RotateCcw className={styles.buttonIcon} />
							重置
						</button>

						<div className={styles.buttonDivider}></div>

						<div className={styles.cardTypeSelector}>
							<button
								onClick={() => setCardTypeFilter("all")}
								className={`${styles.filterButton} ${styles.filterAll} ${cardTypeFilter === "all" ? styles.filterActive : ""}`}
								title="全部卡牌"
							>
								全部
							</button>
							<button
								onClick={() => setCardTypeFilter("emergency")}
								className={`${styles.filterButton} ${styles.filterEmergency} ${cardTypeFilter === "emergency" ? styles.filterActive : ""}`}
								title="僅緊急情況"
							>
								♦
							</button>
							<button
								onClick={() => setCardTypeFilter("passenger")}
								className={`${styles.filterButton} ${styles.filterPassenger} ${cardTypeFilter === "passenger" ? styles.filterActive : ""}`}
								title="僅旅客問題"
							>
								♠
							</button>
							<button
								onClick={() => setCardTypeFilter("equipment")}
								className={`${styles.filterButton} ${styles.filterEquipment} ${cardTypeFilter === "equipment" ? styles.filterActive : ""}`}
								title="僅設備故障"
							>
								♣
							</button>
						</div>

						<div className={styles.buttonDivider}></div>

						<button
							onClick={drawRandomCard}
							disabled={
								cardTypeFilter === "all"
									? getAllAvailableCards().length === 0
									: getAvailableCardsForType(cardTypeFilter)
											.length === 0
							}
							className={`${styles.button} ${styles.startButton} ${
								(
									cardTypeFilter === "all"
										? getAllAvailableCards().length === 0
										: getAvailableCardsForType(
												cardTypeFilter,
											).length === 0
								)
									? styles.disabled
									: ""
							}`}
						>
							<Plus className={styles.buttonIcon} />
							抽牌 (
							{cardTypeFilter === "all"
								? getAllAvailableCards().length
								: getAvailableCardsForType(cardTypeFilter)
										.length}
							)
						</button>

						{allDrawnCards.length > 0 && (
							<div className={styles.statsInline}>
								<span className={styles.statEmergency}>
									♦
									{
										allDrawnCards.filter(
											(card) => card.type === "emergency",
										).length
									}
								</span>
								<span className={styles.statPassenger}>
									♠
									{
										allDrawnCards.filter(
											(card) => card.type === "passenger",
										).length
									}
								</span>
								<span className={styles.statEquipment}>
									♣
									{
										allDrawnCards.filter(
											(card) => card.type === "equipment",
										).length
									}
								</span>
							</div>
						)}
					</div>
				</div>

				<div className={styles.gameArea}>
					{allDrawnCards.length === 0 ? (
						<div className={styles.deckArea}>
							<div className={styles.deckContainer}>
								<div className={styles.deckBase}>
									<PlayingCard card={{}} isInDeck={true} />
								</div>
								{shuffling &&
									Array.from({ length: 8 }).map((_, i) => {
										const angle = (i * 360) / 8;
										const radius = getShuffleRadius();
										const x =
											Math.cos((angle * Math.PI) / 180) *
											radius;
										const y =
											Math.sin((angle * Math.PI) / 180) *
											radius;
										return (
											<motion.div
												key={i}
												className={styles.shuffleCard}
												initial={{
													x: 0,
													y: 0,
													rotate: 0,
													opacity: 0,
												}}
												animate={{
													x: [0, x, 0],
													y: [0, y, 0],
													rotate: [0, 360, 0],
													opacity: [0, 1, 0],
												}}
												transition={{
													duration: 1.5,
													repeat: 0,
													ease: "easeInOut",
													delay: i * 0.1,
												}}
												style={{ position: "absolute" }}
											>
												<PlayingCard
													card={{}}
													isInDeck={true}
												/>
											</motion.div>
										);
									})}
								{dealingAnimation && (
									<div className={styles.statusMessage}>
										發牌中...
									</div>
								)}
							</div>
						</div>
					) : (
						<div className={styles.cardsContainer}>
							<AnimatePresence>
								{allDrawnCards.map((card) => (
									<motion.div
										key={card.id}
										initial={{
											opacity: 0,
											scale: 0.8,
											y: -50,
										}}
										animate={{ opacity: 1, scale: 1, y: 0 }}
										exit={{
											opacity: 0,
											scale: 0.8,
											x: 100,
										}}
										transition={{ duration: 0.5 }}
									>
										<PlayingCard
											card={card}
											onRemove={removeCard}
										/>
									</motion.div>
								))}
							</AnimatePresence>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default MDAfaatGame;
