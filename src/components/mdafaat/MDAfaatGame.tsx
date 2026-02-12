// src/components/mdafaat/MDAfaatGame.tsx - WITH TEAM FORMATION + SMART SCENARIO SYSTEM
"use client";

import React, { useState, useEffect } from "react";
import { Shuffle, RotateCcw, Plus, ArrowLeft, Sparkles } from "lucide-react";
import { FiEdit } from "react-icons/fi";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { PiSirenFill } from "react-icons/pi";
import { FaPersonWalkingLuggage } from "react-icons/fa6";
import { FaTools } from "react-icons/fa";
import TeamFormation from "./TeamFormation";
import ScenarioEditor from "./ScenarioEditor";
import styles from "./MDAfaatGame.module.css";
import { 
	Outcome, 
	OutcomeSet, 
	enhanceAllCards 
} from "@/utils/mdafaat/scenarioData";
import { getAllCards } from "@/lib/mdafaatDatabase";

// ============================================
// INTERFACES - UPDATED
// ============================================

interface Card {
	id: number;
	title: string;
	description: string;
	code: string;
	conflicts: number[];
	// NEW: Smart scenario fields
	synergies?: number[];
	escalates_to?: number[];
	crew_impact?: OutcomeSet;
	passenger_impact?: OutcomeSet;
	severity_levels?: OutcomeSet;
	malfunction_outcomes?: OutcomeSet;
	escalation_chance?: number;
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
	// NEW: Selected outcome
	selectedOutcome?: Outcome;
	outcomeKey?: string;
}

interface PlayingCardProps {
	card: Partial<DrawnCard>;
	onRemove?: ((cardId: string) => void) | null;
	isInDeck?: boolean;
}

// ============================================
// UTILITY FUNCTIONS - NEW
// ============================================

const randomPick = <T,>(array: T[]): T => {
	return array[Math.floor(Math.random() * array.length)];
};

