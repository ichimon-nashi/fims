// src/lib/mdafaatDatabase.ts
// Database functions for MDAfaat scenario cards
// Follows the same pattern as smsDatabase.ts (using service client)

import { createServiceClient } from "@/utils/supabase/service-client";

// ============================================================================
// INTERFACES
// ============================================================================

export interface MdafaatCard {
	id: number;
	card_type: "emergency" | "passenger" | "equipment";
	code: string;
	title: string;
	description: string;
	conflicts: number[];
	synergies: number[];
	escalates_to: number[];
	escalation_chance: number;
	crew_impact: Record<string, Outcome>;
	passenger_impact: Record<string, Outcome>;
	severity_levels: Record<string, Outcome>;
	malfunction_outcomes: Record<string, Outcome>;
	created_at: string;
	updated_at: string;
}

export interface Outcome {
	probability: number;
	description: string;
	action?: string;
	duration?: string;
	escalates?: boolean;
}

export interface CardData {
	emergency: MdafaatCard[];
	passenger: MdafaatCard[];
	equipment: MdafaatCard[];
}

export interface MdafaatFilters {
	card_type?: "emergency" | "passenger" | "equipment";
	search?: string;
}

// ============================================================================
// GET ALL CARDS (for gameplay)
// ============================================================================

export const getAllCards = async (
	filters: MdafaatFilters = {}
): Promise<CardData> => {
	try {
		console.log("Getting all MDAfaat cards with filters:", filters);

		const supabase = createServiceClient();

		let query = supabase
			.from("mdafaat_cards")
			.select("*")
			.order("id", { ascending: true });

		if (filters.card_type) {
			query = query.eq("card_type", filters.card_type);
		}

		if (filters.search) {
			query = query.or(
				`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,code.ilike.%${filters.search}%`
			);
		}

		const { data, error } = await query;

		if (error) {
			console.error("Error getting MDAfaat cards:", error);
			throw error;
		}

		// Group by card type
		const cardData: CardData = {
			emergency: data?.filter((c) => c.card_type === "emergency") || [],
			passenger: data?.filter((c) => c.card_type === "passenger") || [],
			equipment: data?.filter((c) => c.card_type === "equipment") || [],
		};

		console.log(
			"Found cards:",
			cardData.emergency.length,
			"emergency,",
			cardData.passenger.length,
			"passenger,",
			cardData.equipment.length,
			"equipment"
		);
		return cardData;
	} catch (error) {
		console.error("Error getting all cards:", error);
		throw new Error("Failed to fetch MDAfaat cards");
	}
};

// ============================================================================
// GET SINGLE CARD
// ============================================================================

export const getCardById = async (id: number): Promise<MdafaatCard | null> => {
	try {
		console.log("Getting card by ID:", id);

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("mdafaat_cards")
			.select("*")
			.eq("id", id)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				console.log("Card not found:", id);
				return null;
			}
			console.error("Error getting card:", error);
			throw error;
		}

		console.log("Card found:", data.id);
		return data;
	} catch (error) {
		console.error("Error getting card by ID:", error);
		throw new Error("Failed to fetch card");
	}
};

// ============================================================================
// CREATE CARD
// ============================================================================

export const createCard = async (cardData: {
	id: number;
	card_type: "emergency" | "passenger" | "equipment";
	code: string;
	title: string;
	description: string;
	conflicts?: number[];
	synergies?: number[];
	escalates_to?: number[];
	escalation_chance?: number;
	crew_impact?: Record<string, Outcome>;
	passenger_impact?: Record<string, Outcome>;
	severity_levels?: Record<string, Outcome>;
	malfunction_outcomes?: Record<string, Outcome>;
}): Promise<MdafaatCard> => {
	try {
		console.log("Creating MDAfaat card:", cardData.code);

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("mdafaat_cards")
			.insert([
				{
					...cardData,
					conflicts: cardData.conflicts || [],
					synergies: cardData.synergies || [],
					escalates_to: cardData.escalates_to || [],
					escalation_chance: cardData.escalation_chance || 0.3,
					crew_impact: cardData.crew_impact || {},
					passenger_impact: cardData.passenger_impact || {},
					severity_levels: cardData.severity_levels || {},
					malfunction_outcomes: cardData.malfunction_outcomes || {},
				},
			])
			.select()
			.single();

		if (error) {
			console.error("Error creating card:", error);
			if (error.code === "23505") {
				// unique_violation
				if (error.message.includes("code")) {
					throw new Error("A card with this code already exists");
				} else if (error.message.includes("pkey")) {
					throw new Error("A card with this ID already exists");
				}
			}
			throw error;
		}

		console.log("Card created successfully:", data.id);
		return data;
	} catch (error) {
		console.error("Error creating card:", error);
		throw error;
	}
};

