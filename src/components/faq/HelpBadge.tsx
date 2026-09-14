// src/components/faq/HelpBadge.tsx
"use client";

import { useFaq } from "./FaqProvider";
import styles from "./HelpBadge.module.css";

/**
 * The ? affordance. Drop inside any position:relative container —
 * a quick-action tile, an app page header, a panel title.
 */
export default function HelpBadge({ appId, label }: { appId: string; label: string }) {
	const { openApp } = useFaq();

	return (
		<button
			type="button"
			className={styles.badge}
			aria-label={`${label} 使用說明`}
			title={`${label} 使用說明`}
			onClick={(e) => {
				e.preventDefault();   // tile is an <a>; don't navigate
				e.stopPropagation();
				openApp(appId);
			}}
		>
			?
		</button>
	);
}
