// src/components/dashboard/Dashboard.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import Navbar from "@/components/common/Navbar";
import Avatar from "@/components/ui/Avatar/Avatar";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useWeather } from "@/hooks/useWeather";
import Image from "next/image";
import styles from "./Dashboard.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SmsReviewItem {
  rr_number: string;
  risk_id: string;
  barrier_id: string;
  hazard_description: string;
  next_review: string;
  is_overdue: boolean;
  days_until: number;
}

interface OralTestStats {
  totalUsers: number;
  currentYearTested: number;
  currentYearRemaining: number;
  completionPct: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ICON_SIZE = 32;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDueLabel(item: SmsReviewItem): string {
  if (item.is_overdue) {
    const days = Math.abs(item.days_until);
    return days <= 1 ? "逾期1天" : `逾期${days}天`;
  }
  const d = new Date(item.next_review);
  return `${d.getMonth() + 1}/${d.getDate()}到期`;
}

function getDueClass(item: SmsReviewItem): string {
  if (item.is_overdue) return styles.dueRed;
  if (item.days_until <= 7) return styles.dueAmber;
  return styles.dueGreen;
}

function getDotClass(item: SmsReviewItem): string {
  if (item.is_overdue) return styles.dotRed;
  if (item.days_until <= 7) return styles.dotAmber;
  return styles.dotGreen;
}

// ── Component ─────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { user, loading, token } = useAuth();
  const permissions = usePermissions();
  const router = useRouter();

  const { weather, loading: weatherLoading } = useWeather(user?.base || "TSA");

  const [smsItems, setSmsItems]         = useState<SmsReviewItem[]>([]);
  const [smsIsFallback, setSmsIsFallback] = useState(false);
  const [smsLoading, setSmsLoading]     = useState(true);

  const [oralStats, setOralStats]   = useState<OralTestStats | null>(null);
  const [oralLoading, setOralLoading] = useState(true);

  // ── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && (!user || !token)) router.replace("/login");
  }, [user, token, loading, router]);

  // ── Fetch SMS reviews ────────────────────────────────────────────────────
  const fetchSmsReviews = useCallback(async () => {
    if (!token) return;
    try {
      setSmsLoading(true);
      const res = await fetch("/api/dashboard/sms-reviews", {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        setSmsItems(data.items || []);
        setSmsIsFallback(data.isFallback || false);
      }
    } catch {
      // fail silently — panel shows empty state
    } finally {
      setSmsLoading(false);
    }
  }, [token]);

  // ── Fetch oral test stats ────────────────────────────────────────────────
  const fetchOralStats = useCallback(async () => {
    if (!token) return;
    try {
      setOralLoading(true);
      const res = await fetch("/api/oral-test/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);
      if (res?.ok) {
        const d = await res.json();
        const total     = d.examineeTesting?.totalUsers           || 0;
        const tested    = d.examineeTesting?.currentYearTested    || 0;
        const remaining = d.examineeTesting?.currentYearRemaining || 0;
        const pct = total > 0 ? Math.min(100, Math.round((tested / total) * 100)) : 0;
        setOralStats({ totalUsers: total, currentYearTested: tested, currentYearRemaining: remaining, completionPct: pct });
      }
    } catch {
      // fail silently
    } finally {
      setOralLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token && user) {
      fetchSmsReviews();
      fetchOralStats();
    }
  }, [token, user, fetchSmsReviews, fetchOralStats]);

  // ── Greeting ─────────────────────────────────────────────────────────────
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "早安" : currentHour < 18 ? "午安" : "晚安";
  const now = new Date();
  const datePart = now.toLocaleDateString("zh-TW", {
    year: "numeric", month: "long", day: "numeric",
  });
  const weekday = now.toLocaleDateString("zh-TW", { weekday: "long" });
  const dateString = `${datePart}（${weekday}）`;

  // ── Quick actions ─────────────────────────────────────────────────────────
  const allQuickActions = [
    { id: "roster",      title: "教師班表", icon: "/images/roster.png",     href: "/roster",              color: "#3b82f6" },
    { id: "tasks",       title: "任務管理", icon: "/images/task.png",       href: "/tasks",               color: "#10b981" },
    { id: "sms",         title: "SMS",      icon: "/images/sms.png",        href: "/sms",                 color: "#ef4444" },
    { id: "oral_test",   title: "翻書口試", icon: "/images/oraltest.png",   href: "/oral-test/dashboard", color: "#f59e0b" },
    { id: "bc_training", title: "B/C訓練",  icon: "/images/bctraining.png", href: "/bc-training",         color: "#8b5cf6" },
    { id: "mdafaat",     title: "情境演練", icon: "/images/mdafaat.png",    href: "/mdafaat",             color: "#ec4899" },
    { id: "ads",         title: "AdS",      icon: "/images/ads.png",        href: "/ads",                 color: "#14b8a6" },
    { id: "ccom_review", title: "手冊抽問", icon: "/images/ccomreview.png", href: "/ccom-review",         color: "#fb923c" },
    { id: "audit",       title: "查核",     icon: "/images/audit.png",      href: "/audit",               color: "#a78bfa" },
  ];

  const quickActions = useMemo(
    () => allQuickActions.filter((a) => permissions.hasAppAccess(a.id as any)),
    [permissions]
  );

  // ── SMS badge ─────────────────────────────────────────────────────────────
  const overdueCount = smsItems.filter((i) => i.is_overdue).length;
  const smsBadgeText =
    smsIsFallback  ? "近期最早3項"
    : overdueCount > 0 ? `${overdueCount}項逾期`
    :                    `${smsItems.length}項`;
  const smsBadgeClass =
    overdueCount > 0 ? styles.badgeRed
    : smsIsFallback  ? styles.badgeGreen
    :                  styles.badgeBlue;

  // ── Donut ─────────────────────────────────────────────────────────────────
  const RADIUS = 32;
  const CIRC   = +(2 * Math.PI * RADIUS).toFixed(1);
  const pct    = oralStats?.completionPct ?? 0;
  const dash   = ((pct / 100) * CIRC).toFixed(1);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.25rem", fontWeight: "600", color: "#424242",
      }}>
        載入中...
      </div>
    );
  }

  if (!user || !token) return null;

  return (
    <>
      <Navbar />
      <div className={styles.dashboard}>
        <div className={styles.container}>

          {/* ── Welcome bar ── */}
          <div className={styles.welcomeSection}>
            <div className={styles.welcomeContent}>
              <h1 className={styles.welcomeTitle}>
                {greeting}，{user?.full_name || user?.employee_id || "使用者"}！
              </h1>
              <p className={styles.welcomeSubtitle}>
                今天是 {dateString}
              </p>
            </div>

            <div className={styles.welcomeRight}>
              {weatherLoading ? (
                <div className={styles.weatherInlineLoading}>
                  <div className={styles.loadingSpinner} />
                </div>
              ) : (
                <div className={styles.weatherInline}>
                  <span className={styles.weatherInlineIcon}>
                    {weather?.icon || "🌡️"}
                  </span>
                  <div className={styles.weatherInlineDetail}>
                    <span className={styles.weatherInlineTemp}>
                      {weather?.temperature ?? "--"}°C
                    </span>
                    <span className={styles.weatherInlineDesc}>
                      {weather?.description || ""}
                      {weather?.humidity ? `　濕度 ${weather.humidity}%` : ""}
                    </span>
                    <span className={styles.weatherInlineLoc}>
                      📍 {weather?.location || user?.base || "TSA"}
                    </span>
                  </div>
                </div>
              )}

              <div className={styles.welcomeAvatar}>
                <Avatar
                  employeeId={user?.employee_id || ""}
                  fullName={user?.full_name || user?.employee_id || "使用者"}
                  size="large"
                  className="dashboardAvatar"
                />
              </div>
            </div>
          </div>

          {/* ── Main 2-col grid ── */}
          <div className={styles.mainGrid}>

            {/* Left col: SMS (auto height) + oral test (fills rest) */}
            <div className={styles.leftCol}>

              {/* SMS panel */}
              <div className={styles.smsPanel}>
                <div className={styles.panelTitle}>
                  SMS 近30天到期審查
                  {!smsLoading && (
                    <span className={`${styles.panelBadge} ${smsBadgeClass}`}>
                      {smsItems.length === 0 ? "全部正常" : smsBadgeText}
                    </span>
                  )}
                </div>

                {smsLoading ? (
                  <div className={styles.smsLoading}>
                    <div className={styles.loadingSpinner} />
                  </div>
                ) : smsItems.length === 0 ? (
                  <div className={styles.noData}>
                    <div className={styles.noDataIcon}>✓</div>
                    <div className={styles.noDataText}>近30天內無到期審查項目</div>
                  </div>
                ) : (
                  <>
                    {smsIsFallback && (
                      <div className={styles.smsFallbackLabel}>
                        30天內無到期項目，顯示最近即將到期：
                      </div>
                    )}
                    <div className={styles.riskList}>
                      {smsItems.map((item) => (
                        <div key={item.rr_number} className={styles.riskItem}>
                          {/* Top row: dot · hazard text · due date */}
                          <div className={styles.riskItemTop}>
                            <div className={`${styles.riskDot} ${getDotClass(item)}`} />
                            <div className={styles.riskText}>
                              {item.hazard_description}
                            </div>
                            <div className={`${styles.riskDue} ${getDueClass(item)}`}>
                              {formatDueLabel(item)}
                            </div>
                          </div>
                          {/* Chips row: always visible on all breakpoints */}
                          <div className={styles.riskMeta}>
                            <span className={`${styles.riskChip} ${styles.chipRR}`}>{item.rr_number}</span>
                            {item.risk_id && (
                              <span className={`${styles.riskChip} ${styles.chipRisk}`}>{item.risk_id}</span>
                            )}
                            {item.barrier_id && (
                              <span className={`${styles.riskChip} ${styles.chipBarrier}`}>{item.barrier_id}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className={styles.panelFooter} onClick={() => router.push("/sms")}>
                  前往 SMS →
                </div>
              </div>

              {/* Oral test panel — fills remaining left col height */}
              <div className={styles.oralPanel}>
                <div className={styles.panelTitle}>
                  口試完成率
                  <span className={`${styles.panelBadge} ${styles.badgeBlue}`}>
                    {new Date().getFullYear()}年度
                  </span>
                </div>

                {oralLoading ? (
                  <div className={styles.oralTestLoading}>
                    <div className={styles.loadingSpinner} />
                  </div>
                ) : oralStats ? (
                  <div className={styles.oralTestWrap}>
                    <div className={styles.donutWrap}>
                      <svg width="80" height="80" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r={RADIUS} fill="none"
                          stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                        <circle cx="40" cy="40" r={RADIUS} fill="none"
                          stroke="#4a9eff" strokeWidth="10"
                          strokeDasharray={`${dash} ${CIRC}`}
                          strokeLinecap="round" />
                      </svg>
                      <div className={styles.donutCenter}>
                        <div className={styles.donutPct}>{pct}%</div>
                        <div className={styles.donutLabel}>完成</div>
                      </div>
                    </div>
                    <div className={styles.oralTestStats}>
                      <div className={styles.oralTestRow}>
                        <span className={styles.oralTestLabel}>已測試</span>
                        <span className={`${styles.oralTestValue} ${styles.colorBlue}`}>
                          {oralStats.currentYearTested}人
                        </span>
                      </div>
                      <div className={styles.oralTestRow}>
                        <span className={styles.oralTestLabel}>待測試</span>
                        <span className={`${styles.oralTestValue} ${styles.colorRed}`}>
                          {oralStats.currentYearRemaining}人
                        </span>
                      </div>
                      <div className={styles.oralTestRow}>
                        <span className={styles.oralTestLabel}>總人數</span>
                        <span className={`${styles.oralTestValue} ${styles.colorMuted}`}>
                          {oralStats.totalUsers}人
                        </span>
                      </div>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.noData}>
                    <div className={styles.noDataIcon}>📊</div>
                    <div className={styles.noDataText}>無法載入資料</div>
                  </div>
                )}

                <div className={styles.panelFooter} onClick={() => router.push("/oral-test/dashboard")}>
                  前往翻書口試 →
                </div>
              </div>
            </div>

            {/* Right col: quick actions */}
            <div className={styles.rightPanel}>
              <div className={styles.panelTitle}>快速功能</div>
              <div className={styles.quickActionsGrid}>
                {quickActions.map((action) => (
                  <a
                    key={action.id}
                    href={action.href}
                    className={styles.quickActionGridItem}
                  >
                    <div
                      className={styles.quickActionGridIcon}
                      style={{ backgroundColor: `${action.color}22` }}
                    >
                      <Image
                        src={action.icon}
                        alt={action.title}
                        width={ICON_SIZE}
                        height={ICON_SIZE}
                        style={{ objectFit: "contain" }}
                      />
                    </div>
                    <span className={styles.quickActionGridLabel}>{action.title}</span>
                  </a>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;