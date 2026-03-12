// app/api/mdafaat/training-sessions/route.ts
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
	
	if (before) {
		query = query.lte('training_date', before);
	}
	
	if (after) {
		query = query.gte('training_date', after);
	}
	
	if (date) {
		query = query.eq('training_date', date);
	}
	
	const { data, error } = await query;
	
	if (error) {
		console.error('Error fetching training sessions:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
	
	return NextResponse.json(data || []);
}

// POST: Save training sessions — pure INSERT, one row per member per group.
// CRITICAL: Do NOT deduplicate by employee_id. A person may intentionally appear
// in multiple groups (duplicate/overflow scenario) and every group row must be saved.
export async function POST(request: NextRequest) {
	const token = request.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	
	const user = await verifyToken(token);
	if (!user) {
		return NextResponse.json({ error: "Invalid token" }, { status: 401 });
	}
	
	try {
		const body = await request.json();
		const { sessions } = body;
		
		if (!sessions || !Array.isArray(sessions)) {
			return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
		}
		
		// Insert every session row exactly as provided — no grouping or deduplication.
		// Each row represents one person in one group. If someone is in two groups,
		// they have two rows with different group_type/group_number values.
		const sessionsToSave = sessions.map((session: any) => ({
			training_date: session.training_date,
			employee_id: String(session.employee_id),
			group_type: session.group_type,
			group_number: session.group_number,
			core_scenario: session.core_scenario,
			team_members: session.team_members,
			all_groups: [{ group_type: session.group_type, group_number: session.group_number, core_scenario: session.core_scenario }],
			// ScenarioMode fields — only included when present (TeamFormation saves omit these)
			...(session.result        != null && { result:        session.result }),
			...(session.is_redo       != null && { is_redo:       session.is_redo }),
			...(session.elapsed_time  != null && { elapsed_time:  session.elapsed_time }),
			...(session.instructor    != null && { instructor:    session.instructor }),
			...(session.flight_info   != null && { flight_info:   session.flight_info }),
			...(session.scenario_path != null && { scenario_path: session.scenario_path }),
			...(session.conditions    != null && { conditions:    session.conditions }),
			created_by: user.employee_id,
			created_at: new Date().toISOString(),
		}));
		
		const supabase = createServiceClient();

		// Plain INSERT — each ScenarioMode completion is a new row.
		// Same group training twice on the same date correctly creates two rows.
		// (Unique constraint on training_date+employee_id+group_number was dropped
		//  in migrate_pending_groups.sql)
		const { data, error } = await supabase
			.from('mdafaat_training_sessions')
			.insert(sessionsToSave)
			.select();
		
		if (error) {
			console.error('Error saving training sessions:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}
		
		return NextResponse.json({ 
			success: true, 
			count: data?.length || 0,
			data 
		});
	} catch (error: any) {
		console.error('Error in POST training sessions:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// DELETE: Clear all training sessions (admin only)
export async function DELETE(request: NextRequest) {
	const token = request.headers.get("authorization")?.replace("Bearer ", "");
	if (!token) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	
	const user = await verifyToken(token);
	if (!user) {
		return NextResponse.json({ error: "Invalid token" }, { status: 401 });
	}
	
	const supabase = createServiceClient();
	const { data: permissions } = await supabase
		.from('user_permissions')
		.select('mdafaat')
		.eq('employee_id', user.employee_id)
		.single();
	
	const canEdit = !permissions?.mdafaat?.view_only;
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