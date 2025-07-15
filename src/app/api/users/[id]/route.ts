// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader, hashPassword } from "@/lib/auth";

export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
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

		const decoded = verifyToken(token);
		const { id } = await params; // Added await here

		console.log("Looking up user with ID:", id);

		const supabase = await createClient();

		// Try by employee_id first since that's what examinees probably use
		let { data: user, error } = await supabase
			.from("users")
			.select("*")
			.eq("employee_id", id)
			.single();

		// If not found, try by UUID (only if id looks like a UUID)
		if (
			error &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				id
			)
		) {
			console.log("User not found by employee_id, trying UUID:", id);
			const result = await supabase
				.from("users")
				.select("*")
				.eq("id", id)
				.single();
			user = result.data;
			error = result.error;
		}

		if (error) {
			console.log("User not found:", error);
			return NextResponse.json(
				{ message: "User not found" },
				{ status: 404 }
			);
		}

		console.log("User found:", {
			id: user.id,
			employee_id: user.employee_id,
			email: user.email,
		});

		// Remove password hash from response
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

		// Hide employee_id unless level 99 (admin only)
		if (decoded.authLevel < 99) {
			delete userWithoutPassword.employee_id;
		} else {
			// Keep both formats for high-level users
			userWithoutPassword.employeeID = userWithoutPassword.employee_id;
		}

		return NextResponse.json(userWithoutPassword);
	} catch (error: any) {
		console.error("Get user error:", error);
		return NextResponse.json(
			{
				message: "Internal server error",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

export async function PUT(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
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

		const decoded = verifyToken(token);

		if (decoded.authLevel < 5) {
			return NextResponse.json(
				{ message: "Insufficient permissions" },
				{ status: 403 }
			);
		}

		const { id } = await params; // Added await here
		const updateData = await request.json();

		console.log(
			"Updating user:",
			id,
			"with data:",
			Object.keys(updateData)
		);

		// Remove fields that shouldn't be updated directly
		delete updateData.id;
		delete updateData.created_at;
		delete updateData.updated_at;
		delete updateData.password_hash;

		// Hash password if provided
		if (updateData.password) {
			updateData.password_hash = await hashPassword(updateData.password);
			delete updateData.password;
		}

		// Restrict auth level changes to high-level users
		if (updateData.authentication_level && decoded.authLevel < 20) {
			delete updateData.authentication_level;
		}

		// Restrict handicap level changes to mid-level users
		if (updateData.handicap_level && decoded.authLevel < 10) {
			delete updateData.handicap_level;
		}

		// Only allow employee_id changes for level 99 users
		if (updateData.employee_id && decoded.authLevel < 99) {
			delete updateData.employee_id;
		}

		const supabase = await createClient();
		const { data: updatedUser, error } = await supabase
			.from("users")
			.update(updateData)
			.eq("id", id)
			.select("*")
			.single();

		if (error) {
			console.error("Update user error:", error);
			if (error.code === "PGRST116") {
				return NextResponse.json(
					{ message: "User not found" },
					{ status: 404 }
				);
			}
			return NextResponse.json(
				{ message: "Failed to update user", error: error.message },
				{ status: 500 }
			);
		}

		// Remove password hash from response
		const { password_hash, ...userWithoutPassword } = updatedUser;

		console.log("User updated successfully:", userWithoutPassword.id);
		return NextResponse.json(userWithoutPassword);
	} catch (error: any) {
		console.error("Update user error:", error);
		return NextResponse.json(
			{
				message: "Internal server error",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
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

		const decoded = verifyToken(token);

		if (decoded.authLevel < 5) {
			return NextResponse.json(
				{ message: "Insufficient permissions" },
				{ status: 403 }
			);
		}

		const { id } = await params; // Added await here

		const supabase = await createClient();
		const { error } = await supabase.from("users").delete().eq("id", id);

		if (error) {
			console.error("Delete user error:", error);
			return NextResponse.json(
				{ message: "Failed to delete user", error: error.message },
				{ status: 500 }
			);
		}

		return NextResponse.json({ message: "User deleted successfully" });
	} catch (error: any) {
		console.error("Delete user error:", error);
		return NextResponse.json(
			{ message: "Internal server error" },
			{ status: 500 }
		);
	}
}
