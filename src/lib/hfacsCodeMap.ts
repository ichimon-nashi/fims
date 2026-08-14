// src/lib/hfacsCodeMap.ts
//
// Merges routine audit's SAM (root-cause) codes with SMS's human-factors
// codes into one canonical code set, for the 趨勢分析 (trend analysis) tab
// only. Neither source file is touched — this is purely additive.
//
// The two taxonomies mostly agree except for zero-padding: SAM writes
// "RM01", SMS's human-factors picker writes "RM1". Stripping leading
// zeros from the numeric suffix correctly unifies every code that
// actually has a counterpart in both systems (verified against the real
// code lists, not assumed) — 64 of SAM's 81 codes and 64 of SMS's 66
// codes match this way.
//
// The remaining codes (17 SAM-only, 2 SMS-only) are NOT a formatting
// problem — SAM's taxonomy simply goes deeper in several categories than
// the SRM picker offers, and SMS's "OTHR" catch-all isn't part of SAM's
// fixed taxonomy at all. Per [user], these stay as separate, single-source
// categories rather than being force-matched. MANUAL_ALIASES below exists
// for the day a real equivalence is spotted by hand.

import { SAM_CODE_MAP } from "./routineAudit.constants";
import { HUMAN_FACTOR_CATEGORIES } from "./sms.constants";

// Confirmed-by-hand equivalences that automatic zero-stripping does NOT
// already catch. Key: the raw SAM code (e.g. "RM06"). Value: the raw SMS
// code it should be treated as identical to. Empty until someone
// confirms a real match — do not guess entries here.
export const MANUAL_ALIASES: Record<string, string> = {};

function stripLeadingZeros(code: string): string {
	const m = code.match(/^([A-Za-z]+?)0*(\d+)$/);
	return m ? `${m[1]}${m[2]}` : code;
}

export function normalizeHfacsCode(rawCode: string): string {
	const aliased = MANUAL_ALIASES[rawCode] ?? rawCode;
	return stripLeadingZeros(aliased);
}

export interface CanonicalHfacsEntry {
	normalizedCode: string;
	description: string;
	category?: string; // SAM "area / category" when available, else SMS category name
	area?: string; // HFACS top-level area (組織影響 / 不安全督導 / 不安全行為之前置條件 / 不安全行為) — undefined only for the 2 SMS-only codes with no SAM entry
	inSam: boolean;
	inSms: boolean;
}

function buildCanonicalMap(): Record<string, CanonicalHfacsEntry> {
	const map = new Map<string, CanonicalHfacsEntry>();

	// Seed from SAM first — its description carries area+category context,
	// which is why SAM's description wins when a code exists in both.
	Object.values(SAM_CODE_MAP).forEach((entry) => {
		const norm = normalizeHfacsCode(entry.code);
		map.set(norm, {
			normalizedCode: norm,
			description: entry.description_zh,
			category: `${entry.area} / ${entry.category}`,
			area: entry.area,
			inSam: true,
			inSms: false,
		});
	});

	// Merge in SMS: fills description for the 2 SMS-only codes, marks
	// inSms=true on the 64 that already matched from the SAM pass. The 2
	// SMS-only codes (CMG1, OTHR) have no SAM area at all — falls back to
	// their own SMS category name rather than leaving area undefined,
	// since undefined would otherwise silently drop them from the
	// area-level trend view.
	HUMAN_FACTOR_CATEGORIES.forEach((cat) => {
		cat.subcodes.forEach((sub) => {
			const norm = normalizeHfacsCode(sub.code);
			const existing = map.get(norm);
			if (existing) {
				existing.inSms = true;
			} else {
				map.set(norm, {
					normalizedCode: norm,
					description: sub.description,
					category: cat.name,
					area: cat.name,
					inSam: false,
					inSms: true,
				});
			}
		});
	});

	return Object.fromEntries(map);
}

export const CANONICAL_HFACS_MAP: Record<string, CanonicalHfacsEntry> = buildCanonicalMap();