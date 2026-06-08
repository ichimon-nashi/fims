// src/components/common/NavigationDrawer.tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import { useMemo, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { AppName } from "@/lib/appPermissions.types";
import Avatar from "@/components/ui/Avatar/Avatar";
import Image from "next/image";
import styles from "./NavigationDrawer.module.css";

const CUSTOM_GIF_OVERRIDES: Record<string, string> = {
	"21986": "m_engineer",
};

const getAuthLevelJob = (level: number): string => {
	const levelMap: Record<number, string> = {
		1: "squire",
		2: "knight",
		3: "archer",
		4: "oracle",
		5: "blackmage",
		6: "whitemage",
		7: "timemage",
		8: "summoner",
		9: "lancer",
		10: "samurai",
		11: "ninja",
		20: "darkknight",
		99: "holyknight",
	};
	return levelMap[level] || "squire";
};

const getAuthLevelGif = (
	employeeId: string,
	level: number,
	gender?: string,
): string => {
	if (CUSTOM_GIF_OVERRIDES[employeeId]) {
		return `/images/authentication_level_gif/${CUSTOM_GIF_OVERRIDES[employeeId]}.gif`;
	}
	const job = getAuthLevelJob(level);
	const genderPrefix = gender === "m" ? "m" : "f";
	return `/images/authentication_level_gif/${genderPrefix}_${job}.gif`;
};

interface NavigationDrawerProps {
	isOpen: boolean;
	onClose: () => void;
}

interface NavigationItem {
	id: string;
	title: string;
	icon: JSX.Element;
	path: string;
	description: string;
	minAuthLevel?: number;
	badge?: string;
	iconColor?: string;
}

const NAV_ICON_SIZE = 33; // adjust once to resize all nav icons

