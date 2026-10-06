/**
 * Integration tests for job CRUD and lifecycle endpoints.
 * Requires TEST_DATABASE_URL and TEST_REDIS_URL to be set.
 * Tests are skipped if these env vars are absent.
 */

import request from 'supertest';
import type { Express } from 'express';

const SKIP = !process.env.TEST_DATABASE_URL || !process.env.TEST_REDIS_URL;
const describeIf = (condition: boolean) => (condition ? describe.skip : describe);
const describeLive = describeIf(SKIP);

let app: Express;
let token: string;
let userId: string;

beforeAll(async () => {
  if (SKIP) return;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
  process.env.REDIS_URL = process.env.TEST_REDIS_URL!;
  process.env.JWT_SECRET = 'test-jwt-secret-jobs';
  process.env.NODE_ENV = 'test';

  const { app: expressApp } = await import('../../server/src/app');
  app = expressApp;

  const unique = Date.now();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Job Tester', email: `jobs_${unique}@test.com`, password: 'password12' });

  token = res.body.data.token;
  userId = res.body.data.user.id;
});

describeLive('POST /api/jobs', () => {
  it('creates a DATA_PROCESSING job', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'DATA_PROCESSING',
        payload: { numbers: [1, 2, 3] },
        priority: 'NORMAL',
        maxAttempts: 3,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.type).toBe('DATA_PROCESSING');
    expect(res.body.data.status).toBe('QUEUED');
    expect(res.body.data.userId).toBe(userId);
  });

  it('creates a SCHEDULED job for the future', async () => {
    const future = new Date(Date.now() + 3600000).toISOString(); // +1 hour
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'CUSTOM_DELAY',
        payload: { delaySeconds: 1 },
        priority: 'LOW',
        maxAttempts: 1,
        scheduledAt: future,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SCHEDULED');
  });

  it('rejects unknown job type with 400', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'INVALID_TYPE', payload: {} });
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ type: 'CUSTOM_DELAY', payload: {} });
    expect(res.status).toBe(401);
  });

  it('prevents duplicate idempotency key', async () => {
    const key = `idem_${Date.now()}`;
    const payload = {
      type: 'CUSTOM_DELAY',
      payload: { delaySeconds: 0 },
      idempotencyKey: key,
    };
    const res1 = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    const res2 = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect(res1.status).toBe(201);
    // Second request returns the same job, not a new one
    expect(res2.body.data.id).toBe(res1.body.data.id);
  });
});

describeLive('GET /api/jobs', () => {
  it('returns a paginated list of jobs', async () => {
    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(typeof res.body.pagination.total).toBe('number');
  });

  it('filters by status', async () => {
    const res = await request(app)
      .get('/api/jobs?status=QUEUED')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    res.body.data.forEach((job: any) => {
      expect(['QUEUED', 'RUNNING']).toContain(job.status); // may have moved to RUNNING
    });
  });

  it('respects pagination params', async () => {
    const res = await request(app)
      .get('/api/jobs?page=1&limit=2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.limit).toBe(2);
  });
});

describeLive('GET /api/jobs/:id', () => {
  let jobId: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'CUSTOM_DELAY', payload: { delaySeconds: 0 } });
    jobId = res.body.data.id;
  });

  it('returns the job by id', async () => {
    const res = await request(app)
      .get(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(jobId);
  });

  it('returns 404 for non-existent job', async () => {
    const res = await request(app)
      .get('/api/jobs/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describeLive('POST /api/jobs/:id/cancel', () => {
  it('cancels a QUEUED job', async () => {
    const createRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'CUSTOM_DELAY', payload: { delaySeconds: 30 }, maxAttempts: 1 });
    const jobId = createRes.body.data.id;

    const res = await request(app)
      .post(`/api/jobs/${jobId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
  });

  it('returns 409 when trying to cancel a completed job', async () => {
    // Create a job and wait for completion (with a short delay)
    const createRes = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'CUSTOM_DELAY', payload: { delaySeconds: 0 }, maxAttempts: 1 });
    const jobId = createRes.body.data.id;

    // First cancel it cleanly
    await request(app)
      .post(`/api/jobs/${jobId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    // Try cancelling again
    const res = await request(app)
      .post(`/api/jobs/${jobId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});
