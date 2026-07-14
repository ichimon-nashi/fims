// src/components/admin/UsersV2Test/permissionsEditor.tsx
// Duplicated from AccessControlPanel.tsx by design — see conversation notes.
// AccessControlPanel is on a retirement path; when it's removed, this becomes
// the only copy. Until then, changes to permission structure must be applied
// to both files.
"use client";

import Image from "next/image";
import {
	FaCalendarAlt,
	FaClipboardList,
	FaUserShield,
	FaUtensils,
	FaRunning,
} from "react-icons/fa";
import { FaBookSkull } from "react-icons/fa6";
import { IoBookSharp } from "react-icons/io5";
import { GiDistraction } from "react-icons/gi";
import styles from "./UsersV2Test.module.css";

export interface OralTestPermissions {
	dashboard: boolean;
	results: boolean;
	test: boolean;
	questions: boolean;
}

interface SMSPermissionsUI {
	view_only: boolean;
}

interface MDAfaatPermissionsUI {
	view_only: boolean;
}

export interface AppPermissions {
	roster: boolean;
	tasks: boolean;
	sms: boolean;
	sms_edit?: SMSPermissionsUI;
	oral_test: boolean;
	oral_test_pages?: OralTestPermissions;
	bc_training: boolean;
	mdafaat: boolean;
	mdafaat_edit?: MDAfaatPermissionsUI;
	ads: boolean;
	ccom_review: boolean;
	audit: boolean;
	audit_tabs?: { routine: boolean; first_level: boolean; iosa: boolean };
	audit_iosa_disciplines?: { CAB: boolean; FLT: boolean; DSP: boolean; MNT: boolean; SEC: boolean; CGO: boolean; ORG: boolean; GRH: boolean };
	roulette: boolean;
}

export const getDefaultPermissions = (): AppPermissions => ({
	roster: false,
	tasks: false,
	sms: false,
	sms_edit: { view_only: true },
	oral_test: false,
	oral_test_pages: { dashboard: true, results: true, test: true, questions: true },
	bc_training: false,
	mdafaat: false,
	mdafaat_edit: { view_only: true },
	ads: false,
	ccom_review: false,
	audit: false,
	audit_tabs: { routine: true, first_level: true, iosa: true },
	audit_iosa_disciplines: { CAB: true, FLT: true, DSP: true, MNT: true, SEC: true, CGO: true, ORG: true, GRH: true },
	roulette: false,
});

// ── Transform DB → UI ───────────────────────────────────────────────────
export const transformPermissionsFromDatabase = (dbPermissions: any): AppPermissions | undefined => {
	if (!dbPermissions) return undefined;

	const oralTestPages = dbPermissions.oral_test?.pages
		? {
			dashboard: dbPermissions.oral_test.pages.includes("dashboard"),
			results:   dbPermissions.oral_test.pages.includes("results"),
			test:      dbPermissions.oral_test.pages.includes("test"),
			questions: dbPermissions.oral_test.pages.includes("questions"),
		}
		: { dashboard: true, results: true, test: true, questions: true };

	return {
		roster:     dbPermissions.roster?.access     ?? false,
		tasks:      dbPermissions.tasks?.access      ?? false,
		sms:        dbPermissions.sms?.access        ?? false,
		sms_edit:   { view_only: dbPermissions.sms?.view_only ?? true },
		oral_test:  dbPermissions.oral_test?.access  ?? false,
		oral_test_pages: oralTestPages,
		bc_training: dbPermissions.bc_training?.access ?? false,
		mdafaat:    dbPermissions.mdafaat?.access    ?? false,
		mdafaat_edit: { view_only: dbPermissions.mdafaat?.view_only ?? true },
		ads:        dbPermissions.ads?.access        ?? false,
		ccom_review: dbPermissions.ccom_review?.access ?? false,
		audit:      dbPermissions.audit?.access      ?? false,
		audit_tabs: {
			routine:     (dbPermissions.audit?.tabs ?? ["routine","first_level","iosa"]).includes("routine"),
			first_level: (dbPermissions.audit?.tabs ?? ["routine","first_level","iosa"]).includes("first_level"),
			iosa:        (dbPermissions.audit?.tabs ?? ["routine","first_level","iosa"]).includes("iosa"),
		},
		audit_iosa_disciplines: {
			CAB: (dbPermissions.audit?.iosa_edit_disciplines ?? ["CAB","FLT","DSP","MNT","SEC","CGO","ORG","GRH"]).includes("CAB"),
			FLT: (dbPermissions.audit?.iosa_edit_disciplines ?? ["CAB","FLT","DSP","MNT","SEC","CGO","ORG","GRH"]).includes("FLT"),
			DSP: (dbPermissions.audit?.iosa_edit_disciplines ?? ["CAB","FLT","DSP","MNT","SEC","CGO","ORG","GRH"]).includes("DSP"),
			MNT: (dbPermissions.audit?.iosa_edit_disciplines ?? ["CAB","FLT","DSP","MNT","SEC","CGO","ORG","GRH"]).includes("MNT"),
			SEC: (dbPermissions.audit?.iosa_edit_disciplines ?? ["CAB","FLT","DSP","MNT","SEC","CGO","ORG","GRH"]).includes("SEC"),
			CGO: (dbPermissions.audit?.iosa_edit_disciplines ?? ["CAB","FLT","DSP","MNT","SEC","CGO","ORG","GRH"]).includes("CGO"),
			ORG: (dbPermissions.audit?.iosa_edit_disciplines ?? ["CAB","FLT","DSP","MNT","SEC","CGO","ORG","GRH"]).includes("ORG"),
			GRH: (dbPermissions.audit?.iosa_edit_disciplines ?? ["CAB","FLT","DSP","MNT","SEC","CGO","ORG","GRH"]).includes("GRH"),
		},
		roulette: dbPermissions.roulette?.access ?? false,
	};
};

