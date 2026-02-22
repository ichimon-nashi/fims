// src/components/mdafaat/MDAfaatGame.tsx
// Branching scenario game with shuffle animation, card flipping, and side effects
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Shuffle, Zap, ArrowRight, Sparkles, ChevronDown, ChevronUp, CornerUpLeft } from "lucide-react";
import { FaDoorClosed, FaWheelchair, FaBaby } from "react-icons/fa";
import { FaLocationDot, FaPeopleGroup } from "react-icons/fa6";
import { IoMdSunny } from "react-icons/io";
import { IoPartlySunny, IoCloudyNight } from "react-icons/io5";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import styles from "./MDAfaatGame.module.css";

// Extend Window for html2canvas
declare global {
	interface Window {
		html2canvas?: any;
	}
}

// Types
interface SideEffect {
	type: 'specific' | 'random_category';
	card_id?: number | null;
	category?: string | null;
	trigger_rate: number; // 0-100
}

interface Outcome {
	id: string;
	description: string;
	probability: number;
	next_card_id: number;
	
	// OLD (keep for backward compatibility)
	side_effect_card_id?: number | null;
	
	// NEW (multiple side effects with percentages)
	side_effects?: SideEffect[];
}

interface MdafaatCard {
	id: number;
	card_type: "emergency" | "passenger" | "equipment" | "door" | "position";
	code: string;
	title: string;
	description: string;
	is_shiny: boolean;
	category?: string | null; // NEW: for random selection
	can_be_initial?: boolean;
	conflicts?: number[];
	outcomes: Outcome[];
}

interface CardHistory {
	card: MdafaatCard;
	outcome: Outcome;
	sideCard?: MdafaatCard;
	sideOutcome?: Outcome;
	sideEffectOutcome?: Outcome;
	doorCard?: MdafaatCard;
	positionCard?: MdafaatCard;
}

interface Props {
	teams: Array<{
		name: string;
		members: Array<{
			userId: string;
			name: string;
			employeeId: string;
			rank: string;
			avatarUrl?: string;
		}>;
	}>;
	onBack: () => void;
}

