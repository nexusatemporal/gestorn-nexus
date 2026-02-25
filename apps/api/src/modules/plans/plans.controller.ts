import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlansService } from './plans.service';
import { CreatePlanDto, CreatePlanSchema } from './dto/create-plan.dto';
import { UpdatePlanDto, UpdatePlanSchema } from './dto/update-plan.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole, ProductType } from '@prisma/client';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

/**
 * Plans Controller
 * Endpoints para gerenciar planos de assinatura
 *
 * PERMISSÕES:
 * - GET (listar/visualizar): TODOS usuários autenticados
 * - POST/PUT/DELETE: Apenas SUPERADMIN e ADMINISTRATIVO
 */
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  /**
   * GET /plans
   * Lista todos os planos
   *
   * Query params:
   * - product?: ProductType (ONE_NEXUS | LOCADORAS)
   * - isActive?: boolean
   */
  @Get()
  async findAll(
    @Query('product') product?: ProductType,
    @Query('isActive') isActive?: string,
  ) {
    return this.plansService.findAll({
      product,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  /**
   * GET /plans/:id
   * Busca um plano por ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  /**
   * GET /plans/code/:code
   * Busca um plano por código
   */
  @Get('code/:code')
  async findByCode(@Param('code') code: string) {
    return this.plansService.findByCode(code);
  }

  /**
   * POST /plans
   * Cria um novo plano
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   */
  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @UsePipes(new ZodValidationPipe(CreatePlanSchema))
  async create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  /**
   * PUT /plans/:id
   * Atualiza um plano
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   */
  @Put(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @UsePipes(new ZodValidationPipe(UpdatePlanSchema))
  async update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  /**
   * DELETE /plans/:id
   * Desativa um plano (soft delete)
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   * IMPORTANTE: Não permite desativar se houver clientes ativos
   */
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.plansService.remove(id);
  }

  /**
   * POST /plans/:id/restore
   * Reativa um plano desativado
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   */
  @Post(':id/restore')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async restore(@Param('id') id: string) {
    return this.plansService.restore(id);
  }
}
