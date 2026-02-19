// src/lib/mdafaatTypes.ts
// TypeScript interfaces for MDAfaat branching game system
// Updated for new outcome-based structure

// ============================================================================
// OUTCOME INTERFACE
// ============================================================================

export interface Outcome {
	id: string; // "outcome_1", "outcome_2", etc.
	description: string; // What happens in this outcome
	probability: number; // 0-100 (percentage)
	next_card_id: number; // Which card comes next
	side_effect_card_id?: number | null; // Optional secondary card
	effect?: string; // Optional: additional effect description
}

// ============================================================================
// CARD INTERFACE
// ============================================================================

export interface MdafaatCard {
	id: number;
	card_type: "emergency" | "passenger" | "equipment" | "door" | "position";
	code: string;
	title: string;
	description: string;
	is_shiny: boolean; // Core card - must appear in game
	can_be_initial: boolean; // NEW: Can be starting card
	category: string | null; // NEW: Scenario category (e.g., "fire", "medical")
	conflicts: number[]; // Cards that can't appear together
	outcomes: Outcome[]; // Branching outcomes (can be empty for end cards)
	created_at: string;
	updated_at: string;
}

// ============================================================================
// CARD DATA (GROUPED BY TYPE)
// ============================================================================

export interface CardData {
	emergency: MdafaatCard[];
	passenger: MdafaatCard[];
	equipment: MdafaatCard[];
	door: MdafaatCard[];
	position: MdafaatCard[];
}

// ============================================================================
// CATEGORY CONSTANTS
// ============================================================================

// Common categories for preventing similar scenarios
export const CATEGORIES = {
	// Emergency
	FIRE: "fire",
	MEDICAL: "medical",
	TURBULENCE: "turbulence",
	DECOMPRESSION: "decompression",
	EVACUATION: "evacuation",
	
	// Passenger
	UNRULY: "unruly",
	PANIC: "panic",
	SERVICE: "service",
	LANGUAGE: "language",
	
	// Equipment
	GALLEY: "galley",
	LAVATORY: "lavatory",
	ELECTRICAL: "electrical",
	IFE: "ife",
	DOOR: "door",
	
	// Special
	OTHER: "other"  // Can repeat - used for miscellaneous/unique scenarios
} as const;

// ============================================================================
// GAME STATE
// ============================================================================

export interface InitialConditions {
	timeOfDay: "morning" | "midday" | "night";
	fullFlight: boolean;
	infantsOnboard: boolean;
	disabledPassengers: boolean;
}

export interface GameState {
	// Setup
	groupId: string; // Team identifier
	groupMembers: GroupMember[]; // All team members
	currentMemberIndex: number; // Whose turn it is
	initialConditions: InitialConditions;

	// Card history
	cardHistory: CardHistoryEntry[];
	currentCard: MdafaatCard | null;

	// Current selections
	selectedMainOutcome: Outcome | null;
	selectedSideEffect: Outcome | null;

	// Status
	isComplete: boolean;
	completedAt?: string;
}

export interface GroupMember {
	userId: string;
	name: string;
	employeeId: string;
	avatarUrl?: string;
}

export interface CardHistoryEntry {
	card: MdafaatCard;
	selectedOutcome: Outcome;
	sideEffectCard?: MdafaatCard;
	sideEffectOutcome?: Outcome;
	timestamp: string;
	playerId: string; // Who made this choice
}

// ============================================================================
// FILTERS
// ============================================================================

export interface MdafaatFilters {
	card_type?: "emergency" | "passenger" | "equipment" | "door" | "position";
	search?: string;
	is_shiny?: boolean;
}

// ============================================================================
// HELPERS FOR OUTCOME GENERATION
// ============================================================================

/**
 * Generate auto-success outcome if probabilities don't sum to 100
 */
export function generateAutoSuccessOutcome(
	outcomes: Outcome[],
	cardType: "emergency" | "passenger" | "equipment" | "door" | "position"
): Outcome[] {
	const totalProbability = outcomes.reduce(
		(sum, o) => sum + o.probability,
		0
	);

	if (totalProbability >= 100) {
		return outcomes; // No need for auto-success
	}

	// Determine end card ID based on type
	const endCardId = 
		cardType === "emergency" ? 99 : 
		cardType === "passenger" ? 199 : 
		cardType === "equipment" ? 299 :
		cardType === "door" ? 399 :
		499; // position

	const autoOutcome: Outcome = {
		id: "auto_success",
		description: "Situation resolved successfully",
		probability: 100 - totalProbability,
		next_card_id: endCardId,
	};

	return [...outcomes, autoOutcome];
}

