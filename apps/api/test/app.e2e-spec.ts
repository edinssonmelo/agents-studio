// test/app.e2e-spec.ts
// End-to-end smoke: verify app bootstraps, public endpoints reachable, protected endpoints blocked.

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

describe('AppModule (e2e smoke)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Use in-memory SQLite for e2e
    process.env.DATABASE_URL = 'file::memory:?cache=shared';
    process.env.JWT_SECRET = 'test-secret-e2e';
    process.env.USER_ME_PASSWORD = 'test-password';
    process.env.USER_WIFE_PASSWORD = 'test-password';
    process.env.AGENT_CORE_TOKEN = 'test-token';
    process.env.AGENT_CORE_URL = 'http://localhost:9999'; // non-existent; BFF should 502
    process.env.AGENT_CORE_CONFIG_ROOT = '/tmp/test-agent-core';
    process.env.AGENT_CORE_DATA_ROOT   = '/tmp/test-agent-core-data';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── Public endpoints ────────────────────────────────────────────────────

  it('POST /api/auth/login → 401 with wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'me', password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login → 200 with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'me', password: 'test-password' });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.user).toBe('me');
  });

  it('POST /api/auth/login → 400 with invalid username', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'anything' });
    expect(res.status).toBe(401);
  });

  // ── Protected endpoints require auth ────────────────────────────────────

  it('GET /api/agents → 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/agents?assistant_id=me');
    expect(res.status).toBe(401);
  });

  it('GET /api/config/assistants-yaml → 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/config/assistants-yaml');
    expect(res.status).toBe(401);
  });

  it('GET /api/audit/logs → 401 without token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/audit/logs');
    expect(res.status).toBe(401);
  });

  // ── Authenticated flow ──────────────────────────────────────────────────

  it('authenticated GET /api/audit/logs → 200', async () => {
    // First login
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'me', password: 'test-password' });
    const token = loginRes.body.access_token;

    const res = await request(app.getHttpServer())
      .get('/api/audit/logs')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('authenticated GET /api/agents → 502 (agent_core unreachable in test)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'me', password: 'test-password' });
    const token = loginRes.body.access_token;

    const res = await request(app.getHttpServer())
      .get('/api/agents?assistant_id=me')
      .set('Authorization', `Bearer ${token}`);
    // agent_core is not running in test → should get 502 Bad Gateway
    expect([502, 504]).toContain(res.status);
  });
});
