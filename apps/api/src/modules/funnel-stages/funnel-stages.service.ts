import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateFunnelStageDto } from './dto/create-funnel-stage.dto';
import { UpdateFunnelStageDto } from './dto/update-funnel-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';

/**
 * Funnel Stages Service
 * Gerencia estágios do funil de vendas
 */
@Injectable()
export class FunnelStagesService {
  private readonly logger = new Logger(FunnelStagesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listar todos os estágios (ordenados)
   */
  async findAll() {
    return this.prisma.funnelStage.findMany({
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });
  }

  /**
   * Buscar estágio por ID
   */
  async findOne(id: string) {
    const stage = await this.prisma.funnelStage.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            leads: true,
          },
        },
      },
    });

    if (!stage) {
      throw new NotFoundException(`Estágio ${id} não encontrado`);
    }

    return stage;
  }

  /**
   * Buscar estágio por name (case-insensitive)
   */
  async findByName(name: string) {
    const stage = await this.prisma.funnelStage.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        }
      },
    });

    if (!stage) {
      throw new NotFoundException(`Estágio ${name} não encontrado`);
    }

    return stage;
  }

  /**
   * Criar novo estágio
   */
  async create(dto: CreateFunnelStageDto) {
    // Verificar se name já existe
    const existing = await this.prisma.funnelStage.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Estágio ${dto.name} já existe`);
    }

    // Se marcar como default, desmarcar outros
    if (dto.isDefault) {
      await this.prisma.funnelStage.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const stage = await this.prisma.funnelStage.create({
      data: dto,
    });

    this.logger.log(`✅ Estágio criado: ${stage.name} (ordem ${stage.order})`);
    return stage;
  }

  /**
   * Atualizar estágio
   */
  async update(id: string, dto: UpdateFunnelStageDto) {
    const existing = await this.findOne(id);

    // Se alterar name, verificar se não conflita
    if (dto.name && dto.name !== existing.name) {
      const conflict = await this.prisma.funnelStage.findUnique({
        where: { name: dto.name },
      });

      if (conflict) {
        throw new ConflictException(`Estágio ${dto.name} já existe`);
      }
    }

    // Se marcar como default, desmarcar outros
    if (dto.isDefault === true) {
      await this.prisma.funnelStage.updateMany({
        where: {
          id: { not: id },
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.funnelStage.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`✅ Estágio atualizado: ${updated.name}`);
    return updated;
  }

  /**
   * Reordenar estágios
   */
  async reorder(dto: ReorderStagesDto) {
    // Atualizar ordem de cada estágio em uma transação
    await this.prisma.$transaction(
      dto.stages.map((stage) =>
        this.prisma.funnelStage.update({
          where: { id: stage.id },
          data: { order: stage.order },
        })
      )
    );

    this.logger.log(`✅ Estágios reordenados: ${dto.stages.length} alterados`);
    return this.findAll();
  }

  /**
   * Remover estágio
   * IMPORTANTE: Não permite remover se houver leads vinculados
   */
  async remove(id: string) {
    const stage = await this.findOne(id);

    // Verificar se há leads vinculados
    const leadsCount = await this.prisma.lead.count({
      where: { stageId: id },
    });

    if (leadsCount > 0) {
      throw new ConflictException(
        `Não é possível remover estágio com ${leadsCount} lead(s) vinculado(s). Mova-os para outro estágio primeiro.`
      );
    }

    await this.prisma.funnelStage.delete({
      where: { id },
    });

    this.logger.warn(`⚠️ Estágio removido: ${stage.name}`);
  }
}
