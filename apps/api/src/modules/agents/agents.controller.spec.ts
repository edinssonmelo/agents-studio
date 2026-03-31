// src/modules/agents/agents.controller.spec.ts
// Integration-style tests for the agents endpoints using mocked AgentsService

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';

// Mock JWT guard — bypass auth for unit tests
const mockJwtGuard = { canActivate: () => true };

// Mock user injected by decorator
const mockUser = { sub: 'me', username: 'me' };

describe('AgentsController', () => {
  let app: INestApplication;

  const mockAgentsService = {
    health: jest.fn().mockResolvedValue({ ok: true }),
    listAgents: jest.fn().mockResolvedValue({ agents: ['design', 'marketing'] }),
    runAgent: jest.fn().mockResolvedValue({ response: 'test response', agent: 'design' }),
    resetSession: jest.fn().mockResolvedValue({ deleted: true }),
    appendMemory: jest.fn().mockResolvedValue({ appended: true }),
    reloadConfig: jest.fn().mockResolvedValue({ reloaded: true }),
    metrics: jest.fn().mockResolvedValue('# metrics'),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentsController],
      providers: [{ provide: AgentsService, useValue: mockAgentsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());

    // Inject mock user into every request
    app.use((req: any, _res: any, next: any) => {
      req.user = mockUser;
      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/agents/health', () => {
    it('returns ok:true', async () => {
      const res = await request(app.getHttpServer()).get('/api/agents/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('GET /api/agents', () => {
    it('returns agent list for me', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/agents?assistant_id=me');
      expect(res.status).toBe(200);
      expect(res.body.agents).toBeDefined();
    });
  });

  describe('POST /api/agents/run', () => {
    it('runs an agent with valid body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents/run')
        .send({ task: 'Design a logo', assistantId: 'me', agentHint: 'design' });
      expect(res.status).toBe(200);
      expect(res.body.agent).toBe('design');
    });

    it('rejects missing task', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents/run')
        .send({ assistantId: 'me' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid assistantId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents/run')
        .send({ task: 'Hello', assistantId: 'admin' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/agents/session/:assistantId/:agentName', () => {
    it('resets session', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/agents/session/me/design');
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });

  describe('POST /api/agents/memory/:assistantId/:agentName/append', () => {
    it('appends memory with valid content', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents/memory/me/design/append')
        .send({ content: '## New memory entry\n\nThis is a test.' });
      expect(res.status).toBe(200);
      expect(res.body.appended).toBe(true);
    });

    it('rejects empty content', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents/memory/me/design/append')
        .send({ content: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/agents/admin/reload-config', () => {
    it('triggers reload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents/admin/reload-config');
      expect(res.status).toBe(200);
      expect(res.body.reloaded).toBe(true);
    });
  });
});
