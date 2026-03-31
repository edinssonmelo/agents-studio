// src/modules/audit/audit.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('logs')
  async getLogs(
    @Query('assistantId') assistantId?: string,
    @Query('agentName') agentName?: string,
    @Query('action') action?: string,
    @Query('limit') limit = '50',
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(assistantId ? { assistantId } : {}),
        ...(agentName ? { agentName } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10), 200),
    });
  }

  @Get('preferences/:userId')
  async getPrefs(@Query('userId') userId: string) {
    return this.prisma.userPreference.findUnique({ where: { userId } });
  }
}