const navigationItems: NavigationItem[] = [
	{
		id: "dashboard",
		title: "儀表板",
		icon: (
			<Image
				src="/images/dashboard.png"
				alt="儀表板"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/dashboard",
		description: "系統首頁",
		iconColor: "dashboard",
	},
	{
		id: "roster",
		title: "教師班表",
		icon: (
			<Image
				src="/images/roster.png"
				alt="教師班表"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/roster",
		description: "空服教師排班",
		iconColor: "roster",
	},
	{
		id: "tasks",
		title: "任務管理",
		icon: (
			<Image
				src="/images/task.png"
				alt="任務管理"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/tasks",
		description: "Kanban 任務看板",
		iconColor: "tasks",
	},
	{
		id: "sms",
		title: "SMS",
		icon: (
			<Image
				src="/images/sms.png"
				alt="SMS"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/sms",
		description: "Safety Management System",
		minAuthLevel: 1,
		iconColor: "sms",
	},
	{
		id: "oral-test",
		title: "翻書口試",
		icon: (
			<Image
				src="/images/oraltest.png"
				alt="翻書口試"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/oral-test/dashboard",
		description: "複訓翻書管理",
		minAuthLevel: 1,
		iconColor: "oralTest",
	},
	{
		id: "business-training",
		title: "B/C訓練",
		icon: (
			<Image
				src="/images/bctraining.png"
				alt="B/C訓練"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/bc-training",
		description: "商務艙服務訓練",
		iconColor: "bcTraining",
	},
	{
		id: "mdafaat",
		title: "情境演練",
		icon: (
			<Image
				src="/images/mdafaat.png"
				alt="情境演練"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/mdafaat",
		description: "緊急撤離演練",
		iconColor: "mdafaat",
	},
	{
		id: "ads",
		title: "AdS",
		icon: (
			<Image
				src="/images/ads.png"
				alt="AdS"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/ads",
		description: "注意力測試器",
		iconColor: "ads",
	},
	{
		id: "ccom-review",
		title: "手冊抽問",
		icon: (
			<Image
				src="/images/ccomreview.png"
				alt="CCOM抽問"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/ccom-review",
		description: "CCOM章節抽問",
		iconColor: "ccomReview",
	},
	{
		id: "audit",
		title: "查核",
		icon: (
			<Image
				src="/images/audit.png"
				alt="查核"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
			/>
		),
		path: "/audit",
		description: "查核管理",
		iconColor: "audit",
	},
	{
		id: "roulette",
		title: "天選之人",
		icon: (
			<Image
				src="/images/roulette.png"
				alt="Roulette"
				width={NAV_ICON_SIZE}
				height={NAV_ICON_SIZE}
				style={{ objectFit: "contain" }}
				onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
			/>
		),
		path: "/roulette",
		description: "隨機抽選人員",
		iconColor: "roulette",
	},
];

const NavigationDrawer = ({ isOpen, onClose }: NavigationDrawerProps) => {
	const router = useRouter();
	const pathname = usePathname();
	const { user, logout } = useAuth();
	const permissions = usePermissions();

	useEffect(() => {
		console.log("=== NAVIGATION DRAWER MOUNTED ===");
		console.log("User object:", user);
		console.log("User SMS permissions:", user?.app_permissions?.sms);
		console.log("Can access SMS?", permissions.hasAppAccess("sms"));
		if (user) {
			(window as any).currentUser = user;
		}
	}, [user, permissions]);

	if (isOpen && user) {
		console.log("=== NAVIGATION DRAWER OPENED ===");
		console.log("User SMS permissions:", user.app_permissions?.sms);
		console.log("Can access SMS?", permissions.hasAppAccess("sms"));
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
		if (e.target === e.currentTarget) onClose();
	};

	const hasAccess = useCallback(
		(item: NavigationItem) => {
			if (!user) return false;
			if (!item.minAuthLevel) return true;
			return user.authentication_level >= item.minAuthLevel;
		},
		[user],
	);

	const accessibleItems = useMemo(() => {
		return navigationItems.filter((item) => {
			if (item.id === "dashboard") return true;
			let appKey: AppName;
			switch (item.id) {
				case "oral-test":
					appKey = "oral_test";
					break;
				case "business-training":
					appKey = "bc_training";
					break;
				case "ccom-review":
					appKey = "ccom_review";
					break;
				case "roulette":
					appKey = "roulette" as AppName;
					break;
				default:
					appKey = item.id as AppName;
			}
			return permissions.hasAppAccess(appKey);
		});
	}, [permissions]);

	const baseInfo = useMemo(() => {
		if (!user)
			return { name: "Unknown", icon: "✈️", colorScheme: "default" };
		if (user.employee_id === "admin")
			return { name: "ADMIN", icon: "🔑", colorScheme: "admin" };
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

	const userDisplayInfo = useMemo(
		() => ({
			employeeId: user?.employee_id || "",
			fullName: user?.full_name || "",
			displayName: user?.full_name || user?.employee_id || "Unknown User",
			rank: user?.rank || "教師",
		}),
		[user],
	);

	const authLevelGif = useMemo(() => {
		if (!user) return null;
		return getAuthLevelGif(
			user.employee_id,
			user.authentication_level,
			user.gender,
		);
	}, [user]);

	if (!isOpen) return null;

	return (
		<>
			<div className={styles.backdrop} onClick={handleBackdropClick} />
			<div className={`${styles.drawer} ${styles.drawerOpen}`}>
				{/* Header */}
				<div
					className={`${styles.drawerHeader} ${styles[baseInfo.colorScheme]}`}
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
						</div>
					</div>
					<button className={styles.closeButton} onClick={onClose}>
						✕
					</button>
					{authLevelGif && (
						<div className={styles.authLevelGif}>
							<img
								src={authLevelGif}
								alt={`Level ${user?.authentication_level}`}
								className={styles.authLevelGifImage}
								onError={(e) => {
									const target = e.target as HTMLImageElement;
									target.src =
										"/images/authentication_level_gif/f_squire.gif";
								}}
							/>
						</div>
					)}
				</div>

				{/* Navigation Items */}
				<div className={styles.navigationList}>
					{accessibleItems.map((item) => {
						const isActive =
							pathname.startsWith(item.path) ||
							(item.path !== "/dashboard" &&
								pathname.includes(item.path.split("/")[1]));
						return (
							<div
								key={item.id}
								className={styles.navigationGroup}
							>
								<div
									className={`${styles.navigationItem} ${isActive ? styles.navigationItemActive : ""}`}
									onClick={() => handleNavigation(item.path)}
								>
									<div
										className={`${styles.navigationIcon} ${item.iconColor ? styles[item.iconColor] : ""}`}
									>
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
											className={
												styles.navigationDescription
											}
										>
											{item.description}
										</div>
										{item.minAuthLevel &&
											user &&
											user.authentication_level <
												item.minAuthLevel && (
												<div
													className={
														styles.accessDenied
													}
												>
													需要權限等級{" "}
													{item.minAuthLevel}+
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
							豪神教師管理系統 v2.4.1
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