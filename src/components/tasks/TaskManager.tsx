// src/components/tasks/TaskManager.tsx
"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/common/Navbar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./TaskManager.module.css";

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

const TaskManager = () => {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const draggedTask = useRef<Task | null>(null);
  const draggedFromColumn = useRef<string | null>(null);

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

  const [columns, setColumns] = useState<Column[]>([
    {
      id: 'todo',
      title: '待辦事項',
      color: '#6b7280',
      tasks: [
        {
          id: '1',
          title: '更新飛行手冊',
          description: '檢查並更新第五章節的緊急程序',
          priority: 'high',
          assignee: 'FI001',
          dueDate: '2025-08-05',
          tags: ['文件', '緊急'],
          createdAt: '2025-07-25'
        },
        {
          id: '2',
          title: '學員評估報告',
          description: '完成三名學員的月度評估',
          priority: 'medium',
          assignee: 'FI002',
          dueDate: '2025-08-02',
          tags: ['評估', '報告'],
          createdAt: '2025-07-26'
        }
      ]
    },
    {
      id: 'in-progress',
      title: '進行中',
      color: '#3b82f6',
      tasks: [
        {
          id: '3',
          title: '新教師培訓',
          description: '進行新進教師的基礎培訓課程',
          priority: 'high',
          assignee: 'SC001',
          dueDate: '2025-08-10',
          tags: ['培訓', '教學'],
          createdAt: '2025-07-20'
        }
      ]
    },
    {
      id: 'review',
      title: '審核中',
      color: '#f59e0b',
      tasks: [
        {
          id: '4',
          title: '安全檢查清單',
          description: '審核更新後的飛行前安全檢查清單',
          priority: 'medium',
          assignee: 'MG001',
          tags: ['安全', '檢查'],
          createdAt: '2025-07-22'
        }
      ]
    },
    {
      id: 'done',
      title: '已完成',
      color: '#10b981',
      tasks: [
        {
          id: '5',
          title: '月度排班安排',
          description: '完成8月份的教師排班安排',
          priority: 'medium',
          assignee: 'SC002',
          tags: ['排班', '管理'],
          createdAt: '2025-07-15'
        }
      ]
    }
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '中';
    }
  };

  const handleDragStart = (task: Task, columnId: string) => {
    draggedTask.current = task;
    draggedFromColumn.current = columnId;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    
    if (!draggedTask.current || !draggedFromColumn.current) return;

    const sourceColumnId = draggedFromColumn.current;
    const task = draggedTask.current;

    if (sourceColumnId === targetColumnId) return;

    setColumns(prevColumns => {
      return prevColumns.map(column => {
        if (column.id === sourceColumnId) {
          return {
            ...column,
            tasks: column.tasks.filter(t => t.id !== task.id)
          };
        }
        if (column.id === targetColumnId) {
          return {
            ...column,
            tasks: [...column.tasks, task]
          };
        }
        return column;
      });
    });

    draggedTask.current = null;
    draggedFromColumn.current = null;
  };

  const handleAddTask = () => {
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      assignee: newTask.assignee,
      dueDate: newTask.dueDate || undefined,
      tags: newTask.tags,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setColumns(prevColumns => 
      prevColumns.map(column => 
        column.id === selectedColumn 
          ? { ...column, tasks: [...column.tasks, task] }
          : column
      )
    );

    setNewTask({
      title: '',
      description: '',
      priority: 'medium',
      assignee: user?.employee_id || '',
      dueDate: '',
      tags: []
    });
    setShowAddTask(false);
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      const newTag = e.currentTarget.value.trim();
      if (!newTask.tags.includes(newTag)) {
        setNewTask(prev => ({
          ...prev,
          tags: [...prev.tags, newTag]
        }));
      }
      e.currentTarget.value = '';
    }
  };

  const removeTag = (tagToRemove: string) => {
    setNewTask(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  return (
    <>
      <Navbar />
      <div className={styles.taskManager}>
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <h1 className={styles.title}>任務管理看板</h1>
              <p className={styles.subtitle}>使用拖拽功能管理您的工作任務</p>
            </div>
            <button 
              className={styles.addButton}
              onClick={() => setShowAddTask(true)}
            >
              + 新增任務
            </button>
          </div>

          {/* Add Task Modal */}
          {showAddTask && (
            <div className={styles.modalBackdrop} onClick={() => setShowAddTask(false)}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                  <h2>新增任務</h2>
                  <button onClick={() => setShowAddTask(false)}>✕</button>
                </div>
                
                <div className={styles.modalContent}>
                  <div className={styles.formGroup}>
                    <label>標題</label>
                    <input
                      type="text"
                      value={newTask.title}
                      onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="輸入任務標題"
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label>說明</label>
                    <textarea
                      value={newTask.description}
                      onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="任務詳細說明"
                      rows={3}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>優先級</label>
                      <select
                        value={newTask.priority}
                        onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value as any }))}
                      >
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label>指派給</label>
                      <input
                        type="text"
                        value={newTask.assignee}
                        onChange={e => setNewTask(prev => ({ ...prev, assignee: e.target.value }))}
                        placeholder="員工編號"
                      />
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>到期日</label>
                      <input
                        type="date"
                        value={newTask.dueDate}
                        onChange={e => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>狀態</label>
                      <select
                        value={selectedColumn}
                        onChange={e => setSelectedColumn(e.target.value)}
                      >
                        {columns.map(column => (
                          <option key={column.id} value={column.id}>
                            {column.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className={styles.formGroup}>
                    <label>標籤</label>
                    <input
                      type="text"
                      placeholder="輸入標籤後按 Enter"
                      onKeyDown={handleTagInput}
                    />
                    <div className={styles.tags}>
                      {newTask.tags.map(tag => (
                        <span key={tag} className={styles.tag}>
                          {tag}
                          <button onClick={() => removeTag(tag)}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={styles.modalActions}>
                  <button 
                    className={styles.cancelButton}
                    onClick={() => setShowAddTask(false)}
                  >
                    取消
                  </button>
                  <button 
                    className={styles.confirmButton}
                    onClick={handleAddTask}
                    disabled={!newTask.title.trim()}
                  >
                    新增任務
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Kanban Board */}
          <div className={styles.kanbanBoard}>
            {columns.map(column => (
              <div 
                key={column.id} 
                className={styles.column}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, column.id)}
              >
                <div 
                  className={styles.columnHeader}
                  style={{ borderTopColor: column.color }}
                >
                  <h3 className={styles.columnTitle}>{column.title}</h3>
                  <span className={styles.taskCount}>{column.tasks.length}</span>
                </div>

                <div className={styles.taskList}>
                  {column.tasks.map(task => (
                    <div
                      key={task.id}
                      className={styles.taskCard}
                      draggable
                      onDragStart={() => handleDragStart(task, column.id)}
                    >
                      <div className={styles.taskHeader}>
                        <div 
                          className={styles.priorityIndicator}
                          style={{ backgroundColor: getPriorityColor(task.priority) }}
                        >
                          {getPriorityText(task.priority)}
                        </div>
                        <div className={styles.taskAssignee}>{task.assignee}</div>
                      </div>

                      <h4 className={styles.taskTitle}>{task.title}</h4>
                      <p className={styles.taskDescription}>{task.description}</p>

                      {task.tags.length > 0 && (
                        <div className={styles.taskTags}>
                          {task.tags.map(tag => (
                            <span key={tag} className={styles.taskTag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className={styles.taskFooter}>
                        <div className={styles.taskDate}>
                          建立: {task.createdAt}
                        </div>
                        {task.dueDate && (
                          <div className={styles.taskDueDate}>
                            到期: {task.dueDate}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default TaskManager;