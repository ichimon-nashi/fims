// src/app/api/tasks/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAvailableUsers } from "@/lib/taskDatabase";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
	try {
		console.log("GET /api/tasks/users - Fetching available users");

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

		const users = await getAvailableUsers();
		console.log("Retrieved users:", users.length);

		return NextResponse.json(users);
	} catch (error) {
		console.error("Error in GET /api/tasks/users:", error);
		return NextResponse.json(
			{
				message: "Failed to fetch users",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
