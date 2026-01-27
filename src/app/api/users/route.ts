// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkOralTestPermissions } from "@/lib/oralTestPermissions";
import { hashPassword } from "@/lib/auth";

export async function GET(request: NextRequest) {
	try {
		// Check Oral Test permissions - need MANAGE_USERS permission to view all users
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canManageUsers) {
			console.log("Access denied: manage_users permission required");
			return NextResponse.json(
				{ message: "Access denied: Permission to manage users required" },
				{ status: 403 }
			);
		}

		console.log("User has manage_users permission:", permissions.userId);

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

		// Filter and clean user data
		const cleanedUsers = users.map((user) => {
			// Remove password hash from all responses
			const { password_hash, ...userWithoutPassword } = user;

			// Add employeeID for frontend compatibility
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
		// Check Oral Test permissions - need MANAGE_USERS permission to create users
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canManageUsers) {
			console.log("Access denied: manage_users permission required for creation");
			return NextResponse.json(
				{ message: "Access denied: Permission to manage users required" },
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

		// Hash password if provided
		if (userData.password) {
			newUser.password_hash = await hashPassword(userData.password);
		} else if (userData.password_hash) {
			// Support for already hashed passwords (e.g., imports)
			newUser.password_hash = userData.password_hash;
		}

		// Users with manage_users can only set auth level 1-3
		if (newUser.authentication_level && newUser.authentication_level > 3) {
			newUser.authentication_level = 1; // Default for safety
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