// src/modules/agents/agents.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsIn, IsOptional, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AgentsService, AssistantId, RunAgentDto, AppendMemoryDto } from './agents.service';

class RunAgentBodyDto implements RunAgentDto {
  @IsString() @IsNotEmpty() @MaxLength(4000) task: string;
  @IsString() @IsIn(['me', 'wife']) assistantId: AssistantId;
  @IsOptional() @IsString() @MaxLength(64) agentHint?: string;
  @IsOptional() @IsString() @MaxLength(64) command?: string;
  @IsOptional() @IsString() @MaxLength(8000) context?: string;
}

class AppendMemoryBodyDto implements AppendMemoryDto {
  @IsString() @IsNotEmpty() @MaxLength(10000) content: string;
}

@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get('health')
  health() {
    return this.agentsService.health();
  }

  @Get()
  listAgents(@Query('assistant_id') assistantId: AssistantId) {
    return this.agentsService.listAgents(assistantId ?? 'me');
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  runAgent(@CurrentUser() user: JwtPayload, @Body() dto: RunAgentBodyDto) {
    return this.agentsService.runAgent(user.sub, dto);
  }

  @Delete('session/:assistantId/:agentName')
  @HttpCode(HttpStatus.OK)
  resetSession(
    @CurrentUser() user: JwtPayload,
    @Param('assistantId') assistantId: AssistantId,
    @Param('agentName') agentName: string,
  ) {
    return this.agentsService.resetSession(user.sub, assistantId, agentName);
  }

  @Post('memory/:assistantId/:agentName/append')
  @HttpCode(HttpStatus.OK)
  appendMemory(
    @CurrentUser() user: JwtPayload,
    @Param('assistantId') assistantId: AssistantId,
    @Param('agentName') agentName: string,
    @Body() dto: AppendMemoryBodyDto,
  ) {
    return this.agentsService.appendMemory(user.sub, assistantId, agentName, dto);
  }

  @Post('admin/reload-config')
  @HttpCode(HttpStatus.OK)
  reloadConfig(@CurrentUser() user: JwtPayload) {
    return this.agentsService.reloadConfig(user.sub);
  }

  @Get('metrics')
  metrics() {
    return this.agentsService.metrics();
  }
}
