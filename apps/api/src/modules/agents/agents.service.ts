// src/modules/agents/agents.service.ts
// All agent_core HTTP calls live here. AGENT_CORE_TOKEN never leaves this service.

import {
  Injectable,
  Logger,
  BadGatewayException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { firstValueFrom, timeout } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

export type AssistantId = 'me' | 'wife';

export interface RunAgentDto {
  task: string;
  assistantId: AssistantId;
  agentHint?: string;
  command?: string;
  context?: string;
}

export interface AppendMemoryDto {
  content: string;
}

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly requestTimeout: number;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.baseUrl = this.config.get<string>('agentCore.url');
    this.token = this.config.get<string>('agentCore.token');
    this.requestTimeout = this.config.get<number>('agentCore.timeout');
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'X-Agent-Core-Token': this.token,
    };
  }

  private async coreGet<T>(path: string): Promise<T> {
    try {
      const res = await firstValueFrom(
        this.http.get<T>(`${this.baseUrl}${path}`, {
          headers: this.headers(),
        }).pipe(timeout(this.requestTimeout)),
      );
      return res.data;
    } catch (err) {
      this.handleAxiosError(err, path);
    }
  }

  private async corePost<T>(path: string, body: unknown): Promise<T> {
    try {
      const res = await firstValueFrom(
        this.http.post<T>(`${this.baseUrl}${path}`, body, {
          headers: this.headers(),
        }).pipe(timeout(this.requestTimeout)),
      );
      return res.data;
    } catch (err) {
      this.handleAxiosError(err, path);
    }
  }

  private async coreDelete<T>(path: string): Promise<T> {
    try {
      const res = await firstValueFrom(
        this.http.delete<T>(`${this.baseUrl}${path}`, {
          headers: this.headers(),
        }).pipe(timeout(this.requestTimeout)),
      );
      return res.data;
    } catch (err) {
      this.handleAxiosError(err, path);
    }
  }

  private handleAxiosError(err: any, path: string): never {
    const status = err?.response?.status;
    const data = err?.response?.data;

    this.logger.error(`agent_core ${path} → ${status ?? 'timeout'}: ${JSON.stringify(data)}`);

    if (status === 404) {
      throw new NotFoundException(data?.error ?? 'Agent not found');
    }
    if (status === 401) {
      throw new InternalServerErrorException('Agent Core auth misconfigured');
    }
    if (status === 408 || err?.name === 'TimeoutError') {
      throw new BadGatewayException('Agent Core timed out');
    }
    throw new BadGatewayException(data?.error ?? 'Agent Core unavailable');
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async health() {
    return this.coreGet('/healthz');
  }

  // ── Agent list ────────────────────────────────────────────────────────────

  async listAgents(assistantId: AssistantId) {
    return this.coreGet(`/agents?assistant_id=${assistantId}`);
  }

  // ── Run agent ─────────────────────────────────────────────────────────────

  async runAgent(userId: string, dto: RunAgentDto) {
    const start = Date.now();

    this.eventEmitter.emit('agent.run.start', {
      userId,
      assistantId: dto.assistantId,
      agentHint: dto.agentHint,
      task: dto.task,
      ts: new Date().toISOString(),
    });

    let result: any;
    let error: string | undefined;

    try {
      result = await this.corePost('/run', {
        task: dto.task,
        assistant_id: dto.assistantId,
        ...(dto.agentHint ? { agent_hint: dto.agentHint } : {}),
        ...(dto.command ? { command: dto.command } : {}),
        ...(dto.context ? { context: dto.context } : {}),
      });

      this.eventEmitter.emit('agent.run.complete', {
        userId,
        assistantId: dto.assistantId,
        agentName: result?.agent ?? dto.agentHint,
        durationMs: Date.now() - start,
        ts: new Date().toISOString(),
      });
    } catch (err) {
      error = err?.message ?? 'Unknown error';
      this.eventEmitter.emit('agent.run.error', {
        userId,
        assistantId: dto.assistantId,
        error,
        ts: new Date().toISOString(),
      });
      throw err;
    } finally {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'run_agent',
          assistantId: dto.assistantId,
          agentName: result?.agent ?? dto.agentHint ?? null,
          payload: JSON.stringify({ task: dto.task }),
          result: error ? 'error' : 'success',
          errorMsg: error ?? null,
          durationMs: Date.now() - start,
        },
      });
    }

    return result;
  }

  // ── Reset session ─────────────────────────────────────────────────────────

  async resetSession(userId: string, assistantId: AssistantId, agentName: string) {
    const start = Date.now();
    let error: string | undefined;

    try {
      const res = await this.coreDelete(`/session/${assistantId}/${agentName}`);
      this.eventEmitter.emit('agent.reset', { userId, assistantId, agentName, ts: new Date().toISOString() });
      return res;
    } catch (err) {
      error = err?.message;
      throw err;
    } finally {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'reset_session',
          assistantId,
          agentName,
          result: error ? 'error' : 'success',
          errorMsg: error ?? null,
          durationMs: Date.now() - start,
        },
      });
    }
  }

  // ── Append memory ─────────────────────────────────────────────────────────

  async appendMemory(
    userId: string,
    assistantId: AssistantId,
    agentName: string,
    dto: AppendMemoryDto,
  ) {
    const start = Date.now();
    let error: string | undefined;

    try {
      const res = await this.corePost(`/memory/${assistantId}/${agentName}/append`, {
        content: dto.content,
      });
      this.eventEmitter.emit('agent.memory.append', {
        userId,
        assistantId,
        agentName,
        contentLength: dto.content.length,
        ts: new Date().toISOString(),
      });
      return res;
    } catch (err) {
      error = err?.message;
      throw err;
    } finally {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'append_memory',
          assistantId,
          agentName,
          payload: JSON.stringify({ contentLength: dto.content.length }),
          result: error ? 'error' : 'success',
          errorMsg: error ?? null,
          durationMs: Date.now() - start,
        },
      });
    }
  }

  // ── Reload config (new endpoint added to agent_core) ─────────────────────

  async reloadConfig(userId: string) {
    const start = Date.now();
    let error: string | undefined;

    try {
      const res = await this.corePost('/admin/reload-config', {});
      this.eventEmitter.emit('config.reloaded', {
        userId,
        ts: new Date().toISOString(),
      });
      return res;
    } catch (err) {
      error = err?.message;
      throw err;
    } finally {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'apply_config',
          assistantId: 'me',
          result: error ? 'error' : 'success',
          errorMsg: error ?? null,
          durationMs: Date.now() - start,
        },
      });
    }
  }

  // ── Metrics passthrough ───────────────────────────────────────────────────

  async metrics() {
    return this.coreGet('/metrics');
  }
}
