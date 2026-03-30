import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { StatusEntity } from '@prisma/client';
import { CreateStatusConfigDto } from './dto/create-status-config.dto';
import { UpdateStatusConfigDto } from './dto/update-status-config.dto';

@Injectable()
export class StatusConfigsService {
  private readonly logger = new Logger(StatusConfigsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(entity?: StatusEntity) {
    return this.prisma.statusConfig.findMany({
      where: {
        ...(entity ? { entity } : {}),
        isActive: true,
      },
      orderBy: [{ entity: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async findOne(id: string) {
    const config = await this.prisma.statusConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException(`StatusConfig ${id} não encontrado`);
    return config;
  }

  async findByEntitySlug(entity: StatusEntity, slug: string) {
    return this.prisma.statusConfig.findUnique({
      where: { entity_slug: { entity, slug } },
    });
  }

  async create(dto: CreateStatusConfigDto) {
    // Verificar duplicata
    const existing = await this.prisma.statusConfig.findUnique({
      where: { entity_slug: { entity: dto.entity, slug: dto.slug } },
    });
    if (existing) {
      throw new ConflictException(`Status "${dto.slug}" já existe para ${dto.entity}`);
    }

    const config = await this.prisma.statusConfig.create({ data: dto });
    this.logger.log(`✅ StatusConfig criado: ${config.entity}/${config.slug}`);
    return config;
  }

  async update(id: string, dto: UpdateStatusConfigDto) {
    const config = await this.findOne(id);

    // Status de sistema: só permite alterar label, color, bgColor, description
    if (config.isSystem) {
      const allowedKeys = new Set(['label', 'color', 'bgColor', 'description', 'sortOrder']);
      const invalidKeys = Object.keys(dto).filter((k) => !allowedKeys.has(k));
      if (invalidKeys.length > 0) {
        throw new ForbiddenException(
          `Status de sistema: não é permitido alterar os campos ${invalidKeys.join(', ')}`,
        );
      }
    }

    const updated = await this.prisma.statusConfig.update({
      where: { id },
      data: dto,
    });
    this.logger.log(`✅ StatusConfig atualizado: ${updated.entity}/${updated.slug}`);
    return updated;
  }

  async remove(id: string) {
    const config = await this.findOne(id);

    if (config.isSystem) {
      throw new ForbiddenException('Status de sistema não pode ser excluído');
    }

    await this.prisma.statusConfig.update({
      where: { id },
      data: { isActive: false },
    });
    this.logger.log(`✅ StatusConfig desativado: ${config.entity}/${config.slug}`);
  }
}
