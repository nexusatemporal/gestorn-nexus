import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CalendarGoogleService } from './calendar-google.service';
import {
  CreateCalendarEventDto,
  CreateCalendarEventSchema,
  UpdateCalendarEventDto,
  UpdateCalendarEventSchema,
  QueryCalendarEventsDto,
  QueryCalendarEventsSchema,
} from './dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthUser } from '@/common/interfaces/auth-user.interface';
import { EventType } from '@prisma/client';

/**
 * Calendar Controller
 * Endpoints para gerenciar eventos do calendário
 *
 * PERMISSÕES:
 * - GET: Todos usuários autenticados (com scoping por role)
 * - POST: Todos usuários autenticados (cria evento para si mesmo)
 * - PUT: Dono do evento ou superiores (admins/gestor)
 * - DELETE: Dono do evento ou superiores (admins/gestor)
 *
 * SCOPING:
 * - SUPERADMIN/ADMINISTRATIVO: Veem todos os eventos
 * - GESTOR: Vê eventos da sua equipe
 * - VENDEDOR: Vê apenas seus próprios eventos
 */
@Controller('calendar/events')
export class CalendarController {
  private readonly logger = new Logger(CalendarController.name);

  constructor(
    private readonly calendarService: CalendarService,
    private readonly googleService: CalendarGoogleService,
  ) {}

  /**
   * GET /calendar/events
   * Lista eventos do calendário (com scoping por role)
   *
   * Query params:
   * - startDate?: Date - Data de início
   * - endDate?: Date - Data de término
   * - type?: EventType - Tipo de evento
   * - leadId?: string - Filtrar por lead
   * - clientId?: string - Filtrar por cliente
   * - userId?: string - Filtrar por usuário (apenas admins/gestor)
   * - includeRecurring?: boolean - Expandir eventos recorrentes (default: true)
   * - search?: string - Busca por título/descrição
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: EventType,
    @Query('leadId') leadId?: string,
    @Query('clientId') clientId?: string,
    @Query('userId') userId?: string,
    @Query('includeRecurring') includeRecurring?: string,
    @Query('search') search?: string,
  ) {
    // Validar query params com Zod
    const queryDto = QueryCalendarEventsSchema.parse({
      startDate,
      endDate,
      type,
      leadId,
      clientId,
      userId,
      includeRecurring,
      search,
    });

    return this.calendarService.findAll(queryDto, user.id, user.role);
  }

  /**
   * GET /calendar/events/:id
   * Busca evento por ID
   */
  @Get(':id')
  async findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.calendarService.findOne(id, user.id, user.role);
  }

  /**
   * POST /calendar/events
   * Cria novo evento
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateCalendarEventSchema))
    createDto: CreateCalendarEventDto,
  ) {
    return this.calendarService.create(createDto, user.id, user.role);
  }

  /**
   * PUT /calendar/events/:id
   * Atualiza evento
   *
   * Query params:
   * - updateMode?: 'THIS_ONLY' | 'ALL_FUTURE' (default: 'ALL_FUTURE')
   *   - THIS_ONLY: Cria exceção para eventos recorrentes
   *   - ALL_FUTURE: Atualiza toda a série
   */
  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCalendarEventSchema))
    updateDto: UpdateCalendarEventDto,
    @Query('updateMode') updateMode?: 'THIS_ONLY' | 'ALL_FUTURE',
  ) {
    this.logger.log(`[CONTROLLER] PUT /calendar/events/${id} - User: ${user.id}, DTO: ${JSON.stringify(updateDto)}`);

    return this.calendarService.update(
      id,
      updateDto,
      user.id,
      user.role,
      updateMode || 'ALL_FUTURE',
    );
  }

  /**
   * DELETE /calendar/events/:id
   * Remove evento (soft delete)
   *
   * Query params:
   * - deleteMode?: 'THIS_ONLY' | 'ALL_FUTURE' (default: 'ALL_FUTURE')
   *   - THIS_ONLY: Adiciona data à lista de exceções (para recorrentes)
   *   - ALL_FUTURE: Deleta toda a série (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('deleteMode') deleteMode?: 'THIS_ONLY' | 'ALL_FUTURE',
  ) {
    return this.calendarService.remove(
      id,
      user.id,
      user.role,
      deleteMode || 'ALL_FUTURE',
    );
  }
}
