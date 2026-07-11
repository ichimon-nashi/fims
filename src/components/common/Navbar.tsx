// src/components/common/Navbar.tsx - Updated with dynamic base colors
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import UserSettingsModal from "./UserSettingsModal";
import NavigationDrawer from "./NavigationDrawer";
import { IoSettings } from "react-icons/io5";
import styles from "./Navbar.module.css";

const Navbar = () => {
  const { user, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  // Get base display info for color scheme (same logic as NavigationDrawer)
  const getBaseInfo = () => {
    if (!user) {
      return { name: "Unknown", icon: "", colorScheme: "default" };
    }
    
    if (user.employee_id === "admin") {
      return { name: "ADMIN", icon: "🔑", colorScheme: "admin" };
    }
    
    const base = user.base?.toUpperCase();
    
    switch (base) {
      case "KHH":
      case "高雄":
        return { name: "KHH", icon: "", colorScheme: "khh" };
      case "TSA":
      case "松山":
        return { name: "TSA", icon: "", colorScheme: "tsa" };
      case "RMQ":
      case "台中":
        return { name: "RMQ", icon: "", colorScheme: "rmq" };
      default:
        return { name: user.base || "Unknown", icon: "", colorScheme: "default" };
    }
  };

  const baseInfo = getBaseInfo();

  return (
    <>
      <nav className={`${styles.navbar} ${styles[baseInfo.colorScheme]}`}>
        <div className={styles.navContainer}>
          {/* Hamburger Menu */}
          <button 
            className={styles.hamburgerButton}
            onClick={() => setShowDrawer(true)}
            title="選單"
          >
            <div className={styles.hamburgerLine}></div>
            <div className={styles.hamburgerLine}></div>
            <div className={styles.hamburgerLine}></div>
          </button>

          {/* Logo/Brand */}
          <div className={styles.brand}>
            <span className={styles.brandText}>
              {baseInfo.icon} 豪神 INSTRUCTOR
            </span>
          </div>

          {/* User Info & Actions */}
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>
                {user?.full_name || user?.employee_id || "使用者"}
              </span>
              <span className={styles.userRole}>
                {user?.rank || "教師"} · {baseInfo.name}
              </span>
            </div>

            <div className={styles.navActions}>
              <button
                onClick={() => setShowSettings(true)}
                className={styles.settingsButton}
                title="設定"
              >
                <IoSettings />
              </button>

              <button
                onClick={handleLogout}
                className={styles.logoutButton}
                title="登出"
              >
                ➜]
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Navigation Drawer */}
      <NavigationDrawer 
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
      />

      {/* Settings Modal */}
      {showSettings && (
        <UserSettingsModal
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
};

export default Navbar;