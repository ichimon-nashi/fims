// src/components/audit/iosa/IOSAPage.tsx
// LAYOUT: audit-type switcher (routine/first-level/IOSA) is a real top bar again,
// per request — it no longer lives inside the rail. The IOSA lifecycle nav
// (Dashboard/AuditPrep/Audit/Results) still uses the left rail. All state,
// routing, handlers and child props are unchanged.
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./IOSAPage.module.css";
import IOSADashboard from "./IOSADashboard";
import IOSAAuditPrep from "./IOSAAuditPrep";
import IOSAAudit from "./IOSAAudit";
import IOSAResults from "./IOSAResults";
import IOSAImport from "./IOSAImport";

type AuditType = "routine" | "firstlevel" | "iosa";
type IOSATab = "dashboard" | "auditprep" | "audit" | "results";

interface ActiveCycle {
	id: string;
	name: string;
	disciplines: string[];
	ism_edition: string;
}

const AUDIT_TABS = [
	{ id: "routine", label: "例行性" },
	{ id: "firstlevel", label: "一級查核" },
	{ id: "iosa", label: "IOSA" },
] as const;

const IOSA_SUBTABS = [
	{ id: "dashboard", label: "Dashboard", sub: "Cycle overview" },
	{ id: "auditprep", label: "AuditPrep", sub: "Evidence & references" },
	{ id: "audit", label: "Audit", sub: "Auditor session" },
	{ id: "results", label: "Results", sub: "Conformance report" },
] as const;

// Icons for the collapsed rail (above 900px)
const SUBTAB_ICONS: Record<IOSATab, React.ReactNode> = {
	dashboard: (
		<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
			<rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
			<rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
			<rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
		</svg>
	),
	auditprep: (
		<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<rect x="5" y="4" width="14" height="17" rx="2" />
			<path d="M9 4.5h6v2.5H9z" />
			<path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
		</svg>
	),
	audit: (
		<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M4 6.5l1.8 1.8L9 5M4 12.5l1.8 1.8L9 11M4 18.5l1.8 1.8L9 17" />
			<path d="M12.5 7h7.5M12.5 13h7.5M12.5 19h7.5" />
		</svg>
	),
	results: (
		<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M4 20h16" />
			<rect x="6" y="11" width="3" height="7" rx="1" />
			<rect x="11" y="6" width="3" height="12" rx="1" />
			<rect x="16" y="13" width="3" height="5" rx="1" />
		</svg>
	),
};

