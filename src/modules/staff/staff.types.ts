export const STAFF_ROLES = ['REGIONAL_MANAGER', 'STORE_MANAGER', 'DEPARTMENT_LEAD', 'ASSOCIATE'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Persisted staff record. `passwordHash` never leaves the staff module. */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  storeId: string;
  regionId: string;
  createdAt: string;
  updatedAt: string;
}

/** Public, read-only view of a staff member — the shape other modules receive. */
export type UserProfile = Omit<User, 'passwordHash'>;

export interface AuthToken {
  token: string;
  userId: string;
  issuedAt: string;
  expiresAt: string;
}

/** Identity attached to an authenticated request. */
export interface AuthUser {
  id: string;
  role: StaffRole;
  storeId: string;
  regionId: string;
}

export interface CreateStaffInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  storeId: string;
  regionId: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: UserProfile;
}
