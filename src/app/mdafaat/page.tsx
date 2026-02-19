// src/app/mdafaat/page.tsx
"use client";

import { useState } from 'react';
import PermissionGuard from '@/components/common/PermissionGuard';
import Navbar from '@/components/common/Navbar';
import TeamFormation from '@/components/mdafaat/TeamFormation';
import MDAfaatGame from '@/components/mdafaat/MDAfaatGame';
import ScenarioEditor from '@/components/mdafaat/ScenarioEditor';

interface GameTeam {
	name: string;
	members: Array<{
		userId: string;
		name: string;
		employeeId: string;
		rank: string;
		avatarUrl?: string;
	}>;
}

interface CardData {
	emergency: any[];
	passenger: any[];
	equipment: any[];
}

export default function MDAfaatPage() {
	const [view, setView] = useState<"formation" | "game" | "editor">("formation");
	const [formedTeams, setFormedTeams] = useState<GameTeam[]>([]);
	const [cardData, setCardData] = useState<CardData>({
		emergency: [],
		passenger: [],
		equipment: []
	});

	const handleOpenEditor = async () => {
		try {
			const token = localStorage.getItem("token");
			if (!token) {
				alert("請先登入");
				return;
			}

			const response = await fetch("/api/mdafaat/cards", {
				headers: { "Authorization": `Bearer ${token}` }
			});

			if (response.ok) {
				const data = await response.json();
				setCardData(data);
				setView("editor");
			} else {
				alert("載入卡片失敗");
			}
		} catch (error) {
			console.error("Error loading cards:", error);
			alert("載入卡片失敗");
		}
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
					<MDAfaatGame 
						teams={formedTeams}
						onBack={handleBackToFormation}
					/>
				)}

				{view === "editor" && (
					<ScenarioEditor 
						onClose={handleCloseEditor}
						initialData={cardData}
					/>
				)}
			</div>
		</PermissionGuard>
	);
}