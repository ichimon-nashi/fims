// src/components/audit/iosa/IOSAPage.tsx
// LAYOUT: audit-type switcher (routine/first-level/IOSA) is a real top bar again,
// per request — it no longer lives inside the rail. The IOSA lifecycle nav
// (Dashboard/AuditPrep/Audit/Results) still uses the left rail. All state,
// routing, handlers and child props are unchanged.
"use client";

import { useState } from "react";
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

export default function IOSAPage() {
	const router = useRouter();
	const [activeAuditType, setActiveAuditType] = useState<AuditType>("iosa");
	const [activeIOSATab, setActiveIOSATab] = useState<IOSATab>("dashboard");
	const [showImport, setShowImport] = useState(false);
	// Lifted from IOSADashboard so all sub-pages share the same cycle context
	const [activeCycle, setActiveCycle] = useState<ActiveCycle | null>(null);

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
				<aside className={styles.rail}>
					<div className={styles.railLabel}>AUDIT LIFECYCLE</div>

					{/* IOSA lifecycle nav (was the sub-tab bar) */}
					<nav className={styles.nav}>
						{IOSA_SUBTABS.map((t) => (
							<button
								key={t.id}
								className={`${styles.subtab} ${activeIOSATab === t.id ? styles.subtabActive : ""}`}
								onClick={() => setActiveIOSATab(t.id as IOSATab)}
							>
								<span className={styles.subtabMark} />
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