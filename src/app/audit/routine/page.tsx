// src/app/audit/routine/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/context/AuthContext";
import styles from "./routine.module.css";
import RoutineSummary from "@/components/audit/routine/RoutineSummary";
import PendingReviewList from "@/components/audit/routine/PendingReviewList";
import SelfInspectionForm from "@/components/audit/routine/SelfInspectionForm";
import MonthlyFocusEditor from "@/components/audit/routine/MonthlyFocusEditor";

type Tab = "summary" | "new" | "pending";

const AUDIT_TABS = [
	{ id: "routine", label: "例行性", href: "/audit/routine", tab: "routine" as const },
	{ id: "firstlevel", label: "一級查核", href: "/audit/firstlevel", tab: "first_level" as const },
	{ id: "iosa", label: "IOSA", href: "/audit/iosa", tab: "iosa" as const },
];

export default function RoutineAuditPage() {
	const [tab, setTab] = useState<Tab>("summary");
	const router = useRouter();
	const permissions = usePermissions();
	const { token } = useAuth();
	const hasAccess = permissions.hasAuditTabAccess("routine");
	const canSubmit = permissions.hasRoutineAction("submit");
	const canApprove = permissions.hasRoutineAction("approve");
	const [showFocusEditor, setShowFocusEditor] = useState(false);
	const [flaggedCount, setFlaggedCount] = useState(0);
	const [pendingCount, setPendingCount] = useState(0);
	const visibleAuditTabs = AUDIT_TABS.filter((t) =>
		permissions.hasAuditTabAccess(t.tab)
	);

	const refreshCounts = useCallback(() => {
		if (!token || !hasAccess) return;
		fetch("/api/audit/routine/flagged-count", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((d) => setFlaggedCount(d.count ?? 0));
		fetch("/api/audit/routine/self-inspection?status=pending", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((d) => setPendingCount((d.records ?? []).length));
	}, [token, hasAccess]);

	useEffect(() => {
		if (!hasAccess) router.replace("/audit");
	}, [hasAccess, router]);

	// fall back to summary if the current tab's permission is lost mid-session
	// (e.g. a token refresh picks up updated permissions)
	useEffect(() => {
		if (tab === "new" && !canSubmit) setTab("summary");
		if (tab === "pending" && !canApprove) setTab("summary");
	}, [tab, canSubmit, canApprove]);

	useEffect(() => {
		refreshCounts();
	}, [tab, refreshCounts]);

	useEffect(() => {
		window.addEventListener("routine-flagged-count-changed", refreshCounts);
		return () => window.removeEventListener("routine-flagged-count-changed", refreshCounts);
	}, [refreshCounts]);

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
					<button
						className={tab === "summary" ? styles.tabActive : styles.tab}
						onClick={() => setTab("summary")}
					>
						彙整分析{flaggedCount > 0 && ` (${flaggedCount})`}
					</button>
					{canSubmit && (
						<button
							className={tab === "new" ? styles.tabActive : styles.tab}
							onClick={() => setTab("new")}
						>
							新增查核
						</button>
					)}
					{canApprove && (
						<button
							className={tab === "pending" ? styles.tabActive : styles.tab}
							onClick={() => setTab("pending")}
						>
							待審核{pendingCount > 0 && ` (${pendingCount})`}
						</button>
					)}
					{canApprove && (
						<button className={styles.focusEditorLink} onClick={() => setShowFocusEditor(true)}>
							編輯本月重點
						</button>
					)}
				</div>

				{tab === "summary" && <RoutineSummary />}
				{tab === "new" && canSubmit && (
					<SelfInspectionForm
						onClose={() => setTab("summary")}
						onSubmitted={() => {
							setTab("summary");
							refreshCounts();
						}}
					/>
				)}
				{tab === "pending" && canApprove && <PendingReviewList onChanged={refreshCounts} />}
			</div>

			{showFocusEditor && <MonthlyFocusEditor onClose={() => setShowFocusEditor(false)} />}
		</div>
	);
}