// src/app/api/auth/login/route.ts
// Debug version - replace temporarily to see what's in the database
import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, getUserByEmployeeId } from "@/lib/database";
import { verifyPassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
	try {
		console.log("Login attempt started");

		const { identifier, password } = await request.json();
		console.log("Login request for identifier:", identifier);

		if (!identifier || !password) {
			console.log("Missing identifier or password");
			return NextResponse.json(
				{ message: "Employee ID/Email and password are required" },
				{ status: 400 }
			);
		}

		console.log("Looking up user...");
		
		// Try to find user by employee ID first, then by email
		let user = null;
		if (identifier.includes('@')) {
			// Looks like an email
			user = await getUserByEmail(identifier);
		} else {
			// Assume it's an employee ID
			user = await getUserByEmployeeId(identifier);
		}

		if (!user) {
			console.log("User not found");
			return NextResponse.json(
				{ message: "Invalid credentials" },
				{ status: 401 }
			);
		}

		console.log("User found, checking password hash...");
		console.log("Password hash type:", typeof user.password_hash);
		console.log("Password hash value:", user.password_hash);
		console.log("Password hash length:", user.password_hash?.length);
		console.log("Input password type:", typeof password);
		console.log("Input password length:", password.length);

		// Check if password_hash exists and is a string
		if (!user.password_hash) {
			console.log("No password hash found for user");
			return NextResponse.json(
				{ message: "Account not properly configured" },
				{ status: 500 }
			);
		}

		if (typeof user.password_hash !== 'string') {
			console.log("Password hash is not a string:", user.password_hash);
			return NextResponse.json(
				{ message: "Account configuration error" },
				{ status: 500 }
			);
		}

		console.log("Verifying password...");
		// Verify password
		const isValidPassword = await verifyPassword(
			password,
			user.password_hash
		);
		
		if (!isValidPassword) {
			console.log("Invalid password");
			return NextResponse.json(
				{ message: "Invalid credentials" },
				{ status: 401 }
			);
		}

		console.log("Password verified, generating token...");
		// Remove password from user object
		const { password_hash, ...userWithoutPassword } = user;

		// Generate JWT token
		const token = generateToken(userWithoutPassword);
		console.log("Login successful for user:", user.id);

		return NextResponse.json({
			message: "Login successful",
			token,
			user: userWithoutPassword,
		});
	} catch (error: any) {
		console.error("Login error details:", {
			message: error.message,
			stack: error.stack,
			code: error.code,
			details: error.details,
		});

		return NextResponse.json(
			{
				message: "Login failed",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}