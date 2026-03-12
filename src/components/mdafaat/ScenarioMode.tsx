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

const CORE_SCENARIO_LABELS: Record<string, string> = {
	bomb_threat: "爆裂物威脅 Bomb Threat",
	lithium_fire: "鋰電池火災 Lithium Battery Fire",
	decompression: "失壓 Decompression",
	incapacitation: "失能 Incapacitation",
	unplanned_evacuation: "無預警緊急撤離 Unplanned Evacuation",
	planned_evacuation: "客艙準備程序 Cabin Preparation",
};

// ─── Training criteria —  
type CriteriaEntry = { ref: string; icon: string; shortLabel: string; items: string[] };
const CRITERIA_DATA: Record<string, CriteriaEntry> = {
	cpp: {
		shortLabel: "客艙準備 CPP",
		ref: "CCOM 9.1",
		icon: "/images/criteriachipicon/cpp.png",
		items: [
			"取得機長NTR訊息並提示組員",
			"客艙燈光調整",
			"客艙廣播告知旅客",
			"工作區整理並確認Door Mode位置",
			"依客艙廣播執行旅客準備",
			"組員及客艙準備",
			"PSP安排座位及任務提示",
			"最終檢查，調整燈光，組員就位",
			"正確辨識準備迫降指示，要求旅客彎腰、低頭，直飛機停妥",
		],
	},
	planned_evac: {
		shortLabel: "有預警撤離",
		ref: "CCOM 9",
		icon: "/images/criteriachipicon/planned-evac.png",
		items: [
			"辨識飛航組員緊急指示",
			"Opposite emergency exit — 開啟其他可用出口撤離旅客",
			"Aircraft — 檢查滯留旅客、組員，通知及照顧飛航組員",
			"Emergency equipment — 攜帶緊急裝備撤離",
			"Passenger — 集結旅客至安全處並照顧受傷旅客",
		],
	},
	unplanned_evac: {
		shortLabel: "無預警撤離",
		ref: "CCOM 9",
		icon: "/images/criteriachipicon/unplanned-evac.png",
		items: [
			"辨識飛航組員緊急指示或自行判斷逃生",
			"選擇最佳逃生出口，評估機內外狀況，並就近指派PSP協助",
			"Evacuation — 緊急撤離",
			"Opposite emergency exit — 開啟其他可用出口撤離旅客",
			"Aircraft — 檢查滯留旅客、組員，通知及照顧飛航組員",
			"Emergency equipment — 攜帶緊急裝備撤離",
			"Passenger — 集結旅客至安全處並照顧受傷旅客",
		],
	},
	smoke_fire: {
		shortLabel: "煙霧/失火",
		ref: "CCOM 9.3 附件一",
		icon: "/images/criteriachipicon/smoke-fire.png",
		items: [
			"辨識火災及煙霧，通知機長及其他組員協助",
			"使用適當之滅火器設備及安全防護裝備，必要時",
			"確認火源並執行滅火",
			"駕客艙組員溝通及聯繫",
			"提供備用滅火裝備",
			"保持飛航組員聯繫",
			"管理客艙及旅客狀況（廣播、移除易燃物、斷電、調整座位）",
			"持續監控，避免復燃",
		],
	},
	lithium_fire: {
		shortLabel: "鋰電池火災",
		ref: "CCOM 6.5 / 7.13 / 9.3",
		icon: "/images/criteriachipicon/lithium-fire.png",
		items: [
			"辨識及確認火災，通知機長及其他組員協助",
			"使用滅火器滅火",
			"移除電子用品外接電源（可行時）",
			"使用非易燃性液體冷卻後（10~15分鐘）；注意不可移動燃燒及冒煙中之裝備",
			"穿戴防護手套將其裝入非溢漏之容器內，以水或非易燃性液體浸置",
			"可行時放置適當位置，遠離駕駛艙",
			"持續監控，避免復燃",
		],
	},
	decompression: {
		shortLabel: "客艙失壓",
		ref: "CCOM 9.4",
		icon: "/images/criteriachipicon/decompression.png",
		items: [
			"辨識快速失壓或慢速失壓",
			"就近取得並戴上面罩",
			"就近坐妥繫上安全帶（可行時）",
			"正確指示旅客 — B738：拉下面罩，罩住口鼻，繫好安全帶",
			"正確指示旅客 — ATR：留在座位上，繫好安全帶",
			"保持駕客艙組員溝通及聯繫",
			"管理客艙及旅客狀況",
		],
	},
	flight_crew_incap: {
		shortLabel: "飛航組員失能",
		ref: "CCOM 8.3",
		icon: "/images/criteriachipicon/flight-crew-incap.png",
		items: [
			"回應飛航組員指示",
			"固定失能組員，將座椅向後移動，施予氧氣",
			"將失能組員移出駕艙",
			"廣播尋求醫療協助，施予必要急救",
			"任務及指揮順序調整",
			"保持駕客艙溝通及聯繫",
		],
	},
	cabin_crew_incap: {
		shortLabel: "客艙組員失能",
		ref: "CCOM 8.3",
		icon: "/images/criteriachipicon/cabin-crew-incap.png",
		items: [
			"廣播尋求醫療協助，施予必要急救",
			"固定失能組員，調整座位",
			"通知飛航組員",
			"任務及指揮順序調整",
		],
	},
	controlled_disembark: {
		shortLabel: "管制離機",
		ref: "CCOM 4.4",
		icon: "/images/criteriachipicon/controlled-disembark.png",
		items: [
			"辨識飛航組員指示",
			"廣播要求旅客依照指示，使用（逃生滑梯/空橋/登機梯）疏散",
			"開啟緊急出口",
			"管制客艙及旅客疏散",
			"組員離機",
		],
	},
	unruly_pax: {
		shortLabel: "滋擾旅客",
		ref: "CCOM 5.4",
		icon: "/images/criteriachipicon/unruly-pax.png",
		items: [
			"確認滋擾旅客威脅等級（1~4 LEVEL）",
			"執行三階段處理程序",
			"約束暴力攻擊行為之滋擾旅客，並予以監控",
			"保持駕客艙溝通及聯繫",
		],
	},
	bomb_threat: {
		shortLabel: "爆裂物威脅",
		ref: "CCOM 5.7",
		icon: "/images/criteriachipicon/bomb-threat.png",
		items: [
			"通知或接獲飛航組員訊息",
			"廣播告知旅客訊息",
			"依機長指示，使用「搜尋可疑爆炸物檢查表」執行搜查",
			"回報檢查結果及描述可疑物狀況",
			"必要時移動至最低危害位置 LRBL",
			"管理客艙及旅客狀況",
			"準備降落",
			"降落後依機長指示準備管制旅客離機（Controlled Disembarkation）",
		],
	},
	hijacking: {
		shortLabel: "劫機",
		ref: "CCOM 5.6",
		icon: "/images/criteriachipicon/hijacking.png",
		items: [
			"使用標準用語規範通知飛航組員",
			"執行駕駛艙門控管程序",
			"安撫劫機者情緒",
			"管理客艙及旅客狀況",
			"保持駕客艙溝通及聯繫",
		],
	},
	first_aid: {
		shortLabel: "緊急救護 CPR",
		ref: "CCOM 8.2 / 8.5",
		icon: "/images/criteriachipicon/first-aid.png",
		items: [
			"檢查意識並確認生命跡象",
			"尋求醫護協助",
			"保持駕客艙溝通及聯繫",
			"執行CPR，正確使用AED",
			"紀錄急救過程，照顧病患旅客",
		],
	},
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
const SPECIAL_PASSENGERS = [
	"WCHR - 輪椅旅客",
	"WCHC - 客艙輪椅旅客",
	"BLND - 視障旅客",
	"DEAF - 聽障旅客",
	"PRGN - 孕婦旅客",
	"DPNA - 自閉症",
	"DPNA - 腦性麻痺",
	"POXY - 需氧旅客"
];

const getRandomSpecialPax = (): string =>
	SPECIAL_PASSENGERS[Math.floor(Math.random() * SPECIAL_PASSENGERS.length)];


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
		aircraftType?: string;
		aircraftNumber?: number;
		pendingGroupId?: number;
		members: Array<{
			userId: string;
			name: string;
			employeeId: string;
			rank: string;
			avatarUrl?: string;
		}>;
	}>;
	onBack: () => void;
	isRedoMode?: boolean;
	/** Called with array of {employeeId, result} when scenario completes — for redo flow */
	onSessionComplete?: (results: Array<{ employeeId: string; result: 'pass' | 'redo' }>) => void;
}

