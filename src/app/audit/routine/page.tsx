// src/app/audit/routine/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import styles from "./routine.module.css";
import RoutineSummary from "@/components/audit/routine/RoutineSummary";

type Tab = "new" | "summary";

const AUDIT_TABS = [
	{ id: "routine", label: "例行性", href: "/audit/routine", tab: "routine" as const },
	{ id: "firstlevel", label: "一級查核", href: "/audit/firstlevel", tab: "first_level" as const },
	{ id: "iosa", label: "IOSA", href: "/audit/iosa", tab: "iosa" as const },
];

export default function RoutineAuditPage() {
	const [tab, setTab] = useState<Tab>("summary");
	const router = useRouter();
	const permissions = usePermissions();
	const hasAccess = permissions.hasAuditTabAccess("routine");
	const visibleAuditTabs = AUDIT_TABS.filter((t) =>
		permissions.hasAuditTabAccess(t.tab)
	);

	useEffect(() => {
		if (!hasAccess) router.replace("/audit");
	}, [hasAccess, router]);

	if (!hasAccess) return null;

	return (
		<div className={styles.pageShell}>
			<div className={styles.topbar}>
				<div className={styles.auditTabs}>
					{visibleAuditTabs.map((t) => (
						<button
							key={t.id}
							className={`${styles.auditTab} ${t.id === "routine" ? styles.auditTabActive : ""}`}
							onClick={() => {
								if (t.id !== "routine") router.push(t.href);
							}}
						>
							{t.label}
						</button>
					))}
				</div>
			</div>

			<div className={styles.content}>
				<div className={styles.tabBar}>
					<button className={styles.tabDisabled} disabled title="研發中，請耐心等候">
						新增查核
					</button>
					<button
						className={tab === "summary" ? styles.tabActive : styles.tab}
						onClick={() => setTab("summary")}
					>
						彙整分析
					</button>
				</div>

				{tab === "summary" && <RoutineSummary />}
			</div>
		</div>
	);
}