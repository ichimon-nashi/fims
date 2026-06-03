// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader, hashPassword } from "@/lib/auth";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		// Extract and verify JWT token - any authenticated user can view user details
		const token = extractTokenFromHeader(
			request.headers.get("authorization"),
		);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 },
			);
		}

		let decoded;
		try {
			decoded = verifyToken(token);
		} catch (tokenError: unknown) {
			console.error("Token verification failed:", tokenError);
			return NextResponse.json(
				{ message: "Invalid token" },
				{ status: 401 },
			);
		}

		const { id } = await params;
		console.log("Looking up user with ID:", id);

		const supabase = await createClient();

		// Try by employee_id first
		let { data: user, error } = await supabase
			.from("users")
			.select("*")
			.eq("employee_id", id)
			.single();

		// If not found, try by UUID
		if (
			error &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
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

		// Add employeeID for compatibility
		userWithoutPassword.employeeID = userWithoutPassword.employee_id;

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
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		// Extract and verify JWT token
		const token = extractTokenFromHeader(
			request.headers.get("authorization"),
		);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 },
			);
		}

		let decoded;
		try {
			decoded = verifyToken(token);
		} catch (tokenError: unknown) {
			console.error("Token verification failed:", tokenError);
			return NextResponse.json(
				{ message: "Invalid token" },
				{ status: 401 },
			);
		}

		const { id } = await params;
		const updateData = await request.json();

		const supabase = await createClient();
		
		// Get current user's permissions
		const { data: currentUser, error: userError } = await supabase
			.from("users")
			.select("employee_id, authentication_level")
			.eq("id", decoded.userId)
			.single();

		if (userError || !currentUser) {
			console.error("Error fetching current user:", userError);
			return NextResponse.json(
				{ message: "User not found" },
				{ status: 404 },
			);
		}

		// Check if user is updating themselves or if they have admin privileges
		const isSelfUpdate = decoded.userId === id;
		const isAdmin = currentUser.employee_id === "admin" || currentUser.authentication_level >= 5;

		if (!isSelfUpdate && !isAdmin) {
			return NextResponse.json(
				{ message: "Insufficient permissions to update other users" },
				{ status: 403 }
			);
		}

		console.log("Updating user:", id, "with data:", Object.keys(updateData));

		// Remove fields that shouldn't be updated directly
		delete updateData.id;
		delete updateData.created_at;
		delete updateData.updated_at;
		delete updateData.password_hash;

		// Hash password if provided
		if (updateData.password) {
			// Only allow password updates for self or admin
			if (!isSelfUpdate && !isAdmin) {
				delete updateData.password;
			} else {
				updateData.password_hash = await hashPassword(updateData.password);
				delete updateData.password;
			}
		}

		// Only admin can change authentication_level and app_permissions
		if (!isAdmin) {
			delete updateData.authentication_level;
			delete updateData.app_permissions;
		}

		// Don't allow changing employee_id
		delete updateData.employee_id;

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
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		// Extract and verify JWT token
		const token = extractTokenFromHeader(
			request.headers.get("authorization"),
		);

		if (!token) {
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 },
			);
		}

		let decoded;
		try {
			decoded = verifyToken(token);
		} catch (tokenError: unknown) {
			console.error("Token verification failed:", tokenError);
			return NextResponse.json(
				{ message: "Invalid token" },
				{ status: 401 },
			);
		}

		const supabase = await createClient();
		
		// Get current user's permissions
		const { data: currentUser, error: userError } = await supabase
			.from("users")
			.select("employee_id, authentication_level")
			.eq("id", decoded.userId)
			.single();

		if (userError || !currentUser) {
			console.error("Error fetching current user:", userError);
			return NextResponse.json(
				{ message: "User not found" },
				{ status: 404 },
			);
		}

		// Only admin can delete users
		const isAdmin = currentUser.employee_id === "admin" || currentUser.authentication_level >= 10;

		if (!isAdmin) {
			return NextResponse.json(
				{ message: "Insufficient permissions to delete users" },
				{ status: 403 }
			);
		}

		const { id } = await params;

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