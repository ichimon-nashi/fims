// src/lib/appConfig.ts
import type { AppMeta } from "@/lib/faq.types";

/**
 * Single source of truth for FIMS apps: id, display name, icon, route, colour.
 * `id` is what usePermissions().hasAppAccess() checks AND what
 * fims_faq_entries.app_id stores — one vocabulary, no mapping table.
 *
 * Adding an app = one row here + one FAQ entry in the admin editor.
 */
export const APP_META: AppMeta[] = [
	{ id: "dashboard",       title: "儀表板",     icon: "/images/dashboard.png",  href: "/dashboard",           color: "#fbbf24" },
	{ id: "roster",          title: "教師班表",   icon: "/images/roster.png",     href: "/roster",              color: "#3b82f6" },
	{ id: "tasks",           title: "任務管理",   icon: "/images/task.png",       href: "/tasks",               color: "#10b981" },
	{ id: "sms",             title: "SMS",        icon: "/images/sms.png",        href: "/sms",                 color: "#ef4444" },
	{ id: "oral_test",       title: "翻書口試",   icon: "/images/oraltest.png",   href: "/oral-test/dashboard", color: "#f59e0b" },
	{ id: "bc_training",     title: "B/C訓練",    icon: "/images/bctraining.png", href: "/bc-training",         color: "#8b5cf6" },
	{ id: "mdafaat",         title: "情境演練",   icon: "/images/mdafaat.png",    href: "/mdafaat",             color: "#ec4899" },
	{ id: "ads",             title: "AdS",        icon: "/images/ads.png",        href: "/ads",                 color: "#14b8a6" },
	{ id: "ccom_review",     title: "手冊抽問",   icon: "/images/ccomreview.png", href: "/ccom-review",         color: "#fb923c" },
	{ id: "audit",           title: "查核",       icon: "/images/audit.png",      href: "/audit",               color: "#a78bfa" },
	{ id: "roulette",        title: "天選之人",   icon: "/images/roulette.png",   href: "/roulette",            color: "#fbbf24" },
	{ id: "user-management", title: "使用者管理", icon: "/images/users.png",      href: "/admin/users",         color: "#38bdf8" },
	{ id: "faq_admin",       title: "FAQ管理",     icon: "/images/faq.png",       href: "/admin/faq",           color: "#22d3ee" },
];
