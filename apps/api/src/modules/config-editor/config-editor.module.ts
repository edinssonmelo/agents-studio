// src/modules/config-editor/config-editor.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigEditorController } from './config-editor.controller';
import { ConfigEditorService } from './config-editor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [ConfigModule, AgentsModule, EventEmitterModule],
  controllers: [ConfigEditorController],
  providers: [ConfigEditorService, PrismaService],
})
export class ConfigEditorModule {}
