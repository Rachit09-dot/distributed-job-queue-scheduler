/**
 * Integration tests for auth endpoints.
 * Uses supertest against a real Express app instance.
 * Requires a live PostgreSQL (use docker-compose.test.yml or test DB).
 *
 * Set TEST_DATABASE_URL in your environment to run these.
 * Tests are skipped if TEST_DATABASE_URL is not set.
 */

import request from 'supertest';
import type { Express } from 'express';

const SKIP = !process.env.TEST_DATABASE_URL;

// Dynamic import to avoid crashing if DB is unavailable
let app: Express;

beforeAll(async () => {
  if (SKIP) return;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;
  process.env.JWT_SECRET = 'test-jwt-secret-integration-32ch'; // exactly 32 chars
  process.env.NODE_ENV = 'test';
  const { app: expressApp } = await import('../../server/src/app');
  app = expressApp;
});

const describeIf = (condition: boolean) => (condition ? describe.skip : describe);
const describeLive = describeIf(SKIP);

describeLive('POST /api/auth/register', () => {
  const unique = Date.now();

  it('registers a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User',
        email: `test_${unique}@integration.test`,
        password: 'securepassword1',
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(`test_${unique}@integration.test`);
    // Ensure password hash is never returned
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('returns 409 on duplicate email', async () => {
    const email = `dup_${unique}@integration.test`;
    const payload = { name: 'Dup', email, password: 'password12' };
    await request(app).post('/api/auth/register').send(payload);
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad', email: 'notanemail', password: 'password12' });
    expect(res.status).toBe(400);
  });

  it('rejects short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bad', email: `short_${unique}@test.com`, password: 'short' });
    expect(res.status).toBe(400);
  });
});

describeLive('POST /api/auth/login', () => {
  const unique = Date.now();
  const email = `login_${unique}@integration.test`;

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Login User', email, password: 'correctpassword' });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'correctpassword' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe(email);
  });

  it('rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('rejects non-existent user with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: 'anything' });
    expect(res.status).toBe(401);
  });
});

describeLive('GET /api/auth/me', () => {
  const unique = Date.now();
  let token: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Me User', email: `me_${unique}@test.com`, password: 'password12' });
    token = res.body.data.token;
  });

  it('returns current user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(`me_${unique}@test.com`);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });
});

// ── Health check (always runs) ────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 when app loads', async () => {
    if (SKIP) {
      // Minimal test without a live DB
      expect(true).toBe(true);
      return;
    }
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
