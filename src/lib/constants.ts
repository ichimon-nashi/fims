// src/lib/constants.ts

// Main question categories used in QuestionManagement
export const QUESTION_CATEGORIES = [
	"一般",
	"安全",
	"法規",
	"保安",
	"危險物品",
	"B738機種",
	"ATR機種",
];

// Additional filter categories that might be used for user filtering
// but aren't necessarily question categories
export const ADDITIONAL_FILTER_CATEGORIES = [
	// "Safety",
	// "Regulations",
	// "Protocol",
	// "Operations",
	// "Emergency",
	// "Equipment",
	// "Training",
	// "Compliance",
];

// Combined list for user filtering (includes both question categories and additional filters)
export const USER_FILTER_CATEGORIES = [
	...QUESTION_CATEGORIES,
	...ADDITIONAL_FILTER_CATEGORIES,
];

// Export default as the main question categories for convenience
export default QUESTION_CATEGORIES;