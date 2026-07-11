import React, { useState } from 'react';
import Avatar from '@/components/ui/Avatar/Avatar';
import { Task, Column } from '@/lib/task.types';
import { getDueDateStatus, getPriorityColor, getPriorityLabel } from '@/utils/taskHelpers';
import styles from './TaskManager.module.css';

interface TaskCardProps {
  task: Task;
  columnColor: string;
  columnId: string;
  columns: Column[];
  subtaskCount: number;
  calculatedProgress: number;
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task, columnId: string) => void;
  onMoveTask: (task: Task, targetColumnId: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  columnColor,
  columnId,
  columns,
  subtaskCount,
  calculatedProgress,
  onTaskClick,
  onDragStart,
  onMoveTask
}) => {
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  return (
    <div 
      className={`${styles.taskCard} ${styles[`taskCard${columnId.charAt(0).toUpperCase() + columnId.slice(1).replace('-', '')}`]}`}
      style={{ borderLeftColor: columnColor, borderLeftWidth: '3px' }}
      draggable 
      onDragStart={(e) => onDragStart(e, task, columnId)} 
      onClick={() => onTaskClick(task)}
    >
      <div className={styles.taskHeader}>
        <div className={styles.priorityCorner}>
          <span 
            className={styles.priorityTag} 
            style={{ backgroundColor: getPriorityColor(task.priority) }}
          >
            {getPriorityLabel(task.priority)}
          </span>
        </div>
        
        {task.due_date && (
          <div className={styles.dueDateCorner}>
            <span 
              className={styles.dueDateTag} 
              style={{ backgroundColor: getDueDateStatus(task.due_date).color }}
            >
              {getDueDateStatus(task.due_date).text}
            </span>
          </div>
        )}
        
        <h3 className={styles.taskTitle}>{task.title}</h3>
        
        <div className={styles.taskMeta}>
          <span className={styles.comments}>💬 {task.comments.length}</span>
          {subtaskCount > 0 && (
            <span>📋 {subtaskCount} subtask{subtaskCount !== 1 ? 's' : ''}</span>
          )}
        </div>
        
        {calculatedProgress > 0 && (
          <div className={styles.progressRow}>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${calculatedProgress}%` }}
              />
            </div>
            <span className={styles.progressLabel}>{calculatedProgress}%</span>
          </div>
        )}
      </div>

      <div className={styles.taskFooter}>
        <div className={styles.taskAssignees}>
          {task.assigneeAvatars?.slice(0, 3).map((employeeId, index) => (
            <span key={index} className={styles.assigneeAvatar}>
              <Avatar 
                employeeId={employeeId} 
                fullName={task.assigneeNames?.[index] || 'Unknown'} 
                size="small" 
              />
            </span>
          ))}
          {task.assigneeAvatars && task.assigneeAvatars.length > 3 && (
            <span className={styles.moreAssignees}>
              +{task.assigneeAvatars.length - 3}
            </span>
          )}
        </div>

        <div className={styles.moveMenuWrapper}>
          <button
            type="button"
            className={styles.moveMenuButton}
            aria-label="Move task to another column"
            onClick={(e) => {
              e.stopPropagation();
              setMoveMenuOpen((open) => !open);
            }}
          >
            ⋯
          </button>

          {moveMenuOpen && (
            <>
              <div
                className={styles.moveMenuBackdrop}
                onClick={(e) => {
                  e.stopPropagation();
                  setMoveMenuOpen(false);
                }}
              />
              <div
                className={styles.moveMenu}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.moveMenuLabel}>Move to</div>
                {columns
                  .filter((c) => c.id !== columnId)
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={styles.moveMenuItem}
                      onClick={() => {
                        onMoveTask(task, c.id);
                        setMoveMenuOpen(false);
                      }}
                    >
                      {c.title}
                    </button>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskCard;