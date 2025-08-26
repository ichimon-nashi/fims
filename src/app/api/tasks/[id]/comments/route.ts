// src/app/api/tasks/[id]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { addTaskComment, getTaskComments } from "@/lib/taskDatabase";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

interface RouteParams {
	params: {
		id: string;
	};
}

export async function GET(request: NextRequest, { params }: RouteParams) {
	try {
		console.log(
			"GET /api/tasks/[id]/comments - Fetching comments for task:",
			params.id
		);

		// Extract and verify token
		const authHeader = request.headers.get("authorization");
		const token = extractTokenFromHeader(authHeader);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token verified for user:", decoded.userId);

		const comments = await getTaskComments(params.id);
		console.log("Retrieved comments:", comments.length);

		return NextResponse.json(comments);
	} catch (error) {
		console.error("Error in GET /api/tasks/[id]/comments:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch comments",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		console.log(
			"POST /api/tasks/[id]/comments - Adding comment to task:",
			params.id
		);

		// Extract and verify token
		const authHeader = request.headers.get("authorization");
		const token = extractTokenFromHeader(authHeader);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token verified for user:", decoded.userId);

		const body = await request.json();
		console.log("Comment data:", body);

		// Validate required fields
		if (!body.comment_text || !body.author_name) {
			return NextResponse.json(
				{
					message:
						"Missing required fields: comment_text, author_name",
				},
				{ status: 400 }
			);
		}

		// Create comment data
		const commentData = {
			task_id: params.id,
			comment_text: body.comment_text,
			author_id: body.author_id || decoded.userId,
			author_name: body.author_name,
		};

		const comment = await addTaskComment(commentData);
		console.log("Comment added successfully:", comment.id);

		return NextResponse.json(comment, { status: 201 });
	} catch (error) {
		console.error("Error in POST /api/tasks/[id]/comments:", error);
		return NextResponse.json(
			{
				message: "Failed to add comment",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
