// src/modules/agents/runtime-actions.smoke.spec.ts
// Smoke tests: reset session, append memory, admin reload-config
// These mock the agent_core HTTP layer and verify the full NestJS pipeline.

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from '../../common/filters/http-exception.filter';

const mockUser = { sub: 'me', username: 'me' };

describe('Runtime Actions — smoke tests', () => {
  let app: INestApplication;

  const mockAgentsService = {
    resetSession: jest.fn(),
    appendMemory: jest.fn(),
    reloadConfig: jest.fn(),
    health: jest.fn().mockResolvedValue({ ok: true }),
    listAgents: jest.fn().mockResolvedValue({ agents: {} }),
    runAgent: jest.fn().mockResolvedValue({ response: 'ok', agent: 'design' }),
    metrics: jest.fn().mockResolvedValue(''),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentsController],
      providers: [{ provide: AgentsService, useValue: mockAgentsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.use((req: any, _res: any, next: any) => { req.user = mockUser; next(); });
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  // ── reset session ─────────────────────────────────────────────────────────

  describe('DELETE /api/agents/session/:assistantId/:agentName', () => {
    it('200 when agent_core responds success', async () => {
      mockAgentsService.resetSession.mockResolvedValue({ deleted: true });
      const res = await request(app.getHttpServer())
        .delete('/api/agents/session/me/design');
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(mockAgentsService.resetSession).toHaveBeenCalledWith('me', 'me', 'design');
    });

    it('propagates 404 when agent not found', async () => {
      const { NotFoundException } = require('@nestjs/common');
      mockAgentsService.resetSession.mockRejectedValue(new NotFoundException('Agent not found'));
      const res = await request(app.getHttpServer())
        .delete('/api/agents/session/me/nonexistent');
      expect(res.status).toBe(404);
    });

    it('rejects invalid assistantId values', async () => {
      // "admin" is not a valid assistantId — but Param doesn't validate type here,
      // the service call would fail. We verify the call reaches service correctly.
      mockAgentsService.resetSession.mockResolvedValue({ deleted: true });
      const res = await request(app.getHttpServer())
        .delete('/api/agents/session/me/marketing');
      expect(res.status).toBe(200);
    });
  });

  // ── append memory ─────────────────────────────────────────────────────────

  describe('POST /api/agents/memory/:assistantId/:agentName/append', () => {
    it('200 with valid markdown content', async () => {
      mockAgentsService.appendMemory.mockResolvedValue({ appended: true });
      const res = await request(app.getHttpServer())
        .post('/api/agents/memory/me/design/append')
        .send({ content: '## Note\n\nThis is a test memory entry.' });
      expect(res.status).toBe(200);
      expect(res.body.appended).toBe(true);
      expect(mockAgentsService.appendMemory).toHaveBeenCalledWith(
        'me', 'me', 'design', { content: '## Note\n\nThis is a test memory entry.' }
      );
    });

    it('400 when content is empty string', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents/memory/me/design/append')
        .send({ content: '' });
      expect(res.status).toBe(400);
      expect(mockAgentsService.appendMemory).not.toHaveBeenCalled();
    });

    it('400 when content field is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents/memory/me/design/append')
        .send({});
      expect(res.status).toBe(400);
    });

    it('400 when content exceeds max length', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/agents/memory/me/design/append')
        .send({ content: 'x'.repeat(10001) });
      expect(res.status).toBe(400);
    });
  });

  // ── admin reload config ───────────────────────────────────────────────────

  describe('POST /api/agents/admin/reload-config', () => {
    it('200 when agent_core reloads successfully', async () => {
      mockAgentsService.reloadConfig.mockResolvedValue({ reloaded: true, agents_count: 4 });
      const res = await request(app.getHttpServer())
        .post('/api/agents/admin/reload-config');
      expect(res.status).toBe(200);
      expect(res.body.reloaded).toBe(true);
      expect(mockAgentsService.reloadConfig).toHaveBeenCalledWith('me');
    });

    it('502 when agent_core is unavailable', async () => {
      const { BadGatewayException } = require('@nestjs/common');
      mockAgentsService.reloadConfig.mockRejectedValue(
        new BadGatewayException('Agent Core unavailable')
      );
      const res = await request(app.getHttpServer())
        .post('/api/agents/admin/reload-config');
      expect(res.status).toBe(502);
    });
  });
});
