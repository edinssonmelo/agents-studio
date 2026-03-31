// src/modules/config-editor/config-editor.controller.ts

import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ConfigEditorService } from './config-editor.service';

class UpdateYamlDto {
  @IsString() @IsNotEmpty() @MaxLength(200000) content: string;
}

class UpdatePromptDto {
  @IsString() @IsNotEmpty() @MaxLength(50000) content: string;
}

@UseGuards(JwtAuthGuard)
@Controller('config')
export class ConfigEditorController {
  constructor(private readonly svc: ConfigEditorService) {}

  // ── assistants.yaml ───────────────────────────────────────────────────────

  @Get('assistants-yaml')
  getYaml() {
    return this.svc.getAssistantsYaml();
  }

  @Put('assistants-yaml')
  @HttpCode(HttpStatus.OK)
  updateYaml(@CurrentUser() user: JwtPayload, @Body() dto: UpdateYamlDto) {
    return this.svc.updateAssistantsYaml(user.sub, dto.content);
  }

  // ── Prompts ───────────────────────────────────────────────────────────────

  @Get('prompts')
  listPrompts() {
    return this.svc.listPrompts();
  }

  @Get('prompts/:agentName')
  getPrompt(@Param('agentName') agentName: string) {
    return this.svc.getPrompt(agentName);
  }

  @Put('prompts/:agentName')
  @HttpCode(HttpStatus.OK)
  updatePrompt(
    @CurrentUser() user: JwtPayload,
    @Param('agentName') agentName: string,
    @Body() dto: UpdatePromptDto,
  ) {
    return this.svc.updatePrompt(user.sub, agentName, dto.content);
  }

  // ── Memory / Working files ────────────────────────────────────────────────

  @Get('memory/:assistantId/:agentName')
  getMemory(
    @Param('assistantId') assistantId: string,
    @Param('agentName') agentName: string,
    @Query('type') type: 'memory' | 'working' = 'memory',
  ) {
    return this.svc.getMemoryFile(assistantId, agentName, type);
  }

  @Get('memory/:assistantId/global')
  getGlobalMemory(@Param('assistantId') assistantId: string) {
    return this.svc.getMemoryFile(assistantId, '', 'global');
  }

  // ── Snapshots ─────────────────────────────────────────────────────────────

  @Get('snapshots')
  getSnapshots(@Query('type') type?: string) {
    return this.svc.getSnapshots(type);
  }
}
