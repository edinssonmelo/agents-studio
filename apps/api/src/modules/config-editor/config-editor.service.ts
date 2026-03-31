// src/modules/config-editor/config-editor.service.ts
// Reads and writes agent_core config files mounted into this container.
//
// Two separate volume roots:
//   agentCoreConfigRoot (/data/agent-core)      → assistants.yaml + prompts/
//   agentCoreDataRoot   (/data/agent-core-data)  → users/{me,wife}/agents/*/memory.md

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class ConfigEditorService {
  private readonly logger = new Logger(ConfigEditorService.name);

  private readonly configRoot: string;    // assistants.yaml lives here
  private readonly dataRoot: string;      // users/ lives here
  private readonly promptsDir: string;
  private readonly assistantsYamlPath: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly agentsService: AgentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.configRoot = this.config.get<string>('agentCoreConfigRoot', '/data/agent-core');
    this.dataRoot   = this.config.get<string>('agentCoreDataRoot', '/data/agent-core-data');
    this.assistantsYamlPath = path.join(this.configRoot, 'assistants.yaml');
    this.promptsDir = path.join(this.configRoot, 'prompts');
  }

  // ── assistants.yaml ───────────────────────────────────────────────────────

  async getAssistantsYaml(): Promise<{ content: string; parsed: unknown }> {
    try {
      const content = await fs.readFile(this.assistantsYamlPath, 'utf8');
      let parsed: unknown;
      try { parsed = yaml.load(content); } catch { parsed = null; }
      return { content, parsed };
    } catch {
      throw new NotFoundException('assistants.yaml not found. Check volume mount: AGENT_CORE_CONFIG_PATH → /data/agent-core');
    }
  }

  async updateAssistantsYaml(
    userId: string,
    newContent: string,
  ): Promise<{ applied: boolean; reloadResult?: unknown }> {
    // 1. Validate YAML syntax
    let parsed: unknown;
    try {
      parsed = yaml.load(newContent);
    } catch (err: any) {
      throw new BadRequestException(`Invalid YAML: ${err.message}`);
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('YAML root must be a mapping object');
    }

    // 2. Read current content for diff snapshot
    let before = '';
    try { before = await fs.readFile(this.assistantsYamlPath, 'utf8'); } catch {}

    // 3. Write new file
    await fs.writeFile(this.assistantsYamlPath, newContent, 'utf8');
    this.logger.log(`assistants.yaml updated by ${userId}`);

    // 4. Store snapshot
    const snapshot = await this.prisma.configSnapshot.create({
      data: { userId, configType: 'assistants_yaml', contentBefore: before, contentAfter: newContent },
    });

    // 5. Hot-reload via agent_core (graceful degradation if endpoint missing)
    let reloadResult: unknown;
    let applied = false;
    try {
      reloadResult = await this.agentsService.reloadConfig(userId);
      applied = true;
      await this.prisma.configSnapshot.update({
        where: { id: snapshot.id },
        data: { applied: true, appliedAt: new Date() },
      });
      this.eventEmitter.emit('config.applied', { userId, configType: 'assistants_yaml', ts: new Date().toISOString() });
    } catch (err) {
      this.logger.warn(`reload-config unavailable (${err?.message}). File saved — restart agent_core to apply.`);
      this.eventEmitter.emit('config.reload_failed', { userId, error: err?.message, ts: new Date().toISOString() });
    }

    await this.prisma.auditLog.create({
      data: {
        userId, action: 'edit_config', assistantId: 'me',
        payload: JSON.stringify({ configType: 'assistants_yaml', applied }),
        result: 'success',
      },
    });

    return { applied, reloadResult };
  }

  // ── Prompts ───────────────────────────────────────────────────────────────

  async listPrompts(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.promptsDir);
      return files.filter((f) => f.endsWith('.txt') || f.endsWith('.md'));
    } catch {
      return [];
    }
  }

  async getPrompt(agentName: string): Promise<{ content: string; filename: string }> {
    const filename = this.sanitizePromptFilename(agentName);
    const fullPath = path.join(this.promptsDir, filename);
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      return { content, filename };
    } catch {
      throw new NotFoundException(`Prompt file not found: ${filename}`);
    }
  }

  async updatePrompt(userId: string, agentName: string, newContent: string) {
    const filename = this.sanitizePromptFilename(agentName);
    const fullPath = path.join(this.promptsDir, filename);

    let before = '';
    try { before = await fs.readFile(fullPath, 'utf8'); } catch {}

    await fs.mkdir(this.promptsDir, { recursive: true });
    await fs.writeFile(fullPath, newContent, 'utf8');

    await this.prisma.configSnapshot.create({
      data: { userId, configType: 'prompt', agentName, contentBefore: before, contentAfter: newContent },
    });
    await this.prisma.auditLog.create({
      data: {
        userId, action: 'edit_config', assistantId: 'me', agentName,
        payload: JSON.stringify({ configType: 'prompt', filename }),
        result: 'success',
      },
    });

    this.eventEmitter.emit('config.prompt_updated', { userId, agentName, ts: new Date().toISOString() });
    return { saved: true, filename };
  }

  // ── Memory / Working files ────────────────────────────────────────────────

  async getMemoryFile(
    assistantId: string,
    agentName: string,
    fileType: 'memory' | 'working' | 'global',
  ) {
    const safeAssistant = assistantId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeAgent     = agentName.replace(/[^a-zA-Z0-9_-]/g, '');

    let filePath: string;
    if (fileType === 'global') {
      filePath = path.join(this.dataRoot, 'users', safeAssistant, 'global.md');
    } else {
      filePath = path.join(this.dataRoot, 'users', safeAssistant, 'agents', safeAgent, `${fileType}.md`);
    }

    try {
      const content = await fs.readFile(filePath, 'utf8');
      return { content, path: filePath };
    } catch {
      return { content: '', path: filePath };
    }
  }

  // ── Config snapshots / history ────────────────────────────────────────────

  async getSnapshots(configType?: string) {
    return this.prisma.configSnapshot.findMany({
      where: configType ? { configType } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Sanitize agent name → safe filename. Prevents path traversal. */
  private sanitizePromptFilename(agentName: string): string {
    const safe = agentName.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safe) throw new BadRequestException('Invalid agent name');
    return `${safe}.txt`;
  }
}
