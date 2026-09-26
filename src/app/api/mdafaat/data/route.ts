// src/app/api/mdafaat/data/route.ts
// Server-side home for the exact queries ScenarioEditor and TeamFormation used
// to run in the browser with the service key. Same MDAfaat permission check as
// /api/mdafaat/scenarios. Responses keep Supabase's { data, error } shape.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { checkMdafaatPermissions } from "@/lib/mdafaatPermissions";

const deny = async (request: NextRequest) => {
	const permissions = await checkMdafaatPermissions(
		request.headers.get("authorization"),
	);
	if (!permissions.canAccess) {
		return NextResponse.json(
			{ data: null, error: { message: permissions.error || "Access denied" } },
			{ status: permissions.status || 403 },
		);
	}
	return null;
};

export async function GET(request: NextRequest) {
	const denied = await deny(request);
	if (denied) return denied;

	const supabase = createServiceClient();
	const part = request.nextUrl.searchParams.get("part");

	// ScenarioEditor: all scenario cards
	if (part === "scenarios") {
		const { data, error } = await supabase
			.from("mdafaat_cards")
			.select("*")
			.order("scenario_code");
		return NextResponse.json({ data, error });
	}

	// TeamFormation: active, non-admin crew pool
	if (part === "users") {
		const { data, error } = await supabase
			.from("users")
			.select("id, employee_id, full_name, rank, base, aircraft_type_ratings")
			.neq("rank", "admin")
			.eq("is_inactive", false);
		return NextResponse.json({ data, error });
	}

	return NextResponse.json(
		{ data: null, error: { message: "Unknown part" } },
		{ status: 400 },
	);
}

const INSERT_FIELDS = [
	"scenario_code",
	"core_scenario",
	"title",
	"category",
	"flight_no",
	"route",
	"background",
	"trigger",
	"complication",
	"outcome",
];
const UPDATE_FIELDS = [
	"category",
	"core_scenario",
	"background",
	"trigger",
	"complication",
	"outcome",
];

const pick = (src: any, fields: string[]) => {
	const out: Record<string, unknown> = {};
	for (const f of fields) {
		if (src && Object.prototype.hasOwnProperty.call(src, f)) out[f] = src[f];
	}
	return out;
};

export async function POST(request: NextRequest) {
	const denied = await deny(request);
	if (denied) return denied;

	const body = await request.json();
	const supabase = createServiceClient();

	if (body.action === "insert_scenario") {
		const { error } = await supabase
			.from("mdafaat_cards")
			.insert(pick(body.scenario, INSERT_FIELDS));
		return NextResponse.json({ data: null, error });
	}

	if (body.action === "update_scenario") {
		if (body.id === undefined || body.id === null) {
			return NextResponse.json(
				{ data: null, error: { message: "id required" } },
				{ status: 400 },
			);
		}
		const { error } = await supabase
			.from("mdafaat_cards")
			.update({
				...pick(body.scenario, UPDATE_FIELDS),
				updated_at: new Date().toISOString(),
			})
			.eq("id", body.id);
		return NextResponse.json({ data: null, error });
	}

	if (body.action === "delete_scenario") {
		if (body.id === undefined || body.id === null) {
			return NextResponse.json(
				{ data: null, error: { message: "id required" } },
				{ status: 400 },
			);
		}
		const { error } = await supabase
			.from("mdafaat_cards")
			.delete()
			.eq("id", body.id);
		return NextResponse.json({ data: null, error });
	}

	return NextResponse.json(
		{ data: null, error: { message: "Unknown action" } },
		{ status: 400 },
	);
}
