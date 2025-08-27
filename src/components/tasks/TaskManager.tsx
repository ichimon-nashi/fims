// src/components/tasks/TaskManager.tsx - Complete Updated Version with Due Date Feature
"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/common/Navbar";
import { useRouter } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/service-client";
import Avatar from "@/components/ui/Avatar/Avatar";
import styles from "./TaskManager.module.css";

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'backlog' | 'in-progress' | 'review' | 'complete';
  assignees: string[];
  assigneeNames: string[];
  assigneeAvatars: string[];
  due_date?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  year: number;
  comments: TaskComment[];
}

interface TaskComment {
  id: string;
  task_id: string;
  comment_text: string;
  author_id?: string;
  author_name: string;
  created_at: string;
}

interface Column {
  id: string;
  title: string;
  tasks: Task[];
  color: string;
  count: number;
}

interface AvailableUser {
  id: string;
  employee_id: string;
  full_name: string;
  rank: string;
  base: string;
  email: string;
  authentication_level: number;
}

// Hidden employees (matching roster component)
const HIDDEN_EMPLOYEES = ["20580"];

// Priority order for consistent sorting
const PRIORITY_ORDER = ["21701", "21531", "21986"];

const TaskManager = () => {
  const { user, loading, token } = useAuth();
  const router = useRouter();
  const draggedTask = useRef<Task | null>(null);
  const draggedFromColumn = useRef<string | null>(null);

  // Available users for assignment (loaded from database)
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Modal states
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<string>('backlog');

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  // Loading states
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

  // Task form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    assignees: [] as string[],
    due_date: '',
  });

  // Current year state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear + i);

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Initialize columns with empty state
  const [columns, setColumns] = useState<Column[]>([
    {
      id: 'backlog',
      title: '代辦 Open',
      color: '#3B82F6',
      count: 0,
      tasks: []
    },
    {
      id: 'in-progress',
      title: '進行中 In Progress',
      color: '#907ad6',
      count: 0,
      tasks: []
    },
    {
      id: 'complete',
      title: '完成 Complete',
      color: '#10B981',
      count: 0,
      tasks: []
    },    
    {
      id: 'review',
      title: '暫緩 On Hold',
      color: '#ef476f',
      count: 0,
      tasks: []
    },
  ]);

  // Helper function to get due date status and styling
  const getDueDateStatus = (dueDateString: string) => {
    const dueDate = new Date(dueDateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Reset time to compare dates only
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return {
        status: 'overdue',
        color: '#ef4444',
        text: 'Overdue'
      };
    } else if (diffDays === 0) {
      return {
        status: 'dueToday',
        color: '#f59e0b',
        text: 'Today'
      };
    } else if (diffDays === 1) {
      return {
        status: 'dueTomorrow',
        color: '#f59e0b',
        text: 'Tomorrow'
      };
    } else if (diffDays <= 7) {
      return {
        status: 'dueSoon',
        color: '#3b82f6',
        text: dueDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      };
    } else {
      return {
        status: 'normal',
        color: '#6b7280',
        text: dueDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        })
      };
    }
  };

  // Get employee identifier - prioritize employee_id over UUID
  const getEmployeeIdentifier = (user: AvailableUser): string => {
    return user.employee_id || user.id || '';
  };

  // Check if current user has admin access
  const isAdmin = () => {
    if (!user) return false;
    
    // Admin employee IDs
    const adminEmployeeIds = ["51892", "admin", "21986"];
    
    // Special admin employee IDs
    const specialAdminIds = ["22119", "59976", "21701", "39426", "36639"];
    
    // Admin ranks
    const adminRanks = [
      "SC - Section Chief",
      "MG - Manager"
    ];

    return adminEmployeeIds.includes(user.employee_id) ||
           specialAdminIds.includes(user.employee_id) ||
           (user.rank && adminRanks.includes(user.rank));
  };

  // Custom sort function for instructors (matching roster component exactly)
  const sortInstructors = (instructors: AvailableUser[]): AvailableUser[] => {
    console.log("Sorting instructors...", {
      priorityOrder: PRIORITY_ORDER,
      hiddenEmployees: HIDDEN_EMPLOYEES,
      totalInstructors: instructors.length
    });

    // First, filter out hidden employees
    const visibleInstructors = instructors.filter(instructor => {
      const employeeId = getEmployeeIdentifier(instructor);
      const isHidden = HIDDEN_EMPLOYEES.includes(employeeId);
      if (isHidden) {
        console.log(`Hiding instructor: ${instructor.full_name} (${employeeId})`);
      }
      return !isHidden;
    });

    console.log(`After filtering hidden employees: ${visibleInstructors.length} instructors`);

    // Sort the visible instructors
    const sorted = visibleInstructors.sort((a, b) => {
      const aId = getEmployeeIdentifier(a);
      const bId = getEmployeeIdentifier(b);
      
      const aPriority = PRIORITY_ORDER.indexOf(aId);
      const bPriority = PRIORITY_ORDER.indexOf(bId);
      
      // If both are in priority list, sort by priority order
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      
      // If only A is in priority list, A comes first
      if (aPriority !== -1) {
        return -1;
      }
      
      // If only B is in priority list, B comes first
      if (bPriority !== -1) {
        return 1;
      }
      
      // If neither is in priority list, sort by employee ID numerically (smallest to largest)
      const aNum = parseInt(aId) || 0;
      const bNum = parseInt(bId) || 0;
      return aNum - bNum;
    });

    console.log("Sorted instructor order:", sorted.map(instructor => ({
      id: getEmployeeIdentifier(instructor),
      name: instructor.full_name
    })));

    return sorted;
  };

  // Load available users directly from Supabase (filtered exactly like roster component)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        console.log('Loading users - starting...');
        setLoadingUsers(true);
        const supabase = createServiceClient();
        console.log('Service client created successfully');
        
        // Test basic connectivity
        const { data: testData, error: testError } = await supabase
          .from('users')
          .select('count')
          .limit(1);
        
        if (testError) {
          console.error('Database connectivity test failed:', testError);
          throw new Error(`Database connection failed: ${testError.message}`);
        }
        
        console.log('Database connectivity test passed');

        // First get all users
        const { data: allUsers, error } = await supabase
          .from('users')
          .select('id, employee_id, full_name, rank, base, email, authentication_level')
          .order('full_name', { ascending: true });

        if (error) {
          console.error('Error loading users:', error);
          throw error;
        }

        console.log('Raw users from database:', allUsers?.length || 0);
        console.log('Sample user data:', allUsers?.[0]);

        // Apply the exact same filtering logic as RosterComponent
        const filteredInstructors = (allUsers || []).filter(
          (user) => {
            const matches = user.rank === "FI - Flight Attendant Instructor" ||
                           user.rank === "SC - Section Chief" ||
                           (user.employee_id && user.employee_id === "21701") ||
                           (user.employee_id && user.employee_id === "22119") ||
                           (user.employee_id && user.employee_id === "36639");
            
            console.log(`User ${user.full_name} (${user.employee_id}): rank="${user.rank}", matches=${matches}`);
            return matches;
          }
        );

        console.log('Filtered instructor users (before hiding):', filteredInstructors.length);
        
        // Apply sorting and hiding logic like roster component
        const sortedAndFilteredInstructors = sortInstructors(filteredInstructors);
        
        console.log('Final instructor users (after hiding & sorting):', sortedAndFilteredInstructors.length);
        setAvailableUsers(sortedAndFilteredInstructors);
      } catch (error) {
        console.error('Error loading users:', error);
        // No fallback users - let the UI show empty state
        setAvailableUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (user && token) {
      console.log('User and token available, loading users...');
      loadUsers();
    } else {
      console.log('User or token not available:', { hasUser: !!user, hasToken: !!token });
    }
  }, [user, token]);

  // Load tasks from database
  useEffect(() => {
    const loadTasks = async () => {
      if (!user || !token) return;
      
      try {
        setLoadingTasks(true);
        const supabase = createServiceClient();
        
        // First check if tasks table exists
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('year', selectedYear)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.log('Tasks table might not exist or error loading:', error.message);
          // Keep empty tasks for development
          return;
        }

        console.log('Loaded tasks from database:', tasks?.length);

        if (tasks && tasks.length > 0) {
          // Get comments for all tasks
          const taskIds = tasks.map(task => task.id);
          const { data: comments } = await supabase
            .from('task_comments')
            .select('*')
            .in('task_id', taskIds)
            .order('created_at', { ascending: true });

          // Group comments by task_id
          const commentsByTask = new Map<string, TaskComment[]>();
          (comments || []).forEach(comment => {
            if (!commentsByTask.has(comment.task_id)) {
              commentsByTask.set(comment.task_id, []);
            }
            commentsByTask.get(comment.task_id)!.push({
              id: comment.id,
              task_id: comment.task_id,
              comment_text: comment.comment_text,
              author_id: comment.author_id,
              author_name: comment.author_name,
              created_at: comment.created_at
            });
          });

          // Transform and group tasks by status
          const transformedTasks: Task[] = tasks.map(task => ({
            id: task.id,
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            status: task.status,
            assignees: task.assignees || [],
            assigneeNames: (task.assignees || []).map((id: string) => availableUsers.find(u => u.id === id)?.full_name || 'Unknown User'),
            assigneeAvatars: (task.assignees || []).map((id: string) => {
              const user = availableUsers.find(u => u.id === id);
              return user ? user.employee_id : '';
            }),
            due_date: task.due_date,
            created_by: task.created_by,
            created_at: task.created_at,
            updated_at: task.updated_at,
            year: task.year,
            comments: commentsByTask.get(task.id) || []
          }));

          // Group tasks by status and update columns
          const newColumns = columns.map(column => ({
            ...column,
            tasks: transformedTasks.filter(task => task.status === column.id),
            count: transformedTasks.filter(task => task.status === column.id).length
          }));

          setColumns(newColumns);
        }
      } catch (error) {
        console.error('Error loading tasks:', error);
      } finally {
        setLoadingTasks(false);
      }
    };

    // Load tasks after users are loaded (for assignee names)
    if (!loadingUsers) {
      loadTasks();
    }
  }, [user, token, selectedYear, loadingUsers, availableUsers]);

  // Check if tables exist and create them if needed
  useEffect(() => {
    const initializeTables = async () => {
      if (!user || !token) return;
      
      try {
        const supabase = createServiceClient();
        
        // Check if tasks table exists by trying to select from it
        const { error: selectError } = await supabase
          .from('tasks')
          .select('id')
          .limit(1);
        
        if (selectError) {
          console.log('Tasks table might not exist, error:', selectError.message);
          console.log('Please run the SQL schema in your Supabase SQL Editor to create the tables.');
        } else {
          console.log('Tasks table exists and accessible');
        }
      } catch (error) {
        console.error('Error checking tables:', error);
      }
    };

    initializeTables();
  }, [user, token]);

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
        Loading...
      </div>
    );
  }

  // Don't render if no user (will redirect)
  if (!user || !token) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'High Priority';
      case 'medium': return 'Med Priority';
      case 'low': return 'Low Priority';
      default: return priority;
    }
  };

  const handleDragStart = (e: React.DragEvent, task: Task, columnId: string) => {
    draggedTask.current = task;
    draggedFromColumn.current = columnId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    
    if (!draggedTask.current || !draggedFromColumn.current) return;
    
    if (draggedFromColumn.current === targetColumnId) return;

    const task = draggedTask.current;
    const sourceColumnId = draggedFromColumn.current;

    try {
      // Update task status in database
      const supabase = createServiceClient();
      const { error } = await supabase
        .from('tasks')
        .update({ status: targetColumnId })
        .eq('id', task.id);

      if (error) {
        console.error('Error updating task status:', error);
        // Still update local state as fallback
      }

      // Update local state
      setColumns(prevColumns => {
        return prevColumns.map(column => {
          if (column.id === sourceColumnId) {
            return {
              ...column,
              tasks: column.tasks.filter(t => t.id !== task.id),
              count: column.tasks.length - 1
            };
          }
          if (column.id === targetColumnId) {
            const updatedTask = {
              ...task,
              status: targetColumnId as any,
              updated_at: new Date().toISOString()
            };
            return {
              ...column,
              tasks: [...column.tasks, updatedTask],
              count: column.tasks.length + 1
            };
          }
          return column;
        });
      });
    } catch (error) {
      console.error('Error in drag and drop:', error);
    }

    draggedTask.current = null;
    draggedFromColumn.current = null;
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setEditTask({ ...task });
    setIsEditing(false);
    setShowTaskDetail(true);
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      setSavingTask(true);
      const supabase = createServiceClient();
      
      // Prepare task data
      const taskData = {
        title: newTask.title,
        description: newTask.description || '',
        priority: newTask.priority,
        status: selectedColumn,
        assignees: newTask.assignees,
        due_date: newTask.due_date || null,
        created_by: user.id,
        year: new Date().getFullYear()
      };

      console.log('Creating task in database:', taskData);
      
      // Insert into database
      const { data: createdTask, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) {
        console.error('Error creating task in database:', error);
        throw error;
      }

      console.log('Task created in database:', createdTask);

console.log('Database URL being used:', process.env.NEXT_PUBLIC_SUPABASE_URL);

      // Create task object for local state
      const task: Task = {
        id: createdTask.id,
        title: createdTask.title,
        description: createdTask.description || '',
        priority: createdTask.priority,
        status: createdTask.status as any,
        assignees: createdTask.assignees || [],
        assigneeNames: (createdTask.assignees || []).map((id: string) => availableUsers.find(u => u.id === id)?.full_name || 'Unknown User'),
        assigneeAvatars: (createdTask.assignees || []).map((id: string) => {
          const user = availableUsers.find(u => u.id === id);
          return user ? user.employee_id : '';
        }),
        due_date: createdTask.due_date,
        created_by: createdTask.created_by,
        created_at: createdTask.created_at,
        updated_at: createdTask.updated_at,
        year: createdTask.year,
        comments: []
      };

      // Update local state
      setColumns(prevColumns => 
        prevColumns.map(column => 
          column.id === selectedColumn
            ? { ...column, tasks: [...column.tasks, task], count: column.tasks.length + 1 }
            : column
        )
      );

      // Reset form
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        assignees: [],
        due_date: '',
      });
      setShowAddTask(false);

    } catch (error) {
      console.error('Error creating task:', error);
      
      // Fallback: create task locally if database fails
      const localTask: Task = {
        id: Date.now().toString(),
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        status: selectedColumn as any,
        assignees: newTask.assignees,
        assigneeNames: newTask.assignees.map(id => availableUsers.find(u => u.id === id)?.full_name || 'Unknown User'),
        assigneeAvatars: newTask.assignees.map(id => {
          const user = availableUsers.find(u => u.id === id);
          return user ? user.employee_id : '';
        }),
        due_date: newTask.due_date,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        year: new Date().getFullYear(),
        comments: []
      };

      // Update local state as fallback
      setColumns(prevColumns => 
        prevColumns.map(column => 
          column.id === selectedColumn
            ? { ...column, tasks: [...column.tasks, localTask], count: column.tasks.length + 1 }
            : column
        )
      );

      // Reset form
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        assignees: [],
        due_date: '',
      });
      setShowAddTask(false);
      
      alert('Task created locally. Database save failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSavingTask(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedTask) return;

    try {
      setAddingComment(true);
      const supabase = createServiceClient();
      
      const commentData = {
        task_id: selectedTask.id,
        comment_text: newComment,
        author_id: user.id,
        author_name: user.full_name || 'Current User'
      };

      // Insert into database
      const { data: createdComment, error } = await supabase
        .from('task_comments')
        .insert([commentData])
        .select()
        .single();

      if (error) {
        console.error('Error creating comment in database:', error);
        throw error;
      }

      const comment: TaskComment = {
        id: createdComment.id,
        task_id: createdComment.task_id,
        comment_text: createdComment.comment_text,
        author_id: createdComment.author_id,
        author_name: createdComment.author_name,
        created_at: createdComment.created_at
      };

      // Update selected task
      const updatedTask = {
        ...selectedTask,
        comments: [...selectedTask.comments, comment]
      };

      setSelectedTask(updatedTask);

      // Update task in columns
      setColumns(prevColumns =>
        prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.map(task =>
            task.id === selectedTask.id ? updatedTask : task
          )
        }))
      );

      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      
      // Fallback: add comment locally
      const localComment: TaskComment = {
        id: Date.now().toString(),
        task_id: selectedTask.id,
        comment_text: newComment,
        author_id: user.id,
        author_name: user.full_name || 'Current User',
        created_at: new Date().toISOString()
      };

      const updatedTask = {
        ...selectedTask,
        comments: [...selectedTask.comments, localComment]
      };

      setSelectedTask(updatedTask);

      setColumns(prevColumns =>
        prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.map(task =>
            task.id === selectedTask.id ? updatedTask : task
          )
        }))
      );

      setNewComment('');
      alert('Comment added locally. Database save failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setAddingComment(false);
    }
  };

  const updateTaskStatus = async (task: Task, newColumnId: string) => {
    const currentColumnId = columns.find(col => col.tasks.some(t => t.id === task.id))?.id;
    if (!currentColumnId || currentColumnId === newColumnId) return;

    try {
      // Update in database
      const supabase = createServiceClient();
      const { error } = await supabase
        .from('tasks')
        .update({ status: newColumnId })
        .eq('id', task.id);

      if (error) {
        console.error('Error updating task status in database:', error);
      }

      // Update local state
      setColumns(prevColumns => {
        return prevColumns.map(column => {
          if (column.id === currentColumnId) {
            return {
              ...column,
              tasks: column.tasks.filter(t => t.id !== task.id),
              count: column.tasks.length - 1
            };
          }
          if (column.id === newColumnId) {
            const updatedTask = {
              ...task,
              status: newColumnId as any,
              updated_at: new Date().toISOString()
            };
            return {
              ...column,
              tasks: [...column.tasks, updatedTask],
              count: column.tasks.length + 1
            };
          }
          return column;
        });
      });

      setShowTaskDetail(false);
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTask || !selectedTask) return;

    try {
      setSavingTask(true);
      const supabase = createServiceClient();
      
      // Update in database
      const updates = {
        title: editTask.title,
        description: editTask.description,
        priority: editTask.priority,
        assignees: editTask.assignees,
        due_date: editTask.due_date
      };

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', selectedTask.id);

      if (error) {
        console.error('Error updating task in database:', error);
        throw error;
      }

      // Update local state
      const updatedTask = {
        ...editTask,
        assigneeNames: editTask.assignees.map(id => availableUsers.find(u => u.id === id)?.full_name || 'Unknown User'),
        assigneeAvatars: editTask.assignees.map(id => {
          const user = availableUsers.find(u => u.id === id);
          return user ? user.employee_id : '';
        }),
        updated_at: new Date().toISOString()
      };

      setColumns(prevColumns =>
        prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.map(task =>
            task.id === selectedTask.id ? updatedTask : task
          )
        }))
      );

      setSelectedTask(updatedTask);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to save changes: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSavingTask(false);
    }
  };

  const handleCancelEdit = () => {
    setEditTask(selectedTask ? { ...selectedTask } : null);
    setIsEditing(false);
  };

  const handleDeleteTask = async () => {
    if (!selectedTask || !isAdmin()) return;

    if (!confirm(`Are you sure you want to delete the task "${selectedTask.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setSavingTask(true);
      const supabase = createServiceClient();
      
      // First delete all comments for this task
      const { error: commentsError } = await supabase
        .from('task_comments')
        .delete()
        .eq('task_id', selectedTask.id);

      if (commentsError) {
        console.error('Error deleting task comments:', commentsError);
        throw commentsError;
      }

      // Then delete the task
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', selectedTask.id);

      if (taskError) {
        console.error('Error deleting task:', taskError);
        throw taskError;
      }

      // Update local state - remove task from columns
      setColumns(prevColumns =>
        prevColumns.map(column => ({
          ...column,
          tasks: column.tasks.filter(task => task.id !== selectedTask.id),
          count: column.tasks.filter(task => task.id !== selectedTask.id).length
        }))
      );

      // Close the modal
      setShowTaskDetail(false);
      setSelectedTask(null);
      
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setSavingTask(false);
    }
  };

  const toggleAssignee = (userId: string, isEditing: boolean = false) => {
    if (isEditing && editTask) {
      const currentAssignees = editTask.assignees || [];
      const newAssignees = currentAssignees.includes(userId)
        ? currentAssignees.filter(id => id !== userId)
        : [...currentAssignees, userId];
      
      setEditTask({
        ...editTask,
        assignees: newAssignees,
        assigneeNames: newAssignees.map(id => availableUsers.find(u => u.id === id)?.full_name || 'Unknown User'),
        assigneeAvatars: newAssignees.map(id => {
          const user = availableUsers.find(u => u.id === id);
          return user ? user.employee_id : '';
        })
      });
    } else {
      const currentAssignees = newTask.assignees;
      const updated = currentAssignees.includes(userId)
        ? currentAssignees.filter(id => id !== userId)
        : [...currentAssignees, userId];
      
      setNewTask({ ...newTask, assignees: updated });
    }
  };

  return (
    <>
      <Navbar />
      <div className={styles.taskManager}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h1 className={styles.boardTitle}>任務看板</h1>
              <div className={styles.yearSelector}>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className={styles.yearSelect}
                >
                  {years.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.teamAvatars}>
                {availableUsers.map(user => {
                  const employeeId = getEmployeeIdentifier(user);
                  
                  return (
                    <div key={user.id} className={styles.avatar} title={user.full_name}>
                      <Avatar
                        employeeId={employeeId}
                        fullName={user.full_name}
                        size="small"
                      />
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

          <div className={styles.kanbanBoard}>
            {columns.map((column) => (
              <div 
                key={column.id} 
                className={styles.column}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div className={styles.columnHeader}>
                  <div 
                    className={styles.columnTitle}
                    style={{ borderTopColor: column.color }}
                  >
                    <span>{column.title}</span>
                    <span className={styles.taskCount}>{column.count}</span>
                  </div>
                </div>

                <div className={styles.taskList}>
                  {column.tasks.map((task) => (
                    <div
                      key={task.id}
                      className={`${styles.taskCard} ${styles[`taskCard${column.id.charAt(0).toUpperCase() + column.id.slice(1).replace('-', '')}`]}`}
                      style={{ borderLeftColor: column.color, borderLeftWidth: '4px' }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task, column.id)}
                      onClick={() => handleTaskClick(task)}
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
                        
                        {/* Due Date in top right corner with color coding */}
                        {task.due_date && (
                          <div className={styles.dueDateCorner}>
                            <span 
                              className={styles.dueDateTag}
                              style={{ 
                                backgroundColor: getDueDateStatus(task.due_date).color 
                              }}
                              title={`Due: ${new Date(task.due_date).toLocaleDateString()}`}
                            >
                              {getDueDateStatus(task.due_date).text}
                            </span>
                          </div>
                        )}
                        
                        <h3 className={styles.taskTitle}>{task.title}</h3>
                        <div className={styles.taskMeta}>
                          <span className={styles.comments}>
                            💬 {task.comments.length}
                          </span>
                        </div>
                      </div>

                      <div className={styles.taskFooter}>
                        <div className={styles.taskAssignees}>
                          {task.assigneeAvatars?.slice(0, 3).map((employeeId, index) => {
                            const assigneeName = task.assigneeNames?.[index] || 'Unknown';
                            return (
                              <span key={index} className={styles.assigneeAvatar}>
                                <Avatar
                                  employeeId={employeeId}
                                  fullName={assigneeName}
                                  size="small"
                                />
                              </span>
                            );
                          })}
                          {task.assigneeAvatars && task.assigneeAvatars.length > 3 && (
                            <span className={styles.moreAssignees}>
                              +{task.assigneeAvatars.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <button 
                    className={styles.addTaskInColumn}
                    onClick={() => {
                      setSelectedColumn(column.id);
                      setShowAddTask(true);
                    }}
                  >
                    + Add task
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className={styles.modal} onClick={() => setShowAddTask(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add New Task</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setShowAddTask(false)}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label>Task Title</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  placeholder="Enter task title..."
                />
              </div>

              <div className={styles.formGroup}>
                <label>Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  placeholder="Enter task description..."
                  rows={3}
                />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value as any})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Assignees</label>
                {loadingUsers ? (
                  <div>Loading users...</div>
                ) : availableUsers.length === 0 ? (
                  <div>No users available for assignment</div>
                ) : (
                  <div className={styles.assigneeList}>
                    {availableUsers.map(user => (
                      <label key={user.id} className={styles.assigneeOption}>
                        <input
                          type="checkbox"
                          checked={newTask.assignees.includes(user.id)}
                          onChange={() => toggleAssignee(user.id, false)}
                        />
                        <span className={styles.userAvatar}>
                          <Avatar
                            employeeId={user.employee_id}
                            fullName={user.full_name}
                            size="small"
                          />
                        </span>
                        <div className={styles.userInfo}>
                          <span className={styles.userName}>{user.full_name}</span>
                          <span className={styles.userDetails}>
                            {user.employee_id} • {user.base} • {user.rank?.split(' - ')[0] || 'FI'}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowAddTask(false)}
                disabled={savingTask}
              >
                Cancel
              </button>
              <button 
                className={styles.saveButton}
                onClick={handleAddTask}
                disabled={savingTask || !newTask.title.trim()}
              >
                {savingTask ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {showTaskDetail && selectedTask && (
        <div className={styles.modal} onClick={() => setShowTaskDetail(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              {isEditing ? (
                <input
                  className={styles.editTitle}
                  value={editTask?.title || ''}
                  onChange={(e) => setEditTask(prev => prev ? {...prev, title: e.target.value} : null)}
                  placeholder="Enter task title..."
                />
              ) : (
                <h2>{selectedTask.title}</h2>
              )}
              <div className={styles.headerActions}>
                {!isEditing ? (
                  <>
                    <button 
                      className={styles.editButton}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </button>
                    {isAdmin() && (
                      <button 
                        className={styles.deleteButton}
                        onClick={handleDeleteTask}
                        disabled={savingTask}
                        title="Delete Task (Admin Only)"
                      >
                        {savingTask ? 'Deleting...' : 'Delete'}
                      </button>
                    )}
                  </>
                ) : (
                  <div className={styles.editActions}>
                    <button 
                      className={styles.saveButton}
                      onClick={handleSaveEdit}
                      disabled={savingTask}
                    >
                      {savingTask ? 'Saving...' : 'Save'}
                    </button>
                    <button 
                      className={styles.cancelButton}
                      onClick={handleCancelEdit}
                      disabled={savingTask}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowTaskDetail(false)}
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.taskDetailInfo}>
                <div className={styles.taskDetailRow}>
                  <span className={styles.label}>Status:</span>
                  <div className={styles.statusButtons}>
                    {columns.map(column => (
                      <button
                        key={column.id}
                        className={`${styles.statusButton} ${columns.find(col => col.tasks.some(t => t.id === selectedTask.id))?.id === column.id ? styles.active : ''}`}
                        style={{ borderColor: column.color }}
                        onClick={() => updateTaskStatus(selectedTask, column.id)}
                        disabled={isEditing}
                      >
                        {column.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.taskDetailRow}>
                  <span className={styles.label}>Priority:</span>
                  {isEditing ? (
                    <select
                      className={styles.editSelect}
                      value={editTask?.priority || 'medium'}
                      onChange={(e) => setEditTask(prev => prev ? {...prev, priority: e.target.value as any} : null)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  ) : (
                    <span 
                      className={styles.priorityBadge}
                      style={{ backgroundColor: getPriorityColor(selectedTask.priority) }}
                    >
                      {getPriorityLabel(selectedTask.priority)}
                    </span>
                  )}
                </div>

                <div className={styles.taskDetailRow}>
                  <span className={styles.label}>Due Date:</span>
                  {isEditing ? (
                    <input
                      type="date"
                      className={styles.editInput}
                      value={editTask?.due_date || ''}
                      onChange={(e) => setEditTask(prev => prev ? {...prev, due_date: e.target.value} : null)}
                    />
                  ) : (
                    selectedTask.due_date ? (
                      <div className={styles.dueDateDisplay}>
                        <span 
                          className={styles.dueDateBadge}
                          style={{ 
                            backgroundColor: getDueDateStatus(selectedTask.due_date).color 
                          }}
                        >
                          {getDueDateStatus(selectedTask.due_date).text}
                        </span>
                        <span className={styles.dueDateFull}>
                          {new Date(selectedTask.due_date).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    ) : (
                      <span className={styles.noDueDate}>No due date set</span>
                    )
                  )}
                </div>

                <div className={styles.taskDetailRow}>
                  <span className={styles.label}>Assignees:</span>
                  {isEditing ? (
                    loadingUsers ? (
                      <div>Loading users...</div>
                    ) : availableUsers.length === 0 ? (
                      <div>No users available for assignment</div>
                    ) : (
                      <div className={styles.assigneeList}>
                        {availableUsers.map(user => (
                          <label key={user.id} className={styles.assigneeOption}>
                            <input
                              type="checkbox"
                              checked={editTask?.assignees?.includes(user.id) || false}
                              onChange={() => toggleAssignee(user.id, true)}
                            />
                            <span className={styles.userAvatar}>
                              <Avatar
                                employeeId={user.employee_id}
                                fullName={user.full_name}
                                size="small"
                              />
                            </span>
                            <div className={styles.userInfo}>
                              <span className={styles.userName}>{user.full_name}</span>
                              <span className={styles.userDetails}>
                                {user.employee_id} • {user.base} • {user.rank?.split(' - ')[0] || 'FI'}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className={styles.assigneeInfo}>
                      {selectedTask.assigneeNames?.map((name, index) => {
                        const employeeId = selectedTask.assigneeAvatars?.[index] || '';
                        return (
                          <div key={index} className={styles.assigneeItem}>
                            <span className={styles.assigneeAvatar}>
                              <Avatar
                                employeeId={employeeId}
                                fullName={name}
                                size="small"
                              />
                            </span>
                            <span>{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={styles.taskDetailRow}>
                  <span className={styles.label}>Description:</span>
                  {isEditing ? (
                    <textarea
                      className={styles.editTextarea}
                      value={editTask?.description || ''}
                      onChange={(e) => setEditTask(prev => prev ? {...prev, description: e.target.value} : null)}
                      placeholder="Enter task description..."
                      rows={3}
                    />
                  ) : (
                    <p className={styles.description}>{selectedTask.description}</p>
                  )}
                </div>
              </div>

              <div className={styles.commentsSection}>
                <h3>Comments ({selectedTask.comments.length})</h3>
                
                <div className={styles.addComment}>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                    className={styles.commentTextarea}
                    disabled={addingComment}
                  />
                  <div className={styles.commentActions}>
                    <button 
                      className={styles.addCommentButton}
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addingComment}
                    >
                      {addingComment ? 'Adding...' : 'Add Comment'}
                    </button>
                  </div>
                </div>

                <div className={styles.commentsList}>
                  {selectedTask.comments.map(comment => (
                    <div key={comment.id} className={styles.comment}>
                      <div className={styles.commentHeader}>
                        <strong>{comment.author_name}</strong>
                        <span className={styles.commentDate}>
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className={styles.commentText}>{comment.comment_text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskManager;