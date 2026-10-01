import request from 'supertest';
import { createProgramme, setupTestApp, type TestContext } from '../helpers/test-app';

describe('activities module', () => {
  let ctx: TestContext;
  let programmeId: string;

  beforeEach(async () => {
    ctx = await setupTestApp();
    programmeId = (await createProgramme(ctx)).id;
  });

  const createActivity = async (body: Record<string, unknown> = {}, user = ctx.users.lead) => {
    const res = await request(ctx.app)
      .post('/api/activities')
      .set(user.auth)
      .send({ title: 'Restock aisle 4', programmeId, category: 'RESTOCKING', ...body })
      .expect(201);
    return res.body as { id: string; status: string; assigneeId: string | null };
  };

  describe('POST /api/activities', () => {
    it('creates an activity with defaults', async () => {
      const res = await request(ctx.app)
        .post('/api/activities')
        .set(ctx.users.lead.auth)
        .send({ title: 'Planogram reset', programmeId })
        .expect(201);
      expect(res.body).toMatchObject({
        title: 'Planogram reset',
        status: 'TODO',
        priority: 'MEDIUM',
        category: 'GENERAL',
        assigneeId: null,
        createdBy: ctx.users.lead.profile.id,
      });
    });

    it('validates enums', async () => {
      const res = await request(ctx.app)
        .post('/api/activities')
        .set(ctx.users.lead.auth)
        .send({ title: 'X', programmeId, priority: 'URGENT' })
        .expect(400);
      expect(res.body.error.details[0].path).toBe('priority');
    });

    it('returns 404 for an unknown programme or assignee', async () => {
      await request(ctx.app).post('/api/activities').set(ctx.users.lead.auth).send({ title: 'X', programmeId: 'nope' }).expect(404);
      await request(ctx.app)
        .post('/api/activities')
        .set(ctx.users.lead.auth)
        .send({ title: 'X', programmeId, assigneeId: 'ghost' })
        .expect(404);
    });

    it('alerts the assignee via the event bus', async () => {
      await createActivity({ assigneeId: ctx.users.associate.profile.id });
      const alerts = await request(ctx.app).get('/api/alerts').set(ctx.users.associate.auth).expect(200);
      expect(alerts.body).toEqual([expect.objectContaining({ type: 'TASK_ASSIGNED', status: 'UNREAD' })]);
    });
  });

  describe('GET /api/activities', () => {
    it('filters by programme and status', async () => {
      const otherProgramme = (await createProgramme(ctx, ctx.users.manager, 'Other')).id;
      const a = await createActivity();
      await createActivity({ programmeId: otherProgramme });
      await request(ctx.app).patch(`/api/activities/${a.id}`).set(ctx.users.lead.auth).send({ status: 'DONE' }).expect(200);

      const all = await request(ctx.app).get('/api/activities').set(ctx.users.lead.auth).expect(200);
      expect(all.body).toHaveLength(2);
      const byProgramme = await request(ctx.app).get(`/api/activities?programmeId=${programmeId}`).set(ctx.users.lead.auth).expect(200);
      expect(byProgramme.body).toHaveLength(1);
      const done = await request(ctx.app).get('/api/activities?status=DONE').set(ctx.users.lead.auth).expect(200);
      expect((done.body as { id: string }[]).map((t) => t.id)).toEqual([a.id]);
    });

    it('rejects an invalid status filter', async () => {
      await request(ctx.app).get('/api/activities?status=NOPE').set(ctx.users.lead.auth).expect(400);
    });
  });

  describe('GET /api/activities/:id', () => {
    it('returns the activity or 404', async () => {
      const a = await createActivity();
      await request(ctx.app).get(`/api/activities/${a.id}`).set(ctx.users.lead.auth).expect(200);
      await request(ctx.app).get('/api/activities/missing').set(ctx.users.lead.auth).expect(404);
    });
  });

  describe('PATCH /api/activities/:id', () => {
    it('updates permitted fields and alerts a new assignee', async () => {
      const a = await createActivity();
      const res = await request(ctx.app)
        .patch(`/api/activities/${a.id}`)
        .set(ctx.users.lead.auth)
        .send({ status: 'IN_PROGRESS', priority: 'HIGH', category: 'AUDIT', assigneeId: ctx.users.associate.profile.id })
        .expect(200);
      expect(res.body).toMatchObject({ status: 'IN_PROGRESS', priority: 'HIGH', category: 'AUDIT' });

      const alerts = await request(ctx.app).get('/api/alerts').set(ctx.users.associate.auth).expect(200);
      expect(alerts.body).toHaveLength(1);
    });

    it('emits status changes on the event bus', async () => {
      const handler = jest.fn();
      ctx.container.events.on('activity.status_changed', handler);
      const a = await createActivity();
      await request(ctx.app).patch(`/api/activities/${a.id}`).set(ctx.users.lead.auth).send({ status: 'BLOCKED' }).expect(200);
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ activityId: a.id, from: 'TODO', to: 'BLOCKED' }));
    });

    it('rejects unknown or empty patches', async () => {
      const a = await createActivity();
      await request(ctx.app).patch(`/api/activities/${a.id}`).set(ctx.users.lead.auth).send({ title: 'nope' }).expect(400);
      await request(ctx.app).patch(`/api/activities/${a.id}`).set(ctx.users.lead.auth).send({}).expect(400);
    });
  });

  describe('DELETE /api/activities/:id', () => {
    it('allows the owner', async () => {
      const a = await createActivity();
      await request(ctx.app).delete(`/api/activities/${a.id}`).set(ctx.users.lead.auth).expect(204);
      await request(ctx.app).get(`/api/activities/${a.id}`).set(ctx.users.lead.auth).expect(404);
    });

    it('allows a store manager', async () => {
      const a = await createActivity();
      await request(ctx.app).delete(`/api/activities/${a.id}`).set(ctx.users.manager.auth).expect(204);
    });

    it('forbids other staff', async () => {
      const a = await createActivity();
      const res = await request(ctx.app).delete(`/api/activities/${a.id}`).set(ctx.users.associate.auth).expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});

describe('SLA breach detection', () => {
  it('flags overdue CRITICAL activities once and alerts creator and assignee', async () => {
    let now = new Date('2026-03-01T09:00:00Z');
    const ctx = await setupTestApp({ clock: () => now });
    const programmeId = (await createProgramme(ctx)).id;
    const service = ctx.container.activitiesService;

    const critical = await service.create(ctx.users.lead.profile, {
      title: 'Cold-chain compliance check',
      programmeId,
      priority: 'CRITICAL',
      category: 'COMPLIANCE',
      assigneeId: ctx.users.associate.profile.id,
      dueDate: '2026-03-01T12:00:00Z',
    });
    await service.create(ctx.users.lead.profile, { title: 'Low prio', programmeId, priority: 'LOW', dueDate: '2026-03-01T10:00:00Z' });

    expect(await service.checkSlaBreaches()).toHaveLength(0);

    now = new Date('2026-03-01T13:00:00Z');
    const flagged = await service.checkSlaBreaches();
    expect(flagged.map((t) => t.id)).toEqual([critical.id]);
    expect(await service.checkSlaBreaches()).toHaveLength(0);

    const assigneeAlerts = await ctx.container.alertsService.listForUser(ctx.users.associate.profile.id);
    expect(assigneeAlerts.map((a) => a.type).sort()).toEqual(['SLA_BREACH', 'TASK_ASSIGNED']);
    const creatorAlerts = await ctx.container.alertsService.listForUser(ctx.users.lead.profile.id);
    expect(creatorAlerts.map((a) => a.type)).toEqual(['SLA_BREACH']);
  });
});
