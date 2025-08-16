// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader, hashPassword } from "@/lib/auth";

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

		let decoded;
		try {
			decoded = verifyToken(token);
		} catch (tokenError: unknown) {
			console.error("Token verification failed:", tokenError);
			return NextResponse.json(
				{
					message: "Invalid token",
					debug: {
						error: tokenError instanceof Error ? tokenError.message : String(tokenError),
						tokenPreview: token.substring(0, 20) + "..."
					}
				},
				{ status: 401 }
			);
		}

		const supabase = await createClient();

		// Get all users
		const { data: users, error } = await supabase
			.from("users")
			.select("*")
			.order("employee_id");

		if (error) {
			console.error("Database query error:", error);
			return NextResponse.json(
				{ message: "Failed to fetch users", error: error.message },
				{ status: 500 }
			);
		}

		// Filter and clean user data based on authentication level
		const cleanedUsers = users.map((user) => {
			// Remove password hash from all responses
			const { password_hash, ...userWithoutPassword } = user;

			// Add employeeID for frontend compatibility
			userWithoutPassword.employeeID = userWithoutPassword.employee_id;

			// Hide sensitive fields based on auth level
			if (decoded.authLevel < 10) {
				delete userWithoutPassword.handicap_level;
			}

			if (decoded.authLevel < 20) {
				delete userWithoutPassword.authentication_level;
			}

			// REMOVED: Employee ID hiding - make employee_id visible for all users
			// This ensures the roster functionality works for all instructors
			// Keep both formats for all users
			userWithoutPassword.employeeID = userWithoutPassword.employee_id;

			return userWithoutPassword;
		});

		return NextResponse.json({ users: cleanedUsers });
	} catch (error: unknown) {
		console.error("Get users error:", error);
		return NextResponse.json(
			{
				message: "Internal server error",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
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

		let decoded;
		try {
			decoded = verifyToken(token);
		} catch (tokenError: unknown) {
			console.error("Token verification failed:", tokenError);
			return NextResponse.json(
				{ message: "Invalid token" },
				{ status: 401 }
			);
		}

		// Check permissions for creating users
		if (decoded.authLevel < 5) {
			return NextResponse.json(
				{ message: "Insufficient permissions to create users" },
				{ status: 403 }
			);
		}

		const userData = await request.json();

		// Validate required fields
		if (!userData.employee_id || !userData.email || !userData.full_name) {
			return NextResponse.json(
				{ message: "Missing required fields: employee_id, email, full_name" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();

		// Check if user already exists
		const { data: existingUser } = await supabase
			.from("users")
			.select("employee_id")
			.eq("employee_id", userData.employee_id)
			.single();

		if (existingUser) {
			return NextResponse.json(
				{ message: "User with this employee_id already exists" },
				{ status: 409 }
			);
		}

		// Set default values for new user
		const newUser: {
			employee_id: string;
			email: string;
			full_name: string;
			rank: string;
			base: string;
			filter: string[];
			handicap_level: number;
			authentication_level: number;
			password_hash?: string;
		} = {
			employee_id: userData.employee_id,
			email: userData.email,
			full_name: userData.full_name,
			rank: userData.rank || "FI - Flight Attendant Instructor",
			base: userData.base || "TPE",
			filter: userData.filter || [],
			handicap_level: userData.handicap_level || 0,
			authentication_level: userData.authentication_level || 1,
		};

		// Hash password if provided - THIS IS THE FIX
		if (userData.password) {
			newUser.password_hash = await hashPassword(userData.password);
		} else if (userData.password_hash) {
			// Support for already hashed passwords (e.g., imports)
			newUser.password_hash = userData.password_hash;
		}

		// Restrict certain field modifications based on auth level
		if (newUser.authentication_level && decoded.authLevel < 20) {
			newUser.authentication_level = 1; // Default for low-level users
		}

		if (newUser.handicap_level && decoded.authLevel < 10) {
			newUser.handicap_level = 0; // Default for low-level users
		}

		const { data: createdUser, error } = await supabase
			.from("users")
			.insert(newUser)
			.select("*")
			.single();

		if (error) {
			console.error("Create user error:", error);
			return NextResponse.json(
				{ message: "Failed to create user", error: error.message },
				{ status: 500 }
			);
		}

		// Remove password hash from response
		const { password_hash, ...userWithoutPassword } = createdUser;

		return NextResponse.json(userWithoutPassword, { status: 201 });
	} catch (error: unknown) {
		console.error("Create user error:", error);
		return NextResponse.json(
			{
				message: "Internal server error",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}