// src/app/api/mdafaat/scenarios/route.ts
// API route to load scenarios and convert them to card format for the game

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { checkMdafaatPermissions } from "@/lib/mdafaatPermissions";

export async function GET(request: NextRequest) {
	try {
		// Check permissions
		const authHeader = request.headers.get("authorization");
		const permissions = await checkMdafaatPermissions(authHeader);

		if (!permissions.canAccess) {
			return NextResponse.json(
				{ error: permissions.error || "Access denied" },
				{ status: permissions.status || 403 },
			);
		}

		// Get core_scenario from query params
		const { searchParams } = new URL(request.url);
		const coreScenario = searchParams.get("core_scenario");

		// No core_scenario = ScenarioEditor requesting full list
		if (!coreScenario) {
			const supabase = createServiceClient();
			const { data, error } = await supabase
				.from("mdafaat_cards")
				.select("*")
				.order("scenario_code");

			if (error) {
				console.error("Error loading all scenarios:", error);
				return NextResponse.json({ error: "Failed to load scenarios" }, { status: 500 });
			}

			return NextResponse.json(data || []);
		}

		// Load scenarios from database
		const supabase = createServiceClient();
		const { data: scenarios, error } = await supabase
			.from("mdafaat_cards")
			.select("*")
			.eq("core_scenario", coreScenario);

		if (error) {
			console.error("Error loading scenarios:", error);
			return NextResponse.json(
				{ error: "Failed to load scenarios" },
				{ status: 500 },
			);
		}

		if (!scenarios || scenarios.length === 0) {
			return NextResponse.json(
				{ error: "No scenarios found for this core type" },
				{ status: 404 },
			);
		}

		// ?list=1 — return all available decks for admin card chooser (no random pick)
		const listMode = searchParams.get("list") === "1";
		if (listMode) {
			return NextResponse.json({
				decks: scenarios.map((s: any) => ({
					scenario_code: s.scenario_code,
					background:   s.background,
					trigger:      s.trigger,
					complication: s.complication ?? null,
					outcome:      s.outcome,
				})),
			});
		}

		// Pick random scenario from the available ones
		const scenario =
			scenarios[Math.floor(Math.random() * scenarios.length)];

		// Convert scenario to card format that the game expects
		// Each scenario becomes a sequence of cards:
		// 1. Background card (id: 1)
		// 2. Trigger card (id: 2)
		// 3. Development card (id: 3) - if exists
		// 4. Complication card (id: 4) - if exists
		// 5. Outcome card (id: 99) - end card

		const cards: any[] = [];

		// Background card (always first)
		cards.push({
			id: 1,
			card_type: "emergency",
			code: `${scenario.scenario_code}-BG`,
			title: "A. 背景 Background",
			description: scenario.background,
			is_shiny: true,
			can_be_initial: true,
			category: scenario.core_scenario,
			conflicts: [],
			outcomes: [
				{
					id: "bg_to_trigger",
					description: "Continue to trigger event",
					probability: 100,
					next_card_id: 2,
				},
			],
		});

		// Trigger card
		cards.push({
			id: 2,
			card_type: "emergency",
			code: `${scenario.scenario_code}-TR`,
			title: "B. 觸發事件 Trigger",
			description: scenario.trigger,
			is_shiny: false,
			can_be_initial: false,
			category: scenario.core_scenario,
			conflicts: [],
			outcomes: scenario.complication
				? [
						{
							id: "trigger_to_comp",
							description: "Continue to Complication",
							probability: 100,
							next_card_id: 4,
						},
					]
				: [
						{
							id: "trigger_to_outcome",
							description: "Continue to Outcome",
							probability: 100,
							next_card_id: 99,
						},
					],
		});

		// Complication card (if exists)
		if (scenario.complication) {
			cards.push({
				id: 4,
				card_type: "equipment",
				code: `${scenario.scenario_code}-COMP`,
				title: "C. 併發 Complication",
				description: scenario.complication,
				is_shiny: false,
				can_be_initial: false,
				category: scenario.core_scenario,
				conflicts: [],
				outcomes: [
					{
						id: "comp_to_outcome",
						description: "Continue to Outcome",
						probability: 100,
						next_card_id: 99,
					},
				],
			});
		}

		// Outcome card (always last, no outcomes = end card)
		cards.push({
			id: 99,
			card_type: "emergency",
			code: `${scenario.scenario_code}-OUT`,
			title: "D. Outcome",
			description: scenario.outcome,
			is_shiny: false,
			can_be_initial: false,
			category: scenario.core_scenario,
			conflicts: [],
			outcomes: [], // End card
		});

		// Return in the format the game expects
		return NextResponse.json({
			emergency: cards.filter((c) => c.card_type === "emergency"),
			passenger: cards.filter((c) => c.card_type === "passenger"),
			equipment: cards.filter((c) => c.card_type === "equipment"),
			door: [],
			position: [],
			scenario_info: {
				scenario_code: scenario.scenario_code,
				category: scenario.category,
				flight_no: scenario.flight_no,
				route: scenario.route,
			},
		});
	} catch (error) {
		console.error("Error in scenarios API:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
export async function POST(request: NextRequest) {
	try {
		const authHeader = request.headers.get("authorization");
		const permissions = await checkMdafaatPermissions(authHeader);

		if (!permissions.canEdit) {
			return NextResponse.json(
				{ error: permissions.error || "Access denied" },
				{ status: permissions.status || 403 },
			);
		}

		const body = await request.json();

		const supabase = createServiceClient();
		const { data, error } = await supabase
			.from("mdafaat_cards")
			.insert([body])
			.select()
			.single();

		if (error) {
			console.error("Error creating scenario:", error);
			if (error.code === "23505") {
				return NextResponse.json({ error: "A scenario with this code already exists" }, { status: 409 });
			}
			return NextResponse.json({ error: "Failed to create scenario" }, { status: 500 });
		}

		return NextResponse.json(data, { status: 201 });
	} catch (error) {
		console.error("Error in POST /api/mdafaat/scenarios:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function PATCH(request: NextRequest) {
	try {
		const authHeader = request.headers.get("authorization");
		const permissions = await checkMdafaatPermissions(authHeader);

		if (!permissions.canEdit) {
			return NextResponse.json(
				{ error: permissions.error || "Access denied" },
				{ status: permissions.status || 403 },
			);
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json({ error: "id parameter required" }, { status: 400 });
		}

		const body = await request.json();

		const supabase = createServiceClient();
		const { data, error } = await supabase
			.from("mdafaat_cards")
			.update({ ...body, updated_at: new Date().toISOString() })
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error updating scenario:", error);
			return NextResponse.json({ error: "Failed to update scenario" }, { status: 500 });
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error in PATCH /api/mdafaat/scenarios:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(request: NextRequest) {
	try {
		const authHeader = request.headers.get("authorization");
		const permissions = await checkMdafaatPermissions(authHeader);

		if (!permissions.canEdit) {
			return NextResponse.json(
				{ error: permissions.error || "Access denied" },
				{ status: permissions.status || 403 },
			);
		}

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json({ error: "id parameter required" }, { status: 400 });
		}

		const supabase = createServiceClient();
		const { error } = await supabase
			.from("mdafaat_cards")
			.delete()
			.eq("id", id);

		if (error) {
			console.error("Error deleting scenario:", error);
			return NextResponse.json({ error: "Failed to delete scenario" }, { status: 500 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error in DELETE /api/mdafaat/scenarios:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}