// ── Transform UI → DB ──────────────────────────────────────────────────
export const transformPermissionsForDatabase = (permissions: AppPermissions | undefined) => {
	if (!permissions) return null;
	return {
		roster:     { access: permissions.roster ?? false, own_data_only: true },
		tasks:      { access: permissions.tasks  ?? false, can_create: false, can_edit_assigned: true },
		sms:        { access: permissions.sms    ?? false, view_only: permissions.sms_edit?.view_only ?? true },
		oral_test:  {
			access: permissions.oral_test ?? false,
			pages: permissions.oral_test_pages
				? Object.entries(permissions.oral_test_pages).filter(([, v]) => v).map(([k]) => k)
				: [],
		},
		bc_training: { access: permissions.bc_training ?? false },
		mdafaat:    { access: permissions.mdafaat ?? false, view_only: permissions.mdafaat_edit?.view_only ?? true },
		ads:        { access: permissions.ads        ?? false },
		ccom_review: { access: permissions.ccom_review ?? false },
		audit:      {
			access: permissions.audit ?? false,
			tabs: Object.entries(permissions.audit_tabs ?? { routine: true, first_level: true, iosa: true }).filter(([, v]) => v).map(([k]) => k),
			iosa_edit_disciplines: Object.entries(permissions.audit_iosa_disciplines ?? { CAB:true,FLT:true,DSP:true,MNT:true,SEC:true,CGO:true,ORG:true,GRH:true }).filter(([, v]) => v).map(([k]) => k),
		},
		roulette: { access: permissions.roulette ?? false },
	};
};

