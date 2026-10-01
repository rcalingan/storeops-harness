import request from 'supertest';
import { createProgramme, setupTestApp, type TestContext } from '../helpers/test-app';

describe('reports module', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await setupTestApp({ clock: () => new Date('2026-05-01T12:00:00Z') });
  });

  it('generates a STORE_SUMMARY when a programme closes (via event bus)', async () => {
    const programme = await createProgramme(ctx);
    const activities = ctx.container.activitiesService;
    const done = await activities.create(ctx.users.lead.profile, { title: 'Done task', programmeId: programme.id });
    await activities.update(ctx.users.lead.profile, done.id, { status: 'DONE' });
    await activities.create(ctx.users.lead.profile, { title: 'Overdue', programmeId: programme.id, dueDate: '2026-04-01T00:00:00Z' });

    await ctx.container.programmesService.close(ctx.users.manager.profile, programme.id);

    const res = await request(ctx.app).get('/api/reports').set(ctx.users.manager.auth).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      type: 'STORE_SUMMARY',
      trigger: 'PROGRAMME_CLOSED',
      storeId: 'store-001',
      programmeId: programme.id,
      metrics: {
        programmes: { total: 1, active: 0, closed: 1 },
        activities: { total: 2, overdue: 1, completionRate: 0.5, byStatus: { TODO: 1, IN_PROGRESS: 0, DONE: 1, BLOCKED: 0 } },
        staff: { total: 4, byRole: { REGIONAL_MANAGER: 1, STORE_MANAGER: 1, DEPARTMENT_LEAD: 1, ASSOCIATE: 1 } },
      },
    });
  });

  it('generates an on-demand summary for an empty store', async () => {
    const res = await request(ctx.app).post('/api/reports/store-summary').set(ctx.users.manager.auth).send({}).expect(201);
    expect(res.body).toMatchObject({ trigger: 'ON_DEMAND', programmeId: null, metrics: { activities: { total: 0, completionRate: 0 } } });
  });

  it('restricts access by role and store', async () => {
    await request(ctx.app).get('/api/reports').set(ctx.users.associate.auth).expect(403);
    await request(ctx.app).get('/api/reports?storeId=store-002').set(ctx.users.manager.auth).expect(403);
    const regional = await request(ctx.app).get('/api/reports?storeId=store-002').set(ctx.users.regional.auth).expect(200);
    expect(regional.body).toEqual([]);
  });
});
