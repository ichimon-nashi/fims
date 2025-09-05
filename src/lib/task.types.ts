export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'backlog' | 'in-progress' | 'review' | 'complete';
  task_type?: 'main' | 'subtask';
  parent_id?: string;
  start_date?: string;
  actual_hours?: number;
  progress?: number;
  dependencies?: string[];
  assignees: string[];
  assigneeNames: string[];
  assigneeAvatars: string[];
  due_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  year: number;
  sort_order?: number; // ADDED: Field for drag-drop subtask ordering
  comments: TaskComment[];
}

export interface TaskComment {
  id: string;
  task_id: string;
  comment_text: string;
  author_id?: string;
  author_name: string;
  created_at: string;
}

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
  color: string;
  count: number;
}

export interface AvailableUser {
  id: string;
  employee_id: string;
  full_name: string;
  rank: string;
  base: string;
  email: string;
  authentication_level: number;
}

export type ViewType = 'board' | 'timeline';
export type ZoomLevel = 'days' | 'weeks' | 'months' | 'quarters';