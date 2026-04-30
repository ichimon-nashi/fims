// src/app/api/mdafaat/training-sessions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { verifyToken } from "@/lib/auth";

// GET: Fetch training sessions (optionally filter by date)
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const before = searchParams.get('before');
	const after = searchParams.get('after');
	const date = searchParams.get('date');
	
	const supabase = createServiceClient();
	let query = supabase
		.from('mdafaat_training_sessions')
		.select('*')
		.order('training_date', { ascending: false });
	
	if (before) query = query.lte('training_date', before);
	if (after)  query = query.gte('training_date', after);
	if (date)   query = query.eq('training_date', date);
	
	const { data, error } = await query;
	if (error) {
		console.error('Error fetching training sessions:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	return NextResponse.json(data || []);
}

// POST: Save training sessions — pure INSERT, one row per member per group.
// CRITICAL: Do NOT deduplicate by employee_id. A person may intentionally appear
// in multiple groups on the same date (e.g. as both a regular and redo participant).
export async function POST(request: NextRequest) {
	const token = request.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	
	const user = await verifyToken(token);
	if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
	
	try {
		const body = await request.json();
		const { sessions } = body;
		
		if (!sessions || !Array.isArray(sessions)) {
			return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
		}
		
		const sessionsToSave = sessions.map((session: any) => ({
			training_date:  session.training_date,
			employee_id:    String(session.employee_id),
			group_type:     session.group_type,
			group_number:   session.group_number,
			core_scenario:  session.core_scenario,
			team_members:   session.team_members,
			result:         session.result         ?? null,
			is_redo:        session.is_redo        ?? false,
			extra_scenarios: session.extra_scenarios ?? null,
			flight_info:    session.flight_info    ?? null,
			scenario_path:  session.scenario_path  ?? null,
			conditions:     session.conditions     ?? null,
			elapsed_time:   session.elapsed_time   ?? null,
			instructor:     session.instructor     ?? null,
			created_by:     user.employee_id       ?? user.id ?? "unknown",
		}));
		
		const supabase = createServiceClient();
		const { data, error } = await supabase
			.from('mdafaat_training_sessions')
			.insert(sessionsToSave)
			.select();
		
		if (error) {
			console.error('Error saving training sessions:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}
		
		return NextResponse.json({ success: true, count: data?.length || 0, data });
	} catch (error: any) {
		console.error('Error in POST training sessions:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// DELETE: 
//   ?ids=1,2,3  → delete specific rows by ID (incomplete skeleton cleanup)
//   (no params) → delete ALL rows (admin wipe)
export async function DELETE(request: NextRequest) {
	const token = request.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	
	const user = await verifyToken(token);
	if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
	
	const supabase = createServiceClient();
	const idsParam = request.nextUrl.searchParams.get('ids');

	if (idsParam) {
		// Delete specific rows by ID (skeleton cleanup) — token auth is sufficient
		// Button is already hidden client-side for non-admin users
		const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
		if (ids.length === 0) {
			return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });
		}
		const { error } = await supabase
			.from('mdafaat_training_sessions')
			.delete()
			.in('id', ids);
		if (error) {
			console.error('Error deleting sessions by ID:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}
		return NextResponse.json({ success: true, deleted: ids.length });
	}

	// Delete ALL — requires explicit permission check
	const { data: perms } = await supabase
		.from('users')
		.select('app_permissions')
		.eq('employee_id', user.employee_id ?? user.id)
		.single();

	const mdafaat = (perms as any)?.app_permissions?.mdafaat;
	const canEdit = mdafaat?.view_only === false || mdafaat?.access === true;
	if (!canEdit) {
		return NextResponse.json({ error: "Forbidden - requires edit permission" }, { status: 403 });
	}

	const { error } = await supabase
		.from('mdafaat_training_sessions')
		.delete()
		.neq('id', 0);
	if (error) {
		console.error('Error clearing training sessions:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	return NextResponse.json({ success: true, message: 'All training sessions cleared' });
}
// PATCH: Update a group's training sessions
// Body: { training_date, group_type, group_number, updates: { core_scenario?, conditions?, flight_info?, result_map?: Record<employee_id, 'pass'|'redo'>, team_members? } }
export async function PATCH(request: NextRequest) {
	const token = request.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const user = await verifyToken(token);
	if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

	try {
		const body = await request.json();
		const { training_date, group_type, group_number, updates } = body;

		if (!training_date || !group_type || group_number === undefined) {
			return NextResponse.json({ error: "Missing group identifiers" }, { status: 400 });
		}

		const supabase = createServiceClient();

		// Fetch existing rows for this group
		const { data: rows, error: fetchErr } = await supabase
			.from('mdafaat_training_sessions')
			.select('*')
			.eq('training_date', training_date)
			.eq('group_type', group_type)
			.eq('group_number', group_number);

		if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
		if (!rows || rows.length === 0) return NextResponse.json({ error: "Group not found" }, { status: 404 });

		// Build per-row updates
		const { core_scenario, conditions, flight_info, team_members, result_map } = updates ?? {};

		// If team_members changed, we need to delete old rows and insert new ones
		if (team_members && Array.isArray(team_members)) {
			// Delete existing rows
			const { error: delErr } = await supabase
				.from('mdafaat_training_sessions')
				.delete()
				.eq('training_date', training_date)
				.eq('group_type', group_type)
				.eq('group_number', group_number);
			if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

			// Insert new rows — one per member, using updated values from request
			const template = rows[0];
			const newRows = team_members.map((m: any) => ({
				training_date,
				employee_id:     String(m.employeeId ?? m.employee_id),
				group_type,
				group_number,
				core_scenario:   core_scenario          ?? template.core_scenario,
				team_members:    team_members,
				result:          result_map?.[String(m.employeeId ?? m.employee_id)] ?? template.result,
				is_redo:         template.is_redo,
				extra_scenarios: updates.extra_scenarios ?? template.extra_scenarios,
				flight_info:     flight_info             ?? template.flight_info,
				scenario_path:   updates.scenario_path   ?? template.scenario_path,
				conditions:      conditions              ?? template.conditions,
				elapsed_time:    template.elapsed_time,
				instructor:      template.instructor,
				created_by:      user.employee_id ?? user.id ?? "unknown",
			}));

			const { error: insErr } = await supabase
				.from('mdafaat_training_sessions')
				.insert(newRows);
			if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
			return NextResponse.json({ success: true });
		}

		// Otherwise update fields in-place for each existing row
		for (const row of rows) {
			const patch: Record<string, any> = {};
			if (core_scenario       !== undefined) patch.core_scenario       = core_scenario;
			if (conditions          !== undefined) patch.conditions          = conditions;
			if (flight_info         !== undefined) patch.flight_info         = flight_info;
			if (updates.scenario_path !== undefined) patch.scenario_path    = updates.scenario_path;
			if (updates.extra_scenarios !== undefined) patch.extra_scenarios = updates.extra_scenarios;
			if (result_map !== undefined && result_map[row.employee_id] !== undefined)
				patch.result = result_map[row.employee_id];

			if (Object.keys(patch).length > 0) {
				const { error: updErr } = await supabase
					.from('mdafaat_training_sessions')
					.update(patch)
					.eq('id', row.id);
				if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
			}
		}

		return NextResponse.json({ success: true });
	} catch (err: any) {
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}