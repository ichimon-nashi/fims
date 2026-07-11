// src/components/common/UserSettingsModal.tsx
"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./UserSettingsModal.module.css";

interface UserSettingsModalProps {
  onClose: () => void;
}

const UserSettingsModal = ({ onClose }: UserSettingsModalProps) => {
  const { user, token } = useAuth();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    // Validation
    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError("新密碼與確認密碼不符");
      setLoading(false);
      return;
    }

    if (formData.newPassword && formData.newPassword.length < 6) {
      setError("新密碼至少需要6個字元");
      setLoading(false);
      return;
    }

    if (!formData.newPassword) {
      setMessage("沒有變更需要儲存");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password: formData.newPassword }),
      });

      if (response.ok) {
        setMessage("設定已成功更新");
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const errorData = await response.json();
        setError(errorData.message || "更新失敗");
      }
    } catch (err) {
      setError("網路錯誤，請稍後再試");
      console.error("Error updating user settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div className={styles.headerContent}>
            <h2 className={styles.modalTitle}>設定</h2>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <div className={styles.profileName}>{user?.full_name}</div>
              <div className={styles.profileId}>#{user?.employee_id}</div>
            </div>
            <div className={styles.profilePills}>
              {(() => {
                const RANK_COLORS: Record<string, string> = {
                  FA: "#f3722c", FI: "#bc77ec", FS: "#f9c74f",
                  LF: "#f86594", MG: "#997b66", PR: "#7b8f4b", SC: "#d5d5d5",
                };
                const BASE_COLORS: Record<string, string> = {
                  TSA: "#ee5a52", KHH: "#3498db", RMQ: "#44a08d", TPE: "#a83bf6",
                };
                const rankPrefix = user?.rank?.split(" ")[0] ?? "";
                const rankColor = RANK_COLORS[rankPrefix] || "#64748b";
                const baseColor = BASE_COLORS[user?.base?.toUpperCase() || ""] || "#4a9eff";
                return (
                  <>
                    <span
                      className={styles.pill}
                      style={{ background: `${rankColor}22`, border: `1px solid ${rankColor}55`, color: rankColor }}
                    >
                      {rankPrefix}
                    </span>
                    <span
                      className={styles.pill}
                      style={{ background: `${baseColor}22`, border: `1px solid ${baseColor}55`, color: baseColor }}
                    >
                      {user?.base}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          <div className={styles.passwordSection}>
            <h3 className={styles.sectionTitle}>變更密碼</h3>
            <p className={styles.sectionNote}>如不需要變更密碼，請留空</p>

            <div className={styles.formGroup}>
              <label htmlFor="newPassword" className={styles.formLabel}>
                新密碼:
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                className={styles.formInput}
                minLength={6}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.formLabel}>
                確認新密碼:
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={styles.formInput}
                minLength={6}
              />
            </div>
          </div>

          {message && (
            <div className={styles.successMessage}>{message}</div>
          )}

          {error && (
            <div className={styles.errorMessage}>{error}</div>
          )}

          <div className={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
            >
              取消
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={loading}
            >
              {loading ? "儲存中..." : "儲存變更"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserSettingsModal;