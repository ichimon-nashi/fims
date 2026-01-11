// src/components/common/NavigationDrawer.tsx - Fixed to prevent infinite re-renders
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/ui/Avatar/Avatar";
import { FaRunning } from "react-icons/fa";
import styles from "./NavigationDrawer.module.css";

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
}

// FIXED: Move navigation items outside component to avoid recreating on every render
const navigationItems: NavigationItem[] = [
	{
		id: "dashboard",
		title: "儀表板",
		icon: "🏠",
		path: "/dashboard",
		description: "系統總覽與快速功能",
	},
	{
		id: "roster",
		title: "教師班表",
		icon: "📅",
		path: "/roster",
		description: "空服教師排班系統",
	},
	{
		id: "tasks",
		title: "任務管理",
		icon: "📋",
		path: "/tasks",
		description: "Kanban 任務看板",
	},
	{
		id: "sms",
		title: "SMS",
		icon: "🛡️",
		path: "/sms",
		description: "Safety Management System",
		minAuthLevel: 1,
	},
	{
		id: "oral-test",
		title: "翻書口試",
		icon: "🎯",
		path: "/oral-test/dashboard",
		description: "複訓翻書口試管理系統",
		minAuthLevel: 1,
	},
	{
		id: "business-training",
		title: "B/C訓練",
		icon: "🍴",
		path: "/bc-training",
		description: "商務艙服務訓練",
	},
	{
		id: "mdafaat",
		title: "情境演練",
		icon: <FaRunning style={{ fontSize: '1.25rem' }} />,
		path: "/mdafaat",
		description: "緊急撤離演練",
	},
];

const NavigationDrawer = ({ isOpen, onClose }: NavigationDrawerProps) => {
	const router = useRouter();
	const pathname = usePathname();
	const { user, logout } = useAuth();

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

	// FIXED: Memoize hasAccess function
	const hasAccess = useCallback((item: NavigationItem) => {
		if (!user) return false;
		if (!item.minAuthLevel) return true;
		return user.authentication_level >= item.minAuthLevel;
	}, [user]);

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

	// FIXED: Include hasAccess in dependencies
	const accessibleItems = useMemo(() => {
		return navigationItems.filter(item => hasAccess(item));
	}, [hasAccess]);

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
									<div className={styles.navigationIcon}>
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
						<span className={styles.logoutIcon}>🚪</span>
						<span className={styles.logoutText}>登出</span>
					</button>
					<div className={styles.footerInfo}>
						<div className={styles.appVersion}>
							豪神教師管理系統 v2.3.1
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