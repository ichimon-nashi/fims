// src/components/admin/AccessControlPanel/AccessControlPanel.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
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
import { getAllAuthLevels, getAuthLevelConfig, getAuthLevelGifPath } from "@/lib/authLevelConfig";
import { getCustomAvatarGif } from "@/lib/customAvatarMapping";
import styles from "./AccessControlPanel.module.css";

interface OralTestPermissions {
	dashboard: boolean;
	results: boolean;
	test: boolean;
	questions: boolean;
	users: boolean;
}

interface SMSPermissions {
	view_only: boolean; // Can they edit, or just view?
}

interface MDAfaatPermissions {
	view_only: boolean; // Can they edit scenarios, or just view?
}

interface AppPermissions {
	roster: boolean;
	tasks: boolean;
	sms: boolean;
	sms_edit?: SMSPermissions; // Sub-permissions for SMS
	oral_test: boolean;
	oral_test_pages?: OralTestPermissions;
	bc_training: boolean;
	mdafaat: boolean;
	mdafaat_edit?: MDAfaatPermissions; // Sub-permissions for MDAfaat
	ads: boolean;
	ccom_review: boolean;
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

const AccessControlPanel = () => {
	const { token } = useAuth();
	const [users, setUsers] = useState<User[]>([]);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

	// Password reset states
	const [showPasswordModal, setShowPasswordModal] = useState(false);
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [passwordSuccess, setPasswordSuccess] = useState("");
	const [resettingPassword, setResettingPassword] = useState(false);

	// Permission saving states
	const [savingPermissions, setSavingPermissions] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState("");
	const [saveError, setSaveError] = useState("");

	// Fetch users on component mount
	useEffect(() => {
		fetchUsers();
	}, []);

	// Transform database permissions to simple format for UI
	const transformPermissionsFromDatabase = (
		dbPermissions: any,
	): AppPermissions | undefined => {
		if (!dbPermissions) return undefined;

		// Extract oral test pages from array format to boolean object
		const oralTestPages = dbPermissions.oral_test?.pages
			? {
					dashboard:
						dbPermissions.oral_test.pages.includes("dashboard"),
					results: dbPermissions.oral_test.pages.includes("results"),
					test: dbPermissions.oral_test.pages.includes("test"),
					questions:
						dbPermissions.oral_test.pages.includes("questions"),
					users: dbPermissions.oral_test.pages.includes("users"),
				}
			: {
					dashboard: true,
					results: true,
					test: true,
					questions: true,
					users: true,
				};

		// Extract SMS edit permission
		const smsEdit = {
			view_only: dbPermissions.sms?.view_only ?? true,
		};

		// Extract MDAfaat edit permission
		const mdafaatEdit = {
			view_only: dbPermissions.mdafaat?.view_only ?? true,
		};

		return {
			roster: dbPermissions.roster?.access ?? false,
			tasks: dbPermissions.tasks?.access ?? false,
			sms: dbPermissions.sms?.access ?? false,
			sms_edit: smsEdit,
			oral_test: dbPermissions.oral_test?.access ?? false,
			oral_test_pages: oralTestPages,
			bc_training: dbPermissions.bc_training?.access ?? false,
			mdafaat: dbPermissions.mdafaat?.access ?? false,
			mdafaat_edit: mdafaatEdit,
			ads: dbPermissions.ads?.access ?? false,
			ccom_review: dbPermissions.ccom_review?.access ?? false,
		};
	};

	const fetchUsers = async () => {
		setLoading(true);
		setError("");

		try {
			const response = await fetch("/api/admin/users", {
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (response.ok) {
				const data = await response.json();

				// Transform permissions for each user
				const usersWithTransformedPermissions = data.map(
					(user: any) => ({
						...user,
						app_permissions: transformPermissionsFromDatabase(
							user.app_permissions,
						),
					}),
				);

				// Sort by employee_id by default
				const sortedUsers = usersWithTransformedPermissions.sort(
					(a: User, b: User) => {
						return a.employee_id.localeCompare(
							b.employee_id,
							"zh-TW",
							{
								numeric: true,
							},
						);
					},
				);
				setUsers(sortedUsers);
			} else {
				setError("無法載入使用者列表");
			}
		} catch (err) {
			setError("網路錯誤，請稍後再試");
			console.error("Error fetching users:", err);
		} finally {
			setLoading(false);
		}
	};

	// Filter users based on search query and exclude admin
	const filteredUsers = useMemo(() => {
		// First filter out admin account
		const withoutAdmin = users.filter(
			(user) => !["admin", ,"20580", "21531"].includes(user.employee_id),
			//add users into array to hide them
		);

		if (!searchQuery.trim()) return withoutAdmin;

		const query = searchQuery.toLowerCase().trim();
		return withoutAdmin.filter(
			(user) =>
				user.employee_id.toLowerCase().includes(query) ||
				user.full_name.toLowerCase().includes(query),
		);
	}, [users, searchQuery]);

	// Get GIF based on authentication level and gender
	const getAuthLevelGif = (level: number, user: User): string => {
		// Priority 1: Check if user has a custom avatar GIF in customAvatarMapping.ts
		const customGif = getCustomAvatarGif(user.employee_id);
		if (customGif) {
			return `/images/authentication_level_gif/${customGif}`;
		}

		// Priority 2: Use authLevelConfig with user's gender
		const gender = user.gender?.toLowerCase().trim() || "";
		const genderType = gender === "m" || gender === "male" ? "m" : "f";
		
		return getAuthLevelGifPath(level, genderType);
	};

	// Get authentication level name
	const getAuthLevelName = (level: number): string => {
		const config = getAuthLevelConfig(level);
		if (config) {
			return `${config.nameChinese} (${config.name})`;
		}
		return `等級 ${level}`;
	};

	const handleSelectUser = (user: User) => {
		// Ensure user has permissions object with defaults
		const userWithPermissions = {
			...user,
			app_permissions: user.app_permissions || getDefaultPermissions(),
		};
		setSelectedUser(userWithPermissions);
	};

	// Helper function to get default permissions (all enabled)
	const getDefaultPermissions = (): AppPermissions => {
		return {
			roster: true,
			tasks: true,
			sms: true,
			sms_edit: {
				view_only: false, // Default: can edit
			},
			oral_test: true,
			oral_test_pages: {
				dashboard: true,
				results: true,
				test: true,
				questions: true,
				users: true,
			},
			bc_training: true,
			mdafaat: true,
			mdafaat_edit: {
				view_only: false, // Default: can edit scenarios
			},
			ads: true,
			ccom_review: true,
		};
	};

	// Handle app permission toggle
	const handlePermissionToggle = (appKey: keyof AppPermissions) => {
		if (!selectedUser) return;

		setSelectedUser({
			...selectedUser,
			app_permissions: {
				...selectedUser.app_permissions!,
				[appKey]: !selectedUser.app_permissions![appKey],
			},
		});
	};

	// Handle Oral Test sub-page permission toggle
	const handleOralTestPageToggle = (pageKey: keyof OralTestPermissions) => {
		if (!selectedUser || !selectedUser.app_permissions) return;

		const currentPages = selectedUser.app_permissions.oral_test_pages || {
			dashboard: true,
			results: true,
			test: true,
			questions: true,
			users: true,
		};

		setSelectedUser({
			...selectedUser,
			app_permissions: {
				...selectedUser.app_permissions,
				oral_test_pages: {
					...currentPages,
					[pageKey]: !currentPages[pageKey],
				},
			},
		});
	};

	// Handle SMS edit permission toggle
	const handleSMSEditToggle = () => {
		if (!selectedUser || !selectedUser.app_permissions) return;

		const currentSMSEdit = selectedUser.app_permissions.sms_edit || {
			view_only: true,
		};

		setSelectedUser({
			...selectedUser,
			app_permissions: {
				...selectedUser.app_permissions,
				sms_edit: {
					view_only: !currentSMSEdit.view_only,
				},
			},
		});
	};

	// Handle MDAfaat edit permission toggle
	const handleMDAfaatEditToggle = () => {
		if (!selectedUser || !selectedUser.app_permissions) return;

		const currentMDAfaatEdit = selectedUser.app_permissions.mdafaat_edit || {
			view_only: true,
		};

		setSelectedUser({
			...selectedUser,
			app_permissions: {
				...selectedUser.app_permissions,
				mdafaat_edit: {
					view_only: !currentMDAfaatEdit.view_only,
				},
			},
		});
	};

	// Transform simple boolean permissions to database format
	const transformPermissionsForDatabase = (
		permissions: AppPermissions | undefined,
	) => {
		if (!permissions) return null;

		return {
			roster: {
				access: permissions.roster ?? false,
				own_data_only: true, // Default: can only edit own schedule
			},
			tasks: {
				access: permissions.tasks ?? false,
				can_create: false, // Default: cannot create tasks
				can_edit_assigned: true, // Default: can edit assigned tasks
			},
			sms: {
				access: permissions.sms ?? false,
				view_only: permissions.sms_edit?.view_only ?? true, // Use sub-permission, default view-only
			},
			oral_test: {
				access: permissions.oral_test ?? false,
				pages: permissions.oral_test_pages
					? Object.entries(permissions.oral_test_pages)
							.filter(([_, enabled]) => enabled)
							.map(([page, _]) => page)
					: [],
			},
			bc_training: {
				access: permissions.bc_training ?? false,
			},
			mdafaat: {
				access: permissions.mdafaat ?? false,
				view_only: permissions.mdafaat_edit?.view_only ?? true,
			},
			ads: {
				access: permissions.ads ?? false,
			},
			ccom_review: {
				access: permissions.ccom_review ?? false,
			},
		};
	};

	// Handle save permissions
	const handleSavePermissions = async () => {
		if (!selectedUser || !token) return;

		setSavingPermissions(true);
		setSaveError("");
		setSaveSuccess("");

		try {
			// Transform permissions to database format
			const dbPermissions = transformPermissionsForDatabase(
				selectedUser.app_permissions,
			);

			console.log(
				"Saving permissions for user:",
				selectedUser.employee_id,
			);
			console.log(
				"Authentication level:",
				selectedUser.authentication_level,
			);
			console.log(
				"Transformed permissions:",
				JSON.stringify(dbPermissions, null, 2),
			);

			const response = await fetch(
				`/api/admin/users/${selectedUser.id}/permissions`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						authentication_level: selectedUser.authentication_level,
						app_permissions: dbPermissions,
					}),
				},
			);

			console.log("Response status:", response.status);

			if (response.ok) {
				const data = await response.json();
				console.log("Save successful:", data);
				setSaveSuccess("權限已成功更新！");

				// Transform the saved permissions back to UI format
				const updatedUser = {
					...data.user,
					app_permissions: transformPermissionsFromDatabase(
						data.user.app_permissions,
					),
				};

				// Update the user in the users list
				setUsers(
					users.map((u) =>
						u.id === selectedUser.id ? updatedUser : u,
					),
				);

				// Update selected user with transformed permissions
				setSelectedUser(updatedUser);

				// Clear success message after 3 seconds
				setTimeout(() => {
					setSaveSuccess("");
				}, 3000);
			} else {
				const errorData = await response.json();
				console.error("Save failed:", errorData);
				setSaveError(errorData.message || "權限更新失敗");
			}
		} catch (error) {
			console.error("Error saving permissions:", error);
			setSaveError("儲存時發生錯誤");
		} finally {
			setSavingPermissions(false);
		}
	};

