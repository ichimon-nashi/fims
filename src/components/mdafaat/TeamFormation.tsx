// src/components/mdafaat/TeamFormation.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Users, Shuffle, ArrowRight, Save, Trash2 } from "lucide-react";
import { FiEdit } from "react-icons/fi";
import { GiBoatPropeller } from "react-icons/gi";
import { IoAirplane } from "react-icons/io5";
import Image from "next/image";
import Avatar from "@/components/ui/Avatar/Avatar";
import { useAuth } from "@/context/AuthContext";
import { createServiceClient } from "@/utils/supabase/service-client";
import styles from "./TeamFormation.module.css";

interface User {
	id: string;
	employee_id: string;
	full_name: string;
	rank: string;
	base?: string;                     // KHH, TSA, RMQ — from DB
	aircraft_type_ratings?: string[]; // Array of aircraft types user can fly
}

interface Team {
	id: string;
	aircraftType: "ATR" | "B738";
	aircraftNumber: number;
	members: User[];
	coreScenario?: string;
}

interface TeamFormationProps {
	onStartGame: (teams: Array<{
		name: string;
		coreScenario?: string;
		members: Array<{
			userId: string;
			name: string;
			employeeId: string;
			rank: string;
			base?: string;
			avatarUrl?: string;
		}>;
	}>, trainingDate: string) => void;
	onOpenEditor: () => void;
}

