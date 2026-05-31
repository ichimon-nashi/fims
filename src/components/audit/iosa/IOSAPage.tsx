// src/components/audit/iosa/IOSAPage.tsx
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
	{ id: "dashboard", label: "Dashboard" },
	{ id: "auditprep", label: "AuditPrep" },
	{ id: "audit", label: "Audit" },
	{ id: "results", label: "Results" },
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
			{/* ── Top bar ── */}
			<div className={styles.topbar}>
				<div className={styles.auditTabs}>
					{AUDIT_TABS.map((t) => (
						<button
							key={t.id}
							className={`${styles.auditTab} ${activeAuditType === t.id ? styles.auditTabActive : ""} ${t.id !== "iosa" ? styles.auditTabDisabled : ""}`}
							onClick={() =>
								handleAuditTypeChange(t.id as AuditType)
							}
							disabled={t.id !== "iosa"}
						>
							{t.label}
						</button>
					))}
				</div>
				<div className={styles.topbarRight}>
					<span className={styles.ismBadge}>
						{activeCycle?.ism_edition ?? "ISM Ed.18 Rev1"}
					</span>
				</div>
			</div>

			{/* ── IOSA sub-tabs ── */}
			<div className={styles.subtabbar}>
				{IOSA_SUBTABS.map((t) => (
					<button
						key={t.id}
						className={`${styles.subtab} ${activeIOSATab === t.id ? styles.subtabActive : ""}`}
						onClick={() => setActiveIOSATab(t.id as IOSATab)}
					>
						{t.label}
					</button>
				))}
			</div>

			{/* ── Content ── */}
			<div className={styles.content}>{renderIOSAContent()}</div>

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
