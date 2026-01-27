// src/lib/smsPermissions.ts
// Helper for checking SMS permissions in API routes

import { verifyToken } from "@/lib/auth";
import { getUserById } from "@/lib/database";

export interface SMSPermissionResult {
	canView: boolean;
	canEdit: boolean;
	error?: string;
	status?: number;
	userId?: string;
}

/**
 * Check SMS permissions for API routes
 * Returns whether user can view and/or edit SMS data
 *
 * Usage:
 * const permissions = await checkSMSPermissions(request.headers.get('authorization'));
 * if (!permissions.canView) return error response
 * if (!permissions.canEdit) return error response (for POST/PUT/DELETE)
 */
export async function checkSMSPermissions(
	authHeader: string | null,
): Promise<SMSPermissionResult> {
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return {
			canView: false,
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
				canView: false,
				canEdit: false,
				error: "User not found",
				status: 404,
			};
		}

		// Check if user has SMS access
		const smsPermissions = user.app_permissions?.sms;

		if (!smsPermissions || !smsPermissions.access) {
			return {
				canView: false,
				canEdit: false,
				error: "Access denied: No SMS permissions",
				status: 403,
			};
		}

		// User has SMS access - can view
		// Check if they can also edit (view_only = false means can edit)
		const canEdit = !smsPermissions.view_only;

		return {
			canView: true,
			canEdit: canEdit,
			userId: decoded.userId,
		};
	} catch (error) {
		console.error("Error checking SMS permissions:", error);
		return {
			canView: false,
			canEdit: false,
			error: "Permission check failed",
			status: 500,
		};
	}
}
