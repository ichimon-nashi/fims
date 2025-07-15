// src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/database";
import { hashPassword, generateToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
	try {
		console.log("Registration attempt started");

		const userData = await request.json();
		console.log("Registration data received:", {
			email: userData.email,
			employee_id: userData.employee_id,
		});

		// Validate required fields
		const required = [
			"employee_id",
			"full_name",
			"rank",
			"base",
			"email",
			"password",
		];
		for (const field of required) {
			if (!userData[field]) {
				console.log(`Missing required field: ${field}`);
				return NextResponse.json(
					{ message: `${field} is required` },
					{ status: 400 }
				);
			}
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(userData.email)) {
			console.log("Invalid email format");
			return NextResponse.json(
				{ message: "Invalid email format" },
				{ status: 400 }
			);
		}

		// Validate password strength
		if (userData.password.length < 6) {
			console.log("Password too short");
			return NextResponse.json(
				{ message: "Password must be at least 6 characters long" },
				{ status: 400 }
			);
		}

		console.log("Hashing password...");
		// Hash password
		const password_hash = await hashPassword(userData.password);
		console.log("Password hashed successfully");

		console.log("Creating user in database...");
		// Create user with default values
		const newUser = await createUser({
			employee_id: userData.employee_id,
			full_name: userData.full_name,
			rank: userData.rank,
			base: userData.base,
			email: userData.email.toLowerCase(),
			password_hash,
			filter: [], // Default empty filter
			handicap_level: 3, // Default handicap level
			authentication_level: 1, // Default authentication level
		});

		console.log("User created successfully:", newUser.id);

		// Remove password from response
		const { password_hash: _, ...userWithoutPassword } = newUser;

		console.log("Generating JWT token...");
		// Generate JWT token
		const token = generateToken(userWithoutPassword);
		console.log("Token generated successfully");

		return NextResponse.json(
			{
				message: "Registration successful",
				token,
				user: userWithoutPassword,
			},
			{ status: 201 }
		);
	} catch (error: any) {
		console.error("Registration error details:", {
			message: error.message,
			code: error.code,
			details: error.details,
			hint: error.hint,
		});

		// Handle Supabase unique constraint violations
		if (
			error.code === "23505" ||
			error.message?.includes("duplicate key")
		) {
			if (error.message?.includes("employee_id")) {
				return NextResponse.json(
					{ message: "Employee ID already exists" },
					{ status: 409 }
				);
			} else if (error.message?.includes("email")) {
				return NextResponse.json(
					{ message: "Email address already exists" },
					{ status: 409 }
				);
			}
			return NextResponse.json(
				{ message: "Employee ID or email already exists" },
				{ status: 409 }
			);
		}

		// Handle connection errors
		if (error.message?.includes("fetch")) {
			return NextResponse.json(
				{ message: "Database connection failed. Please try again." },
				{ status: 500 }
			);
		}

		return NextResponse.json(
			{
				message: "Registration failed",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}