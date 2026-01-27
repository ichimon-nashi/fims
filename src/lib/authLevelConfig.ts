// src/lib/authLevelConfig.ts

export interface AuthLevelConfig {
	level: number; // Numeric level (1-99)
	name: string; // English name
	nameChinese: string; // Chinese name
	gifMale: string; // Male GIF filename (without .gif extension)
	gifFemale: string; // Female GIF filename (without .gif extension)
	description: string; // Short description for UI
	colorClass?: string; // Optional: CSS color class for styling
}

/**
 * Authentication Level Definitions
 *
 * GIF files should be located in: /public/images/authentication_level_gif/
 * Format: {gifMale}.gif and {gifFemale}.gif
 */
export const AUTH_LEVEL_CONFIG: AuthLevelConfig[] = [
	{
		level: 1,
		name: "Squire",
		nameChinese: "見習戰士",
		gifMale: "m_squire",
		gifFemale: "f_squire",
		description: "Level 1",
		colorClass: "level1",
	},
	{
		level: 2,
		name: "Chemist",
		nameChinese: "道具士",
		gifMale: "m_chemist",
		gifFemale: "f_chemist",
		description: "Level 2",
		colorClass: "level2",
	},
	{
		level: 3,
		name: "Knight",
		nameChinese: "騎士",
		gifMale: "m_knight",
		gifFemale: "f_knight",
		description: "Level 3",
		colorClass: "level3",
	},
	{
		level: 4,
		name: "Archer",
		nameChinese: "弓箭手",
		gifMale: "m_archer",
		gifFemale: "f_archer",
		description: "Level 4",
		colorClass: "level4",
	},
	{
		level: 5,
		name: "White Mage",
		nameChinese: "白魔道士",
		gifMale: "m_whitemage",
		gifFemale: "f_whitemage",
		description: "Level 5",
		colorClass: "level5",
	},
	{
		level: 6,
		name: "Black Mage",
		nameChinese: "黑魔道士",
		gifMale: "m_blackmage",
		gifFemale: "f_blackmage",
		description: "Level 6",
		colorClass: "level6",
	},
	{
		level: 7,
		name: "Oracle",
		nameChinese: "陰陽師",
		gifMale: "m_oracle",
		gifFemale: "f_oracle",
		description: "Level 7",
		colorClass: "level7",
	},
	{
		level: 8,
		name: "Time Mage",
		nameChinese: "時魔道士",
		gifMale: "m_timemage",
		gifFemale: "f_timemage",
		description: "Level 8",
		colorClass: "level8",
	},
	{
		level: 9,
		name: "Monk",
		nameChinese: "格鬥家",
		gifMale: "m_monk",
		gifFemale: "f_monk",
		description: "Level 9",
		colorClass: "level9",
	},
	{
		level: 10,
		name: "Geomancer",
		nameChinese: "風水士",
		gifMale: "m_geomancer",
		gifFemale: "f_geomancer",
		description: "Level 10",
		colorClass: "level10",
	},
	{
		level: 11,
		name: "Thief",
		nameChinese: "侍",
		gifMale: "m_thief",
		gifFemale: "f_thief",
		description: "Level 11",
		colorClass: "level11",
	},
  	{
		level: 12,
		name: "Summoner",
		nameChinese: "召喚士",
		gifMale: "m_summoner",
		gifFemale: "f_summoner",
		description: "Level 12",
		colorClass: "level12",
	},
	{
		level: 13,
		name: "Ninja",
		nameChinese: "忍者",
		gifMale: "m_ninja",
		gifFemale: "f_ninja",
		description: "Level 13",
		colorClass: "level13",
	},
	{
		level: 14,
		name: "Dragoon",
		nameChinese: "龍騎士",
		gifMale: "m_lancer",
		gifFemale: "f_lancer",
		description: "Level 14",
		colorClass: "level14",
	},
	{
		level: 15,
		name: "Samurai",
		nameChinese: "侍",
		gifMale: "m_samurai",
		gifFemale: "f_samurai",
		description: "Level 15",
		colorClass: "level15",
	},
	{
		level: 20,
		name: "Dark Knight",
		nameChinese: "黒暗騎士",
		gifMale: "m_darkknight",
		gifFemale: "f_darkknight",
		description: "Admin User",
		colorClass: "level20",
	},
	{
		level: 99,
		name: "Holy Knight",
		nameChinese: "GOD",
		gifMale: "m_holyknight",
		gifFemale: "f_holyknight",
		description: "Super Administrator",
		colorClass: "level99",
	},
];

/**
 * Get authentication level config by level number
 */
export const getAuthLevelConfig = (
	level: number,
): AuthLevelConfig | undefined => {
	return AUTH_LEVEL_CONFIG.find((config) => config.level === level);
};

/**
 * Get GIF path for a user based on their level and gender
 */
export const getAuthLevelGifPath = (
	level: number,
	gender?: "m" | "f",
): string => {
	const config = getAuthLevelConfig(level);
	if (!config) {
		// Fallback to squire if level not found
		return `/images/authentication_level_gif/${gender === "m" ? "m_squire" : "f_squire"}.gif`;
	}

	const gifName = gender === "m" ? config.gifMale : config.gifFemale;
	return `/images/authentication_level_gif/${gifName}.gif`;
};

/**
 * Get sorted list of all available levels
 */
export const getAllAuthLevels = (): AuthLevelConfig[] => {
	return [...AUTH_LEVEL_CONFIG].sort((a, b) => a.level - b.level);
};

/**
 * Check if a level exists in the configuration
 */
export const isValidAuthLevel = (level: number): boolean => {
	return AUTH_LEVEL_CONFIG.some((config) => config.level === level);
};
