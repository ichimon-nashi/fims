// src/lib/mdafaatDatabase.ts
// Database functions for MDAfaat scenario cards
// Follows the same pattern as smsDatabase.ts (using service client)

import { createServiceClient } from "@/utils/supabase/service-client";

// ============================================================================
// INTERFACES (Updated for branching system)
// ============================================================================

export interface Outcome {
	id: string;
	description: string;
	probability: number; // 0-100 (percentage)
	next_card_id: number;
	side_effect_card_id?: number | null;
	effect?: string;
}

export interface MdafaatCard {
	id: number;
	card_type: "emergency" | "passenger" | "equipment" | "door" | "position";
	code: string;
	title: string;
	description: string;
	is_shiny: boolean;
	conflicts: number[];
	outcomes: Outcome[];
	created_at: string;
	updated_at: string;
}

export interface CardData {
	emergency: MdafaatCard[];
	passenger: MdafaatCard[];
	equipment: MdafaatCard[];
	door: MdafaatCard[];
	position: MdafaatCard[];
}

export interface MdafaatFilters {
	card_type?: "emergency" | "passenger" | "equipment" | "door" | "position";
	search?: string;
	is_shiny?: boolean;
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

		// Group by card type - UPDATED to include door and position
		const cardData: CardData = {
			emergency: data?.filter((c) => c.card_type === "emergency") || [],
			passenger: data?.filter((c) => c.card_type === "passenger") || [],
			equipment: data?.filter((c) => c.card_type === "equipment") || [],
			door: data?.filter((c) => c.card_type === "door") || [],
			position: data?.filter((c) => c.card_type === "position") || [],
		};

		console.log(
			"Found cards:",
			cardData.emergency.length,
			"emergency,",
			cardData.passenger.length,
			"passenger,",
			cardData.equipment.length,
			"equipment,",
			cardData.door.length,
			"door,",
			cardData.position.length,
			"position"
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
	card_type: "emergency" | "passenger" | "equipment" | "door" | "position";
	code: string;
	title: string;
	description: string;
	is_shiny?: boolean;
	conflicts?: number[];
	outcomes?: Outcome[];
}): Promise<MdafaatCard> => {
	try {
		console.log("Creating MDAfaat card:", cardData.code);

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("mdafaat_cards")
			.insert([
				{
					...cardData,
					is_shiny: cardData.is_shiny || false,
					conflicts: cardData.conflicts || [],
					outcomes: cardData.outcomes || [],
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
		is_shiny: boolean;
		conflicts: number[];
		outcomes: Outcome[];
	}>
): Promise<MdafaatCard> => {
	try {
		console.log("Updating card:", id);

		const supabase = createServiceClient();

		const { data, error} = await supabase
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
		card_type: "emergency" | "passenger" | "equipment" | "door" | "position";
		code: string;
		title: string;
		description: string;
		is_shiny?: boolean;
		conflicts?: number[];
		outcomes?: Outcome[];
	}>
): Promise<MdafaatCard[]> => {
	try {
		console.log("Bulk creating cards:", cards.length);

		const supabase = createServiceClient();

		const cardsWithDefaults = cards.map((card) => ({
			...card,
			is_shiny: card.is_shiny || false,
			conflicts: card.conflicts || [],
			outcomes: card.outcomes || [],
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
	by_type: { emergency: number; passenger: number; equipment: number; door: number; position: number };
	shiny_cards: number;
	with_outcomes: number;
}> => {
	try {
		console.log("Getting card statistics");

		const supabase = createServiceClient();

		const { data, error } = await supabase
			.from("mdafaat_cards")
			.select("card_type, is_shiny, outcomes");

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
				door: data?.filter((c) => c.card_type === "door").length || 0,
				position: data?.filter((c) => c.card_type === "position").length || 0,
			},
			shiny_cards: data?.filter((c) => c.is_shiny === true).length || 0,
			with_outcomes:
				data?.filter((c) => c.outcomes && c.outcomes.length > 0).length || 0,
		};

		console.log("Statistics:", stats);
		return stats;
	} catch (error) {
		console.error("Error getting statistics:", error);
		throw new Error("Failed to get card statistics");
	}
};