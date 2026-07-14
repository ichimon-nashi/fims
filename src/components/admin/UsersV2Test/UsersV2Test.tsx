"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import * as XLSX from "xlsx";
import styles from "./UsersV2Test.module.css";
import { useAuth } from "@/context/AuthContext";
import { USER_FILTER_CATEGORIES } from "@/lib/constants";

// Full avatar GIF catalog — matches actual files in public/images/authentication_level_gif/.
// Not symmetric between genders (some job names only exist for one gender), so each gender
// has its own list rather than a shared job-name set.
const FEMALE_AVATAR_JOBS = [
	"archer","blackmage","calculator","chemist","dancer","darkknight","dragon","dragoner",
	"geomancer","hellknight","holyknight","knight","lancer","mediator","mimic","monk","ninja",
	"onionknight","oracle","samurai","squire","summoner","templeknight","thief","timemage","whitemage",
];
const MALE_AVATAR_JOBS = [
	"archer","bard","blackmage","calculator","chemist","darkknight","engineer","geomancer",
	"hellknight","holyknight","hunter","knight","lancer","mediator","mimic","monk","monster","ninja",
	"onionknight","oracle","pirate","ramza1","ramza2","ramza3","robot","samurai","soldier","squire",
	"summoner","templeknight","thief","timemage","whitemage",
];
import {
	AppPermissions,
	OralTestPermissions,
	getDefaultPermissions,
	transformPermissionsFromDatabase,
	transformPermissionsForDatabase,
	renderPermissionsEditor,
} from "./permissionsEditor";

interface UserRow {
	id: string;
	employee_id: string;
	full_name: string;
	rank: string;
	base: string;
	is_inactive?: boolean;
	handicap_level?: number;
	filter?: string[];
	app_permissions?: AppPermissions;
	gender?: "m" | "f";
	avatar_gif?: string;
}

const HANDICAP_LEVELS = [
	{ value: 1, label: "1 - Hardest Questions Only" },
	{ value: 2, label: "2 - Hard Questions" },
	{ value: 3, label: "3 - Mixed Questions (Default)" },
	{ value: 4, label: "4 - Easy Questions" },
	{ value: 5, label: "5 - Easiest Questions Only" },
];

// Full rank list — this component covers all crew, not just FI/SC/MG/special
// (matches UserManagement.tsx's commonRanks, not AccessControlPanel's narrower RANK_PRESETS)
const RANK_OPTIONS = [
	"FA - Flight Attendant",
	"FS - Flight Stewardess",
	"LF - Leading Flight Attendant",
	"PR - Purser",
	"FI - Flight Attendant Instructor",
	"SC - Section Chief",
	"MG - Manager",
];

const BASE_OPTIONS = ["TSA", "KHH", "RMQ"];

// Matches RoulettePage.tsx exactly, for visual consistency across the app
const BASE_COLORS: Record<string, string> = {
	TSA: "#ee5a52", KHH: "#3498db", RMQ: "#44a08d", TPE: "#a83bf6",
};

// Rank display order — MG > SC > FI > PR > LF > FA/FS, unknown ranks sort last.
// Ranks are stored like "SC - Section Chief"; we match on the code before " - ".
const RANK_ORDER = ["MG", "SC", "FI", "PR", "LF", "FA", "FS"];

const getRankCode = (rank: string): string => {
	if (!rank) return "";
	return rank.split(" - ")[0].trim().toUpperCase();
};

// FA (Flight Attendant) and FS (Flight Stewardess) are merged into one displayed group.
const getRankGroupKey = (rank: string): string => {
	const code = getRankCode(rank);
	if (code === "FA" || code === "FS") return "FA/FS";
	return rank || "未分類";
};

const rankPriority = (rank: string): number => {
	if (rank === "FA/FS") return RANK_ORDER.indexOf("FA");
	const idx = RANK_ORDER.indexOf(getRankCode(rank));
	return idx === -1 ? RANK_ORDER.length : idx;
};

