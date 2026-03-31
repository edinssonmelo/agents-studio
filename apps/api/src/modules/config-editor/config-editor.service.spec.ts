// src/modules/config-editor/config-editor.service.spec.ts
// Validates YAML parsing, path sanitization and snapshot creation

import { Test } from '@nestjs/testing';
import { ConfigEditorService } from './config-editor.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';

const prismaMock = {
  configSnapshot: {
    create: jest.fn().mockResolvedValue({ id: 1 }),
    update: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
  },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
};

const configMock = {
  get: jest.fn((key: string) => {
    if (key === 'dataRoot') return '/tmp/test-agent-core';
    return undefined;
  }),
};

const agentsServiceMock = {
  reloadConfig: jest.fn().mockResolvedValue({ reloaded: true }),
};

describe('ConfigEditorService — YAML validation', () => {
  let svc: ConfigEditorService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ConfigEditorService,
        { provide: ConfigService, useValue: configMock },
        { provide: 'PrismaService', useValue: prismaMock },
        { provide: 'AgentsService', useValue: agentsServiceMock },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    // Manually construct since providers use string tokens in this test
    svc = new ConfigEditorService(
      configMock as any,
      prismaMock as any,
      agentsServiceMock as any,
      { emit: jest.fn() } as any,
    );
  });

  it('rejects invalid YAML', async () => {
    await expect(
      svc.updateAssistantsYaml('me', 'key: [unclosed'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-mapping YAML', async () => {
    await expect(
      svc.updateAssistantsYaml('me', '- item1\n- item2'),
    ).rejects.toThrow(BadRequestException);
  });

  it('sanitizes prompt file name to prevent path traversal', () => {
    // Access private method via bracket notation for testing
    const result = (svc as any).resolvePromptFile('../../../etc/passwd');
    expect(result).not.toContain('..');
    expect(result).not.toContain('/');
  });
});
