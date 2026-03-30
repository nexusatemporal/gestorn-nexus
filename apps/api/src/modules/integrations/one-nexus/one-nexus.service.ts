import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { AxiosResponse } from 'axios';

export interface OneNexusModuleChild {
  id: string;
  name: string;
  slug: string;
  icon: string;
  isEnabled: boolean;
  isCore?: boolean;
}

export interface OneNexusModuleTree {
  id: string;
  name: string;
  slug: string;
  icon: string;
  isEnabled: boolean;
  isCore?: boolean;
  children: OneNexusModuleChild[];
}

export interface ToggleModulesResult {
  success: boolean;
  skipped: { moduleId: string; slug: string; reason: string }[];
}

export interface OneNexusImpersonateResponse {
  sessionId: string;
  magicLink: string;
  token: string;
  expiresAt?: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface OneNexusModule {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

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
export class OneNexusService implements OnModuleInit {
  private readonly logger = new Logger(OneNexusService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('ONE_NEXUS_API_KEY', '');
    const apiUrl = this.apiUrl;
    if (!apiKey) {
      this.logger.warn('[OneNexus] ONE_NEXUS_API_KEY nao configurada — integracao One Nexus desabilitada');
    } else {
      this.logger.log(`[OneNexus] Integracao configurada → ${apiUrl}`);
    }
  }

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
   * Busca tenant no One Nexus pelo slug.
   * Usado como recovery quando provision() falha mas o tenant pode ter sido criado.
   * Retorna o id (UUID) do tenant se encontrado, null caso contrário.
   */
  async findBySlug(slug: string): Promise<{ id: string; status: string } | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ items: { id: string; slug: string; status: string }[] }>(
          `${this.apiUrl}/tenants?search=${encodeURIComponent(slug)}`,
          { headers: this.authHeaders },
        ),
      ) as AxiosResponse;