// ============================================================================
// UPDATE CARD
// ============================================================================

export const updateCard = async (
	id: number,
	updates: Partial<{
		code: string;
		title: string;
		description: string;
		conflicts: number[];
		synergies: number[];
		escalates_to: number[];
		escalation_chance: number;
		crew_impact: Record<string, Outcome>;
		passenger_impact: Record<string, Outcome>;
		severity_levels: Record<string, Outcome>;
		malfunction_outcomes: Record<string, Outcome>;
	}>
): Promise<MdafaatCard> => {
	try {
		console.log("Updating card:", id);

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("mdafaat_cards")
			.update(updates)
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error updating card:", error);
			throw error;
		}

		console.log("Card updated successfully");
		return data;
	} catch (error) {
		console.error("Error updating card:", error);
		throw error;
	}
};

// ============================================================================
// DELETE CARD
// ============================================================================

export const deleteCard = async (id: number): Promise<void> => {
	try {
		console.log("Deleting card:", id);

		const supabase = createServiceClient();

		const { error } = await supabase
			.from("mdafaat_cards")
			.delete()
			.eq("id", id);

		if (error) {
			console.error("Error deleting card:", error);
			throw error;
		}

		console.log("Card deleted successfully");
	} catch (error) {
		console.error("Error deleting card:", error);
		throw error;
	}
};

// ============================================================================
// BULK OPERATIONS (useful for migration)
// ============================================================================

export const bulkCreateCards = async (
	cards: Array<{
		id: number;
		card_type: "emergency" | "passenger" | "equipment";
		code: string;
		title: string;
		description: string;
		conflicts?: number[];
		synergies?: number[];
		escalates_to?: number[];
		escalation_chance?: number;
		crew_impact?: Record<string, Outcome>;
		passenger_impact?: Record<string, Outcome>;
		severity_levels?: Record<string, Outcome>;
		malfunction_outcomes?: Record<string, Outcome>;
	}>
): Promise<MdafaatCard[]> => {
	try {
		console.log("Bulk creating cards:", cards.length);

		const supabase = createServiceClient();

		const cardsWithDefaults = cards.map((card) => ({
			...card,
			conflicts: card.conflicts || [],
			synergies: card.synergies || [],
			escalates_to: card.escalates_to || [],
			escalation_chance: card.escalation_chance || 0.3,
			crew_impact: card.crew_impact || {},
			passenger_impact: card.passenger_impact || {},
			severity_levels: card.severity_levels || {},
			malfunction_outcomes: card.malfunction_outcomes || {},
		}));

		const { data, error } = await supabase
			.from("mdafaat_cards")
			.insert(cardsWithDefaults)
			.select();

		if (error) {
			console.error("Error bulk creating cards:", error);
			throw error;
		}

		console.log("Bulk created successfully:", data?.length || 0, "cards");
		return data || [];
	} catch (error) {
		console.error("Error bulk creating cards:", error);
		throw error;
	}
};

// ============================================================================
// STATISTICS (useful for admin dashboard)
// ============================================================================

export const getCardStatistics = async (): Promise<{
	total: number;
	by_type: { emergency: number; passenger: number; equipment: number };
	with_synergies: number;
	with_escalations: number;
}> => {
	try {
		console.log("Getting card statistics");

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("mdafaat_cards")
			.select("card_type, synergies, escalates_to");

		if (error) {
			console.error("Error getting statistics:", error);
			throw error;
		}

		const stats = {
			total: data?.length || 0,
			by_type: {
				emergency: data?.filter((c) => c.card_type === "emergency").length || 0,
				passenger: data?.filter((c) => c.card_type === "passenger").length || 0,
				equipment: data?.filter((c) => c.card_type === "equipment").length || 0,
			},
			with_synergies:
				data?.filter((c) => c.synergies && c.synergies.length > 0).length || 0,
			with_escalations:
				data?.filter((c) => c.escalates_to && c.escalates_to.length > 0)
					.length || 0,
		};

		console.log("Statistics:", stats);
		return stats;
	} catch (error) {
		console.error("Error getting statistics:", error);
		throw new Error("Failed to get card statistics");
	}
};