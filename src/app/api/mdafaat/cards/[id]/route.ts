// app/api/mdafaat/cards/[id]/route.ts
// GET, PUT, DELETE single card by ID

import { NextRequest, NextResponse } from "next/server";
import { getCardById, updateCard, deleteCard } from "@/lib/mdafaatDatabase";
import { checkMdafaatPermissions } from "@/lib/mdafaatPermissions";

// GET /api/mdafaat/cards/[id] - Get single card
export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
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
		const cardId = parseInt(params.id);
		
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
	{ params }: { params: { id: string } }
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
		const cardId = parseInt(params.id);
		
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
	{ params }: { params: { id: string } }
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
		const cardId = parseInt(params.id);
		
		if (isNaN(cardId)) {
			return NextResponse.json(
				{ error: "Invalid card ID" },
				{ status: 400 }
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