      const match = response.data?.items?.find((t: { slug: string }) => t.slug === slug);
      if (match) {
        this.logger.log(`[OneNexus] 🔍 Tenant encontrado por slug '${slug}': ${match.id}`);
        return { id: match.id, status: match.status };
      }
      return null;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao buscar tenant por slug '${slug}': ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return null;
    }
  }

  /**
   * Deleta (soft-delete) um tenant no One Nexus.
   * O schema PostgreSQL NÃO é deletado — apenas desativa o tenant.
   * Retorna false em caso de erro (graceful degradation).
   */
  async delete(oneNexusTenantId: string): Promise<boolean> {
    try {
      this.logger.log(`[OneNexus] Deletando tenant ${oneNexusTenantId}`);

      await firstValueFrom(
        this.httpService.delete(
          `${this.apiUrl}/tenants/${oneNexusTenantId}`,
          { headers: this.authHeaders },
        ),
      );

      this.logger.log(`[OneNexus] ✅ Tenant deletado: ${oneNexusTenantId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao deletar tenant ${oneNexusTenantId}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return false;
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
   * Lista módulos disponíveis no One Nexus.
   * Endpoint: GET /api/modules
   * Graceful: retorna lista hardcoded se endpoint não existir ou falhar.
   */
  async getModules(): Promise<OneNexusModule[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<OneNexusModule[]>(
          `${this.apiUrl}/modules`,
          { headers: this.authHeaders },
        ),
      ) as AxiosResponse<OneNexusModule[]>;

      return response.data;
    } catch (error) {
      this.logger.warn(
        `[OneNexus] ⚠️ Não foi possível buscar módulos da API — usando lista padrão. ` +
        (error?.response?.status ? `HTTP ${error.response.status}` : error?.message || ''),
      );
      return this.getDefaultModules();
    }
  }

  /**
   * @deprecated V1 legado — usar toggleModules() (V3) que suporta cascata automática.
   * Atualiza módulos habilitados de um tenant no One Nexus.
   * Endpoint: PATCH /api/tenants/:id/modules { modules: string[] }
   * Graceful: retorna false em caso de erro.
   */
  async updateModules(oneNexusTenantId: string, moduleIds: string[]): Promise<boolean> {
    try {
      this.logger.log(`[OneNexus] Atualizando módulos do tenant ${oneNexusTenantId}: [${moduleIds.join(', ')}]`);

      await firstValueFrom(
        this.httpService.patch(
          `${this.apiUrl}/tenants/${oneNexusTenantId}/modules`,
          { modules: moduleIds },
          { headers: { ...this.authHeaders, 'Content-Type': 'application/json' } },
        ),
      );

      this.logger.log(`[OneNexus] ✅ Módulos atualizados: ${oneNexusTenantId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao atualizar módulos do tenant ${oneNexusTenantId}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return false;
    }
  }

  /**
   * Lista padrão de módulos — usada como fallback quando One Nexus API não responde.
   */
  getDefaultModules(): OneNexusModule[] {
    return [
      { id: 'crm',           name: 'CRM',           description: 'Gestão de clientes e relacionamentos', category: 'vendas' },
      { id: 'finance',       name: 'Financeiro',     description: 'Controle financeiro e fluxo de caixa',  category: 'financeiro' },
      { id: 'inventory',     name: 'Estoque',        description: 'Controle de produtos e materiais',       category: 'operacoes' },
      { id: 'opportunities', name: 'Oportunidades',  description: 'Funil de vendas e oportunidades',        category: 'vendas' },
      { id: 'reports',       name: 'Relatórios',     description: 'Relatórios e métricas de negócio',       category: 'analytics' },
      { id: 'patients',      name: 'Pacientes',      description: 'Cadastro e histórico de pacientes',      category: 'clinica' },
      { id: 'appointments',  name: 'Agenda',         description: 'Agendamento e calendário de consultas',  category: 'clinica' },
      { id: 'marketing',     name: 'Marketing',      description: 'Campanhas e automações de marketing',    category: 'vendas' },
      { id: 'support',       name: 'Suporte',        description: 'Tickets e atendimento ao cliente',       category: 'operacoes' },
      { id: 'integrations',  name: 'Integrações',    description: 'Conectores com sistemas externos',       category: 'tecnologia' },
    ];
  }

  // ════════════════════════════════════════════════════════════════
  // MÓDULOS V3 — API Hierárquica
  // ════════════════════════════════════════════════════════════════

  /**
   * Retorna a árvore hierárquica de módulos do tenant (12 pais + 65 filhos).
   * Cada módulo pai contém children[] com isEnabled efetivo.
   */
  async getModulesTree(oneNexusTenantId: string): Promise<OneNexusModuleTree[] | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<OneNexusModuleTree[]>(
          `${this.apiUrl}/tenants/${oneNexusTenantId}/modules`,
          { headers: this.authHeaders },
        ),
      ) as AxiosResponse<OneNexusModuleTree[]>;
      return response.data;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao buscar árvore de módulos do tenant ${oneNexusTenantId}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return null;
    }
  }

  /**
   * Toggle individual de módulos com cascata automática no servidor.
   * Desabilitar pai → desabilita todos os filhos.
   * Habilitar filho → habilita o pai automaticamente.
   */
  async toggleModules(
    oneNexusTenantId: string,
    modules: { moduleId: string; isEnabled: boolean }[],
  ): Promise<ToggleModulesResult> {
    try {
      this.logger.log(`[OneNexus] Toggling ${modules.length} módulo(s) para tenant ${oneNexusTenantId}`);
      const response = await firstValueFrom(
        this.httpService.patch(
          `${this.apiUrl}/tenants/${oneNexusTenantId}/modules`,
          { modules },
          { headers: { ...this.authHeaders, 'Content-Type': 'application/json' } },
        ),
      );

      const data = response.data;
      const skipped: ToggleModulesResult['skipped'] = [];

      if (data?.updated && Array.isArray(data.updated)) {
        for (const item of data.updated) {
          if (item.skipped) {
            skipped.push({
              moduleId: item.moduleId || '',
              slug: item.slug || '',
              reason: item.reason || 'Core module',
            });
          }
        }
      }

      if (skipped.length > 0) {
        this.logger.warn(
          `[OneNexus] ⚠️ ${skipped.length} módulo(s) ignorados (core): ${skipped.map((s) => s.slug).join(', ')}`,
        );
      }

      this.logger.log(`[OneNexus] ✅ Módulos atualizados com cascata: ${oneNexusTenantId}`);
      return { success: true, skipped };
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao fazer toggle de módulos para tenant ${oneNexusTenantId}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return { success: false, skipped: [] };
    }
  }

  /**
   * Habilita todos os 77 módulos do tenant.
   */
  async enableAllModules(oneNexusTenantId: string): Promise<boolean> {
    try {
      this.logger.log(`[OneNexus] Habilitando TODOS os módulos do tenant ${oneNexusTenantId}`);
      await firstValueFrom(
        this.httpService.patch(
          `${this.apiUrl}/tenants/${oneNexusTenantId}/modules/enable-all`,
          {},
          { headers: this.authHeaders },
        ),
      );
      this.logger.log(`[OneNexus] ✅ Todos os módulos habilitados: ${oneNexusTenantId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao habilitar todos os módulos do tenant ${oneNexusTenantId}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return false;
    }
  }

  /**
   * Aplica preset de módulos ao tenant.
   * Presets: all, basic, clinical, business, enterprise, none
   */
  async applyPreset(oneNexusTenantId: string, preset: string): Promise<boolean> {
    try {
      this.logger.log(`[OneNexus] Aplicando preset '${preset}' ao tenant ${oneNexusTenantId}`);
      await firstValueFrom(
        this.httpService.patch(
          `${this.apiUrl}/tenants/${oneNexusTenantId}/modules/preset`,
          { preset },
          { headers: { ...this.authHeaders, 'Content-Type': 'application/json' } },
        ),
      );
      this.logger.log(`[OneNexus] ✅ Preset '${preset}' aplicado: ${oneNexusTenantId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao aplicar preset '${preset}' ao tenant ${oneNexusTenantId}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return false;
    }
  }

  /**
   * Inicia uma sessão de impersonate para um tenant no One Nexus.
   * Retorna magicLink para acesso direto ao ambiente do cliente.
   * Retorna null em caso de erro (graceful degradation).
   */
  async startImpersonate(
    oneNexusTenantId: string,
    reason: string,
    ttlMinutes = 120,
  ): Promise<OneNexusImpersonateResponse | null> {
    try {
      this.logger.log(`[OneNexus] Iniciando impersonate para tenant ${oneNexusTenantId} (ttl=${ttlMinutes}min)`);
      const response = await firstValueFrom(
        this.httpService.post<OneNexusImpersonateResponse>(
          `${this.apiUrl}/impersonate/start`,
          { tenantId: oneNexusTenantId, reason, ttlMinutes },
          { headers: { ...this.authHeaders, 'Content-Type': 'application/json' } },
        ),
      ) as AxiosResponse<OneNexusImpersonateResponse>;
      this.logger.log(`[OneNexus] ✅ Impersonate iniciado: sessionId=${response.data.sessionId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao iniciar impersonate: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return null;
    }
  }

  /**
   * Encerra uma sessão de impersonate no One Nexus.
   * Retorna false em caso de erro (graceful degradation).
   */
  async endImpersonate(sessionId: string): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpService.patch(
          `${this.apiUrl}/impersonate/${sessionId}/end`,
          {},
          { headers: this.authHeaders },
        ),
      );
      this.logger.log(`[OneNexus] ✅ Impersonate encerrado: sessionId=${sessionId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `[OneNexus] ❌ Falha ao encerrar impersonate ${sessionId}: ` +
        (error?.response?.data?.message || error?.message || 'Erro desconhecido'),
      );
      return false;
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
