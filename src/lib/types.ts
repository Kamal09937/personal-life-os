export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue';
export type Recurring = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type GoalStatus = 'active' | 'completed' | 'paused';

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  tags: string;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  due_time: string | null;
  recurring: Recurring;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface EventItem {
  id: string;
  user_id: string;
  title: string;
  description: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  reminder_time: string | null;
  recurring: Recurring;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string;
  start_date: string | null;
  target_date: string | null;
  progress: number;
  priority: Priority;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  category: string;
  tags: string;
  expiry_date: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  description: string;
  payment_method: string;
  expense_date: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  description: string;
  reminder_date: string;
  reminder_time: string | null;
  recurring: Recurring;
  completed: boolean;
  created_at: string;
}

export interface Memory {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type ViewKey =
  | 'dashboard'
  | 'notes'
  | 'tasks'
  | 'calendar'
  | 'goals'
  | 'documents'
  | 'expenses'
  | 'reminders'
  | 'memory'
  | 'search'
  | 'ai'
  | 'settings';
