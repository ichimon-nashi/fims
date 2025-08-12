// src/components/tasks/TaskManager.tsx
"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/common/Navbar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./TaskManager.module.css";

/* ===== FUTURE IMPLEMENTATION - COMMENTED OUT =====
interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  dueDate?: string;
  tags: string[];
  createdAt: string;
}

interface Column {
  id: string;
  title: string;
  tasks: Task[];
  color: string;
}
===== END FUTURE IMPLEMENTATION ===== */

const TaskManager = () => {
  const { user, loading, token } = useAuth();
  const router = useRouter();

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

  /* ===== FUTURE IMPLEMENTATION - COMMENTED OUT =====
  const draggedTask = useRef<Task | null>(null);
  const draggedFromColumn = useRef<string | null>(null);

  const [columns, setColumns] = useState<Column[]>([
    // Placeholder data will be replaced with API calls
  ]);

  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>('todo');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    assignee: user?.employee_id || '',
    dueDate: '',
    tags: [] as string[]
  });

  // All the task management functions will be implemented here
  const getPriorityColor = (priority: string) => { ... };
  const handleDragStart = (task: Task, columnId: string) => { ... };
  const handleDrop = (e: React.DragEvent, targetColumnId: string) => { ... };
  const handleAddTask = () => { ... };
  // etc.
  ===== END FUTURE IMPLEMENTATION ===== */

  return (
    <>
      <Navbar />
      <div className={styles.taskManager}>
        <div className={styles.container}>
          {/* Under Construction Page */}
          <div className={styles.underConstruction}>
            <div className={styles.constructionContent}>
              <div className={styles.constructionIcon}>🚧</div>
              <h1 className={styles.constructionTitle}>任務管理系統</h1>
              <h2 className={styles.constructionSubtitle}>系統建置中</h2>
              
              <div className={styles.featurePreview}>
                <p className={styles.constructionDescription}>
                  我正在研發一個功能完整的任務管理系統，將包含：
                </p>
                
                <div className={styles.featureGrid}>
                  <div className={styles.featureCard}>
                    <div className={styles.featureIcon}>📋</div>
                    <h3>Kanban 看板</h3>
                    <p>拖拉式任務管理，支援多種狀態分類</p>
                  </div>
                  
                  <div className={styles.featureCard}>
                    <div className={styles.featureIcon}>👥</div>
                    <h3>團隊協作</h3>
                    <p>任務指派、進度追蹤與團隊溝通</p>
                  </div>              
                </div>
              </div>

              <div className={styles.contactInfo}>
                <p>如有任何建議或需求，請聯繫開發者</p>
                <button 
                  className={styles.backButton}
                  onClick={() => router.push('/dashboard')}
                >
                  返回儀表板
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TaskManager;