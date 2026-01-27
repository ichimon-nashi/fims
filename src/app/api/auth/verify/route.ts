// src/app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/database";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

export async function GET(request: NextRequest) {
	try {
		const token = extractTokenFromHeader(
			request.headers.get("authorization")
		);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		// Verify token
		const decoded = verifyToken(token);

		// Get fresh user data
		const user = await getUserById(decoded.userId);
		if (!user) {
			return NextResponse.json(
				{ message: "User not found" },
				{ status: 401 }
			);
		}

		// DEBUG: Log app_permissions
		console.log('=== AUTH VERIFY DEBUG ===');
		console.log('User ID:', user.id);
		console.log('Employee ID:', user.employee_id);
		console.log('Has app_permissions:', !!user.app_permissions);
		console.log('App permissions:', JSON.stringify(user.app_permissions, null, 2));

		// Remove password from user object
		const { password_hash, ...userWithoutPassword } = user;

		return NextResponse.json({
			message: "Token valid",
			user: userWithoutPassword,
		});
	} catch (error) {
		console.error("Token verification error:", error);
		return NextResponse.json({ message: "Invalid token" }, { status: 401 });
	}
}