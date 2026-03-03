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
		query = query.lt('training_date', before);
	}
	
	if (after) {
		query = query.gt('training_date', after);
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

// POST: Save training sessions — pure INSERT, no delete, allows multiple sessions per date
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
		
		// Group by employee_id to handle people in multiple groups
		const employeeGroups = new Map<string, any>();
		
		sessions.forEach((session: any) => {
			const key = session.employee_id;
			if (!employeeGroups.has(key)) {
				employeeGroups.set(key, {
					training_date: session.training_date,
					employee_id: session.employee_id,
					groups: [],
					team_members: session.team_members,
					created_by: user.employee_id,
					created_at: new Date().toISOString()
				});
			}
			
			employeeGroups.get(key)!.groups.push({
				group_type: session.group_type,
				group_number: session.group_number,
				core_scenario: session.core_scenario
			});
		});
		
		const sessionsToSave = Array.from(employeeGroups.values()).map(emp => ({
			training_date: emp.training_date,
			employee_id: emp.employee_id,
			group_type: emp.groups[0].group_type,
			group_number: emp.groups[0].group_number,
			core_scenario: emp.groups[0].core_scenario,
			team_members: emp.team_members,
			created_by: emp.created_by,
			created_at: emp.created_at,
			all_groups: emp.groups
		}));
		
		const supabase = createServiceClient();
		
		// Pure INSERT — no delete before insert, allows multiple sessions per date
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