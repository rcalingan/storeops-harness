export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_CATEGORIES = ['RESTOCKING', 'PLANOGRAM', 'AUDIT', 'COMPLIANCE', 'GENERAL'] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/** An operational activity — restocking run, planogram reset, compliance check, etc. */
export interface Task {
  id: string;
  title: string;
  description: string;
  programmeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  assigneeId: string | null;
  createdBy: string;
  dueDate: string | null;
  slaBreachedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityFilter {
  programmeId?: string;
  status?: TaskStatus;
}

export interface CreateActivityInput {
  title: string;
  description?: string;
  programmeId: string;
  priority?: TaskPriority;
  category?: TaskCategory;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export interface UpdateActivityInput {
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  assigneeId?: string | null;
}
