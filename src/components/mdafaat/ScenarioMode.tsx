// src/components/mdafaat/ScenarioMode.tsx
// Complete scenario-based game - using EXACT production visuals
"use client";

import React, { useState, useEffect } from "react";
import LoadingScreen from "@/components/common/LoadingScreen";
import { X, Shuffle, ArrowRight, ArrowLeft } from "lucide-react";
import { FaPeopleGroup, FaBaby, FaWheelchair } from "react-icons/fa6";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import styles from "./MDAfaatGame.module.css"; // SAME CSS

declare global {
	interface Window {}
}

const CORE_SCENARIO_LABELS: Record<string, string> = {
	bomb_threat: "爆裂物威脅 Bomb Threat",
	lithium_fire: "鋰電池火災 Lithium Battery Fire",
	decompression: "失壓 Decompression",
	incapacitation: "失能 Incapacitation",
	unplanned_evacuation: "無預警緊急撤離 Unplanned Evacuation",
	planned_evacuation: "客艙準備程序 Cabin Preparation",
};

// ─── Flight data by base + time of day ────────────────────────────────────────
interface FlightEntry {
	flightNo: string;
	departure: string;
	arrival: string;
	aircraftType: string;
}

const FLIGHT_DATA: Record<string, Record<string, FlightEntry[]>> = {
	TSA: {
		morning: [
			{ flightNo: "AE-391",  departure: "TSA", arrival: "TTT", aircraftType: "ATR" },
			{ flightNo: "AE-7901", departure: "TSA", arrival: "LZN", aircraftType: "ATR" },
			{ flightNo: "AE-361",  departure: "TSA", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-211",  departure: "TSA", arrival: "FOC", aircraftType: "B738" },
			{ flightNo: "AE-1263", departure: "TSA", arrival: "KNH", aircraftType: "B738" },
		],
		midday: [
			{ flightNo: "AE-367",  departure: "TSA", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-371",  departure: "TSA", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-1269", departure: "TSA", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-1265", departure: "TSA", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-1271", departure: "TSA", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-1273", departure: "TSA", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-1275", departure: "TSA", arrival: "KNH", aircraftType: "B738" },
		],
		night: [
			{ flightNo: "AE-395",  departure: "TSA", arrival: "TTT", aircraftType: "ATR" },
			{ flightNo: "AE-385",  departure: "TSA", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-1277", departure: "TSA", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-377",  departure: "TSA", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-387",  departure: "TSA", arrival: "MZG", aircraftType: "ATR" },
		],
	},
	RMQ: {
		morning: [
			{ flightNo: "AE-761",  departure: "RMQ", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-781",  departure: "RMQ", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-1857", departure: "RMQ", arrival: "SGN", aircraftType: "B738" },
		],
		midday: [
			{ flightNo: "AE-785",  departure: "RMQ", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-787",  departure: "RMQ", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-763",  departure: "RMQ", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-767",  departure: "RMQ", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-791",  departure: "RMQ", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-769",  departure: "RMQ", arrival: "KNH", aircraftType: "B738" },
		],
		night: [
			{ flightNo: "AE-793",  departure: "RMQ", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-731",  departure: "RMQ", arrival: "HUN", aircraftType: "ATR" },
			{ flightNo: "AE-795",  departure: "RMQ", arrival: "MZG", aircraftType: "B738" },
		],
	},
	KHH: {
		morning: [
			{ flightNo: "AE-301",  departure: "KHH", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-331",  departure: "KHH", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-333",  departure: "KHH", arrival: "MZG", aircraftType: "ATR" },
		],
		midday: [
			{ flightNo: "AE-303",  departure: "KHH", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-343",  departure: "KHH", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-7925", departure: "KHH", arrival: "LZN", aircraftType: "ATR" },
			{ flightNo: "AE-335",  departure: "KHH", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-307",  departure: "KHH", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-337",  departure: "KHH", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-341",  departure: "KHH", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-305",  departure: "KHH", arrival: "KNH", aircraftType: "ATR" },
			{ flightNo: "AE-339",  departure: "KHH", arrival: "MZG", aircraftType: "ATR" },
		],
		night: [
			{ flightNo: "AE-349",  departure: "KHH", arrival: "MZG", aircraftType: "ATR" },
			{ flightNo: "AE-7931", departure: "KHH", arrival: "HUN", aircraftType: "ATR" },
		],
	},
};

const FALLBACK_FLIGHTS: Record<string, string[]> = {
	morning: ["AE-101", "AE-103", "AE-105"],
	midday:  ["AE-151", "AE-153", "AE-251"],
	night:   ["AE-171", "AE-173", "AE-271"],
};

const getBaseFromEmployeeId = (employeeId: string): string => {
	const id = parseInt(employeeId, 10);
	if (isNaN(id)) return "KHH";
	if (id >= 50000 && id <= 59999) return "KHH";
	if (id >= 60000 && id <= 69999) return "TSA";
	if (id >= 70000 && id <= 79999) return "RMQ";
	return "KHH";
};

const getRandomFlight = (base: string, timeOfDay: string): FlightEntry | null => {
	const list = FLIGHT_DATA[base]?.[timeOfDay];
	if (list && list.length > 0) return list[Math.floor(Math.random() * list.length)];
	const fallback = FALLBACK_FLIGHTS[timeOfDay] || FALLBACK_FLIGHTS.midday;
	return { flightNo: fallback[Math.floor(Math.random() * fallback.length)], departure: base, arrival: "???", aircraftType: "ATR" };
};
// ─────────────────────────────────────────────────────────────────────────────

interface MdafaatCard {
	id: number;
	card_type: "emergency" | "passenger" | "equipment";
	code: string;
	title: string;
	description: string;
	is_shiny: boolean;
	can_be_initial?: boolean;
	category: string;
	conflicts: number[];
	outcomes: any[];
}

interface CardHistory {
	card: MdafaatCard;
	timestamp: number;
	skipped: boolean;
}

interface Props {
	teams: Array<{
		name: string;
		coreScenario?: string;
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

const ScenarioMode: React.FC<Props> = ({ teams, onBack }) => {
	// Data
	const [allCards, setAllCards] = useState<MdafaatCard[]>([]);
	const [loading, setLoading] = useState(true);

	// Game state
	const [currentTeam, setCurrentTeam] = useState(0);
	const [currentMember, setCurrentMember] = useState(0);
	const [gameStarted, setGameStarted] = useState(false);
	const [shuffling, setShuffling] = useState(false);
	const [instructorName, setInstructorName] = useState<string>("");

	// Scenario cards
	const [scenarioCards, setScenarioCards] = useState<MdafaatCard[]>([]);
	const [clickedCards, setClickedCards] = useState<Set<number>>(new Set());
	const [skippedCards, setSkippedCards] = useState<Set<number>>(new Set());

	// Conditions
	const [conditions, setConditions] = useState<any>(null);

	// Flight info
	const [flightInfo, setFlightInfo] = useState<FlightEntry | null>(null);

	// History
	const [history, setHistory] = useState<CardHistory[]>([]);
	const [showHistory, setShowHistory] = useState(true);

	// Pending optional card (C/D) waiting for inline YES/NO
	const [pendingOptional, setPendingOptional] = useState<number | null>(null);

	// Complete
	const [complete, setComplete] = useState(false);
	const [showEndButton, setShowEndButton] = useState(false);

	// Timer
	const [elapsedTime, setElapsedTime] = useState(0);
	const [timerRunning, setTimerRunning] = useState(false);

	// Computed
	const team = teams[currentTeam];
	const member = team?.members[currentMember];
	const hasNextTeam = currentTeam < teams.length - 1;

	// Get instructor name
	useEffect(() => {
		const checkUser = () => {
			if ((window as any).currentUser?.full_name) {
				setInstructorName((window as any).currentUser.full_name);
				return true;
			}
			return false;
		};
		
		if (!checkUser()) {
			setTimeout(checkUser, 500);
			setTimeout(checkUser, 1000);
			setTimeout(checkUser, 2000);
		}
	}, []);

	// Load cards
	useEffect(() => {
		const load = async () => {
			try {
				const token = localStorage.getItem("token");
				const coreScenario = team?.coreScenario || 'bomb_threat';
				
				const res = await fetch(`/api/mdafaat/scenarios?core_scenario=${coreScenario}`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const data = await res.json();
				
				if (data.error) {
					console.error('Error loading scenarios:', data.error);
					setLoading(false);
					return;
				}
				
				setAllCards([
					...data.emergency, 
					...data.passenger, 
					...data.equipment,
				]);
				setLoading(false);
			} catch (err) {
				console.error(err);
				setLoading(false);
			}
		};
		load();
	}, [team?.coreScenario]);

	// Timer effect
	useEffect(() => {
		let interval: NodeJS.Timeout;
		if (timerRunning) {
			interval = setInterval(() => {
				setElapsedTime(prev => prev + 1);
			}, 1000);
		}
		return () => clearInterval(interval);
	}, [timerRunning]);

	// Format time (EXACT from production)
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	const formatDate = (d = new Date()) => {
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		const hh = String(d.getHours()).padStart(2, '0');
		const min = String(d.getMinutes()).padStart(2, '0');
		return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
	};

	// Get rank order (EXACT from production)
	const getRankOrder = (rank: string): number => {
		if (!rank) return 999;
		const r = rank.toLowerCase();
		if (r.includes('mg') || r.includes('manager')) return 1;
		if (r.includes('sc') || (r.includes('section') && r.includes('chief'))) return 2;
		if (r.includes('fi') || r.includes('flight instructor')) return 3;
		if (r.includes('pr') || r.includes('purser')) return 4;
		if (r.includes('lf') || r.includes('leading')) return 5;
		if (r.includes('fs') || r.includes('fa') || r.includes('flight attendant') || r.includes('stewardess')) return 6;
		return 99;
	};

	// Get time functions (EXACT from production)
	const getTimeIcon = (time: string) => {
		switch(time) {
			case 'morning': return '🌅';
			case 'midday': return '☀️';
			case 'night': return '🌙';
			default: return '☀️';
		}
	};

	const getTimeText = (time: string) => {
		switch(time) {
			case 'morning': return '早上';
			case 'midday': return '中午';
			case 'night': return '晚上';
			default: return '中午';
		}
	};

	// Get card style class by title (A/B/C/D/E), not card_type which is legacy
	const getCardStyleClass = (title: string): string => {
		if (title.includes('A. 背景')) return styles.cardBackground;
		if (title.includes('B. 觸發')) return styles.cardTrigger;
		if (title.includes('C. 併發')) return styles.cardComplication;
		if (title.includes('D. Outcome')) return styles.cardOutcome;
		return styles.cardBackground;
	};

	// Get suit — each card gets a distinct suit so they're visually distinguishable
	const getSuit = (cardType: string, cardTitle?: string): string => {
		if (cardTitle?.includes('C. 併發')) return '♥'; // optional = hearts (red)
		if (cardTitle?.includes('A. 背景')) return '♠'; // background = spades
		if (cardTitle?.includes('B. 觸發')) return '♦'; // trigger = diamonds
		if (cardTitle?.includes('D. Outcome')) return '♣'; // outcome = clubs
		// fallback by card_type
		switch(cardType) {
			case 'emergency': return '♠';
			case 'passenger': return '♦';
			case 'equipment': return '♣';
			default: return '♠';
		}
	};

	const getSuitColor = (cardType: string, cardTitle?: string): string => {
		if (cardTitle?.includes('C. 併發')) return '#dc2626'; // hearts = red
		if (cardTitle?.includes('B. 觸發')) return '#dc2626'; // diamonds = red
		return '#1e293b'; // spades/clubs = dark
	};

	// Shuffle (EXACT animation from production)
	const handleShuffle = async () => {
		setShuffling(true);
		
		// Random conditions
		const timeOfDay = (["morning", "midday", "night"] as const)[Math.floor(Math.random() * 3)];
		const cond = {
			time: timeOfDay,
			full: Math.random() > 0.5,
			infants: Math.random() > 0.75,
			disabled: Math.random() > 0.75,
		};
		setConditions(cond);

		// Determine flight from team leader's base
		const sortedForBase = [...team.members].sort((a, b) => {
			const rd = getRankOrder(a.rank) - getRankOrder(b.rank);
			return rd !== 0 ? rd : parseInt(a.employeeId) - parseInt(b.employeeId);
		});
		const base = sortedForBase[0] ? getBaseFromEmployeeId(sortedForBase[0].employeeId) : 'KHH';
		setFlightInfo(getRandomFlight(base, timeOfDay));

		// Trigger CSS shuffle animation
		const shuffleContainer = document.querySelector(`.${styles.shuffleAnimation}`);
		if (shuffleContainer) {
			shuffleContainer.classList.add(styles.shuffling);
		}

		// Wait for animation (1150ms from production)
		await new Promise(r => setTimeout(r, 1150));

		if (shuffleContainer) {
			shuffleContainer.classList.remove(styles.shuffling);
		}

		// Load all scenario cards
		const cards = [...allCards].sort((a, b) => a.id - b.id);
		setScenarioCards(cards);
		setClickedCards(new Set());
		setSkippedCards(new Set());
		setHistory([]);
		setShowEndButton(false);

		// Start timer
		setElapsedTime(0);
		setTimerRunning(true);

		// Flip delay (300ms from production)
		await new Promise(r => setTimeout(r, 300));
		
		setGameStarted(true);
		setShuffling(false);
	};

	// Card click handler
	const handleCardClick = (index: number) => {
		const card = scenarioCards[index];
		
		// Can't click if already done
		if (clickedCards.has(index) || skippedCards.has(index)) return;
		
		// Must click in order
		const expectedNext = clickedCards.size + skippedCards.size;
		if (index !== expectedNext) return;
		
		// If clicking C or D, show inline YES/NO on the card
		if (card.title.includes('C. 併發')) {
			setPendingOptional(index);
			return;
		}
		
		// Mark as clicked
		setClickedCards(prev => new Set([...prev, index]));
		setHistory(prev => [...prev, { card, timestamp: Date.now(), skipped: false }]);
		
		// Check if this is the Outcome card
		if (card.title.includes('D. Outcome')) {
			setShowEndButton(true);
		}
	};

	// Handle optional card YES/NO decision
	const handleOptionalDecision = (include: boolean) => {
		if (pendingOptional === null) return;
		const index = pendingOptional;
		const card = scenarioCards[index];
		setPendingOptional(null);
		if (include) {
			setClickedCards(prev => new Set([...prev, index]));
			setHistory(prev => [...prev, { card, timestamp: Date.now(), skipped: false }]);
		} else {
			setSkippedCards(prev => new Set([...prev, index]));
			setHistory(prev => [...prev, { card, timestamp: Date.now(), skipped: true }]);
		}
	};

	// End scenario
	const handleEndScenario = async () => {
		setComplete(true);
		setTimerRunning(false);
		await saveTrainingSession();
	};

	// Save training session
	const saveTrainingSession = async () => {
		try {
			const token = localStorage.getItem("token");
			const session = {
				training_date: new Date().toISOString().split('T')[0],
				employee_id: member.employeeId,
				group_type: flightInfo?.aircraftType || 'ATR',
				group_number: currentTeam + 1,
				core_scenario: team.coreScenario,
				flight_info: flightInfo,
				team_members: team.members.map(m => ({
					userId: m.userId,
					name: m.name,
					employeeId: m.employeeId,
					rank: m.rank
				})),
				scenario_path: history.map(h => ({
					code: h.card.code,
					title: h.card.title,
					skipped: h.skipped
				})),
				conditions,
				elapsed_time: elapsedTime,
				instructor: instructorName
			};

			await fetch('/api/mdafaat/training-sessions', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ sessions: [session] })
			});
		} catch (error) {
			console.error('Error saving training session:', error);
		}
	};

	// Next team
	const nextTeam = () => {
		if (currentTeam < teams.length - 1) {
			setCurrentTeam(currentTeam + 1);
			setCurrentMember(0);
			resetGame();
		}
	};

	// Reset
	const resetGame = () => {
		setGameStarted(false);
		setScenarioCards([]);
		setClickedCards(new Set());
		setSkippedCards(new Set());
		setHistory([]);
		setComplete(false);
		setShowEndButton(false);
		setConditions(null);
		setFlightInfo(null);
		setElapsedTime(0);
		setTimerRunning(false);
		setPendingOptional(null);
	};

	if (loading) {
		return <LoadingScreen message="載入情境中..." />;
	}

	// Single source of truth for member order — leader is always index 0
	const sortedMembers = team ? [...team.members].sort((a, b) => {
		const rankDiff = getRankOrder(a.rank) - getRankOrder(b.rank);
		if (rankDiff !== 0) return rankDiff;
		return parseInt(a.employeeId) - parseInt(b.employeeId);
	}) : [];

	return (
		<div className={styles.container}>
			{/* Header - EXACT from production */}
			<div className={styles.header}>
				<button onClick={onBack} className={styles.closeBtn} style={{ background: 'rgba(220,38,38,0.15)', borderColor: 'rgba(220,38,38,0.5)', color: '#ef4444' }}>
					<ArrowLeft />
				</button>
				<h1 className={styles.title}>客艙組員情境演練</h1>
				<div style={{ width: '2.5rem' }} />
			</div>

			{/* Stopwatch Bar - EXACT from production */}
			{conditions && (
				<div className={styles.stopwatchBar}>
					<span style={{ color: '#4ade80', fontWeight: 700, fontSize: '1.25rem' }}>
						⏱️ {formatTime(elapsedTime)}
					</span>
					{flightInfo && (
						<span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
							✈️ {flightInfo.flightNo}&nbsp;&nbsp;{flightInfo.departure} → {flightInfo.arrival}&nbsp;({flightInfo.aircraftType})
						</span>
					)}
				</div>
			)}

			{/* Conditions + Team Row - EXACT from production */}
			{conditions && (
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
								{sortedMembers
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
			)}



			{/* Game Area - GREEN POKER TABLE */}
			<div className={styles.gameArea}>
				{!gameStarted ? (
					/* Shuffle Screen - EXACT from production */
					<div className={styles.startScreen}>
						<div className={styles.deckContainer}>
							{shuffling ? (
								// EXACT 10-card shuffle from production
								<div className={styles.shuffleAnimation}>
									{[...Array(10)].map((_, i) => {
										const z = i / 4;
										const delay = i * 10;
										const plusMinus = Math.round(Math.random()) ? -1 : 1;
										const randomOffset = plusMinus * (Math.random() * 150 + 200);
										
										return (
											<div
												key={i}
												className={`${styles.cardBack} ${styles.shuffleCard}`}
												style={{
													position: 'absolute',
													zIndex: i,
													animationDelay: `${delay}ms`,
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
								</div>
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
						{!shuffling && (
							<button onClick={handleShuffle} className={styles.shuffleBtn}>
								<Shuffle />
								Shuffle Cards
							</button>
						)}
					</div>
				) : complete ? (
					/* Complete Screen */
					<div className={styles.completeContainer}>
						<div className={styles.completeActions}>
							<h3>Scenario Complete!</h3>
							{hasNextTeam ? (
								<button onClick={nextTeam} className={styles.nextBtn}>
									<ArrowRight />
									Next Group
								</button>
							) : (
								<button onClick={onBack} className={styles.nextBtn}>
									Return to Formation
								</button>
							)}
						</div>

						{/* Export section */}
						<div className={styles.exportSection} id="training-record" style={{ boxSizing: 'border-box' }}>
							<h4>Training Record</h4>
							<div className={styles.recordText}>
								<div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#60a5fa' }}>
									{formatDate()}
								</div>
								<div style={{ fontSize: '0.95rem', lineHeight: '1.8' }}>
									<strong>Team:</strong> {team.name}<br />
									<strong>Core Scenario:</strong> {CORE_SCENARIO_LABELS[team.coreScenario || ''] || team.coreScenario}<br />
									{flightInfo && <><strong>Flight:</strong> {flightInfo.flightNo} ({flightInfo.departure} → {flightInfo.arrival}, {flightInfo.aircraftType})<br /></>}
									<strong>Crew Members:</strong><br />
									{sortedMembers.map((m, idx) => (
										<span key={m.userId}>
											• {m.employeeId} {m.name}{idx === 0 ? ' (Leader)' : ''}<br />
										</span>
									))}
									<br />
									<strong>Initial Conditions:</strong><br />
									• {getTimeIcon(conditions.time)} {getTimeText(conditions.time)}: YES<br />
									• ✈️ 客滿: {conditions.full ? "YES" : "NO"}<br />
									• 👶 嬰兒: {conditions.infants ? "YES" : "NO"}<br />
									• ♿ 身心障礙旅客: {conditions.disabled ? "YES" : "NO"}<br />
									<br />
									<strong>Scenario Path:</strong><br />
									{history.map((h, i) => (
										<div key={i} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
											{i + 1}. <strong>{h.card.code}</strong>: {h.card.title}
											{h.skipped && <span style={{ color: '#94a3b8' }}> (Skipped)</span>}
											<br />
										</div>
									))}
									<br />
									<strong>Time Elapsed:</strong> {formatTime(elapsedTime)}<br />
									<strong>Instructor:</strong> {instructorName}
								</div>
							</div>
							<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
								<button 
									className={styles.exportBtn}
									onClick={() => {
										const record = `Training Record - ${formatDate()}\n\nTeam: ${team.name}\nCore Scenario: ${CORE_SCENARIO_LABELS[team.coreScenario || ''] || team.coreScenario}\n\nCrew Members:\n${sortedMembers.map((m, idx) => `• ${m.employeeId} ${m.name}${idx === 0 ? ' (Leader)' : ''}`).join('\n')}\n\nInitial Conditions:\n• Time: ${conditions.time}\n• Full Flight: ${conditions.full ? 'Yes' : 'No'}\n• Infants: ${conditions.infants ? 'Yes' : 'No'}\n• Disabled: ${conditions.disabled ? 'Yes' : 'No'}\n\nScenario Path:\n${history.map((h, i) => `${i + 1}. ${h.card.code}: ${h.card.title}${h.skipped ? ' (Skipped)' : ''}`).join('\n')}\n\nTime: ${formatTime(elapsedTime)}\nInstructor: ${instructorName}`;
										
										navigator.clipboard.writeText(record).then(() => {
											alert("✅ Training record copied!");
										}).catch(() => {
											alert("❌ Copy failed");
										});
									}}
								>
									📋 Copy Text
								</button>
								<button 
									className={styles.exportBtn}
									onClick={async () => {
										try {
											const element = document.getElementById('training-record');
											if (!element) return;
											const { default: h2c } = await import('html2canvas');
											const canvas = await h2c(element, { backgroundColor: '#1e293b', scale: 2, useCORS: true });
											canvas.toBlob((blob) => {
												if (!blob) return;
												const url = URL.createObjectURL(blob);
												const a = document.createElement('a');
												a.href = url;
												a.download = `Training-Record-${team.name}-${Date.now()}.png`;
												a.click();
												URL.revokeObjectURL(url);
											});
										} catch {
											alert('❌ Run: npm install html2canvas');
										}
									}}
								>
									📸 Screenshot
								</button>
							</div>
						</div>
					</div>
				) : (
					/* Cards Display - All at once */
					<>
					<div className={styles.cardsRow}>
							{scenarioCards.map((card, index) => {
							const isClicked = clickedCards.has(index);
							const isSkipped = skippedCards.has(index);
							const isCurrent = !isClicked && !isSkipped && (clickedCards.size + skippedCards.size === index);
							
							return (
								<div key={card.id} className={styles.cardColumn}>
									{card.title.includes('C. 併發') && !isClicked && !isSkipped && (
										<div style={{ background: 'rgba(251,191,36,0.12)', border: '1px dashed #fbbf24', borderRadius: '0.5rem', padding: '0.3rem 0.6rem', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
											🛑 FREEZE — ⚡ OPTIONAL
										</div>
									)}
									<AnimatePresence mode="wait">
										<motion.div
											key={card.id}
											initial={{ rotateY: 90, opacity: 0 }}
											animate={{ rotateY: 0, opacity: 1 }}
											exit={{ rotateY: -90, opacity: 0 }}
											transition={{ duration: 0.3, delay: index * 0.1 }}
										>
											<div 
												className={`${styles.card} ${getCardStyleClass(card.title)} ${isClicked ? styles.cardClicked : ''} ${isSkipped ? styles.cardSkipped : ''} ${isCurrent && pendingOptional !== index ? styles.cardCurrent : ''}`}
												onClick={() => handleCardClick(index)}
												style={{ 
													cursor: isCurrent ? 'pointer' : 'default',
													opacity: isSkipped ? 0.4 : 1,
													boxShadow: pendingOptional === index ? '0 0 0 3px #fbbf24, 0 0 20px rgba(251,191,36,0.5)' : undefined
												}}
											>
												{/* Top Left: Code */}
												<div className={styles.cardCornerTopLeft}>
													<span className={styles.cardCode}>{card.code}</span>
												</div>
												
												{/* Top Right: Suit */}
												<div className={styles.cardCornerTopRight}>
													<span className={styles.cardSuit} style={{ color: getSuitColor(card.card_type, card.title) }}>
														{getSuit(card.card_type, card.title)}
													</span>
												</div>
												
												{/* Center: Title & Description */}
												<div className={styles.cardCenter}>
													<h3>{card.title}</h3>
													<p>{card.description}</p>

													{/* Inline YES/NO for optional C/D cards */}
													{pendingOptional === index && (
														<div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
															<button
																onClick={(e) => { e.stopPropagation(); handleOptionalDecision(true); }}
																style={{ padding: '0.45rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
															>
																✓ Include
															</button>
															<button
																onClick={(e) => { e.stopPropagation(); handleOptionalDecision(false); }}
																style={{ padding: '0.45rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
															>
																⊘ Skip
															</button>
														</div>
													)}

													{/* Checkmark for clicked */}
													{isClicked && (
														<div style={{ 
															position: 'absolute', 
															top: '50%', 
															left: '50%', 
															transform: 'translate(-50%, -50%)', 
															fontSize: '4rem', 
															color: '#10b981', 
															opacity: 0.5,
															pointerEvents: 'none',
															fontWeight: 700
														}}>✓</div>
													)}
													
													{/* Cross for skipped */}
													{isSkipped && (
														<div style={{ 
															position: 'absolute', 
															top: '50%', 
															left: '50%', 
															transform: 'translate(-50%, -50%)', 
															fontSize: '4rem', 
															color: '#94a3b8', 
															opacity: 0.5,
															pointerEvents: 'none'
														}}>⊘</div>
													)}
												</div>
												
												{/* Bottom Left: Suit */}
												<div className={styles.cardCornerBottomLeft}>
													<span className={styles.cardSuit} style={{ color: getSuitColor(card.card_type, card.title) }}>
														{getSuit(card.card_type, card.title)}
													</span>
												</div>
												
												{/* Bottom Right: Code */}
												<div className={styles.cardCornerBottomRight}>
													<span className={styles.cardCode}>
														{card.code}
													</span>
												</div>
											</div>
										</motion.div>
									</AnimatePresence>
								</div>
							);
						})}
						</div>
					</>
				)}
			</div>

			{/* End Scenario Button */}
			{showEndButton && !complete && (
				<div style={{ 
					display: 'flex', 
					justifyContent: 'center', 
					padding: '2rem',
					background: '#1e293b'
				}}>
					<button onClick={handleEndScenario} className={styles.nextBtn} style={{
						background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
						fontSize: '1.25rem',
						padding: '1rem 2rem'
					}}>
						<ArrowRight />
						End Scenario
					</button>
				</div>
			)}
		</div>
	);
};

export default ScenarioMode;