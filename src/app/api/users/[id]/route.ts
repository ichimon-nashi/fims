// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkOralTestPermissions } from "@/lib/oralTestPermissions";
import { hashPassword } from "@/lib/auth";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		// Check Oral Test permissions - need MANAGE_USERS permission
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canManageUsers) {
			return NextResponse.json(
				{ message: "Access denied: Permission to manage users required" },
				{ status: 403 }
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
		// Check Oral Test permissions - need MANAGE_USERS permission
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canManageUsers) {
			return NextResponse.json(
				{ message: "Access denied: Permission to manage users required" },
				{ status: 403 }
			);
		}

		const { id } = await params;
		const updateData = await request.json();

		console.log("Updating user:", id, "with data:", Object.keys(updateData));

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

		// Users with manage_users can only set auth levels 1-3
		if (updateData.authentication_level && updateData.authentication_level > 3) {
			delete updateData.authentication_level;
		}

		// Don't allow changing employee_id
		delete updateData.employee_id;

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
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		// Check Oral Test permissions - need MANAGE_USERS permission
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canManageUsers) {
			return NextResponse.json(
				{ message: "Access denied: Permission to manage users required" },
				{ status: 403 }
			);
		}

		const { id } = await params;

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