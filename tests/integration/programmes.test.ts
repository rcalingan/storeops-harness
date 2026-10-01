import request from 'supertest';
import { createProgramme, setupTestApp, type TestContext } from '../helpers/test-app';

describe('programmes module', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await setupTestApp();
  });

  describe('POST /api/programmes', () => {
    it('creates a programme with the creator as STORE_MANAGER member', async () => {
      const res = await request(ctx.app)
        .post('/api/programmes')
        .set(ctx.users.manager.auth)
        .send({ name: 'Winter Refit', description: 'Fixture upgrade' })
        .expect(201);
      expect(res.body).toMatchObject({
        name: 'Winter Refit',
        storeId: 'store-001',
        status: 'ACTIVE',
        ownerId: ctx.users.manager.profile.id,
        members: [{ userId: ctx.users.manager.profile.id, role: 'STORE_MANAGER' }],
      });
    });

    it('forbids associates', async () => {
      await request(ctx.app).post('/api/programmes').set(ctx.users.associate.auth).send({ name: 'X' }).expect(403);
    });

    it('validates the body', async () => {
      await request(ctx.app).post('/api/programmes').set(ctx.users.manager.auth).send({ name: '' }).expect(400);
    });
  });

  describe('GET /api/programmes', () => {
    it('lists only programmes for the caller store', async () => {
      await createProgramme(ctx);
      const mine = await request(ctx.app).get('/api/programmes').set(ctx.users.associate.auth).expect(200);
      expect(mine.body).toHaveLength(1);
      const other = await request(ctx.app).get('/api/programmes').set(ctx.users.otherStore.auth).expect(200);
      expect(other.body).toHaveLength(0);
    });
  });

  describe('POST /api/programmes/:id/members', () => {
    it('adds a member and raises an alert via the event bus', async () => {
      const programme = await createProgramme(ctx);
      const res = await request(ctx.app)
        .post(`/api/programmes/${programme.id}/members`)
        .set(ctx.users.manager.auth)
        .send({ userId: ctx.users.associate.profile.id, role: 'ASSOCIATE' })
        .expect(201);
      expect(res.body.members).toHaveLength(2);

      const alerts = await request(ctx.app).get('/api/alerts').set(ctx.users.associate.auth).expect(200);
      expect(alerts.body).toEqual([
        expect.objectContaining({ type: 'PROGRAMME_MEMBER_ADDED', metadata: { programmeId: programme.id } }),
      ]);
    });

    it('rejects duplicate membership', async () => {
      const programme = await createProgramme(ctx);
      const body = { userId: ctx.users.lead.profile.id, role: 'DEPARTMENT_LEAD' };
      await request(ctx.app).post(`/api/programmes/${programme.id}/members`).set(ctx.users.manager.auth).send(body).expect(201);
      await request(ctx.app).post(`/api/programmes/${programme.id}/members`).set(ctx.users.manager.auth).send(body).expect(409);
    });

    it('rejects staff from another store', async () => {
      const programme = await createProgramme(ctx);
      await request(ctx.app)
        .post(`/api/programmes/${programme.id}/members`)
        .set(ctx.users.manager.auth)
        .send({ userId: ctx.users.otherStore.profile.id, role: 'ASSOCIATE' })
        .expect(400);
    });

    it('forbids non-managers of the programme', async () => {
      const programme = await createProgramme(ctx);
      await request(ctx.app)
        .post(`/api/programmes/${programme.id}/members`)
        .set(ctx.users.lead.auth)
        .send({ userId: ctx.users.associate.profile.id, role: 'ASSOCIATE' })
        .expect(403);
    });

    it('returns 404 for unknown programmes and staff', async () => {
      await request(ctx.app)
        .post('/api/programmes/missing/members')
        .set(ctx.users.manager.auth)
        .send({ userId: ctx.users.associate.profile.id, role: 'ASSOCIATE' })
        .expect(404);
      const programme = await createProgramme(ctx);
      await request(ctx.app)
        .post(`/api/programmes/${programme.id}/members`)
        .set(ctx.users.manager.auth)
        .send({ userId: 'ghost', role: 'ASSOCIATE' })
        .expect(404);
    });

    it('rejects adding members to a closed programme', async () => {
      const programme = await createProgramme(ctx);
      await ctx.container.programmesService.close(ctx.users.manager.profile, programme.id);
      await request(ctx.app)
        .post(`/api/programmes/${programme.id}/members`)
        .set(ctx.users.regional.auth)
        .send({ userId: ctx.users.associate.profile.id, role: 'ASSOCIATE' })
        .expect(409);
    });
  });

  describe('close (service)', () => {
    it('rejects closing twice', async () => {
      const programme = await createProgramme(ctx);
      const actor = ctx.users.manager.profile;
      await ctx.container.programmesService.close(actor, programme.id);
      await expect(ctx.container.programmesService.close(actor, programme.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    });
  });
});