const MDAfaatGame: React.FC<Props> = ({ teams, onBack }) => {
	// Data
	const [allCards, setAllCards] = useState<MdafaatCard[]>([]);
	const [loading, setLoading] = useState(true);

	// Game state
	const [currentTeam, setCurrentTeam] = useState(0);
	const [currentMember, setCurrentMember] = useState(0);
	const [gameStarted, setGameStarted] = useState(false);
	const [shuffling, setShuffling] = useState(false);
	const [instructorName, setInstructorName] = useState<string>("");

	// Get instructor name - simplified approach
	useEffect(() => {
		// Check if NavigationDrawer sets window.currentUser
		const checkUser = () => {
			if ((window as any).currentUser?.full_name) {
				setInstructorName((window as any).currentUser.full_name);
				return true;
			}
			return false;
		};
		
		// Try immediately
		if (!checkUser()) {
			// Try after delays
			setTimeout(checkUser, 500);
			setTimeout(checkUser, 1000);
			setTimeout(checkUser, 2000);
		}
	}, []);

	// Helper function to get time icon
	const getTimeIcon = (time: string) => {
		if (time === "morning") return <IoMdSunny style={{ color: '#fbbf24' }} />;
		if (time === "midday") return <IoPartlySunny style={{ color: '#f59e0b' }} />;
		return <IoCloudyNight style={{ color: '#818cf8' }} />;
	};

	// Helper function to get time text
	const getTimeText = (time: string) => {
		if (time === "morning") return "早上";
		if (time === "midday") return "中午";
		return "晚上";
	};

	// Conditions
	const [conditions, setConditions] = useState<any>(null);

	// Current cards
	const [currentCard, setCurrentCard] = useState<MdafaatCard | null>(null);
	const [sideCard, setSideCard] = useState<MdafaatCard | null>(null);
	const [doorCard, setDoorCard] = useState<MdafaatCard | null>(null);
	const [positionCard, setPositionCard] = useState<MdafaatCard | null>(null);

	// Selections
	const [selectedMain, setSelectedMain] = useState<Outcome | null>(null);
	const [selectedSide, setSelectedSide] = useState<Outcome | null>(null);

	// History
	const [history, setHistory] = useState<CardHistory[]>([]);
	const [showHistory, setShowHistory] = useState(false);

	// Complete
	const [complete, setComplete] = useState(false);

	// Stopwatch
	const [elapsedTime, setElapsedTime] = useState(0);
	const [timerRunning, setTimerRunning] = useState(false);
	const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

	// Computed values
	const team = teams[currentTeam];
	const member = team?.members[currentMember];
	const hasNextTeam = currentTeam < teams.length - 1;

	// Get available categories from all cards
	const availableCategories = useMemo(() => {
		const cats = new Set<string>();
		allCards.forEach(c => {
			// Exclude RANDOM categories (they're only for outcomes/side effects)
			if (c.category && !c.category.toUpperCase().includes('RANDOM')) {
				cats.add(c.category);
			}
		});
		return Array.from(cats).sort();
	}, [allCards]);

	// Extract all categories for dynamic ID mapping (10000+)
	// This must match the ScenarioEditor's allCategories extraction
	const allRandomCategories = useMemo(() => {
		const cats = new Set<string>();
		allCards.forEach(c => {
			if (c.category) { // Get ALL categories
				cats.add(c.category);
			}
		});
		return Array.from(cats).sort();
	}, [allCards]);

	// Helper to get rank order (lower number = more senior)
	const getRankOrder = (rank: string): number => {
		if (!rank) return 999;
		const r = rank.toLowerCase();
		if (r.includes("mg") && r.includes("manager")) return 1;
		if (r.includes("sc") && r.includes("section")) return 2;
		if (r.includes("fi") && r.includes("instructor")) return 3;
		if (r.includes("pr") && r.includes("purser")) return 4;
		if (r.includes("lf") && r.includes("leading")) return 5;
		if (r.includes("fs") && r.includes("stewardess")) return 6;
		if (r.includes("fa") && r.includes("attendant") && !r.includes("leading")) return 6;
		return 999;
	};

	// Helper to get card suit
	const getSuit = (cardType: string): string => {
		switch(cardType) {
			case 'emergency': return '♠';
			case 'passenger': return '♥';
			case 'equipment': return '♦';
			default: return '♣';
		}
	};

	// Helper to get suit color
	const getSuitColor = (cardType: string): string => {
		return ['passenger', 'equipment'].includes(cardType) ? '#dc2626' : '#1e293b';
	};

	// Load cards
	useEffect(() => {
		const load = async () => {
			try {
				const token = localStorage.getItem("token");
				const res = await fetch("/api/mdafaat/cards", {
					headers: { Authorization: `Bearer ${token}` },
				});
				const data = await res.json();
				setAllCards([
					...data.emergency, 
					...data.passenger, 
					...data.equipment,
					...(data.door || []),
					...(data.position || [])
				]);
				setLoading(false);
			} catch (err) {
				console.error(err);
				setLoading(false);
			}
		};
		load();
	}, []);

	// Stopwatch effect
	useEffect(() => {
		if (timerRunning) {
			const interval = setInterval(() => {
				setElapsedTime(prev => prev + 1);
			}, 1000);
			setTimerInterval(interval);
			return () => clearInterval(interval);
		} else if (timerInterval) {
			clearInterval(timerInterval);
			setTimerInterval(null);
		}
	}, [timerRunning]);

	// Shuffle
	const handleShuffle = async () => {
		setShuffling(true);
		
		// Random conditions
		const cond = {
			time: ["morning", "midday", "night"][Math.floor(Math.random() * 3)] as any,
			full: Math.random() > 0.5,
			infants: Math.random() > 0.75,
			disabled: Math.random() > 0.75,
		};
		setConditions(cond);

		// Trigger CSS shuffle animation (3 iterations, 1000ms total - balanced speed)
		const shuffleContainer = document.querySelector(`.${styles.shuffleAnimation}`);
		if (shuffleContainer) {
			shuffleContainer.classList.add(styles.shuffling);
		}

		// Wait for shuffle animation to complete
		// Timing: last card delay (9 * 10 = 90ms) + animation duration (1000ms) = ~1100ms
		await new Promise(r => setTimeout(r, 1150));

		// Remove shuffle class
		if (shuffleContainer) {
			shuffleContainer.classList.remove(styles.shuffling);
		}

		// Deal initial card: prioritize cards marked as can_be_initial
		const initialCards = allCards.filter(c => c.can_be_initial);
		const first = initialCards.length > 0
			? initialCards[Math.floor(Math.random() * initialCards.length)]
			: allCards[Math.floor(Math.random() * allCards.length)];

		// Start stopwatch after first card is dealt
		setElapsedTime(0);
		setTimerRunning(true);

		// Flip delay
		await new Promise(r => setTimeout(r, 300));
		
		setCurrentCard(first);
		setGameStarted(true);
		setShuffling(false);
	};

	// Process side effects with percentage triggers
	const processSideEffects = (outcome: Outcome): MdafaatCard[] => {
		const triggeredSideEffects: MdafaatCard[] = [];
		
		console.log('=== PROCESSING SIDE EFFECTS ===');
		
		// Handle old format (backward compatibility)
		if (outcome.side_effect_card_id) {
			const card = allCards.find(c => c.id === outcome.side_effect_card_id);
			if (card) {
				console.log('Legacy side effect (100%):', card.code);
				triggeredSideEffects.push(card);
			}
		}
		
		// Handle new format (multiple side effects with percentages)
		if (outcome.side_effects && outcome.side_effects.length > 0) {
			outcome.side_effects.forEach((sideEffect, idx) => {
				// Roll for trigger
				const roll = Math.random() * 100;
				console.log(`Side effect #${idx + 1}: Rolling ${roll.toFixed(1)}% vs ${sideEffect.trigger_rate}%`);
				
				if (roll < sideEffect.trigger_rate) {
					if (sideEffect.type === 'specific' && sideEffect.card_id) {
						// Specific card
						const card = allCards.find(c => c.id === sideEffect.card_id);
						if (card) {
							console.log(`✅ Triggered specific: ${card.code} - ${card.title}`);
							triggeredSideEffects.push(card);
						}
					} else if (sideEffect.type === 'random_category' && sideEffect.category) {
						// Random from category
						const categoryCards = allCards.filter(c => c.category === sideEffect.category);
						if (categoryCards.length > 0) {
							const random = categoryCards[Math.floor(Math.random() * categoryCards.length)];
							console.log(`✅ Triggered random ${sideEffect.category}: ${random.code} - ${random.title}`);
							triggeredSideEffects.push(random);
						}
					}
				} else {
					console.log(`❌ Not triggered (needed <${sideEffect.trigger_rate}%)`);
				}
			});
		}
		
		console.log(`Total side effects triggered: ${triggeredSideEffects.length}`);
		return triggeredSideEffects;
	};

	// Select outcome
	const selectOutcome = (outcome: Outcome, isSide: boolean = false) => {
		if (isSide) {
			setSelectedSide(outcome);
			// Don't auto-progress - wait for user to confirm
		} else {
			setSelectedMain(outcome);
			
			// Process all side effects (old and new format)
			const sideEffectCards = processSideEffects(outcome);
			
			// For now, show first triggered side effect (can be extended to show multiple)
			if (sideEffectCards.length > 0) {
				setSideCard(sideEffectCards[0]);
				console.log(`Setting side effect card: ${sideEffectCards[0].code}`);
				if (sideEffectCards.length > 1) {
					console.log(`⚠️ Note: ${sideEffectCards.length} side effects triggered, showing first one`);
				}
			}
			
			const willHaveSideEffect = sideEffectCards.length > 0 || !!sideCard;
			
			if (willHaveSideEffect) {
				// Side effect exists, wait for both selections
				console.log('Side effect present, waiting for both selections');
			} else {
				// No side effect at all, can progress immediately
				console.log('No side effect, progressing immediately');
				proceedNext(outcome, null);
			}
		}
	};
	
	// Add confirm function for when both are selected
	const confirmBothSelections = () => {
		if (selectedMain && selectedSide) {
			proceedNext(selectedMain, selectedSide);
		}
	};

	// Random
	const randomMain = () => {
		if (!currentCard) return;
		const outcomes = addAutoSuccess(currentCard);
		const roll = Math.random() * 100;
		let sum = 0;
		for (const o of outcomes) {
			sum += o.probability;
			if (roll < sum) {
				selectOutcome(o);
				return;
			}
		}
	};

	const randomSide = () => {
		if (!sideCard) return;
		const outcomes = addAutoSuccess(sideCard);
		const roll = Math.random() * 100;
		let sum = 0;
		for (const o of outcomes) {
			sum += o.probability;
			if (roll < sum) {
				selectOutcome(o, true);
				return;
			}
		}
	};

	// Random card from category with conflict checking
	const selectRandomFromCategory = (category: string) => {
		console.log(`Selecting random card from category: ${category}`);
		
		// Get all cards in this category
		const categoryCards = allCards.filter(c => 
			c.category === category && 
			c.id !== currentCard?.id // Not current card
		);
		
		console.log(`Found ${categoryCards.length} cards in ${category} category`);
		
		// Filter out conflicting cards
		const nonConflictingCards = categoryCards.filter(card => {
			// Check if this card conflicts with cards in history
			const conflictIds = card.conflicts || [];
			const historyCardIds = history.map(h => h.card.id);
			const hasConflict = conflictIds.some(id => historyCardIds.includes(id));
			return !hasConflict;
		});
		
		console.log(`${nonConflictingCards.length} cards available after conflict checking`);
		
		if (nonConflictingCards.length === 0) {
			alert(`沒有可用的 ${category} 卡片！\nNo available ${category} cards without conflicts!`);
			return;
		}
		
		// Random selection
		const randomCard = nonConflictingCards[
			Math.floor(Math.random() * nonConflictingCards.length)
		];
		
		console.log(`Random ${category} card selected:`, randomCard.code, randomCard.title);
		
		// Create a synthetic outcome that leads to this card
		const syntheticOutcome: Outcome = {
			id: `random_${category}_${Date.now()}`,
			description: `🎲 RANDOM ${category.toUpperCase()} → ${randomCard.code}`,
			probability: 0,
			next_card_id: randomCard.id,
		};
		
		selectOutcome(syntheticOutcome);
	};

	// Generate random DOOR card
	const generateDoorCard = () => {
		const doorCards = allCards.filter(c => c.card_type === 'door');
		if (doorCards.length === 0) {
			alert('資料庫中沒有 DOOR 卡片！\nNo DOOR cards in database!');
			return;
		}
		
		const random = doorCards[Math.floor(Math.random() * doorCards.length)];
		setDoorCard(random);
		console.log('DOOR card generated:', random.code, random.title);
	};

	// Generate random POSITION card
	const generatePositionCard = () => {
		const positionCards = allCards.filter(c => c.card_type === 'position');
		if (positionCards.length === 0) {
			alert('資料庫中沒有 POSITION 卡片！\nNo POSITION cards in database!');
			return;
		}
		
		const random = positionCards[Math.floor(Math.random() * positionCards.length)];
		setPositionCard(random);
		console.log('POSITION card generated:', random.code, random.title);
	};

	// Add auto success
	const addAutoSuccess = (card: MdafaatCard): Outcome[] => {
		const total = card.outcomes.reduce((s, o) => s + o.probability, 0);
		if (total >= 100) return card.outcomes;
		
		const endId = card.card_type === "emergency" ? 99 : card.card_type === "passenger" ? 199 : 299;
		return [
			...card.outcomes,
			{
				id: "auto",
				description: "情況順利解決",
				probability: 100 - total,
				next_card_id: endId,
			},
		];
	};

	// Proceed
	const proceedNext = async (main: Outcome, side: Outcome | null) => {
		if (!currentCard) return;

		console.log('=== PROCEED NEXT DEBUG ===');
		console.log('Current card:', currentCard.code, currentCard.title);
		console.log('Main outcome:', main.description, 'next_card_id:', main.next_card_id);
		console.log('Side outcome:', side?.description || 'none', 'next_card_id:', side?.next_card_id);
		console.log('Side card:', sideCard?.code || 'none');

		// Save to history
		setHistory(prev => [...prev, {
			card: currentCard,
			outcome: main,
			sideCard: sideCard || undefined,
			sideOutcome: side || undefined,
			doorCard: doorCard || undefined,
			positionCard: positionCard || undefined,
		}]);

		// If there's a side effect, first show its resolution
		if (side && side.next_card_id) {
			const sideResolution = allCards.find(c => c.id === side.next_card_id);
			console.log('Side effect resolution card:', sideResolution?.code);
			
			if (sideResolution) {
				// Add side effect resolution to history
				setHistory(prev => [...prev, {
					card: sideCard!,
					outcome: side,
					sideCard: undefined,
					sideOutcome: undefined,
				}]);
			}
		}

		// Now proceed to main path
		let next: MdafaatCard | undefined;
		
		// Check if next_card_id is a RANDOM category (ID >= 10000)
		if (main.next_card_id >= 10000) {
			const categoryIndex = main.next_card_id - 10000;
			const category = allRandomCategories[categoryIndex];
			
			if (!category) {
				console.log('ERROR: Invalid RANDOM category ID:', main.next_card_id);
				console.log('Available categories:', allRandomCategories);
				console.log('Category index:', categoryIndex);
				return;
			}
			
			console.log('=== RANDOM CATEGORY SELECTION ===');
			console.log('Requested category:', category, '(ID:', main.next_card_id, ')');
			console.log('All categories in game:', allRandomCategories);
			
			// Get all cards from this category (case-insensitive match)
			const categoryCards = allCards.filter(c => 
				c.category && c.category.toLowerCase() === category.toLowerCase()
			);
			console.log(`Found ${categoryCards.length} cards in ${category} category`);
			
			if (categoryCards.length === 0) {
				console.log('ERROR: No cards found with category:', category);
				console.log('Sample cards:', allCards.slice(0, 5).map(c => ({ code: c.code, category: c.category })));
				alert(`找不到 ${category} 類別的卡片！\nNo cards found in ${category} category!`);
				return;
			}
			
			// Filter out conflicting cards (only check against current card)
			const currentCardId = currentCard?.id;
			const nonConflictingCards = categoryCards.filter(card => {
				const conflictIds = card.conflicts || [];
				// Check if the card to be drawn conflicts with the current card
				const hasConflict = currentCardId && conflictIds.includes(currentCardId);
				return !hasConflict;
			});
			
			console.log(`${nonConflictingCards.length} cards available after conflict filtering (vs current card)`);
			
			if (nonConflictingCards.length > 0) {
				// Pick a random card from the non-conflicting cards
				next = nonConflictingCards[Math.floor(Math.random() * nonConflictingCards.length)];
				console.log('✅ Randomly selected (after conflict filter):', next.code, 'from category:', category);
			} else {
				console.log('ERROR: No non-conflicting cards found in category:', category);
				alert(`沒有可用的 ${category} 卡片！\nNo available ${category} cards without conflicts!`);
				return;
			}
		} else {
			// Normal card lookup by ID
			next = allCards.find(c => c.id === main.next_card_id);
		}
		
		console.log('Main path next card:', next?.code, next?.title);
		
		if (!next) {
			console.log('ERROR: No next card found for id:', main.next_card_id);
			return;
		}

		await new Promise(r => setTimeout(r, 300));

		if (next.outcomes.length === 0) {
			console.log('Next card is END card');
			setCurrentCard(next);
			setComplete(true);
			setTimerRunning(false); // Stop stopwatch
			return;
		}

		console.log('Setting current card to:', next.code);
		setCurrentCard(next);
		setSideCard(null);
		setDoorCard(null);
		setPositionCard(null);
		setSelectedMain(null);
		setSelectedSide(null);
	};

	// Next player
	const nextPlayer = () => {
		// Move to next group (not next member within group)
		if (hasNextTeam) {
			setCurrentTeam(prev => prev + 1);
			setCurrentMember(0);
			reset();
		} else {
			// All groups done
			alert("所有組別已完成訓練！All groups completed!");
			onBack();
		}
	};

	const reset = () => {
		setHistory([]);
		setCurrentCard(null);
		setSideCard(null);
		setSelectedMain(null);
		setSelectedSide(null);
		setComplete(false);
		setGameStarted(false);
		setConditions(null);
		setElapsedTime(0);
		setTimerRunning(false);
	};

	// Render
	if (loading) return (
		<div className={styles.container}>
			<div className={styles.loadingState}>
				<Image
					src="/K-dogmatic.png"
					alt="Loading"
					width={150}
					height={150}
					className={styles.loadingImage}
					priority
				/>
				<div>載入中...</div>
			</div>
		</div>
	);
	
	// Safety check for teams
	if (!teams || teams.length === 0) {
		return (
			<div className={styles.container}>
				<div className={styles.loading}>沒有可用的團隊</div>
				<button onClick={onBack} className={styles.shuffleBtn}>
					返回
				</button>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			{/* Header */}
			<div className={styles.header}>
				<h1 className={styles.title}>客艙組員情境演練</h1>
				<button onClick={onBack} className={styles.closeBtn}>
					<CornerUpLeft />
				</button>
			</div>

		{/* Conditions Bar */}
		{conditions && (
			<>
				{/* Row 1: Stopwatch */}
				<div className={styles.stopwatchBar}>
					<span style={{ color: '#4ade80', fontWeight: 700, fontSize: '1.25rem' }}>
						⏱️ {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
					</span>
				</div>

				{/* Row 2: Initial Conditions + Team (Desktop), stacked on mobile */}
				<div className={styles.conditionsTeamRow}>
					<div className={styles.conditionsGroup}>
						<span>{getTimeIcon(conditions.time)} {getTimeText(conditions.time)}</span>
						<span><FaPeopleGroup style={{ color: '#60a5fa' }} /> 客滿: {conditions.full ? "YES" : "NO"}</span>
						<span><FaBaby style={{ color: '#fb923c' }} /> 嬰兒: {conditions.infants ? "YES" : "NO"}</span>
						<span><FaWheelchair style={{ color: '#a78bfa' }} /> 身心障礙旅客: {conditions.disabled ? "YES" : "NO"}</span>
					</div>

					{team && (
						<div className={styles.teamGroup}>
							<span className={styles.teamLabel}>Team {team.name}:</span>
							<div className={styles.membersList}>
								{[...team.members]
									.sort((a, b) => {
										const rankDiff = getRankOrder(a.rank) - getRankOrder(b.rank);
										if (rankDiff !== 0) return rankDiff;
										return parseInt(a.employeeId) - parseInt(b.employeeId);
									})
									.map((m, idx) => (
										<div 
											key={m.userId} 
											className={`${styles.teamMember} ${idx === 0 ? styles.teamLeader : ''}`}
										>
											{m.avatarUrl && (
												<div style={{ position: 'relative', width: '1.75rem', height: '1.75rem' }}>
													<Image src={m.avatarUrl} alt={m.name} fill className={styles.memberAvatar} />
												</div>
											)}
											<span className={styles.memberName}>{m.name}</span>
										</div>
									))}
							</div>
						</div>
					)}
				</div>

				{/* Row 3: DOOR and POSITION buttons */}
				<div className={styles.buttonsRow}>
					<button 
						onClick={generateDoorCard}
						className={styles.specialCardBtn}
						disabled={!!doorCard}
						title="Generate random DOOR card"
					>
						<FaDoorClosed size={16} /> DOOR
					</button>
					
					<button 
						onClick={generatePositionCard}
						className={styles.specialCardBtn}
						disabled={!!positionCard}
						title="Generate random POSITION card"
					>
						<FaLocationDot size={16} /> POSITION
					</button>
				</div>
			</>
		)}

			{/* History Breadcrumb */}
			{history.length > 0 && (
				<div className={styles.breadcrumb}>
					<button onClick={() => setShowHistory(!showHistory)} className={styles.breadcrumbToggle}>
						{showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
						Path ({history.length} cards)
					</button>
					{showHistory && (
						<div className={styles.breadcrumbList}>
							{history.map((h, i) => (
								<div key={i} className={styles.breadcrumbItem}>
									{h.card.code}: {h.outcome.description.substring(0, 30)}...
									{h.sideCard && ` + ${h.sideCard.code}`}
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Main Content */}
			<div className={styles.gameArea}>
				{!gameStarted ? (
					<div className={styles.startScreen}>
						<div className={styles.deckContainer}>
							{shuffling ? (
								// Pure CSS animation matching deck-of-cards
								<>
									{[...Array(10)].map((_, i) => {
										const z = i / 4;
										const delay = i * 10; // Slower stagger: 10ms instead of 2ms
										const plusMinus = Math.round(Math.random()) ? -1 : 1;
										// Much larger spread: 200-350px
										const randomOffset = plusMinus * (Math.random() * 150 + 200);
										
										return (
											<div
												key={i}
												className={`${styles.cardBack} ${styles.shuffleCard}`}
												style={{
													position: 'absolute',
													zIndex: i,
													animationDelay: `${delay}ms`,
													// CSS variables for animation
													['--random-x' as any]: `${randomOffset}px`,
													['--z' as any]: `${-z}px`,
													['--init-y' as any]: `${-i * 2}px`,
												}}
											>
												<Image 
													src="/images/deckback.png" 
													alt="Card" 
													fill
													sizes="320px"
													className={styles.cardBackImage}
													onError={(e) => {
														const target = e.currentTarget as HTMLElement;
														target.style.display = 'none';
													}}
												/>
												{i === 0 && (
													<div className={styles.cardBackInner}>
														MDAfaat
													</div>
												)}
											</div>
										);
									})}
								</>
							) : (
								<div className={styles.cardBack}>
									<Image 
										src="/images/deckback.png" 
										alt="Card Back" 
										fill
										sizes="320px"
										className={styles.cardBackImage}
										onError={() => {
											const fallback = document.getElementById('card-back-fallback');
											if (fallback) fallback.style.display = 'flex';
										}}
									/>
									<div id="card-back-fallback" className={styles.cardBackInner} style={{ display: 'none' }}>
										MDAfaat
									</div>
								</div>
							)}
						</div>
						<button 
							onClick={handleShuffle} 
							disabled={shuffling}
							className={styles.shuffleBtn}
						>
							<Shuffle className={shuffling ? styles.spinning : ""} />
							{shuffling ? "Shuffling..." : "Shuffle Cards"}
						</button>
					</div>
				) : complete ? (
					<div className={styles.completeScreen}>
						<div className={`${styles.card} ${styles.cardEnd}`}>
							{/* Top Left: Code */}
							<div className={styles.cardCornerTopLeft}>
								<span className={styles.cardCode}>{currentCard?.code}</span>
							</div>
							
							{/* Top Right: Suit */}
							<div className={styles.cardCornerTopRight}>
								<span className={styles.cardSuit} style={{ color: '#1e293b' }}>♣</span>
							</div>
							
							{/* Center */}
							<div className={styles.cardCenter}>
								<h2 style={{ margin: '0 0 0.5rem 0' }}>{currentCard?.title}</h2>
								<p style={{ margin: 0 }}>{currentCard?.description}</p>
							</div>
							
							{/* Bottom Left: Suit */}
							<div className={styles.cardCornerBottomLeft}>
								<span className={styles.cardSuit} style={{ color: '#1e293b' }}>♣</span>
							</div>
							
							{/* Bottom Right: Code */}
							<div className={styles.cardCornerBottomRight}>
								<span className={styles.cardCode}>
									{currentCard?.code}
								</span>
							</div>
						</div>

						<div className={styles.completeActions}>
							<h3>Congratulations! 演練完成!</h3>
							{hasNextTeam ? (
								<button onClick={nextPlayer} className={styles.nextBtn}>
									<ArrowRight />
									下一組
								</button>
							) : (
								<button onClick={onBack} className={styles.nextBtn}>
									回到分組
								</button>
							)}
						</div>

						{/* Export breadcrumb */}
						<div className={styles.exportSection} id="training-record">
							<h4>演練紀錄</h4>
							<div className={styles.recordText}>
								<div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#60a5fa' }}>
									{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
								</div>
								<div style={{ fontSize: '0.95rem', lineHeight: '1.8' }}>
									<strong>Team:</strong> {team.name}<br />
									<strong>Crew Members:</strong><br />
									{team.members.map((m, idx) => (
										<span key={m.userId}>
											• {m.employeeId} {m.name}{idx === 0 ? ' (Leader)' : ''}<br />
										</span>
									))}
									<br />
									<strong>Initial Conditions:</strong><br />
											• {getTimeIcon(conditions.time)} {getTimeText(conditions.time)}<br />
											• <FaPeopleGroup style={{ color: '#60a5fa' }} /> 客滿: {conditions.full ? "YES" : "NO"}<br />
											• <FaBaby style={{ color: '#fb923c' }} /> 嬰兒: {conditions.infants ? "YES" : "NO"}<br />
											• <FaWheelchair style={{ color: '#a78bfa' }} /> 身心障礙旅客: {conditions.disabled ? "YES" : "NO"}<br />
									<br />
									<strong>演練流程:</strong><br />
									{history.map((h, i) => (
										<div key={i} style={{ marginLeft: '1rem', marginBottom: '0.25rem' }}>
											{i + 1}. <strong>{h.card.code}</strong>: {h.card.title}<br />
											{h.doorCard && (
												<span style={{ marginLeft: '1.5rem', color: '#a855f7' }}>
													🚪 Door: {h.doorCard.code} - {h.doorCard.title}
												</span>
											)}<br />
											{h.positionCard && (
												<span style={{ marginLeft: '1.5rem', color: '#ec4899' }}>
													📍 Position: {h.positionCard.code} - {h.positionCard.title}
												</span>
											)}<br />
											<span style={{ marginLeft: '1.5rem', color: '#94a3b8' }}>
												→ {h.outcome.description} ({h.outcome.probability}%)
											</span><br />
											{h.sideCard && (
												<span style={{ marginLeft: '1.5rem', color: '#a78bfa' }}>
													+ Side Effect: {h.sideCard.code} - {h.sideEffectOutcome?.description}
												</span>
											)}
										</div>
									))}
									<br />
									<strong>Instructor:</strong> {instructorName}
								</div>
							</div>
							<div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center'}}>
								<button 
									className={styles.exportBtn}
									onClick={() => {
										const record = `Training Record - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\nTeam: ${team.name}\n\nCrew Members:\n${team.members.map((m, idx) => `• ${m.employeeId} ${m.name}${idx === 0 ? ' (Leader)' : ''}`).join('\n')}\n\nInitial Conditions:\n• Time: ${conditions.time}\n• Full Flight: ${conditions.full ? 'Yes' : 'No'}\n• Infants: ${conditions.infants ? 'Yes' : 'No'}\n• Disabled: ${conditions.disabled ? 'Yes' : 'No'}\n\nScenario Path:\n${history.map((h, i) => `${i + 1}. ${h.card.code}: ${h.card.title}${h.doorCard ? `\n   🚪 Door: ${h.doorCard.code} - ${h.doorCard.title}` : ''}${h.positionCard ? `\n   📍 Position: ${h.positionCard.code} - ${h.positionCard.title}` : ''}\n   → ${h.outcome.description} (${h.outcome.probability}%)${h.sideCard ? `\n   + Side Effect: ${h.sideCard.code} - ${h.sideEffectOutcome?.description}` : ''}`).join('\n')}\n\nInstructor: ${instructorName}`;
										
										navigator.clipboard.writeText(record).then(() => {
											alert("✅ 複製成功!");
										}).catch(() => {
											alert("❌ 複製失敗");
										});
									}}
								>
									📋 複製文字
								</button>
								<button 
									className={styles.exportBtn}
									onClick={async () => {
										try {
											const element = document.getElementById('training-record');
											if (!element) return;
											
											// Use html2canvas if available
											if (window.html2canvas) {
												const canvas = await window.html2canvas(element, {
													backgroundColor: '#1e293b',
													scale: 2
												});
												
												canvas.toBlob((blob) => {
													if (!blob) return;
													const url = URL.createObjectURL(blob);
													const a = document.createElement('a');
													a.href = url;
													a.download = `Training-Record-${team.name}-${member.employeeId}-${Date.now()}.png`;
													a.click();
													URL.revokeObjectURL(url);
													alert("✅ 截圖成功!");
												});
											} else {
												alert("📸 Screenshot feature requires html2canvas library.\nPlease copy text instead.");
											}
										} catch (error) {
											console.error("Screenshot error:", error);
											alert("❌ 截圖失敗，請改用複製文字");
										}
									}}
								>
									📸 截圖
								</button>
							</div>
						</div>
					</div>
				) : (
					<div className={styles.cardsRow}>
						{/* DOOR Card */}
						{doorCard && (
							<div className={styles.cardColumn}>
								<div className={`${styles.card} ${styles.cardDoor}`}>
									<div className={styles.cardCornerTopLeft}>
										<span className={styles.cardCode} style={{ color: '#1e293b' }}>{doorCard.code}</span>
									</div>
									<div className={styles.cardCornerTopRight}>
										<span className={styles.cardSuit} style={{ color: '#000000' }}>♣</span>
									</div>
									<div className={styles.cardCenter}>
										<span className={styles.cardBadge} style={{ marginBottom: '0.5rem', display: 'inline-block', background: '#475569', color: '#ffffff' }}><FaDoorClosed size={14} style={{ marginRight: '0.25rem' }} /> DOOR</span>
										<h3 style={{ color: '#1e293b' }}>{doorCard.title}</h3>
										<p style={{ color: '#475569' }}>{doorCard.description}</p>
									</div>
									<div className={styles.cardCornerBottomLeft}>
										<span className={styles.cardSuit} style={{ color: '#000000' }}>♣</span>
									</div>
									<div className={styles.cardCornerBottomRight}>
										<span className={styles.cardCode} style={{ color: '#1e293b' }}>{doorCard.code}</span>
									</div>
								</div>
								
								{/* Action buttons */}
								<div className={styles.specialCardActions}>
									<button 
										onClick={generateDoorCard}
										className={styles.regenerateBtn}
										title="Regenerate DOOR card"
									>
										<Shuffle size={16} /> 重抽
									</button>
									<button 
										onClick={() => setDoorCard(null)}
										className={styles.deleteBtn}
										title="Remove DOOR card"
									>
										<X size={16} /> 移除
									</button>
								</div>
							</div>
						)}
						
						{/* POSITION Card */}
						{positionCard && (
							<div className={styles.cardColumn}>
								<div className={`${styles.card} ${styles.cardPosition}`}>
									<div className={styles.cardCornerTopLeft}>
										<span className={styles.cardCode} style={{ color: '#1e293b' }}>{positionCard.code}</span>
									</div>
									<div className={styles.cardCornerTopRight}>
										<span className={styles.cardSuit} style={{ color: '#000000' }}>♣</span>
									</div>
									<div className={styles.cardCenter}>
										<span className={styles.cardBadge} style={{ marginBottom: '0.5rem', display: 'inline-block', background: '#64748b', color: '#ffffff' }}><FaLocationDot size={14} style={{ marginRight: '0.25rem' }} /> POSITION</span>
										<h3 style={{ color: '#1e293b' }}>{positionCard.title}</h3>
										<p style={{ color: '#475569' }}>{positionCard.description}</p>
									</div>
									<div className={styles.cardCornerBottomLeft}>
										<span className={styles.cardSuit} style={{ color: '#000000' }}>♣</span>
									</div>
									<div className={styles.cardCornerBottomRight}>
										<span className={styles.cardCode} style={{ color: '#1e293b' }}>{positionCard.code}</span>
									</div>
								</div>
								
								{/* Action buttons */}
								<div className={styles.specialCardActions}>
									<button 
										onClick={generatePositionCard}
										className={styles.regenerateBtn}
										title="Regenerate POSITION card"
									>
										<Shuffle size={16} /> 重抽
									</button>
									<button 
										onClick={() => setPositionCard(null)}
										className={styles.deleteBtn}
										title="Remove POSITION card"
									>
										<X size={16} /> 移除
									</button>
								</div>
							</div>
						)}
						
						{/* Side Effect Card */}
						{sideCard && (
							<div className={styles.cardColumn}>
								<div className={`${styles.card} ${styles[`card${sideCard.card_type}`]}`}>
									{/* Top Left: Code */}
									<div className={styles.cardCornerTopLeft}>
										<span className={styles.cardCode}>{sideCard.code}</span>
									</div>
									
									{/* Top Right: Suit */}
									<div className={styles.cardCornerTopRight}>
										<span className={styles.cardSuit} style={{ color: getSuitColor(sideCard.card_type) }}>
											{getSuit(sideCard.card_type)}
										</span>
									</div>
									
									{/* Center: Title, Description, Badge */}
									<div className={styles.cardCenter}>
										<span className={styles.cardBadge} style={{ marginBottom: '0.5rem', display: 'inline-block' }}>Side Effect</span>
										<h3>{sideCard.title}</h3>
										<p>{sideCard.description}</p>
									</div>
									
									{/* Bottom Left: Suit */}
									<div className={styles.cardCornerBottomLeft}>
										<span className={styles.cardSuit} style={{ color: getSuitColor(sideCard.card_type) }}>
											{getSuit(sideCard.card_type)}
										</span>
									</div>
									
									{/* Bottom Right: Code */}
									<div className={styles.cardCornerBottomRight}>
										<span className={styles.cardCode}>
											{sideCard.code}
										</span>
									</div>
								</div>

								<div className={styles.outcomes}>
									{addAutoSuccess(sideCard)
										.sort((a, b) => b.probability - a.probability)
										.map(o => {
											const nextCard = o.next_card_id ? allCards.find(c => c.id === o.next_card_id) : null;
											const isShiny = nextCard?.is_shiny || false;
											
											return (
												<button
													key={o.id}
													onClick={() => selectOutcome(o, true)}
													className={`${styles.outcomeBtn} ${selectedSide?.id === o.id ? styles.outcomeSelected : ""} ${isShiny ? styles.outcomeShiny : ""}`}
													disabled={!!selectedSide}
												>
													<span className={styles.outcomeDesc}>
														{isShiny && <span className={styles.shinyIcon}>✨ </span>}
														{o.description}
													</span>
													<span className={styles.outcomeProb}>{o.probability}%</span>
												</button>
											);
										})}
									<button onClick={randomSide} className={styles.randomBtn} disabled={!!selectedSide}>
										<Zap size={16} /> Random
									</button>
								</div>
							</div>
						)}

						{/* Main Card */}
						{currentCard && (
							<div className={styles.cardColumn}>
								<AnimatePresence mode="wait">
									<motion.div
										key={currentCard.id}
										initial={{ rotateY: 90, opacity: 0 }}
										animate={{ rotateY: 0, opacity: 1 }}
										exit={{ rotateY: -90, opacity: 0 }}
										transition={{ duration: 0.3 }}
									>
										<div className={`${styles.card} ${styles[`card${currentCard.card_type}`]} ${currentCard.is_shiny ? styles.cardShiny : ""}`}>
											{/* Top Left: Code */}
											<div className={styles.cardCornerTopLeft}>
												<span className={styles.cardCode}>{currentCard.code}</span>
											</div>
											
											{/* Top Right: Suit */}
											<div className={styles.cardCornerTopRight}>
												<span className={styles.cardSuit} style={{ color: getSuitColor(currentCard.card_type) }}>
													{getSuit(currentCard.card_type)}
												</span>
											</div>
											
											{/* Center: Title & Description */}
											<div className={styles.cardCenter}>
												<h3>{currentCard.title}</h3>
												<p>{currentCard.description}</p>
											</div>
											
											{/* Bottom Left: Suit */}
											<div className={styles.cardCornerBottomLeft}>
												<span className={styles.cardSuit} style={{ color: getSuitColor(currentCard.card_type) }}>
													{getSuit(currentCard.card_type)}
												</span>
											</div>
											
											{/* Bottom Right: Code */}
											<div className={styles.cardCornerBottomRight}>
												<span className={styles.cardCode}>
													{currentCard.code}
												</span>
											</div>
										</div>
									</motion.div>
								</AnimatePresence>

								<div className={styles.outcomes}>
									{addAutoSuccess(currentCard)
										.sort((a, b) => b.probability - a.probability)
										.map(o => {
										// Check if next card is shiny
										const nextCard = o.next_card_id ? allCards.find(c => c.id === o.next_card_id) : null;
										const isShiny = nextCard?.is_shiny || false;
										
										return (
											<button
												key={o.id}
												onClick={() => selectOutcome(o)}
												className={`${styles.outcomeBtn} ${selectedMain?.id === o.id ? styles.outcomeSelected : ""} ${o.id === "auto" ? styles.outcomeAuto : ""} ${isShiny ? styles.outcomeShiny : ""}`}
											>
												<span className={styles.outcomeDesc}>
													{isShiny && <span className={styles.shinyIcon}>✨ </span>}
													{o.description}
													{o.side_effect_card_id && <span className={styles.sideEffectIndicator}> 🔵</span>}
												</span>
												<span className={styles.outcomeProb}>{o.probability}%</span>
											</button>
										);
									})}
									<button onClick={randomMain} className={styles.randomBtn}>
										<Zap size={16} /> Random
									</button>
									
									{/* Random Category Buttons - Hidden (only used for backend logic) */}
									
									{/* Show Confirm button when both main and side are selected */}
									{selectedMain && selectedSide && sideCard && (
										<button 
											onClick={confirmBothSelections} 
											className={styles.confirmBtn}
										>
											<ArrowRight size={16} /> Confirm Both
										</button>
									)}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};

export default MDAfaatGame;