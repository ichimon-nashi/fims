// src/lib/oralTestPermissions.ts
import { verifyToken } from "@/lib/auth";
import { getUserById } from "@/lib/database";

export interface OralTestPermissions {
	canView: boolean;
	canEdit: boolean;
	canManageQuestions: boolean;
	canManageUsers: boolean;
	canConductTest: boolean;
	userId?: string;
	error?: string;
	status?: number;
}

export async function checkOralTestPermissions(
	authHeader: string | null,
): Promise<OralTestPermissions> {
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return {
			canView: false,
			canEdit: false,
			canManageQuestions: false,
			canManageUsers: false,
			canConductTest: false,
			error: "Unauthorized",
			status: 401,
		};
	}

	const token = authHeader.substring(7);
	const decoded = verifyToken(token);

	// Get user from database
	const user = await getUserById(decoded.userId);

	if (!user) {
		return {
			canView: false,
			canEdit: false,
			canManageQuestions: false,
			canManageUsers: false,
			canConductTest: false,
			error: "User not found",
			status: 404,
		};
	}

	// Check oral_test permissions from app_permissions
	const oralTestPermissions = user.app_permissions?.oral_test;

	if (!oralTestPermissions || !oralTestPermissions.access) {
		return {
			canView: false,
			canEdit: false,
			canManageQuestions: false,
			canManageUsers: false,
			canConductTest: false,
			error: "Access denied: No Oral Test permissions",
			status: 403,
		};
	}

	// Determine specific permissions from pages array (set by AccessControlPanel)
	const pages: string[] = oralTestPermissions.pages || [];

	const canView = true; // Has access
	const canEdit = !oralTestPermissions.view_only;
	const canManageQuestions = pages.includes("questions");
	const canManageUsers = pages.includes("users");
	const canConductTest = pages.includes("test");

	return {
		canView,
		canEdit,
		canManageQuestions,
		canManageUsers,
		canConductTest,
		userId: decoded.userId,
	};
}