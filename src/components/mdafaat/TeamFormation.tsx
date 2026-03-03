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
			avatarUrl?: string;
		}>;
	}>) => void;
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
	const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
	const [trainedUserIds, setTrainedUserIds] = useState<Set<string>>(new Set());
	const [loadingTrainingSessions, setLoadingTrainingSessions] = useState(false);

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
						"id, employee_id, full_name, rank, aircraft_type_ratings",
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

	// Filter users based on search query and exclude those in pool AND trained users
	const getAvailableUsers = (): User[] => {
		const poolIds = userPool.map((u) => u.id);
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

		// ===== B738 REBALANCING: Ensure all B738 teams have minimum crew =====
		// This fixes the bug where senior redistribution can leave B738s with < 4 crew
		const b738Teams = newTeams.filter(t => t.aircraftType === "B738");
		const atrTeams = newTeams.filter(t => t.aircraftType === "ATR");
		
		for (const b738Team of b738Teams) {
			while (b738Team.members.length < minB738Crew) {
				console.log(`Rebalancing ${b738Team.id}: has ${b738Team.members.length}, needs ${minB738Crew}`);
				
				// Strategy 1: Pull from richest B738 team (if it has >4 crew)
				const richestB738 = b738Teams
					.filter(t => t.id !== b738Team.id && t.members.length > minB738Crew)
					.sort((a, b) => b.members.length - a.members.length)[0];
				
				if (richestB738) {
					const memberToMove = richestB738.members[richestB738.members.length - 1];
					richestB738.members.pop();
					b738Team.members.push(memberToMove);
					console.log(`Moved ${memberToMove.name_chinese} from ${richestB738.id} to ${b738Team.id}`);
					continue;
				}
				
				// Strategy 2: Pull B738-qualified member from ATR teams
				let moved = false;
				for (const atrTeam of atrTeams) {
					const b738QualifiedMember = atrTeam.members.find(m => canFlyAircraft(m, "B738"));
					if (b738QualifiedMember && atrTeam.members.length > 2) {
						atrTeam.members = atrTeam.members.filter(m => m.id !== b738QualifiedMember.id);
						b738Team.members.push(b738QualifiedMember);
						console.log(`Moved ${b738QualifiedMember.name_chinese} from ${atrTeam.id} to ${b738Team.id}`);
						moved = true;
						break;
					}
				}
				
				if (!moved) {
					console.warn(`Unable to fill ${b738Team.id} to minimum ${minB738Crew} crew`);
					break;
				}
			}
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

		// Any remaining person is unassigned (should not happen)
		if (invalidPeople.length > 0) {
			console.warn(
				"Warning: Could not assign:",
				invalidPeople.map((p) => p.full_name),
			);
		}

		// CRITICAL VALIDATION: Ensure ATR teams have EXACTLY 2 people
		atrTeams.forEach((team) => {
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
			const response = await fetch(`/api/mdafaat/training-sessions?date=${date}`);
			if (!response.ok) return;
			
			const sessions = await response.json();
			if (!sessions || sessions.length === 0) {
				setTeams([]);
				setShowTeams(false);
				return;
			}
			
			// Group sessions by group_type and group_number
			const groupMap = new Map<string, any>();
			
			sessions.forEach((session: any) => {
				const key = `${session.group_type}-${session.group_number}`;
				if (!groupMap.has(key)) {
					groupMap.set(key, {
						id: key.toLowerCase(),
						aircraftType: session.group_type,
						aircraftNumber: session.group_number,
						coreScenario: session.core_scenario,
						memberIds: new Set(session.team_members)
					});
				}
			});
			
			// Convert to Team objects with actual user data
			const loadedTeams: Team[] = [];
			for (const [_, groupData] of groupMap) {
				const members = allUsers.filter(u => groupData.memberIds.has(u.employee_id));
				if (members.length > 0) {
					loadedTeams.push({
						id: groupData.id,
						aircraftType: groupData.aircraftType,
						aircraftNumber: groupData.aircraftNumber,
						coreScenario: groupData.coreScenario,
						members
					});
				}
			}
			
			if (loadedTeams.length > 0) {
				setTeams(loadedTeams);
				setShowTeams(true);
				console.log(`Loaded ${loadedTeams.length} groups for ${date}`);
			}
		} catch (error) {
			console.error('Error loading groups:', error);
		}
	};

	const clearAllTrainingData = async () => {
		if (!canEditScenarios) {
			alert('您沒有權限執行此操作！');
			return;
		}
		
		if (!confirm('⚠️ 這將刪除所有訓練記錄！確定要繼續嗎？')) {
			return;
		}
		
		if (!confirm('⚠️ 最後確認：真的要刪除所有訓練資料嗎？')) {
			return;
		}
		
		try {
			const token = localStorage.getItem("token");
			if (!token) {
				alert("請先登入");
				return;
			}
			
			const response = await fetch('/api/mdafaat/training-sessions', {
				method: 'DELETE',
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});
			
			if (!response.ok) {
				throw new Error('Failed to clear data');
			}
			
			setTrainedUserIds(new Set());
			alert('✅ 所有訓練資料已清除！');
		} catch (error) {
			console.error('Error clearing data:', error);
			alert('❌ 清除失敗！');
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

	return (
		<div className={styles.container}>
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
				<input 
					type="date" 
					value={selectedDate}
					onChange={(e) => setSelectedDate(e.target.value)}
					style={{
						padding: '0.5rem',
						borderRadius: '0.375rem',
						border: '1px solid rgba(148, 163, 184, 0.3)',
						background: 'rgba(30, 41, 59, 0.8)',
						color: '#e2e8f0',
						fontSize: '0.875rem'
					}}
				/>
				{trainedUserIds.size > 0 && (
					<span style={{ 
						fontSize: '0.875rem', 
						color: '#94a3b8',
						flex: '1 1 auto',
						minWidth: '200px'
					}}>
						隱藏{trainedUserIds.size}位已訓練人員
					</span>
				)}
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
						Clear All Data
					</button>
				)}
				{canEditScenarios && (
					<button
						onClick={onOpenEditor}
						style={{ 
							padding: '0.5rem 1rem',
							borderRadius: '0.375rem',
							background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
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
						title="編輯情境卡片"
					>
						<FiEdit size={16} />
						編輯情境
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
														className={
															styles.memberNumber
														}
													>
														{idx + 1}
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
								members: team.members.map(member => ({
									userId: member.id,
									name: member.full_name,
									employeeId: member.employee_id,
									rank: member.rank,
									avatarUrl: undefined
								}))
							}));
							onStartGame(gameTeams);
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