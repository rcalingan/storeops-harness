import type { AuthToken, User } from './staff.types';

export interface StaffFilter {
  storeId?: string;
  regionId?: string;
}

export interface StaffRepository {
  createUser(user: User): Promise<User>;
  updateUser(user: User): Promise<User>;
  findUserById(id: string): Promise<User | undefined>;
  findUserByEmail(email: string): Promise<User | undefined>;
  listUsers(filter?: StaffFilter): Promise<User[]>;
  saveToken(token: AuthToken): Promise<AuthToken>;
  findToken(token: string): Promise<AuthToken | undefined>;
}

/** In-memory store. Returns copies so callers can never mutate persisted state by reference. */
export class InMemoryStaffRepository implements StaffRepository {
  private readonly users = new Map<string, User>();
  private readonly tokens = new Map<string, AuthToken>();

  createUser(user: User): Promise<User> {
    this.users.set(user.id, { ...user });
    return Promise.resolve({ ...user });
  }

  updateUser(user: User): Promise<User> {
    this.users.set(user.id, { ...user });
    return Promise.resolve({ ...user });
  }

  findUserById(id: string): Promise<User | undefined> {
    const user = this.users.get(id);
    return Promise.resolve(user && { ...user });
  }

  findUserByEmail(email: string): Promise<User | undefined> {
    const needle = email.toLowerCase();
    const user = [...this.users.values()].find((u) => u.email.toLowerCase() === needle);
    return Promise.resolve(user && { ...user });
  }

  listUsers(filter: StaffFilter = {}): Promise<User[]> {
    const users = [...this.users.values()].filter(
      (u) =>
        (filter.storeId === undefined || u.storeId === filter.storeId) &&
        (filter.regionId === undefined || u.regionId === filter.regionId),
    );
    return Promise.resolve(users.map((u) => ({ ...u })));
  }

  saveToken(token: AuthToken): Promise<AuthToken> {
    this.tokens.set(token.token, { ...token });
    return Promise.resolve({ ...token });
  }

  findToken(token: string): Promise<AuthToken | undefined> {
    const found = this.tokens.get(token);
    return Promise.resolve(found && { ...found });
  }
}
