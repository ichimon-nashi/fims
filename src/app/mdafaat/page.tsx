// src/app/mdafaat/page.tsx
"use client";

import { useState } from "react";
import { FiEdit } from "react-icons/fi";
import PermissionGuard from "@/components/common/PermissionGuard";
import Navbar from "@/components/common/Navbar";
import TeamFormation from "@/components/mdafaat/TeamFormation";
import ScenarioMode from "@/components/mdafaat/ScenarioMode";
import ScenarioEditor from "@/components/mdafaat/ScenarioEditor";
import TrainingRecords from "@/components/mdafaat/TrainingRecords";
import { useAuth } from "@/context/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GameTeam {
	name: string;
	coreScenario?: string;
	aircraftType?: string;
	aircraftNumber?: number;
	pendingGroupId?: number;   // mdafaat_pending_groups.id — deleted after ScenarioMode completes
	members: Array<{
		userId: string;
		name: string;
		employeeId: string;
		rank: string;
		base?: string;
		avatarUrl?: string;
	}>;
}

type Tab = "formation" | "records";
type View = "dashboard" | "game" | "editor";

// ─── Component ────────────────────────────────────────────────────────────────
export default function MDAfaatPage() {
	const { permissions } = useAuth();
	const canEdit = !permissions?.mdafaat?.view_only;

	const [view, setView] = useState<View>("dashboard");
	const [activeTab, setActiveTab] = useState<Tab>("formation");
	const [formedTeams, setFormedTeams] = useState<GameTeam[]>([]);
	const [isRedoMode, setIsRedoMode] = useState(false);
	const [trainingDate, setTrainingDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

	// ── Handlers ──────────────────────────────────────────────────────────────
	const handleStartGame = (teams: GameTeam[], date: string) => {
		setFormedTeams(teams);
		setIsRedoMode(false);
		setTrainingDate(date);
		setView("game");
	};

	const handleStartRedo = (
		redoStudents: Array<{ userId: string; name: string; employeeId: string; rank: string }>,
		allSessionsForDate?: Array<{ employee_id: string }>
	) => {
		const coreScenarios = [
			"lithium_fire", "bomb_threat", "decompression",
			"incapacitation", "planned_evacuation", "unplanned_evacuation",
		];
		const shuffledScenarios = [...coreScenarios].sort(() => Math.random() - 0.5);
		const redoTeams: GameTeam[] = [];

		// ATR minimum crew is 2.
		// If odd number of redo students, pair the last student with the student
		// from the same training date who has appeared the fewest times.
		// If tie, pick randomly from the tied students.
		const students = [...redoStudents];
		if (students.length % 2 !== 0 && students.length > 1) {
			const redoIds = new Set(students.map(s => s.employeeId));
			// Count appearances per non-redo student in today's sessions
			const countMap = new Map<string, number>();
			if (allSessionsForDate) {
				for (const s of allSessionsForDate) {
					if (!redoIds.has(s.employee_id)) {
						countMap.set(s.employee_id, (countMap.get(s.employee_id) ?? 0) + 1);
					}
				}
			}
			// Find minimum count among all redo students (use them as pool if no session data)
			let pool = students;
			if (countMap.size > 0) {
				const minCount = Math.min(...Array.from(countMap.values()));
				const minIds   = Array.from(countMap.entries())
					.filter(([, c]) => c === minCount)
					.map(([id]) => id);
				// Find the redo student objects that match those IDs
				const matches = students.filter(s => minIds.includes(s.employeeId));
				if (matches.length > 0) pool = matches;
			}
			const pick = pool[Math.floor(Math.random() * pool.length)];
			students.push(pick);
		}

		for (let i = 0; i < students.length; i += 2) {
			const member1 = students[i];
			const member2 = students[i + 1];
			redoTeams.push({
				name: `重考組 ${redoTeams.length + 1}`,
				coreScenario: shuffledScenarios[redoTeams.length % 6],
				aircraftType: "REDO",
				aircraftNumber: 100 + redoTeams.length + 1,
				members: member2 ? [member1, member2] : [member1],
			});
		}

		setFormedTeams(redoTeams);
		setIsRedoMode(true);
		setTrainingDate(new Date().toISOString().split("T")[0]); // redo always saves today
		setView("game");
	};

	const handleBackFromGame = () => {
		const wasRedo = isRedoMode;
		setView("dashboard");
		setFormedTeams([]);
		setIsRedoMode(false);
		// After redo session, jump to records so instructor sees updated results
		if (wasRedo) setActiveTab("records");
	};

	const handleOpenEditor = () => setView("editor");
	const handleCloseEditor = () => setView("dashboard");

	// ── Editor view ───────────────────────────────────────────────────────────
	if (view === "editor") {
		return (
			<PermissionGuard app="mdafaat">
				<div style={{ minHeight: "100vh", backgroundColor: "#1e293b" }}>
					<Navbar />
					<ScenarioEditor onClose={handleCloseEditor} />
				</div>
			</PermissionGuard>
		);
	}

	// ── Game / redo view ──────────────────────────────────────────────────────
	if (view === "game") {
		return (
			<PermissionGuard app="mdafaat">
				<ScenarioMode
					teams={formedTeams}
					onBack={handleBackFromGame}
					isRedoMode={isRedoMode}
					trainingDate={trainingDate}
				/>
			</PermissionGuard>
		);
	}

	// ── Dashboard ─────────────────────────────────────────────────────────────
	return (
		<PermissionGuard app="mdafaat">
			<div style={{
				minHeight: "100vh",
				backgroundImage: "linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)",
			}}>
				<Navbar />

				{/* Tab bar + editor button */}
				<div style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "0 2rem",
					borderBottom: "1px solid rgba(74,158,255,0.15)",
					background: "rgba(15,23,42,0.5)",
					flexWrap: "wrap",
					gap: "0.5rem",
				}}>
					{/* Tabs */}
					<div style={{ display: "flex" }}>
						{([
							{ id: "formation" as Tab, label: "🧑‍✈️ 分組系統" },
							{ id: "records"   as Tab, label: "📋 訓練記錄" },
						]).map(tab => (
							<button
								key={tab.id}
								onClick={() => setActiveTab(tab.id)}
								style={{
									padding: "0.85rem 1.4rem",
									border: "none",
									borderBottom: activeTab === tab.id
										? "3px solid #4a9eff"
										: "3px solid transparent",
									background: "transparent",
									color: activeTab === tab.id ? "#60a5fa" : "#64748b",
									fontWeight: activeTab === tab.id ? 700 : 500,
									fontSize: "0.9rem",
									cursor: "pointer",
									transition: "color 0.15s",
									letterSpacing: "0.02em",
									whiteSpace: "nowrap",
								}}
							>
								{tab.label}
							</button>
						))}
					</div>

					{/* Editor shortcut — top right */}
					{canEdit && (
						<button
							onClick={handleOpenEditor}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.45rem",
								padding: "0.45rem 0.9rem",
								background: "rgba(139,92,246,0.15)",
								color: "#c4b5fd",
								border: "1px solid rgba(139,92,246,0.35)",
								borderRadius: "0.5rem",
								fontSize: "0.82rem",
								fontWeight: 600,
								cursor: "pointer",
								marginLeft: "auto",
							}}
						>
							<FiEdit size={13} />
							情境編輯器
						</button>
					)}
				</div>

				{/* Tab content */}
				<div style={{ minHeight: "calc(100vh - 120px)" }}>
					{activeTab === "formation" && (
						<TeamFormation
							onStartGame={handleStartGame}
							onOpenEditor={handleOpenEditor}
						/>
					)}
					{activeTab === "records" && (
						<TrainingRecords
							onStartRedo={handleStartRedo}
							canEdit={canEdit}
						/>
					)}
				</div>
			</div>
		</PermissionGuard>
	);
}