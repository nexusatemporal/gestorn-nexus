import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * CalendarGoogleService
 *
 * Gerencia integração bidirecional com Google Calendar via OAuth2
 *
 * Funcionalidades:
 * - OAuth2 flow (authorization URL + callback handling)
 * - Token encryption/decryption (AES-256-GCM)
 * - Auto-refresh de access tokens
 * - Sync Nexus → Google (create, update, delete)
 * - Sync Google → Nexus (pull events)
 * - Error handling e retry logic
 *
 * Segurança:
 * - Tokens armazenados criptografados com AES-256-GCM
 * - Chave de criptografia em variável de ambiente
 * - Auto-refresh previne tokens expirados
 */
@Injectable()
export class CalendarGoogleService {
  private readonly logger = new Logger(CalendarGoogleService.name);
  private readonly oauth2Client: OAuth2Client;
  private readonly encryptionKey: Buffer;

  // Escopos necessários do Google Calendar API
  private readonly SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Configurar OAuth2 Client
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GOOGLE_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      this.logger.warn(
        'Google Calendar OAuth2 credentials não configuradas - sync desabilitado'
      );
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    // Derivar chave de criptografia de 32 bytes
    const encryptionPassword = this.configService.get<string>('ENCRYPTION_KEY');
    if (!encryptionPassword) {
      this.logger.warn('ENCRYPTION_KEY não configurada - tokens não serão criptografados');
      this.encryptionKey = Buffer.alloc(32); // Fallback inseguro
    } else {
      this.encryptionKey = scryptSync(encryptionPassword, 'salt', 32);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // OAUTH2 FLOW
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Gerar URL de autorização OAuth2
   * @param userId - ID do usuário que está conectando
   */
  async getAuthUrl(userId: string): Promise<string> {
    // Incluir userId no state para identificar quem está autorizando
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Para receber refresh_token
      scope: this.SCOPES,
      state,
      prompt: 'consent', // Forçar tela de consentimento para garantir refresh_token
    });

