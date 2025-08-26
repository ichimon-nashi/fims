// src/lib/taskDatabase.ts
import { createClient } from "@/utils/supabase/server";

// Define a specific User interface for task management
export interface TaskUser {
	id: string;
	employee_id: string;
	full_name: string;
	rank: string;
	base: string;
	email: string;
	authentication_level: number;
}

// Task interfaces
export interface Task {
	id: string;
	title: string;
	description: string;
	priority: "low" | "medium" | "high";
	status: "backlog" | "in-progress" | "review" | "complete";
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

export interface TaskComment {
	id: string;
	task_id: string;
	comment_text: string;
	author_id?: string;
	author_name: string;
	created_at: string;
}

export interface TaskFilters {
	year?: number;
	status?: string;
	priority?: string;
	assignee?: string;
	created_by?: string;
}

// Get all available users for assignment (from your existing users table)
export const getAvailableUsers = async (): Promise<TaskUser[]> => {
	try {
		console.log("Getting available users for task assignment");

		const supabase = await createClient();

		const { data: users, error } = await supabase
			.from("users")
			.select(
				`
        id,
        employee_id,
        full_name,
        rank,
        base,
        email,
        authentication_level
      `
			)
			.order("full_name", { ascending: true });

		if (error) {
			console.error("Supabase error getting users:", error);
			throw new Error(`Failed to fetch users: ${error.message}`);
		}

		console.log("Found", users?.length || 0, "available users");
		return users || [];
	} catch (error) {
		console.error("Error getting available users:", error);
		throw new Error("Failed to fetch available users from database");
	}
};

// Get all tasks with filters
export const getTasks = async (filters: TaskFilters = {}): Promise<Task[]> => {
	try {
		console.log("Getting tasks with filters:", filters);

		const supabase = await createClient();

		let query = supabase.from("tasks").select(`
        *,
        task_comments (
          id,
          comment_text,
          author_id,
          author_name,
          created_at
        )
      `);

		// Apply filters
		if (filters.year) {
			query = query.eq("year", filters.year);
		}

		if (filters.status) {
			query = query.eq("status", filters.status);
		}

		if (filters.priority) {
			query = query.eq("priority", filters.priority);
		}

		if (filters.assignee) {
			query = query.contains("assignees", [filters.assignee]);
		}

		if (filters.created_by) {
			query = query.eq("created_by", filters.created_by);
		}

		query = query.order("created_at", { ascending: false });

		const { data: tasks, error } = await query;

		if (error) {
			console.error("Supabase error getting tasks:", error);
			throw new Error(`Failed to fetch tasks: ${error.message}`);
		}

		// Get all users to map assignee IDs to names and avatars
		const users = await getAvailableUsers();
		const userMap = new Map(users.map((user) => [user.id, user]));

		// Transform the data to match your interface
		const transformedTasks: Task[] = (tasks || []).map((task) => ({
			id: task.id,
			title: task.title,
			description: task.description || "",
			priority: task.priority,
			status: task.status,
			assignees: task.assignees || [],
			assigneeNames: (task.assignees || []).map(
				(id: string) => userMap.get(id)?.full_name || "Unknown User"
			),
			assigneeAvatars: (task.assignees || []).map((id: string) =>
				getAvatarForUser(userMap.get(id))
			),
			due_date: task.due_date,
			created_by: task.created_by,
			created_at: task.created_at,
			updated_at: task.updated_at,
			year: task.year,
			comments: task.task_comments || [],
		}));

		console.log("Found", transformedTasks.length, "tasks");
		return transformedTasks;
	} catch (error) {
		console.error("Error getting tasks:", error);
		throw new Error("Failed to fetch tasks from database");
	}
};

// Helper function to generate avatar for user
const getAvatarForUser = (user?: TaskUser): string => {
	if (!user) return "";

	// Return the employee_id for avatar purposes
	return user.employee_id || "";
};

// Create a new task
export const createTask = async (taskData: {
	title: string;
	description: string;
	priority: "low" | "medium" | "high";
	status: "backlog" | "in-progress" | "review" | "complete";
	assignees: string[];
	due_date?: string;
	created_by: string;
}): Promise<Task> => {
	try {
		console.log("Creating new task:", taskData.title);

		const supabase = await createClient();

		const { data, error } = await supabase
			.from("tasks")
			.insert([
				{
					...taskData,
					year: new Date().getFullYear(),
				},
			])
			.select(
				`
        *,
        task_comments (
          id,
          comment_text,
          author_id,
          author_name,
          created_at
        )
      `
			)
			.single();

		if (error) {
			console.error("Error creating task:", error);
			throw error;
		}

		// Get user data for assignees
		const users = await getAvailableUsers();
		const userMap = new Map(users.map((user) => [user.id, user]));

		const transformedTask: Task = {
			id: data.id,
			title: data.title,
			description: data.description || "",
			priority: data.priority,
			status: data.status,
			assignees: data.assignees || [],
			assigneeNames: (data.assignees || []).map(
				(id: string) => userMap.get(id)?.full_name || "Unknown User"
			),
			assigneeAvatars: (data.assignees || []).map((id: string) =>
				getAvatarForUser(userMap.get(id))
			),
			due_date: data.due_date,
			created_by: data.created_by,
			created_at: data.created_at,
			updated_at: data.updated_at,
			year: data.year,
			comments: data.task_comments || [],
		};

		console.log("Task created successfully:", transformedTask.id);
		return transformedTask;
	} catch (error) {
		console.error("Error creating task:", error);
		throw new Error("Failed to create task");
	}
};

// Update a task
export const updateTask = async (
	taskId: string,
	updates: Partial<{
		title: string;
		description: string;
		priority: "low" | "medium" | "high";
		status: "backlog" | "in-progress" | "review" | "complete";
		assignees: string[];
		due_date: string;
	}>
): Promise<Task> => {
	try {
		console.log("Updating task:", taskId, updates);

		const supabase = await createClient();

		const { data, error } = await supabase
			.from("tasks")
			.update(updates)
			.eq("id", taskId)
			.select(
				`
        *,
        task_comments (
          id,
          comment_text,
          author_id,
          author_name,
          created_at
        )
      `
			)
			.single();

		if (error) {
			console.error("Error updating task:", error);
			throw error;
		}

		// Get user data for assignees
		const users = await getAvailableUsers();
		const userMap = new Map(users.map((user) => [user.id, user]));

		const transformedTask: Task = {
			id: data.id,
			title: data.title,
			description: data.description || "",
			priority: data.priority,
			status: data.status,
			assignees: data.assignees || [],
			assigneeNames: (data.assignees || []).map(
				(id: string) => userMap.get(id)?.full_name || "Unknown User"
			),
			assigneeAvatars: (data.assignees || []).map((id: string) =>
				getAvatarForUser(userMap.get(id))
			),
			due_date: data.due_date,
			created_by: data.created_by,
			created_at: data.created_at,
			updated_at: data.updated_at,
			year: data.year,
			comments: data.task_comments || [],
		};

		console.log("Task updated successfully:", transformedTask.id);
		return transformedTask;
	} catch (error) {
		console.error("Error updating task:", error);
		throw new Error("Failed to update task");
	}
};

// Delete a task
export const deleteTask = async (taskId: string): Promise<void> => {
	try {
		console.log("Deleting task:", taskId);

		const supabase = await createClient();

		const { error } = await supabase
			.from("tasks")
			.delete()
			.eq("id", taskId);

		if (error) {
			console.error("Error deleting task:", error);
			throw error;
		}

		console.log("Task deleted successfully:", taskId);
	} catch (error) {
		console.error("Error deleting task:", error);
		throw new Error("Failed to delete task");
	}
};

// Add comment to task
export const addTaskComment = async (commentData: {
	task_id: string;
	comment_text: string;
	author_id: string;
	author_name: string;
}): Promise<TaskComment> => {
	try {
		console.log("Adding comment to task:", commentData.task_id);

		const supabase = await createClient();

		const { data, error } = await supabase
			.from("task_comments")
			.insert([commentData])
			.select()
			.single();

		if (error) {
			console.error("Error adding comment:", error);
			throw error;
		}

		const comment: TaskComment = {
			id: data.id,
			task_id: data.task_id,
			comment_text: data.comment_text,
			author_id: data.author_id,
			author_name: data.author_name,
			created_at: data.created_at,
		};

		console.log("Comment added successfully:", comment.id);
		return comment;
	} catch (error) {
		console.error("Error adding comment:", error);
		throw new Error("Failed to add comment");
	}
};

// Get task comments
export const getTaskComments = async (
	taskId: string
): Promise<TaskComment[]> => {
	try {
		console.log("Getting comments for task:", taskId);

		const supabase = await createClient();

		const { data, error } = await supabase
			.from("task_comments")
			.select("*")
			.eq("task_id", taskId)
			.order("created_at", { ascending: true });

		if (error) {
			console.error("Error getting comments:", error);
			throw error;
		}

		console.log("Found", data?.length || 0, "comments");
		return data || [];
	} catch (error) {
		console.error("Error getting comments:", error);
		throw new Error("Failed to fetch comments");
	}
};

// Get task by ID
export const getTaskById = async (taskId: string): Promise<Task | null> => {
	try {
		console.log("Getting task by ID:", taskId);

		const supabase = await createClient();

		const { data, error } = await supabase
			.from("tasks")
			.select(
				`
        *,
        task_comments (
          id,
          comment_text,
          author_id,
          author_name,
          created_at
        )
      `
			)
			.eq("id", taskId)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				console.log("Task not found:", taskId);
				return null;
			}
			console.error("Error getting task:", error);
			throw error;
		}

		// Get user data for assignees
		const users = await getAvailableUsers();
		const userMap = new Map(users.map((user) => [user.id, user]));

		const transformedTask: Task = {
			id: data.id,
			title: data.title,
			description: data.description || "",
			priority: data.priority,
			status: data.status,
			assignees: data.assignees || [],
			assigneeNames: (data.assignees || []).map(
				(id: string) => userMap.get(id)?.full_name || "Unknown User"
			),
			assigneeAvatars: (data.assignees || []).map((id: string) =>
				getAvatarForUser(userMap.get(id))
			),
			due_date: data.due_date,
			created_by: data.created_by,
			created_at: data.created_at,
			updated_at: data.updated_at,
			year: data.year,
			comments: data.task_comments || [],
		};

		console.log("Task found:", transformedTask.id);
		return transformedTask;
	} catch (error) {
		console.error("Error getting task by ID:", error);
		throw new Error("Failed to fetch task");
	}
};