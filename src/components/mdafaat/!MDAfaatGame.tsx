// src/components/mdafaat/MDAfaatGame.tsx
// Scenario-based training game - Clean version
"use client";

import React, { useState, useEffect } from "react";
import { X, Shuffle, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import styles from "./MDAfaatGame.module.css";

// Extend Window for html2canvas
declare global {
	interface Window {
		html2canvas?: any;
	}
}

interface MdafaatCard {
	id: number;
	card_type: "emergency" | "passenger" | "equipment";
	code: string;
	title: string;
	description: string;
	is_shiny: boolean;
	can_be_initial: boolean;
	category: string;
	conflicts: number[];
	outcomes: any[];
}

interface CardHistory {
	card: MdafaatCard;
	timestamp: number;
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

const MDAfaatGame: React.FC<Props> = ({ teams, onBack }) => {
	// Data
	const [allCards, setAllCards] = useState<MdafaatCard[]>([]);
	const [loading, setLoading] = useState(true);

	// Game state
	const [currentTeam, setCurrentTeam] = useState(0);
	const [gameStarted, setGameStarted] = useState(false);
	const [shuffling, setShuffling] = useState(false);
	const [instructorName, setInstructorName] = useState<string>("");

	// Scenario cards
	const [scenarioCards, setScenarioCards] = useState<MdafaatCard[]>([]);
	const [clickedCards, setClickedCards] = useState<Set<number>>(new Set());

	// Conditions
	const [conditions, setConditions] = useState<any>(null);

	// History
	const [history, setHistory] = useState<CardHistory[]>([]);
	const [showHistory, setShowHistory] = useState(true);

	// Complete
	const [complete, setComplete] = useState(false);

	// Timer
	const [elapsedTime, setElapsedTime] = useState(0);
	const [timerRunning, setTimerRunning] = useState(false);

	// Computed
	const team = teams[currentTeam];
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

	// Format time
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	};

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

		// Trigger CSS shuffle animation
		const shuffleContainer = document.querySelector(`.${styles.shuffleAnimation}`);
		if (shuffleContainer) {
			shuffleContainer.classList.add(styles.shuffling);
		}

		await new Promise(r => setTimeout(r, 1150));

		if (shuffleContainer) {
			shuffleContainer.classList.remove(styles.shuffling);
		}

		// Load all scenario cards
		const cards = [...allCards].sort((a, b) => a.id - b.id);
		setScenarioCards(cards);
		setClickedCards(new Set());
		setHistory([]);

		// Start timer
		setElapsedTime(0);
		setTimerRunning(true);

		await new Promise(r => setTimeout(r, 300));
		
		setGameStarted(true);
		setShuffling(false);
	};

	// Click card to progress
	const handleCardClick = (index: number) => {
		if (clickedCards.has(index)) return;
		
		const card = scenarioCards[index];
		
		// Must click in order
		if (clickedCards.size !== index) return;
		
		// Mark as clicked
		setClickedCards(prev => new Set([...prev, index]));
		
		// Add to history
		setHistory(prev => [...prev, {
			card,
			timestamp: Date.now()
		}]);
		
		// Check if last card
		if (index === scenarioCards.length - 1) {
			setComplete(true);
			setTimerRunning(false);
		}
	};

	// Next team
	const nextTeam = () => {
		if (currentTeam < teams.length - 1) {
			setCurrentTeam(currentTeam + 1);
			resetGame();
		}
	};

	// Reset
	const resetGame = () => {
		setGameStarted(false);
		setScenarioCards([]);
		setClickedCards(new Set());
		setHistory([]);
		setComplete(false);
		setConditions(null);
		setElapsedTime(0);
		setTimerRunning(false);
	};

	// Get card type suit
	const getSuit = (cardType: string): string => {
		switch(cardType) {
			case 'emergency': return '♠';
			case 'passenger': return '♥';
			case 'equipment': return '♦';
			default: return '♣';
		}
	};

	const getSuitColor = (cardType: string): string => {
		return ['passenger', 'equipment'].includes(cardType) ? '#dc2626' : '#1e293b';
	};

	if (loading) {
		return (
			<div className={styles.container}>
				<div className={styles.loading}>載入中...</div>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			{/* Header */}
			<div className={styles.header}>
				<button onClick={onBack} className={styles.backBtn}>
					<X />
				</button>
				<div className={styles.headerInfo}>
					<h2 className={styles.teamName}>{team.name}</h2>
					<div className={styles.timer}>{formatTime(elapsedTime)}</div>
				</div>
				<button 
					onClick={() => setShowHistory(!showHistory)} 
					className={styles.historyToggle}
				>
					{showHistory ? <ChevronUp /> : <ChevronDown />}
					History
				</button>
			</div>

			{/* History */}
			<AnimatePresence>
				{showHistory && history.length > 0 && (
					<motion.div
						className={styles.historyPanel}
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
					>
						<h4>Scenario Path ({history.length} cards)</h4>
						<div className={styles.historyList}>
							{history.map((h, i) => (
								<div key={i} className={styles.historyItem}>
									<strong>{h.card.code}</strong>: {h.card.title}
								</div>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Main content */}
			<div className={styles.mainContent}>
				{!gameStarted ? (
					<div className={styles.shuffleScreen}>
						<div className={styles.deckContainer}>
							<div className={styles.shuffleAnimation}>
								{shuffling ? (
									<>
										{[...Array(10)].map((_, i) => {
											const z = i * 5;
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
					</div>
				) : complete ? (
					<div className={styles.completeScreen}>
						<div className={`${styles.card} ${styles.cardEnd}`}>
							<div className={styles.cardCornerTopLeft}>
								<span className={styles.cardCode}>{scenarioCards[scenarioCards.length - 1]?.code}</span>
							</div>
							<div className={styles.cardCornerTopRight}>
								<span className={styles.cardSuit} style={{ color: '#1e293b' }}>♣</span>
							</div>
							<div className={styles.cardCenter}>
								<h2 style={{ margin: '0 0 0.5rem 0' }}>{scenarioCards[scenarioCards.length - 1]?.title}</h2>
								<p style={{ margin: 0 }}>{scenarioCards[scenarioCards.length - 1]?.description}</p>
							</div>
							<div className={styles.cardCornerBottomLeft}>
								<span className={styles.cardSuit} style={{ color: '#1e293b' }}>♣</span>
							</div>
							<div className={styles.cardCornerBottomRight}>
								<span className={styles.cardCode}>
									{scenarioCards[scenarioCards.length - 1]?.code}
								</span>
							</div>
						</div>

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
						<div className={styles.exportSection} id="training-record">
							<h4>Training Record</h4>
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
									• {conditions.time === "morning" ? "🌅 晨航" : conditions.time === "midday" ? "☀️ 午航" : "🌙 夜航"}: YES<br />
									• ✈️ 客滿: {conditions.full ? "YES" : "NO"}<br />
									• 👶 嬰兒: {conditions.infants ? "YES" : "NO"}<br />
									• ♿ 身心障礙旅客: {conditions.disabled ? "YES" : "NO"}<br />
									<br />
									<strong>Scenario Path:</strong><br />
									{history.map((h, i) => (
										<div key={i} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
											{i + 1}. <strong>{h.card.code}</strong>: {h.card.title}<br />
										</div>
									))}
									<br />
									<strong>Time Elapsed:</strong> {formatTime(elapsedTime)}<br />
									<strong>Instructor:</strong> {instructorName}
								</div>
							</div>
							<div style={{ display: 'flex', gap: '0.75rem' }}>
								<button 
									className={styles.exportBtn}
									onClick={() => {
										const record = `Training Record - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\nTeam: ${team.name}\n\nCrew Members:\n${team.members.map((m, idx) => `• ${m.employeeId} ${m.name}${idx === 0 ? ' (Leader)' : ''}`).join('\n')}\n\nInitial Conditions:\n• Time: ${conditions.time}\n• Full Flight: ${conditions.full ? 'Yes' : 'No'}\n• Infants: ${conditions.infants ? 'Yes' : 'No'}\n• Disabled: ${conditions.disabled ? 'Yes' : 'No'}\n\nScenario Path:\n${history.map((h, i) => `${i + 1}. ${h.card.code}: ${h.card.title}`).join('\n')}\n\nTime: ${formatTime(elapsedTime)}\nInstructor: ${instructorName}`;
										
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
													a.download = `Training-Record-${team.name}-${Date.now()}.png`;
													a.click();
													URL.revokeObjectURL(url);
													alert("✅ Screenshot saved!");
												});
											} else {
												alert("📸 Screenshot feature requires html2canvas library.\nPlease copy text instead.");
											}
										} catch (error) {
											console.error("Screenshot error:", error);
											alert("❌ Screenshot failed. Please use Copy Text instead.");
										}
									}}
								>
									📸 Screenshot
								</button>
							</div>
						</div>
					</div>
				) : (
					<div className={styles.cardsDisplay}>
						{scenarioCards.map((card, index) => {
							const isClicked = clickedCards.has(index);
							const isCurrent = clickedCards.size === index;
							const isLocked = !isClicked && !isCurrent;

							return (
								<motion.div
									key={card.id}
									className={`${styles.card} ${isClicked ? styles.cardClicked : ''} ${isCurrent ? styles.cardCurrent : ''} ${isLocked ? styles.cardLocked : ''}`}
									onClick={() => handleCardClick(index)}
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: index * 0.1 }}
								>
									<div className={styles.cardCornerTopLeft}>
										<span className={styles.cardCode}>{card.code}</span>
									</div>
									<div className={styles.cardCornerTopRight}>
										<span className={styles.cardSuit} style={{ color: getSuitColor(card.card_type) }}>
											{getSuit(card.card_type)}
										</span>
									</div>
									<div className={styles.cardCenter}>
										<h3>{card.title}</h3>
										<p>{card.description}</p>
										{isClicked && <div className={styles.checkmark}>✓</div>}
										{isCurrent && <div className={styles.currentBadge}>CLICK TO CONTINUE</div>}
									</div>
									<div className={styles.cardCornerBottomLeft}>
										<span className={styles.cardSuit} style={{ color: getSuitColor(card.card_type) }}>
											{getSuit(card.card_type)}
										</span>
									</div>
									<div className={styles.cardCornerBottomRight}>
										<span className={styles.cardCode}>{card.code}</span>
									</div>
								</motion.div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
};

export default MDAfaatGame;