// app/api/mdafaat/cards/route.ts
// GET all cards, POST new card
// Updated for new branching outcome structure + door/position support

import { NextRequest, NextResponse } from "next/server";
import { getAllCards, createCard } from "@/lib/mdafaatDatabase";
import { checkMdafaatPermissions } from "@/lib/mdafaatPermissions";

// GET /api/mdafaat/cards - Get all cards
export async function GET(request: NextRequest) {
	const permissions = await checkMdafaatPermissions(
		request.headers.get("authorization")
	);

	if (!permissions.canAccess) {
		return NextResponse.json(
			{ error: permissions.error },
			{ status: permissions.status }
		);
	}

	try {
		// Support filtering by is_shiny
		const searchParams = request.nextUrl.searchParams;
		const isShiny = searchParams.get("is_shiny");
		
		const filters: any = {};
		if (isShiny === "true") {
			filters.is_shiny = true;
		}

		const cards = await getAllCards(filters);
		return NextResponse.json(cards);
	} catch (error) {
		console.error("Error fetching cards:", error);
		return NextResponse.json(
			{ error: "Failed to fetch cards" },
			{ status: 500 }
		);
	}
}

// POST /api/mdafaat/cards - Create new card
export async function POST(request: NextRequest) {
	const permissions = await checkMdafaatPermissions(
		request.headers.get("authorization")
	);

	if (!permissions.canAccess) {
		return NextResponse.json(
			{ error: permissions.error || "Access denied" },
			{ status: permissions.status || 403 }
		);
	}

	try {
		const cardData = await request.json();
		
		console.log("Creating card with type:", cardData.card_type);

		// Validate required fields
		if (!cardData.id || !cardData.card_type || !cardData.code || !cardData.title || !cardData.description) {
			return NextResponse.json(
				{ error: "Missing required fields: id, card_type, code, title, description" },
				{ status: 400 }
			);
		}

		// Validate card_type - ACCEPTS ALL 5 TYPES
		const validTypes = ["emergency", "passenger", "equipment", "door", "position"];
		if (!validTypes.includes(cardData.card_type)) {
			console.error("Invalid card_type:", cardData.card_type);
			return NextResponse.json(
				{ error: `Invalid card_type "${cardData.card_type}". Must be one of: ${validTypes.join(", ")}` },
				{ status: 400 }
			);
		}

		// Validate outcomes if provided
		if (cardData.outcomes && Array.isArray(cardData.outcomes)) {
			const totalProbability = cardData.outcomes.reduce(
				(sum: number, o: any) => sum + (o.probability || 0), 
				0
			);
			
			if (totalProbability > 100) {
				return NextResponse.json(
					{ error: `Outcome probabilities total ${totalProbability}% (cannot exceed 100%)` },
					{ status: 400 }
				);
			}

			// Validate each outcome has required fields
			for (const outcome of cardData.outcomes) {
				if (!outcome.id || !outcome.description || outcome.probability === undefined || !outcome.next_card_id) {
					return NextResponse.json(
						{ error: "Each outcome must have: id, description, probability, next_card_id" },
						{ status: 400 }
					);
				}
			}
		}

		const card = await createCard(cardData);
		console.log("Card created successfully:", card.id);
		return NextResponse.json(card, { status: 201 });
	} catch (error) {
		console.error("Error creating card:", error);
		
		if (error instanceof Error) {
			if (error.message.includes("already exists")) {
				return NextResponse.json(
					{ error: error.message },
					{ status: 409 }
				);
			}
		}
		
		return NextResponse.json(
			{ error: "Failed to create card" },
			{ status: 500 }
		);
	}
}