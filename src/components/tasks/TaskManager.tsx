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
  const { availableUsers, loadingUsers, loadingTasks, columns, setColumns, refreshTasks } = useTasks(selectedYear);
  
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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#e2e8f0'
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
              <div style={{ 
                display: 'flex', 
                background: 'rgba(51, 65, 85, 0.5)', 
                borderRadius: '0.5rem', 
                padding: '0.25rem',
                border: '1px solid rgba(148, 163, 184, 0.2)'
              }}>
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
                    background: currentView === 'board' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                    color: currentView === 'board' ? 'white' : '#94a3b8',
                    boxShadow: currentView === 'board' ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none'
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
                    background: currentView === 'timeline' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                    color: currentView === 'timeline' ? 'white' : '#94a3b8',
                    boxShadow: currentView === 'timeline' ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none'
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

              {/* Team Avatars - Now dynamic based on availableUsers */}
              <div className={styles.teamAvatars}>
                {loadingUsers ? (
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: '#94a3b8',
                    fontStyle: 'italic' 
                  }}>
                    Loading team...
                  </div>
                ) : availableUsers.length === 0 ? (
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: '#94a3b8',
                    fontStyle: 'italic' 
                  }}>
                    No team members available
                  </div>
                ) : (
                  availableUsers.map(teamMember => {
                    const employeeId = getEmployeeIdentifier(teamMember);
                    return (
                      <div 
                        key={teamMember.id} 
                        className={styles.avatar} 
                        title={`${teamMember.full_name} (${teamMember.employee_id})`}
                      >
                        <Avatar 
                          employeeId={employeeId} 
                          fullName={teamMember.full_name} 
                          size="small" 
                        />
                      </div>
                    );
                  })
                )}
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
              refreshTasks={refreshTasks}
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