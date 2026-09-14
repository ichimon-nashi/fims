// src/components/dashboard/HelpUpdatesPanel.tsx
"use client";

import Image from "next/image";
import { APP_META } from "@/lib/appConfig";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/context/AuthContext";
import { useFaq } from "@/components/faq/FaqProvider";
import styles from "./HelpUpdatesPanel.module.css";

/** Right-column 說明與更新 panel: newest update notes + link to 說明中心. */
export default function HelpUpdatesPanel({ limit = 3 }: { limit?: number }) {
	const { entries, openApp, openIndex, loading } = useFaq();
	const permissions = usePermissions();
	const { user } = useAuth();

	const canSee = (id: string) =>
		id === "user-management" || id === "faq_admin"
			? user?.employee_id === "admin" || user?.employee_id === "51892"
			: permissions.hasAppAccess(id as any);

	const updates = entries
		.filter((e) => e.type === "更新" && canSee(e.app_id))
		.sort((a, b) => b.updated_at.localeCompare(a.updated_at))
		.slice(0, limit);

	return (
		<div className={styles.panel} data-anim="panel">
			<div className={styles.title}>
				說明與更新
				{!loading && <span className={styles.badge}>{updates.length} 則更新</span>}
			</div>

			{loading ? (
				<div className={styles.center}><div className={styles.spinner} /></div>
			) : updates.length === 0 ? (
				<div className={styles.emptyText}>目前沒有新的更新紀錄</div>
			) : (
				<div className={styles.list}>
					{updates.map((u) => {
						const app = APP_META.find((a) => a.id === u.app_id);
						if (!app) return null;
						const first = [...u.sections].sort((a, b) => a.sort_order - b.sort_order)[0];
						return (
							<button
								key={u.id}
								type="button"
								className={styles.row}
								onClick={() => openApp(u.app_id, "更新")}
							>
								<div className={styles.icon} style={{ backgroundColor: `${app.color}22` }}>
									<Image src={app.icon} alt="" width={18} height={18} style={{ objectFit: "contain" }} />
								</div>
								<div className={styles.rowText}>
									<div className={styles.rowHead}>
										<span className={styles.rowTitle}>{app.title}</span>
										<span className={styles.rowDate}>{u.updated_at.slice(5, 10).replace("-", "/")}</span>
									</div>
									<div className={styles.rowSummary}>
										{first?.content.split("\n")[0] ?? ""}
									</div>
								</div>
							</button>
						);
					})}
				</div>
			)}

			<button type="button" className={styles.footer} onClick={openIndex}>
				查看全部說明 →
			</button>
		</div>
	);
}
