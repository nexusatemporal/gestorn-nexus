/**
 * 🎯 SALES AI CONTROLLER
 *
 * Endpoints REST para o Nexus Sales AI
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SalesAIService } from './sales-ai.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';
import {
  ChatRequestDto,
  DISCAnalysisRequestDto,
  BriefingRequestDto,
  BattlecardRequestDto,
  RoleplayRequestDto,
  GeneratorRequestDto,
  FeedbackRequestDto,
  AnalyticsRequestDto,
} from './dto/sales-ai.dto';

@Controller('sales-ai')
@UseGuards(RolesGuard)
export class SalesAIController {
  constructor(private readonly salesAIService: SalesAIService) {}

  // ========================================
  // POST /api/v1/sales-ai/chat
  // ========================================
  @Post('chat')
  @Roles(UserRole.VENDEDOR, UserRole.GESTOR, UserRole.SUPERADMIN)
  async chat(@Body() request: ChatRequestDto, @CurrentUser() user: User) {
    // DTOs use strings for validation, types use enums - safe to cast after validation
    return this.salesAIService.chat(request as any);
  }

  // ========================================
  // SSE /api/v1/sales-ai/chat/stream
  // ========================================
  @Sse('chat/stream')
  @Roles(UserRole.VENDEDOR, UserRole.GESTOR, UserRole.SUPERADMIN)
  async chatStream(
    @Query() request: ChatRequestDto,
  ): Promise<Observable<MessageEvent>> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          // DTOs use strings for validation, types use enums - safe to cast after validation
          for await (const chunk of this.salesAIService.chatStream(
            request as any,
          )) {
            subscriber.next({ data: chunk } as MessageEvent);
          }
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  // ========================================
  // POST /api/v1/sales-ai/insights
  // ========================================
  @Post('insights')
  @Roles(UserRole.VENDEDOR, UserRole.GESTOR, UserRole.SUPERADMIN)
  async insights(
    @Body() request: DISCAnalysisRequestDto,
    @CurrentUser() user: User,
  ) {
    // DTOs use strings for validation, types use enums - safe to cast after validation
    return this.salesAIService.analyzeDISC(request as any);
  }

  // ========================================
  // POST /api/v1/sales-ai/briefing
  // ========================================
  @Post('briefing')
  @Roles(UserRole.VENDEDOR, UserRole.GESTOR, UserRole.SUPERADMIN)
  async briefing(
    @Body() request: BriefingRequestDto,
    @CurrentUser() user: User,
  ) {
    // DTOs use strings for validation, types use enums - safe to cast after validation
    return this.salesAIService.generateBriefing(request as any);
  }

  // ========================================
  // POST /api/v1/sales-ai/battlecard
  // ========================================
  @Post('battlecard')
  @Roles(UserRole.VENDEDOR, UserRole.GESTOR, UserRole.SUPERADMIN)
  async battlecard(
    @Body() request: BattlecardRequestDto,
    @CurrentUser() user: User,
  ) {
    // DTOs use strings for validation, types use enums - safe to cast after validation
    return this.salesAIService.generateBattlecard(request as any);
  }

  // ========================================
  // POST /api/v1/sales-ai/roleplay
  // ========================================
  @Post('roleplay')
  @Roles(UserRole.VENDEDOR, UserRole.GESTOR, UserRole.SUPERADMIN)
  async roleplay(
    @Body() request: RoleplayRequestDto,
    @CurrentUser() user: User,
  ) {
    // DTOs use strings for validation, types use enums - safe to cast after validation
    return this.salesAIService.roleplay(request as any);
  }

  // ========================================
  // POST /api/v1/sales-ai/generate
  // ========================================
  @Post('generate')
  @Roles(UserRole.VENDEDOR, UserRole.GESTOR, UserRole.SUPERADMIN)
  async generate(
    @Body() request: GeneratorRequestDto,
    @CurrentUser() user: User,
  ) {
    // DTOs use strings for validation, types use enums - safe to cast after validation
    return this.salesAIService.generateContent(request as any);
  }

  // ========================================
  // POST /api/v1/sales-ai/feedback
  // ========================================
  @Post('feedback')
  @Roles(UserRole.VENDEDOR, UserRole.GESTOR, UserRole.SUPERADMIN)
  async feedback(
    @Body() request: FeedbackRequestDto,
    @CurrentUser() user: User,
  ) {
    // DTOs use strings for validation, types use enums - safe to cast after validation
    return this.salesAIService.submitFeedback(request as any);
  }

  // ========================================
  // GET /api/v1/sales-ai/analytics
  // ========================================
  @Get('analytics')
  @Roles(UserRole.GESTOR, UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async analytics(@Query() query: AnalyticsRequestDto, @CurrentUser() user: User) {
    return this.salesAIService.getAnalytics(query.userId);
  }

  // ========================================
  // GET /api/v1/sales-ai/health
  // ========================================
  @Get('health')
  async health() {
    return {
      status: 'ok',
      service: 'Nexus Sales AI',
      providers: ['openai', 'gemini', 'groq'],
      timestamp: new Date().toISOString(),
    };
  }
}
