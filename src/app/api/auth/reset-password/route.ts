// src/app/api/auth/reset-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { validatePasswordResetToken, updateUserPassword, deletePasswordResetToken } from "@/lib/database";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
	try {
		console.log("Password reset submission started");

		const { token, password } = await request.json();
		console.log("Password reset with token:", token?.substring(0, 8) + "...");

		if (!token || !password) {
			console.log("Missing token or password");
			return NextResponse.json(
				{ message: "Token and password are required" },
				{ status: 400 }
			);
		}

		// Validate password strength
		if (password.length < 6) {
			console.log("Password too short");
			return NextResponse.json(
				{ message: "Password must be at least 6 characters long" },
				{ status: 400 }
			);
		}

		console.log("Validating reset token...");
		// Validate token and get user
		const tokenData = await validatePasswordResetToken(token);
		
		if (!tokenData) {
			console.log("Invalid or expired token");
			return NextResponse.json(
				{ message: "Invalid or expired reset token" },
				{ status: 400 }
			);
		}

		console.log("Token valid, hashing new password...");
		// Hash new password
		const password_hash = await hashPassword(password);
		
		console.log("Updating user password...");
		// Update user password
		await updateUserPassword(tokenData.user_id, password_hash);
		
		console.log("Deleting used reset token...");
		// Delete the used token
		await deletePasswordResetToken(token);
		
		console.log("Password reset completed successfully");

		return NextResponse.json({
			message: "Password reset successful"
		});

	} catch (error: any) {
		console.error("Password reset error details:", {
			message: error.message,
			code: error.code,
			details: error.details,
		});

		return NextResponse.json(
			{
				message: "Failed to reset password",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}