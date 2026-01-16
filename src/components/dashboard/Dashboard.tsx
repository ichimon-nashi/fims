// src/components/dashboard/Dashboard.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/common/Navbar";
import Avatar from "@/components/ui/Avatar/Avatar";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useWeather } from "@/hooks/useWeather";
import { FaRunning, FaUtensils, FaUserShield, FaClipboardList, FaCalendarAlt } from "react-icons/fa";
import { FaBookSkull } from "react-icons/fa6";
import { IoHome, IoBookSharp } from "react-icons/io5";
import { GiDistraction } from "react-icons/gi";
import styles from "./Dashboard.module.css";

interface DashboardStats {
  monthlyScheduleCount: number;
  remainingOralTests: number;
  trainingProgress: number;
  pendingTasks: number;
}

const Dashboard = () => {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    monthlyScheduleCount: 0,
    remainingOralTests: 0,
    trainingProgress: 0,
    pendingTasks: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Get weather based on user's base
  const { weather, loading: weatherLoading } = useWeather(user?.base || 'TSA');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && (!user || !token)) {
      router.replace('/login');
    }
  }, [user, token, loading, router]);

  // Fetch dashboard statistics
  const fetchDashboardStats = useCallback(async () => {
    if (!token || !user) return;

    try {
      setStatsLoading(true);
      
      // Get user identifier - prefer employee_id for API calls
      const userIdentifier = user.employee_id || user.id;
      
      // Fetch multiple endpoints concurrently
      const [scheduleResponse, oralTestResponse, taskStatsResponse] = await Promise.all([
        // Get current month schedule count for user
        fetch(`/api/dashboard/schedule-stats?user_id=${userIdentifier}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => null), // Handle gracefully if endpoint doesn't exist yet
        // Get oral test dashboard data
        fetch('/api/oral-test/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => null), // Handle gracefully if endpoint doesn't exist yet
        // Get task statistics for user
        fetch(`/api/dashboard/task-stats?user_id=${userIdentifier}`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => null) // Handle gracefully if endpoint doesn't exist yet
      ]);

      let monthlyScheduleCount = 0;
      let remainingOralTests = 0;
      let trainingProgress = 0;
      let pendingTasks = 0; // Default to 0 instead of hardcoded 8

      // Process schedule stats
      if (scheduleResponse?.ok) {
        const scheduleData = await scheduleResponse.json();
        monthlyScheduleCount = scheduleData.monthlyScheduleCount || 0;
      }

      // Process oral test stats
      if (oralTestResponse?.ok) {
        const oralTestData = await oralTestResponse.json();
        remainingOralTests = oralTestData.examineeTesting?.currentYearRemaining || 0;
        
        // Calculate training progress based on completion percentage
        const totalUsers = oralTestData.examineeTesting?.totalUsers || 0;
        const currentYearTested = oralTestData.examineeTesting?.currentYearTested || 0;
        trainingProgress = totalUsers > 0 ? Math.min(100, Math.round((currentYearTested / totalUsers) * 100)) : 0;
      }

      // Process task stats
      if (taskStatsResponse?.ok) {
        const taskData = await taskStatsResponse.json();
        pendingTasks = taskData.unfinishedTasksCount || 0;
        console.log('Task stats loaded:', { 
          pendingTasks, 
          totalTasks: taskData.totalUserTasks,
          completed: taskData.completedTasks 
        });
      }

      setDashboardStats({
        monthlyScheduleCount,
        remainingOralTests,
        trainingProgress,
        pendingTasks
      });

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (token && user) {
      fetchDashboardStats();
    }
  }, [token, user, fetchDashboardStats]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#424242'
      }}>
        載入中...
      </div>
    );
  }

  // Don't render if no user (will redirect)
  if (!user || !token) {
    return null;
  }

  const currentHour = new Date().getHours();
  const greeting = 
    currentHour < 12 ? "早安" : 
    currentHour < 18 ? "午安" : "晚安";

  const stats = [
    {
      title: "本月排班",
      value: statsLoading ? "--" : dashboardStats.monthlyScheduleCount.toString(),
      unit: "天",
      icon: "📅",
      color: "#3b82f6"
    },
    {
      title: "待測試人員",
      value: statsLoading ? "--" : dashboardStats.remainingOralTests.toString(),
      unit: "人",
      icon: "🎯",
      color: "#f59e0b"
    },
    {
      title: "口試完成率",
      value: statsLoading ? "--" : dashboardStats.trainingProgress.toString(),
      unit: "%",
      color: "#ef4444",
      icon: "📚"
    },
    {
      title: "待完成任務",
      value: statsLoading ? "--" : dashboardStats.pendingTasks.toString(),
      unit: "項",
      icon: "✅",
      color: "#10b981"
    }
  ];

  const quickActions = [
    {
      title: "教師班表",
      description: "空服教師排班系統",
      icon: <FaCalendarAlt />,
      href: "/roster",
      color: "#3b82f6"
    },
    {
      title: "任務管理",
      description: "Kanban 任務看板",
      icon: <FaClipboardList />,
      href: "/tasks",
      color: "#10b981"
    },
    {
      title: "SMS",
      description: "Safety Management System",
      icon: <FaUserShield />,
      href: "/sms",
      color: "#ef4444"
    },
    {
      title: "翻書口試",
      description: "複訓翻書口試管理系統",
      icon: <FaBookSkull />,
      href: "/oral-test/dashboard",
      color: "#f59e0b"
    },
    {
      title: "B/C訓練",
      description: "商務艙服務訓練",
      icon: <FaUtensils />,
      href: "/bc-training",
      color: "#8b5cf6"
    },
    {
      title: "情境演練",
      description: "緊急撤離演練",
      icon: <FaRunning />,
      href: "/mdafaat",
      color: "#ec4899"
    }
    ,
    {
      title: "AdS",
      description: "注意力測試器",
      icon: <GiDistraction />,
      href: "/ads",
      color: "#14b8a6"
    },
    {
      title: "CCOM抽問",
      description: "新生用CCOM翻書抽問",
      icon: <IoBookSharp />,
      href: "/ccom-review",
      color: "#fb923c"
    }
  ];

  // Create two-line subtitle text
  const dateString = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  });

  const twoLineSubtitle = `歡迎使用豪神FIMS\n今天是 ${dateString}`;

  return (
    <>
      <Navbar />
      <div className={styles.dashboard}>
        <div className={styles.container}>
          {/* Welcome Section */}
          <div className={styles.welcomeSection}>
            <div className={styles.welcomeContent}>
              <h1 className={styles.welcomeTitle}>
                {greeting}, {user?.full_name || user?.employee_id || "使用者"}!
              </h1>
              <p className={styles.welcomeSubtitle}>
                {twoLineSubtitle}
              </p>
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

          {/* Stats Cards */}
          <div className={styles.statsGrid}>
            {stats.map((stat, index) => (
              <div key={index} className={styles.statCard}>
                <div className={styles.statIcon} style={{ color: stat.color }}>
                  {stat.icon}
                </div>
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

          {/* Main Content Grid */}
          <div className={styles.mainGrid}>
            {/* Quick Actions */}
            <div className={styles.quickActionsSection}>
              <h2 className={styles.sectionTitle}>快速功能</h2>
              <div className={styles.quickActionsGrid}>
                {quickActions.map((action, index) => (
                  <a 
                    key={index} 
                    href={action.href}
                    className={styles.quickActionCard}
                  >
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

            {/* Weather Widget - Moved from bottom */}
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
                  <span className={styles.locationName}>
                    {weather?.location || '載入中...'}
                  </span>
                </div>
                
                <div className={styles.weatherMain}>
                  <div className={styles.weatherIconLarge}>
                    {weatherLoading ? '🌡️' : (weather?.icon || '☀️')}
                  </div>
                  <div className={styles.weatherTemp}>
                    <span className={styles.temperature}>
                      {weatherLoading ? '--' : weather?.temperature}
                    </span>
                    <span className={styles.tempUnit}>°C</span>
                  </div>
                </div>
                
                <div className={styles.weatherDescription}>
                  {weatherLoading ? '載入中...' : weather?.description || '晴朗'}
                  {weather?.error && (
                    <span className={styles.weatherError}>
                      <br />({weather.error})
                    </span>
                  )}
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