const randomInt = (min: number, max: number): number => {
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

const shuffleArray = <T,>(array: T[]): T[] => {
	const shuffled = [...array];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
};

const selectRandomOutcome = (outcomeSet: OutcomeSet): [string, Outcome] => {
	const outcomes = Object.entries(outcomeSet);
	const random = Math.random();
	let cumulative = 0;
	
	for (const [key, outcome] of outcomes) {
		cumulative += outcome.probability;
		if (random <= cumulative) {
			return [key, outcome];
		}
	}
	return outcomes[0];
};

const weightedRandomPick = (
	cards: Card[],
	weights: Array<{ cards: number[]; weight: number }>
): Card | null => {
	const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
	let random = Math.random() * totalWeight;
	
	for (const weightGroup of weights) {
		random -= weightGroup.weight;
		if (random <= 0) {
			const validCards = cards.filter((c) => weightGroup.cards.includes(c.id));
			if (validCards.length > 0) {
				return randomPick(validCards);
			}
		}
	}
	return null;
};

const hasConflict = (card: Card, scenario: DrawnCard[]): boolean => {
	for (const existing of scenario) {
		if (card.conflicts?.includes(existing.originalId)) return true;
		if (existing.conflicts?.includes(card.id)) return true;
	}
	return false;
};

// ============================================
// SMART SCENARIO GENERATION - SESSION-BASED
// ============================================

// Core scenarios that MUST appear at least once per training session
const CORE_SCENARIOS = [1, 2, 3, 5]; // Fire, Decompression, Turbulence, Medical

// Scenario rotation pool - ensures variety
const SCENARIO_POOL = {
	high_priority: [1, 2, 3, 4, 5], // Fire, Decompression, Turbulence, PED, Medical
	medium_priority: [6, 7, 8], // Smoke, Crew Incapacitation, Bomb
	standard: [9, 10] // Landing Emergency, Other
};

const pickPrimaryEmergency = (
	emergencyCards: Card[],
	sessionScenarios: Set<number>,
	teamCount: number,
	currentTeamIndex: number
): DrawnCard | null => {
	let selectedCard: Card | null = null;
	
	// STRATEGY 1: First N teams get core scenarios (one per team)
	if (currentTeamIndex < CORE_SCENARIOS.length) {
		const coreScenario = CORE_SCENARIOS[currentTeamIndex];
		if (!sessionScenarios.has(coreScenario)) {
			selectedCard = emergencyCards.find(c => c.id === coreScenario) || null;
		}
	}
	
	// STRATEGY 2: If core scenario already drawn or no more cores, use undrawn scenarios
	if (!selectedCard) {
		const undrawnCards = emergencyCards.filter(c => !sessionScenarios.has(c.id));
		
		if (undrawnCards.length > 0) {
			// Prioritize high priority scenarios first
			const highPriority = undrawnCards.filter(c => SCENARIO_POOL.high_priority.includes(c.id));
			const mediumPriority = undrawnCards.filter(c => SCENARIO_POOL.medium_priority.includes(c.id));
			const standard = undrawnCards.filter(c => SCENARIO_POOL.standard.includes(c.id));
			
			if (highPriority.length > 0) {
				selectedCard = randomPick(highPriority);
			} else if (mediumPriority.length > 0) {
				selectedCard = randomPick(mediumPriority);
			} else if (standard.length > 0) {
				selectedCard = randomPick(standard);
			} else {
				selectedCard = randomPick(undrawnCards);
			}
		}
	}
	
	// STRATEGY 3: All scenarios drawn, pick randomly
	if (!selectedCard) {
		selectedCard = randomPick(emergencyCards);
	}
	
	if (!selectedCard) return null;
	
	return {
		...selectedCard,
		type: 'emergency',
		originalId: selectedCard.id,
		id: `e-${selectedCard.id}-${Date.now()}`,
		timestamp: Date.now()
	};
};

const pickSynergyCards = (
	cardData: CardData,
	primaryCard: DrawnCard,
	existingScenario: DrawnCard[],
	count: number
): DrawnCard[] => {
	if (!primaryCard.synergies || primaryCard.synergies.length === 0) {
		return [];
	}
	
	const synergies: DrawnCard[] = [];
	const existingIds = existingScenario.map(c => c.originalId);
	
	const matchingPassengers = cardData.passenger.filter(p =>
		primaryCard.synergies!.includes(p.id) &&
		!existingIds.includes(p.id) &&
		!hasConflict(p, existingScenario)
	);
	
	const matchingEquipment = cardData.equipment.filter(e =>
		primaryCard.synergies!.includes(e.id) &&
		!existingIds.includes(e.id) &&
		!hasConflict(e, existingScenario)
	);
	
	const allMatching = [
		...matchingPassengers.map(c => ({ ...c, type: 'passenger' as const })),
		...matchingEquipment.map(c => ({ ...c, type: 'equipment' as const }))
	];
	
	const shuffled = shuffleArray(allMatching);
	
	for (let i = 0; i < Math.min(count, shuffled.length); i++) {
		const card = shuffled[i];
		synergies.push({
			...card,
			originalId: card.id,
			id: `${card.type[0]}-${card.id}-${Date.now()}-${i}`,
			timestamp: Date.now() + i
		});
	}
	
	return synergies;
};

const pickContextCards = (
	cardData: CardData,
	existingScenario: DrawnCard[],
	count: number
): DrawnCard[] => {
	if (count <= 0) return [];
	
	const context: DrawnCard[] = [];
	const existingIds = existingScenario.map(c => c.originalId);
	const existingTypes = existingScenario.map(c => c.type);
	
	const availablePassengers = cardData.passenger.filter(p =>
		!existingIds.includes(p.id) && !hasConflict(p, existingScenario)
	);
	
	const availableEquipment = cardData.equipment.filter(e =>
		!existingIds.includes(e.id) && !hasConflict(e, existingScenario)
	);
	
	const needsPassenger = !existingTypes.includes('passenger');
	const needsEquipment = !existingTypes.includes('equipment');
	
	let toAdd = count;
	
	if (needsPassenger && availablePassengers.length > 0 && toAdd > 0) {
		const card = randomPick(availablePassengers);
		context.push({
			...card,
			type: 'passenger',
			originalId: card.id,
			id: `p-${card.id}-${Date.now()}`,
			timestamp: Date.now()
		});
		toAdd--;
	}
	
	if (needsEquipment && availableEquipment.length > 0 && toAdd > 0) {
		const card = randomPick(availableEquipment);
		context.push({
			...card,
			type: 'equipment',
			originalId: card.id,
			id: `q-${card.id}-${Date.now()}`,
			timestamp: Date.now()
		});
		toAdd--;
	}
	
	const allAvailable = [
		...availablePassengers.map(c => ({ ...c, type: 'passenger' as const })),
		...availableEquipment.map(c => ({ ...c, type: 'equipment' as const }))
	];
	
	const shuffled = shuffleArray(allAvailable);
	
	for (let i = 0; i < toAdd && i < shuffled.length; i++) {
		const card = shuffled[i];
		context.push({
			...card,
			originalId: card.id,
			id: `${card.type[0]}-${card.id}-${Date.now()}-${i + 100}`,
			timestamp: Date.now() + i + 100
		});
	}
	
	return context;
};

const applyRandomOutcome = (card: DrawnCard): void => {
	let outcomeSet: OutcomeSet | undefined;
	
	if (card.type === 'emergency' && card.crew_impact) {
		outcomeSet = card.crew_impact;
	} else if (card.type === 'passenger' && card.severity_levels) {
		outcomeSet = card.severity_levels;
	} else if (card.type === 'equipment' && card.malfunction_outcomes) {
		outcomeSet = card.malfunction_outcomes;
	}
	
	if (!outcomeSet) return;
	
	const [key, outcome] = selectRandomOutcome(outcomeSet);
	card.selectedOutcome = outcome;
	card.outcomeKey = key;
	
	// Don't add to description - outcome is displayed separately in card UI
};

const applyEscalations = (cardData: CardData, scenario: DrawnCard[]): void => {
	const escalatedCards: DrawnCard[] = [];
	const existingIds = scenario.map(c => c.originalId);
	
	for (const card of scenario) {
		if (card.selectedOutcome?.escalates && card.escalates_to) {
			if (Math.random() < (card.escalation_chance || 0.3)) {
				const escalationId = randomPick(card.escalates_to);
				const escalatedEmergency = cardData.emergency.find(e => e.id === escalationId);
				
				if (escalatedEmergency && !existingIds.includes(escalationId)) {
					const escalatedCard: DrawnCard = {
						...escalatedEmergency,
						type: 'emergency',
						originalId: escalatedEmergency.id,
						id: `e-${escalatedEmergency.id}-${Date.now()}-esc`,
						timestamp: Date.now() + 1000,
						description: `${escalatedEmergency.description}\n\n⚡ 由「${card.title}」引發`
					};
					
					applyRandomOutcome(escalatedCard);
					escalatedCards.push(escalatedCard);
					existingIds.push(escalationId);
				}
			}
		}
	}
	
	scenario.push(...escalatedCards);
};

const generateSmartScenario = (
	cardData: CardData,
	sessionScenarios: Set<number>,
	teamCount: number,
	currentTeamIndex: number,
	cardCount: number = 5
): DrawnCard[] => {
	const scenario: DrawnCard[] = [];
	
	// STEP 1: Pick primary emergency (session-aware)
	const primaryEmergency = pickPrimaryEmergency(
		cardData.emergency,
		sessionScenarios,
		teamCount,
		currentTeamIndex
	);
	if (!primaryEmergency) return [];
	
	applyRandomOutcome(primaryEmergency);
	scenario.push(primaryEmergency);
	
	// STEP 2: Add escalation - EQUAL 50% chance for all scenarios
	if (primaryEmergency.escalates_to && primaryEmergency.escalates_to.length > 0) {
		const shouldEscalate = Math.random() < 0.5; // Equal 50% chance
		
		if (shouldEscalate) {
			const escalationId = randomPick(primaryEmergency.escalates_to);
			const escalatedEmergency = cardData.emergency.find(e => e.id === escalationId);
			
			if (escalatedEmergency) {
				const escalatedCard: DrawnCard = {
					...escalatedEmergency,
					type: 'emergency',
					originalId: escalatedEmergency.id,
					id: `e-${escalatedEmergency.id}-${Date.now()}-esc`,
					timestamp: Date.now() + 1000,
					description: `${escalatedEmergency.description}\n\n⚡ 由「${primaryEmergency.title}」引發`
				};
				
				applyRandomOutcome(escalatedCard);
				scenario.push(escalatedCard);
			}
		}
	}
	
	// STEP 3: Add 0-1 complicating factor (passenger OR equipment, not both)
	// 30% chance to add complication
	if (Math.random() < 0.3 && scenario.length < cardCount) {
		const usePassenger = Math.random() < 0.4; // 40% passenger, 60% equipment
		
		if (usePassenger) {
			const availablePassengers = cardData.passenger.filter(p =>
				!scenario.some(s => s.originalId === p.id) &&
				!hasConflict(p, scenario)
			);
			
			if (availablePassengers.length > 0) {
				const passengerCard = randomPick(availablePassengers);
				const card: DrawnCard = {
					...passengerCard,
					type: 'passenger',
					originalId: passengerCard.id,
					id: `p-${passengerCard.id}-${Date.now()}`,
					timestamp: Date.now() + 2000
				};
				applyRandomOutcome(card);
				scenario.push(card);
			}
		} else {
			const availableEquipment = cardData.equipment.filter(e =>
				!scenario.some(s => s.originalId === e.id) &&
				!hasConflict(e, scenario)
			);
			
			if (availableEquipment.length > 0) {
				const equipmentCard = randomPick(availableEquipment);
				const card: DrawnCard = {
					...equipmentCard,
					type: 'equipment',
					originalId: equipmentCard.id,
					id: `q-${equipmentCard.id}-${Date.now()}`,
					timestamp: Date.now() + 2000
				};
				applyRandomOutcome(card);
				scenario.push(card);
			}
		}
	}
	
	// STEP 4: Fill remaining slots with synergy cards if available
	if (scenario.length < cardCount && primaryEmergency.synergies) {
		const remainingSlots = cardCount - scenario.length;
		const existingIds = scenario.map(s => s.originalId);
		
		// Get synergy cards (both passenger and equipment)
		const matchingPassengers = cardData.passenger.filter(p =>
			primaryEmergency.synergies!.includes(p.id) &&
			!existingIds.includes(p.id) &&
			!hasConflict(p, scenario)
		);
		
		const matchingEquipment = cardData.equipment.filter(e =>
			primaryEmergency.synergies!.includes(e.id) &&
			!existingIds.includes(e.id) &&
			!hasConflict(e, scenario)
		);
		
		// Prioritize equipment over passengers (70/30 split)
		const allSynergies = [
			...matchingEquipment.map(c => ({ ...c, type: 'equipment' as const, priority: 0.7 })),
			...matchingPassengers.map(c => ({ ...c, type: 'passenger' as const, priority: 0.3 }))
		];
		
		const shuffled = shuffleArray(allSynergies);
		const toAdd = Math.min(remainingSlots, shuffled.length);
		
		for (let i = 0; i < toAdd; i++) {
			const card = shuffled[i];
			const drawnCard: DrawnCard = {
				...card,
				originalId: card.id,
				id: `${card.type[0]}-${card.id}-${Date.now()}-${i}`,
				timestamp: Date.now() + 3000 + i
			};
			applyRandomOutcome(drawnCard);
			scenario.push(drawnCard);
		}
	}
	
	return scenario.sort((a, b) => a.timestamp - b.timestamp);
};

// ============================================
// MAIN COMPONENT
// ============================================

const MDAfaatGame = () => {
	// All hooks must be at the top (Rules of Hooks)
	const [gameMode, setGameMode] = useState<"formation" | "game">("formation");
	const [teamCount, setTeamCount] = useState<number>(0);
	const [sessionScenarios, setSessionScenarios] = useState<Set<number>>(new Set());
	const [showEditor, setShowEditor] = useState(false);

	// Database state
	const [baseCardData, setBaseCardData] = useState<CardData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Game state (must be declared before any returns)
	const [allDrawnCards, setAllDrawnCards] = useState<DrawnCard[]>([]);
	const [availableCards, setAvailableCards] = useState<CardData>({
		emergency: [],
		passenger: [],
		equipment: []
	});
	const [shuffling, setShuffling] = useState(false);
	const [dealingAnimation, setDealingAnimation] = useState(false);
	const [cardTypeFilter, setCardTypeFilter] = useState<
		"all" | "emergency" | "passenger" | "equipment"
	>("emergency");
	const [currentDealIndex, setCurrentDealIndex] = useState(0);

	// Fetch cards from database on mount
	useEffect(() => {
		async function loadCards() {
			try {
				const cards = await getAllCards();
				setBaseCardData(cards);
			} catch (err) {
				console.error("Failed to load cards:", err);
				setError("無法載入情境卡片");
			} finally {
				setLoading(false);
			}
		}
		loadCards();
	}, []);

	// Initialize availableCards when baseCardData loads
	useEffect(() => {
		if (baseCardData) {
			const cardData = enhanceAllCards(baseCardData);
			setAvailableCards(cardData);
		}
	}, [baseCardData]);

	// Show loading state
	if (loading) {
		return (
			<div style={{ 
				display: 'flex', 
				justifyContent: 'center', 
				alignItems: 'center', 
				height: '100vh',
				fontSize: '1.5rem',
				color: 'white'
			}}>
				載入中...
			</div>
		);
	}

	// Show error state
	if (error || !baseCardData) {
		return (
			<div style={{ 
				display: 'flex', 
				flexDirection: 'column',
				justifyContent: 'center', 
				alignItems: 'center', 
				height: '100vh',
				fontSize: '1.5rem',
				color: '#ff6b6b',
				gap: '1rem'
			}}>
				<div>❌ {error || "載入失敗"}</div>
				<button 
					onClick={() => window.location.reload()}
					style={{
						padding: '0.75rem 1.5rem',
						fontSize: '1rem',
						background: '#4a9eff',
						color: 'white',
						border: 'none',
						borderRadius: '0.5rem',
						cursor: 'pointer'
					}}
				>
					重新載入
				</button>
			</div>
		);
	}

	// Enhance with outcomes from scenarioData.ts
	const cardData = enhanceAllCards(baseCardData);

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

	// NEW: Smart scenario handler with session tracking
	const handleGenerateSmartScenario = async () => {
		setShuffling(true);
		setDealingAnimation(true);
		setAllDrawnCards([]);

		await new Promise((resolve) => setTimeout(resolve, 1500));
		setShuffling(false);

		const scenario = generateSmartScenario(
			cardData,
			sessionScenarios,
			teamCount,
			currentDealIndex,
			5
		);

		// Track which primary scenario was drawn
		if (scenario.length > 0 && scenario[0].type === 'emergency') {
			setSessionScenarios(prev => new Set([...prev, scenario[0].originalId]));
		}
		
		// Increment deal index for next deal
		setCurrentDealIndex(prev => prev + 1);

		for (let i = 0; i < scenario.length; i++) {
			await new Promise((resolve) => setTimeout(resolve, 600));
			setAllDrawnCards((prev) => [...prev, scenario[i]]);
		}

		setDealingAnimation(false);
	};

	const resetAll = () => {
		setAllDrawnCards([]);
		setAvailableCards(cardData);
		setShuffling(false);
		setDealingAnimation(false);
	};

	const resetSession = () => {
		// Clear session tracking when returning to team formation
		setSessionScenarios(new Set());
		setCurrentDealIndex(0);
		setAllDrawnCards([]);
	};

	const removeCard = (cardId: string) => {
		setAllDrawnCards((prev) => prev.filter((card) => card.id !== cardId));
	};

	const PlayingCard: React.FC<PlayingCardProps> = ({
		card,
		onRemove,
		isInDeck = false,
	}) => {
		if (isInDeck) {
			return (
				<div className={`${styles.card} ${styles.deckCard}`}>
					<div className={styles.deckContent}>
						<Image
							src="/images/deckback.png"
							alt="MDAfaat"
							width={256}
							height={344}
							className={styles.deckLogo}
						/>
					</div>
				</div>
			);
		}

		const getCardColor = (type?: string) => {
			switch (type) {
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

		return (
			<div className={`${styles.card} ${styles.playingCard} ${getCardColor(card.type)}`}>
				{onRemove && (
					<button
						onClick={() => onRemove(card.id!)}
						className={styles.removeButton}
						aria-label="移除卡片"
					>
						×
					</button>
				)}
				
				<div className={styles.cardHeader}>
					<div className={styles.cardCode}>{card.code}</div>
				</div>

				<div className={styles.cardContent}>
					<h3 className={styles.cardTitle}>{card.title}</h3>
					<p className={styles.cardDescription}>
						{card.description?.split('\n').map((line, i) => (
							<React.Fragment key={i}>
								{line}
								{i < card.description!.split('\n').length - 1 && <br />}
							</React.Fragment>
						))}
					</p>
					
					{/* Outcome display */}
					{card.selectedOutcome && (
						<div className={styles.cardOutcome}>
							<div className={styles.outcomeText}>
								結果: {card.selectedOutcome.description}
							</div>
							{card.selectedOutcome.action && (
								<div className={styles.actionBadge}>
									⚠️ 行動: {card.selectedOutcome.action}
								</div>
							)}
							{card.selectedOutcome.duration && (
								<div className={styles.durationBadge}>
									⏱ 持續: {card.selectedOutcome.duration}
								</div>
							)}
						</div>
					)}
				</div>

				<div className={styles.cardFooter}>
					<div className={styles.cardCodeFooter}>{card.code}</div>
				</div>
			</div>
		);
	};

	if (gameMode === "formation") {
		return (
			<div className={styles.container}>
				<TeamFormation 
					onStartGame={(count: number) => {
						setTeamCount(count);
						setGameMode("game");
					}}
					onOpenEditor={() => setShowEditor(true)}
				/>
				{showEditor && (
					<ScenarioEditor 
						onClose={() => setShowEditor(false)}
						initialData={baseCardData}
					/>
				)}
			</div>
		);
	}

	return (
		<div className={`${styles.container} ${shuffling ? styles.shuffling : ''}`}>
			<div className={styles.gameContainer}>
				<div className={styles.header}>
					<h1 className={styles.title}>情境演練 Scenario Training</h1>
					<button 
						onClick={() => setShowEditor(true)}
						className={styles.editorButton}
						title="編輯情境卡片"
					>
						<FiEdit size={18} />
						編輯情境
					</button>
				</div>

				<div className={styles.controls}>
					<div className={styles.leftControls}>
						<button
							onClick={() => {
								setGameMode("formation");
								resetSession();
							}}
							className={`${styles.actionButton} ${styles.backButton}`}
						>
							<ArrowLeft className={styles.buttonIcon} />
							返回分組
						</button>

						{/* Smart scenario button - renamed to 發牌 */}
						<button
							className={`${styles.actionButton} ${styles.dealButton}`}
							onClick={handleGenerateSmartScenario}
							disabled={shuffling || dealingAnimation}
						>
							<Shuffle className={styles.buttonIcon} />
							發牌
						</button>

						<button
							className={`${styles.actionButton} ${styles.addButton}`}
							onClick={drawRandomCard}
							disabled={shuffling || dealingAnimation}
						>
							<Plus className={styles.buttonIcon} />
							抽卡
						</button>

						<button
							className={`${styles.actionButton} ${styles.resetButton}`}
							onClick={resetAll}
							disabled={shuffling || dealingAnimation}
						>
							<RotateCcw className={styles.buttonIcon} />
							重置
						</button>
					</div>

					<div className={styles.filterControls}>
						<span className={styles.filterLabel}>篩選：</span>
						<div className={styles.cardTypeSelector}>
							<button
								className={`${styles.filterButton} ${cardTypeFilter === "all" ? styles.filterActive : ""} ${styles.filterAll}`}
								onClick={() => setCardTypeFilter("all")}
								title="全部"
							>
								全部
							</button>
							<button
								className={`${styles.filterButton} ${cardTypeFilter === "emergency" ? styles.filterActive : ""} ${styles.filterEmergency}`}
								onClick={() => setCardTypeFilter("emergency")}
								title="緊急狀況"
							>
								<PiSirenFill size={20} />
							</button>
							<button
								className={`${styles.filterButton} ${cardTypeFilter === "passenger" ? styles.filterActive : ""} ${styles.filterPassenger}`}
								onClick={() => setCardTypeFilter("passenger")}
								title="旅客狀況"
							>
								<FaPersonWalkingLuggage size={18} />
							</button>
							<button
								className={`${styles.filterButton} ${cardTypeFilter === "equipment" ? styles.filterActive : ""} ${styles.filterEquipment}`}
								onClick={() => setCardTypeFilter("equipment")}
								title="設備/環境"
							>
								<FaTools size={18} />
							</button>
						</div>
					</div>

					{allDrawnCards.length > 0 && (
						<div className={styles.cardCounts}>
							<div className={`${styles.countBadge} ${styles.emergencyBadge}`}>
								<span className={styles.countIcon}><PiSirenFill size={20} /></span>
								<span className={styles.countNumber}>
									{10 - allDrawnCards.filter((card) => card.type === "emergency").length}
								</span>
							</div>
							<div className={`${styles.countBadge} ${styles.passengerBadge}`}>
								<span className={styles.countIcon}><FaPersonWalkingLuggage size={18} /></span>
								<span className={styles.countNumber}>
									{10 - allDrawnCards.filter((card) => card.type === "passenger").length}
								</span>
							</div>
							<div className={`${styles.countBadge} ${styles.equipmentBadge}`}>
								<span className={styles.countIcon}><FaTools size={18} /></span>
								<span className={styles.countNumber}>
									{10 - allDrawnCards.filter((card) => card.type === "equipment").length}
								</span>
							</div>
						</div>
					)}
				</div>

				<div className={`${styles.gameArea} ${shuffling ? styles.gameAreaShuffling : ''}`}>
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

			{/* Scenario Editor Modal */}
			{showEditor && (
				<ScenarioEditor 
					onClose={() => setShowEditor(false)}
					initialData={baseCardData}
				/>
			)}
		</div>
	);
};

export default MDAfaatGame;