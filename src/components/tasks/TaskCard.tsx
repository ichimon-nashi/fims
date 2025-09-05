import React from 'react';
import Avatar from '@/components/ui/Avatar/Avatar';
import { Task } from '@/lib/task.types';
import { getDueDateStatus, getPriorityColor, getPriorityLabel } from '@/utils/taskHelpers';
import styles from './TaskManager.module.css';

interface TaskCardProps {
  task: Task;
  columnColor: string;
  columnId: string;
  subtaskCount: number;
  calculatedProgress: number;
  onTaskClick: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task, columnId: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  columnColor,
  columnId,
  subtaskCount,
  calculatedProgress,
  onTaskClick,
  onDragStart
}) => {
  return (
    <div 
      className={`${styles.taskCard} ${styles[`taskCard${columnId.charAt(0).toUpperCase() + columnId.slice(1).replace('-', '')}`]}`}
      style={{ borderLeftColor: columnColor, borderLeftWidth: '4px' }}
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
          <div style={{ 
            marginTop: '0.5rem', 
            background: '#e5e7eb', 
            borderRadius: '0.75rem', 
            height: '0.25rem' 
          }}>
            <div style={{ 
              background: '#10b981', 
              height: '0.25rem', 
              borderRadius: '0.75rem', 
              width: `${calculatedProgress}%` 
            }} />
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
      </div>
    </div>
  );
};

export default TaskCard;