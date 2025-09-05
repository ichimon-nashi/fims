import { Task, AvailableUser } from '../lib/task.types';

export const HIDDEN_EMPLOYEES = ["20580"];
export const PRIORITY_ORDER = ["21701", "21531", "21986"];

export const getDueDateStatus = (dueDateString: string) => {
  const dueDate = new Date(dueDateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { status: 'overdue', color: '#ef4444', text: 'Overdue' };
  if (diffDays === 0) return { status: 'dueToday', color: '#f59e0b', text: 'Today' };
  if (diffDays === 1) return { status: 'dueTomorrow', color: '#f59e0b', text: 'Tomorrow' };
  if (diffDays <= 7) return { status: 'dueSoon', color: '#3b82f6', text: dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
  return { status: 'normal', color: '#6b7280', text: dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
};

export const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return '#EF4444';
    case 'medium': return '#F59E0B';
    case 'low': return '#10B981';
    default: return '#6B7280';
  }
};

export const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case 'high': return 'High Priority';
    case 'medium': return 'Med Priority';
    case 'low': return 'Low Priority';
    default: return priority;
  }
};

export const getEmployeeIdentifier = (user: AvailableUser): string => {
  return user.employee_id || user.id || '';
};

export const sortInstructors = (instructors: AvailableUser[]): AvailableUser[] => {
  const visibleInstructors = instructors.filter(instructor => {
    const employeeId = getEmployeeIdentifier(instructor);
    return !HIDDEN_EMPLOYEES.includes(employeeId);
  });

  return visibleInstructors.sort((a, b) => {
    const aId = getEmployeeIdentifier(a);
    const bId = getEmployeeIdentifier(b);
    const aPriority = PRIORITY_ORDER.indexOf(aId);
    const bPriority = PRIORITY_ORDER.indexOf(bId);
    
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    
    const aNum = parseInt(aId) || 0;
    const bNum = parseInt(bId) || 0;
    return aNum - bNum;
  });
};

export const getSubtasks = (tasks: Task[], parentId: string): Task[] => {
  return tasks.filter(task => task.parent_id === parentId);
};

export const calculateParentProgress = (tasks: Task[], parentId: string): number => {
  const subtasks = getSubtasks(tasks, parentId);
  if (subtasks.length === 0) return 0;
  const totalProgress = subtasks.reduce((sum, task) => sum + (task.progress || 0), 0);
  return Math.round(totalProgress / subtasks.length);
};