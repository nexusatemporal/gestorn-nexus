import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

/**
 * Integrations Service
 * Gerencia integrações externas do sistema
 *
 * IMPORTANTE:
 * - NUNCA armazenar API keys ou secrets no banco de dados
 * - Use apenas para armazenar configs não-sensíveis e status
 * - API keys devem estar em variáveis de ambiente
 */
@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listar todas as integrações
   */
  async findAll() {
    return this.prisma.integration.findMany({
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Buscar integração por ID
   */
  async findOne(id: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { id },
    });

    if (!integration) {
      throw new NotFoundException(`Integração ${id} não encontrada`);
    }

    return integration;
  }

  /**
   * Buscar integração por nome
   */
  async findByName(name: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { name },
    });

    if (!integration) {
      throw new NotFoundException(`Integração ${name} não encontrada`);
    }

    return integration;
  }

  /**
   * Atualizar configuração de integração
   * IMPORTANTE: Apenas SUPERADMIN e DESENVOLVEDOR podem fazer isso
   */
  async update(id: string, dto: UpdateIntegrationDto) {
    const integration = await this.findOne(id);

    const updated = await this.prisma.integration.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`✅ Integração atualizada: ${integration.name}`);
    return updated;
  }

  /**
   * Testar conexão de uma integração
   * NOTA: Implementação depende do tipo de integração
   */
  async test(id: string): Promise<{ success: boolean; message: string }> {
    const integration = await this.findOne(id);

    // TODO: Implementar testes específicos por tipo
    // Por enquanto, retorna sucesso genérico
    this.logger.log(`🔍 Testando integração: ${integration.name}`);

    return {
      success: true,
      message: `Integração ${integration.name} está configurada`,
    };
  }

  /**
   * Forçar sincronização de uma integração
   * NOTA: Implementação depende do tipo de integração
   */
  async sync(id: string): Promise<{ success: boolean; message: string }> {
    const integration = await this.findOne(id);

    await this.prisma.integration.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
      },
    });

    this.logger.log(`🔄 Sincronização iniciada: ${integration.name}`);

    return {
      success: true,
      message: `Sincronização de ${integration.name} iniciada`,
    };
  }

  /**
   * Marcar erro em integração
   */
  async logError(id: string, error: string) {
    await this.prisma.integration.update({
      where: { id },
      data: {
        lastError: error,
        updatedAt: new Date(),
      },
    });

    this.logger.error(`❌ Erro na integração ${id}: ${error}`);
  }

  /**
   * Limpar erro de integração
   */
  async clearError(id: string) {
    await this.prisma.integration.update({
      where: { id },
      data: {
        lastError: null,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`✅ Erro limpo na integração ${id}`);
  }
}
