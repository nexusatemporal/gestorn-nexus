import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { AxiosResponse } from 'axios';

export interface OneNexusProvisionPayload {
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  planId?: string;
  trialEndsAt?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  billingEmail?: string;
  taxId?: string;
}

export interface OneNexusProvisionResponse {
  tenant: {
    id: string;
    slug: string;
    schemaName: string;
    clerkOrgId: string;
    status: string;
    provisioned: boolean;
  };
  clerk: {
    organizationId: string;
    invitationSent: boolean;
    invitedEmail: string;
  };
}

@Injectable()
export class OneNexusService {
  private readonly logger = new Logger(OneNexusService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private get apiUrl(): string {
    return this.configService.get<string>('ONE_NEXUS_API_URL', 'https://apione.nexusatemporal.com.br/api');
  }

  private get authHeaders(): Record<string, string> {
    const apiKey = this.configService.get<string>('ONE_NEXUS_API_KEY', '');
    if (!apiKey) return {};
    return { 'X-API-Key': apiKey };
  }

  /**
   * Provisiona novo tenant no One Nexus.
   * Cria org Clerk, schema PostgreSQL, seeds e convida admin por email.
   * Retorna null em caso de erro (graceful degradation).
   */
  async provision(payload: OneNexusProvisionPayload): Promise<OneNexusProvisionResponse | null> {
    try {
      this.logger.log(`[OneNexus] Provisionando tenant: ${payload.slug}`);

      const response = await firstValueFrom(
        this.httpService.post<OneNexusProvisionResponse>(
          `${this.apiUrl}/tenants/provision`,
          payload,
          { headers: { ...this.authHeaders, 'Content-Type': 'application/json' } },
        ),
      ) as AxiosResponse<OneNexusProvisionResponse>;

      this.logger.log(
        `[OneNexus] ✅ Tenant provisionado: ${response.data.tenant.id} | ` +
        `Schema: ${response.data.tenant.schemaName} | ` +
        `Convite enviado: ${response.data.clerk.invitationSent}`,
      );

      return response.data;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao provisionar tenant ${payload.slug}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return null;
    }
  }

  /**
   * Atualiza status de um tenant no One Nexus.
   * status: 'active' | 'trial' | 'suspended' | 'canceled'
   * Retorna false em caso de erro (graceful degradation).
   */
  async updateStatus(oneNexusTenantId: string, status: 'active' | 'trial' | 'suspended' | 'canceled'): Promise<boolean> {
    try {
      this.logger.log(`[OneNexus] Atualizando status do tenant ${oneNexusTenantId} → ${status}`);

      await firstValueFrom(
        this.httpService.patch(
          `${this.apiUrl}/tenants/${oneNexusTenantId}/status`,
          { status },
          { headers: { ...this.authHeaders, 'Content-Type': 'application/json' } },
        ),
      );

      this.logger.log(`[OneNexus] ✅ Status atualizado: ${oneNexusTenantId} → ${status}`);
      return true;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao atualizar status do tenant ${oneNexusTenantId}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return false;
    }
  }

  /**
   * Busca métricas de uso de um tenant no One Nexus.
   * Retorna null em caso de erro (graceful degradation).
   */
  async getStats(oneNexusTenantId: string): Promise<{
    userCount: number;
    leadCount: number;
    patientCount: number;
    appointmentsThisMonth: number;
    storageUsedMb: number;
  } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          userCount: number;
          leadCount: number;
          patientCount: number;
          appointmentsThisMonth: number;
          storageUsedMb: number;
        }>(
          `${this.apiUrl}/tenants/${oneNexusTenantId}/stats`,
          { headers: this.authHeaders },
        ),
      ) as AxiosResponse;
      return response.data;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao buscar stats do tenant ${oneNexusTenantId}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return null;
    }
  }

  /**
   * Gera slug a partir do nome da empresa.
   * Ex: "Clínica ABC Ltda" → "clinica-abc-ltda"
   */
  static buildSlug(companyName: string): string {
    return companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '')    // Remove caracteres especiais
      .replace(/\s+/g, '-')            // Spaces → hífens
      .replace(/-+/g, '-')             // Múltiplos hífens → um
      .replace(/^-|-$/g, '')           // Remove hífens nas bordas
      .substring(0, 50);               // Máximo 50 chars
  }
}