const TeamFormation: React.FC<TeamFormationProps> = ({ onStartGame, onOpenEditor }) => {
	const { permissions } = useAuth();
	
	// Debug: Log permissions to console
	console.log("🔍 MDAfaat Permissions Debug:", {
		fullPermissions: permissions,
		mdafaat: permissions?.mdafaat,
		view_only: permissions?.mdafaat?.view_only,
		canEdit: !permissions?.mdafaat?.view_only
	});
	
	const canEditScenarios = !permissions?.mdafaat?.view_only;
	
	const [searchQuery, setSearchQuery] = useState("");
	const [allUsers, setAllUsers] = useState<User[]>([]);
	const [userPool, setUserPool] = useState<User[]>([]);
	const [teams, setTeams] = useState<Team[]>([]);
	const [aircraftType, setAircraftType] = useState<"ATR" | "B738">("ATR");
	const [aircraftCount, setAircraftCount] = useState(0);
	const [loadingUsers, setLoadingUsers] = useState(true);
	const [showTeams, setShowTeams] = useState(false);
	const [configWarning, setConfigWarning] = useState<string>("");
	
	// Date filter and training sessions
	const [selectedDate, setSelectedDate] = useState<string>(
		(new Date(Date.now() - new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]
	);
	const [trainedUserIds, setTrainedUserIds] = useState<Set<string>>(new Set());
	// Dates that have pending groups saved — shown with indicator in date selector
	const [datesWithGroups, setDatesWithGroups] = useState<Set<string>>(new Set());
	const [loadingTrainingSessions, setLoadingTrainingSessions] = useState(false);

	// ── Data maintenance modal ────────────────────────────────────────────
	const [maintModal, setMaintModal] = useState(false);
	const [maintLoading, setMaintLoading] = useState(false);
	const [maintToast, setMaintToast] = useState<{ ok: boolean; text: string } | null>(null);
	// Cleanup: skeleton rows that have a completed counterpart → safe to delete
	const [skeletonsToDelete, setSkeletonsToDelete] = useState<Array<{
		id: number; training_date: string; employee_id: string; employee_name: string;
		group_type: string; group_number: number; core_scenario: string;
	}>>([]);
	// Generate: skeleton rows with NO completed counterpart → missing records
	const [missingGroups, setMissingGroups] = useState<Array<{
		date: string; group_type: string; group_number: number; core_scenario: string;
		skeletonIds: number[];
		team_members: any[];
		selected: boolean;
	}>>([]);
	// Maintenance step: 'cleanup' | 'generate' | null
	const [maintTab, setMaintTab] = useState<'cleanup' | 'generate'>('cleanup');
	// Cleanup confirmation
	const [cleanupConfirmed, setCleanupConfirmed] = useState(false);
	// Toast helper for main UI (replaces all alert/confirm)
	const [tfToast, setTfToast] = useState<{ ok: boolean; text: string } | null>(null);
	const [tfConfirm, setTfConfirm] = useState<{ lines: string[]; onConfirm: () => void } | null>(null);

	// Core scenarios for assignment
	const coreScenarios = [
		'lithium_fire',
		'bomb_threat', 
		'decompression',
		'incapacitation',
		'planned_evacuation',
		'unplanned_evacuation'
	];

	// Rank classification
	const isHigherSenior = (rank: string): boolean => {
		if (!rank) return false;
		const rankLower = rank.toLowerCase();
		// MG, SC, FI, PR are higher level seniors
		return (
			(rankLower.includes("mg") && rankLower.includes("manager")) ||
			(rankLower.includes("sc") && rankLower.includes("section")) ||
			(rankLower.includes("fi") && rankLower.includes("instructor")) ||
			(rankLower.includes("pr") && rankLower.includes("purser"))
		);
	};

	const isSenior = (rank: string): boolean => {
		if (!rank) return false;
		const rankLower = rank.toLowerCase();
		// All senior ranks including LF
		return (
			isHigherSenior(rank) ||
			(rankLower.includes("lf") && rankLower.includes("leading"))
		); // "LF - Leading Flight Attendant"
	};

	const isJunior = (rank: string): boolean => {
		if (!rank) return false;
		const rankLower = rank.toLowerCase();
		return (
			(rankLower.includes("fs") && rankLower.includes("stewardess")) || // "FS - Flight Stewardess"
			(rankLower.includes("fa") &&
				rankLower.includes("attendant") &&
				!rankLower.includes("leading"))
		); // "FA - Flight Attendant"
	};

	// Centralized rank order function for consistent sorting
	const getRankOrder = (rank: string): number => {
		if (!rank) return 999;
		const rankLower = rank.toLowerCase();
		// Match exact database strings
		if (rankLower.includes("mg") && rankLower.includes("manager")) return 1;
		if (rankLower.includes("sc") && rankLower.includes("section")) return 2;
		if (rankLower.includes("fi") && rankLower.includes("instructor"))
			return 3;
		if (rankLower.includes("pr") && rankLower.includes("purser")) return 4;
		if (rankLower.includes("lf") && rankLower.includes("leading")) return 5; // "Leading Flight Attendant"
		if (rankLower.includes("fs") && rankLower.includes("stewardess"))
			return 6; // "Flight Stewardess"
		if (
			rankLower.includes("fa") &&
			rankLower.includes("attendant") &&
			!rankLower.includes("leading")
		)
			return 6;
		return 999;
	};

	// Check if user can fly a specific aircraft type
	const canFlyAircraft = (user: User, aircraftType: string): boolean => {
		// If no ratings array exists, default to ATR only for safety
		if (
			!user.aircraft_type_ratings ||
			user.aircraft_type_ratings.length === 0
		) {
			return aircraftType === "ATR";
		}
		return user.aircraft_type_ratings.includes(aircraftType);
	};

	// Load all users on mount
	useEffect(() => {
		const loadAllUsers = async () => {
			setLoadingUsers(true);
			try {
				const supabase = createServiceClient();
				const { data, error } = await supabase
					.from("users")
					.select(
						"id, employee_id, full_name, rank, base, aircraft_type_ratings",
					)
					.neq("rank", "admin"); // Exclude admin users only

				if (error) throw error;

				// Sort by rank hierarchy, then by employee_id ascending
				const sorted = (data || []).sort((a, b) => {
					const aRankOrder = getRankOrder(a.rank);
					const bRankOrder = getRankOrder(b.rank);

					// Sort by rank first
					if (aRankOrder !== bRankOrder) {
						return aRankOrder - bRankOrder;
					}

					// Then sort by employee_id ascending
					return a.employee_id.localeCompare(
						b.employee_id,
						undefined,
						{ numeric: true },
					);
				});

				setAllUsers(sorted);
			} catch (error) {
				console.error("Error loading users:", error);
				setAllUsers([]);
			} finally {
				setLoadingUsers(false);
			}
		};

		loadAllUsers();
	}, []);

	// Load training sessions when date changes
	useEffect(() => {
		const loadTrainingSessions = async () => {
			if (!selectedDate) return;
			
			setLoadingTrainingSessions(true);
			try {
				// Load filtered user list (hide users trained on or before this date)
				const nextDay = new Date(selectedDate);
				nextDay.setDate(nextDay.getDate() + 1);
				const beforeDate = nextDay.toISOString().split('T')[0];
				const response = await fetch(`/api/mdafaat/training-sessions?before=${beforeDate}`);
				if (response.ok) {
					const data = await response.json();
					const userIds = new Set(data.map((d: any) => d.employee_id));
					setTrainedUserIds(userIds);
				}
				
				// Load groups for this specific date (if any exist)
				await loadGroupsForDate(selectedDate);
			} catch (error) {
				console.error('Error loading training sessions:', error);
			} finally {
				setLoadingTrainingSessions(false);
			}
		};
		
		loadTrainingSessions();
	}, [selectedDate, allUsers]); // Add allUsers dependency

	// Load all dates that have saved groups (training-sessions + pending-groups)
	useEffect(() => {
		const loadDatesWithGroups = async () => {
			try {
				const token = localStorage.getItem("token");
				const headers: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};
				const dates = new Set<string>();
				// From training-sessions (completed records)
				const tsRes = await fetch('/api/mdafaat/training-sessions');
				if (tsRes.ok) {
					const sessions: any[] = await tsRes.json();
					sessions.forEach((s: any) => { if (s.training_date) dates.add(s.training_date); });
				}
				// From pending-groups (formed but not yet trained)
				const pgRes = await fetch('/api/mdafaat/pending-groups?all=1', { headers }).catch(() => null);
				if (pgRes?.ok) {
					const pg: any[] = await pgRes.json().catch(() => []);
					pg.forEach((g: any) => { if (g.training_date) dates.add(g.training_date); });
				}
				setDatesWithGroups(dates);
			} catch (e) {
				console.error('Error loading dates with groups:', e);
			}
		};
		loadDatesWithGroups();
	}, []); // run once on mount

	// Filter users based on search query and exclude those in pool AND trained users
	const getAvailableUsers = (): User[] => {
		const poolIds = userPool.map((u) => u.id);
		// Hide trained users from pool for easier searching
		// They can be restored by clicking their training date and pressing 返回編輯
		let available = allUsers.filter((u) =>
			!poolIds.includes(u.id) && !trainedUserIds.has(u.employee_id)
		);

		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			available = available.filter(
				(u) =>
					u.employee_id.toLowerCase().includes(query) ||
					u.full_name.toLowerCase().includes(query),
			);
		}

		// Ensure proper sorting by rank then ID
		return available.sort((a, b) => {
			const aRankOrder = getRankOrder(a.rank);
			const bRankOrder = getRankOrder(b.rank);

			if (aRankOrder !== bRankOrder) {
				return aRankOrder - bRankOrder;
			}

			return a.employee_id.localeCompare(b.employee_id, undefined, {
				numeric: true,
			});
		});
	};

	// Add user to pool
	const addToPool = (user: User) => {
		setUserPool((prev) => [...prev, user]);
	};

	// Remove user from pool
	const removeFromPool = (userId: string) => {
		setUserPool((prev) => prev.filter((u) => u.id !== userId));
	};

	// Clear pool
	const clearPool = () => {
		setUserPool([]);
		setTeams([]);
		setShowTeams(false);
		setConfigWarning("");
	};

	// Validate configuration whenever pool or aircraft type changes
	React.useEffect(() => {
		if (userPool.length === 0) {
			setConfigWarning("");
			return;
		}

		const warnings: string[] = [];
		const totalPeople = userPool.length;

		if (aircraftType === "ATR") {
			if (totalPeople % 2 !== 0) {
				warnings.push(`⚠️ ATR需要偶數人數，目前有 ${totalPeople} 人 (會有 1 人無法分組)`);
			}
		} else {
			// B738 - check if valid distribution is possible
			const minB738 = aircraftCount * 4;
			const maxB738 = aircraftCount * 6;
			
			if (totalPeople < minB738) {
				warnings.push(`⚠️ ${aircraftCount} 架B738最少需要 ${minB738} 人，目前只有 ${totalPeople} 人`);
			} else if (totalPeople > maxB738) {
				// Check if overflow can form valid ATR teams (even number)
				const overflow = totalPeople - maxB738;
				if (overflow % 2 !== 0) {
					// Odd overflow - can't form complete ATR teams
					warnings.push(`⚠️ 超出人數無法平均分配 (會有 1 人無法分組)`);
				}
				// If even overflow, it's OK - will form ATR teams
			}
		}

		setConfigWarning(warnings.join("; "));
	}, [userPool, aircraftType, aircraftCount]);

	// Smart grouping algorithm
	const formTeams = () => {
		if (userPool.length === 0) return;

		const higherSeniors = userPool.filter((u) => isHigherSenior(u.rank)); // MG, SC, FI, PR
		const lowerSeniors = userPool.filter(
			(u) => isSenior(u.rank) && !isHigherSenior(u.rank),
		); // LF
		const juniors = userPool.filter((u) => isJunior(u.rank));
		const others = userPool.filter(
			(u) => !isSenior(u.rank) && !isJunior(u.rank),
		);

		let newTeams: Team[] = [];

		// Shuffle for randomness
		const shuffledHigherSeniors = [...higherSeniors].sort(
			() => Math.random() - 0.5,
		);
		const shuffledLowerSeniors = [...lowerSeniors].sort(
			() => Math.random() - 0.5,
		);
		const shuffledJuniors = [...juniors].sort(() => Math.random() - 0.5);
		const shuffledOthers = [...others].sort(() => Math.random() - 0.5);

		const minB738Crew = 4;
		const maxB738Crew = 6;
		const b738Count = aircraftCount;

		// Separate people who can fly B738 vs only ATR
		const allShuffled = [
			...shuffledHigherSeniors,
			...shuffledLowerSeniors,
			...shuffledJuniors,
			...shuffledOthers,
		];

		const b738Qualified = allShuffled.filter((u) =>
			canFlyAircraft(u, "B738"),
		);
		const atrOnly = allShuffled.filter((u) => !canFlyAircraft(u, "B738"));

		// Debug: Check specific user 60546
		const user60546 = allShuffled.find((u) => u.employee_id === "60546");
		if (user60546) {
			console.log(
				"User 60546 (余宛亭):",
				user60546.aircraft_type_ratings,
				"Can fly B738?",
				canFlyAircraft(user60546, "B738"),
			);
		}

		let remainingPeople = [...b738Qualified];

		// Step 1: Create B738 teams - start with 4 crew each
		for (let i = 0; i < b738Count; i++) {
			const team: Team = {
				id: `b738-${i + 1}`,
				aircraftType: "B738",
				aircraftNumber: i + 1,
				members: [],
			};

			// Add 4 B738-qualified people to this B738
			for (
				let j = 0;
				j < minB738Crew && remainingPeople.length > 0;
				j++
			) {
				team.members.push(remainingPeople.shift()!);
			}

			// Only add the team if it has at least 4 members
			if (team.members.length >= minB738Crew) {
				newTeams.push(team);
			} else {
				// If we can't fill this B738 with 4 people, put them back for ATR
				remainingPeople.unshift(...team.members);
				break; // Stop creating B738 teams
			}
		}

		// Step 2: Combine remaining B738-qualified + ATR-only people for ATR teams
		let atrPeople = [...remainingPeople, ...atrOnly];

		// Step 3: Create ATR teams FIRST (exactly 2 per team)
		while (atrPeople.length >= 2) {
			const atrTeam: Team = {
				id: `atr-${newTeams.filter((t) => t.aircraftType === "ATR").length + 1}`,
				aircraftType: "ATR",
				aircraftNumber:
					newTeams.filter((t) => t.aircraftType === "ATR").length + 1,
				members: [],
			};

			atrTeam.members.push(atrPeople.shift()!);
			atrTeam.members.push(atrPeople.shift()!);

			newTeams.push(atrTeam);
		}

		// Step 4: Handle overflow (1 person left) - assign to 2 groups
		if (atrPeople.length === 1) {
			const overflow = atrPeople[0];
			const b738Teams = newTeams.filter((t) => t.aircraftType === "B738");
			const atrTeams = newTeams.filter((t) => t.aircraftType === "ATR");
			
			// Try B738 first if qualified and space available
			if (canFlyAircraft(overflow, "B738") && b738Teams.length > 0) {
				const targetTeam = b738Teams.find(t => t.members.length < maxB738Crew);
				if (targetTeam) {
					targetTeam.members.push(overflow);
					atrPeople = []; // Person placed
				}
			}
			
			// If still not placed, assign to a random ATR team (person will be in 2 groups)
			// ATR teams stay at 2 people, this person just appears in multiple groups
			if (atrPeople.length === 1 && atrTeams.length > 0) {
				const randomAtrTeam = atrTeams[Math.floor(Math.random() * atrTeams.length)];
				// Create a new ATR team with overflow + 1 person from the random team
				const partnerFromExisting = randomAtrTeam.members[Math.floor(Math.random() * randomAtrTeam.members.length)];
				
				const overflowTeam: Team = {
					id: `atr-${newTeams.filter((t) => t.aircraftType === "ATR").length + 1}`,
					aircraftType: "ATR",
					aircraftNumber: newTeams.filter((t) => t.aircraftType === "ATR").length + 1,
					members: [overflow, partnerFromExisting]
				};
				
				newTeams.push(overflowTeam);
				console.log(`Overflow: ${overflow.name_chinese} paired with ${partnerFromExisting.name_chinese} (both in 2 groups)`);
			}
		}

		// Step 5: Redistribute to ensure each team has at least 1 senior if possible
		// Note: If there are fewer seniors than teams, some teams will remain without seniors
		let teamsNeedingSenior = newTeams.filter(
			(team) => !team.members.some((m) => isSenior(m.rank)),
		);
		let teamsWithMultipleSeniors = newTeams.filter(
			(team) => team.members.filter((m) => isSenior(m.rank)).length > 1,
		);

		// Keep redistributing until no more swaps can be made
		while (
			teamsNeedingSenior.length > 0 &&
			teamsWithMultipleSeniors.length > 0
		) {
			const needyTeam = teamsNeedingSenior[0];
			const richTeam = teamsWithMultipleSeniors[0];

			const seniorMembers = richTeam.members.filter((m) =>
				isSenior(m.rank),
			);
			const seniorToMove = seniorMembers[seniorMembers.length - 1];
			const juniorToSwap = needyTeam.members.find(
				(m) => !isSenior(m.rank),
			);

			// Special case: Both teams are B738 with all seniors - can directly move without swap
			if (
				needyTeam.aircraftType === "B738" &&
				richTeam.aircraftType === "B738" &&
				!juniorToSwap
			) {
				// Both B738 teams, just move senior without swapping
				richTeam.members = richTeam.members.filter(
					(m) => m.id !== seniorToMove.id,
				);
				needyTeam.members.unshift(seniorToMove);

				// Recalculate lists
				teamsNeedingSenior = newTeams.filter(
					(team) => !team.members.some((m) => isSenior(m.rank)),
				);
				teamsWithMultipleSeniors = newTeams.filter(
					(team) =>
						team.members.filter((m) => isSenior(m.rank)).length > 1,
				);
				continue;
			}

			if (seniorToMove && juniorToSwap) {
				// CRITICAL CHECK: If needyTeam is B738, ONLY swap with B738-qualified juniors
				if (
					needyTeam.aircraftType === "B738" &&
					!canFlyAircraft(juniorToSwap, "B738")
				) {
					// This junior can't fly B738, don't swap
					// Remove this needyTeam from the list and try next one
					teamsNeedingSenior = teamsNeedingSenior.filter(
						(t) => t.id !== needyTeam.id,
					);
					continue;
				}

				// CRITICAL CHECK: If richTeam is B738, ONLY send out B738-qualified seniors
				if (
					richTeam.aircraftType === "B738" &&
					needyTeam.aircraftType === "ATR"
				) {
					// Can swap any senior from B738 to ATR (both can fly ATR)
				}

				// CRITICAL CHECK: If moving senior from ATR to B738, senior must be B738-qualified
				if (
					richTeam.aircraftType === "ATR" &&
					needyTeam.aircraftType === "B738"
				) {
					if (!canFlyAircraft(seniorToMove, "B738")) {
						// Senior can't fly B738, don't swap
						teamsNeedingSenior = teamsNeedingSenior.filter(
							(t) => t.id !== needyTeam.id,
						);
						continue;
					}
				}

				// Perform swap (or just move if richTeam has no juniors)
				richTeam.members = richTeam.members.filter(
					(m) => m.id !== seniorToMove.id,
				);
				needyTeam.members.unshift(seniorToMove);

				if (juniorToSwap) {
					needyTeam.members = needyTeam.members.filter(
						(m) => m.id !== juniorToSwap.id,
					);
					richTeam.members.push(juniorToSwap);
				}
				// If no junior to swap, richTeam just loses a senior (gets smaller)
			} else if (seniorToMove && !juniorToSwap) {
				// NeedyTeam has no juniors (all seniors or empty) - just move senior
				richTeam.members = richTeam.members.filter(
					(m) => m.id !== seniorToMove.id,
				);
				needyTeam.members.unshift(seniorToMove);
			} else {
				// Can't perform swap, remove needyTeam from list
				teamsNeedingSenior = teamsNeedingSenior.filter(
					(t) => t.id !== needyTeam.id,
				);
			}

			// Recalculate lists
			teamsNeedingSenior = newTeams.filter(
				(team) => !team.members.some((m) => isSenior(m.rank)),
			);
			teamsWithMultipleSeniors = newTeams.filter(
				(team) =>
					team.members.filter((m) => isSenior(m.rank)).length > 1,
			);
		}


		// FINAL VALIDATION: Remove any ATR-only people from B738 teams
		const b738TeamsForValidation = newTeams.filter(
			(t) => t.aircraftType === "B738",
		);
		const invalidPeople: User[] = [];

		b738TeamsForValidation.forEach((team) => {
			const invalidMembers = team.members.filter(
				(m) => !canFlyAircraft(m, "B738"),
			);
			if (invalidMembers.length > 0) {
				console.error(
					"ERROR: Found ATR-only users in B738 team:",
					invalidMembers.map(
						(m) => `${m.full_name} (${m.employee_id})`,
					),
				);
				// Remove them from B738
				team.members = team.members.filter((m) =>
					canFlyAircraft(m, "B738"),
				);
				// Collect them for reassignment
				invalidPeople.push(...invalidMembers);
			}
		});

		// Create new ATR teams from invalid people (pairs of 2)
		while (invalidPeople.length >= 2) {
			const newAtrTeam: Team = {
				id: `atr-${newTeams.filter((t) => t.aircraftType === "ATR").length + 1}`,
				aircraftType: "ATR",
				aircraftNumber:
					newTeams.filter((t) => t.aircraftType === "ATR").length + 1,
				members: [],
			};

			newAtrTeam.members.push(invalidPeople.shift()!);
			newAtrTeam.members.push(invalidPeople.shift()!);
			newTeams.push(newAtrTeam);
		}

		// If 1 person left and they can fly B738, try to add back to B738
		if (
			invalidPeople.length === 1 &&
			canFlyAircraft(invalidPeople[0], "B738")
		) {
			const b738WithSpace = b738TeamsForValidation.find(
				(t) => t.members.length < maxB738Crew,
			);
			if (b738WithSpace) {
				b738WithSpace.members.push(invalidPeople[0]);
				invalidPeople.shift();
			}
		}

		// Last resort: 1 ATR-only person with no pair.
		// Correct approach: find a B738-qualified person sitting in ATR,
		// move them to the needy B738, then pair their old ATR partner with the ATR-only person.
		if (invalidPeople.length === 1) {
			const atrOnlyPerson = invalidPeople[0];
			let placed = false;

			// Look for an ATR team that has a B738-qualified member AND a non-B738 partner
			const currentAtrTeams = newTeams.filter(t => t.aircraftType === "ATR");
			const needyB738 = b738TeamsForValidation
				.filter(t => t.members.length < minB738Crew)
				.sort((a, b) => a.members.length - b.members.length)[0];

			if (needyB738) {
				for (const atrTeam of currentAtrTeams) {
					const b738Qualified = atrTeam.members.find(m => canFlyAircraft(m, "B738"));
					if (b738Qualified) {
						// Move the B738-qualified person to B738
						atrTeam.members = atrTeam.members.filter(m => m.id !== b738Qualified.id);
						needyB738.members.push(b738Qualified);
						// Pair the remaining ATR member with the ATR-only person
						atrTeam.members.push(atrOnlyPerson);
						invalidPeople.shift();
						placed = true;
						break;
					}
				}
			}

			// If still not placed — pair with any existing ATR member as a duplicate group
			if (!placed && invalidPeople.length === 1) {
				const anyAtr = newTeams.find(t => t.aircraftType === "ATR");
				if (anyAtr && anyAtr.members.length > 0) {
					const pair = anyAtr.members[anyAtr.members.length - 1];
					const extraTeam: Team = {
						id: `atr-extra-orphan`,
						aircraftType: "ATR",
						aircraftNumber: newTeams.filter(t => t.aircraftType === "ATR").length + 1,
						members: [invalidPeople.shift()!, pair],
					};
					newTeams.push(extraTeam);
				}
			}
		}

		// Any still-remaining person is truly unassignable
		if (invalidPeople.length > 0) {
			console.warn(
				"Warning: Could not assign:",
				invalidPeople.map((p) => p.full_name),
			);
		}

		// CRITICAL VALIDATION: Ensure ATR teams have EXACTLY 2 people
		newTeams.filter(t => t.aircraftType === "ATR").forEach((team) => {
			if (team.members.length > 2) {
				console.error(
					"CRITICAL ERROR: ATR team has more than 2 members:",
					team.members.length,
					team.members.map((m) => m.full_name),
				);
				// Remove excess members (this should never happen)
				const excess = team.members.splice(2);
				console.error(
					"Removed excess members:",
					excess.map((m) => m.full_name),
				);
			} else if (team.members.length < 2) {
				console.error(
					"CRITICAL ERROR: ATR team has fewer than 2 members:",
					team.members.length,
				);
			}
		});


		// ===== B738 REBALANCING: run AFTER removing invalid members =====
		// So any members removed by validation don't leave B738 under minimum.
		const b738Teams = newTeams.filter(t => t.aircraftType === "B738");
		const atrTeams  = newTeams.filter(t => t.aircraftType === "ATR");
		for (const b738Team of b738Teams) {
			while (b738Team.members.length < minB738Crew) {
				// Strategy 1: steal from richest B738 (if it has > minB738Crew)
				const richestB738 = b738Teams
					.filter(t => t.id !== b738Team.id && t.members.length > minB738Crew)
					.sort((a, b) => b.members.length - a.members.length)[0];
				if (richestB738) {
					b738Team.members.push(richestB738.members.pop()!);
					continue;
				}
				// Strategy 2: pull B738-qualified member from ATR (only if ATR keeps ≥ 2)
				let moved = false;
				for (const atrTeam of atrTeams) {
					const q = atrTeam.members.find(m => canFlyAircraft(m, "B738"));
					if (q && atrTeam.members.length > 2) {
						atrTeam.members = atrTeam.members.filter(m => m.id !== q.id);
						b738Team.members.push(q);
						moved = true;
						break;
					}
				}
				if (!moved) {
					console.warn(`Cannot fill ${b738Team.id} to min ${minB738Crew}`);
					break;
				}
			}
		}

				// ===== ASSIGN CORE SCENARIOS TO TEAMS =====
		// Ensure minimum 6 teams for 6 scenarios
		
		// If we have fewer than 6 teams, create extra ATR teams with random members
		while (newTeams.length < 6) {
			const allMembers = newTeams.flatMap(t => t.members);
			
			// Get unique members by ID
			const uniqueMembers = Array.from(
				new Map(allMembers.map(m => [m.id, m])).values()
			);
			
			if (uniqueMembers.length < 2) {
				console.warn('Not enough unique people to create 6 teams');
				break;
			}
			
			// Randomly pick 2 DIFFERENT members
			const shuffled = [...uniqueMembers].sort(() => Math.random() - 0.5);
			const member1 = shuffled[0];
			const member2 = shuffled[1]; // Guaranteed to be different from member1
			
			const extraTeam: Team = {
				id: `atr-extra-${newTeams.filter((t) => t.aircraftType === "ATR").length + 1}`,
				aircraftType: "ATR",
				aircraftNumber: newTeams.filter((t) => t.aircraftType === "ATR").length + 1,
				members: [member1, member2]
			};
			
			newTeams.push(extraTeam);
			console.log(`Created extra ATR team ${extraTeam.id} to reach 6 teams minimum`);
		}
		
		// Shuffle scenarios and assign to teams
		const shuffledScenarios = [...coreScenarios].sort(() => Math.random() - 0.5);
		newTeams.forEach((team, idx) => {
			team.coreScenario = shuffledScenarios[idx % 6];
		});

		setTeams(newTeams);
		setShowTeams(true);
	};

	const saveGroups = async () => {
		if (teams.length === 0) {
			alert('請先分組！');
			return;
		}
		
		if (!confirm(`確定要儲存 ${selectedDate} 的分組？`)) {
			return;
		}
		
		try {
			const token = localStorage.getItem("token");
			if (!token) {
				alert("請先登入");
				return;
			}
			
			// Flatten teams to individual records
			const sessionsToSave = teams.flatMap(team => 
				team.members.map(member => ({
					training_date: selectedDate,
					employee_id: member.employee_id,
					group_type: team.aircraftType,
					group_number: team.aircraftNumber,
					core_scenario: team.coreScenario || 'unassigned',
					team_members: team.members.map(m => m.employee_id)
				}))
			);
			
			const response = await fetch('/api/mdafaat/training-sessions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ sessions: sessionsToSave })
			});
			
			if (!response.ok) {
				throw new Error('Failed to save groups');
			}
			
			alert(`✅ 成功儲存 ${teams.length} 組！`);
			
			// Reload training sessions - include today (use next day as before filter)
			const nextDay = new Date(selectedDate);
			nextDay.setDate(nextDay.getDate() + 1);
			const nextDayStr = nextDay.toISOString().split('T')[0];
			const reloadResponse = await fetch(`/api/mdafaat/training-sessions?before=${nextDayStr}`);
			if (reloadResponse.ok) {
				const data = await reloadResponse.json();
				const userIds = new Set(data.map((d: any) => d.employee_id));
				setTrainedUserIds(userIds);
			}
		} catch (error) {
			console.error('Error saving groups:', error);
			alert('❌ 儲存失敗！');
		}
	};

	const loadGroupsForDate = async (date: string) => {
		try {
			const token = localStorage.getItem("token");
			const headers: Record<string,string> = token ? { Authorization: `Bearer ${token}` } : {};

			// Try pending-groups first (formed but not yet trained)
			const pgRes = await fetch(`/api/mdafaat/pending-groups?date=${date}`, { headers });
			if (pgRes.ok) {
				const pendingGroups = await pgRes.json();
				if (Array.isArray(pendingGroups) && pendingGroups.length > 0) {
					const loadedTeams: Team[] = [];
					for (const pg of pendingGroups) {
						const memberIds = new Set(
							(pg.members as any[]).map((m: any) =>
								String(m.employeeId ?? m.employee_id ?? m.userId ?? m)
							)
						);
						const members = allUsers.filter(u => memberIds.has(u.employee_id));
						if (members.length > 0) {
							loadedTeams.push({
								id: `${pg.group_type}-${pg.group_number}`.toLowerCase(),
								aircraftType: pg.aircraft_type ?? pg.group_type,
								aircraftNumber: pg.aircraft_number ?? pg.group_number,
								coreScenario: pg.core_scenario,
								pendingGroupId: pg.id,
								members,
							});
						}
					}
					if (loadedTeams.length > 0) {
						setTeams(loadedTeams);
						setShowTeams(true);
						// Do NOT populate pool here — only restored via 返回編輯
						return;
					}
				}
			}

			// Fall back: load from training-sessions (completed records)
			const tsRes = await fetch(`/api/mdafaat/training-sessions?date=${date}`);
			if (!tsRes.ok) return;
			const sessions = await tsRes.json();
			if (!sessions || sessions.length === 0) {
				setTeams([]);
				setShowTeams(false);
				return;
			}
			const groupMap = new Map<string, any>();
			sessions.forEach((session: any) => {
				const key = `${session.group_type}-${session.group_number}`;
				if (!groupMap.has(key)) {
					groupMap.set(key, {
						id: key.toLowerCase(),
						aircraftType: session.group_type,
						aircraftNumber: session.group_number,
						coreScenario: session.core_scenario,
						memberIds: new Set(
							Array.isArray(session.team_members)
								? session.team_members.map((m: any) =>
										typeof m === "object"
											? String(m.employeeId ?? m.employee_id)
											: String(m)
									)
								: []
						),
					});
				}
			});
			const loadedTeams: Team[] = [];
			for (const [, groupData] of groupMap) {
				const members = allUsers.filter(u => groupData.memberIds.has(u.employee_id));
				if (members.length > 0) {
					loadedTeams.push({
						id: groupData.id,
						aircraftType: groupData.aircraftType,
						aircraftNumber: groupData.aircraftNumber,
						coreScenario: groupData.coreScenario,
						members,
					});
				}
			}
			if (loadedTeams.length > 0) {
				setTeams(loadedTeams);
				setShowTeams(true);
				// Do NOT populate pool here — only restored via 返回編輯
			}
		} catch (error) {
			console.error('Error loading groups:', error);
		}
	};

	const clearAllTrainingData = () => {
		if (!canEditScenarios) {
			setTfToast({ ok: false, text: '您沒有權限執行此操作！' });
			setTimeout(() => setTfToast(null), 3000);
			return;
		}
		setTfConfirm({
			lines: ['⚠️ 這將永久刪除所有訓練記錄！', '此操作無法復原，確定要繼續嗎？'],
			onConfirm: async () => {
				setTfConfirm(null);
				const token = localStorage.getItem("token");
				if (!token) { setTfToast({ ok: false, text: '請先登入' }); setTimeout(() => setTfToast(null), 3000); return; }
				try {
					const res = await fetch('/api/mdafaat/training-sessions', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
					if (!res.ok) throw new Error('Failed');
					setTrainedUserIds(new Set());
					setTfToast({ ok: true, text: '✅ 所有訓練資料已清除！' });
					setTimeout(() => setTfToast(null), 3000);
				} catch (e) {
					setTfToast({ ok: false, text: '❌ 清除失敗！' });
					setTimeout(() => setTfToast(null), 4000);
				}
			},
		});
	};

	// ── Data maintenance: scan all sessions, find skeletons & missing groups ───
	const openMaintModal = async () => {
		setMaintLoading(true);
		setMaintModal(true);
		setCleanupConfirmed(false);
		try {
			const token = localStorage.getItem("token");
			const res = await fetch('/api/mdafaat/training-sessions', { headers: { 'Authorization': `Bearer ${token}` } });
			const allSessions: any[] = await res.json();

			// Separate completed vs skeleton rows
			const completed = allSessions.filter(s => s.result || s.elapsed_time || s.scenario_path);
			const skeletons = allSessions.filter(s => !s.result && !s.elapsed_time && !s.scenario_path);

			// Build a Set of completed group keys: "date|type|number"
			const completedKeys = new Set(completed.map(s => `${s.training_date}|${s.group_type}|${s.group_number}`));

			// Skeletons whose group HAS a completed session → safe to delete
			const safeToDelete = skeletons.filter(s =>
				completedKeys.has(`${s.training_date}|${s.group_type}|${s.group_number}`)
			);

			// Skeletons whose group has NO completed session → missing records
			// Group by date+type+number, keep one entry per group
			const missingMap = new Map<string, any>();
			skeletons
				.filter(s => !completedKeys.has(`${s.training_date}|${s.group_type}|${s.group_number}`))
				.forEach(s => {
					const key = `${s.training_date}|${s.group_type}|${s.group_number}`;
					if (!missingMap.has(key)) {
						missingMap.set(key, {
							date: s.training_date,
							group_type: s.group_type,
							group_number: s.group_number,
							core_scenario: s.core_scenario,
							skeletonIds: [],
							team_members: s.team_members ?? [],
							selected: false,
						});
					}
					missingMap.get(key).skeletonIds.push(s.id);
					// Accumulate team_members across rows (pick first non-empty)
					if (missingMap.get(key).team_members.length === 0 && s.team_members?.length > 0) {
						missingMap.get(key).team_members = s.team_members;
					}
				});

			// Find instructor from completed sessions on same dates
			const instructorByDate = new Map<string, string>();
			completed.forEach(s => {
				if (s.instructor && !instructorByDate.has(s.training_date)) {
					instructorByDate.set(s.training_date, s.instructor);
				}
			});

			// Build a lookup map from allUsers for resolving plain employee ID strings
			const userLookup = new Map(allUsers.map(u => [u.employee_id, u]));

			// Helper: normalise team_members — converts plain string IDs to full objects
			const resolveMembers = (raw: any[]): Array<{userId:string;name:string;employeeId:string;rank:string}> => {
				return raw.map(m => {
					if (typeof m === 'object' && m.employeeId) return m;
					const eid = String(m);
					const u = userLookup.get(eid);
					return u
						? { userId: u.id, name: u.full_name, employeeId: u.employee_id, rank: u.rank }
						: { userId: eid, name: eid, employeeId: eid, rank: '' };
				});
			};

			// Resolve skeletons for cleanup display — add name for each row
			setSkeletonsToDelete(safeToDelete.map(s => {
				const u = userLookup.get(s.employee_id);
				return {
					id: s.id, training_date: s.training_date, employee_id: s.employee_id,
					employee_name: u?.full_name ?? '',
					group_type: s.group_type, group_number: s.group_number, core_scenario: s.core_scenario,
				};
			}));
			// Resolve team_members for missing groups
			setMissingGroups(Array.from(missingMap.values()).map(g => ({
				...g,
				team_members: resolveMembers(g.team_members),
				instructor: instructorByDate.get(g.date) ?? '',
			})));
		} catch (e) {
			setMaintToast({ ok: false, text: '❌ 載入失敗' });
			setTimeout(() => setMaintToast(null), 4000);
		} finally {
			setMaintLoading(false);
		}
	};

	// ── Cleanup: delete skeleton rows that have completed counterparts ────────
	const runCleanup = async () => {
		const ids = skeletonsToDelete.map(s => s.id);
		if (ids.length === 0) return;
		const token = localStorage.getItem("token");
		try {
			const res = await fetch(`/api/mdafaat/training-sessions?ids=${ids.join(',')}`, {
				method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
			});
			if (!res.ok) throw new Error('Failed');
			setMaintToast({ ok: true, text: `✅ 已清除 ${ids.length} 筆不完整資料` });
			setSkeletonsToDelete([]);
			setTimeout(() => setMaintToast(null), 3000);
		} catch (e) {
			setMaintToast({ ok: false, text: '❌ 清除失敗' });
			setTimeout(() => setMaintToast(null), 4000);
		}
	};

	// ── Generate fake record for a missing group ──────────────────────────────
	const generateFakeRecord = async (grp: typeof missingGroups[number]) => {
		const token = localStorage.getItem("token");
		try {
			// 1. Fetch scenario cards from API
			const scenRes = await fetch(`/api/mdafaat/scenarios?core_scenario=${grp.core_scenario}`, {
				headers: { 'Authorization': `Bearer ${token}` },
			});
			if (!scenRes.ok) throw new Error('Failed to fetch scenario');
			const scenData = await scenRes.json();
			if (scenData.error) throw new Error(scenData.error);

			// Build scenario_path from returned cards
			const allCards = [...(scenData.emergency ?? []), ...(scenData.equipment ?? [])];
			const path = allCards
				.sort((a: any, b: any) => a.id - b.id)
				.map((c: any) => ({ code: c.code, title: c.title, description: c.description ?? '', skipped: false }));

			// 2. Randomize conditions
			const times = ['morning', 'midday', 'night'] as const;
			const specialPaxList = ['WCHR - 輪椅旅客', 'BLND - 視障旅客', 'PRGN - 孕婦旅客', 'POXY - 需氧旅客', null, null, null];
			const conditions = {
				time: times[Math.floor(Math.random() * 3)],
				full: Math.random() > 0.4,
				infants: Math.random() > 0.6,
				specialPax: specialPaxList[Math.floor(Math.random() * specialPaxList.length)],
			};

			// 3. Random flight (simple fallback — no base lookup here)
			const flightNos: Record<string, string[]> = {
				morning: ['AE-301', 'AE-333', 'AE-761', 'AE-391'],
				midday:  ['AE-303', 'AE-343', 'AE-763', 'AE-367'],
				night:   ['AE-349', 'AE-731', 'AE-793', 'AE-395'],
			};
			const fList = flightNos[conditions.time];
			const flight_info = {
				flightNo: fList[Math.floor(Math.random() * fList.length)],
				departure: 'KHH', arrival: 'MZG',
				aircraftType: grp.group_type === 'B738' ? 'B738' : 'ATR',
			};

			// 4. Random elapsed time 3–8 min
			const elapsed_time = Math.floor(Math.random() * 300) + 180;

			// 5. Build one session row per member
			// team_members may already be resolved objects (from openMaintModal) or plain ID strings
			const userMap = new Map(allUsers.map(u => [u.employee_id, u]));
			const members: any[] = Array.isArray(grp.team_members)
				? grp.team_members.map((m: any) => {
					if (typeof m === 'object' && m.employeeId) return m;
					const eid = String(m);
					const u = userMap.get(eid);
					return u
						? { userId: u.id, name: u.full_name, employeeId: u.employee_id, rank: u.rank }
						: { userId: eid, name: eid, employeeId: eid, rank: '' };
				}).filter((m: any) => m.employeeId)
				: [];

			if (members.length === 0) throw new Error('No valid members found in skeleton');

			const sessions = members.map((m: any) => ({
				training_date: grp.date,
				employee_id:   String(m.employeeId),
				group_type:    grp.group_type,
				group_number:  grp.group_number,
				core_scenario: grp.core_scenario,
				team_members:  members,
				result:        'pass',
				is_redo:       false,
				scenario_path: path,
				conditions,
				flight_info,
				elapsed_time,
				instructor:    (grp as any).instructor ?? '',
			}));

			// 6. Save via POST
			const saveRes = await fetch('/api/mdafaat/training-sessions', {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessions }),
			});
			if (!saveRes.ok) throw new Error('Failed to save');

			// Remove from missingGroups list
			setMissingGroups(prev => prev.filter(g =>
				!(g.date === grp.date && g.group_type === grp.group_type && g.group_number === grp.group_number)
			));
			setMaintToast({ ok: true, text: `✅ 已補建 ${grp.group_type} ${grp.group_number} (${grp.date}) 訓練記錄` });
			setTimeout(() => setMaintToast(null), 3000);
		} catch (e: any) {
			setMaintToast({ ok: false, text: `❌ 補建失敗：${e.message}` });
			setTimeout(() => setMaintToast(null), 4000);
		}
	};

	const getRankShorthand = (rank: string): string => {
		if (rank.includes("MG")) return "MG";
		if (rank.includes("SC")) return "SC";
		if (rank.includes("FI")) return "FI";
		if (rank.includes("PR")) return "PR";
		if (rank.includes("LF")) return "LF";
		if (rank.includes("FS")) return "FS";
		if (rank.includes("FA")) return "FA";
		return rank.split(" - ")[0] || rank.substring(0, 2);
	};

	const SCENARIO_LABELS: Record<string, string> = {
		bomb_threat: "爆裂物威脅", lithium_fire: "鋰電池火災",
		decompression: "失壓", incapacitation: "失能",
		unplanned_evacuation: "無預警撤離", planned_evacuation: "客艙準備 CPP",
	};

	return (
		<div className={styles.container}>
			{/* ── tfToast ── */}
			{tfToast && (
				<div style={{
					position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)',
					zIndex: 9998, padding: '0.6rem 1.25rem', borderRadius: '0.5rem',
					fontWeight: 600, fontSize: '0.95rem', pointerEvents: 'none',
					background: tfToast.ok ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
					color: tfToast.ok ? '#10b981' : '#ef4444',
					border: `1px solid ${tfToast.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
				}}>{tfToast.text}</div>
			)}
			{/* ── tfConfirm modal ── */}
			{tfConfirm && (
				<div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
					<div style={{ background: '#1e293b', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '0.75rem', padding: '2rem', maxWidth: '360px', width: '90%', textAlign: 'center' }}>
						{tfConfirm.lines.map((line, i) => (
							<p key={i} style={{ color: i === 0 ? '#ef4444' : '#a0aec0', marginBottom: '0.5rem', fontWeight: i === 0 ? 700 : 400 }}>{line}</p>
						))}
						<div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
							<button onClick={() => setTfConfirm(null)} style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e8e9ed', cursor: 'pointer', fontWeight: 600 }}>取消</button>
							<button onClick={tfConfirm.onConfirm} style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>確認</button>
						</div>
					</div>
				</div>
			)}
			{/* ── 資料維護 modal ── */}
			{maintModal && (
				<div style={{ position: 'fixed', inset: 0, zIndex: 9997, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
					<div style={{ background: '#1e293b', border: '1px solid rgba(124,58,237,0.4)', borderRadius: '0.75rem', padding: '1.75rem', width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
						{/* Header */}
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
							<p style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '1.05rem' }}>🔧 資料維護</p>
							<button onClick={() => setMaintModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
						</div>
						{/* Tab selector */}
						<div style={{ display: 'flex', gap: '0.5rem' }}>
							{(['cleanup', 'generate'] as const).map(tab => (
								<button key={tab} onClick={() => setMaintTab(tab)} style={{
									padding: '0.4rem 0.9rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
									border: maintTab === tab ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
									background: maintTab === tab ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
									color: maintTab === tab ? '#c4b5fd' : '#64748b',
								}}>
									{tab === 'cleanup' ? '🧹 清除不完整資料' : '🛠️ 補建遺漏記錄'}
								</button>
							))}
						</div>
						{/* Toast inside modal */}
						{maintToast && (
							<div style={{ padding: '0.5rem 0.9rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem',
								background: maintToast.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
								color: maintToast.ok ? '#10b981' : '#ef4444',
								border: `1px solid ${maintToast.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
							}}>{maintToast.text}</div>
						)}
						{maintLoading ? (
							<div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>載入中...</div>
						) : maintTab === 'cleanup' ? (
							/* ── Cleanup tab ── */
							<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
								<p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
									以下為有完整記錄對應的不完整骨架資料，可安全刪除。<br/>
									<span style={{ color: '#4ade80' }}>您的實際訓練記錄不會受影響。</span>
								</p>
								{skeletonsToDelete.length === 0 ? (
									<div style={{ color: '#334155', padding: '1.5rem', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '0.5rem' }}>
										✅ 沒有需要清除的不完整資料
									</div>
								) : (
									<>
										{/* Preview table */}
										<div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', overflow: 'hidden', maxHeight: '280px', overflowY: 'auto' }}>
											<table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
												<thead>
													<tr style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b' }}>
														<th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>ID</th>
														<th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>日期</th>
														<th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>員編</th>
														<th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>姓名</th>
														<th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>組別</th>
														<th style={{ padding: '0.4rem 0.6rem', textAlign: 'left' }}>情境</th>
													</tr>
												</thead>
												<tbody>
													{skeletonsToDelete.map(s => (
														<tr key={s.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
															<td style={{ padding: '0.35rem 0.6rem', color: '#64748b', fontFamily: 'monospace' }}>{s.id}</td>
															<td style={{ padding: '0.35rem 0.6rem' }}>{s.training_date}</td>
															<td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', color: '#4a9eff' }}>{s.employee_id}</td>
															<td style={{ padding: '0.35rem 0.6rem', color: '#e2e8f0' }}>{s.employee_name || '—'}</td>
															<td style={{ padding: '0.35rem 0.6rem' }}>{s.group_type} {s.group_number}</td>
															<td style={{ padding: '0.35rem 0.6rem', color: '#94a3b8' }}>
																{SCENARIO_LABELS[s.core_scenario] ?? s.core_scenario}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
										<p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>共 {skeletonsToDelete.length} 筆將被刪除</p>
										{!cleanupConfirmed ? (
											<button onClick={() => setCleanupConfirmed(true)} style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', cursor: 'pointer', fontWeight: 600 }}>
												確認刪除以上資料
											</button>
										) : (
											<button onClick={runCleanup} style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
												⚠️ 最終確認：執行清除
											</button>
										)}
									</>
								)}
							</div>
						) : (
							/* ── Generate tab ── */
							<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
								<p style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
									以下組別有分組記錄但缺少完整訓練記錄。點擊「補建」為該組生成假資料。
								</p>
								{missingGroups.length === 0 ? (
									<div style={{ color: '#334155', padding: '1.5rem', textAlign: 'center', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '0.5rem' }}>
										✅ 沒有遺漏的訓練記錄
									</div>
								) : missingGroups.map((grp, i) => (
									<div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.9rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.06)', gap: '0.75rem' }}>
										<div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
											<span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.85rem' }}>
												{grp.group_type} {grp.group_number} &nbsp;
												<span style={{ color: '#fbbf24', fontSize: '0.78rem' }}>
													{SCENARIO_LABELS[grp.core_scenario] ?? grp.core_scenario}
												</span>
											</span>
											<span style={{ color: '#64748b', fontSize: '0.75rem' }}>
												{grp.date} &nbsp;·&nbsp; {grp.team_members.length} 位成員
											</span>
										</div>
										<button
											onClick={() => generateFakeRecord(grp)}
											style={{ padding: '0.4rem 0.9rem', borderRadius: '0.375rem', background: 'rgba(74,158,255,0.15)', border: '1px solid rgba(74,158,255,0.4)', color: '#60a5fa', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0 }}
										>
											🛠️ 補建
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}
			<div className={styles.header}>
				<h2 className={styles.title}>
					<Users className={styles.titleIcon} />
					分組系統 Team Formation
				</h2>
				<p className={styles.subtitle}>搜尋學員並安排分組</p>
			</div>

			{/* Date Filter Section */}
			<div style={{ 
				display: 'flex', 
				gap: '1rem', 
				alignItems: 'center',
				marginBottom: '1rem',
				padding: '1rem',
				background: 'rgba(30, 41, 59, 0.5)',
				borderRadius: '0.5rem',
				flexWrap: 'wrap'
			}}>
				<label style={{ color: '#e2e8f0', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
					訓練日期 Training Date:
				</label>
				{/* Date selector — keep the manual input for flexibility, but add a
				    dropdown of dates that already have records (with 📋 indicator).
				    Selecting a date with records restores teams via loadGroupsForDate. */}
				<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
					<input
						type="date"
						value={selectedDate}
						onChange={(e) => setSelectedDate(e.target.value)}
						style={{
							padding: '0.5rem',
							borderRadius: '0.375rem',
							border: datesWithGroups.has(selectedDate)
								? '1px solid rgba(74, 158, 255, 0.6)'
								: '1px solid rgba(148, 163, 184, 0.3)',
							background: '#1e293b',
							color: '#e2e8f0',
							fontSize: '0.875rem',
						}}
					/>
					{datesWithGroups.size > 0 && (
						<select
							value={selectedDate}
							onChange={(e) => setSelectedDate(e.target.value)}
							style={{
								padding: '0.5rem',
								borderRadius: '0.375rem',
								border: '1px solid rgba(74, 158, 255, 0.3)',
								background: '#1e293b',
								color: '#e2e8f0',
								fontSize: '0.875rem',
								cursor: 'pointer',
							}}
						>
							<option value="" disabled>📋 已有記錄的日期</option>
							{Array.from(datesWithGroups).sort((a, b) => b.localeCompare(a)).map(d => (
								<option key={d} value={d}>📋 {d}</option>
							))}
						</select>
					)}
					{datesWithGroups.has(selectedDate) && (
						<span style={{ fontSize: '0.8rem', color: '#4a9eff', whiteSpace: 'nowrap' }}>
							📋 此日已有分組記錄
						</span>
					)}
				</div>
				{loadingTrainingSessions && (
					<span style={{ fontSize: '0.875rem', color: '#4a9eff' }}>
						載入中... Loading...
					</span>
				)}
				{canEditScenarios && (
					<button
						onClick={clearAllTrainingData}
						style={{ 
							padding: '0.5rem 1rem',
							borderRadius: '0.375rem',
							background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
							color: '#ffffff',
							border: 'none',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem',
							fontSize: '0.875rem',
							fontWeight: '500',
							whiteSpace: 'nowrap'
						}}
					>
						<Trash2 size={16} />
						刪除訓練紀錄
					</button>
				)}
				{/* 🔧 資料維護 — admin only (employee 51892 or view_only=false) */}
				{canEditScenarios && (
					<button
						onClick={openMaintModal}
						style={{
							padding: '0.5rem 1rem',
							borderRadius: '0.375rem',
							background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
							color: '#ffffff',
							border: 'none',
							cursor: 'pointer',
							display: 'flex',
							alignItems: 'center',
							gap: '0.5rem',
							fontSize: '0.875rem',
							fontWeight: '500',
							whiteSpace: 'nowrap',
						}}
					>
						🔧 資料維護
					</button>
				)}

			</div>

			{/* Search Section */}
			<div className={styles.searchSection}>
				<div className={styles.searchBar}>
					<Search className={styles.searchIcon} />
					<input
						type="text"
						placeholder="搜尋員工編號或姓名... (Search by ID or Name)"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className={styles.searchInput}
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery("")}
							className={styles.clearButton}
						>
							<X size={18} />
						</button>
					)}
				</div>

				{/* Available Users List */}
				{loadingUsers ? (
					<div className={styles.loadingState}>
						<Image
							src="/K-dogmatic.png"
							alt="Loading"
							width={120}
							height={120}
							className={styles.loadingImage}
							priority
						/>
						<div>載入學員中...</div>
					</div>
				) : (
					<div className={styles.usersList}>
						<div className={styles.usersListHeader}>
							<span className={styles.usersListTitle}>
								學員清單 ({getAvailableUsers().length})
							</span>
						</div>
						<div className={styles.usersListContent}>
							{getAvailableUsers().length === 0 ? (
								<div className={styles.emptyState}>
									{searchQuery
										? "沒有符合的學員"
										: "所有學員已加入池中"}
								</div>
							) : (
								getAvailableUsers().map((user) => (
									<div
										key={user.id}
										className={styles.userListItem}
									>
										<div className={styles.userInfo}>
											<Avatar
												employeeId={user.employee_id}
												fullName={user.full_name}
												size="small"
											/>
											<div className={styles.userDetails}>
												<span
													className={styles.userName}
												>
													{user.full_name}
												</span>
												<span
													className={styles.userMeta}
												>
													{user.employee_id} •{" "}
													{getRankShorthand(
														user.rank,
													)}
												</span>
											</div>
										</div>
										<button
											onClick={() => addToPool(user)}
											className={styles.addButton}
										>
											點選
										</button>
									</div>
								))
							)}
						</div>
					</div>
				)}
			</div>

			{/* User Pool */}
			{userPool.length > 0 && (
				<>
					<div className={styles.poolSection}>
						<div className={styles.poolHeader}>
							<h3 className={styles.poolTitle}>
								挑選學員清單 ({userPool.length} 人)
							</h3>
							<button
								onClick={clearPool}
								className={styles.clearPoolButton}
							>
								清空
							</button>
						</div>

						<div className={styles.poolGrid}>
							{userPool
								.sort((a, b) => {
									const aRankOrder = getRankOrder(a.rank);
									const bRankOrder = getRankOrder(b.rank);

									if (aRankOrder !== bRankOrder) {
										return aRankOrder - bRankOrder;
									}

									return a.employee_id.localeCompare(
										b.employee_id,
										undefined,
										{ numeric: true },
									);
								})
								.map((user) => (
									<div
										key={user.id}
										className={styles.poolCard}
									>
										<button
											onClick={() =>
												removeFromPool(user.id)
											}
											className={styles.removeButton}
										>
											<X size={16} />
										</button>
										<Avatar
											employeeId={user.employee_id}
											fullName={user.full_name}
											size="medium"
										/>
										<div className={styles.poolCardInfo}>
											<span
												className={styles.poolCardName}
											>
												{user.full_name}
											</span>
											<span
												className={styles.poolCardMeta}
											>
												{user.employee_id}
											</span>
											<div
												className={
													styles.poolCardRatings
												}
											>
												<span
													className={`${styles.poolCardRank} ${
														isSenior(user.rank)
															? styles.seniorRank
															: styles.juniorRank
													}`}
												>
													{getRankShorthand(
														user.rank,
													)}
												</span>
												{user.aircraft_type_ratings &&
													user.aircraft_type_ratings
														.length > 0 && (
														<span
															className={
																styles.aircraftRatings
															}
														>
															{user.aircraft_type_ratings.includes(
																"B738",
															) && (
																<IoAirplane
																	className={
																		styles.b738RatingIcon
																	}
																/>
															)}
															{user.aircraft_type_ratings.includes(
																"ATR",
															) && (
																<GiBoatPropeller
																	className={
																		styles.atrRatingIcon
																	}
																/>
															)}
														</span>
													)}
											</div>
										</div>
									</div>
								))}
						</div>
					</div>

					{/* Aircraft Configuration - Only show when pool has users and teams not formed */}
					{!showTeams && (
						<div className={styles.configSection}>
							<h3 className={styles.configTitle}>機型配置</h3>

							<div className={styles.configGrid}>
								<div className={styles.configGroup}>
									<label className={styles.configLabel}>
										B738 機數
									</label>
									<div className={styles.counterButtons}>
										<button
											onClick={() =>
												setAircraftCount(
													Math.max(
														0,
														aircraftCount - 1,
													),
												)
											}
											className={styles.counterButton}
										>
											-
										</button>
										<span className={styles.counterValue}>
											{aircraftCount}
										</span>
										<button
											onClick={() =>
												setAircraftCount(
													aircraftCount + 1,
												)
											}
											className={styles.counterButton}
										>
											+
										</button>
									</div>
								</div>

								<div className={styles.configGroup}>
									<label className={styles.configLabel}>
										ATR 機數 (自動計算)
									</label>
									<div className={styles.autoCount}>
										{(() => {
											const b738Crew = aircraftCount * 4; // Start with 4 crew per B738
											const remaining = Math.max(
												0,
												userPool.length - b738Crew,
											);
											return Math.ceil(remaining / 2);
										})()}{" "}
										架
									</div>
								</div>
							</div>

							{/* Configuration Warning */}
							{configWarning && (
								<div className={styles.warningMessage} style={{ marginTop: '1rem', marginBottom: '1rem' }}>
									{configWarning}
								</div>
							)}

							<button
								onClick={formTeams}
								className={styles.formTeamsButton}
							>
								<Shuffle size={20} />
								分組
							</button>
						</div>
					)}
				</>
			)}

			{/* Teams Display */}
			{showTeams && teams.length > 0 && (
				<div className={styles.teamsSection}>
					<div className={styles.teamsHeader}>
						<h3 className={styles.teamsTitle}>
							分組結果 ({teams.length} 組)
						</h3>
						<div className={styles.teamsActions}>
							<button
								onClick={formTeams}
								className={styles.reshuffleButton}
							>
								<Shuffle size={18} />
								重新分組
							</button>
							<button
								onClick={saveGroups}
								className={styles.reshuffleButton}
								style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
							>
								<Save size={18} />
								儲存分組
							</button>
							<button
								onClick={() => {
									// Restore all group members back into the selectable pool
									const allMembers = teams.flatMap(t => t.members);
									const unique = Array.from(new Map(allMembers.map(m => [m.id, m])).values());
									setUserPool(unique);
									setShowTeams(false);
									setTeams([]);
								}}
								className={styles.backButton}
							>
								返回編輯
							</button>
						</div>
					</div>

					{/* Warning for odd number of people */}
					{teams.some((t) => t.members.length === 3) && (
						<div className={styles.warningMessage}>
							⚠️ 注意：學員人數為奇數，有一架飛機配置 3 名組員
						</div>
					)}

					<div className={styles.teamsGrid}>
						{teams.map((team) => {
							// Sort team members by rank hierarchy using centralized getRankOrder
							const sortedMembers = [...team.members].sort(
								(a, b) => {
									const aRankOrder = getRankOrder(a.rank);
									const bRankOrder = getRankOrder(b.rank);

									if (aRankOrder !== bRankOrder) {
										return aRankOrder - bRankOrder;
									}

									return a.employee_id.localeCompare(
										b.employee_id,
										undefined,
										{ numeric: true },
									);
								},
							);

							return (
								<div key={team.id} className={styles.teamCard}>
									<div className={styles.teamHeader}>
										{team.aircraftType === "B738" ? (
											<IoAirplane
												className={styles.jetIcon}
											/>
										) : (
											<GiBoatPropeller
												className={styles.propIcon}
											/>
										)}
										<div className={styles.teamInfo}>
											<span className={styles.teamName}>
												{team.aircraftType} #
												{team.aircraftNumber}
											</span>
											{team.coreScenario && (
												<div style={{
													background: 'rgba(74, 158, 255, 0.2)',
													padding: '0.25rem 0.5rem',
													borderRadius: '0.375rem',
													fontSize: '0.7rem',
													color: '#4a9eff',
													border: '1px solid rgba(74, 158, 255, 0.3)',
													marginTop: '0.25rem',
													textAlign: 'center'
												}}>
													📋 {team.coreScenario.replace(/_/g, ' ').toUpperCase()}
												</div>
											)}
											<span className={styles.teamCount}>
												{team.members.length} 人
											</span>
										</div>
									</div>

									<div className={styles.teamMembers}>
										{sortedMembers.map((member, idx) => {
											// Determine if this member should show the badge
											const teamHasSenior =
												sortedMembers.some((m) =>
													isSenior(m.rank),
												);
											const showBadge = teamHasSenior
												? isSenior(member.rank) &&
													idx === 0 // If team has seniors, show on first senior
												: idx === 0; // If no seniors, show on first person (most senior by hierarchy)

											return (
												<div
													key={member.id}
													className={
														styles.teamMember
													}
												>
													<span
														className={styles.memberNumber}
													>
														{team.aircraftType === "B738"
															? (["1L","1R","3L","3R","Z2","3RA"][idx] ?? `P${idx+1}`)
															: (["F1","F2"][idx] ?? `P${idx+1}`)}
													</span>
													<Avatar
														employeeId={
															member.employee_id
														}
														fullName={
															member.full_name
														}
														size="small"
													/>
													<div
														className={
															styles.memberDetails
														}
													>
														<span
															className={
																styles.memberName
															}
														>
															{member.full_name}
														</span>
														<span
															className={
																styles.memberMeta
															}
														>
															{member.employee_id}{" "}
															•{" "}
															{getRankShorthand(
																member.rank,
															)}
														</span>
													</div>
													{showBadge && (
														<span
															className={
																styles.seniorBadge
															}
														>
															資深
														</span>
													)}
												</div>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>

					<button
						onClick={() => {
							// Convert teams to format MDAfaatGame expects
							const gameTeams = teams.map(team => ({
								name: `${team.aircraftType} ${team.aircraftNumber}`,
								coreScenario: team.coreScenario,
								aircraftType: team.aircraftType,
								aircraftNumber: team.aircraftNumber,
								members: team.members.map(member => ({
									userId: member.id,
									name: member.full_name,
									employeeId: member.employee_id,
									rank: member.rank,
									base: member.base,
									avatarUrl: undefined
								}))
							}));
							onStartGame(gameTeams, selectedDate);
						}}
						className={styles.startGameButton}
					>
						開始訓練 Start Training
						<ArrowRight size={20} />
					</button>
				</div>
			)}
		</div>
	);
};

export default TeamFormation;