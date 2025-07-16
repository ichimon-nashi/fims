// src/components/roster/DutyManager.tsx
"use client";

import { useState } from "react";
import styles from "./DutyManager.module.css";

interface DutyManagerProps {
  duties: string[];
  dutyColors: Record<string, string>;
  selectedDuty: string | null;
  onDutySelect: (duty: string | null) => void;
  onDragStart: (e: React.DragEvent, duty: string) => void;
  minimized: boolean;
  onToggleMinimize: () => void;
  onAddCustomDuty: (duty: string, color: string) => void;
  onUpdateDuties: (duties: { name: string; color: string }[]) => void;
  onUpdateDutyName: (oldName: string, newName: string) => void;
  isMobile: boolean;
  isAdmin: boolean;
  token: string;
}

const DutyManager = ({
  duties,
  dutyColors,
  selectedDuty,
  onDutySelect,
  onDragStart,
  minimized,
  onToggleMinimize,
  onAddCustomDuty,
  onUpdateDuties,
  onUpdateDutyName,
  isMobile,
  isAdmin,
  token
}: DutyManagerProps) => {
  const [showAddDuty, setShowAddDuty] = useState(false);
  const [newDutyName, setNewDutyName] = useState("");
  const [newDutyColor, setNewDutyColor] = useState("#3b82f6");
  const [editMode, setEditMode] = useState(false);
  const [editingDuty, setEditingDuty] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handleAddDuty = async () => {
    if (newDutyName.trim()) {
      try {
        // Call API to add duty to database
        const response = await fetch('/api/duties', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newDutyName.trim(),
            color: newDutyColor,
            order_index: duties.length + 1
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Duty added successfully:', result);
          
          // Update local state with new duty AND its color
          onAddCustomDuty(newDutyName.trim(), newDutyColor);
          
          // Reset form
          setNewDutyName("");
          setNewDutyColor("#3b82f6");
          setShowAddDuty(false);
        } else {
          const errorData = await response.json();
          alert(`新增任務失敗: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Error adding duty:', error);
        alert('新增任務時發生錯誤');
      }
    }
  };

  const handleEditDuty = (dutyName: string) => {
    setEditingDuty(dutyName);
    setEditingName(dutyName);
  };

  const handleSaveEdit = async () => {
    if (editingDuty && editingName.trim() && editingName.trim() !== editingDuty) {
      try {
        // Call API to update duty name
        const response = await fetch('/api/duties', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            oldName: editingDuty,
            newName: editingName.trim()
          }),
        });

        if (response.ok) {
          onUpdateDutyName(editingDuty, editingName.trim());
          setEditingDuty(null);
          setEditingName("");
        } else {
          const errorData = await response.json();
          alert(`更新任務失敗: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Error updating duty:', error);
        alert('更新任務時發生錯誤');
      }
    } else {
      setEditingDuty(null);
      setEditingName("");
    }
  };

  const handleCancelEdit = () => {
    setEditingDuty(null);
    setEditingName("");
  };

  const handleDeleteDuty = async (dutyName: string) => {
    if (confirm(`確定要刪除任務 "${dutyName}" 嗎？`)) {
      try {
        const response = await fetch(`/api/duties?name=${encodeURIComponent(dutyName)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          // Update local duties list
          const updatedDuties = duties.filter(d => d !== dutyName);
          onUpdateDuties(updatedDuties.map(name => ({ name, color: dutyColors[name] || '#3b82f6' })));
        } else {
          const errorData = await response.json();
          alert(`刪除任務失敗: ${errorData.message}`);
        }
      } catch (error) {
        console.error('Error deleting duty:', error);
        alert('刪除任務時發生錯誤');
      }
    }
  };

  if (minimized) {
    return (
      <div className={styles.minimizedContainer}>
        <button 
          onClick={onToggleMinimize}
          className={styles.expandButton}
        >
          📋 顯示任務列表
        </button>
      </div>
    );
  }

  return (
    <div className={styles.dutySection}>
      <div className={styles.dutyHeader}>
        <h2 className={styles.dutyTitle}>
          {isMobile ? '點選任務，再點選日期：' : '拖拉任務到日期：'}
        </h2>
        
        <div className={styles.dutyControls}>
          {isAdmin && (
            <>
              <button
                onClick={() => setEditMode(!editMode)}
                className={styles.editButton}
                title="編輯任務"
              >
                ✏️
              </button>
              
              <button
                onClick={() => setShowAddDuty(!showAddDuty)}
                className={styles.addButton}
                title="新增任務"
              >
                ➕
              </button>
            </>
          )}
          
          <button
            onClick={onToggleMinimize}
            className={styles.minimizeButton}
            title="隱藏任務列表"
          >
            隱藏
          </button>
        </div>
      </div>

      {/* Add Custom Duty Form */}
      {showAddDuty && isAdmin && (
        <div className={styles.addDutyForm}>
          <div className={styles.formRow}>
            <input
              type="text"
              value={newDutyName}
              onChange={(e) => setNewDutyName(e.target.value)}
              placeholder="輸入新任務名稱"
              className={styles.dutyInput}
              maxLength={10}
            />
            <input
              type="color"
              value={newDutyColor}
              onChange={(e) => setNewDutyColor(e.target.value)}
              className={styles.colorInput}
              title="選擇任務顏色"
            />
            <button
              onClick={handleAddDuty}
              className={styles.confirmButton}
              disabled={!newDutyName.trim()}
            >
              新增
            </button>
            <button
              onClick={() => setShowAddDuty(false)}
              className={styles.cancelButton}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Edit Mode */}
      {editMode && isAdmin ? (
        <div className={styles.editModeContainer}>
          <div className={styles.editHeader}>
            <span className={styles.editTitle}>編輯任務名稱</span>
            <div className={styles.editActions}>
              <button onClick={() => setEditMode(false)} className={styles.cancelButton}>
                ❌ 完成編輯
              </button>
            </div>
          </div>
          
          <div className={styles.dutyGrid}>
            {duties.map((duty) => (
              <div
                key={duty}
                className={styles.editDutyItem}
                style={{ backgroundColor: dutyColors[duty] || '#3b82f6' }}
              >
                {editingDuty === duty ? (
                  <div className={styles.editingContainer}>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className={styles.editInput}
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                      autoFocus
                    />
                    <div className={styles.editButtons}>
                      <button onClick={handleSaveEdit} className={styles.saveEditButton}>
                        ✓
                      </button>
                      <button onClick={handleCancelEdit} className={styles.cancelEditButton}>
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className={styles.dutyName}>{duty}</span>
                    <div className={styles.dutyActions}>
                      <button
                        onClick={() => handleEditDuty(duty)}
                        className={styles.editDutyButton}
                        title={`編輯 ${duty}`}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteDuty(duty)}
                        className={styles.removeDutyButton}
                        title={`刪除 ${duty}`}
                      >
                        ❌
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Normal Mode
        <div className={styles.dutyGrid}>
          {duties.map((duty) => (
            <div
              key={duty}
              draggable={!isMobile}
              onDragStart={(e) => onDragStart(e, duty)}
              onClick={() => isMobile && onDutySelect(selectedDuty === duty ? null : duty)}
              className={`${styles.dutyType} ${isMobile && selectedDuty === duty ? styles.dutyTypeSelected : ''}`}
              style={{ backgroundColor: dutyColors[duty] || '#f5f5f5' }}
            >
              {duty}
            </div>
          ))}
        </div>
      )}

      {isMobile && selectedDuty && !editMode && (
        <div className={styles.selectedNotice}>
          <p>已選擇：{selectedDuty} - 點選日期安排任務</p>
        </div>
      )}
    </div>
  );
};

export default DutyManager;