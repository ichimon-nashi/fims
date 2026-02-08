// src/hooks/useTasks.ts - UPDATED: Filter users with Task Manager permissions
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createServiceClient } from '@/utils/supabase/service-client';
import { Task, TaskComment, Column, AvailableUser } from '@/lib/task.types';
import { sortInstructors } from '@/utils/taskHelpers';

export const useTasks = (selectedYear: number) => {
  const { user, token } = useAuth();
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);
  
  // Memoize initial columns to maintain stable reference
  const initialColumns: Column[] = useMemo(() => [
    { id: 'backlog', title: '待辦 Open', color: '#3B82F6', count: 0, tasks: [] },
    { id: 'in-progress', title: '進行中 In Progress', color: '#907ad6', count: 0, tasks: [] },
    { id: 'complete', title: '完成 Complete', color: '#10B981', count: 0, tasks: [] },
    { id: 'review', title: '暫緩 On Hold', color: '#ef476f', count: 0, tasks: [] },
  ], []);
  
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  // Load users with Task Manager access
  useEffect(() => {
    const loadUsers = async () => {
      if (!user || !token) return;
      
      try {
        setLoadingUsers(true);
        
        let supabase;
        try {
          supabase = createServiceClient();
        } catch (envError) {
          console.error('Service client creation failed:', envError);
          setAvailableUsers([]);
          setLoadingUsers(false);
          return;
        }

        // Fetch all users with their app permissions
        const { data: allUsers, error } = await supabase
          .from('users')
          .select('id, employee_id, full_name, rank, base, email, authentication_level, app_permissions')
          .order('full_name', { ascending: true });

        if (error) {
          console.error('Error loading users:', error);
          throw error;
        }

        // Filter users who have Task Manager access based ONLY on app_permissions
        const usersWithTaskAccess = (allUsers || []).filter((u) => {
          // Exclude users with "test" or "admin" rank (case-insensitive)
          const rankLower = (u.rank || '').toLowerCase();
          if (rankLower === 'test' || rankLower === 'admin') {
            return false;
          }
          
          // ONLY check app_permissions.tasks.access - no fallbacks
          return u.app_permissions?.tasks?.access === true;
        });
        
        const sortedInstructors = sortInstructors(usersWithTaskAccess);
        setAvailableUsers(sortedInstructors);
        
        console.log(`Loaded ${sortedInstructors.length} users with explicit Task Manager access (app_permissions.tasks.access = true)`);
      } catch (error) {
        console.error('Error loading users:', error);
        setAvailableUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (user && token) {
      loadUsers();
    }
  }, [user, token]);

  // Load tasks with proper dependencies
  const loadTasks = useCallback(async () => {
    if (!user || !token || loadingUsers) return;
    
    try {
      setLoadingTasks(true);
      
      let supabase;
      try {
        supabase = createServiceClient();
      } catch (envError) {
        console.error('Service client creation failed for tasks:', envError);
        return;
      }
      
      // Load tasks that span or touch the selected year
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*, sort_order')
        .or(`year.eq.${selectedYear},and(start_date.gte.${selectedYear}-01-01,start_date.lte.${selectedYear}-12-31),and(due_date.gte.${selectedYear}-01-01,due_date.lte.${selectedYear}-12-31),and(start_date.lt.${selectedYear}-01-01,due_date.gt.${selectedYear}-01-01)`)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.log('Error loading tasks:', error.message);
        const emptyColumns = initialColumns.map(column => ({
          ...column,
          tasks: [],
          count: 0
        }));
        setColumns(emptyColumns);
        return;
      }

      if (tasks && tasks.length > 0) {
        const taskIds = tasks.map(task => task.id);
        const { data: comments } = await supabase
          .from('task_comments')
          .select('*')
          .in('task_id', taskIds)
          .order('created_at', { ascending: true });

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

        const transformedTasks: Task[] = tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description || '',
          priority: task.priority,
          status: task.status,
          task_type: task.task_type === 'subtask' ? 'subtask' : 'main',
          parent_id: task.parent_id || undefined,
          start_date: task.start_date || undefined,
          actual_hours: task.actual_hours || undefined,
          progress: task.progress || 0,
          dependencies: task.dependencies || [],
          assignees: task.assignees || [],
          assigneeNames: (task.assignees || []).map((id: string) => 
            availableUsers.find(u => u.id === id)?.full_name || 'Unknown User'
          ),
          assigneeAvatars: (task.assignees || []).map((id: string) => {
            const user = availableUsers.find(u => u.id === id);
            return user ? user.employee_id : '';
          }),
          due_date: task.due_date,
          created_by: task.created_by,
          created_at: task.created_at,
          updated_at: task.updated_at,
          year: task.year,
          sort_order: task.sort_order,
          comments: commentsByTask.get(task.id) || []
        }));

        const newColumns = initialColumns.map(column => ({
          ...column,
          tasks: transformedTasks.filter(task => task.status === column.id),
          count: transformedTasks.filter(task => task.status === column.id && !task.parent_id).length
        }));

        setColumns(newColumns);
      } else {
        const emptyColumns = initialColumns.map(column => ({
          ...column,
          tasks: [],
          count: 0
        }));
        setColumns(emptyColumns);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      const emptyColumns = initialColumns.map(column => ({
        ...column,
        tasks: [],
        count: 0
      }));
      setColumns(emptyColumns);
    } finally {
      setLoadingTasks(false);
    }
  }, [user, token, selectedYear, loadingUsers, availableUsers, initialColumns]);

  // Load tasks with cross-year support
  useEffect(() => {
    if (user && token && !loadingUsers && availableUsers.length >= 0) {
      loadTasks();
    }
  }, [user, token, selectedYear, loadingUsers, availableUsers, loadTasks]);

  // Expose loadTasks function for external refresh calls
  const refreshTasks = useCallback(() => {
    loadTasks();
  }, [loadTasks]);

  return {
    availableUsers,
    loadingUsers,
    loadingTasks,
    columns,
    setColumns,
    refreshTasks
  };
};