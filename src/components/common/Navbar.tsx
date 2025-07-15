// src/components/common/Navbar.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import UserSettingsModal from "./UserSettingsModal";
import styles from "./Navbar.module.css";

const Navbar = () => {
  const { user, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <>
      <nav className={styles.navbar}>
        <div className={styles.navContainer}>
          {/* Logo/Brand */}
          <div className={styles.brand}>
            <span className={styles.brandText}>
              ✈️ 豪神教師排班系統
            </span>
          </div>

          {/* User Info & Actions */}
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>
                {user?.full_name || user?.employee_id || "使用者"}
              </span>
              <span className={styles.userRole}>
                {user?.rank || "教師"}
              </span>
            </div>

            <div className={styles.navActions}>
              <button
                onClick={() => setShowSettings(true)}
                className={styles.settingsButton}
                title="設定"
              >
                ⚙️
              </button>

              <button
                onClick={handleLogout}
                className={styles.logoutButton}
                title="登出"
              >
                🚪 登出
              </button>
            </div>
          </div>
        </div>
      </nav>

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