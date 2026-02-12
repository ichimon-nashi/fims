// src/lib/mdafaatPermissions.ts
// Helper for checking MDAfaat permissions in API routes
// Simple: If you have access, you can read AND write

import { verifyToken } from "@/lib/auth";
import { getUserById } from "@/lib/database";

export interface MdafaatPermissionResult {
	canAccess: boolean;
	canEdit: boolean; // Always true if canAccess is true
	error?: string;
	status?: number;
	userId?: string;
}

/**
 * Check MDAfaat permissions for API routes
 * Returns whether user can access MDAfaat
 * If they have access, they can both read AND write (no separate permissions)
 *
 * Usage:
 * const permissions = await checkMdafaatPermissions(request.headers.get('authorization'));
 * if (!permissions.canAccess) return error response
 */
export async function checkMdafaatPermissions(
	authHeader: string | null
): Promise<MdafaatPermissionResult> {
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return {
			canAccess: false,
			canEdit: false,
			error: "Unauthorized",
			status: 401,
		};
	}

	const token = authHeader.substring(7);

	try {
		const decoded = verifyToken(token);

		// Get user from database
		const user = await getUserById(decoded.userId);

		if (!user) {
			return {
				canAccess: false,
				canEdit: false,
				error: "User not found",
				status: 404,
			};
		}

		// Check if user has MDAfaat access
		const mdafaatPermissions = user.app_permissions?.mdafaat;

		if (!mdafaatPermissions || !mdafaatPermissions.access) {
			return {
				canAccess: false,
				canEdit: false,
				error: "Access denied: No MDAfaat permissions",
				status: 403,
			};
		}

		// If they have access, they can do everything (read + write)
		return {
			canAccess: true,
			canEdit: true,
			userId: decoded.userId,
		};
	} catch (error) {
		console.error("Error checking MDAfaat permissions:", error);
		return {
			canAccess: false,
			canEdit: false,
			error: "Permission check failed",
			status: 500,
		};
	}
}

/**
 * Quick check if user can edit (same as access check)
 */
export async function canEditScenarios(
	authHeader: string | null
): Promise<boolean> {
	const permissions = await checkMdafaatPermissions(authHeader);
	return permissions.canEdit;
}

/**
 * Quick check if user can access
 */
export async function canAccessMdafaat(
	authHeader: string | null
): Promise<boolean> {
	const permissions = await checkMdafaatPermissions(authHeader);
	return permissions.canAccess;
}