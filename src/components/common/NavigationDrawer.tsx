// src/components/common/NavigationDrawer.tsx - Fixed to prevent infinite re-renders
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AppName } from "@/lib/appPermissions.types";
import Avatar from "@/components/ui/Avatar/Avatar";
import { FaRunning, FaUtensils, FaUserShield, FaClipboardList, FaCalendarAlt } from "react-icons/fa";
import { FaBookSkull } from "react-icons/fa6";
import { IoHome, IoBookSharp } from "react-icons/io5";
import { GiDistraction } from "react-icons/gi";
import styles from "./NavigationDrawer.module.css";

// Custom GIF overrides - manually set specific users to use specific GIFs
// Format: employee_id -> gif filename (without .gif extension)
const CUSTOM_GIF_OVERRIDES: Record<string, string> = {
	'21986': 'm_engineer',        // Example: Employee 21986 uses Ramza3
	// '51892': 'm_soldier',
	// '22119': 'm_pirate',
};

// Authentication level to job class mapping
const getAuthLevelJob = (level: number): string => {
	const levelMap: Record<number, string> = {
		1: 'squire',
		2: 'knight',
		3: 'archer',
		4: 'oracle',
		5: 'blackmage',
		6: 'whitemage',
		7: 'timemage',
		8: 'summoner',
		9: 'lancer',
		10: 'samurai',
		11: 'ninja',
		20: 'darkknight',
		99: 'holyknight',
	};
	
	return levelMap[level] || 'squire'; // Default to squire if level not found
};

// Get authentication level GIF path with custom override support
const getAuthLevelGif = (employeeId: string, level: number, gender?: string): string => {
	// Check for custom override first (highest priority)
	if (CUSTOM_GIF_OVERRIDES[employeeId]) {
		return `/images/authentication_level_gif/${CUSTOM_GIF_OVERRIDES[employeeId]}.gif`;
	}
	
	// Otherwise use level-based mapping
	const job = getAuthLevelJob(level);
	const genderPrefix = gender === 'm' ? 'm' : 'f'; // Default to female if not specified
	return `/images/authentication_level_gif/${genderPrefix}_${job}.gif`;
};

interface NavigationDrawerProps {
	isOpen: boolean;
	onClose: () => void;
}

// Define interface for navigation items
interface NavigationItem {
	id: string;
	title: string;
	icon: string | JSX.Element;
	path: string;
	description: string;
	minAuthLevel?: number;
	badge?: string;
	iconColor?: string; // Add color class for icon styling
}

// FIXED: Move navigation items outside component to avoid recreating on every render
const navigationItems: NavigationItem[] = [
	{
		id: "dashboard",
		title: "儀表板",
		icon: <IoHome style={{ fontSize: '1.25rem' }} />,
		path: "/dashboard",
		description: "系統總覽與快速功能",
		iconColor: "dashboard",
	},
	{
		id: "roster",
		title: "教師班表",
		icon: <FaCalendarAlt style={{ fontSize: '1.25rem' }} />,
		path: "/roster",
		description: "空服教師排班系統",
		iconColor: "roster",
	},
	{
		id: "tasks",
		title: "任務管理",
		icon: <FaClipboardList style={{ fontSize: '1.25rem' }} />,
		path: "/tasks",
		description: "Kanban 任務看板",
		iconColor: "tasks",
	},
	{
		id: "sms",
		title: "SMS",
		icon: <FaUserShield style={{ fontSize: '1.25rem' }} />,
		path: "/sms",
		description: "Safety Management System",
		minAuthLevel: 1,
		iconColor: "sms",
	},
	{
		id: "oral-test",
		title: "翻書口試",
		icon: <FaBookSkull style={{ fontSize: '1.25rem' }} />,
		path: "/oral-test/dashboard",
		description: "複訓翻書口試管理系統",
		minAuthLevel: 1,
		iconColor: "oralTest",
	},
	{
		id: "business-training",
		title: "B/C訓練",
		icon: <FaUtensils style={{ fontSize: '1.25rem' }} />,
		path: "/bc-training",
		description: "商務艙服務訓練",
		iconColor: "bcTraining",
	},
	{
		id: "mdafaat",
		title: "情境演練",
		icon: <FaRunning style={{ fontSize: '1.25rem' }} />,
		path: "/mdafaat",
		description: "緊急撤離演練",
		iconColor: "mdafaat",
	},
	{
		id: "ads",
		title: "AdS",
		icon: <GiDistraction style={{ fontSize: '1.25rem' }} />,
		path: "/ads",
		description: "注意力測試器",
		iconColor: "ads",
	},
	{
		id: "ccom-review",
		title: "CCOM抽問",
		icon: <IoBookSharp style={{ fontSize: '1.25rem' }} />,
		path: "/ccom-review",
		description: "新生用CCOM翻書抽問",
		iconColor: "ccomReview",
	}
];

