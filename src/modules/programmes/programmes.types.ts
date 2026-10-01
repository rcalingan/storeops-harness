export const PROJECT_ROLES = ['STORE_MANAGER', 'DEPARTMENT_LEAD', 'ASSOCIATE'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROGRAMME_STATUSES = ['ACTIVE', 'CLOSED'] as const;
export type ProgrammeStatus = (typeof PROGRAMME_STATUSES)[number];

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
  addedAt: string;
}

/** A store programme — seasonal rollout, compliance drive, store refit, etc. */
export interface Project {
  id: string;
  name: string;
  description: string;
  storeId: string;
  status: ProgrammeStatus;
  ownerId: string;
  members: ProjectMember[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface CreateProgrammeInput {
  name: string;
  description?: string;
}

export interface AddMemberInput {
  userId: string;
  role: ProjectRole;
}
