import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, CreateTenantSchema } from './dto/create-tenant.dto';
import { UpdateTenantDto, UpdateTenantSchema } from './dto/update-tenant.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole, TenantStatus } from '@prisma/client';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthUser } from '@/common/interfaces/auth-user.interface';
import { z } from 'zod';

/**
 * Tenants Controller
 * Endpoints para gerenciar tenants (instâncias dos sistemas One Nexus e Locadoras)
 *
 * PERMISSÕES:
 * - GET: Todos usuários autenticados (com scoping por role)
 * - POST/PUT: Apenas SUPERADMIN e DESENVOLVEDOR
 * - SUSPEND/ACTIVATE: Apenas SUPERADMIN e DESENVOLVEDOR
 * - BLOCK: Apenas SUPERADMIN e ADMINISTRATIVO
 * - DELETE: Apenas SUPERADMIN
 *
 * SCOPING:
 * - SUPERADMIN/ADMINISTRATIVO/DESENVOLVEDOR: Veem todos os tenants
 * - GESTOR: Vê tenants dos clientes da sua equipe
 * - VENDEDOR: Vê apenas tenants dos seus próprios clientes
 */
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  /**
   * GET /tenants
   * Lista tenants (com scoping por role)
   *
   * Query params:
   * - status?: TenantStatus
   * - vpsLocation?: string
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: TenantStatus,
    @Query('vpsLocation') vpsLocation?: string,
  ) {
    return this.tenantsService.findAll({
      currentUserId: user.id,
      currentUserRole: user.role,
      status,
      vpsLocation,
    });
  }

  /**
   * GET /tenants/modules/available
   * Retorna lista de módulos disponíveis no One Nexus (ou fallback padrão).
   * Usado pelo frontend para renderizar os checkboxes de módulos (V1 - legado).
   */
  @Get('modules/available')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.GESTOR, UserRole.VENDEDOR, UserRole.DESENVOLVEDOR)
  async getAvailableModules() {
    return this.tenantsService.getAvailableModules();
  }

  /**
   * GET /tenants/client/:clientId
   * Busca tenant pelo Client ID (relacionamento 1:1)
   */
  @Get('client/:clientId')
  async findByClientId(@Param('clientId') clientId: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.findByClientId(clientId, user.id, user.role);
  }

  /**
   * GET /tenants/uuid/:tenantUuid
   * Busca tenant pelo UUID no sistema destino
   */
  @Get('uuid/:tenantUuid')
  async findByTenantUuid(
    @Param('tenantUuid') tenantUuid: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantsService.findByTenantUuid(tenantUuid, user.id, user.role);
  }

  /**
   * GET /tenants/:id
   * Busca tenant por ID (com validação de acesso)
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.findOne(id, user.id, user.role);
  }

  /**
   * POST /tenants
   * Cria novo tenant
   *
   * Requer: SUPERADMIN ou DESENVOLVEDOR
   */
  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  @UsePipes(new ZodValidationPipe(CreateTenantSchema))
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthUser) {
    return this.tenantsService.create(dto, user.id, user.role);
  }

  /**
   * PUT /tenants/:id
   * Atualiza tenant
   *
   * Requer: SUPERADMIN ou DESENVOLVEDOR
   */
  @Put(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  @UsePipes(new ZodValidationPipe(UpdateTenantSchema))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantsService.update(id, dto, user.id, user.role);
  }

  /**
   * POST /tenants/:id/suspend
   * Suspende tenant temporariamente
   *
   * Requer: SUPERADMIN ou DESENVOLVEDOR
   */
  @Post(':id/suspend')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  @HttpCode(HttpStatus.OK)
  async suspend(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.suspend(id, user.id, user.role);
  }

  /**
   * POST /tenants/:id/activate
   * Ativa tenant suspenso
   *
   * Requer: SUPERADMIN ou DESENVOLVEDOR
   */
  @Post(':id/activate')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.activate(id, user.id, user.role);
  }

  /**
   * POST /tenants/:id/block
   * Bloqueia tenant (por inadimplência)
   *
   * Requer: SUPERADMIN ou ADMINISTRATIVO
   */
  @Post(':id/block')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @HttpCode(HttpStatus.OK)
  async block(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.block(id, user.id, user.role);
  }

  /**
   * DELETE /tenants/:id
   * Marca tenant como DELETADO (soft delete)
   *
   * Requer: SUPERADMIN
   */
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.delete(id, user.id, user.role);
  }

  /**
   * PATCH /tenants/:id/metrics
   * Atualiza métricas do tenant (activeUsers, storageUsedMb, lastAccessAt)
   *
   * Requer: SUPERADMIN ou DESENVOLVEDOR
   *
   * Este endpoint é usado por sistemas externos (One Nexus/Locadoras)
   * para reportar métricas de uso do tenant
   */
  @Patch(':id/metrics')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  @UsePipes(
    new ZodValidationPipe(
      z.object({
        activeUsers: z.number().int().min(0).optional(),
        storageUsedMb: z.number().int().min(0).optional(),
        lastAccessAt: z
          .string()
          .datetime()
          .transform((val) => new Date(val))
          .optional(),
      }),
    ),
  )
  async updateMetrics(
    @Param('id') id: string,
    @Body()
    metrics: {
      activeUsers?: number;
      storageUsedMb?: number;
      lastAccessAt?: Date;
    },
  ) {
    return this.tenantsService.updateMetrics(id, metrics);
  }

  /**
   * POST /tenants/:id/retry-provision
   * Retenta provisioning de um tenant com status FAILED.
   *
   * Requer: SUPERADMIN, ADMINISTRATIVO ou GESTOR
   */
  @Post(':id/retry-provision')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.GESTOR)
  @HttpCode(HttpStatus.OK)
  async retryProvision(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.retryProvision(id, user.id, user.role as UserRole);
  }

  /**
   * GET /tenants/:id/modules/tree
   * Retorna árvore hierárquica de módulos do tenant (V3).
   * 12 pais com children[], isEnabled efetivo.
   *
   * Requer tenant provisionado (tenantUuid).
   */
  @Get(':id/modules/tree')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.GESTOR, UserRole.DESENVOLVEDOR)
  async getModulesTree(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.getModulesTree(id, user.id, user.role as UserRole);
  }

  /**
   * PATCH /tenants/:id/modules/toggle
   * Toggle individual de módulos com cascata automática (V3).
   * Desabilitar pai → desabilita todos filhos.
   * Habilitar filho → habilita pai.
   *
   * Body: { modules: [{ moduleId: string, isEnabled: boolean }] }
   *
   * NOTA: Pipe aplicado diretamente no @Body() para não validar @Param/:CurrentUser
   */
  @Patch(':id/modules/toggle')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.GESTOR)
  async toggleModules(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(
      z.object({
        modules: z.array(z.object({
          moduleId: z.string(),
          isEnabled: z.boolean(),
        })),
      }),
    )) body: { modules: { moduleId: string; isEnabled: boolean }[] },
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantsService.toggleModules(id, body.modules, user.id, user.role as UserRole);
  }

  /**
   * PATCH /tenants/:id/modules/enable-all
   * Habilita todos os 77 módulos do tenant (V3).
   */
  @Patch(':id/modules/enable-all')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  @HttpCode(HttpStatus.OK)
  async enableAllModules(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tenantsService.enableAllModules(id, user.id, user.role as UserRole);
  }

  /**
   * PATCH /tenants/:id/modules/preset
   * Aplica preset de módulos (V3).
   * Presets: all, basic, clinical, business, enterprise, none
   *
   * NOTA: Pipe aplicado diretamente no @Body() para não validar @Param/:CurrentUser
   */
  @Patch(':id/modules/preset')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.GESTOR)
  async applyModulePreset(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(
      z.object({
        preset: z.enum(['all', 'basic', 'clinical', 'business', 'enterprise', 'none']),
      }),
    )) body: { preset: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantsService.applyModulePreset(id, body.preset, user.id, user.role as UserRole);
  }

  /**
   * PATCH /tenants/:id/modules
   * Atualiza os módulos habilitados de um tenant (V1 - legado).
   * Mantido para compatibilidade retroativa.
   *
   * NOTA: Pipe aplicado diretamente no @Body() para não validar @Param/:CurrentUser
   */
  @Patch(':id/modules')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.GESTOR)
  async updateModules(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(
      z.object({
        modules: z.array(z.string()).default([]),
      }),
    )) body: { modules: string[] },
    @CurrentUser() user: AuthUser,
  ) {
    return this.tenantsService.updateEnabledModules(id, body.modules, user.id, user.role as UserRole);
  }
}
