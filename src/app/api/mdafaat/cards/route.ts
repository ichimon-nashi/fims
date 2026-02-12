// app/api/mdafaat/cards/route.ts
// GET all cards, POST new card

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
		const cards = await getAllCards();
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

		// Validate required fields
		if (!cardData.id || !cardData.card_type || !cardData.code || !cardData.title || !cardData.description) {
			return NextResponse.json(
				{ error: "Missing required fields: id, card_type, code, title, description" },
				{ status: 400 }
			);
		}

		// Validate card_type
		if (!["emergency", "passenger", "equipment"].includes(cardData.card_type)) {
			return NextResponse.json(
				{ error: "Invalid card_type. Must be: emergency, passenger, or equipment" },
				{ status: 400 }
			);
		}

		const card = await createCard(cardData);
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