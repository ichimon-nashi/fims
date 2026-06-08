// src/components/admin/AccessControlPanel/AccessControlPanel.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import {
	FaCalendarAlt,
	FaClipboardList,
	FaUserShield,
	FaUtensils,
	FaRunning,
	FaPlus,
} from "react-icons/fa";
import { FaBookSkull } from "react-icons/fa6";
import { IoBookSharp } from "react-icons/io5";
import { GiDistraction } from "react-icons/gi";
import {
	getAllAuthLevels,
	getAuthLevelConfig,
	getAuthLevelGifPath,
	AUTH_LEVEL_CONFIG,
} from "@/lib/authLevelConfig";
import { getCustomAvatarGif } from "@/lib/customAvatarMapping";
import styles from "./AccessControlPanel.module.css";

// ── Portal: renders children directly under document.body,
//    escaping any ancestor overflow/transform/stacking context ───────────────
const ModalPortal = ({ children }: { children: React.ReactNode }) => {
	const [mounted, setMounted] = useState(false);
	useEffect(() => { setMounted(true); }, []);
	if (!mounted) return null;
	return createPortal(children, document.body);
};

// ── Avatar GIF keys per gender (mirrored from authLevelConfig) ──────────────
const GIF_KEYS = {
	M: [
		"m_squire","m_chemist","m_knight","m_archer","m_whitemage",
		"m_blackmage","m_oracle","m_timemage","m_monk","m_geomancer",
		"m_thief","m_summoner","m_ninja","m_lancer","m_samurai",
		"m_darkknight","m_holyknight","m_bard","m_calculator",
		"m_engineer","m_hellknight","m_hunter","m_mediator","m_mimic",
		"m_monster","m_onionknight","m_pirate","m_ramza1","m_ramza2",
		"m_ramza3","m_robot","m_soldier","m_templeknight",
	],
	F: [
		"f_squire","f_chemist","f_knight","f_archer","f_whitemage",
		"f_blackmage","f_oracle","f_timemage","f_monk","f_geomancer",
		"f_thief","f_summoner","f_ninja","f_lancer","f_samurai",
		"f_darkknight","f_holyknight","f_calculator","f_dancer",
		"f_dragon","f_dragoner","f_hellknight","f_mediator","f_mimic",
		"f_onionknight","f_templeknight",
	],
};

const RANK_PRESETS: { value: string; label: string }[] = [
	{ value: "FI - Flight Attendant Instructor", label: "FI" },
	{ value: "SC - Section Chief",               label: "SC" },
	{ value: "MG - Manager",                     label: "MG" },
	{ value: "OTHER",                            label: "OTHER" },
];

const BASE_OPTIONS = ["TSA", "KHH", "RMQ"];

// Rank badge colours
const RANK_COLORS: Record<string, { bg: string; color: string }> = {
	"FA":    { bg: "#64748b", color: "#fff" },
	"FS":    { bg: "#7c3aed", color: "#fff" },
	"LF":    { bg: "#0891b2", color: "#fff" },
	"PR":    { bg: "#d97706", color: "#fff" },
	"FI":    { bg: "#16a34a", color: "#fff" },
	"SC":    { bg: "#dc2626", color: "#fff" },
	"MG":    { bg: "#9333ea", color: "#fff" },
	"OTHER": { bg: "#475569", color: "#fff" },
};

// App chip colours
const APP_CHIP_COLORS: Record<string, { bg: string; border: string; color: string }> = {
	"班表":  { bg: "rgba(59,130,246,0.18)",  border: "rgba(59,130,246,0.4)",  color: "#60a5fa" },
	"任務":  { bg: "rgba(16,185,129,0.18)",  border: "rgba(16,185,129,0.4)",  color: "#34d399" },
	"SMS":   { bg: "rgba(239,68,68,0.18)",   border: "rgba(239,68,68,0.4)",   color: "#f87171" },
	"口試":  { bg: "rgba(245,158,11,0.18)",  border: "rgba(245,158,11,0.4)",  color: "#fbbf24" },
	"B/C":   { bg: "rgba(139,92,246,0.18)",  border: "rgba(139,92,246,0.4)",  color: "#a78bfa" },
	"情境":  { bg: "rgba(236,72,153,0.18)",  border: "rgba(236,72,153,0.4)",  color: "#f472b6" },
	"AdS":   { bg: "rgba(20,184,166,0.18)",  border: "rgba(20,184,166,0.4)",  color: "#2dd4bf" },
	"CCOM":  { bg: "rgba(251,146,60,0.18)",  border: "rgba(251,146,60,0.4)",  color: "#fb923c" },
	"查核":  { bg: "rgba(168,85,247,0.18)",  border: "rgba(168,85,247,0.4)",  color: "#c084fc" },
	"抽籤":  { bg: "rgba(251,191,36,0.18)",  border: "rgba(251,191,36,0.4)",  color: "#fbbf24" },
};

