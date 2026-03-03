// src/app/mdafaat/page.tsx
"use client";

import { useState } from 'react';
import PermissionGuard from '@/components/common/PermissionGuard';
import Navbar from '@/components/common/Navbar';
import TeamFormation from '@/components/mdafaat/TeamFormation';
import ScenarioMode from '@/components/mdafaat/ScenarioMode';
import ScenarioEditor from '@/components/mdafaat/ScenarioEditor';

interface GameTeam {
	name: string;
	coreScenario?: string;
	members: Array<{
		userId: string;
		name: string;
		employeeId: string;
		rank: string;
		avatarUrl?: string;
	}>;
}

export default function MDAfaatPage() {
	const [view, setView] = useState<"formation" | "game" | "editor">("formation");
	const [formedTeams, setFormedTeams] = useState<GameTeam[]>([]);

	const handleOpenEditor = () => {
		setView("editor");
	};

	const handleCloseEditor = () => {
		setView("formation");
	};

	const handleStartGame = (teams: GameTeam[]) => {
		setFormedTeams(teams);
		setView("game");
	};

	const handleBackToFormation = () => {
		setView("formation");
		setFormedTeams([]);
	};

	return (
		<PermissionGuard app="mdafaat">
			<Navbar />
			
			<div style={{ 
				minHeight: '100vh',
				...(view === "formation" 
					? { backgroundImage: 'linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)' }
					: view === "editor"
					? { backgroundColor: '#1e293b' }
					: { backgroundColor: 'transparent' }
				)
			}}>
				{view === "formation" && (
					<TeamFormation 
						onStartGame={handleStartGame}
						onOpenEditor={handleOpenEditor}
					/>
				)}

				{view === "game" && (
					<ScenarioMode 
						teams={formedTeams}
						onBack={handleBackToFormation}
					/>
				)}

				{view === "editor" && (
					<ScenarioEditor 
						onClose={handleCloseEditor}
					/>
				)}
			</div>
		</PermissionGuard>
	);
}