const NavigationDrawer = ({ isOpen, onClose }: NavigationDrawerProps) => {
	const router = useRouter();
	const pathname = usePathname();
	const { user, logout } = useAuth();
	const permissions = usePermissions();

	// TEMPORARY DEBUG: Log permissions immediately
	useEffect(() => {
		console.log('=== NAVIGATION DRAWER MOUNTED ===');
		console.log('User object:', user);
		console.log('User SMS permissions:', user?.app_permissions?.sms);
		console.log('Can access SMS?', permissions.hasAppAccess('sms'));
		
		// Make user available globally for MDAfaatGame instructor name
		if (user) {
			(window as any).currentUser = user;
		}
	}, [user, permissions]);

	// TEMPORARY DEBUG: Log permissions when drawer opens
	if (isOpen && user) {
		console.log('=== NAVIGATION DRAWER OPENED ===');
		console.log('User SMS permissions:', user.app_permissions?.sms);
		console.log('Can access SMS?', permissions.hasAppAccess('sms'));
		console.log('All accessible items:', navigationItems.map(item => {
			if (item.id === 'dashboard') return { id: item.id, access: true };
			
			let appKey: AppName;
			switch (item.id) {
				case 'oral-test': appKey = 'oral_test'; break;
				case 'business-training': appKey = 'bc_training'; break;
				case 'ccom-review': appKey = 'ccom_review'; break;
				default: appKey = item.id as AppName;
			}
			
			return {
				id: item.id,
				appKey,
				hasAccess: permissions.hasAppAccess(appKey)
			};
		}));
	}

	const handleNavigation = (path: string) => {
		router.push(path);
		onClose();
	};

	const handleLogout = () => {
		logout();
		router.push("/login");
		onClose();
	};

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			onClose();
		}
	};

	// FIXED: Memoize hasAccess function (kept for backward compatibility with minAuthLevel)
	const hasAccess = useCallback((item: NavigationItem) => {
		if (!user) return false;
		if (!item.minAuthLevel) return true;
		return user.authentication_level >= item.minAuthLevel;
	}, [user]);

	// NEW: Filter navigation items based on app_permissions
	const accessibleItems = useMemo(() => {
		return navigationItems.filter(item => {
			// Dashboard is always accessible
			if (item.id === 'dashboard') return true;
			
			// Map navigation item IDs to app permission keys
			// "oral-test" -> "oral_test", "business-training" -> "bc_training", etc.
			let appKey: AppName;
			
			switch (item.id) {
				case 'oral-test':
					appKey = 'oral_test';
					break;
				case 'business-training':
					appKey = 'bc_training';
					break;
				case 'ccom-review':
					appKey = 'ccom_review';
					break;
				default:
					// For simple cases like "roster", "tasks", "sms", "mdafaat", "ads"
					appKey = item.id as AppName;
			}
			
			// Use ONLY the permissions system (no fallback to minAuthLevel)
			return permissions.hasAppAccess(appKey);
		});
	}, [permissions]);

	// Memoize base info to prevent recalculation on every render
	const baseInfo = useMemo(() => {
		if (!user) {
			return { name: "Unknown", icon: "✈️", colorScheme: "default" };
		}

		if (user.employee_id === "admin") {
			return { name: "ADMIN", icon: "🔑", colorScheme: "admin" };
		}

		const base = user.base?.toUpperCase();

		switch (base) {
			case "KHH":
			case "KAOHSIUNG":
				return { name: "KHH", icon: "✈️", colorScheme: "khh" };
			case "TSA":
			case "SONGSHAN":
				return { name: "TSA", icon: "✈️", colorScheme: "tsa" };
			case "RMQ":
			case "TAICHUNG":
				return { name: "RMQ", icon: "✈️", colorScheme: "rmq" };
			default:
				return {
					name: user.base || "Unknown",
					icon: "✈️",
					colorScheme: "default",
				};
		}
	}, [user]);

	// Memoize user display info
	const userDisplayInfo = useMemo(() => {
		return {
			employeeId: user?.employee_id || "",
			fullName: user?.full_name || "",
			displayName: user?.full_name || user?.employee_id || "Unknown User",
			rank: user?.rank || "教師",
		};
	}, [user]);

	// Get authentication level GIF for user
	const authLevelGif = useMemo(() => {
		if (!user) return null;
		return getAuthLevelGif(user.employee_id, user.authentication_level, user.gender);
	}, [user]);

	// Don't render if drawer is closed
	if (!isOpen) return null;

	return (
		<>
			{/* Backdrop */}
			<div className={styles.backdrop} onClick={handleBackdropClick} />

			{/* Drawer */}
			<div className={`${styles.drawer} ${styles.drawerOpen}`}>
				{/* Header */}
				<div
					className={`${styles.drawerHeader} ${
						styles[baseInfo.colorScheme]
					}`}
				>
					<div className={styles.userProfile}>
						{user ? (
							<Avatar
								employeeId={userDisplayInfo.employeeId}
								fullName={userDisplayInfo.displayName}
								size="medium"
								className="drawerAvatar"
							/>
						) : (
							<div className={styles.userAvatar}>U</div>
						)}
						<div className={styles.userDetails}>
							<div className={styles.userName}>
								{userDisplayInfo.displayName}
							</div>
							<div className={styles.userRole}>
								{userDisplayInfo.rank}
							</div>
							<div className={styles.userBaseContainer}>
								<div className={styles.userBase}>
									{baseInfo.icon} {baseInfo.name}
								</div>
							</div>
							{user?.authentication_level !== undefined && (
								<span
									className={`${styles.authLevel} ${
										styles[baseInfo.colorScheme]
									}`}
								>
									Level: {user.authentication_level}
								</span>
							)}
						</div>
					</div>
					<button className={styles.closeButton} onClick={onClose}>
						✕
					</button>
					{/* Authentication Level GIF Avatar - Below Close Button */}
					{authLevelGif && (
						<div className={styles.authLevelGif}>
							<img 
								src={authLevelGif} 
								alt={`Level ${user?.authentication_level}`}
								className={styles.authLevelGifImage}
								onError={(e) => {
									// Fallback to female squire if image fails to load
									const target = e.target as HTMLImageElement;
									target.src = '/images/authentication_level_gif/f_squire.gif';
								}}
							/>
						</div>
					)}
				</div>

				{/* Navigation Items */}
				<div className={styles.navigationList}>
					{accessibleItems.map((item) => {
						const isActive = pathname.startsWith(item.path) || 
							(item.path !== '/dashboard' && pathname.includes(item.path.split('/')[1]));
						
						return (
							<div key={item.id} className={styles.navigationGroup}>
								<div
									className={`${styles.navigationItem} ${
										isActive ? styles.navigationItemActive : ""
									}`}
									onClick={() => handleNavigation(item.path)}
								>
									<div className={`${styles.navigationIcon} ${item.iconColor ? styles[item.iconColor] : ""}`}>
										{item.icon}
									</div>
									<div className={styles.navigationContent}>
										<div className={styles.navigationTitle}>
											{item.title}
											{item.badge && (
												<span
													className={
														styles.navigationBadge
													}
												>
													{item.badge}
												</span>
											)}
										</div>
										<div
											className={styles.navigationDescription}
										>
											{item.description}
										</div>
										{item.minAuthLevel && user && user.authentication_level < item.minAuthLevel && (
											<div className={styles.accessDenied}>
												需要權限等級 {item.minAuthLevel}+
											</div>
										)}
									</div>
									<div className={styles.navigationArrow}>
										→
									</div>
								</div>
							</div>
						);
					})}
				</div>

				{/* Footer */}
				<div className={styles.drawerFooter}>
					<button
						className={styles.logoutButton}
						onClick={handleLogout}
					>
						<span className={styles.logoutIcon}>➜</span>
						<span className={styles.logoutText}>登出</span>
					</button>
					<div className={styles.footerInfo}>
						<div className={styles.appVersion}>
							豪神教師管理系統 v2.3.7
						</div>
						<div className={styles.lastUpdate}>
							最後更新: {new Date().toLocaleDateString("zh-TW")}
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default NavigationDrawer;