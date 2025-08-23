// src/app/api/auth/login/route.ts
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

		console.log("Password verified, checking access permissions...");
		
		// Check if user has permission to access the system
		const hasAccess = checkUserAccess(user);
		if (!hasAccess) {
			console.log("User does not have required permissions:", {
				employeeId: user.employee_id,
				rank: user.rank
			});
			return NextResponse.json(
				{ message: "Access denied. You do not have permission to access this system." },
				{ status: 403 }
			);
		}

		console.log("Access granted, generating token...");
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

// Helper function to check if user has access permissions
function checkUserAccess(user: any): boolean {
	// Admin employee IDs (unchanged admin accounts)
	const adminEmployeeIds = ["51892", "admin", "21986"];
	
	// Special employee IDs with access - ADD YOUR NEW IDs HERE
	const specialEmployeeIds = ["22119", "59976", "21701", "39426", "36639"];
	
	// Allowed ranks
	const allowedRanks = [
		"FI",
		"FI - Flight Attendant Instructor",
		"SC", 
		"SC - Section Chief",
		"MG",
		"MG - Manager"
	];

	// Check if user is an admin
	if (adminEmployeeIds.includes(user.employee_id)) {
		console.log("Access granted: Admin employee ID");
		return true;
	}

	// Check if user is in the special employee IDs list (FIXED)
	if (specialEmployeeIds.includes(user.employee_id)) {
		console.log("Access granted: Special employee ID");
		return true;
	}

	// Check if user has an allowed rank
	if (user.rank && allowedRanks.includes(user.rank)) {
		console.log("Access granted: Allowed rank");
		return true;
	}

	console.log("Access denied: No qualifying permissions");
	return false;
}