/**
 * Check if card is an end card (no outcomes)
 */
export function isEndCard(card: MdafaatCard): boolean {
	return card.outcomes.length === 0;
}

/**
 * Check if card is shiny (core card)
 */
export function isShinyCard(card: MdafaatCard): boolean {
	return card.is_shiny === true;
}

/**
 * Get all shiny cards from card data
 */
export function getShinyCards(cardData: CardData): MdafaatCard[] {
	return [
		...cardData.emergency.filter(isShinyCard),
		...cardData.passenger.filter(isShinyCard),
		...cardData.equipment.filter(isShinyCard),
		...cardData.door.filter(isShinyCard),
		...cardData.position.filter(isShinyCard),
	];
}

/**
 * Distribute shiny cards across teams
 * Ensures each shiny card appears at least once
 */
export function distributeShinyCards(
	shinyCards: MdafaatCard[],
	teamCount: number
): MdafaatCard[][] {
	const distribution: MdafaatCard[][] = Array(teamCount)
		.fill(null)
		.map(() => []);

	// Assign each shiny card to a team (round-robin)
	shinyCards.forEach((card, index) => {
		const teamIndex = index % teamCount;
		distribution[teamIndex].push(card);
	});

	return distribution;
}

/**
 * Select random outcome based on probabilities
 */
export function selectRandomOutcome(outcomes: Outcome[]): Outcome {
	const roll = Math.random() * 100;
	let cumulative = 0;

	for (const outcome of outcomes) {
		cumulative += outcome.probability;
		if (roll < cumulative) {
			return outcome;
		}
	}

	// Fallback to last outcome (shouldn't happen if probabilities sum to 100)
	return outcomes[outcomes.length - 1];
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate outcome probabilities
 */
export function validateOutcomeProbabilities(
	outcomes: Outcome[]
): { valid: boolean; total: number; message?: string } {
	if (outcomes.length === 0) {
		return { valid: true, total: 0 }; // End card
	}

	const total = outcomes.reduce((sum, o) => sum + o.probability, 0);

	if (total > 100) {
		return {
			valid: false,
			total,
			message: `Total probability ${total}% exceeds 100%`,
		};
	}

	if (total < 0) {
		return {
			valid: false,
			total,
			message: "Probabilities cannot be negative",
		};
	}

	return { valid: true, total };
}

/**
 * Check if outcome has side effect
 */
export function hasSideEffect(outcome: Outcome): boolean {
	return outcome.side_effect_card_id != null;
}

// ============================================================================
// CATEGORY & INITIAL CARD HELPERS (NEW)
// ============================================================================

/**
 * Get cards that can be initial/starting cards
 */
export function getInitialCards(allCards: MdafaatCard[]): MdafaatCard[] {
	return allCards.filter(card => card.can_be_initial && !isEndCard(card));
}

/**
 * Track used categories to prevent similar scenarios
 */
export interface GameHistory {
	cardIds: number[];           // IDs of cards already used
	categories: string[];        // Categories already used
}

/**
 * Check if card can be used based on history
 * Exception: "other" category can always repeat
 */
export function canUseCard(
	card: MdafaatCard, 
	history: GameHistory,
	preventSameCategory: boolean = true
): boolean {
	// Can't reuse exact same card
	if (history.cardIds.includes(card.id)) {
		return false;
	}
	
	// Exception: "other" category can repeat
	if (card.category === "other") {
		return true;
	}
	
	// Can't use card from same category (prevents similar scenarios)
	if (preventSameCategory && card.category && history.categories.includes(card.category)) {
		return false;
	}
	
	return true;
}

/**
 * Update history when card is played
 */
export function updateHistory(
	history: GameHistory,
	card: MdafaatCard
): GameHistory {
	return {
		cardIds: [...history.cardIds, card.id],
		categories: card.category 
			? [...history.categories, card.category]
			: history.categories
	};
}