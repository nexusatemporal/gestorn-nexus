import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { ProductType } from '@prisma/client';

/**
 * Plans Service
 * Gerencia planos de assinatura (One Nexus e Locadoras)
 */
@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ✅ v2.44.2: Converte Prisma Decimal para Number (padrão fintech)
   * Razão: Frontend espera number para operações aritméticas (.toFixed, *, /)
   * Precisão: float64 é seguro para currency com 2 decimais (até ~R$ 9 quadrilhões)
   * @private
   */
  private formatPlan(plan: any): any {
    if (!plan) return plan;

    return {
      ...plan,
      priceMonthly: plan.priceMonthly?.toNumber?.() ?? plan.priceMonthly,
      priceAnnual: plan.priceAnnual?.toNumber?.() ?? plan.priceAnnual,
      setupFee: plan.setupFee?.toNumber?.() ?? plan.setupFee,
    };
  }

  /**
   * Listar todos os planos
   */
  async findAll(params?: { product?: ProductType; isActive?: boolean }) {
    const plans = await this.prisma.plan.findMany({
      where: {
        product: params?.product,
        isActive: params?.isActive,
      },
      orderBy: [{ sortOrder: 'asc' }, { priceMonthly: 'asc' }],
    });

    // ✅ v2.44.2: Converter Decimal para Number
    return plans.map((plan) => this.formatPlan(plan));
  }

  /**
   * Buscar plano por ID
   */
  async findOne(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clients: true,
            leads: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plano ${id} não encontrado`);
    }

    // ✅ v2.44.2: Converter Decimal para Number
    return this.formatPlan(plan);
  }

  /**
   * Buscar plano por código
   */
  async findByCode(code: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!plan) {
      throw new NotFoundException(`Plano com código ${code} não encontrado`);
    }

    // ✅ v2.44.2: Converter Decimal para Number
    return this.formatPlan(plan);
  }

  /**
   * Criar novo plano
   */
  async create(dto: CreatePlanDto) {
    // Verificar se código já existe
    const existing = await this.prisma.plan.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Plano com código ${dto.code} já existe`);
    }

    const plan = await this.prisma.plan.create({
      data: {
        ...dto,
        includedModules: dto.includedModules || [],
      },
    });

    this.logger.log(`✅ Plano criado: ${plan.name} (${plan.code})`);

    // ✅ v2.44.2: Converter Decimal para Number
    return this.formatPlan(plan);
  }

  /**
   * Atualizar plano
   */
  async update(id: string, dto: UpdatePlanDto) {
    // Verificar se existe
    await this.findOne(id);

    // Se está alterando o código, verificar duplicidade
    if (dto.code) {
      const existing = await this.prisma.plan.findFirst({
        where: {
          code: dto.code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`Plano com código ${dto.code} já existe`);
      }
    }

    const plan = await this.prisma.plan.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`✅ Plano atualizado: ${plan.name} (${plan.code})`);

    // ✅ v2.44.2: Converter Decimal para Number
    return this.formatPlan(plan);
  }

  /**
   * Soft delete - desativa o plano
   */
  async remove(id: string) {
    const plan = await this.findOne(id);

    // Verificar se tem clientes ativos usando este plano
    const activeClientsCount = await this.prisma.client.count({
      where: {
        planId: id,
        status: { in: ['ATIVO', 'EM_TRIAL'] },
      },
    });

    if (activeClientsCount > 0) {
      throw new ConflictException(
        `Não é possível desativar plano com ${activeClientsCount} cliente(s) ativo(s)`,
      );
    }

    const updated = await this.prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.warn(`⚠️ Plano desativado: ${plan.name} (${plan.code})`);
    return updated;
  }

  /**
   * Reativar plano
   */
  async restore(id: string) {
    const plan = await this.findOne(id);

    const updated = await this.prisma.plan.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.log(`✅ Plano reativado: ${plan.name} (${plan.code})`);
    return updated;
  }
}
