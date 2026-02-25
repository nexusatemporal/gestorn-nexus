import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarGoogleController } from './calendar-google.controller';
import { CalendarService } from './calendar.service';
import { CalendarGoogleService } from './calendar-google.service';
import { PrismaModule } from '@/prisma/prisma.module';

/**
 * Calendar Module
 * Módulo responsável pelo gerenciamento de eventos do calendário
 *
 * Features:
 * - CRUD de eventos com RBAC
 * - Eventos recorrentes (RRULE)
 * - Associação com Leads e Clientes
 * - Sincronização com Google Calendar (OAuth2 + bidirectional sync)
 */
@Module({
  imports: [PrismaModule],
  controllers: [CalendarController, CalendarGoogleController],
  providers: [CalendarService, CalendarGoogleService],
  exports: [CalendarService, CalendarGoogleService],
})
export class CalendarModule {}
