// src/app/api/auth/forgot-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetToken } from "@/lib/database";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
	try {
		console.log("Password reset request started");

		const { email } = await request.json();
		console.log("Password reset request for email:", email);

		if (!email) {
			console.log("Missing email");
			return NextResponse.json(
				{ message: "Email is required" },
				{ status: 400 }
			);
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			console.log("Invalid email format");
			return NextResponse.json(
				{ message: "Invalid email format" },
				{ status: 400 }
			);
		}

		console.log("Looking up user by email...");
		// Find user by email
		const user = await getUserByEmail(email.toLowerCase());
		
		// Always return success to prevent email enumeration attacks
		// But only send email if user exists
		if (user) {
			console.log("User found, generating reset token...");
			
			// Generate secure reset token
			const resetToken = randomBytes(32).toString('hex');
			const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
			
			console.log("Saving reset token to database...");
			// Save reset token to database
			await createPasswordResetToken({
				user_id: user.id,
				token: resetToken,
				expires_at: expiresAt
			});
			
			console.log("Password reset token created (email sending disabled)");
			console.log("Reset URL would be:", `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`);
		} else {
			console.log("User not found, but returning success for security");
		}

		// Always return success to prevent email enumeration
		return NextResponse.json({
			message: "If an account with that email exists, a password reset link has been sent."
		});

	} catch (error: any) {
		console.error("Password reset error details:", {
			message: error.message,
			code: error.code,
			details: error.details,
		});

		return NextResponse.json(
			{
				message: "Failed to process password reset request",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}