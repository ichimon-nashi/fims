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

interface DashboardStats {
  monthlyScheduleCount: number;
  remainingOralTests: number;
  trainingProgress: number;
  pendingTasks: number;
}

const ICON_SIZE = 40;       // standard quick-action icon size
const AUDIT_ICON_SIZE = 40; // slightly larger for audit

const Dashboard = () => {
  const { user, loading, token } = useAuth();
  const permissions = usePermissions();
  const router = useRouter();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    monthlyScheduleCount: 0,
    remainingOralTests: 0,
    trainingProgress: 0,
    pendingTasks: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const { weather, loading: weatherLoading } = useWeather(user?.base || 'TSA');

  useEffect(() => {
    if (!loading && (!user || !token)) router.replace('/login');
  }, [user, token, loading, router]);

  const fetchDashboardStats = useCallback(async () => {
    if (!token || !user) return;
    try {
      setStatsLoading(true);
      const userIdentifier = user.employee_id || user.id;
      const [scheduleResponse, oralTestResponse, taskStatsResponse] = await Promise.all([
        fetch(`/api/dashboard/schedule-stats?user_id=${userIdentifier}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        fetch('/api/oral-test/dashboard', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
        fetch(`/api/dashboard/task-stats?user_id=${userIdentifier}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);

      let monthlyScheduleCount = 0;
      let remainingOralTests = 0;
      let trainingProgress = 0;
      let pendingTasks = 0;

      if (scheduleResponse?.ok) {
        const d = await scheduleResponse.json();
        monthlyScheduleCount = d.monthlyScheduleCount || 0;
      }
      if (oralTestResponse?.ok) {
        const d = await oralTestResponse.json();
        remainingOralTests = d.examineeTesting?.currentYearRemaining || 0;
        const total = d.examineeTesting?.totalUsers || 0;
        const tested = d.examineeTesting?.currentYearTested || 0;
        trainingProgress = total > 0 ? Math.min(100, Math.round((tested / total) * 100)) : 0;
      }
      if (taskStatsResponse?.ok) {
        const d = await taskStatsResponse.json();
        pendingTasks = d.unfinishedTasksCount || 0;
      }

      setDashboardStats({ monthlyScheduleCount, remainingOralTests, trainingProgress, pendingTasks });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (token && user) fetchDashboardStats();
  }, [token, user, fetchDashboardStats]);

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "早安" : currentHour < 18 ? "午安" : "晚安";

  const stats = [
    { title: "本月排班",   value: statsLoading ? "--" : dashboardStats.monthlyScheduleCount.toString(), unit: "天", icon: "📅", color: "#3b82f6" },
    { title: "待測試人員", value: statsLoading ? "--" : dashboardStats.remainingOralTests.toString(),    unit: "人", icon: "🎯", color: "#f59e0b" },
    { title: "口試完成率", value: statsLoading ? "--" : dashboardStats.trainingProgress.toString(),      unit: "%",  icon: "📚", color: "#ef4444" },
    { title: "待完成任務", value: statsLoading ? "--" : dashboardStats.pendingTasks.toString(),          unit: "項", icon: "✅", color: "#10b981" },
  ];

  const allQuickActions = [
    {
      id: "roster",
      title: "教師班表",
      description: "空服教師排班",
      icon: <Image src="/images/roster.png" alt="教師班表" width={ICON_SIZE} height={ICON_SIZE} style={{ objectFit: 'contain' }} />,
      href: "/roster",
      color: "#3b82f6",
    },
    {
      id: "tasks",
      title: "任務管理",
      description: "Kanban 任務看板",
      icon: <Image src="/images/task.png" alt="任務管理" width={ICON_SIZE} height={ICON_SIZE} style={{ objectFit: 'contain' }} />,
      href: "/tasks",
      color: "#10b981",
    },
    {
      id: "sms",
      title: "SMS",
      description: "Safety Management System",
      icon: <Image src="/images/sms.png" alt="SMS" width={ICON_SIZE} height={ICON_SIZE} style={{ objectFit: 'contain' }} />,
      href: "/sms",
      color: "#ef4444",
    },
    {
      id: "oral_test",
      title: "翻書口試",
      description: "複訓翻書管理",
      icon: <Image src="/images/oraltest.png" alt="翻書口試" width={ICON_SIZE} height={ICON_SIZE} style={{ objectFit: 'contain' }} />,
      href: "/oral-test/dashboard",
      color: "#f59e0b",
    },
    {
      id: "bc_training",
      title: "B/C訓練",
      description: "商務艙服務訓練",
      icon: <Image src="/images/bctraining.png" alt="B/C訓練" width={ICON_SIZE} height={ICON_SIZE} style={{ objectFit: 'contain' }} />,
      href: "/bc-training",
      color: "#8b5cf6",
    },
    {
      id: "mdafaat",
      title: "情境演練",
      description: "緊急撤離演練",
      icon: <Image src="/images/mdafaat.png" alt="情境演練" width={ICON_SIZE} height={ICON_SIZE} style={{ objectFit: 'contain' }} />,
      href: "/mdafaat",
      color: "#ec4899",
    },
    {
      id: "ads",
      title: "AdS",
      description: "注意力測試器",
      icon: <Image src="/images/ads.png" alt="AdS" width={ICON_SIZE} height={ICON_SIZE} style={{ objectFit: 'contain' }} />,
      href: "/ads",
      color: "#14b8a6",
    },
    {
      id: "ccom_review",
      title: "手冊抽問",
      description: "CCOM章節抽問",
      icon: <Image src="/images/ccomreview.png" alt="CCOM抽問" width={ICON_SIZE} height={ICON_SIZE} style={{ objectFit: 'contain' }} />,
      href: "/ccom-review",
      color: "#fb923c",
    },
    {
      id: "audit",
      title: "查核",
      description: "查核管理",
      icon: <Image src="/images/audit.png" alt="查核" width={AUDIT_ICON_SIZE} height={AUDIT_ICON_SIZE} style={{ objectFit: 'contain' }} />,
      href: "/audit",
      color: "#a78bfa",
    },
  ];

  const quickActions = useMemo(() => {
    return allQuickActions.filter(action => permissions.hasAppAccess(action.id as any));
  }, [permissions]);

  const dateString = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const twoLineSubtitle = `歡迎使用豪神FIMS\n今天是 ${dateString}`;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.25rem', fontWeight: '600', color: '#424242',
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
          {/* Welcome */}
          <div className={styles.welcomeSection}>
            <div className={styles.welcomeContent}>
              <h1 className={styles.welcomeTitle}>
                {greeting}, {user?.full_name || user?.employee_id || "使用者"}!
              </h1>
              <p className={styles.welcomeSubtitle}>{twoLineSubtitle}</p>
            </div>
            <div className={styles.welcomeAvatar}>
              <Avatar
                employeeId={user?.employee_id || ""}
                fullName={user?.full_name || user?.employee_id || "使用者"}
                size="large"
                className="dashboardAvatar"
              />
            </div>
          </div>

          {/* Stats */}
          <div className={styles.statsGrid}>
            {stats.map((stat, index) => (
              <div key={index} className={styles.statCard}>
                <div className={styles.statIcon} style={{ color: stat.color }}>{stat.icon}</div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>
                    {stat.value}
                    <span className={styles.statUnit}>{stat.unit}</span>
                  </div>
                  <div className={styles.statTitle}>{stat.title}</div>
                </div>
                {statsLoading && (
                  <div className={styles.statLoading}>
                    <div className={styles.loadingSpinner}></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div className={styles.mainGrid}>
            <div className={styles.quickActionsSection}>
              <h2 className={styles.sectionTitle}>快速功能</h2>
              <div className={styles.quickActionsGrid}>
                {quickActions.map((action, index) => (
                  <a key={index} href={action.href} className={styles.quickActionCard}>
                    <div
                      className={styles.quickActionIcon}
                      style={{ backgroundColor: `${action.color}20`, color: action.color }}
                    >
                      {action.icon}
                    </div>
                    <div className={styles.quickActionContent}>
                      <h3 className={styles.quickActionTitle}>{action.title}</h3>
                      <p className={styles.quickActionDescription}>{action.description}</p>
                    </div>
                    <div className={styles.quickActionArrow}>→</div>
                  </a>
                ))}
              </div>
            </div>

            {/* Weather */}
            <div className={styles.weatherSection}>
              <div className={styles.weatherHeader}>
                <h2 className={styles.sectionTitle}>今日天氣</h2>
                {weatherLoading && (
                  <div className={styles.weatherLoading}>
                    <div className={styles.loadingSpinner}></div>
                  </div>
                )}
              </div>
              <div className={styles.weatherCard}>
                <div className={styles.weatherLocation}>
                  <span className={styles.locationIcon}>📍</span>
                  <span className={styles.locationName}>{weather?.location || '載入中...'}</span>
                </div>
                <div className={styles.weatherMain}>
                  <div className={styles.weatherIconLarge}>
                    {weatherLoading ? '🌡️' : (weather?.icon || '☀️')}
                  </div>
                  <div className={styles.weatherTemp}>
                    <span className={styles.temperature}>{weatherLoading ? '--' : weather?.temperature}</span>
                    <span className={styles.tempUnit}>°C</span>
                  </div>
                </div>
                <div className={styles.weatherDescription}>
                  {weatherLoading ? '載入中...' : weather?.description || '晴朗'}
                  {weather?.error && <span className={styles.weatherError}><br />({weather.error})</span>}
                </div>
                {weather && !weatherLoading && (
                  <div className={styles.weatherDetails}>
                    <div className={styles.weatherDetail}>
                      <span className={styles.detailIcon}>💧</span>
                      <span>濕度 {weather.humidity}%</span>
                    </div>
                    {weather.windSpeed && (
                      <div className={styles.weatherDetail}>
                        <span className={styles.detailIcon}>💨</span>
                        <span>風速 {weather.windSpeed} m/s</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;