// ── Render function ──────────────────────────────────────────────────
export const renderPermissionsEditor = (
	perms: AppPermissions,
	toggle: (key: keyof AppPermissions) => void,
	oralPageToggle?: (page: keyof OralTestPermissions) => void,
	smsEditToggle?: () => void,
	mdafaatEditToggle?: () => void,
	auditTabToggle?: (tab: "routine" | "first_level" | "iosa") => void,
	auditDiscToggle?: (disc: keyof NonNullable<AppPermissions["audit_iosa_disciplines"]>) => void,
) => (
	<div className={styles.appPermissionsGrid}>
		{/* Roster */}
		<label className={styles.permissionToggle}>
			<input type="checkbox" className={styles.appCheckbox} checked={perms.roster ?? false} onChange={() => toggle("roster")} />
			<span className={styles.appName}><FaCalendarAlt style={{ color: "#3b82f6" }} /> 教師班表 (Roster)</span>
		</label>

		{/* Tasks */}
		<label className={styles.permissionToggle}>
			<input type="checkbox" className={styles.appCheckbox} checked={perms.tasks ?? false} onChange={() => toggle("tasks")} />
			<span className={styles.appName}><FaClipboardList style={{ color: "#10b981" }} /> 任務管理 (Task Manager)</span>
		</label>

		{/* SMS */}
		<div className={styles.permissionBlock}>
			<label className={styles.permissionToggle}>
				<input type="checkbox" className={styles.appCheckbox} checked={perms.sms ?? false} onChange={() => toggle("sms")} />
				<span className={styles.appName}><FaUserShield style={{ color: "#ef4444" }} /> SMS (Safety Management System)</span>
			</label>
			<div className={styles.appSubPermissions}>
				<label className={styles.subPermissionLabel}>
					<input type="checkbox" className={styles.subCheckbox}
						checked={!(perms.sms_edit?.view_only ?? true)}
						onChange={() => smsEditToggle?.()}
						disabled={!perms.sms}
					/>
					<span>Can Edit (可編輯)</span>
				</label>
			</div>
		</div>

		{/* Oral Test */}
		<div className={styles.permissionBlock}>
			<label className={styles.permissionToggle}>
				<input type="checkbox" className={styles.appCheckbox} checked={perms.oral_test ?? false} onChange={() => toggle("oral_test")} />
				<span className={styles.appName}><FaBookSkull style={{ color: "#f59e0b" }} /> 翻書口試 (Oral Test)</span>
			</label>
			<div className={styles.appSubPermissions}>
				{(["dashboard","questions","test","results"] as const).map((page) => (
					<label key={page} className={styles.subPermissionLabel}>
						<input type="checkbox" className={styles.subCheckbox}
							checked={perms.oral_test_pages?.[page] ?? true}
							onChange={() => oralPageToggle?.(page)}
							disabled={!perms.oral_test}
						/>
						<span>
							{page === "dashboard" ? "Dashboard (儀表板)" :
							 page === "questions" ? "Questions (題庫管理)" :
							 page === "test" ? "Test (測試)" : "Results (測試結果)"}
						</span>
					</label>
				))}
			</div>
		</div>

		{/* BC Training */}
		<label className={styles.permissionToggle}>
			<input type="checkbox" className={styles.appCheckbox} checked={perms.bc_training ?? false} onChange={() => toggle("bc_training")} />
			<span className={styles.appName}><FaUtensils style={{ color: "#8b5cf6" }} /> B/C訓練 (商務艙服務訓練)</span>
		</label>

		{/* MDAfaat */}
		<div className={styles.permissionBlock}>
			<label className={styles.permissionToggle}>
				<input type="checkbox" className={styles.appCheckbox} checked={perms.mdafaat ?? false} onChange={() => toggle("mdafaat")} />
				<span className={styles.appName}><FaRunning style={{ color: "#ec4899" }} /> 情境演練 (緊急撤離演練)</span>
			</label>
			<div className={styles.appSubPermissions}>
				<label className={styles.subPermissionLabel}>
					<input type="checkbox" className={styles.subCheckbox}
						checked={!(perms.mdafaat_edit?.view_only ?? true)}
						onChange={() => mdafaatEditToggle?.()}
						disabled={!perms.mdafaat}
					/>
					<span>Can Edit (可編輯)</span>
				</label>
			</div>
		</div>

		{/* AdS */}
		<label className={styles.permissionToggle}>
			<input type="checkbox" className={styles.appCheckbox} checked={perms.ads ?? false} onChange={() => toggle("ads")} />
			<span className={styles.appName}><GiDistraction style={{ color: "#14b8a6" }} /> AdS (注意力測試器)</span>
		</label>

		{/* CCOM */}
		<label className={styles.permissionToggle}>
			<input type="checkbox" className={styles.appCheckbox} checked={perms.ccom_review ?? false} onChange={() => toggle("ccom_review")} />
			<span className={styles.appName}><IoBookSharp style={{ color: "#fb923c" }} /> CCOM抽問 (目錄抽問)</span>
		</label>

		{/* Audit */}
		<div className={styles.permissionBlock}>
			<label className={styles.permissionToggle}>
				<input type="checkbox" className={styles.appCheckbox} checked={perms.audit ?? false} onChange={() => toggle("audit")} />
				<span className={styles.appName}>
					<Image src="/images/audit.png" alt="audit" width={16} height={16} style={{ objectFit: "contain", verticalAlign: "middle" }} />{" "}
					查核管理 (Audit)
				</span>
			</label>
			{perms.audit && (
				<div className={styles.auditSubPerms}>
					<div className={styles.auditSubGroup}>
						<div className={styles.auditSubGroupLabel}>Tab Access</div>
						<div className={styles.auditSubGroupItems}>
							{(["routine","first_level","iosa"] as const).map((tab) => (
								<label key={tab} className={styles.subPermissionLabel}>
									<input type="checkbox" className={styles.appCheckbox}
										checked={perms.audit_tabs?.[tab] ?? true}
										onChange={() => auditTabToggle?.(tab)}
									/>
									<span className={styles.appName}>
										{tab === "routine" ? "例行性 (Routine)" : tab === "first_level" ? "一級查核 (First Level)" : "IOSA"}
									</span>
								</label>
							))}
						</div>
					</div>
					{(perms.audit_tabs?.iosa ?? true) && (
						<div className={styles.auditSubGroup}>
							<div className={styles.auditSubGroupLabel}>IOSA Edit Access (disciplines)</div>
							<div className={styles.disciplineGrid}>
								{(["CAB","FLT","DSP","MNT","SEC","CGO","ORG","GRH"] as const).map((disc) => (
									<label key={disc} className={styles.subPermissionLabel}>
										<input type="checkbox" className={styles.appCheckbox}
											checked={perms.audit_iosa_disciplines?.[disc] ?? true}
											onChange={() => auditDiscToggle?.(disc)}
										/>
										<span className={styles.appName}>{disc}</span>
									</label>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>

		{/* Roulette */}
		<label className={styles.permissionToggle}>
			<input type="checkbox" className={styles.appCheckbox} checked={perms.roulette ?? false} onChange={() => toggle("roulette")} />
			<span className={styles.appName}>🎲 天選之人 (Roulette)</span>
		</label>
	</div>
);