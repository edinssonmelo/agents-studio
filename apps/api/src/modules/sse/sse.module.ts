// src/modules/sse/sse.module.ts

import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SseController } from './sse.controller';

@Module({
  imports: [EventEmitterModule],
  controllers: [SseController],
})
export class SseModule {}