const UsersV2Test = () => {
	const { token, user: currentUser, loading: authLoading } = useAuth();
	const [users, setUsers] = useState<UserRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [savingId, setSavingId] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [editingUser, setEditingUser] = useState<UserRow | null>(null);
	const [editSaving, setEditSaving] = useState(false);
	const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
	const [editingGeneral, setEditingGeneral] = useState<UserRow | null>(null);
	const [generalSaving, setGeneralSaving] = useState(false);
	const [newPassword, setNewPassword] = useState("");
	const [passwordSaving, setPasswordSaving] = useState(false);
	const [passwordMessage, setPasswordMessage] = useState("");
	const [editingPermissions, setEditingPermissions] = useState<UserRow | null>(null);
	const [permSaving, setPermSaving] = useState(false);
	const [addingUser, setAddingUser] = useState(false);
	const [addSaving, setAddSaving] = useState(false);
	const [addError, setAddError] = useState("");
	const [newUserForm, setNewUserForm] = useState({
		employee_id: "",
		full_name: "",
		rank: RANK_OPTIONS[0],
		base: BASE_OPTIONS[0],
		password: "",
		gender: "" as "" | "M" | "F",
	});

	const fetchUsers = useCallback(async () => {
		try {
			setLoading(true);
			setError("");
			const response = await fetch("/api/users", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (!response.ok) {
				const err = await response.json();
				setError(err.message || "Failed to load users");
				return;
			}
			const data = await response.json();
			const usersArray: UserRow[] = data.users || data;
			setUsers(usersArray);
		} catch {
			setError("Failed to load users");
		} finally {
			setLoading(false);
		}
	}, [token]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	const toggleInactive = async (user: UserRow) => {
		setSavingId(user.id);
		setError("");
		try {
			const response = await fetch(`/api/users/${user.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ is_inactive: !user.is_inactive }),
			});
			if (!response.ok) {
				const err = await response.json();
				setError(err.message || "Failed to update user");
				return;
			}
			const updated = await response.json();
			setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_inactive: updated.is_inactive } : u)));
		} catch {
			setError("Failed to update user");
		} finally {
			setSavingId(null);
		}
	};

	const saveOralTestSettings = async () => {
		if (!editingUser) return;
		setEditSaving(true);
		setError("");
		try {
			const response = await fetch(`/api/users/${editingUser.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					handicap_level: editingUser.handicap_level,
					filter: editingUser.filter,
				}),
			});
			if (!response.ok) {
				const err = await response.json();
				setError(err.message || "Failed to update user");
				return;
			}
			const updated = await response.json();
			setUsers((prev) =>
				prev.map((u) => (u.id === editingUser.id ? { ...u, handicap_level: updated.handicap_level, filter: updated.filter } : u)),
			);
			setEditingUser(null);
		} catch {
			setError("Failed to update user");
		} finally {
			setEditSaving(false);
		}
	};

	const toggleFilterCategory = (category: string) => {
		if (!editingUser) return;
		const current = editingUser.filter || [];
		const next = current.includes(category) ? current.filter((c) => c !== category) : [...current, category];
		setEditingUser({ ...editingUser, filter: next });
	};

	const openGeneralEdit = (user: UserRow) => {
		setEditingGeneral(user);
		setNewPassword("");
		setPasswordMessage("");
	};

	const saveGeneralInfo = async () => {
		if (!editingGeneral) return;
		setGeneralSaving(true);
		setError("");
		try {
			const response = await fetch(`/api/users/${editingGeneral.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					full_name: editingGeneral.full_name,
					rank: editingGeneral.rank,
					base: editingGeneral.base,
					gender: editingGeneral.gender,
					avatar_gif: editingGeneral.avatar_gif,
				}),
			});
			if (!response.ok) {
				const err = await response.json();
				setError(err.message || "Failed to update user");
				return;
			}
			const updated = await response.json();
			setUsers((prev) =>
				prev.map((u) =>
					u.id === editingGeneral.id
						? { ...u, full_name: updated.full_name, rank: updated.rank, base: updated.base, gender: updated.gender, avatar_gif: updated.avatar_gif }
						: u,
				),
			);
			setEditingGeneral(null);
		} catch {
			setError("Failed to update user");
		} finally {
			setGeneralSaving(false);
		}
	};

	const resetPassword = async () => {
		if (!editingGeneral || !newPassword.trim()) return;
		setPasswordSaving(true);
		setPasswordMessage("");
		try {
			const response = await fetch(`/api/users/${editingGeneral.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ password: newPassword }),
			});
			if (!response.ok) {
				const err = await response.json();
				setPasswordMessage(err.message || "密碼重設失敗");
				return;
			}
			setPasswordMessage("密碼已重設");
			setNewPassword("");
		} catch {
			setPasswordMessage("密碼重設失敗");
		} finally {
			setPasswordSaving(false);
		}
	};

	const openPermissionsEdit = (user: UserRow) => {
		setEditingPermissions({
			...user,
			app_permissions: user.app_permissions ? transformPermissionsFromDatabase(user.app_permissions) : getDefaultPermissions(),
		});
	};

	const togglePermission = (key: keyof AppPermissions) => {
		if (!editingPermissions?.app_permissions) return;
		setEditingPermissions({
			...editingPermissions,
			app_permissions: { ...editingPermissions.app_permissions, [key]: !editingPermissions.app_permissions[key] },
		});
	};

	const toggleOralPage = (page: keyof OralTestPermissions) => {
		if (!editingPermissions?.app_permissions) return;
		const cur = editingPermissions.app_permissions.oral_test_pages || { dashboard: true, results: true, test: true, questions: true, users: true };
		setEditingPermissions({
			...editingPermissions,
			app_permissions: { ...editingPermissions.app_permissions, oral_test_pages: { ...cur, [page]: !cur[page] } },
		});
	};

	const toggleSmsEdit = () => {
		if (!editingPermissions?.app_permissions) return;
		const cur = editingPermissions.app_permissions.sms_edit || { view_only: true };
		setEditingPermissions({
			...editingPermissions,
			app_permissions: { ...editingPermissions.app_permissions, sms_edit: { view_only: !cur.view_only } },
		});
	};

	const toggleMdafaatEdit = () => {
		if (!editingPermissions?.app_permissions) return;
		const cur = editingPermissions.app_permissions.mdafaat_edit || { view_only: true };
		setEditingPermissions({
			...editingPermissions,
			app_permissions: { ...editingPermissions.app_permissions, mdafaat_edit: { view_only: !cur.view_only } },
		});
	};

	const toggleAuditTab = (tab: "routine" | "first_level" | "iosa") => {
		if (!editingPermissions?.app_permissions) return;
		const all = { routine: true, first_level: true, iosa: true };
		const cur = editingPermissions.app_permissions.audit_tabs ?? all;
		setEditingPermissions({
			...editingPermissions,
			app_permissions: { ...editingPermissions.app_permissions, audit_tabs: { ...cur, [tab]: !cur[tab] } },
		});
	};

	const toggleAuditDiscipline = (disc: "CAB" | "FLT" | "DSP" | "MNT" | "SEC" | "CGO" | "ORG" | "GRH") => {
		if (!editingPermissions?.app_permissions) return;
		const all = { CAB: true, FLT: true, DSP: true, MNT: true, SEC: true, CGO: true, ORG: true, GRH: true };
		const cur = editingPermissions.app_permissions.audit_iosa_disciplines ?? all;
		setEditingPermissions({
			...editingPermissions,
			app_permissions: { ...editingPermissions.app_permissions, audit_iosa_disciplines: { ...cur, [disc]: !cur[disc] } },
		});
	};

	const savePermissions = async () => {
		if (!editingPermissions) return;
		setPermSaving(true);
		setError("");
		try {
			const dbPermissions = transformPermissionsForDatabase(editingPermissions.app_permissions);
			const response = await fetch(`/api/users/${editingPermissions.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ app_permissions: dbPermissions }),
			});
			if (!response.ok) {
				const err = await response.json();
				setError(err.message || "Failed to update permissions");
				return;
			}
			const updated = await response.json();
			setUsers((prev) => prev.map((u) => (u.id === editingPermissions.id ? { ...u, app_permissions: updated.app_permissions } : u)));
			setEditingPermissions(null);
		} catch {
			setError("Failed to update permissions");
		} finally {
			setPermSaving(false);
		}
	};

	const openAddUser = () => {
		setNewUserForm({
			employee_id: "",
			full_name: "",
			rank: RANK_OPTIONS[0],
			base: BASE_OPTIONS[0],
			password: "",
			gender: "",
		});
		setAddError("");
		setAddingUser(true);
	};

	const addUser = async () => {
		const { employee_id, full_name, rank, base, password, gender } = newUserForm;
		if (!employee_id.trim()) { setAddError("請輸入員工編號"); return; }
		if (!full_name.trim()) { setAddError("請輸入姓名"); return; }
		if (!password || password.length < 6) { setAddError("密碼至少 6 個字元"); return; }

		setAddSaving(true);
		setAddError("");
		try {
			const response = await fetch("/api/users", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					employee_id: employee_id.trim(),
					email: `${employee_id.trim()}@fims.internal`,
					full_name: full_name.trim(),
					rank,
					base,
					password,
					handicap_level: 3,
					...(gender ? { gender } : {}),
				}),
			});
			if (!response.ok) {
				const err = await response.json();
				setAddError(err.message || "新增使用者失敗");
				return;
			}
			const created = await response.json();
			setUsers((prev) => [...prev, created]);
			setAddingUser(false);
		} catch {
			setAddError("新增使用者失敗");
		} finally {
			setAddSaving(false);
		}
	};

	const handleExportExcel = () => {
		try {
			const exportData = users.map((u) => ({
				"員工編號": u.employee_id,
				"姓名": u.full_name,
				"職稱": u.rank,
				"基地": u.base,
				"口試排除類別": Array.isArray(u.filter) ? u.filter.join(", ") : "",
			}));

			const ws = XLSX.utils.json_to_sheet(exportData);
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "Users");

			const maxWidth = 50;
			const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
				wch: Math.min(Math.max(key.length, 10), maxWidth),
			}));
			ws["!cols"] = colWidths;

			const today = new Date().toISOString().split("T")[0];
			XLSX.writeFile(wb, `users_export_${today}.xlsx`);
		} catch {
			setError("匯出失敗");
		}
	};

	const searching = searchTerm.trim().length > 0;

	const filteredFlat = useMemo(() => {
		if (!searching) return [];
		const q = searchTerm.trim().toLowerCase();
		return users
			.filter((u) => u.employee_id?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q))
			.sort((a, b) => (parseInt(a.employee_id) || 0) - (parseInt(b.employee_id) || 0));
	}, [users, searchTerm, searching]);

	// base -> rank -> sorted users, only computed when not searching
	const grouped = useMemo(() => {
		if (searching) return null;
		const byBase: Record<string, Record<string, UserRow[]>> = {};
		for (const u of users) {
			const base = u.base || "未分類";
			const rankKey = getRankGroupKey(u.rank);
			if (!byBase[base]) byBase[base] = {};
			if (!byBase[base][rankKey]) byBase[base][rankKey] = [];
			byBase[base][rankKey].push(u);
		}
		for (const base of Object.keys(byBase)) {
			for (const rank of Object.keys(byBase[base])) {
				byBase[base][rank].sort((a, b) => (parseInt(a.employee_id) || 0) - (parseInt(b.employee_id) || 0));
			}
		}
		return byBase;
	}, [users, searching]);

	const renderCard = (u: UserRow) => (
		<div key={u.id} className={`${styles.userCard} ${u.is_inactive ? styles.userCardInactive : ""}`}>
			{u.avatar_gif && (
				<img
					src={`/images/authentication_level_gif/${u.avatar_gif}.gif`}
					alt=""
					className={styles.cardGifBadge}
				/>
			)}
			<div className={styles.userCardTop}>
				<div className={styles.userAvatarContainer}>
					{imageErrors.has(u.employee_id) ? (
						<div className={styles.avatarFallback}>{u.full_name?.charAt(0) || "?"}</div>
					) : (
						<Image
							src={`https://rhdpkxkmugimtlbdizfp.supabase.co/storage/v1/object/public/avatars/${u.employee_id}.png`}
							alt={u.full_name}
							width={56}
							height={56}
							className={styles.userAvatar}
							onError={() => setImageErrors((prev) => new Set(prev).add(u.employee_id))}
							unoptimized
						/>
					)}
				</div>
				<div className={styles.userCardIdentity}>
					<div className={styles.userName}>{u.full_name}</div>
					<div className={styles.userEmployeeId}>#{u.employee_id}</div>
				</div>
			</div>
			<div className={styles.userCardBadges}>
				<span
					className={styles.badgeBase}
					style={{
						background: `${BASE_COLORS[u.base?.toUpperCase() || ""] || "#4a9eff"}22`,
						border: `1px solid ${BASE_COLORS[u.base?.toUpperCase() || ""] || "#4a9eff"}55`,
						color: BASE_COLORS[u.base?.toUpperCase() || ""] || "#4a9eff",
					}}
				>
					{u.base}
				</span>
				{u.is_inactive && <span className={styles.badgeInactive}>停用</span>}
			</div>
			<div className={styles.cardActions}>
				<button type="button"
					className={`${styles.toggleButton} ${u.is_inactive ? styles.toggleButtonActive : styles.toggleButtonWarning}`}
					onClick={() => toggleInactive(u)}
					disabled={savingId === u.id}
				>
					{savingId === u.id ? "..." : u.is_inactive ? "在職" : "停用"}
				</button>
				<button type="button" className={styles.generalEditButton} onClick={() => openGeneralEdit(u)}>
					編輯
				</button>
				{(currentUser?.employee_id === "admin" || currentUser?.employee_id === "51892") && (
					<button type="button" className={styles.editButton} onClick={() => setEditingUser(u)}>
						口試
					</button>
				)}
				{(currentUser?.employee_id === "admin" || currentUser?.employee_id === "51892") && (
					<button type="button" className={styles.editButton} onClick={() => openPermissionsEdit(u)}>
						權限
					</button>
				)}
			</div>
		</div>
	);

	if (authLoading) return <div className={styles.page}>Loading...</div>;

	if (!(currentUser?.employee_id === "admin" || currentUser?.employee_id === "51892")) {
		return (
			<div className={styles.page}>
				<div className={styles.errorBanner}>存取被拒 — 僅限管理員使用此頁面</div>
			</div>
		);
	}

	if (loading) return <div className={styles.page}>Loading...</div>;

	return (
		<div className={styles.page}>
			<div className={styles.pageTitle}>使用者管理 ({users.length})</div>

			{error && <div className={styles.errorBanner}>{error}</div>}

			<div className={styles.searchSection}>
				<div className={styles.searchRow}>
					<input
						className={styles.searchInput}
						placeholder="搜尋員工編號或姓名..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
					{(currentUser?.employee_id === "admin" || currentUser?.employee_id === "51892") && (
						<button type="button" className={styles.addUserButton} onClick={openAddUser}>
							+ 新增使用者
						</button>
					)}
					{(currentUser?.employee_id === "admin" || currentUser?.employee_id === "51892") && (
						<button type="button" className={styles.exportButton} onClick={handleExportExcel}>
							匯出 Excel
						</button>
					)}
				</div>
			</div>

			{searching ? (
				<div className={styles.userCardGrid}>{filteredFlat.map(renderCard)}</div>
			) : (
				grouped &&
				Object.keys(grouped)
					.sort()
					.map((base) => (
						<div key={base}>
							<div className={styles.baseGroupHeader}>{base}</div>
							{Object.keys(grouped[base])
								.sort((a, b) => rankPriority(a) - rankPriority(b) || a.localeCompare(b))
								.map((rank) => (
									<div key={rank}>
										<div className={styles.rankGroupHeader}>{rank}</div>
										<div className={styles.userCardGrid}>
											{grouped[base][rank].map(renderCard)}
										</div>
									</div>
								))}
						</div>
					))
			)}

			{addingUser && (
				<div className={styles.modalBackdrop}>
					<div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.editModalHeader}>
							<h3 className={styles.editModalTitle}>新增使用者</h3>
							<button
								type="button"
								className={styles.editModalClose}
								onClick={() => !addSaving && setAddingUser(false)}
							>
								✕
							</button>
						</div>
						<div className={styles.editModalBody}>
							<div className={styles.formGroup}>
								<label className={styles.formLabel}>員工編號</label>
								<input
									className={styles.formInput}
									value={newUserForm.employee_id}
									onChange={(e) => setNewUserForm({ ...newUserForm, employee_id: e.target.value })}
								/>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>姓名</label>
								<input
									className={styles.formInput}
									value={newUserForm.full_name}
									onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
								/>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>職稱</label>
								<select
									className={styles.formSelect}
									value={newUserForm.rank}
									onChange={(e) => setNewUserForm({ ...newUserForm, rank: e.target.value })}
								>
									{RANK_OPTIONS.map((r) => (
										<option key={r} value={r}>
											{r}
										</option>
									))}
								</select>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>基地</label>
								<select
									className={styles.formSelect}
									value={newUserForm.base}
									onChange={(e) => setNewUserForm({ ...newUserForm, base: e.target.value })}
								>
									{BASE_OPTIONS.map((b) => (
										<option key={b} value={b}>
											{b}
										</option>
									))}
								</select>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>性別 (選填)</label>
								<select
									className={styles.formSelect}
									value={newUserForm.gender}
									onChange={(e) => setNewUserForm({ ...newUserForm, gender: e.target.value as "" | "M" | "F" })}
								>
									<option value="">未指定</option>
									<option value="M">男</option>
									<option value="F">女</option>
								</select>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>初始密碼</label>
								<input
									type="text"
									className={styles.formInput}
									placeholder="至少 6 個字元"
									value={newUserForm.password}
									onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
								/>
							</div>

							{addError && <div className={styles.errorTextSmall}>{addError}</div>}
						</div>
						<div className={styles.editModalFooter}>
							<button
								type="button"
								className={styles.cancelButton}
								disabled={addSaving}
								onClick={() => setAddingUser(false)}
							>
								取消
							</button>
							<button type="button" className={styles.saveButton} disabled={addSaving} onClick={addUser}>
								{addSaving ? "新增中..." : "新增"}
							</button>
						</div>
					</div>
				</div>
			)}

			{editingPermissions?.app_permissions && (
				<div className={styles.modalBackdrop}>
					<div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.editModalHeader}>
							<h3 className={styles.editModalTitle}>
								應用程式權限 — {editingPermissions.full_name} (#{editingPermissions.employee_id})
							</h3>
							<button
								type="button"
								className={styles.editModalClose}
								onClick={() => !permSaving && setEditingPermissions(null)}
							>
								✕
							</button>
						</div>
						<div className={styles.editModalBody}>
							<div className={styles.editSection}>
								{renderPermissionsEditor(
									editingPermissions.app_permissions,
									togglePermission,
									toggleOralPage,
									toggleSmsEdit,
									toggleMdafaatEdit,
									toggleAuditTab,
									toggleAuditDiscipline,
								)}
							</div>
						</div>
						<div className={styles.editModalFooter}>
							<button
								type="button"
								className={styles.cancelButton}
								disabled={permSaving}
								onClick={() => setEditingPermissions(null)}
							>
								取消
							</button>
							<button type="button" className={styles.saveButton} disabled={permSaving} onClick={savePermissions}>
								{permSaving ? "儲存中..." : "儲存"}
							</button>
						</div>
					</div>
				</div>
			)}

			{editingGeneral && (
				<div className={styles.modalBackdrop}>
					<div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.editModalHeader}>
							<h3 className={styles.editModalTitle}>
								編輯 — {editingGeneral.full_name} (#{editingGeneral.employee_id})
							</h3>
							<button type="button"
								className={styles.editModalClose}
								onClick={() => !generalSaving && !passwordSaving && setEditingGeneral(null)}
							>
								✕
							</button>
						</div>
						<div className={styles.editModalBody}>
							<div className={styles.formGroup}>
								<label className={styles.formLabel}>員工編號</label>
								<div className={styles.readOnlyValue}>{editingGeneral.employee_id}</div>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>姓名</label>
								<input
									className={styles.formInput}
									value={editingGeneral.full_name}
									onChange={(e) => setEditingGeneral({ ...editingGeneral, full_name: e.target.value })}
								/>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>職稱</label>
								<select
									className={styles.formSelect}
									value={editingGeneral.rank}
									onChange={(e) => setEditingGeneral({ ...editingGeneral, rank: e.target.value })}
								>
									{RANK_OPTIONS.map((r) => (
										<option key={r} value={r}>
											{r}
										</option>
									))}
								</select>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>基地</label>
								<select
									className={styles.formSelect}
									value={editingGeneral.base}
									onChange={(e) => setEditingGeneral({ ...editingGeneral, base: e.target.value })}
								>
									{BASE_OPTIONS.map((b) => (
										<option key={b} value={b}>
											{b}
										</option>
									))}
								</select>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>性別</label>
								<div className={styles.genderToggleRow}>
									<button
										type="button"
										className={`${styles.genderButton} ${editingGeneral.gender === "f" ? styles.genderButtonActive : ""}`}
										onClick={() => setEditingGeneral({ ...editingGeneral, gender: "f" })}
									>
										女
									</button>
									<button
										type="button"
										className={`${styles.genderButton} ${editingGeneral.gender === "m" ? styles.genderButtonActive : ""}`}
										onClick={() => setEditingGeneral({ ...editingGeneral, gender: "m" })}
									>
										男
									</button>
								</div>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>頭像</label>
								<div className={styles.avatarGifGrid}>
									{(editingGeneral.gender === "m" ? MALE_AVATAR_JOBS : FEMALE_AVATAR_JOBS).map((job) => {
										const genderPrefix = editingGeneral.gender === "m" ? "m" : "f";
										const gifName = `${genderPrefix}_${job}`;
										const isSelected = editingGeneral.avatar_gif === gifName;
										return (
											<button
												type="button"
												key={gifName}
												className={`${styles.avatarGifOption} ${isSelected ? styles.avatarGifOptionSelected : ""}`}
												onClick={() => setEditingGeneral({ ...editingGeneral, avatar_gif: gifName })}
												title={job}
											>
												<img
													src={`/images/authentication_level_gif/${gifName}.gif`}
													alt={job}
													className={styles.avatarGifImg}
												/>
											</button>
										);
									})}
								</div>
							</div>

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>重設密碼</label>
								<div className={styles.passwordRow}>
									<input
										type="text"
										className={styles.formInput}
										placeholder="輸入新密碼"
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
									/>
									<button type="button"
										className={styles.smallActionButton}
										disabled={passwordSaving || !newPassword.trim()}
										onClick={resetPassword}
									>
										{passwordSaving ? "..." : "重設"}
									</button>
								</div>
								{passwordMessage && (
									<div className={passwordMessage === "密碼已重設" ? styles.successText : styles.errorTextSmall}>
										{passwordMessage}
									</div>
								)}
							</div>
						</div>
						<div className={styles.editModalFooter}>
							<button type="button"
								className={styles.cancelButton}
								disabled={generalSaving}
								onClick={() => setEditingGeneral(null)}
							>
								取消
							</button>
							<button type="button" className={styles.saveButton} disabled={generalSaving} onClick={saveGeneralInfo}>
								{generalSaving ? "儲存中..." : "儲存"}
							</button>
						</div>
					</div>
				</div>
			)}

			{editingUser && (
				<div className={styles.modalBackdrop}>
					<div className={styles.editModal} onClick={(e) => e.stopPropagation()}>
						<div className={styles.editModalHeader}>
							<h3 className={styles.editModalTitle}>
								口試設定 — {editingUser.full_name} (#{editingUser.employee_id})
							</h3>
							<button type="button" className={styles.editModalClose} onClick={() => !editSaving && setEditingUser(null)}>
								✕
							</button>
						</div>
						<div className={styles.editModalBody}>
							{currentUser?.employee_id === "admin" && (
								<div className={styles.formGroup}>
									<label className={styles.formLabel}>Handicap Level</label>
									<select
										className={styles.formSelect}
										value={editingUser.handicap_level ?? 3}
										onChange={(e) => setEditingUser({ ...editingUser, handicap_level: parseInt(e.target.value) })}
									>
										{HANDICAP_LEVELS.map((lvl) => (
											<option key={lvl.value} value={lvl.value}>
												{lvl.label}
											</option>
										))}
									</select>
									<div className={styles.formHint}>Controls difficulty of test questions for this user</div>
								</div>
							)}

							<div className={styles.formGroup}>
								<label className={styles.formLabel}>🚫 Excluded Test Categories (Optional)</label>
								<div className={styles.filterCategories}>
									{USER_FILTER_CATEGORIES.map((category: string) => (
										<label key={category} className={styles.filterCheckbox}>
											<input
												type="checkbox"
												checked={(editingUser.filter || []).includes(category)}
												onChange={() => toggleFilterCategory(category)}
											/>
											<span>{category}</span>
										</label>
									))}
								</div>
								<div className={styles.formHint}>
									Selected categories will be excluded from this user&apos;s oral tests.
								</div>
							</div>
						</div>
						<div className={styles.editModalFooter}>
							<button type="button" className={styles.cancelButton} disabled={editSaving} onClick={() => setEditingUser(null)}>
								取消
							</button>
							<button type="button" className={styles.saveButton} disabled={editSaving} onClick={saveOralTestSettings}>
								{editSaving ? "儲存中..." : "儲存"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default UsersV2Test;