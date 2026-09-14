// src/lib/faq.types.ts

export type FaqType = "說明" | "更新";

export interface FaqSection {
	content: string;
	image_url: string | null;
	sort_order: number;
}

export interface FaqEntry {
	id: string;
	app_id: string;       // matches the ids usePermissions() uses
	title: string;        // '功能介紹' | '更新 2026/09/02'
	type: FaqType;
	sections: FaqSection[];
	sort_order: number;
	updated_at: string;
}

/** One entry per FIMS app — the single source of truth for id/name/icon/colour. */
export interface AppMeta {
	id: string;
	title: string;
	icon: string;
	href: string;
	color: string;
}