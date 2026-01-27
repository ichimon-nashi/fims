// src/lib/customAvatarMapping.ts

/**
 * Custom Avatar GIF Mapping
 * Key: employee_id
 * Value: GIF filename (with .gif extension)
 */
export const CUSTOM_AVATAR_MAPPING: Record<string, string> = {
	// Example entries (uncomment and modify):
	// "12345": "custom_person_a.gif",
	// "67890": "custom_person_b.gif",
	// "admin": "admin_special.gif",
	// Add your custom mappings below:
};

/**
 * Get custom GIF for a user if one exists
 * @param employeeId - The user's employee_id
 * @returns The custom GIF filename or null if no custom mapping exists
 */
export const getCustomAvatarGif = (employeeId: string): string | null => {
	return CUSTOM_AVATAR_MAPPING[employeeId] || null;
};

/**
 * Check if a user has a custom avatar
 * @param employeeId - The user's employee_id
 * @returns True if the user has a custom avatar mapping
 */
export const hasCustomAvatar = (employeeId: string): boolean => {
	return employeeId in CUSTOM_AVATAR_MAPPING;
};
