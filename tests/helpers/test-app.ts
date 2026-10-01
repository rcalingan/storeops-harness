import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { buildContainer, type Container, type ContainerOptions } from '../../src/container';
import type { CreateStaffInput, StaffRole, UserProfile } from '../../src/modules/staff/staff.types';

export const PASSWORD = 'Password123!';

export interface TestUser {
  profile: UserProfile;
  token: string;
  auth: { Authorization: string };
}

export interface TestContext {
  app: Express;
  container: Container;
  users: Record<'regional' | 'manager' | 'lead' | 'associate' | 'otherStore', TestUser>;
  createUser(role: StaffRole, overrides?: Partial<CreateStaffInput>): Promise<TestUser>;
}

let counter = 0;

export const setupTestApp = async (options: ContainerOptions = {}): Promise<TestContext> => {
  const container = buildContainer(options);
  const app = createApp(container);

  const createUser = async (role: StaffRole, overrides: Partial<CreateStaffInput> = {}): Promise<TestUser> => {
    counter += 1;
    const input: CreateStaffInput = {
      email: `user${counter}@test.local`,
      password: PASSWORD,
      firstName: 'Test',
      lastName: `User${counter}`,
      role,
      storeId: 'store-001',
      regionId: 'region-north',
      ...overrides,
    };
    const profile = await container.staffService.createStaff(input);
    const { token } = await container.staffService.login(input.email, input.password);
    return { profile, token, auth: { Authorization: `Bearer ${token}` } };
  };

  const users = {
    regional: await createUser('REGIONAL_MANAGER'),
    manager: await createUser('STORE_MANAGER'),
    lead: await createUser('DEPARTMENT_LEAD'),
    associate: await createUser('ASSOCIATE'),
    otherStore: await createUser('ASSOCIATE', { storeId: 'store-002' }),
  };

  return { app, container, users, createUser };
};

/** Creates a programme owned by the given manager via the HTTP API. */
export const createProgramme = async (ctx: TestContext, owner: TestUser = ctx.users.manager, name = 'Autumn Rollout') => {
  const res = await request(ctx.app).post('/api/programmes').set(owner.auth).send({ name }).expect(201);
  return res.body as { id: string; name: string; storeId: string };
};
