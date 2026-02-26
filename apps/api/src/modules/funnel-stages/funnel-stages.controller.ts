import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FunnelStagesService } from './funnel-stages.service';
import { CreateFunnelStageDto, CreateFunnelStageSchema } from './dto/create-funnel-stage.dto';
import { UpdateFunnelStageDto, UpdateFunnelStageSchema } from './dto/update-funnel-stage.dto';
import { ReorderStagesDto, ReorderStagesSchema } from './dto/reorder-stages.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

/**
 * Funnel Stages Controller
 * Endpoints para gerenciar estágios do funil de vendas
 *
 * PERMISSÕES:
 * - GET (listar/visualizar): TODOS usuários autenticados
 * - POST/PUT/PATCH/DELETE: Apenas SUPERADMIN
 */
@Controller('funnel-stages')
export class FunnelStagesController {
  constructor(private readonly funnelStagesService: FunnelStagesService) {}

  /**
   * GET /funnel-stages
   * Lista todos os estágios ordenados
   */
  @Get()
  async findAll() {
    return this.funnelStagesService.findAll();
  }

  /**
   * GET /funnel-stages/:id
   * Busca estágio por ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.funnelStagesService.findOne(id);
  }

  /**
   * GET /funnel-stages/name/:name
   * Busca estágio por name
   */
  @Get('name/:name')
  async findByName(@Param('name') name: string) {
    return this.funnelStagesService.findByName(name);
  }

  /**
   * POST /funnel-stages
   * Cria novo estágio
   *
   * REQUER: SUPERADMIN
   */
  @Post()
  @Roles(UserRole.SUPERADMIN)
  @UsePipes(new ZodValidationPipe(CreateFunnelStageSchema))
  async create(@Body() dto: CreateFunnelStageDto) {
    return this.funnelStagesService.create(dto);
  }

  /**
   * PUT /funnel-stages/:id
   * Atualiza estágio
   *
   * REQUER: SUPERADMIN
   */
  @Put(':id')
  @Roles(UserRole.SUPERADMIN)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateFunnelStageSchema)) dto: UpdateFunnelStageDto,
  ) {
    return this.funnelStagesService.update(id, dto);
  }

  /**
   * PATCH /funnel-stages/reorder
   * Reordena estágios
   *
   * REQUER: SUPERADMIN
   */
  @Patch('reorder')
  @Roles(UserRole.SUPERADMIN)
  @UsePipes(new ZodValidationPipe(ReorderStagesSchema))
  async reorder(@Body() dto: ReorderStagesDto) {
    return this.funnelStagesService.reorder(dto);
  }

  /**
   * DELETE /funnel-stages/:id
   * Remove estágio
   *
   * REQUER: SUPERADMIN
   * IMPORTANTE: Não permite remover se houver leads vinculados
   */
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.funnelStagesService.remove(id);
  }
}
