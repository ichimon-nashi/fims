// src/app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAllUsers, createUser } from "@/lib/database";
import { verifyToken, extractTokenFromHeader, hashPassword } from "@/lib/auth";

export async function GET(request: NextRequest) {
	try {
		console.log("=== USERS API DEBUG ===");
		
		const authHeader = request.headers.get("authorization");
		console.log("Auth header:", authHeader);
		
		const token = extractTokenFromHeader(authHeader);
		console.log("Extracted token:", token ? `${token.substring(0, 20)}...` : "null");

		if (!token) {
			console.log("No token provided");
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		console.log("Verifying token...");
		let decoded;
		try {
			decoded = verifyToken(token);
			console.log("Token decoded successfully:", {
				userId: decoded.userId,
				email: decoded.email,
				authLevel: decoded.authLevel
			});
		} catch (tokenError) {
			console.error("Token verification failed:", tokenError);
			return NextResponse.json(
				{ 
					message: "Invalid token",
					debug: {
						error: tokenError.message,
						tokenPreview: token.substring(0, 20) + "..."
					}
				},
				{ status: 401 }
			);
		}

		console.log("Getting all users...");
		const users = await getAllUsers();
		
		console.log("Users retrieved successfully:", users.length);

		return NextResponse.json({
			message: "Users retrieved successfully",
			users,
			debug: {
				requesterUserId: decoded.userId,
				requesterAuthLevel: decoded.authLevel
			}
		});
	} catch (error: any) {
		console.error("Get users error:", error);
		return NextResponse.json(
			{
				message: "Failed to get users",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

// FIXED: Add POST method for creating users (needed for import functionality)
export async function POST(request: NextRequest) {
	try {
		console.log("=== CREATE USER API DEBUG ===");
		
		const authHeader = request.headers.get("authorization");
		const token = extractTokenFromHeader(authHeader);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		let decoded;
		try {
			decoded = verifyToken(token);
			console.log("Token decoded successfully for user creation:", {
				userId: decoded.userId,
				authLevel: decoded.authLevel
			});
		} catch (tokenError) {
			console.error("Token verification failed:", tokenError);
			return NextResponse.json(
				{ message: "Invalid token" },
				{ status: 401 }
			);
		}

		// Check if user has permission to create users (level 5+)
		if (decoded.authLevel < 5) {
			return NextResponse.json(
				{ message: "Insufficient permissions to create users" },
				{ status: 403 }
			);
		}

		const userData = await request.json();
		console.log("Creating user with data:", {
			employee_id: userData.employee_id,
			full_name: userData.full_name,
			email: userData.email
		});

		// Validate required fields
		if (!userData.employee_id || !userData.full_name || !userData.rank || 
			!userData.base || !userData.email || !userData.password) {
			return NextResponse.json(
				{ message: "Missing required fields: employee_id, full_name, rank, base, email, password" },
				{ status: 400 }
			);
		}

		// Hash the password
		const hashedPassword = await hashPassword(userData.password);

		// Prepare user data for database - matching your existing createUser function signature
		const newUserData = {
			employee_id: userData.employee_id,
			full_name: userData.full_name,
			rank: userData.rank,
			base: userData.base,
			email: userData.email,
			password_hash: hashedPassword,
			filter: userData.filter || [],
			handicap_level: userData.handicap_level || 3,
			authentication_level: userData.authentication_level || 1,
		};

		// Prevent users from setting auth level higher than their own
		if (newUserData.authentication_level > decoded.authLevel) {
			newUserData.authentication_level = 1; // Reset to default
		}

		// Only allow creating admin users if requester is admin
		if (userData.employee_id === "admin" && decoded.userId !== "admin") {
			return NextResponse.json(
				{ message: "Only admin can create admin accounts" },
				{ status: 403 }
			);
		}

		console.log("Calling createUser function...");
		const createdUser = await createUser(newUserData);
		
		console.log("User created successfully:", createdUser.id);

		// Remove password hash from response
		const { password_hash, ...userWithoutPassword } = createdUser;

		return NextResponse.json({
			message: "User created successfully",
			user: userWithoutPassword
		}, { status: 201 });

	} catch (error: any) {
		console.error("Create user error:", error);
		
		// Handle specific database errors
		if (error.message && error.message.includes("duplicate")) {
			return NextResponse.json(
				{ message: "User with this employee ID or email already exists" },
				{ status: 409 }
			);
		}
		
		return NextResponse.json(
			{
				message: "Failed to create user",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}