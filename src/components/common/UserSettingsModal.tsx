// src/components/common/UserSettingsModal.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./UserSettingsModal.module.css";

interface UserSettingsModalProps {
  onClose: () => void;
}

const UserSettingsModal = ({ onClose }: UserSettingsModalProps) => {
  const { user, token } = useAuth();
  const [formData, setFormData] = useState({
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        email: user.email || "",
      }));
    }
  }, [user]);

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

    try {
      const updateData: any = {};
      
      // Only update email if it changed
      if (formData.email !== user?.email) {
        updateData.email = formData.email;
      }

      // Only update password if new password is provided
      if (formData.newPassword) {
        updateData.password = formData.newPassword;
      }

      // If nothing to update
      if (Object.keys(updateData).length === 0) {
        setMessage("沒有變更需要儲存");
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setMessage("設定已成功更新");
        // Clear password fields
        setFormData(prev => ({
          ...prev,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        }));
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
          <h2 className={styles.modalTitle}>個人設定</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.userInfo}>
            <div className={styles.infoRow}>
              <span className={styles.label}>員工編號:</span>
              <span className={styles.value}>{user?.employee_id}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>姓名:</span>
              <span className={styles.value}>{user?.full_name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>職級:</span>
              <span className={styles.value}>{user?.rank}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.label}>基地:</span>
              <span className={styles.value}>{user?.base}</span>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.formLabel}>
              電子信箱:
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={styles.formInput}
              required
            />
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