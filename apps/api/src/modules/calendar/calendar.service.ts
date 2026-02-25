import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  QueryCalendarEventsDto,
} from './dto';
import { UserRole, CalendarEvent } from '@prisma/client';
import { rrulestr, RRule, Weekday } from 'rrule';
import { CalendarGoogleService } from './calendar-google.service';

/**
 * Calendar Service
 * Gerencia eventos do calendário com controle de acesso baseado em roles
 *
 * REGRAS DE ACESSO:
 * - SUPERADMIN/ADMINISTRATIVO: Acesso total a todos os eventos
 * - GESTOR: Acesso aos eventos da sua equipe (vendedores vinculados) + próprios
 * - VENDEDOR: Acesso apenas aos seus próprios eventos
 *
 * EVENTOS RECORRENTES:
 * - Armazenados com RRULE (RFC 5545)
 * - Expansão dinâmica ao buscar eventos
 * - Suporte a exceções via exceptionDates
 *
 * GOOGLE CALENDAR:
 * - Sincronização bidirecional via CalendarGoogleService
 * - Tokens armazenados criptografados
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CalendarGoogleService))
    private readonly googleService: CalendarGoogleService,
  ) {}

  /**
   * Listar eventos do calendário (com scoping por role)
   */
  async findAll(
    query: QueryCalendarEventsDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const {
      startDate,
      endDate,
      type,
      leadId,
      clientId,
      userId,
      includeRecurring,
      search,
    } = query;

    // Construir filtros baseado na role
    const where: any = {
      deletedAt: null, // Apenas eventos não deletados
      type,
      leadId,
      clientId,
    };

    // Filtro de data
    if (startDate || endDate) {
      where.startAt = {};
      if (startDate) where.startAt.gte = startDate;
      if (endDate) where.startAt.lte = endDate;
    }

    // Busca por título
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // RBAC - Aplicar scoping por role
    await this.applyRoleScoping(where, currentUserId, currentUserRole, userId);

    // Buscar eventos
    let events = await this.prisma.calendarEvent.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lead: leadId
          ? {
              select: {
                id: true,
                name: true,
                companyName: true,
              },
            }
          : undefined,
        client: clientId
          ? {
              select: {
                id: true,
                contactName: true,
                company: true,
              },
            }
          : undefined,
      },
      orderBy: { startAt: 'asc' },
    });

    // Expandir eventos recorrentes se solicitado
    if (includeRecurring && startDate && endDate) {
      events = this.expandRecurringEvents(events, startDate, endDate);
    }

    return events;
  }

  /**
   * Buscar evento único
   */
  async findOne(id: string, currentUserId: string, currentUserRole: UserRole) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            name: true,
            companyName: true,
          },
        },
        client: {
          select: {
            id: true,
            contactName: true,
            company: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    // Validar acesso
    await this.validateAccess(event, currentUserId, currentUserRole);

    return event;
  }

  /**
   * Criar novo evento
   */
  async create(
    dto: CreateCalendarEventDto,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    // Validar associações (lead/client) se fornecidas
    if (dto.leadId) {
      await this.validateLeadAccess(dto.leadId, currentUserId, currentUserRole);
    }

    if (dto.clientId) {
      await this.validateClientAccess(
        dto.clientId,
        currentUserId,
        currentUserRole,
      );
    }

    // Validar recorrência
    if (dto.isRecurring && !dto.recurrenceRule) {
      throw new BadRequestException(
        'Eventos recorrentes requerem regra de recorrência',
      );
    }

    // Validar conflito de horário
    await this.checkConflict(
      currentUserId,
      dto.startAt,
      dto.endAt,
      dto.isAllDay,
      null, // Novo evento, não há ID para excluir
    );

    // Criar evento
    const event = await this.prisma.calendarEvent.create({
      data: {
        ...dto,
        userId: currentUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(`Evento criado: ${event.id} por usuário ${currentUserId}`);

    // Sincronizar com Google Calendar (não bloqueia em caso de erro)
    this.googleService.syncEventToGoogle(event, currentUserId).catch((error) => {
      this.logger.warn(
        `Erro ao sincronizar evento ${event.id} com Google: ${error.message}`,
      );
    });

    return event;
  }

  /**
   * Atualizar evento
   * @param updateMode - 'THIS_ONLY' para criar exceção, 'ALL_FUTURE' para atualizar série
   */
  async update(
    id: string,
    dto: UpdateCalendarEventDto,
    currentUserId: string,
    currentUserRole: UserRole,
    updateMode: 'THIS_ONLY' | 'ALL_FUTURE' = 'ALL_FUTURE',
  ) {
    this.logger.log(
      `🔄 UPDATE REQUEST RECEIVED:\n` +
      `  ID: ${id}\n` +
      `  User: ${currentUserId}\n` +
      `  Mode: ${updateMode}\n` +
      `  DTO: ${JSON.stringify(dto, null, 2)}`
    );

    // Verificar se o ID é de uma ocorrência expandida (formato: parentId_timestamp)
    const parsedOccurrence = this.parseOccurrenceId(id);

    this.logger.log(
      `  Parsed Occurrence: ${parsedOccurrence ? `parentId=${parsedOccurrence.parentId}, occurrenceDate=${parsedOccurrence.occurrenceDate.toISOString()}` : 'null (evento normal)'}`
    );

    if (parsedOccurrence) {
      // É uma ocorrência expandida de um evento recorrente
      const { parentId, occurrenceDate } = parsedOccurrence;

      // Buscar evento pai e validar acesso
      const parentEvent = await this.findOne(parentId, currentUserId, currentUserRole);

      if (!parentEvent.isRecurring) {
        throw new BadRequestException('ID de ocorrência inválido: evento pai não é recorrente');
      }

      // Validar novas associações se fornecidas
      if (dto.leadId) {
        await this.validateLeadAccess(dto.leadId, currentUserId, currentUserRole);
      }

      if (dto.clientId) {
        await this.validateClientAccess(dto.clientId, currentUserId, currentUserRole);
      }

      // Se modo é THIS_ONLY, criar exceção
      if (updateMode === 'THIS_ONLY') {
        return this.createRecurringException(parentEvent, dto, currentUserId, occurrenceDate);
      }

      // ═══════════════════════════════════════════════════════════════
      // FIX: Atualização múltipla de ocorrências (modo ALL_FUTURE)
      // ═══════════════════════════════════════════════════════════════
      // Problema: ID da ocorrência contém timestamp que não é atualizado
      // após primeira modificação. Segunda atualização falha porque o
      // timestamp no ID não corresponde mais ao startAt atual do pai.
      //
      // Solução: Para updateMode = 'ALL_FUTURE', ignorar completamente
      // o occurrenceDate do ID e atualizar o pai diretamente.
      // O occurrenceDate só é relevante para updateMode = 'THIS_ONLY'.
      // ═══════════════════════════════════════════════════════════════

      // Se modo é ALL_FUTURE, atualizar evento pai (afeta toda a série)
      // Validar conflito de horário (se estiver alterando data/hora)
      if (dto.startAt || dto.endAt || dto.isAllDay !== undefined) {
        const newStartAt = dto.startAt || parentEvent.startAt;
        const newEndAt = dto.endAt || parentEvent.endAt;
        const newIsAllDay = dto.isAllDay !== undefined ? dto.isAllDay : parentEvent.isAllDay;

        await this.checkConflict(
          parentEvent.userId,
          newStartAt,
          newEndAt,
          newIsAllDay,
          parentId, // Excluir o próprio evento da verificação
        );
      }

      // Se o evento é recorrente e a data/hora mudou, atualizar a RRULE
      const updateData = { ...dto };
      if (parentEvent.isRecurring && parentEvent.recurrenceRule && dto.startAt) {
        const updatedRRule = this.updateRecurrenceRule(
          parentEvent.startAt,
          dto.startAt,
          parentEvent.recurrenceRule,
        );
        updateData.recurrenceRule = updatedRRule;

        this.logger.debug(
          `RRULE atualizada para evento ${parentId}: ${parentEvent.recurrenceRule} -> ${updatedRRule}`,
        );
      }

      const updatedParent = await this.prisma.calendarEvent.update({
        where: { id: parentId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      this.logger.log(
        `Série recorrente atualizada: ${updatedParent.id} por usuário ${currentUserId}`,
      );

      // Sincronizar com Google Calendar
      this.googleService.syncEventToGoogle(updatedParent, currentUserId).catch((error) => {
        this.logger.warn(
          `Erro ao sincronizar evento ${updatedParent.id} com Google: ${error.message}`,
        );
      });

      return updatedParent;
    }

    // Não é uma ocorrência expandida, é um evento normal ou pai
    const event = await this.findOne(id, currentUserId, currentUserRole);

    // Validar novas associações se fornecidas
    if (dto.leadId) {
      await this.validateLeadAccess(dto.leadId, currentUserId, currentUserRole);
    }

    if (dto.clientId) {
      await this.validateClientAccess(
        dto.clientId,
        currentUserId,
        currentUserRole,
      );
    }

    // Validar conflito de horário (se estiver alterando data/hora)
    if (dto.startAt || dto.endAt || dto.isAllDay !== undefined) {
      const newStartAt = dto.startAt || event.startAt;
      const newEndAt = dto.endAt || event.endAt;
      const newIsAllDay = dto.isAllDay !== undefined ? dto.isAllDay : event.isAllDay;

      await this.checkConflict(
        event.userId,
        newStartAt,
        newEndAt,
        newIsAllDay,
        event.id, // Excluir o próprio evento da verificação
      );
    }

    // Atualizar evento
    const updatedEvent = await this.prisma.calendarEvent.update({
      where: { id: event.id },
      data: dto,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Evento atualizado: ${updatedEvent.id} por usuário ${currentUserId}`,
    );

    // Sincronizar com Google Calendar (não bloqueia em caso de erro)
    this.googleService.syncEventToGoogle(updatedEvent, currentUserId).catch((error) => {
      this.logger.warn(
        `Erro ao sincronizar evento ${updatedEvent.id} com Google: ${error.message}`,
      );
    });

    return updatedEvent;
  }

  /**
   * Deletar evento (soft delete)
   * @param deleteMode - 'THIS_ONLY' para criar exceção, 'ALL_FUTURE' para deletar série
   */
  async remove(
    id: string,
    currentUserId: string,
    currentUserRole: UserRole,
    deleteMode: 'THIS_ONLY' | 'ALL_FUTURE' = 'ALL_FUTURE',
  ) {
    // Verificar se o ID é de uma ocorrência expandida
    const parsedOccurrence = this.parseOccurrenceId(id);

    if (parsedOccurrence) {
      // É uma ocorrência expandida de um evento recorrente
      const { parentId, occurrenceDate } = parsedOccurrence;

      // Buscar evento pai e validar acesso
      const parentEvent = await this.findOne(parentId, currentUserId, currentUserRole);

      if (!parentEvent.isRecurring) {
        throw new BadRequestException('ID de ocorrência inválido: evento pai não é recorrente');
      }

      // Se modo é THIS_ONLY, adicionar à lista de exceções
      if (deleteMode === 'THIS_ONLY') {
        await this.prisma.calendarEvent.update({
          where: { id: parentId },
          data: {
            exceptionDates: {
              push: occurrenceDate,
            },
          },
        });

        this.logger.log(
          `Ocorrência excluída: ${occurrenceDate.toISOString()} do evento ${parentId} por usuário ${currentUserId}`,
        );

        return { message: 'Ocorrência excluída com sucesso' };
      }

      // Se modo é ALL_FUTURE, deletar a série inteira (soft delete do pai)
      await this.prisma.calendarEvent.update({
        where: { id: parentId },
        data: { deletedAt: new Date() },
      });

      this.logger.log(`Série recorrente deletada: ${parentId} por usuário ${currentUserId}`);

      // Remover do Google Calendar
      this.googleService.deleteEventFromGoogle(parentEvent, currentUserId).catch((error) => {
        this.logger.warn(
          `Erro ao deletar evento ${parentId} do Google: ${error.message}`,
        );
      });

      return { message: 'Série excluída com sucesso' };
    }

    // Não é uma ocorrência expandida, é um evento normal ou pai
    const event = await this.findOne(id, currentUserId, currentUserRole);

    await this.prisma.calendarEvent.update({
      where: { id: event.id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Evento deletado: ${event.id} por usuário ${currentUserId}`);

    // Remover do Google Calendar (não bloqueia em caso de erro)
    this.googleService.deleteEventFromGoogle(event, currentUserId).catch((error) => {
      this.logger.warn(
        `Erro ao deletar evento ${event.id} do Google: ${error.message}`,
      );
    });

    return { message: 'Evento excluído com sucesso' };
  }

  /**
   * Aplicar scoping de RBAC nos filtros
   */
  private async applyRoleScoping(
    where: any,
    currentUserId: string,
    currentUserRole: UserRole,
    requestedUserId?: string,
  ) {
    // GESTOR: Ver apenas eventos da equipe
    if (currentUserRole === UserRole.GESTOR) {
      const vendedores = await this.prisma.user.findMany({
        where: { gestorId: currentUserId },
        select: { id: true },
      });

      const vendedorIds = vendedores.map((v) => v.id);
      vendedorIds.push(currentUserId); // Incluir eventos do próprio gestor

      where.userId = { in: vendedorIds };

      // Se filtrou por userId, validar se pertence à equipe
      if (requestedUserId && !vendedorIds.includes(requestedUserId)) {
        throw new ForbiddenException(
          'Você não tem acesso aos eventos deste usuário',
        );
      }
    }

    // VENDEDOR: Ver apenas seus próprios eventos
    if (currentUserRole === UserRole.VENDEDOR) {
      where.userId = currentUserId;

      // Ignorar filtro de userId se não for o próprio
      if (requestedUserId && requestedUserId !== currentUserId) {
        throw new ForbiddenException(
          'Você só pode visualizar seus próprios eventos',
        );
      }
    }

    // SUPERADMIN/ADMINISTRATIVO podem filtrar por userId livremente
    if (
      (currentUserRole === UserRole.SUPERADMIN ||
        currentUserRole === UserRole.ADMINISTRATIVO) &&
      requestedUserId
    ) {
      where.userId = requestedUserId;
    }
  }

  /**
   * Validar acesso a um evento específico
   */
  private async validateAccess(
    event: CalendarEvent,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    // SUPERADMIN/ADMINISTRATIVO têm acesso total
    if (
      currentUserRole === UserRole.SUPERADMIN ||
      currentUserRole === UserRole.ADMINISTRATIVO
    ) {
      return;
    }

    // VENDEDOR só acessa seus próprios eventos
    if (currentUserRole === UserRole.VENDEDOR) {
      if (event.userId !== currentUserId) {
        throw new ForbiddenException(
          'Você não tem permissão para acessar este evento',
        );
      }
      return;
    }

    // GESTOR acessa eventos da equipe
    if (currentUserRole === UserRole.GESTOR) {
      const eventOwner = await this.prisma.user.findUnique({
        where: { id: event.userId },
        select: { gestorId: true },
      });

      if (event.userId !== currentUserId && eventOwner?.gestorId !== currentUserId) {
        throw new ForbiddenException(
          'Você não tem permissão para acessar este evento',
        );
      }
    }
  }

  /**
   * Validar acesso a um lead
   */
  private async validateLeadAccess(
    leadId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, vendedorId: true },
    });

    if (!lead) {
      throw new NotFoundException('Lead não encontrado');
    }

    // SUPERADMIN/ADMINISTRATIVO têm acesso total
    if (
      currentUserRole === UserRole.SUPERADMIN ||
      currentUserRole === UserRole.ADMINISTRATIVO
    ) {
      return;
    }

    // VENDEDOR só acessa seus próprios leads
    if (currentUserRole === UserRole.VENDEDOR) {
      if (lead.vendedorId !== currentUserId) {
        throw new ForbiddenException(
          'Você não tem permissão para associar este lead',
        );
      }
      return;
    }

    // GESTOR acessa leads da equipe
    if (currentUserRole === UserRole.GESTOR) {
      if (lead.vendedorId) {
        const leadOwner = await this.prisma.user.findUnique({
          where: { id: lead.vendedorId },
          select: { gestorId: true },
        });

        if (
          lead.vendedorId !== currentUserId &&
          leadOwner?.gestorId !== currentUserId
        ) {
          throw new ForbiddenException(
            'Você não tem permissão para associar este lead',
          );
        }
      }
    }
  }

  /**
   * Validar acesso a um cliente
   */
  private async validateClientAccess(
    clientId: string,
    currentUserId: string,
    currentUserRole: UserRole,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, vendedorId: true },
    });

    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    // SUPERADMIN/ADMINISTRATIVO têm acesso total
    if (
      currentUserRole === UserRole.SUPERADMIN ||
      currentUserRole === UserRole.ADMINISTRATIVO
    ) {
      return;
    }

    // VENDEDOR só acessa seus próprios clientes
    if (currentUserRole === UserRole.VENDEDOR) {
      if (client.vendedorId !== currentUserId) {
        throw new ForbiddenException(
          'Você não tem permissão para associar este cliente',
        );
      }
      return;
    }

    // GESTOR acessa clientes da equipe
    if (currentUserRole === UserRole.GESTOR) {
      if (client.vendedorId) {
        const clientOwner = await this.prisma.user.findUnique({
          where: { id: client.vendedorId },
          select: { gestorId: true },
        });

        if (
          client.vendedorId !== currentUserId &&
          clientOwner?.gestorId !== currentUserId
        ) {
          throw new ForbiddenException(
            'Você não tem permissão para associar este cliente',
          );
        }
      }
    }
  }

  /**
   * Parsear ID de ocorrência expandida
   * Formato esperado: "parentId_2026-01-20T10:00:00.000Z"
   * @returns { parentId, occurrenceDate } ou null se não for uma ocorrência expandida
   */
  private parseOccurrenceId(id: string): { parentId: string; occurrenceDate: Date } | null {
    // IDs de ocorrências expandidas contêm um underscore seguido de timestamp ISO
    const lastUnderscoreIndex = id.lastIndexOf('_');

    if (lastUnderscoreIndex === -1) {
      return null; // Não é uma ocorrência expandida
    }

    const parentId = id.substring(0, lastUnderscoreIndex);
    const timestampStr = id.substring(lastUnderscoreIndex + 1);

    // Validar se o timestamp é uma data ISO válida
    try {
      const occurrenceDate = new Date(timestampStr);
      if (isNaN(occurrenceDate.getTime())) {
        return null;
      }
      return { parentId, occurrenceDate };
    } catch {
      return null;
    }
  }

  /**
   * Expandir eventos recorrentes em ocorrências individuais
   * Usa biblioteca rrule para parsing de RRULE (RFC 5545)
   *
   * Funcionalidades:
   * - Parseia recurrenceRule e gera ocorrências no intervalo [startDate, endDate]
   * - Pula datas em exceptionDates (eventos editados individualmente)
   * - Calcula startAt e endAt de cada ocorrência baseado na duração original
   * - Respeita recurrenceEnd se definido
   * - Gera IDs únicos para cada ocorrência (parent_id + ISO timestamp)
   */
  private expandRecurringEvents(
    events: any[],
    startDate: Date,
    endDate: Date,
  ): any[] {
    const expanded = [];

    for (const event of events) {
      // Eventos não recorrentes são incluídos diretamente
      if (!event.isRecurring || !event.recurrenceRule) {
        expanded.push(event);
        continue;
      }

      try {
        // ═══════════════════════════════════════════════════════════════
        // FIX TIMEZONE V3: Conversão correta de UTC → BRT para rrule
        // ═══════════════════════════════════════════════════════════════
        // Problema: event.startAt está em UTC, mas precisamos interpretar
        // como horário de Brasília para gerar ocorrências corretas
        //
        // Exemplo:
        // - Banco: 2026-01-21T16:00:00.000Z (UTC)
        // - Deveria ser: 2026-01-21T13:00:00 (BRT)
        //
        // Solução: Criar Date que representa o momento correto em BRT
        // ═══════════════════════════════════════════════════════════════

        // Converter startAt (UTC) para componentes de data em BRT
        const utcStart = new Date(event.startAt);
        const brtStart = new Date(utcStart.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

        this.logger.debug(
          `Convertendo DTSTART: UTC ${utcStart.toISOString()} → BRT ${brtStart.toLocaleString('pt-BR')}`
        );

        // Parsear RRULE com dtstart em BRT
        const rule = rrulestr(event.recurrenceRule, {
          dtstart: brtStart,
          tzid: 'America/Sao_Paulo',
        });

        // Se houver recurrenceEnd, usar o menor entre ele e endDate
        const effectiveEndDate = event.recurrenceEnd
          ? new Date(Math.min(event.recurrenceEnd.getTime(), endDate.getTime()))
          : endDate;

        // Gerar ocorrências no intervalo (em BRT)
        let occurrences = rule.between(startDate, effectiveEndDate, true);

        // ═══════════════════════════════════════════════════════════════
        // FIX BUG #1 (CORRIGIDO V2): TIMEZONE +3h em TODAS as ocorrências
        // Problema: rule.between() retorna datas em UTC que precisam
        // ser interpretadas como horário local de Brasília (BRT/UTC-3)
        // Solução: Não ajustar nada - rrule já retorna correto com tzid
        // ═══════════════════════════════════════════════════════════════

        // ═══════════════════════════════════════════════════════════════
        // FIX BUG #2 (V3): PRIMEIRA OCORRÊNCIA + DUPLICATA
        // Problema Original: rrule.between() pula DTSTART se não está no BYDAY
        // Problema Adicional: Se DTSTART está no BYDAY, cria DUPLICATA
        //
        // Exemplo Problema 1: DTSTART quinta, BYDAY=MO,WE,FR → pula quinta
        // Exemplo Problema 2: DTSTART quarta, BYDAY=MO,WE,FR → 2x quarta
        //
        // Solução V3: Usar brtStart (data convertida para BRT) para verificações
        // ═══════════════════════════════════════════════════════════════

        // Usar brtStart para verificações (já está em BRT)
        const dtstart = brtStart;

        // Verificar se DTSTART está no intervalo solicitado
        if (dtstart >= startDate && dtstart <= effectiveEndDate) {
          // Extrair dia da semana do DTSTART (0=domingo, 6=sábado)
          const dtstartWeekday = dtstart.getDay();

          // Extrair dias do BYDAY da regra
          const ruleOptions = rule.origOptions;
          let bydayWeekdays: number[] = [];

          if (ruleOptions.byweekday) {
            const weekdayToJsMap = [1, 2, 3, 4, 5, 6, 0]; // [MO, TU, WE, TH, FR, SA, SU]
            const byweekdayArray = Array.isArray(ruleOptions.byweekday)
              ? ruleOptions.byweekday
              : [ruleOptions.byweekday];

            bydayWeekdays = byweekdayArray.map((day: any) => {
              const dayNum = typeof day === 'number' ? day : day.weekday;
              return weekdayToJsMap[dayNum];
            });
          }

          // Só adicionar DTSTART se o dia NÃO está no BYDAY
          const dtstartDayInByday = bydayWeekdays.includes(dtstartWeekday);

          if (!dtstartDayInByday) {
            // DTSTART não está no BYDAY → adicionar manualmente
            const dtstartISO = dtstart.toISOString();
            const hasStart = occurrences.some(occ => occ.toISOString() === dtstartISO);

            if (!hasStart) {
              occurrences.unshift(dtstart);
              this.logger.debug(
                `DTSTART ${dtstartISO} (dia ${dtstartWeekday}) adicionado manualmente ` +
                `pois não está no BYDAY [${bydayWeekdays.join(',')}]`
              );
            }
          } else {
            // DTSTART está no BYDAY → rrule já vai gerar, não adicionar
            this.logger.debug(
              `DTSTART (dia ${dtstartWeekday}) JÁ está no BYDAY [${bydayWeekdays.join(',')}] ` +
              `- não adicionar duplicata`
            );
          }
        }

        // Converter exceptionDates para Set para lookup rápido
        const exceptionSet = new Set(
          (event.exceptionDates || []).map((d: Date) => d.toISOString())
        );

        // Calcular duração do evento (para aplicar em cada ocorrência)
        const duration = event.endAt.getTime() - event.startAt.getTime();

        // Criar evento para cada ocorrência
        for (const occurrenceStart of occurrences) {
          // ═══════════════════════════════════════════════════════════════
          // FIX TIMEZONE V3: Converter BRT → UTC para armazenamento
          // ═══════════════════════════════════════════════════════════════
          // occurrenceStart está em BRT (gerado pela rrule com tzid)
          // Precisamos converter para UTC para manter consistência com o banco
          //
          // Estratégia: Pegar os componentes de data/hora da occurrenceStart (BRT)
          // e criar um Date UTC com esses mesmos valores
          // ═══════════════════════════════════════════════════════════════

          // Pegar componentes da data BRT
          const year = occurrenceStart.getFullYear();
          const month = occurrenceStart.getMonth();
          const day = occurrenceStart.getDate();
          const hours = occurrenceStart.getHours();
          const minutes = occurrenceStart.getMinutes();
          const seconds = occurrenceStart.getSeconds();

          // Criar Date UTC com os mesmos componentes
          const occurrenceStartUTC = new Date(Date.UTC(year, month, day, hours, minutes, seconds));

          // Pular se está na lista de exceções
          if (exceptionSet.has(occurrenceStartUTC.toISOString())) {
            this.logger.debug(
              `Pulando ocorrência em ${occurrenceStartUTC.toISOString()} - está em exceptionDates`
            );
            continue;
          }

          // Calcular endAt da ocorrência (mantendo a duração original)
          const occurrenceEndUTC = new Date(occurrenceStartUTC.getTime() + duration);

          // Criar objeto de evento para esta ocorrência
          expanded.push({
            ...event,
            // ID único: parentId + timestamp ISO (UTC)
            id: `${event.id}_${occurrenceStartUTC.toISOString()}`,
            startAt: occurrenceStartUTC,
            endAt: occurrenceEndUTC,
            parentEventId: event.id, // Referência ao evento pai
            // Marcar como ocorrência expandida (não é o evento pai em si)
            _isExpandedOccurrence: true,
          });
        }

        this.logger.debug(
          `Expandido evento recorrente ${event.id}: ${occurrences.length} ocorrências (${occurrences.length - exceptionSet.size} após filtrar exceções)`
        );

      } catch (error) {
        this.logger.error(
          `Erro ao expandir evento recorrente ${event.id}: ${error.message}`,
          error.stack
        );
        // Em caso de erro, incluir o evento pai sem expandir
        expanded.push(event);
      }
    }

    return expanded;
  }

  /**
   * Criar exceção para evento recorrente (editar "somente este")
   * @param parent - Evento pai recorrente
   * @param updates - Campos a atualizar
   * @param currentUserId - ID do usuário fazendo a edição
   * @param occurrenceDate - Data da ocorrência (opcional, usa parent.startAt se não fornecido)
   */
  private async createRecurringException(
    parent: any,
    updates: UpdateCalendarEventDto,
    currentUserId: string,
    occurrenceDate?: Date,
  ) {
    const parentId = parent.id;

    // Determinar data da ocorrência
    const exceptionDate = occurrenceDate || parent.startAt;

    // Calcular duração original do evento
    const duration = parent.endAt.getTime() - parent.startAt.getTime();

    // Calcular startAt e endAt da exceção
    // Se updates contém startAt, usar; caso contrário, usar occurrenceDate
    const exceptionStartAt = updates.startAt || exceptionDate;
    const exceptionEndAt = updates.endAt || new Date(exceptionStartAt.getTime() + duration);

    // Adicionar data à lista de exceções do pai
    await this.prisma.calendarEvent.update({
      where: { id: parentId },
      data: {
        exceptionDates: {
          push: exceptionDate,
        },
      },
    });

    // Criar novo evento standalone com as alterações
    const newEvent = await this.prisma.calendarEvent.create({
      data: {
        title: updates.title || parent.title,
        description: updates.description !== undefined ? updates.description : parent.description,
        type: updates.type || parent.type,
        startAt: exceptionStartAt,
        endAt: exceptionEndAt,
        isAllDay: updates.isAllDay !== undefined ? updates.isAllDay : parent.isAllDay,
        attendeesCount: updates.attendeesCount || parent.attendeesCount,
        location: updates.location !== undefined ? updates.location : parent.location,
        meetingUrl: updates.meetingUrl !== undefined ? updates.meetingUrl : parent.meetingUrl,
        reminderMinutes: updates.reminderMinutes || parent.reminderMinutes,
        leadId: updates.leadId !== undefined ? updates.leadId : parent.leadId,
        clientId: updates.clientId !== undefined ? updates.clientId : parent.clientId,
        parentEventId: parentId,
        isRecurring: false,
        recurrenceRule: null,
        recurrenceEnd: null,
        userId: currentUserId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Exceção criada para evento recorrente: ${newEvent.id} (pai: ${parentId}, data: ${exceptionDate.toISOString()})`,
    );

    // Sincronizar exceção com Google Calendar
    this.googleService.syncEventToGoogle(newEvent, currentUserId).catch((error) => {
      this.logger.warn(
        `Erro ao sincronizar exceção ${newEvent.id} com Google: ${error.message}`,
      );
    });

    return newEvent;
  }

  /**
   * Verificar conflito de horário
   * @param userId - ID do usuário (eventos de outros usuários não são considerados conflito)
   * @param startAt - Data/hora de início do evento
   * @param endAt - Data/hora de término do evento
   * @param isAllDay - Se o evento é all-day
   * @param excludeEventId - ID do evento a excluir da verificação (útil ao editar)
   * @throws BadRequestException se houver conflito
   */
  private async checkConflict(
    userId: string,
    startAt: Date,
    endAt: Date,
    isAllDay: boolean,
    excludeEventId: string | null,
  ): Promise<void> {
    // Buscar eventos do usuário que possam conflitar
    const where: any = {
      userId,
      deletedAt: null,
    };

    // Excluir o próprio evento se estiver editando
    if (excludeEventId) {
      where.id = { not: excludeEventId };
    }

    // Buscar todos os eventos do usuário
    const events = await this.prisma.calendarEvent.findMany({
      where,
      select: {
        id: true,
        startAt: true,
        endAt: true,
        isAllDay: true,
        title: true,
        isRecurring: true,
      },
    });

    this.logger.debug(
      `checkConflict: Verificando conflito para ${startAt.toISOString()} - ${endAt.toISOString()} ` +
      `(excludeEventId: ${excludeEventId}). Encontrados ${events.length} eventos para verificar.`,
    );

    // Verificar conflitos
    for (const event of events) {
      // REGRA 1: Não pode ter 2 eventos all-day no mesmo dia
      if (isAllDay && event.isAllDay) {
        const eventDate = new Date(event.startAt).toDateString();
        const newEventDate = new Date(startAt).toDateString();

        if (eventDate === newEventDate) {
          throw new BadRequestException(
            `Conflito de horário detectado. Já existe um evento de dia inteiro agendado para ${newEventDate}.`,
          );
        }
      }

      // REGRA 2: Eventos com horário específico não podem ter sobreposição parcial ou total
      // (Ambos devem ser NÃO all-day para verificar conflito)
      if (!isAllDay && !event.isAllDay) {
        // Verificar sobreposição
        // Sobreposição acontece quando:
        // - O novo evento começa antes do existente terminar E
        // - O novo evento termina depois do existente começar
        const hasOverlap = startAt < event.endAt && endAt > event.startAt;

        if (hasOverlap) {
          this.logger.error(
            `❌ CONFLITO DETECTADO!\n` +
            `  Evento existente: "${event.title}" (${event.id})\n` +
            `  - startAt: ${event.startAt.toISOString()}\n` +
            `  - endAt: ${event.endAt.toISOString()}\n` +
            `  - isRecurring: ${event.isRecurring}\n` +
            `  Novo horário:\n` +
            `  - startAt: ${startAt.toISOString()}\n` +
            `  - endAt: ${endAt.toISOString()}\n` +
            `  Lógica: startAt(${startAt.toISOString()}) < event.endAt(${event.endAt.toISOString()}) = ${startAt < event.endAt}\n` +
            `  Lógica: endAt(${endAt.toISOString()}) > event.startAt(${event.startAt.toISOString()}) = ${endAt > event.startAt}`
          );

          // Formatar datas para mensagem amigável (timezone Brasília)
          const eventStartStr = event.startAt.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          });
          const eventEndStr = event.endAt.toLocaleString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
          });

          throw new BadRequestException(
            `Conflito de horário detectado. Já existe o evento "${event.title}" agendado de ${eventStartStr} até ${eventEndStr}.`,
          );
        }
      }

      // REGRA 3: Eventos all-day PODEM coexistir com eventos de horário específico no mesmo dia
      // (garantido pela condição acima: só verifica conflito se AMBOS forem não-all-day)
    }

    this.logger.debug(
      `Verificação de conflito concluída para usuário ${userId}: nenhum conflito encontrado`,
    );
  }

  /**
   * Atualiza a RRULE de um evento recorrente quando a data/hora muda
   * Preserva a frequência e outros parâmetros, mas desloca TODOS os dias se BYDAY existir
   */
  private updateRecurrenceRule(
    originalStartAt: Date,
    newStartAt: Date,
    currentRRule: string,
  ): string {
    try {
      // Parsear a RRULE atual
      const rule = rrulestr(currentRRule, {
        dtstart: originalStartAt,
        tzid: 'America/Sao_Paulo',
      });

      // Extrair as opções da regra
      const options = rule.origOptions;

      // Mapear dias da semana: 0 = domingo, 1 = segunda, ..., 6 = sábado (JS Date)
      // Para RRULE Weekday objects
      const weekdayMap = [
        new Weekday(6), // Domingo (0) -> SU
        new Weekday(0), // Segunda (1) -> MO
        new Weekday(1), // Terça (2) -> TU
        new Weekday(2), // Quarta (3) -> WE
        new Weekday(3), // Quinta (4) -> TH
        new Weekday(4), // Sexta (5) -> FR
        new Weekday(5), // Sábado (6) -> SA
      ];

      // Se a regra tem BYDAY, deslocar TODOS os dias pelo offset
      if (options.byweekday && options.freq === RRule.WEEKLY) {
        const originalWeekday = originalStartAt.getDay(); // 0-6 (domingo-sábado)
        const newWeekday = newStartAt.getDay(); // 0-6 (domingo-sábado)

        // Calcular offset (quantos dias avançou ou retrocedeu)
        let offset = newWeekday - originalWeekday;

        // Normalizar offset para range 0-6 (ex: -1 vira 6, 7 vira 0)
        if (offset < 0) offset += 7;
        if (offset > 6) offset -= 7;

        // Converter byweekday atual para array de números (0-6)
        const currentDays = Array.isArray(options.byweekday)
          ? options.byweekday
          : [options.byweekday];

        // Aplicar offset a cada dia (mapeamento reverso: Weekday -> JS Date day)
        // RRULE Weekday: 0=MO, 1=TU, 2=WE, 3=TH, 4=FR, 5=SA, 6=SU
        // JS Date: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
        const weekdayToJsMap = [1, 2, 3, 4, 5, 6, 0]; // [MO, TU, WE, TH, FR, SA, SU]

        const newDays = currentDays.map((day: any) => {
          // Extrair o número do dia (0-6 no formato RRULE)
          const dayNum = typeof day === 'number' ? day : day.weekday;

          // Converter para JS Date day (0=domingo)
          const jsDay = weekdayToJsMap[dayNum];

          // Aplicar offset
          let newJsDay = (jsDay + offset) % 7;
          if (newJsDay < 0) newJsDay += 7;

          // Converter de volta para Weekday
          return weekdayMap[newJsDay];
        });

        options.byweekday = newDays;

        // ═══════════════════════════════════════════════════════════════
        // FIX BUG #3: DRAG-AND-DROP
        // Problema: Novo DTSTART não é validado contra novo BYDAY
        // Exemplo: Arrasta sexta→sábado, BYDAY vira SA-TU-TH, mas DTSTART
        // não inclui SA automaticamente → rrule pula para domingo
        // Solução: Validar e adicionar dia do DTSTART ao BYDAY
        // ═══════════════════════════════════════════════════════════════
        const newStartWeekdayRRule = weekdayMap[newWeekday].weekday;
        const newDaysNumbers = newDays.map((d: any) => d.weekday);

        if (!newDaysNumbers.includes(newStartWeekdayRRule)) {
          this.logger.warn(
            `DTSTART (dia ${newWeekday}) NÃO está em BYDAY [${newDaysNumbers}]. ` +
            `Adicionando ${newStartWeekdayRRule} ao BYDAY para evitar pulo.`
          );
          newDays.push(weekdayMap[newWeekday]);
          options.byweekday = newDays;
        }

        this.logger.debug(
          `Dias deslocados em ${offset}: ${currentDays.map((d: any) => typeof d === 'number' ? d : d.weekday)} -> ${newDays.map((d: any) => d.weekday)}`,
        );
      }

      // Atualizar dtstart
      options.dtstart = newStartAt;

      // Criar nova regra com as opções atualizadas (garantir que freq existe)
      if (!options.freq) {
        this.logger.warn('RRULE sem frequência definida, retornando original');
        return currentRRule;
      }

      const newRule = new RRule(options as any);

      return newRule.toString();
    } catch (error) {
      this.logger.error(
        `Erro ao atualizar RRULE: ${error.message}. Retornando RRULE original.`,
      );
      return currentRRule;
    }
  }
}
