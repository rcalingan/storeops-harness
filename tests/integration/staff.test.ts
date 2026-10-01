import request from 'supertest';
import { PASSWORD, setupTestApp, type TestContext } from '../helpers/test-app';

describe('staff module', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await setupTestApp();
  });

  describe('POST /api/staff/login', () => {
    it('issues a token for valid credentials', async () => {
      const res = await request(ctx.app)
        .post('/api/staff/login')
        .send({ email: ctx.users.manager.profile.email, password: PASSWORD })
        .expect(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user.id).toBe(ctx.users.manager.profile.id);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects a wrong password', async () => {
      await request(ctx.app)
        .post('/api/staff/login')
        .send({ email: ctx.users.manager.profile.email, password: 'wrong' })
        .expect(401);
    });

    it('validates the body', async () => {
      const res = await request(ctx.app).post('/api/staff/login').send({ email: 'not-an-email' }).expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET/PATCH /api/staff/me', () => {
    it('returns and updates the caller profile', async () => {
      const me = await request(ctx.app).get('/api/staff/me').set(ctx.users.lead.auth).expect(200);
      expect(me.body.role).toBe('DEPARTMENT_LEAD');

      const updated = await request(ctx.app)
        .patch('/api/staff/me')
        .set(ctx.users.lead.auth)
        .send({ firstName: 'Dana' })
        .expect(200);
      expect(updated.body.firstName).toBe('Dana');
    });
  });

  describe('POST /api/staff', () => {
    const newStaff = (overrides: Record<string, string> = {}) => ({
      email: `new-${Math.random().toString(36).slice(2)}@test.local`,
      password: PASSWORD,
      firstName: 'New',
      lastName: 'Starter',
      role: 'ASSOCIATE',
      storeId: 'store-001',
      regionId: 'region-north',
      ...overrides,
    });

    it('lets a store manager onboard an associate for their store', async () => {
      const res = await request(ctx.app).post('/api/staff').set(ctx.users.manager.auth).send(newStaff()).expect(201);
      expect(res.body.role).toBe('ASSOCIATE');
    });

    it('forbids a store manager creating staff for another store', async () => {
      await request(ctx.app)
        .post('/api/staff')
        .set(ctx.users.manager.auth)
        .send(newStaff({ storeId: 'store-999' }))
        .expect(403);
    });

    it('forbids associates from creating staff', async () => {
      await request(ctx.app).post('/api/staff').set(ctx.users.associate.auth).send(newStaff()).expect(403);
    });

    it('rejects duplicate emails', async () => {
      const res = await request(ctx.app)
        .post('/api/staff')
        .set(ctx.users.regional.auth)
        .send(newStaff({ email: ctx.users.lead.profile.email }))
        .expect(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  it('rejects expired tokens', async () => {
    let now = new Date('2026-01-01T00:00:00Z');
    const timed = await setupTestApp({ clock: () => now });
    await request(timed.app).get('/api/staff/me').set(timed.users.lead.auth).expect(200);
    now = new Date('2026-01-02T00:00:00Z');
    await request(timed.app).get('/api/staff/me').set(timed.users.lead.auth).expect(401);
  });
});
