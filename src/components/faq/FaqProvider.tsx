// src/components/faq/FaqProvider.tsx
"use client";

import {
	createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import type { FaqEntry, FaqType } from "@/lib/faq.types";
import FaqDrawer from "./FaqDrawer";

interface DrawerState {
	view: "index" | "app";
	appId: string | null;
	tab: FaqType;
}

interface FaqContextValue {
	entries: FaqEntry[];
	loading: boolean;
	/** Open one app's guide. Wire this to the ? badge on each tile. */
	openApp: (appId: string, tab?: FaqType) => void;
	/** Open the 說明中心 index of every app the user can access. */
	openIndex: () => void;
	close: () => void;
	/** Entries for one app + type — 使用說明 oldest first, 更新紀錄 newest first. */
	entriesFor: (appId: string, type: FaqType) => FaqEntry[];
}

const FaqContext = createContext<FaqContextValue | null>(null);

export function useFaq() {
	const ctx = useContext(FaqContext);
	if (!ctx) throw new Error("useFaq must be used inside <FaqProvider>");
	return ctx;
}

/**
 * Wrap the authed part of the app (or just the dashboard) in this.
 * It fetches once, owns the drawer, and exposes openApp/openIndex so any
 * ? button anywhere can open the right guide.
 */
export default function FaqProvider({ children }: { children: React.ReactNode }) {
	const { token } = useAuth();
	const [entries, setEntries] = useState<FaqEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [drawer, setDrawer] = useState<DrawerState | null>(null);

	useEffect(() => {
		if (!token) return;
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/faq", {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (res.ok && !cancelled) {
					const data = await res.json();
					setEntries(data.entries || []);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [token]);

	const entriesFor = useCallback(
		(appId: string, type: FaqType) =>
			entries
				.filter((e) => e.app_id === appId && e.type === type)
				.sort((a, b) =>
					type === "更新"
						? b.updated_at.localeCompare(a.updated_at) // 更新紀錄：newest first
						: a.updated_at.localeCompare(b.updated_at) // 使用說明：oldest first
				),
		[entries]
	);

	const value = useMemo<FaqContextValue>(
		() => ({
			entries,
			loading,
			entriesFor,
			openApp: (appId, tab = "說明") => setDrawer({ view: "app", appId, tab }),
			openIndex: () => setDrawer({ view: "index", appId: null, tab: "說明" }),
			close: () => setDrawer(null),
		}),
		[entries, loading, entriesFor]
	);

	return (
		<FaqContext.Provider value={value}>
			{children}
			{drawer && (
				<FaqDrawer
					view={drawer.view}
					appId={drawer.appId}
					initialTab={drawer.tab}
					onClose={() => setDrawer(null)}
					onSelectApp={(id, tab) => setDrawer({ view: "app", appId: id, tab: tab ?? "說明" })}
					onShowIndex={() => setDrawer({ view: "index", appId: null, tab: "說明" })}
				/>
			)}
		</FaqContext.Provider>
	);
}
