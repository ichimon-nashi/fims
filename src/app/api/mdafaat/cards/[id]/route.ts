// app/api/mdafaat/cards/[id]/route.ts
// GET, PUT, DELETE single card by ID
// Updated for new branching outcome structure + door/position support

import { NextRequest, NextResponse } from "next/server";
import { getCardById, updateCard, deleteCard } from "@/lib/mdafaatDatabase";
import { checkMdafaatPermissions } from "@/lib/mdafaatPermissions";

// GET /api/mdafaat/cards/[id] - Get single card
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
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
		const { id } = await params;
		const cardId = parseInt(id);
		
		if (isNaN(cardId)) {
			return NextResponse.json(
				{ error: "Invalid card ID" },
				{ status: 400 }
			);
		}

		const card = await getCardById(cardId);

		if (!card) {
			return NextResponse.json(
				{ error: "Card not found" },
				{ status: 404 }
			);
		}

		return NextResponse.json(card);
	} catch (error) {
		console.error("Error fetching card:", error);
		return NextResponse.json(
			{ error: "Failed to fetch card" },
			{ status: 500 }
		);
	}
}

// PUT /api/mdafaat/cards/[id] - Update card
export async function PUT(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
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
		const { id } = await params;
		const cardId = parseInt(id);
		
		if (isNaN(cardId)) {
			return NextResponse.json(
				{ error: "Invalid card ID" },
				{ status: 400 }
			);
		}

		const updates = await request.json();

		// Don't allow changing id or card_type
		delete updates.id;
		delete updates.card_type;
		delete updates.created_at;
		delete updates.updated_at;

		// Set defaults for new fields if not provided
		if (updates.can_be_initial === undefined) {
			updates.can_be_initial = false;
		}
		if (updates.category === undefined) {
			updates.category = null;
		}

		// Validate outcomes if provided
		if (updates.outcomes && Array.isArray(updates.outcomes)) {
			const totalProbability = updates.outcomes.reduce(
				(sum: number, o: any) => sum + (o.probability || 0), 
				0
			);
			
			if (totalProbability > 100) {
				return NextResponse.json(
					{ error: `Outcome probabilities total ${totalProbability}% (cannot exceed 100%)` },
					{ status: 400 }
				);
			}

			// Validate each outcome
			for (const outcome of updates.outcomes) {
				if (!outcome.id || !outcome.description || outcome.probability === undefined || !outcome.next_card_id) {
					return NextResponse.json(
						{ error: "Each outcome must have: id, description, probability, next_card_id" },
						{ status: 400 }
					);
				}
			}
		}

		const card = await updateCard(cardId, updates);
		return NextResponse.json(card);
	} catch (error) {
		console.error("Error updating card:", error);
		return NextResponse.json(
			{ error: "Failed to update card" },
			{ status: 500 }
		);
	}
}

// DELETE /api/mdafaat/cards/[id] - Delete card
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
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
		const { id } = await params;
		const cardId = parseInt(id);
		
		if (isNaN(cardId)) {
			return NextResponse.json(
				{ error: "Invalid card ID" },
				{ status: 400 }
			);
		}

		// Don't allow deleting end cards (all 5 types)
		const endCards = [99, 199, 299, 399, 499];
		if (endCards.includes(cardId)) {
			return NextResponse.json(
				{ error: "Cannot delete end cards (E-99, P-99, Q-99, D-99, POS-99)" },
				{ status: 403 }
			);
		}

		await deleteCard(cardId);
		return NextResponse.json({ success: true, message: "Card deleted successfully" });
	} catch (error) {
		console.error("Error deleting card:", error);
		return NextResponse.json(
			{ error: "Failed to delete card" },
			{ status: 500 }
		);
	}
}