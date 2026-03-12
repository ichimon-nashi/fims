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

	// ── Handlers ──────────────────────────────────────────────────────────────
	const handleStartGame = (teams: GameTeam[]) => {
		setFormedTeams(teams);
		setIsRedoMode(false);
		setView("game");
	};

	const handleStartRedo = (
		redoStudents: Array<{ userId: string; name: string; employeeId: string; rank: string }>
	) => {
		const coreScenarios = [
			"lithium_fire", "bomb_threat", "decompression",
			"incapacitation", "planned_evacuation", "unplanned_evacuation",
		];
		const shuffledScenarios = [...coreScenarios].sort(() => Math.random() - 0.5);
		const redoTeams: GameTeam[] = [];

		// ATR minimum crew is 2 — if odd number of redo students, duplicate a random
		// existing student to fill the last group rather than leaving anyone solo
		const students = [...redoStudents];
		if (students.length % 2 !== 0 && students.length > 1) {
			const randomPick = students[Math.floor(Math.random() * (students.length - 1))];
			students.push(randomPick);
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