	const handleResetPassword = async () => {
		if (!selectedUser) return;

		setPasswordError("");
		setPasswordSuccess("");

		// Validation
		if (!newPassword || !confirmPassword) {
			setPasswordError("請輸入新密碼");
			return;
		}

		if (newPassword !== confirmPassword) {
			setPasswordError("密碼不符");
			return;
		}

		if (newPassword.length < 6) {
			setPasswordError("密碼至少需要6個字元");
			return;
		}

		setResettingPassword(true);

		try {
			const response = await fetch(`/api/users/${selectedUser.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					password: newPassword,
				}),
			});

			if (response.ok) {
				setPasswordSuccess(
					`已成功重設 ${selectedUser.full_name} 的密碼`,
				);
				setNewPassword("");
				setConfirmPassword("");
				setTimeout(() => {
					setShowPasswordModal(false);
					setPasswordSuccess("");
				}, 2000);
			} else {
				const errorData = await response.json();
				setPasswordError(errorData.message || "密碼重設失敗");
			}
		} catch (err) {
			setPasswordError("網路錯誤，請稍後再試");
			console.error("Error resetting password:", err);
		} finally {
			setResettingPassword(false);
		}
	};

	const openPasswordModal = () => {
		setShowPasswordModal(true);
		setNewPassword("");
		setConfirmPassword("");
		setPasswordError("");
		setPasswordSuccess("");
	};

	return (
		<div className={styles.container}>
			{/* Search Section */}
			<div className={styles.searchSection}>
				<div className={styles.searchHeader}>
					<h3 className={styles.searchTitle}>🔍 搜尋使用者</h3>
					<span className={styles.userCount}>
						{filteredUsers.length} / {users.length} 位使用者
					</span>
				</div>
				<input
					type="text"
					placeholder="輸入姓名或員工編號..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className={styles.searchInput}
				/>
			</div>

			{/* User List Section */}
			<div className={styles.contentSection}>
				{loading ? (
					<div className={styles.loadingState}>
						<div className={styles.spinner}></div>
						<p>載入使用者列表中...</p>
					</div>
				) : error ? (
					<div className={styles.errorState}>
						<div className={styles.errorIcon}>⚠️</div>
						<p className={styles.errorText}>{error}</p>
						<button
							onClick={fetchUsers}
							className={styles.retryButton}
						>
							重試
						</button>
					</div>
				) : (
					<div className={styles.splitLayout}>
						{/* Left: User List */}
						<div className={styles.userListColumn}>
							{filteredUsers.length === 0 ? (
								<div className={styles.emptyState}>
									<div className={styles.emptyIcon}>🔍</div>
									<p className={styles.emptyText}>
										{searchQuery
											? "找不到符合的使用者"
											: "無使用者資料"}
									</p>
								</div>
							) : (
								<div className={styles.userList}>
									{filteredUsers.map((user) => (
										<div
											key={user.id}
											className={`${styles.userCard} ${
												selectedUser?.id === user.id
													? styles.userCardSelected
													: ""
											}`}
											onClick={() =>
												handleSelectUser(user)
											}
										>
											<div
												className={
													styles.userCardHeader
												}
											>
												<div
													className={
														styles.userBasicInfo
													}
												>
													<div
														className={
															styles.userAvatarContainer
														}
													>
														{imageErrors.has(
															user.employee_id,
														) ? (
															<div
																className={
																	styles.avatarFallback
																}
															>
																{user.full_name.charAt(
																	0,
																)}
															</div>
														) : (
															<Image
																src={`https://rhdpkxkmugimtlbdizfp.supabase.co/storage/v1/object/public/avatars/${user.employee_id}.png`}
																alt={
																	user.full_name
																}
																width={72}
																height={72}
																className={
																	styles.userAvatar
																}
																onError={() => {
																	setImageErrors(
																		(
																			prev,
																		) =>
																			new Set(
																				prev,
																			).add(
																				user.employee_id,
																			),
																	);
																}}
																unoptimized
															/>
														)}
														<div
															className={
																styles.authLevelBadge
															}
														>
															<Image
																src={getAuthLevelGif(
																	user.authentication_level,
																	user,
																)}
																alt={getAuthLevelName(
																	user.authentication_level,
																)}
																width={36}
																height={36}
																className={
																	styles.authLevelGif
																}
																title={getAuthLevelName(
																	user.authentication_level,
																)}
																unoptimized
															/>
														</div>
													</div>
													<div
														className={
															styles.userNameSection
														}
													>
														<div
															className={
																styles.userName
															}
														>
															{user.full_name}
														</div>
														<div
															className={
																styles.userEmployeeId
															}
														>
															員工編號:{" "}
															{user.employee_id}
														</div>
													</div>
												</div>
												<div
													className={
														styles.selectIndicator
													}
												>
													{selectedUser?.id ===
													user.id
														? "✓"
														: "→"}
												</div>
											</div>
											<div
												className={styles.userCardBody}
											>
												<div
													className={
														styles.userDetail
													}
												>
													<span
														className={
															styles.detailLabel
														}
													>
														職稱:
													</span>
													<span
														className={
															styles.detailValue
														}
													>
														{user.rank}
													</span>
												</div>
												<div
													className={
														styles.userDetail
													}
												>
													<span
														className={
															styles.detailLabel
														}
													>
														基地:
													</span>
													<span
														className={
															styles.detailValue
														}
													>
														{user.base}
													</span>
												</div>
												<div
													className={
														styles.userDetail
													}
												>
													<span
														className={
															styles.detailLabel
														}
													>
														職業:
													</span>
													<span
														className={
															styles.detailValue
														}
													>
														{
															user.authentication_level
														}{" "}
														-{" "}
														{getAuthLevelName(
															user.authentication_level,
														)}
													</span>
												</div>
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* Right: Permissions Editor */}
						<div className={styles.permissionsColumn}>
							{selectedUser ? (
								<div className={styles.selectedUserSection}>
									<div className={styles.selectedUserHeader}>
										<h3
											className={styles.selectedUserTitle}
										>
											編輯權限: {selectedUser.full_name}
										</h3>
										<button
											onClick={openPasswordModal}
											className={
												styles.resetPasswordButton
											}
										>
											🔑 重設密碼
										</button>
									</div>

									<div className={styles.permissionsEditor}>
										{/* Authentication Level Selector */}
										<div
											className={styles.authLevelSection}
										>
											<label
												className={styles.sectionLabel}
											>
												職業 (Avatar GIF)
											</label>
											<p className={styles.sectionHint}>
												此設定僅影響顯示的 GIF 頭像
											</p>
											<div
												className={
													styles.authLevelSelector
												}
											>
												<select
													className={
														styles.authLevelDropdown
													}
													value={
														selectedUser.authentication_level
													}
													onChange={(e) => {
														setSelectedUser({
															...selectedUser,
															authentication_level:
																parseInt(
																	e.target
																		.value,
																),
														});
													}}
												>
													{getAllAuthLevels().map((authLevel) => (
														<option key={authLevel.level} value={authLevel.level}>
															{authLevel.level} - {authLevel.nameChinese} ({authLevel.name})
														</option>
													))}
												</select>
												<div
													className={
														styles.authLevelPreview
													}
												>
													<Image
														src={getAuthLevelGif(
															selectedUser.authentication_level,
															selectedUser,
														)}
														alt={getAuthLevelName(
															selectedUser.authentication_level,
														)}
														width={44}
														height={44}
														className={
															styles.authLevelPreviewGif
														}
														unoptimized
													/>
												</div>
											</div>
										</div>

										{/* App Permissions - Same as before */}
										<div
											className={
												styles.appPermissionsSection
											}
										>
											<label
												className={styles.sectionLabel}
											>
												應用程式使用權限
											</label>
											<p className={styles.sectionHint}>
												選擇使用者開放使用的應用程式
											</p>

											<div
												className={
													styles.appPermissionsList
												}
											>
												{/* Apps list - same as before */}
												<div
													className={
														styles.appPermissionCard
													}
												>
													<div
														className={
															styles.appPermissionHeader
														}
													>
														<label
															className={
																styles.appPermissionLabel
															}
														>
															<input
																type="checkbox"
																className={
																	styles.appCheckbox
																}
																checked={
																	selectedUser
																		.app_permissions
																		?.roster ??
																	true
																}
																onChange={() =>
																	handlePermissionToggle(
																		"roster",
																	)
																}
															/>
															<span
																className={
																	styles.appName
																}
															>
																<FaCalendarAlt
																	style={{
																		color: "#3b82f6",
																	}}
																/>{" "}
																教師班表 (Roster)
															</span>
														</label>
													</div>
												</div>
												<div
													className={
														styles.appPermissionCard
													}
												>
													<div
														className={
															styles.appPermissionHeader
														}
													>
														<label
															className={
																styles.appPermissionLabel
															}
														>
															<input
																type="checkbox"
																className={
																	styles.appCheckbox
																}
																checked={
																	selectedUser
																		.app_permissions
																		?.tasks ??
																	true
																}
																onChange={() =>
																	handlePermissionToggle(
																		"tasks",
																	)
																}
															/>
															<span
																className={
																	styles.appName
																}
															>
																<FaClipboardList
																	style={{
																		color: "#10b981",
																	}}
																/>{" "}
																任務管理 (Task Manger)
															</span>
														</label>
													</div>
												</div>
												<div
													className={
														styles.appPermissionCard
													}
												>
													<div
														className={
															styles.appPermissionHeader
														}
													>
														<label
															className={
																styles.appPermissionLabel
															}
														>
															<input
																type="checkbox"
																className={
																	styles.appCheckbox
																}
																checked={
																	selectedUser
																		.app_permissions
																		?.sms ??
																	true
																}
																onChange={() =>
																	handlePermissionToggle(
																		"sms",
																	)
																}
															/>
															<span
																className={
																	styles.appName
																}
															>
																<FaUserShield
																	style={{
																		color: "#ef4444",
																	}}
																/>{" "}
																SMS (Safety Management System)
															</span>
														</label>
													</div>
													<div
														className={
															styles.appSubPermissions
														}
													>
														<div
															className={
																styles.subPermissionItem
															}
														>
															<label
																className={
																	styles.subPermissionLabel
																}
															>
																<input
																	type="checkbox"
																	className={
																		styles.subCheckbox
																	}
																	checked={
																		!(
																			selectedUser
																				.app_permissions
																				?.sms_edit
																				?.view_only ??
																			true
																		)
																	}
																	onChange={
																		handleSMSEditToggle
																	}
																	disabled={
																		!selectedUser
																			.app_permissions
																			?.sms
																	}
																/>
																<span>
																	Can Edit
																	(可編輯)
																</span>
															</label>
														</div>
													</div>
												</div>
												<div
													className={
														styles.appPermissionCard
													}
												>
													<div
														className={
															styles.appPermissionHeader
														}
													>
														<label
															className={
																styles.appPermissionLabel
															}
														>
															<input
																type="checkbox"
																className={
																	styles.appCheckbox
																}
																checked={
																	selectedUser
																		.app_permissions
																		?.oral_test ??
																	true
																}
																onChange={() =>
																	handlePermissionToggle(
																		"oral_test",
																	)
																}
															/>
															<span
																className={
																	styles.appName
																}
															>
																<FaBookSkull
																	style={{
																		color: "#f59e0b",
																	}}
																/>{" "}
																翻書口試 (Oral
																Test)
															</span>
														</label>
													</div>
													<div
														className={
															styles.appSubPermissions
														}
													>
														<div
															className={
																styles.subPermissionItem
															}
														>
															<label
																className={
																	styles.subPermissionLabel
																}
															>
																<input
																	type="checkbox"
																	className={
																		styles.subCheckbox
																	}
																	checked={
																		selectedUser
																			.app_permissions
																			?.oral_test_pages
																			?.dashboard ??
																		true
																	}
																	onChange={() =>
																		handleOralTestPageToggle(
																			"dashboard",
																		)
																	}
																	disabled={
																		!selectedUser
																			.app_permissions
																			?.oral_test
																	}
																/>
																<span>
																	Dashboard
																	(儀表板)
																</span>
															</label>
														</div>
														<div
															className={
																styles.subPermissionItem
															}
														>
															<label
																className={
																	styles.subPermissionLabel
																}
															>
																<input
																	type="checkbox"
																	className={
																		styles.subCheckbox
																	}
																	checked={
																		selectedUser
																			.app_permissions
																			?.oral_test_pages
																			?.users ??
																		true
																	}
																	onChange={() =>
																		handleOralTestPageToggle(
																			"users",
																		)
																	}
																	disabled={
																		!selectedUser
																			.app_permissions
																			?.oral_test
																	}
																/>
																<span>
																	Users
																	(人員管理)
																</span>
															</label>
														</div>
														<div
															className={
																styles.subPermissionItem
															}
														>
															<label
																className={
																	styles.subPermissionLabel
																}
															>
																<input
																	type="checkbox"
																	className={
																		styles.subCheckbox
																	}
																	checked={
																		selectedUser
																			.app_permissions
																			?.oral_test_pages
																			?.questions ??
																		true
																	}
																	onChange={() =>
																		handleOralTestPageToggle(
																			"questions",
																		)
																	}
																	disabled={
																		!selectedUser
																			.app_permissions
																			?.oral_test
																	}
																/>
																<span>
																	Questions
																	(題庫管理)
																</span>
															</label>
														</div>
														<div
															className={
																styles.subPermissionItem
															}
														>
															<label
																className={
																	styles.subPermissionLabel
																}
															>
																<input
																	type="checkbox"
																	className={
																		styles.subCheckbox
																	}
																	checked={
																		selectedUser
																			.app_permissions
																			?.oral_test_pages
																			?.test ??
																		true
																	}
																	onChange={() =>
																		handleOralTestPageToggle(
																			"test",
																		)
																	}
																	disabled={
																		!selectedUser
																			.app_permissions
																			?.oral_test
																	}
																/>
																<span>
																	Test
																	(測試)
																</span>
															</label>
														</div>
														<div
															className={
																styles.subPermissionItem
															}
														>
															<label
																className={
																	styles.subPermissionLabel
																}
															>
																<input
																	type="checkbox"
																	className={
																		styles.subCheckbox
																	}
																	checked={
																		selectedUser
																			.app_permissions
																			?.oral_test_pages
																			?.results ??
																		true
																	}
																	onChange={() =>
																		handleOralTestPageToggle(
																			"results",
																		)
																	}
																	disabled={
																		!selectedUser
																			.app_permissions
																			?.oral_test
																	}
																/>
																<span>
																	Results
																	(測試結果)
																</span>
															</label>
														</div>
													</div>
												</div>
												<div
													className={
														styles.appPermissionCard
													}
												>
													<div
														className={
															styles.appPermissionHeader
														}
													>
														<label
															className={
																styles.appPermissionLabel
															}
														>
															<input
																type="checkbox"
																className={
																	styles.appCheckbox
																}
																checked={
																	selectedUser
																		.app_permissions
																		?.bc_training ??
																	true
																}
																onChange={() =>
																	handlePermissionToggle(
																		"bc_training",
																	)
																}
															/>
															<span
																className={
																	styles.appName
																}
															>
																<FaUtensils
																	style={{
																		color: "#8b5cf6",
																	}}
																/>{" "}
																B/C訓練 (商務艙服務訓練)
															</span>
														</label>
													</div>
												</div>
												<div
													className={
														styles.appPermissionCard
													}
												>
													<div
														className={
															styles.appPermissionHeader
														}
													>
														<label
															className={
																styles.appPermissionLabel
															}
														>
															<input
																type="checkbox"
																className={
																	styles.appCheckbox
																}
																checked={
																	selectedUser
																		.app_permissions
																		?.mdafaat ??
																	true
																}
																onChange={() =>
																	handlePermissionToggle(
																		"mdafaat",
																	)
																}
															/>
															<span
																className={
																	styles.appName
																}
															>
																<FaRunning
																	style={{
																		color: "#ec4899",
																	}}
																/>{" "}
																情境演練 (緊急撤離演練)
															</span>
														</label>
													</div>
													{/* MDAfaat Edit Sub-Permission */}
													<div className={styles.appSubPermissions}>
														<div className={styles.subPermissionItem}>
															<label
																className={
																	styles.subPermissionLabel
																}
															>
																<input
																	type="checkbox"
																	className={
																		styles.subCheckbox
																	}
																	checked={!(selectedUser.app_permissions?.mdafaat_edit?.view_only ?? true)}
																	onChange={handleMDAfaatEditToggle}
																	disabled={!selectedUser.app_permissions?.mdafaat}
																/>
																<span>
																	Can Edit
																	(可編輯)
																</span>
															</label>
														</div>
													</div>
												</div>
												<div
													className={
														styles.appPermissionCard
													}
												>
													<div
														className={
															styles.appPermissionHeader
														}
													>
														<label
															className={
																styles.appPermissionLabel
															}
														>
															<input
																type="checkbox"
																className={
																	styles.appCheckbox
																}
																checked={
																	selectedUser
																		.app_permissions
																		?.ads ??
																	true
																}
																onChange={() =>
																	handlePermissionToggle(
																		"ads",
																	)
																}
															/>
															<span
																className={
																	styles.appName
																}
															>
																<GiDistraction
																	style={{
																		color: "#14b8a6",
																	}}
																/>{" "}
																AdS (注意力測試器)
															</span>
														</label>
													</div>
												</div>
												<div
													className={
														styles.appPermissionCard
													}
												>
													<div
														className={
															styles.appPermissionHeader
														}
													>
														<label
															className={
																styles.appPermissionLabel
															}
														>
															<input
																type="checkbox"
																className={
																	styles.appCheckbox
																}
																checked={
																	selectedUser
																		.app_permissions
																		?.ccom_review ??
																	true
																}
																onChange={() =>
																	handlePermissionToggle(
																		"ccom_review",
																	)
																}
															/>
															<span
																className={
																	styles.appName
																}
															>
																<IoBookSharp
																	style={{
																		color: "#fb923c",
																	}}
																/>{" "}
																CCOM抽問 (目錄抽問)
															</span>
														</label>
													</div>
												</div>
											</div>
										</div>

										{/* Save Button */}
										<div
											className={styles.permissionActions}
										>
											{saveSuccess && (
												<div
													className={
														styles.successMessage
													}
												>
													{saveSuccess}
												</div>
											)}
											{saveError && (
												<div
													className={
														styles.errorMessage
													}
												>
													{saveError}
												</div>
											)}
											<button
												className={
													styles.savePermissionsButton
												}
												onClick={handleSavePermissions}
												disabled={savingPermissions}
											>
												{savingPermissions
													? "儲存中..."
													: "💾 儲存"}
											</button>
										</div>
									</div>
								</div>
							) : (
								<div className={styles.noSelectionState}>
									<div className={styles.noSelectionIcon}>
										👈
									</div>
									<h3 className={styles.noSelectionTitle}>
										選擇使用者
									</h3>
									<p className={styles.noSelectionText}>
										請從左側列表選擇一位使用者以編輯權限
									</p>
								</div>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Password Reset Modal */}
			{showPasswordModal && selectedUser && (
				<div
					className={styles.modalBackdrop}
					onClick={() => setShowPasswordModal(false)}
				>
					<div
						className={styles.passwordModal}
						onClick={(e) => e.stopPropagation()}
					>
						<div className={styles.passwordModalHeader}>
							<h3 className={styles.passwordModalTitle}>
								重設密碼: {selectedUser.full_name}
							</h3>
							<button
								onClick={() => setShowPasswordModal(false)}
								className={styles.passwordModalClose}
							>
								✕
							</button>
						</div>

						<div className={styles.passwordModalBody}>
							<div className={styles.passwordFormGroup}>
								<label className={styles.passwordLabel}>
									新密碼:
								</label>
								<input
									type="password"
									value={newPassword}
									onChange={(e) =>
										setNewPassword(e.target.value)
									}
									className={styles.passwordInput}
									placeholder="至少6個字元"
									minLength={6}
								/>
							</div>

							<div className={styles.passwordFormGroup}>
								<label className={styles.passwordLabel}>
									確認新密碼:
								</label>
								<input
									type="password"
									value={confirmPassword}
									onChange={(e) =>
										setConfirmPassword(e.target.value)
									}
									className={styles.passwordInput}
									placeholder="再次輸入新密碼"
									minLength={6}
								/>
							</div>

							{passwordError && (
								<div className={styles.passwordError}>
									{passwordError}
								</div>
							)}

							{passwordSuccess && (
								<div className={styles.passwordSuccess}>
									{passwordSuccess}
								</div>
							)}
						</div>

						<div className={styles.passwordModalActions}>
							<button
								onClick={() => setShowPasswordModal(false)}
								className={styles.passwordCancelButton}
								disabled={resettingPassword}
							>
								取消
							</button>
							<button
								onClick={handleResetPassword}
								className={styles.passwordConfirmButton}
								disabled={resettingPassword}
							>
								{resettingPassword ? "重設中..." : "確認重設"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default AccessControlPanel;