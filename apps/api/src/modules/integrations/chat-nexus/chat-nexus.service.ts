import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { createHmac, timingSafeEqual } from 'crypto';
import type { AxiosResponse } from 'axios';

export interface ChatNexusSsoResponse {
  success: boolean;
  data: {
    ssoToken: string;
    loginUrl: string;
    expiresIn: number;
  };
}

@Injectable()
export class ChatNexusService {
  private readonly logger = new Logger(ChatNexusService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get apiUrl(): string {
    return this.configService.get<string>(
      'CHAT_NEXUS_API_URL',
      'https://apichat.nexusatemporal.com.br/api/v1',
    );
  }

  private get frontendUrl(): string {
    return this.configService.get<string>(
      'CHAT_NEXUS_FRONTEND_URL',
      'https://chat.nexusatemporal.com.br',
    );
  }

  private get clientId(): string {
    return this.configService.get<string>(
      'CHAT_NEXUS_CLIENT_ID',
      'nxc_partner_gestornexus',
    );
  }

  private get clientSecret(): string {
    return this.configService.get<string>('CHAT_NEXUS_CLIENT_SECRET', '');
  }

  private get webhookSecret(): string {
    return this.configService.get<string>('CHAT_NEXUS_WEBHOOK_SECRET', '');
  }

  private get tenantId(): string {
    return this.configService.get<string>(
      'CHAT_NEXUS_TENANT_ID',
      'cmmfezst5000387vm8arn5p19',
    );
  }

  /**
   * Gera token SSO para autenticar usuário no Chat Nexus via iframe.
   * Token é temporário (5 min) e descartável (uso único).
   */
  async generateSsoToken(
    userEmail: string,
    userData: { name: string; role?: string; userId?: string },
  ): Promise<{ ssoToken: string; chatUrl: string } | null> {
    try {
      this.logger.log(`[ChatNexus] Gerando SSO token para ${userEmail}`);

      const response = await firstValueFrom(
        this.httpService.post<ChatNexusSsoResponse>(
          `${this.apiUrl}/sso/token`,
          {
            tenantId: this.tenantId,
            externalUserId: userData.userId || userEmail,
            email: userEmail,
            name: userData.name,
            role: userData.role || 'ADMIN',
          },
          {
            headers: {
              'x-client-id': this.clientId,
              'x-client-secret': this.clientSecret,
              'Content-Type': 'application/json',
            },
          },
        ),
      ) as AxiosResponse<ChatNexusSsoResponse>;

      const { ssoToken, loginUrl } = response.data.data;
      const chatUrl = loginUrl || `${this.frontendUrl}?token=${ssoToken}`;

      this.logger.log(`[ChatNexus] ✅ SSO token gerado para ${userEmail}`);

      return { ssoToken, chatUrl };
    } catch (error) {
      const errData = error?.response?.data;
      this.logger.error(
        `[ChatNexus] ❌ Falha ao gerar SSO token para ${userEmail}: ` +
          `status=${error?.response?.status} ` +
          `body=${JSON.stringify(errData)} ` +
          `msg=${error?.message || 'unknown'}`,
      );
      return null;
    }
  }

  /**
   * Valida assinatura HMAC SHA256 do webhook.
   * Header: X-Webhook-Signature: sha256=<hash>
   */
  validateWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.warn('[ChatNexus] ⚠️ CHAT_NEXUS_WEBHOOK_SECRET não configurado');
      return false;
    }

    const expectedSignature =
      'sha256=' +
      createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(sigBuf, expectedBuf);
  }
}
