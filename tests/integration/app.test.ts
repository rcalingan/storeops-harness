import request from 'supertest';
import { setupTestApp, type TestContext } from '../helpers/test-app';

describe('app infrastructure', () => {
  let ctx: TestContext;
  beforeEach(async () => {
    ctx = await setupTestApp();
  });

  it('GET /health responds ok', async () => {
    await request(ctx.app).get('/health').expect(200, { status: 'ok' });
  });

  it('returns the AppError contract for unknown routes', async () => {
    const res = await request(ctx.app).get('/nope').expect(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: "Route 'GET /nope' not found" } });
  });

  it('rejects requests without a bearer token', async () => {
    const res = await request(ctx.app).get('/api/activities').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects requests with an invalid bearer token', async () => {
    const res = await request(ctx.app).get('/api/activities').set('Authorization', 'Bearer nope').expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('maps malformed JSON to a VALIDATION_ERROR', async () => {
    const res = await request(ctx.app)
      .post('/api/programmes')
      .set(ctx.users.manager.auth)
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
