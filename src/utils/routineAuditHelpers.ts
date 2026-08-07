// src/utils/routineAuditHelpers.ts

// tail prefix rule — single source of truth, not duplicated across components
export function isB738(tail: string): boolean {
	return tail.toUpperCase().startsWith("B18");
}