export default function IOSAPage() {
	const router = useRouter();
	const [activeAuditType, setActiveAuditType] = useState<AuditType>("iosa");
	const [activeIOSATab, setActiveIOSATab] = useState<IOSATab>("dashboard");
	const [showImport, setShowImport] = useState(false);
	// Lifted from IOSADashboard so all sub-pages share the same cycle context
	const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);

	// Rail full/collapsed — one user preference for every IOSA page,
	// remembered per browser. First visit: collapsed below 1280px.
	// Read after mount (not in the initializer) to avoid a hydration mismatch.
	const [railCollapsed, setRailCollapsed] = useState(false);
	const [railAnimate, setRailAnimate] = useState(false);
	useEffect(() => {
		try {
			const v = localStorage.getItem("iosa.railCollapsed");
			setRailCollapsed(v === null ? window.innerWidth < 1280 : v === "1");
		} catch {
			/* storage unavailable — keep default */
		}
		// Enable the width transition only after the initial state is applied,
		// so the rail doesn't visibly animate on page load.
		const t = setTimeout(() => setRailAnimate(true), 50);
		return () => clearTimeout(t);
	}, []);
	const toggleRail = () =>
		setRailCollapsed((c) => {
			const next = !c;
			try {
				localStorage.setItem("iosa.railCollapsed", next ? "1" : "0");
			} catch {
				/* ignore */
			}
			return next;
		});

	const handleAuditTypeChange = (type: AuditType) => {
		setActiveAuditType(type);
		if (type === "routine") router.push("/audit/routine");
		if (type === "firstlevel") router.push("/audit/firstlevel");
	};

	const renderIOSAContent = () => {
		switch (activeIOSATab) {
			case "dashboard":
				return (
					<IOSADashboard
						onCycleChange={setActiveCycle}
						onImport={() => setShowImport(true)}
					/>
				);
			case "auditprep":
				return <IOSAAuditPrep activeCycle={activeCycle} />;
			case "audit":
				return <IOSAAudit activeCycle={activeCycle} />;
			case "results":
				return <IOSAResults activeCycle={activeCycle} />;
		}
	};

	return (
		<div className={styles.shell}>
			{/* ── Top bar: audit-type switcher (routine / first-level / IOSA) ── */}
			<div className={styles.topbar}>
				<div className={styles.topbarTabs}>
					{AUDIT_TABS.map((t) => (
						<button
							key={t.id}
							className={`${styles.topbarTab} ${activeAuditType === t.id ? styles.topbarTabActive : ""}`}
							onClick={() =>
								handleAuditTypeChange(t.id as AuditType)
							}
						>
							{t.label}
						</button>
					))}
				</div>
			</div>

			<div className={styles.shellBody}>
				{/* ── Left lifecycle rail ── */}
				{/* Rail: user-toggled full / icon-only (desktop & landscape only) */}
				<aside
					className={`${styles.rail} ${railCollapsed ? styles.railCompact : ""} ${railAnimate ? styles.railAnimated : ""}`}
				>
					<div className={styles.railLabel}>AUDIT LIFECYCLE</div>

					{/* IOSA lifecycle nav (was the sub-tab bar) */}
					<nav className={styles.nav}>
						{IOSA_SUBTABS.map((t) => (
							<button
								key={t.id}
								className={`${styles.subtab} ${activeIOSATab === t.id ? styles.subtabActive : ""}`}
								onClick={() => setActiveIOSATab(t.id as IOSATab)}
								title={`${t.label} — ${t.sub}`}
							>
								<span className={styles.subtabMark} />
								<span className={styles.subtabIcon}>
									{SUBTAB_ICONS[t.id as IOSATab]}
								</span>
								<span className={styles.subtabText}>
									<span className={styles.subtabLabel}>
										{t.label}
									</span>
									<span className={styles.subtabSub}>
										{t.sub}
									</span>
								</span>
							</button>
						))}
					</nav>

					{/* Active cycle context */}
					<div className={styles.railFoot}>
						<div className={styles.railFootLabel}>ACTIVE CYCLE</div>
						<div className={styles.railFootName}>
							{activeCycle?.name ?? "未選擇週期"}
						</div>
						<div className={styles.railFootMeta}>
							<span className={styles.ismBadge}>
								{activeCycle?.ism_edition ?? "ISM Ed.18 Rev1"}
							</span>
							{activeCycle?.disciplines?.length ? (
								<span className={styles.railFootDiscs}>
									{activeCycle.disciplines.length} disciplines
								</span>
							) : null}
						</div>
					</div>

					<button
						className={styles.railToggle}
						onClick={toggleRail}
						title={railCollapsed ? "展開側欄" : "收合側欄"}
						aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						aria-expanded={!railCollapsed}
					>
						{/* Panel icon (sidebar + chevron) — the convention from VS Code,
						    Notion, Linear. Chevron points where the rail will go. */}
						<svg
							viewBox="0 0 24 24"
							width="18"
							height="18"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
							<path d="M9 4.5v15" />
							<path
								d={railCollapsed ? "M13.5 10l2 2-2 2" : "M15.5 10l-2 2 2 2"}
							/>
						</svg>
					</button>
				</aside>

				{/* ── Content ── */}
				<div className={styles.content}>{renderIOSAContent()}</div>
			</div>

			{showImport && (
				<IOSAImport
					cycleId={activeCycle?.id ?? null}
					ismEdition={activeCycle?.ism_edition ?? "Ed.18 Rev1"}
					onClose={() => setShowImport(false)}
					onComplete={() => setActiveIOSATab("dashboard")}
				/>
			)}
		</div>
	);
}