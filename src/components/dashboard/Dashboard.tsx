// src/components/dashboard/Dashboard.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/common/Navbar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWeather } from "@/hooks/useWeather";
import styles from "./Dashboard.module.css";

const Dashboard = () => {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  
  // Get weather based on user's base
  const { weather, loading: weatherLoading } = useWeather(user?.base || 'TSA');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && (!user || !token)) {
      router.replace('/login');
    }
  }, [user, token, loading, router]);

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
      value: "15",
      unit: "天",
      icon: "📅",
      color: "#3b82f6"
    },
    {
      title: "待完成任務",
      value: "8",
      unit: "項",
      icon: "✅",
      color: "#10b981"
    },
    {
      title: "口試安排",
      value: "3",
      unit: "場",
      icon: "🎯",
      color: "#f59e0b"
    },
    {
      title: "訓練進度",
      value: "85",
      unit: "%",
      color: "#ef4444",
      icon: "📚"
    }
  ];

  const quickActions = [
    {
      title: "查看排班表",
      description: "檢視本月飛行排班",
      icon: "🗓️",
      href: "/roster",
      color: "#3b82f6"
    },
    {
      title: "任務管理",
      description: "管理工作任務清單",
      icon: "📋",
      href: "/tasks",
      color: "#10b981"
    },
    {
      title: "口試系統",
      description: "口試題目與管理",
      icon: "🎯",
      href: "/oral-test",
      color: "#f59e0b"
    },
    {
      title: "商務艙訓練",
      description: "商務艙服務訓練",
      icon: "✈️",
      href: "/business-training",
      color: "#8b5cf6"
    }
  ];

  const recentActivity = [
    {
      action: "更新排班",
      time: "2小時前",
      description: "7月30日 早班 -> 晚班",
      icon: "📅"
    },
    {
      action: "完成任務",
      time: "4小時前", 
      description: "機型檢查表更新",
      icon: "✅"
    },
    {
      action: "口試安排",
      time: "昨天",
      description: "學員 A123 口試排程",
      icon: "🎯"
    },
    {
      action: "訓練記錄",
      time: "2天前",
      description: "商務艙服務程序複習",
      icon: "📚"
    }
  ];

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
                歡迎使用豪神FIMS - 今天是 {new Date().toLocaleDateString('zh-TW', {
                  year: 'numeric',
                  month: 'long', 
                  day: 'numeric',
                  weekday: 'long'
                })}
              </p>
            </div>
            <div className={styles.welcomeIcon}>
              ✈️
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

            {/* Recent Activity */}
            <div className={styles.activitySection}>
              <h2 className={styles.sectionTitle}>最近活動</h2>
              <div className={styles.activityList}>
                {recentActivity.map((activity, index) => (
                  <div key={index} className={styles.activityItem}>
                    <div className={styles.activityIcon}>
                      {activity.icon}
                    </div>
                    <div className={styles.activityContent}>
                      <div className={styles.activityAction}>{activity.action}</div>
                      <div className={styles.activityDescription}>{activity.description}</div>
                    </div>
                    <div className={styles.activityTime}>{activity.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Weather/Info Widget */}
          <div className={styles.infoWidget}>
            <div className={styles.weatherSection}>
              <h3>今日天氣 - {weather?.location || '載入中'}</h3>
              <div className={styles.weatherInfo}>
                {weatherLoading ? (
                  <span className={styles.weatherIcon}>🌡️</span>
                ) : (
                  <span className={styles.weatherIcon}>{weather?.icon || '☀️'}</span>
                )}
                <span className={styles.temperature}>
                  {weatherLoading ? '--' : weather?.temperature}°C
                </span>
                <span className={styles.weatherDesc}>
                  {weatherLoading ? '載入中' : weather?.description || '晴朗'}
                </span>
                {weather?.error && (
                  <span className={styles.weatherError}>
                    ({weather.error})
                  </span>
                )}
              </div>
              {weather && !weatherLoading && (
                <div className={styles.weatherDetails}>
                  <span>濕度: {weather.humidity}%</span>
                  {weather.windSpeed && (
                    <span>風速: {weather.windSpeed} m/s</span>
                  )}
                </div>
              )}
            </div>
            <div className={styles.noticeSection}>
              <h3>系統公告</h3>
              <div className={styles.noticeText}>
                系統將於週日凌晨2:00-4:00進行維護，請提前保存資料。
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;