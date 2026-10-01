import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { systemClock, type Clock } from '../../shared/clock';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/errors';
import type { StaffFilter, StaffRepository } from './staff.repository';
import type {
  AuthUser,
  CreateStaffInput,
  LoginResult,
  StaffRole,
  UpdateProfileInput,
  User,
  UserProfile,
} from './staff.types';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

/** Which roles each role is allowed to onboard. */
const CAN_CREATE: Record<StaffRole, readonly StaffRole[]> = {
  REGIONAL_MANAGER: ['REGIONAL_MANAGER', 'STORE_MANAGER', 'DEPARTMENT_LEAD', 'ASSOCIATE'],
  STORE_MANAGER: ['DEPARTMENT_LEAD', 'ASSOCIATE'],
  DEPARTMENT_LEAD: [],
  ASSOCIATE: [],
};

// Stub credential handling — adequate for a reference codebase, not for production.
const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
};

const verifyPassword = (password: string, stored: string): boolean => {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
};

const toProfile = ({ passwordHash: _omit, ...profile }: User): UserProfile => profile;

/**
 * Staff registration, authentication and profile management.
 * Other modules use this service for read-only staff lookups only.
 */
export class StaffService {
  constructor(
    private readonly repository: StaffRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  /** Creates a staff member. `actor` is omitted only for system bootstrap (seeding). */
  async createStaff(input: CreateStaffInput, actor?: AuthUser): Promise<UserProfile> {
    if (actor) {
      if (!CAN_CREATE[actor.role].includes(input.role)) {
        throw new ForbiddenError(`${actor.role} cannot create ${input.role} accounts`);
      }
      if (actor.role === 'STORE_MANAGER' && input.storeId !== actor.storeId) {
        throw new ForbiddenError('Store managers can only create staff for their own store');
      }
    }
    if (await this.repository.findUserByEmail(input.email)) {
      throw new ConflictError(`A staff member with email '${input.email}' already exists`);
    }
    const now = this.clock().toISOString();
    const { password, ...rest } = input;
    const user = await this.repository.createUser({
      ...rest,
      id: randomUUID(),
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
    });
    return toProfile(user);
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.repository.findUserByEmail(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedError('Invalid email or password');
    }
    const issuedAt = this.clock();
    const token = await this.repository.saveToken({
      token: randomBytes(24).toString('hex'),
      userId: user.id,
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + TOKEN_TTL_MS).toISOString(),
    });
    return { token: token.token, expiresAt: token.expiresAt, user: toProfile(user) };
  }

  /** Resolves a bearer token to the identity it represents. */
  async authenticate(token: string): Promise<AuthUser> {
    const stored = await this.repository.findToken(token);
    if (!stored || new Date(stored.expiresAt) <= this.clock()) {
      throw new UnauthorizedError('Invalid or expired token');
    }
    const user = await this.repository.findUserById(stored.userId);
    if (!user) throw new UnauthorizedError('Invalid or expired token');
    return { id: user.id, role: user.role, storeId: user.storeId, regionId: user.regionId };
  }

  async getById(id: string): Promise<UserProfile> {
    const user = await this.repository.findUserById(id);
    if (!user) throw new NotFoundError('Staff member', id);
    return toProfile(user);
  }

  async list(filter: StaffFilter = {}): Promise<UserProfile[]> {
    const users = await this.repository.listUsers(filter);
    return users.map(toProfile);
  }

  async updateProfile(id: string, patch: UpdateProfileInput): Promise<UserProfile> {
    const user = await this.repository.findUserById(id);
    if (!user) throw new NotFoundError('Staff member', id);
    const updated = await this.repository.updateUser({
      ...user,
      ...patch,
      updatedAt: this.clock().toISOString(),
    });
    return toProfile(updated);
  }
}
