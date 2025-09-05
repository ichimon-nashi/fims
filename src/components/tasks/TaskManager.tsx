"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Navbar from "@/components/common/Navbar";
import BoardView from "./BoardView";
import TimelineView from "./TimelineView";
import TaskModal from "./TaskModal";
import AddTaskModal from "./AddTaskModal";
import { useTasks } from "@/hooks/useTasks";
import { Task, ViewType } from "@/lib/task.types";
import { getEmployeeIdentifier } from "@/utils/taskHelpers";
import Avatar from "@/components/ui/Avatar/Avatar";
import styles from "./TaskManager.module.css";

const TaskManager = () => {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  
  // State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>('backlog');
  const [currentView, setCurrentView] = useState<ViewType>('board');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Custom hooks
  const { availableUsers, loadingUsers, loadingTasks, columns, setColumns } = useTasks(selectedYear);
  
  // Constants
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i);

  // Auth redirect
  useEffect(() => {
    if (!loading && (!user || !token)) {
      router.replace('/login');
    }
  }, [user, token, loading, router]);

  // Helper functions
  const getAllTasks = (): Task[] => {
    return columns.flatMap(col => col.tasks);
  };

  const getTasksByStatus = (status: string): Task[] => {
    return columns.find(col => col.id === status)?.tasks.filter(task => !task.parent_id) || [];
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDetail(true);
  };

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
        Loading...
      </div>
    );
  }

  if (!user || !token) return null;

  return (
    <>
      <Navbar />
      <div className={styles.taskManager}>
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h1 className={styles.boardTitle}>任務管理系統</h1>
              
              {/* View Switcher */}
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '0.5rem', padding: '0.25rem' }}>
                <button 
                  onClick={() => setCurrentView('board')} 
                  style={{
                    padding: '0.5rem 1rem', 
                    borderRadius: '0.375rem', 
                    fontSize: '0.875rem', 
                    fontWeight: '600',
                    border: 'none', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s',
                    background: currentView === 'board' ? 'white' : 'transparent',
                    color: currentView === 'board' ? '#3b82f6' : '#6b7280',
                    boxShadow: currentView === 'board' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Board
                </button>
                <button 
                  onClick={() => setCurrentView('timeline')} 
                  style={{
                    padding: '0.5rem 1rem', 
                    borderRadius: '0.375rem', 
                    fontSize: '0.875rem', 
                    fontWeight: '600',
                    border: 'none', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s',
                    background: currentView === 'timeline' ? 'white' : 'transparent',
                    color: currentView === 'timeline' ? '#3b82f6' : '#6b7280',
                    boxShadow: currentView === 'timeline' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  Timeline
                </button>
              </div>
              
              {/* Year Selector */}
              <div className={styles.yearSelector}>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(Number(e.target.value))} 
                  className={styles.yearSelect}
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {/* Team Avatars */}
              <div className={styles.teamAvatars}>
                {availableUsers.map(user => {
                  const employeeId = getEmployeeIdentifier(user);
                  return (
                    <div key={user.id} className={styles.avatar} title={user.full_name}>
                      <Avatar employeeId={employeeId} fullName={user.full_name} size="small" />
                    </div>
                  );
                })}
              </div>
            </div>

            <button 
              className={styles.addTaskButton} 
              onClick={() => setShowAddTask(true)}
            >
              + Add Task
            </button>
          </div>

          {/* Render Current View */}
          {currentView === 'timeline' ? (
            <TimelineView 
              tasks={getAllTasks()} 
              onTaskClick={handleTaskClick} 
            />
          ) : (
            <BoardView 
              columns={columns}
              setColumns={setColumns}
              onTaskClick={handleTaskClick}
              onAddTask={(columnId: string) => {
                setSelectedColumn(columnId);
                setShowAddTask(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showAddTask && (
        <AddTaskModal 
          availableUsers={availableUsers}
          loadingUsers={loadingUsers}
          selectedColumn={selectedColumn}
          allTasks={getAllTasks()}
          columns={columns}
          setColumns={setColumns}
          onClose={() => setShowAddTask(false)}
        />
      )}

      {showTaskDetail && selectedTask && (
        <TaskModal 
          task={selectedTask}
          availableUsers={availableUsers}
          loadingUsers={loadingUsers}
          columns={columns}
          setColumns={setColumns}
          allTasks={getAllTasks()}
          onClose={() => setShowTaskDetail(false)}
        />
      )}
    </>
  );
};

export default TaskManager;