// src/components/common/NavigationDrawer.tsx - Updated with single entry point for oral-test
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Avatar from "@/components/ui/Avatar/Avatar";
import styles from "./NavigationDrawer.module.css";

interface NavigationDrawerProps {
	isOpen: boolean;
	onClose: () => void;
}

const NavigationDrawer = ({ isOpen, onClose }: NavigationDrawerProps) => {
	const router = useRouter();
	const pathname = usePathname();
	const { user, logout } = useAuth();

	// Debug logging
	console.log("NavigationDrawer - User data:", user);
	console.log("NavigationDrawer - User authentication_level:", user?.authentication_level);

	const navigationItems = [
		{
			id: "dashboard",
			title: "儀表板",
			icon: "🏠",
			path: "/dashboard",
			description: "系統總覽與快速功能",
		},
		{
			id: "roster",
			title: "排班管理",
			icon: "📅",
			path: "/roster",
			description: "飛行教師排班系統",
		},
		{
			id: "tasks",
			title: "任務管理",
			icon: "📋",
			path: "/tasks",
			description: "Kanban 任務看板",
			badge: "8", // Number of pending tasks
		},
		{
			id: "oral-test",
			title: "口試系統",
			icon: "🎯",
			path: "/oral-test/dashboard", // Direct to dashboard
			description: "口試題目管理與紀錄",
			minAuthLevel: 1, // Minimum auth level required
			// Removed submenu - will be handled internally by oral-test app
		},
		{
			id: "business-training",
			title: "商務艙訓練",
			icon: "✈️",
			path: "/bc-training",
			description: "商務艙服務訓練系統",
		},
	];

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

	// Check if user has access to a navigation item
	const hasAccess = (item: any) => {
		if (!user) return false;
		if (!item.minAuthLevel) return true;
		return user.authentication_level >= item.minAuthLevel;
	};

	// Get base display info for color scheme
	const getBaseInfo = () => {
		if (!user) {
			console.log("No user data available");
			return { name: "Unknown", icon: "✈️", colorScheme: "default" };
		}

		if (user.employee_id === "admin") {
			console.log("Admin user detected");
			return { name: "ADMIN", icon: "🔑", colorScheme: "admin" };
		}

		const base = user.base?.toUpperCase();
		console.log("User base (uppercase):", base);

		switch (base) {
			case "KHH":
			case "KAOHSIUNG":
				console.log("KHH base detected");
				return { name: "KHH", icon: "✈️", colorScheme: "khh" };
			case "TSA":
			case "TAOYUAN":
				console.log("TSA base detected");
				return { name: "TSA", icon: "✈️", colorScheme: "tsa" };
			case "RMQ":
			case "TAICHUNG":
				console.log("RMQ base detected");
				return { name: "RMQ", icon: "✈️", colorScheme: "rmq" };
			default:
				console.log("Default base, using:", user.base);
				return {
					name: user.base || "Unknown",
					icon: "✈️",
					colorScheme: "default",
				};
		}
	};

	const baseInfo = getBaseInfo();
	console.log("BaseInfo result:", baseInfo);

	// Extract employee ID - handle different possible field names
	const employeeId = user?.employee_id || user?.employeeID || "";
	const fullName = user?.full_name || user?.name || "";

	console.log("Avatar props:", { employeeId, fullName });

	// Don't render if drawer is closed
	if (!isOpen) return null;

	// Filter navigation items based on user permissions
	const accessibleItems = navigationItems.filter(item => hasAccess(item));

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
								employeeId={employeeId}
								fullName={
									fullName || employeeId || "Unknown User"
								}
								size="medium"
								className="drawerAvatar"
							/>
						) : (
							<div className={styles.userAvatar}>U</div>
						)}
						<div className={styles.userDetails}>
							<div className={styles.userName}>
								{fullName || employeeId || "Unknown User"}
							</div>
							<div className={styles.userRole}>
								{user?.rank || "教師"}
							</div>
							<div className={styles.userBaseContainer}>
								<div className={styles.userBase}>
									{baseInfo.icon} {baseInfo.name}
								</div>
							</div>
							{user?.authentication_level && (
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
					{accessibleItems.map((item) => (
						<div key={item.id} className={styles.navigationGroup}>
							<div
								className={`${styles.navigationItem} ${
									pathname.startsWith(item.path.split('/')[1]) 
										? styles.navigationItemActive
										: ""
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
					))}
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
							豪神教師管理系統 v2.0
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