interface OralTestPermissions {
	dashboard: boolean;
	results: boolean;
	test: boolean;
	questions: boolean;
	users: boolean;
}

interface SMSPermissionsUI {
	view_only: boolean;
}

interface MDAfaatPermissionsUI {
	view_only: boolean;
}

interface AppPermissions {
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

interface User {
	id: string;
	employee_id: string;
	full_name: string;
	rank: string;
	base: string;
	authentication_level: number;
	app_permissions?: AppPermissions;
	gender?: string;
}

// ── New-user form shape ───────────────────────────────────────────────────────
interface NewUserForm {
	employee_id: string;
	full_name: string;
	rank: string;
	base: string;
	password: string;
	gender: "M" | "F" | "";
	avatar_gif: string;
	app_permissions: AppPermissions;
}

const getDefaultPermissions = (): AppPermissions => ({
	roster: false,
	tasks: false,
	sms: false,
	sms_edit: { view_only: true },
	oral_test: false,
	oral_test_pages: { dashboard: true, results: true, test: true, questions: true, users: true },
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

const blankNewUserForm = (): NewUserForm => ({
	employee_id: "",
	full_name: "",
	rank: "",
	base: "",
	password: "",
	gender: "",
	avatar_gif: "",
	app_permissions: getDefaultPermissions(),
});

// ─────────────────────────────────────────────────────────────────────────────

const AccessControlPanel = () => {
	const { token } = useAuth();
	const [users, setUsers] = useState<User[]>([]);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [showEditModal, setShowEditModal] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [userToDelete, setUserToDelete] = useState<User | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

	// Password (in edit modal)
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [passwordSuccess, setPasswordSuccess] = useState("");
	const [resettingPassword, setResettingPassword] = useState(false);

	// Permission saving
	const [savingPermissions, setSavingPermissions] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState("");
	const [saveError, setSaveError] = useState("");

	// Add user
	const [newUserForm, setNewUserForm] = useState<NewUserForm>(blankNewUserForm());
	const [addingUser, setAddingUser] = useState(false);
	const [addUserError, setAddUserError] = useState("");
	const [addUserSuccess, setAddUserSuccess] = useState("");

	// Delete
	const [deletingUser, setDeletingUser] = useState(false);
	const [deleteError, setDeleteError] = useState("");

	useEffect(() => { fetchUsers(); }, []);

	// ── Transform DB → UI ──────────────────────────────────────────────────
	const transformPermissionsFromDatabase = (dbPermissions: any): AppPermissions | undefined => {
		if (!dbPermissions) return undefined;

		const oralTestPages = dbPermissions.oral_test?.pages
			? {
				dashboard: dbPermissions.oral_test.pages.includes("dashboard"),
				results:   dbPermissions.oral_test.pages.includes("results"),
				test:      dbPermissions.oral_test.pages.includes("test"),
				questions: dbPermissions.oral_test.pages.includes("questions"),
				users:     dbPermissions.oral_test.pages.includes("users"),
			}
			: { dashboard: true, results: true, test: true, questions: true, users: true };

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
	const transformPermissionsForDatabase = (permissions: AppPermissions | undefined) => {
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

	const fetchUsers = async () => {
		setLoading(true);
		setError("");
		try {
			const response = await fetch("/api/admin/users", {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (response.ok) {
				const data = await response.json();
				const transformed = data.map((user: any) => ({
					...user,
					app_permissions: transformPermissionsFromDatabase(user.app_permissions),
				}));
				setUsers(transformed.sort((a: User, b: User) =>
					a.employee_id.localeCompare(b.employee_id, "zh-TW", { numeric: true })
				));
			} else {
				setError("無法載入使用者列表");
			}
		} catch (err) {
			setError("網路錯誤，請稍後再試");
		} finally {
			setLoading(false);
		}
	};

	const filteredUsers = useMemo(() => {
		const withoutAdmin = users.filter(
			(u) => !["admin", "20580", "21531"].includes(u.employee_id),
		);
		if (!searchQuery.trim()) return withoutAdmin;
		const q = searchQuery.toLowerCase().trim();
		return withoutAdmin.filter(
			(u) => u.employee_id.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q),
		);
	}, [users, searchQuery]);

	// ── Avatar helpers ─────────────────────────────────────────────────────
	const getAuthLevelGif = (level: number, user: User): string => {
		const customGif = getCustomAvatarGif(user.employee_id);
		if (customGif) return `/images/authentication_level_gif/${customGif}`;
		const gender = user.gender?.toLowerCase().trim() || "";
		const genderType = gender === "m" || gender === "male" ? "m" : "f";
		return getAuthLevelGifPath(level, genderType);
	};

	const getAuthLevelName = (level: number): string => {
		const config = getAuthLevelConfig(level);
		return config ? `${config.nameChinese} (${config.name})` : `等級 ${level}`;
	};

	// ── Rank helpers ───────────────────────────────────────────────────────
	const getRankShort = (rank: string): string => rank.split(" - ")[0] || rank;

	const getRankColors = (rank: string) => {
		const short = getRankShort(rank);
		return RANK_COLORS[short] || { bg: "rgba(255,255,255,0.09)", color: "#e8e9ed" };
	};

	// ── Permission chips ───────────────────────────────────────────────────
	const getPermissionChips = (user: User): string[] => {
		if (!user.app_permissions) return [];
		const map: Record<string, string> = {
			roster: "班表", tasks: "任務", sms: "SMS",
			oral_test: "口試", bc_training: "B/C", mdafaat: "情境",
			ads: "AdS", ccom_review: "CCOM", audit: "查核", roulette: "抽籤",
		};
		return Object.entries(map)
			.filter(([key]) => user.app_permissions![key as keyof AppPermissions])
			.map(([, label]) => label);
	};

	// ── Edit modal ─────────────────────────────────────────────────────────
	const handleSelectUser = (user: User) => {
		setSelectedUser({ ...user, app_permissions: user.app_permissions || getDefaultPermissions() });
		setNewPassword("");
		setConfirmPassword("");
		setPasswordError("");
		setPasswordSuccess("");
		setSaveSuccess("");
		setSaveError("");
		setShowEditModal(true);
	};

	const handleCloseEditModal = () => {
		setShowEditModal(false);
		setSaveSuccess("");
		setSaveError("");
	};

	const handlePermissionToggle = (appKey: keyof AppPermissions) => {
		if (!selectedUser) return;
		setSelectedUser({
			...selectedUser,
			app_permissions: { ...selectedUser.app_permissions!, [appKey]: !selectedUser.app_permissions![appKey] },
		});
	};

	const handleOralTestPageToggle = (pageKey: keyof OralTestPermissions) => {
		if (!selectedUser?.app_permissions) return;
		const cur = selectedUser.app_permissions.oral_test_pages || { dashboard:true,results:true,test:true,questions:true,users:true };
		setSelectedUser({ ...selectedUser, app_permissions: { ...selectedUser.app_permissions, oral_test_pages: { ...cur, [pageKey]: !cur[pageKey] } } });
	};

	const handleSMSEditToggle = () => {
		if (!selectedUser?.app_permissions) return;
		const cur = selectedUser.app_permissions.sms_edit || { view_only: true };
		setSelectedUser({ ...selectedUser, app_permissions: { ...selectedUser.app_permissions, sms_edit: { view_only: !cur.view_only } } });
	};

	const handleMDAfaatEditToggle = () => {
		if (!selectedUser?.app_permissions) return;
		const cur = selectedUser.app_permissions.mdafaat_edit || { view_only: true };
		setSelectedUser({ ...selectedUser, app_permissions: { ...selectedUser.app_permissions, mdafaat_edit: { view_only: !cur.view_only } } });
	};

	const handleSavePermissions = async () => {
		if (!selectedUser || !token) return;
		setSavingPermissions(true);
		setSaveError("");
		setSaveSuccess("");
		try {
			const dbPermissions = transformPermissionsForDatabase(selectedUser.app_permissions);
			const response = await fetch(`/api/admin/users/${selectedUser.id}/permissions`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ authentication_level: selectedUser.authentication_level, app_permissions: dbPermissions }),
			});
			if (response.ok) {
				const data = await response.json();
				setSaveSuccess("權限已成功更新！");
				const updatedUser = {
					...data.user,
					app_permissions: transformPermissionsFromDatabase(data.user.app_permissions),
				};
				setUsers(users.map((u) => u.id === selectedUser.id ? updatedUser : u));
				setSelectedUser(updatedUser);
				setTimeout(() => setSaveSuccess(""), 3000);
			} else {
				const err = await response.json();
				setSaveError(err.message || "權限更新失敗");
			}
		} catch {
			setSaveError("儲存時發生錯誤");
		} finally {
			setSavingPermissions(false);
		}
	};

	const handleResetPassword = async () => {
		if (!selectedUser) return;
		setPasswordError("");
		setPasswordSuccess("");
		if (!newPassword || !confirmPassword) { setPasswordError("請輸入新密碼"); return; }
		if (newPassword !== confirmPassword)  { setPasswordError("密碼不符"); return; }
		if (newPassword.length < 6)          { setPasswordError("密碼至少需要6個字元"); return; }
		setResettingPassword(true);
		try {
			const response = await fetch(`/api/users/${selectedUser.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify({ password: newPassword }),
			});
			if (response.ok) {
				setPasswordSuccess(`已成功重設 ${selectedUser.full_name} 的密碼`);
				setNewPassword("");
				setConfirmPassword("");
				setTimeout(() => setPasswordSuccess(""), 3000);
			} else {
				const err = await response.json();
				setPasswordError(err.message || "密碼重設失敗");
			}
		} catch { setPasswordError("網路錯誤，請稍後再試"); }
		finally  { setResettingPassword(false); }
	};

	// ── Delete ─────────────────────────────────────────────────────────────
	const handleDeleteClick = (user: User, e: React.MouseEvent) => {
		e.stopPropagation();
		setUserToDelete(user);
		setDeleteError("");
		setShowDeleteConfirm(true);
	};

	const handleConfirmDelete = async () => {
		if (!userToDelete || !token) return;
		setDeletingUser(true);
		setDeleteError("");
		try {
			const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (response.ok) {
				setUsers(users.filter((u) => u.id !== userToDelete.id));
				setShowDeleteConfirm(false);
				setUserToDelete(null);
			} else {
				const err = await response.json();
				setDeleteError(err.message || "刪除失敗");
			}
		} catch { setDeleteError("網路錯誤，請稍後再試"); }
		finally  { setDeletingUser(false); }
	};

	// ── Add user ───────────────────────────────────────────────────────────
	const handleOpenAddModal = () => {
		setNewUserForm(blankNewUserForm());
		setAddUserError("");
		setAddUserSuccess("");
		setShowAddModal(true);
	};

	const handleAddUserPermToggle = (appKey: keyof AppPermissions) => {
		setNewUserForm((prev) => ({
			...prev,
			app_permissions: { ...prev.app_permissions, [appKey]: !prev.app_permissions[appKey] },
		}));
	};

	const handleAddUser = async () => {
		const { employee_id, full_name, rank, base, password, gender, avatar_gif, app_permissions } = newUserForm;

		setAddUserError("");
		if (!employee_id.trim()) { setAddUserError("請填寫員工編號"); return; }
		if (!full_name.trim())   { setAddUserError("請填寫姓名"); return; }
		if (!rank)               { setAddUserError("請選擇職稱"); return; }
		if (!base)               { setAddUserError("請選擇基地"); return; }
		if (!password || password.length < 6) { setAddUserError("密碼至少 6 個字元"); return; }

		setAddingUser(true);
		try {
			const dbPermissions = transformPermissionsForDatabase(app_permissions);
			const body: any = {
				employee_id: employee_id.trim(),
				full_name: full_name.trim(),
				rank,
				base,
				password,
				authentication_level: 1,
				app_permissions: dbPermissions,
			};
			if (gender) body.gender = gender === "M" ? "male" : "female";
			if (avatar_gif) body.avatar_gif = avatar_gif;

			const response = await fetch("/api/admin/users", {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
				body: JSON.stringify(body),
			});
			if (response.ok) {
				const data = await response.json();
				const newUser: User = {
					...data.user,
					app_permissions: transformPermissionsFromDatabase(data.user.app_permissions),
				};
				setUsers((prev) =>
					[...prev, newUser].sort((a, b) =>
						a.employee_id.localeCompare(b.employee_id, "zh-TW", { numeric: true })
					)
				);
				setAddUserSuccess("使用者已成功新增！");
				setTimeout(() => { setShowAddModal(false); setAddUserSuccess(""); }, 1500);
			} else {
				const err = await response.json();
				setAddUserError(err.message || "新增失敗");
			}
		} catch { setAddUserError("網路錯誤，請稍後再試"); }
		finally  { setAddingUser(false); }
	};

	// ── Shared permission editor JSX ───────────────────────────────────────
	// Used in both edit and add modals — takes permissions + setter
	const renderPermissionsEditor = (
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
					{(["dashboard","users","questions","test","results"] as const).map((page) => (
						<label key={page} className={styles.subPermissionLabel}>
							<input type="checkbox" className={styles.subCheckbox}
								checked={perms.oral_test_pages?.[page] ?? true}
								onChange={() => oralPageToggle?.(page)}
								disabled={!perms.oral_test}
							/>
							<span>
								{page === "dashboard" ? "Dashboard (儀表板)" :
								 page === "users" ? "Users (人員管理)" :
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

	// ── Avatar GIF picker (shared between edit + add) ──────────────────────
	const renderGifPicker = (
		gender: "M" | "F" | "",
		selectedGif: string,
		onGenderChange: (g: "M" | "F") => void,
		onGifSelect: (filename: string) => void,
		onGifClear: () => void,
		onGenderClear: () => void,
	) => (
		<div className={styles.gifPickerSection}>
			{/* Gender buttons */}
			<div className={styles.genderRow}>
				<span className={styles.gifPickerLabel}>性別</span>
				<div className={styles.genderBtns}>
					<button
						type="button"
						className={`${styles.genderBtn} ${gender === "M" ? styles.genderBtnActive : ""}`}
						onClick={() => onGenderChange("M")}
					>♂ 男</button>
					<button
						type="button"
						className={`${styles.genderBtn} ${gender === "F" ? styles.genderBtnActive : ""}`}
						onClick={() => onGenderChange("F")}
					>♀ 女</button>
					{gender && (
						<button type="button" className={styles.genderClearBtn} onClick={onGenderClear}>清除</button>
					)}
				</div>
			</div>

			{/* Selected gif preview */}
			{selectedGif && (
				<div className={styles.gifPreviewRow}>
					<img
						src={`/images/authentication_level_gif/${selectedGif}`}
						alt={selectedGif}
						className={styles.gifPreviewLarge}
					/>
					<div className={styles.gifPreviewInfo}>
						<span className={styles.gifPreviewName}>
							{selectedGif.replace(/^[mf]_/, "").replace(".gif", "")}
						</span>
						<button type="button" className={styles.gifClearBtn} onClick={onGifClear}>
							移除頭像
						</button>
					</div>
				</div>
			)}

			{/* GIF grid — only when gender selected */}
			{gender && (
				<div className={styles.gifGrid}>
					{(GIF_KEYS[gender] || []).map((key) => {
						const filename = `${key}.gif`;
						const isSelected = selectedGif === filename;
						return (
							<button
								key={key}
								type="button"
								className={`${styles.gifGridItem} ${isSelected ? styles.gifGridItemSelected : ""}`}
								onClick={() => onGifSelect(filename)}
								title={key.replace(/^[mf]_/, "")}
							>
								<img
									src={`/images/authentication_level_gif/${filename}`}
									alt={key}
									className={styles.gifGridImg}
								/>
							</button>
						);
					})}
				</div>
			)}
		</div>
	);

	// ── Edit modal avatar state (separate from user record) ────────────────
	const [editGender, setEditGender] = useState<"M" | "F" | "">("");
	const [editAvatarGif, setEditAvatarGif] = useState("");

	const handleOpenEditModal = (user: User) => {
		setSelectedUser({ ...user, app_permissions: user.app_permissions || getDefaultPermissions() });
		setNewPassword("");
		setConfirmPassword("");
		setPasswordError("");
		setPasswordSuccess("");
		setSaveSuccess("");
		setSaveError("");

		// Avatar
		const g = user.gender?.toLowerCase();
		setEditGender(g === "male" || g === "m" ? "M" : g === "female" || g === "f" ? "F" : "");
		const custom = getCustomAvatarGif(user.employee_id);
		setEditAvatarGif(custom ? custom : "");

		setShowEditModal(true);
	};

	// ─────────────────────────────────────────────────────────────────────────
	return (
		<div className={styles.container}>

			{/* ── Page header ── */}
			<div className={styles.pageHeader}>
				<div className={styles.pageTitleRow}>
					<h2 className={styles.pageTitle}>使用者管理</h2>
					<span className={styles.userCount}>{filteredUsers.length} / {users.length} 位使用者</span>
				</div>
				<button className={styles.addUserButton} onClick={handleOpenAddModal}>
					<FaPlus size={13} /> 新增使用者
				</button>
			</div>

			{/* ── Search ── */}
			<div className={styles.searchSection}>
				<input
					type="text"
					placeholder="🔍 搜尋姓名或員工編號..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className={styles.searchInput}
				/>
			</div>

			{/* ── Content ── */}
			{loading ? (
				<div className={styles.loadingState}>
					<div className={styles.spinner}></div>
					<p>載入使用者列表中...</p>
				</div>
			) : error ? (
				<div className={styles.errorState}>
					<div className={styles.errorIcon}>⚠️</div>
					<p className={styles.errorText}>{error}</p>
					<button onClick={fetchUsers} className={styles.retryButton}>重試</button>
				</div>
			) : filteredUsers.length === 0 ? (
				<div className={styles.emptyState}>
					<div className={styles.emptyIcon}>🔍</div>
					<p className={styles.emptyText}>{searchQuery ? "找不到符合的使用者" : "無使用者資料"}</p>
				</div>
			) : (
				<div className={styles.userCardGrid}>
					{filteredUsers.map((user) => {
						const rankColors = getRankColors(user.rank);
						const chips = getPermissionChips(user);
						return (
							<div key={user.id} className={styles.userCard}>
								{/* GIF avatar — top right corner */}
								<img
									src={getAuthLevelGif(user.authentication_level, user)}
									alt=""
									className={styles.cardGifAvatar}
								/>

								{/* Avatar + identity */}
								<div className={styles.userCardTop}>
									<div className={styles.userAvatarContainer}>
										{imageErrors.has(user.employee_id) ? (
											<div className={styles.avatarFallback}>{user.full_name.charAt(0)}</div>
										) : (
											<Image
												src={`https://rhdpkxkmugimtlbdizfp.supabase.co/storage/v1/object/public/avatars/${user.employee_id}.png`}
												alt={user.full_name}
												width={64} height={64}
												className={styles.userAvatar}
												onError={() => setImageErrors((prev) => new Set(prev).add(user.employee_id))}
												unoptimized
											/>
										)}
									</div>
									<div className={styles.userCardIdentity}>
										<div className={styles.userName}>{user.full_name}</div>
										<div className={styles.userEmployeeId}>#{user.employee_id}</div>
									</div>
								</div>

								{/* Badges */}
								<div className={styles.userCardBadges}>
									<span
										className={styles.badgeRank}
										style={{ background: rankColors.bg, color: rankColors.color }}
									>
										{getRankShort(user.rank)}
									</span>
									<span className={styles.badgeBase}>{user.base}</span>
								</div>

								{/* Permission chips */}
								<div className={styles.permissionChips}>
									{chips.map((chip) => {
										const c = APP_CHIP_COLORS[chip] || APP_CHIP_COLORS["班表"];
										return (
											<span
												key={chip}
												className={styles.permissionChip}
												style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}
											>
												{chip}
											</span>
										);
									})}
								</div>

								{/* Action buttons */}
								<div className={styles.cardActions}>
									<button className={styles.editButton} onClick={() => handleOpenEditModal(user)}>
										✏️ 編輯
									</button>
									<button className={styles.deleteButton} onClick={(e) => handleDeleteClick(user, e)}>
										🗑️ 刪除
									</button>
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* ══════════════════════════════════════════
			    EDIT MODAL
			══════════════════════════════════════════ */}
			{showEditModal && selectedUser && (
			<ModalPortal>
				<div className={styles.modalBackdrop} onClick={handleCloseEditModal}>
					<div className={styles.editModal} onClick={(e) => e.stopPropagation()}>

						<div className={styles.editModalHeader}>
							<h3 className={styles.editModalTitle}>編輯使用者 👤</h3>
							<button onClick={handleCloseEditModal} className={styles.editModalClose}>✕</button>
						</div>

						<div className={styles.editModalBody}>

							{/* ── Avatar GIF picker ── */}
							<div className={styles.editSection}>
								<div className={styles.editSectionLabel}>角色頭像</div>
								{renderGifPicker(
									editGender,
									editAvatarGif,
									(g) => { setEditGender(g); setEditAvatarGif(""); },
									(filename) => setEditAvatarGif(filename),
									() => setEditAvatarGif(""),
									() => { setEditGender(""); setEditAvatarGif(""); },
								)}
								<p className={styles.editSectionHint}>
									⚠️ 頭像 GIF 儲存需要後端支援自訂欄位，目前僅顯示預覽
								</p>
							</div>

							{/* ── Basic info ── */}
							<div className={styles.editSection}>
								<div className={styles.editSectionLabel}>基本資料</div>

								<div className={styles.formRow}>
									<div className={styles.formGroup}>
										<label className={styles.formLabel}>員工編號</label>
										<input className={styles.formInput} value={selectedUser.employee_id} disabled />
									</div>
									<div className={styles.formGroup}>
										<label className={styles.formLabel}>基地</label>
										<select
											className={styles.formSelect}
											value={selectedUser.base}
											onChange={(e) => setSelectedUser({ ...selectedUser, base: e.target.value })}
										>
											{BASE_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
										</select>
									</div>
								</div>

								{/* Rank */}
								<div className={styles.formGroup}>
									<label className={styles.formLabel}>職稱</label>
									<select
										className={styles.formSelect}
										value={selectedUser.rank}
										onChange={(e) => setSelectedUser({ ...selectedUser, rank: e.target.value })}
									>
										{RANK_PRESETS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
									</select>
								</div>
							</div>

							{/* ── App permissions ── */}
							<div className={styles.editSection}>
								<div className={styles.editSectionLabel}>應用程式使用權限</div>
								{renderPermissionsEditor(
									selectedUser.app_permissions!,
									handlePermissionToggle,
									handleOralTestPageToggle,
									handleSMSEditToggle,
									handleMDAfaatEditToggle,
									(tab) => setSelectedUser((prev) => {
										if (!prev?.app_permissions) return prev;
										return { ...prev, app_permissions: { ...prev.app_permissions, audit_tabs: { ...(prev.app_permissions.audit_tabs ?? { routine:true,first_level:true,iosa:true }), [tab]: !(prev.app_permissions.audit_tabs?.[tab] ?? true) } } };
									}),
									(disc) => setSelectedUser((prev) => {
										if (!prev?.app_permissions) return prev;
										const all = { CAB:true,FLT:true,DSP:true,MNT:true,SEC:true,CGO:true,ORG:true,GRH:true };
										return { ...prev, app_permissions: { ...prev.app_permissions, audit_iosa_disciplines: { ...(prev.app_permissions.audit_iosa_disciplines ?? all), [disc]: !(prev.app_permissions.audit_iosa_disciplines?.[disc] ?? true) } } };
									}),
								)}
							</div>

							{/* ── Password ── */}
							<div className={styles.editSection}>
								<div className={styles.editSectionLabel}>變更密碼</div>
								<div className={styles.formRow}>
									<div className={styles.formGroup}>
										<label className={styles.formLabel}>新密碼</label>
										<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={styles.formInput} placeholder="留空則不更改密碼" />
									</div>
									<div className={styles.formGroup}>
										<label className={styles.formLabel}>確認新密碼</label>
										<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={styles.formInput} placeholder="再次輸入新密碼" />
									</div>
								</div>
								{passwordError   && <div className={styles.passwordError}>{passwordError}</div>}
								{passwordSuccess && <div className={styles.passwordSuccess}>{passwordSuccess}</div>}
								<button className={styles.resetPasswordButton} onClick={handleResetPassword} disabled={resettingPassword}>
									{resettingPassword ? "重設中..." : "🔑 確認重設密碼"}
								</button>
							</div>

						</div>

						<div className={styles.editModalFooter}>
							{saveSuccess && <div className={styles.successMessage}>{saveSuccess}</div>}
							{saveError   && <div className={styles.errorMessage}>{saveError}</div>}
							<button className={styles.cancelButton} onClick={handleCloseEditModal} disabled={savingPermissions}>取消</button>
							<button className={styles.savePermissionsButton} onClick={handleSavePermissions} disabled={savingPermissions}>
								{savingPermissions ? "儲存中..." : "✅ 確認更新"}
							</button>
						</div>
						</div>
					</div>
			</ModalPortal>
			)}

			{/* ══════════════════════════════════════════
			    ADD USER MODAL
			══════════════════════════════════════════ */}
			{showAddModal && (
			<ModalPortal>
				<div className={styles.modalBackdrop} onClick={() => setShowAddModal(false)}>
					<div className={styles.editModal} onClick={(e) => e.stopPropagation()}>

						<div className={styles.editModalHeader}>
							<h3 className={styles.editModalTitle}>新增使用者 ✨</h3>
							<button onClick={() => setShowAddModal(false)} className={styles.editModalClose}>✕</button>
						</div>

						<div className={styles.editModalBody}>

							{/* Avatar GIF picker */}
							<div className={styles.editSection}>
								<div className={styles.editSectionLabel}>角色頭像</div>
								{renderGifPicker(
									newUserForm.gender,
									newUserForm.avatar_gif,
									(g) => setNewUserForm((prev) => ({ ...prev, gender: g, avatar_gif: "" })),
									(filename) => setNewUserForm((prev) => ({ ...prev, avatar_gif: filename })),
									() => setNewUserForm((prev) => ({ ...prev, avatar_gif: "" })),
									() => setNewUserForm((prev) => ({ ...prev, gender: "", avatar_gif: "" })),
								)}
							</div>

							{/* Basic info */}
							<div className={styles.editSection}>
								<div className={styles.editSectionLabel}>基本資料</div>

								<div className={styles.formRow}>
									<div className={styles.formGroup}>
										<label className={styles.formLabel}>員工編號 *</label>
										<input
											className={styles.formInput}
											value={newUserForm.employee_id}
											onChange={(e) => setNewUserForm((prev) => ({ ...prev, employee_id: e.target.value }))}
											placeholder="請輸入員工編號"
										/>
									</div>
									<div className={styles.formGroup}>
										<label className={styles.formLabel}>姓名 *</label>
										<input
											className={styles.formInput}
											value={newUserForm.full_name}
											onChange={(e) => setNewUserForm((prev) => ({ ...prev, full_name: e.target.value }))}
											placeholder="請輸入姓名"
										/>
									</div>
								</div>

								<div className={styles.formRow}>
									<div className={styles.formGroup}>
										<label className={styles.formLabel}>職稱 *</label>
										<select
											className={styles.formSelect}
											value={newUserForm.rank}
											onChange={(e) => setNewUserForm((prev) => ({ ...prev, rank: e.target.value }))}
										>
											<option value="">請選擇職稱</option>
											{RANK_PRESETS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
										</select>
									</div>
									<div className={styles.formGroup}>
										<label className={styles.formLabel}>基地 *</label>
										<select
											className={styles.formSelect}
											value={newUserForm.base}
											onChange={(e) => setNewUserForm((prev) => ({ ...prev, base: e.target.value }))}
										>
											<option value="">請選擇基地</option>
											{BASE_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
										</select>
									</div>
								</div>

								<div className={styles.formGroup}>
									<label className={styles.formLabel}>密碼 *</label>
									<input
										type="password"
										className={styles.formInput}
										value={newUserForm.password}
										onChange={(e) => setNewUserForm((prev) => ({ ...prev, password: e.target.value }))}
										placeholder="至少 6 個字元"
									/>
								</div>
							</div>

							{/* App permissions */}
							<div className={styles.editSection}>
								<div className={styles.editSectionLabel}>應用程式使用權限</div>
								{renderPermissionsEditor(
									newUserForm.app_permissions,
									handleAddUserPermToggle,
									(page) => setNewUserForm((prev) => ({
										...prev,
										app_permissions: { ...prev.app_permissions, oral_test_pages: { ...(prev.app_permissions.oral_test_pages ?? { dashboard:true,results:true,test:true,questions:true,users:true }), [page]: !(prev.app_permissions.oral_test_pages?.[page] ?? true) } },
									})),
									() => setNewUserForm((prev) => ({
										...prev,
										app_permissions: { ...prev.app_permissions, sms_edit: { view_only: !(prev.app_permissions.sms_edit?.view_only ?? true) } },
									})),
									() => setNewUserForm((prev) => ({
										...prev,
										app_permissions: { ...prev.app_permissions, mdafaat_edit: { view_only: !(prev.app_permissions.mdafaat_edit?.view_only ?? true) } },
									})),
									(tab) => setNewUserForm((prev) => ({
										...prev,
										app_permissions: { ...prev.app_permissions, audit_tabs: { ...(prev.app_permissions.audit_tabs ?? { routine:true,first_level:true,iosa:true }), [tab]: !(prev.app_permissions.audit_tabs?.[tab] ?? true) } },
									})),
									(disc) => setNewUserForm((prev) => {
										const all = { CAB:true,FLT:true,DSP:true,MNT:true,SEC:true,CGO:true,ORG:true,GRH:true };
										return { ...prev, app_permissions: { ...prev.app_permissions, audit_iosa_disciplines: { ...(prev.app_permissions.audit_iosa_disciplines ?? all), [disc]: !(prev.app_permissions.audit_iosa_disciplines?.[disc] ?? true) } } };
									}),
								)}
							</div>

						</div>

						<div className={styles.editModalFooter}>
							{addUserSuccess && <div className={styles.successMessage}>{addUserSuccess}</div>}
							{addUserError   && <div className={styles.errorMessage}>{addUserError}</div>}
							<button className={styles.cancelButton} onClick={() => setShowAddModal(false)} disabled={addingUser}>取消</button>
							<button className={styles.savePermissionsButton} onClick={handleAddUser} disabled={addingUser}>
								{addingUser ? "新增中..." : "✅ 確認新增"}
							</button>
						</div>
						</div>
					</div>
			</ModalPortal>
			)}

			{/* ══════════════════════════════════════════
			    DELETE CONFIRM MODAL
			══════════════════════════════════════════ */}
			{showDeleteConfirm && userToDelete && (
			<ModalPortal>
				<div className={styles.modalBackdrop} onClick={() => !deletingUser && setShowDeleteConfirm(false)}>
					<div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.deleteModalIcon}>🗑️</div>
						<h3 className={styles.deleteModalTitle}>確認刪除使用者</h3>
						<p className={styles.deleteModalText}>
							即將刪除 <strong>{userToDelete.full_name}</strong>（#{userToDelete.employee_id}）。<br />
							此操作無法復原。
						</p>
						{deleteError && <div className={styles.passwordError}>{deleteError}</div>}
						<div className={styles.deleteModalActions}>
							<button className={styles.cancelButton} onClick={() => setShowDeleteConfirm(false)} disabled={deletingUser}>
								取消
							</button>
							<button className={styles.confirmDeleteButton} onClick={handleConfirmDelete} disabled={deletingUser}>
								{deletingUser ? "刪除中..." : "確認刪除"}
							</button>
						</div>
					</div>
				</div>
			</ModalPortal>
			)}

		</div>
	);
};

export default AccessControlPanel;