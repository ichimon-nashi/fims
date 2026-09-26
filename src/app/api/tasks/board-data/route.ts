// src/app/api/tasks/board-data/route.ts
// Server-side home for the exact queries useTasks used to run in the browser
// with the service key. Responses keep Supabase's { data, error } shape so
// useTasks' filtering/transform logic stays unchanged.
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service-client";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
	const token = extractTokenFromHeader(request.headers.get("authorization"));
	if (!token) {
		return NextResponse.json(
			{ data: null, error: { message: "No token provided" } },
			{ status: 401 },
		);
	}
	try {
		verifyToken(token);
	} catch {
		return NextResponse.json(
			{ data: null, error: { message: "Invalid token" } },
			{ status: 401 },
		);
	}

	const supabase = createServiceClient();
	const part = request.nextUrl.searchParams.get("part");

	// Users with their app permissions (useTasks filters for task access)
	if (part === "users") {
		const { data, error } = await supabase
			.from("users")
			.select("id, employee_id, full_name, rank, base, email, authentication_level, app_permissions, is_inactive")
			.order("full_name", { ascending: true });
		return NextResponse.json({ data, error });
	}

	// Tasks that span or touch the selected year, plus their comments
	if (part === "tasks") {
		const selectedYear = Number(request.nextUrl.searchParams.get("year"));
		if (!Number.isInteger(selectedYear)) {
			return NextResponse.json(
				{ data: null, error: { message: "Invalid year" }, comments: [] },
				{ status: 400 },
			);
		}

		const { data: tasks, error } = await supabase
			.from("tasks")
			.select("*, sort_order")
			.or(`year.eq.${selectedYear},and(start_date.gte.${selectedYear}-01-01,start_date.lte.${selectedYear}-12-31),and(due_date.gte.${selectedYear}-01-01,due_date.lte.${selectedYear}-12-31),and(start_date.lt.${selectedYear}-01-01,due_date.gt.${selectedYear}-01-01)`)
			.order("created_at", { ascending: false });

		if (error || !tasks || tasks.length === 0) {
			return NextResponse.json({ data: tasks, error, comments: [] });
		}

		const taskIds = tasks.map((task) => task.id);
		const { data: comments } = await supabase
			.from("task_comments")
			.select("*")
			.in("task_id", taskIds)
			.order("created_at", { ascending: true });

		return NextResponse.json({ data: tasks, error: null, comments: comments || [] });
	}

	return NextResponse.json(
		{ data: null, error: { message: "Unknown part" } },
		{ status: 400 },
	);
}

// ── Writes used by TaskModal / AddTaskModal ──────────────────────────────────
// Same raw operations those components used to run in the browser with the
// service key. Field lists are whitelisted; responses keep { data, error }.
const TASK_FIELDS = [
	"title",
	"description",
	"priority",
	"category",
	"status",
	"task_type",
	"parent_id",
	"start_date",
	"progress",
	"assignees",
	"due_date",
];

const pick = (src: any, fields: string[]) => {
	const out: Record<string, unknown> = {};
	for (const f of fields) {
		if (src && Object.prototype.hasOwnProperty.call(src, f)) out[f] = src[f];
	}
	return out;
};

export async function POST(request: NextRequest) {
	const token = extractTokenFromHeader(request.headers.get("authorization"));
	if (!token) {
		return NextResponse.json(
			{ data: null, error: { message: "No token provided" } },
			{ status: 401 },
		);
	}
	let decoded: ReturnType<typeof verifyToken>;
	try {
		decoded = verifyToken(token);
	} catch {
		return NextResponse.json(
			{ data: null, error: { message: "Invalid token" } },
			{ status: 401 },
		);
	}

	const body = await request.json();
	const supabase = createServiceClient();

	// AddTaskModal: create a task, return the raw inserted row
	if (body.action === "insert_task") {
		const row = {
			...pick(body.task, [...TASK_FIELDS, "year"]),
			created_by: decoded.userId,
		};
		const { data, error } = await supabase
			.from("tasks")
			.insert([row])
			.select()
			.single();
		return NextResponse.json({ data, error });
	}

	// TaskModal: status change and edit save
	if (body.action === "update_task") {
		const updates = pick(body.updates, TASK_FIELDS);
		if (!body.id || Object.keys(updates).length === 0) {
			return NextResponse.json(
				{ data: null, error: { message: "Nothing to update" } },
				{ status: 400 },
			);
		}
		const { error } = await supabase
			.from("tasks")
			.update(updates)
			.eq("id", body.id);
		return NextResponse.json({ data: null, error });
	}

	// TaskModal: delete comments first (result ignored, as before), then task
	if (body.action === "delete_task") {
		if (!body.id) {
			return NextResponse.json(
				{ data: null, error: { message: "id required" } },
				{ status: 400 },
			);
		}
		await supabase.from("task_comments").delete().eq("task_id", body.id);
		const { error } = await supabase.from("tasks").delete().eq("id", body.id);
		return NextResponse.json({ data: null, error });
	}

	// TaskModal: add a comment, return the raw inserted row
	if (body.action === "insert_comment") {
		const c = body.comment ?? {};
		const row = {
			task_id: c.task_id,
			comment_text: c.comment_text,
			author_id: c.author_id ?? decoded.userId,
			author_name: c.author_name,
		};
		const { data, error } = await supabase
			.from("task_comments")
			.insert([row])
			.select()
			.single();
		return NextResponse.json({ data, error });
	}

	return NextResponse.json(
		{ data: null, error: { message: "Unknown action" } },
		{ status: 400 },
	);
}