    this.logger.log(`URL de autorização gerada para usuário ${userId}`);
    this.logger.debug(`🔍 REDIRECT_URI configurada: ${this.configService.get<string>('GOOGLE_REDIRECT_URI')}`);
    this.logger.debug(`🔗 Auth URL completa: ${authUrl}`);
    return authUrl;
  }

  /**
   * Processar callback OAuth2 e armazenar tokens
   * @param code - Authorization code retornado pelo Google
   * @param state - State contendo userId
   */
  async handleOAuthCallback(code: string, state: string): Promise<void> {
    try {
      // Decodificar state
      const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

      if (!userId) {
        throw new BadRequestException('State inválido: userId não encontrado');
      }

      // Trocar code por tokens
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new InternalServerErrorException(
          'Google não retornou tokens necessários'
        );
      }

      // Calcular expiração
      const expiresAt = new Date();
      if (tokens.expiry_date) {
        expiresAt.setTime(tokens.expiry_date);
      } else {
        expiresAt.setHours(expiresAt.getHours() + 1); // Default 1 hora
      }

      // Criptografar tokens
      const encryptedAccessToken = this.encrypt(tokens.access_token);
      const encryptedRefreshToken = this.encrypt(tokens.refresh_token);

      // Armazenar no banco
      await this.prisma.googleCalendarToken.upsert({
        where: { userId },
        create: {
          userId,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          scope: tokens.scope || this.SCOPES.join(' '),
          calendarId: 'primary',
        },
        update: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          scope: tokens.scope || this.SCOPES.join(' '),
        },
      });

      this.logger.log(`Tokens Google Calendar armazenados para usuário ${userId}`);
    } catch (error) {
      this.logger.error(
        `Erro ao processar callback OAuth2: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Erro ao conectar com Google Calendar'
      );
    }
  }

  /**
   * Desconectar Google Calendar (deletar tokens)
   * @param userId - ID do usuário
   */
  async disconnect(userId: string): Promise<void> {
    await this.prisma.googleCalendarToken.delete({
      where: { userId },
    });

    this.logger.log(`Google Calendar desconectado para usuário ${userId}`);
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // TOKEN MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Obter access token válido (com auto-refresh se expirado)
   * @param userId - ID do usuário
   * @returns Access token descriptografado
   */
  private async getAccessToken(userId: string): Promise<string> {
    const tokenRecord = await this.prisma.googleCalendarToken.findUnique({
      where: { userId },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException(
        'Google Calendar não conectado para este usuário'
      );
    }

    // Verificar se token expirou
    const now = new Date();
    const isExpired = tokenRecord.expiresAt <= now;

    if (!isExpired) {
      // Token ainda válido, descriptografar e retornar
      return this.decrypt(tokenRecord.accessToken);
    }

    // Token expirado, fazer refresh
    this.logger.debug(`Access token expirado para usuário ${userId}, fazendo refresh...`);

    try {
      const refreshToken = this.decrypt(tokenRecord.refreshToken);
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new Error('Refresh não retornou novo access token');
      }

      // Calcular nova expiração
      const newExpiresAt = new Date();
      if (credentials.expiry_date) {
        newExpiresAt.setTime(credentials.expiry_date);
      } else {
        newExpiresAt.setHours(newExpiresAt.getHours() + 1);
      }

      // Atualizar no banco
      await this.prisma.googleCalendarToken.update({
        where: { userId },
        data: {
          accessToken: this.encrypt(credentials.access_token),
          expiresAt: newExpiresAt,
        },
      });

      this.logger.log(`Access token renovado para usuário ${userId}`);
      return credentials.access_token;
    } catch (error) {
      this.logger.error(
        `Erro ao fazer refresh do token para usuário ${userId}: ${error.message}`,
        error.stack,
      );
      throw new UnauthorizedException(
        'Token Google expirado - necessário reconectar'
      );
    }
  }

  /**
   * Obter cliente Google Calendar autenticado
   * @param userId - ID do usuário
   */
  private async getCalendarClient(
    userId: string,
  ): Promise<calendar_v3.Calendar> {
    const accessToken = await this.getAccessToken(userId);

    this.oauth2Client.setCredentials({
      access_token: accessToken,
    });

    return google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SYNC: NEXUS → GOOGLE
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Sincronizar evento do Nexus para o Google Calendar
   * Cria ou atualiza o evento no Google
   *
   * @param event - Evento do Nexus (CalendarEvent)
   * @param userId - ID do usuário dono do evento
   */
  async syncEventToGoogle(event: any, userId: string): Promise<void> {
    try {
      // Verificar se usuário tem Google Calendar conectado
      const tokenRecord = await this.prisma.googleCalendarToken.findUnique({
        where: { userId },
      });

      if (!tokenRecord) {
        this.logger.debug(
          `Google Calendar não conectado para usuário ${userId} - pulando sync`
        );
        return;
      }

      const calendar = await this.getCalendarClient(userId);
      const calendarId = tokenRecord.calendarId;

      // Converter evento Nexus para formato Google Calendar
      const googleEvent: calendar_v3.Schema$Event = {
        summary: event.title,
        description: event.description || undefined,
        location: event.location || undefined,
        start: event.isAllDay
          ? { date: event.startAt.toISOString().split('T')[0] }
          : { dateTime: event.startAt.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: event.isAllDay
          ? { date: event.endAt.toISOString().split('T')[0] }
          : { dateTime: event.endAt.toISOString(), timeZone: 'America/Sao_Paulo' },
        reminders: {
          useDefault: false,
          overrides: (event.reminderMinutes || [30]).map((minutes: number) => ({
            method: 'popup',
            minutes,
          })),
        },
      };

      // Se evento tem recorrência, adicionar RRULE
      if (event.isRecurring && event.recurrenceRule) {
        googleEvent.recurrence = [event.recurrenceRule];
      }

      // Se evento já foi sincronizado antes, fazer UPDATE
      if (event.googleEventId) {
        await calendar.events.update({
          calendarId,
          eventId: event.googleEventId,
          requestBody: googleEvent,
        });

        this.logger.debug(
          `Evento ${event.id} atualizado no Google Calendar (googleEventId: ${event.googleEventId})`
        );
      } else {
        // Criar novo evento no Google
        const response = await calendar.events.insert({
          calendarId,
          requestBody: googleEvent,
        });

        const googleEventId = response.data.id;

        if (!googleEventId) {
          throw new Error('Google não retornou ID do evento criado');
        }

        // Armazenar googleEventId no banco
        await this.prisma.calendarEvent.update({
          where: { id: event.id },
          data: {
            googleEventId,
            googleCalendarId: calendarId,
            googleSyncStatus: 'SYNCED',
            googleLastSync: new Date(),
          },
        });

        this.logger.debug(
          `Evento ${event.id} criado no Google Calendar (googleEventId: ${googleEventId})`
        );
      }

      // Atualizar status de sync
      await this.prisma.calendarEvent.update({
        where: { id: event.id },
        data: {
          googleSyncStatus: 'SYNCED',
          googleLastSync: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Erro ao sincronizar evento ${event.id} para Google: ${error.message}`,
        error.stack,
      );

      // Marcar como erro no banco
      await this.prisma.calendarEvent.update({
        where: { id: event.id },
        data: {
          googleSyncStatus: 'ERROR',
        },
      }).catch(() => {
        // Ignorar erro ao atualizar status
      });

      // Não propagar erro - sync não deve bloquear operação principal
    }
  }

  /**
   * Deletar evento do Google Calendar
   * @param event - Evento do Nexus
   * @param userId - ID do usuário
   */
  async deleteEventFromGoogle(event: any, userId: string): Promise<void> {
    try {
      if (!event.googleEventId) {
        this.logger.debug(`Evento ${event.id} não tem googleEventId - nada a deletar`);
        return;
      }

      const tokenRecord = await this.prisma.googleCalendarToken.findUnique({
        where: { userId },
      });

      if (!tokenRecord) {
        this.logger.debug(
          `Google Calendar não conectado para usuário ${userId} - pulando delete`
        );
        return;
      }

      const calendar = await this.getCalendarClient(userId);
      const calendarId = tokenRecord.calendarId;

      await calendar.events.delete({
        calendarId,
        eventId: event.googleEventId,
      });

      this.logger.debug(
        `Evento ${event.id} deletado do Google Calendar (googleEventId: ${event.googleEventId})`
      );
    } catch (error) {
      // Se erro é 404 (evento já não existe), ignorar
      if (error.code === 404) {
        this.logger.debug(
          `Evento ${event.googleEventId} não encontrado no Google (já deletado)`
        );
        return;
      }

      this.logger.error(
        `Erro ao deletar evento ${event.id} do Google: ${error.message}`,
        error.stack,
      );

      // Não propagar erro
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SYNC: GOOGLE → NEXUS
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Sincronizar eventos do Google Calendar para o Nexus
   * Pull de eventos criados/modificados no Google
   *
   * @param userId - ID do usuário
   * @returns Array de eventos importados
   */
  async syncFromGoogle(userId: string): Promise<any[]> {
    try {
      const calendar = await this.getCalendarClient(userId);
      const tokenRecord = await this.prisma.googleCalendarToken.findUnique({
        where: { userId },
      });

      if (!tokenRecord) {
        throw new UnauthorizedException('Google Calendar não conectado');
      }

      const calendarId = tokenRecord.calendarId;

      // Buscar eventos dos últimos 30 dias e próximos 90 dias
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 30);

      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 90);

      const response = await calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true, // Expandir eventos recorrentes
        orderBy: 'startTime',
        maxResults: 250,
      });

      const googleEvents = response.data.items || [];
      const importedEvents = [];

      this.logger.log(
        `Importando ${googleEvents.length} eventos do Google Calendar para usuário ${userId}`
      );

      for (const googleEvent of googleEvents) {
        try {
          // Verificar se evento já existe no Nexus
          const existing = await this.prisma.calendarEvent.findFirst({
            where: {
              googleEventId: googleEvent.id,
              userId,
            },
          });

          if (existing) {
            this.logger.debug(
              `Evento ${googleEvent.id} já existe no Nexus - pulando`
            );
            continue;
          }

          // Parsear datas
          const startAt = googleEvent.start?.dateTime
            ? new Date(googleEvent.start.dateTime)
            : new Date(googleEvent.start?.date + 'T00:00:00');

          const endAt = googleEvent.end?.dateTime
            ? new Date(googleEvent.end.dateTime)
            : new Date(googleEvent.end?.date + 'T23:59:59');

          const isAllDay = !!googleEvent.start?.date;

          // Criar evento no Nexus
          const newEvent = await this.prisma.calendarEvent.create({
            data: {
              userId,
              title: googleEvent.summary || 'Evento sem título',
              description: googleEvent.description || null,
              type: 'INTERNAL', // Padrão para eventos importados
              startAt,
              endAt,
              isAllDay,
              location: googleEvent.location || null,
              meetingUrl: googleEvent.hangoutLink || null,
              googleEventId: googleEvent.id,
              googleCalendarId: calendarId,
              googleSyncStatus: 'SYNCED',
              googleLastSync: new Date(),
            },
          });

          importedEvents.push(newEvent);
          this.logger.debug(
            `Evento ${googleEvent.id} importado do Google (Nexus ID: ${newEvent.id})`
          );
        } catch (eventError) {
          this.logger.error(
            `Erro ao importar evento ${googleEvent.id}: ${eventError.message}`,
            eventError.stack,
          );
          // Continuar com próximo evento
        }
      }

      this.logger.log(
        `Importados ${importedEvents.length} novos eventos do Google Calendar`
      );

      return importedEvents;
    } catch (error) {
      this.logger.error(
        `Erro ao sincronizar do Google para usuário ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Erro ao sincronizar com Google Calendar');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ENCRYPTION/DECRYPTION
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Criptografar texto com AES-256-GCM
   * @param text - Texto em plain text
   * @returns Texto criptografado (formato: iv:encrypted:authTag)
   */
  private encrypt(text: string): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Formato: iv:encrypted:authTag (todos em hex)
      return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
    } catch (error) {
      this.logger.error(`Erro ao criptografar: ${error.message}`);
      throw new InternalServerErrorException('Erro de criptografia');
    }
  }

  /**
   * Descriptografar texto
   * @param encryptedText - Texto criptografado (formato: iv:encrypted:authTag)
   * @returns Texto em plain text
   */
  private decrypt(encryptedText: string): string {
    try {
      const [ivHex, encrypted, authTagHex] = encryptedText.split(':');

      if (!ivHex || !encrypted || !authTagHex) {
        throw new Error('Formato de texto criptografado inválido');
      }

      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(`Erro ao descriptografar: ${error.message}`);
      throw new InternalServerErrorException('Erro de descriptografia');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════════════════════════

  /**
   * Verificar se usuário tem Google Calendar conectado
   * @param userId - ID do usuário
   */
  async isConnected(userId: string): Promise<boolean> {
    const tokenRecord = await this.prisma.googleCalendarToken.findUnique({
      where: { userId },
    });

    return !!tokenRecord;
  }

  /**
   * Obter status da conexão
   * @param userId - ID do usuário
   */
  async getConnectionStatus(userId: string): Promise<{
    isConnected: boolean;
    calendarId?: string;
    scope?: string;
    expiresAt?: Date;
  }> {
    const tokenRecord = await this.prisma.googleCalendarToken.findUnique({
      where: { userId },
    });

    if (!tokenRecord) {
      return { isConnected: false };
    }

    return {
      isConnected: true,
      calendarId: tokenRecord.calendarId,
      scope: tokenRecord.scope,
      expiresAt: tokenRecord.expiresAt,
    };
  }
}
