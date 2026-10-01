import request from 'supertest';
import { setupTestApp, type TestContext } from '../helpers/test-app';

describe('alerts module', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await setupTestApp();
  });

  it('GET /api/alerts returns only the caller alerts', async () => {
    await ctx.container.alertsService.notify({
      userId: ctx.users.lead.profile.id,
      type: 'TASK_ASSIGNED',
      title: 't',
      message: 'm',
    });
    const lead = await request(ctx.app).get('/api/alerts').set(ctx.users.lead.auth).expect(200);
    expect(lead.body).toHaveLength(1);
    expect(lead.body[0]).toMatchObject({ channel: 'IN_APP', status: 'UNREAD', readAt: null });
    const associate = await request(ctx.app).get('/api/alerts').set(ctx.users.associate.auth).expect(200);
    expect(associate.body).toHaveLength(0);
  });

  it('supports a status filter', async () => {
    await ctx.container.alertsService.notify({ userId: ctx.users.lead.profile.id, type: 'SLA_BREACH', title: 't', message: 'm' });
    const read = await request(ctx.app).get('/api/alerts?status=READ').set(ctx.users.lead.auth).expect(200);
    expect(read.body).toHaveLength(0);
    await request(ctx.app).get('/api/alerts?status=BOGUS').set(ctx.users.lead.auth).expect(400);
  });

  it('notifies store managers on inventory.low_stock events', async () => {
    await ctx.container.events.emit('inventory.low_stock', { storeId: 'store-001', sku: 'SKU-123', quantity: 2, threshold: 10 });
    const manager = await request(ctx.app).get('/api/alerts').set(ctx.users.manager.auth).expect(200);
    expect(manager.body).toEqual([expect.objectContaining({ type: 'INVENTORY_LOW', metadata: { storeId: 'store-001', sku: 'SKU-123' } })]);
    const associate = await request(ctx.app).get('/api/alerts').set(ctx.users.associate.auth).expect(200);
    expect(associate.body).toHaveLength(0);
  });

  it('stops reacting to events once the container is disposed', async () => {
    ctx.container.dispose();
    await ctx.container.events.emit('inventory.low_stock', { storeId: 'store-001', sku: 'SKU-1', quantity: 0, threshold: 1 });
    expect(await ctx.container.alertsService.listForUser(ctx.users.manager.profile.id)).toHaveLength(0);
  });
});