const ScenarioMode: React.FC<Props> = ({ teams, onBack, isRedoMode, onSessionComplete }) => {
	// Data
	const [allCards, setAllCards] = useState<MdafaatCard[]>([]);
	const [loading, setLoading] = useState(true);

	// Criteria panel state
	const [criteriaOpen, setCriteriaOpen] = useState<string | null>(null);
	const [checkedItems, setCheckedItems] = useState<Record<string, Set<number>>>({});

	// Game state
	const [currentTeam, setCurrentTeam] = useState(0);
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

	// Pending optional card (C/D) waiting for inline YES/NO
	const [pendingOptional, setPendingOptional] = useState<number | null>(null);

	// Complete
	const [complete, setComplete] = useState(false);
	const [showEndButton, setShowEndButton] = useState(false);

	// Pass/fail results — keyed by employeeId, default 'pass'
	const [memberResults, setMemberResults] = useState<Record<string, 'pass' | 'redo'>>({});

	// Timer
	const [elapsedTime, setElapsedTime] = useState(0);
	const [timerRunning, setTimerRunning] = useState(false);

	// Tracks which team indices have already been saved — prevents double-saves
	// when instructor clicks 儲存結果 then nextTeam/Return to Formation.
	// Reset when the teams prop changes (e.g. switching from normal → redo mode)
	// so redo groups starting at index 0 are not blocked by the previous session.
	const savedTeamIndices = React.useRef<Set<number>>(new Set());
	useEffect(() => {
		savedTeamIndices.current = new Set();
	}, [teams]);

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

		// Pre-calculate conditions and flight — set AFTER animation so layout
		// stays stable during the shuffle (setting conditions immediately would
		// render the bars and collapse the gameArea mid-animation)
		const timeOfDay = (["morning", "midday", "night"] as const)[Math.floor(Math.random() * 3)];
		const cond = {
			time: timeOfDay,
			full: Math.random() > 0.5,
			infants: Math.random() > 0.70,
			specialPax: Math.random() > 0.70 ? getRandomSpecialPax() : null,
		};
		const sortedForBase = [...team.members].sort((a, b) => {
			const rd = getRankOrder(a.rank) - getRankOrder(b.rank);
			return rd !== 0 ? rd : parseInt(a.employeeId) - parseInt(b.employeeId);
		});
		const base = sortedForBase[0] ? getBaseFromEmployeeId(sortedForBase[0].employeeId) : 'KHH';
		const flight = getRandomFlight(base, timeOfDay);

		// Wait for shuffle animation (1150ms) BEFORE revealing conditions
		await new Promise(r => setTimeout(r, 1150));

		// Now set conditions — bars appear after animation completes
		setConditions(cond);
		setFlightInfo(flight);

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

	// End scenario — initialise all members as 'pass', then save
	const handleEndScenario = async () => {
		// Pre-populate all members as pass so the UI shows the toggles
		const initial: Record<string, 'pass' | 'redo'> = {};
		team.members.forEach(m => { initial[m.employeeId] = 'pass'; });
		setMemberResults(initial);
		setComplete(true);
		setTimerRunning(false);
	};

	const toggleMemberResult = (employeeId: string) => {
		setMemberResults(prev => ({
			...prev,
			[employeeId]: prev[employeeId] === 'pass' ? 'redo' : 'pass',
		}));
	};

	// Save training session — called explicitly by instructor after setting pass/fail
	const saveTrainingSession = async (resultsOverride?: Record<string, 'pass' | 'redo'>) => {
		// Guard: skip if this team index was already saved
		if (savedTeamIndices.current.has(currentTeam)) {
			console.log(`Team ${currentTeam} already saved — skipping duplicate save`);
			return;
		}
		savedTeamIndices.current.add(currentTeam);
		const results = resultsOverride ?? memberResults;
		try {
			const token = localStorage.getItem("token");
			// Save one session row per member so each gets their own result
			const sessions = team.members.map(m => ({
				training_date: new Date().toISOString().split('T')[0],
				employee_id: m.employeeId,
				group_type: team.aircraftType || flightInfo?.aircraftType || 'ATR',
				group_number: team.aircraftNumber ?? (currentTeam + 1),
				core_scenario: team.coreScenario,
				flight_info: flightInfo,
				team_members: team.members.map(tm => ({
					userId: tm.userId,
					name: tm.name,
					employeeId: tm.employeeId,
					rank: tm.rank,
				})),
				scenario_path: history.map(h => ({
					code: h.card.code,
					title: h.card.title,
					description: h.card.description,
					skipped: h.skipped,
				})),
				conditions,
				elapsed_time: elapsedTime,
				instructor: instructorName,
				result: results[m.employeeId] ?? 'pass',
				is_redo: isRedoMode ?? false,
			}));

			const saveRes = await fetch('/api/mdafaat/training-sessions', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ sessions }),
			});
			if (!saveRes.ok) {
				const errBody = await saveRes.json().catch(() => ({}));
				console.error('❌ Save failed:', saveRes.status, errBody);
			} else {
				console.log('✅ Saved team', currentTeam, 'isRedo:', isRedoMode, 'sessions:', sessions.length);
			}

			// Delete the pending group now that training is complete
			if (team.pendingGroupId) {
				try {
					await fetch(`/api/mdafaat/pending-groups?id=${team.pendingGroupId}`, {
						method: 'DELETE',
						headers: { 'Authorization': `Bearer ${token}` },
					});
				} catch (e) {
					console.warn('Could not delete pending group:', e);
				}
			}

			// Notify parent (used by redo flow to collect redo students)
			if (onSessionComplete) {
				onSessionComplete(
					team.members.map(m => ({
						employeeId: m.employeeId,
						result: results[m.employeeId] ?? 'pass',
					}))
				);
			}
		} catch (error) {
			console.error('Error saving training session:', error);
		}
	};

	// Next team — auto-save with current results (all-pass by default) before advancing
	const nextTeam = async () => {
		if (currentTeam < teams.length - 1) {
			await saveTrainingSession();
			setCurrentTeam(currentTeam + 1);
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
		setMemberResults({});
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
					{team.coreScenario && (
						<span style={{ color: '#fbbf24', fontWeight: 700, fontSize: '0.95rem', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '0.375rem', padding: '0.2rem 0.65rem', letterSpacing: '0.02em' }}>
							🎯 {CORE_SCENARIO_LABELS[team.coreScenario] || team.coreScenario}
						</span>
					)}
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
						<span><FaWheelchair style={{ color: '#a78bfa' }} /> 特殊旅客: {conditions.specialPax ?? "NO"}</span>
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

			{/* ── Criteria Reference Bar ───────────────────────── */}
			{conditions && (
				<div className={styles.criteriaBar}>
					<span className={styles.criteriaBarLabel}>評分標準</span>
					{Object.entries(CRITERIA_DATA).map(([key, data]) => {
						const checked = checkedItems[key]?.size ?? 0;
						const total = data.items.length;
						const isActive = criteriaOpen === key;
						return (
							<button
								key={key}
								className={`${styles.criteriaChip} ${isActive ? styles.active : ''}`}
								onClick={() => setCriteriaOpen(isActive ? null : key)}
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={data.icon} alt="" className={styles.criteriaChipIcon} />
							<span className={styles.criteriaChipLabel}>{data.shortLabel}</span>
							{checked > 0 && (
								<span className={styles.criteriaChipCount}>{checked}/{total}</span>
							)}
							</button>
						);
					})}
				</div>
			)}

			{/* ── Criteria Modal (anchored bottom-left) ────────── */}
			{criteriaOpen && (() => {
				const data = CRITERIA_DATA[criteriaOpen];
				if (!data) return null;
				const checked = checkedItems[criteriaOpen] ?? new Set<number>();
				return (
					<div className={styles.criteriaOverlay} onClick={() => setCriteriaOpen(null)}>
						<div className={styles.criteriaModal} onClick={e => e.stopPropagation()}>
							<div className={styles.criteriaModalHeader}>
								<div>
									<div className={styles.criteriaModalTitle} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img src={data.icon} alt="" style={{ width: '1rem', height: '1rem', objectFit: 'contain' }} />
									{data.shortLabel}
								</div>
									<div className={styles.criteriaModalRef}>{data.ref}</div>
								</div>
								<button className={styles.criteriaCloseBtn} onClick={() => setCriteriaOpen(null)}>
									<X size={16} />
								</button>
							</div>
							<div className={styles.criteriaList}>
								{data.items.map((item, idx) => {
									const isChecked = checked.has(idx);
									return (
										<div
											key={idx}
											className={`${styles.criteriaItem} ${isChecked ? styles.checked : ''}`}
											onClick={() => {
								setCheckedItems(prev => {
									const next = new Set(prev[criteriaOpen!] ?? []);
									next.has(idx) ? next.delete(idx) : next.add(idx);
									return { ...prev, [criteriaOpen!]: next };
								});
							}}
										>
											<div className={styles.criteriaCheckbox}>
												{isChecked && <span className={styles.criteriaCheckMark}>✓</span>}
											</div>
											<span className={styles.criteriaText}>{item}</span>
										</div>
									);
								})}
							</div>
							<div className={styles.criteriaFooter}>
								<span className={styles.criteriaProgress}>
									<span className={styles.criteriaProgressFill}>{checked.size}</span>
									/{data.items.length} 已確認
								</span>
								<button className={styles.criteriaResetBtn} onClick={() => setCheckedItems(prev => ({ ...prev, [criteriaOpen!]: new Set() }))}>重置</button>
							</div>
						</div>
					</div>
				);
			})()}

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

						{/* ── Pass / Fail selector ── */}
						<div className={styles.resultPanel}>
							<h3 className={styles.resultPanelTitle}>
								{isRedoMode ? '🔄 重考結果' : '✅ 訓練結果'} — {team.name}
							</h3>
							<p className={styles.resultPanelHint}>點擊切換通過 / 重考</p>
							<div className={styles.resultMemberList}>
								{sortedMembers.map(m => {
									const result = memberResults[m.employeeId] ?? 'pass';
									return (
										<button
											key={m.employeeId}
											className={`${styles.resultMemberBtn} ${result === 'redo' ? styles.resultRedo : styles.resultPass}`}
											onClick={() => toggleMemberResult(m.employeeId)}
										>
											<span className={styles.resultMemberName}>{m.name}</span>
											<span className={styles.resultMemberEid}>{m.employeeId}</span>
											<span className={styles.resultBadge}>
												{result === 'pass' ? '✓ 通過' : '↺ 重考'}
											</span>
										</button>
									);
								})}
							</div>
							<button
								className={styles.confirmResultBtn}
								onClick={async () => {
									await saveTrainingSession();
									alert('✅ 訓練結果已儲存！');
								}}
							>
								儲存結果
							</button>
						</div>

						<div className={styles.completeActions}>
							<h3>Scenario Complete!</h3>
							{hasNextTeam ? (
								<button onClick={nextTeam} className={styles.nextBtn}>
									<ArrowRight />
									Next Group
								</button>
							) : (
								<button onClick={async () => { await saveTrainingSession(); onBack(); }} className={styles.nextBtn}>
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
									• ♿ 特殊旅客: {conditions.specialPax ?? "NO"}<br />
									<br />
									<strong>Scenario Path:</strong><br />
									{history.map((h, i) => (
										<div key={i} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
											{i + 1}. <strong>{h.card.code}</strong>{h.skipped ? <span style={{ color: '#94a3b8' }}> (Skipped)</span> : null}: {h.card.description || h.card.title}
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
										const lines = [
								`Training Record - ${formatDate()}`, ``,
								`Team: ${team.name}`,
								`Core Scenario: ${CORE_SCENARIO_LABELS[team.coreScenario || ''] || team.coreScenario}`, ``,
								`Crew Members:`,
								...sortedMembers.map((m, idx) => `• ${m.employeeId} ${m.name}${idx === 0 ? ' (Leader)' : ''}`),
								``, `Initial Conditions:`,
								`• Time: ${conditions.time}`,
								`• Full Flight: ${conditions.full ? 'Yes' : 'No'}`,
								`• Infants: ${conditions.infants ? 'Yes' : 'No'}`,
								`• Special Pax: ${conditions.specialPax ?? 'No'}`,
								``, `Scenario Path:`,
								...history.map((h, i) => `${i + 1}. ${h.card.code}${h.skipped ? ' (Skipped)' : ''}: ${h.card.description || h.card.title}`),
								``, `Time: ${formatTime(elapsedTime)}`, `Instructor: ${instructorName}`,
							];
							const record = lines.join('\n');
										
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