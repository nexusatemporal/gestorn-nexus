import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  Redirect,
} from '@nestjs/common';
import { CalendarGoogleService } from './calendar-google.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { AuthUser } from '@/common/interfaces/auth-user.interface';

/**
 * Calendar Google Controller
 * Endpoints para integração com Google Calendar
 *
 * Funcionalidades:
 * - OAuth2 flow (auth URL + callback)
 * - Status da conexão
 * - Sincronização bidirecional
 * - Desconexão
 *
 * IMPORTANTE:
 * - Todos endpoints requerem autenticação (ClerkAuthGuard global)
 * - Cada usuário gerencia sua própria conexão Google
 */
@Controller('calendar/google')
export class CalendarGoogleController {
  constructor(private readonly googleService: CalendarGoogleService) {}

  /**
   * GET /calendar/google/auth-url
   * Gera URL de autorização OAuth2 para conectar Google Calendar
   *
   * Retorna URL que deve ser aberta em popup/nova aba
   * Após autorização, Google redireciona para /calendar/google/callback
   */
  @Get('auth-url')
  async getAuthUrl(@CurrentUser() user: AuthUser) {
    const authUrl = await this.googleService.getAuthUrl(user.id);

    return {
      authUrl,
      message: 'Abra esta URL para autorizar o acesso ao Google Calendar',
    };
  }

  /**
   * GET /calendar/google/callback
   * Processa callback OAuth2 do Google
   *
   * Query params:
   * - code: Authorization code do Google
   * - state: State contendo userId (base64)
   *
   * Este endpoint é chamado pelo Google após o usuário autorizar.
   * Redireciona de volta para o frontend após processar.
   *
   * IMPORTANTE: @Public() - endpoint não requer autenticação (vem do Google)
   */
  @Public()
  @Get('callback')
  @Redirect()
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    try {
      if (!code || !state) {
        throw new Error('Parâmetros code ou state ausentes');
      }

      await this.googleService.handleOAuthCallback(code, state);

      // Redirecionar para frontend com sucesso
      // Ajustar URL conforme necessário
      return {
        url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/calendar?google_sync=success`,
        statusCode: HttpStatus.FOUND,
      };
    } catch (error) {
      // Redirecionar para frontend com erro
      return {
        url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/calendar?google_sync=error`,
        statusCode: HttpStatus.FOUND,
      };
    }
  }

  /**
   * GET /calendar/google/status
   * Retorna status da conexão Google Calendar do usuário
   *
   * Response:
   * - isConnected: boolean
   * - calendarId?: string (ID do calendário no Google)
   * - scope?: string (escopos concedidos)
   * - expiresAt?: Date (expiração do access token)
   */
  @Get('status')
  async getStatus(@CurrentUser() user: AuthUser) {
    return this.googleService.getConnectionStatus(user.id);
  }

  /**
   * POST /calendar/google/sync
   * Sincroniza eventos do Google Calendar para o Nexus
   *
   * Pull manual de eventos criados/modificados no Google.
   * Importa eventos dos últimos 30 dias e próximos 90 dias.
   *
   * Response:
   * - imported: number (quantidade de eventos importados)
   * - events: Array<CalendarEvent> (eventos importados)
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncFromGoogle(@CurrentUser() user: AuthUser) {
    const events = await this.googleService.syncFromGoogle(user.id);

    return {
      imported: events.length,
      events,
      message: `${events.length} eventos importados do Google Calendar`,
    };
  }

  /**
   * DELETE /calendar/google/disconnect
   * Desconecta Google Calendar (remove tokens armazenados)
   *
   * IMPORTANTE: Não revoga acesso no Google - apenas remove tokens locais.
   * Usuário pode revogar manualmente em: https://myaccount.google.com/permissions
   */
  @Delete('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(@CurrentUser() user: AuthUser) {
    await this.googleService.disconnect(user.id);

    return {
      message: 'Google Calendar desconectado com sucesso',
    };
  }
}
