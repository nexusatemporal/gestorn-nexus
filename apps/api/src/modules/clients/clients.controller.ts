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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientsService } from './clients.service';
import { CreateClientDto, CreateClientSchema } from './dto/create-client.dto';
import { UpdateClientDto, UpdateClientSchema } from './dto/update-client.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole, ClientStatus, ProductType } from '@prisma/client';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthUser } from '@/common/interfaces/auth-user.interface';
import { z } from 'zod';

/**
 * Clients Controller
 * Endpoints para gerenciar clientes ativos
 *
 * PERMISSÕES:
 * - GET: Todos usuários autenticados (com scoping por role)
 * - POST: Todos usuários autenticados (vendedor cria para si mesmo)
 * - PUT: Dono do cliente ou superiores (admins/gestor)
 * - CANCEL/REACTIVATE: Apenas SUPERADMIN e ADMINISTRATIVO
 *
 * SCOPING:
 * - SUPERADMIN/ADMINISTRATIVO: Veem todos os clientes
 * - GESTOR: Vê clientes da sua equipe
 * - VENDEDOR: Vê apenas seus próprios clientes
 */
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  /**
   * GET /clients
   * Lista clientes (com scoping por role)
   *
   * Query params:
   * - status?: ClientStatus
   * - productType?: ProductType
   * - vendedorId?: string (apenas admins/gestor)
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ClientStatus,
    @Query('productType') productType?: ProductType,
    @Query('vendedorId') vendedorId?: string,
  ) {
    return this.clientsService.findAll({
      currentUserId: user.id,
      currentUserRole: user.role,
      status,
      productType,
      vendedorId,
    });
  }

  /**
   * GET /clients/my
   * Lista clientes do usuário logado
   */
  @Get('my')
  async findMy(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: ClientStatus,
    @Query('productType') productType?: ProductType,
  ) {
    return this.clientsService.findAll({
      currentUserId: user.id,
      currentUserRole: user.role,
      status,
      productType,
      vendedorId: user.id,
    });
  }

  /**
   * GET /clients/:id
   * Busca cliente por ID (com validação de acesso)
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.clientsService.findOne(id, user.id, user.role);
  }

  /**
   * GET /clients/cpf-cnpj/:cpfCnpj
   * Busca cliente por CPF/CNPJ
   */
  @Get('cpf-cnpj/:cpfCnpj')
  async findByCpfCnpj(@Param('cpfCnpj') cpfCnpj: string, @CurrentUser() user: AuthUser) {
    return this.clientsService.findByCpfCnpj(cpfCnpj, user.id, user.role);
  }

  /**
   * POST /clients
   * Cria um novo cliente
   *
   * REGRAS:
   * - VENDEDOR cria cliente para si mesmo (vendedorId ignorado)
   * - GESTOR pode criar para seus vendedores
   * - SUPERADMIN/ADMINISTRATIVO podem criar para qualquer vendedor
   * - Se leadId fornecido, converte lead em cliente
   */
  @Post()
  async create(
    @Body(new ZodValidationPipe(CreateClientSchema)) dto: CreateClientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.create(dto, user.id, user.role);
  }

  /**
   * PUT /clients/:id
   * Atualiza um cliente
   *
   * REGRAS:
   * - Dono pode atualizar seus clientes
   * - GESTOR pode atualizar clientes da equipe
   * - SUPERADMIN/ADMINISTRATIVO podem atualizar qualquer cliente
   * - Cliente CANCELADO não pode ser editado
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateClientSchema)) dto: UpdateClientDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.update(id, dto, user.id, user.role);
  }

  /**
   * POST /clients/:id/cancel
   * Cancela um cliente
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   */
  @Post(':id/cancel')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.clientsService.cancel(id, user.id, user.role);
  }

  /**
   * POST /clients/:id/reactivate
   * Reativa um cliente cancelado
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   */
  @Post(':id/reactivate')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async reactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.clientsService.reactivate(id, user.id, user.role);
  }

  /**
   * POST /clients/:id/impersonate
   * Inicia sessão de impersonate para um cliente One Nexus
   *
   * REQUER: SUPERADMIN, DESENVOLVEDOR ou GESTOR
   */
  @Post(':id/impersonate')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR, UserRole.GESTOR)
  async startImpersonate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ reason: z.string().min(3, 'Motivo deve ter pelo menos 3 caracteres').max(500) }))) dto: { reason: string },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';
    const ua = req.headers['user-agent'] || '';
    return this.clientsService.startImpersonate(id, user, dto.reason, ip, ua);
  }

  /**
   * PATCH /clients/:id/impersonate/:logId/end
   * Encerra sessão de impersonate
   *
   * REQUER: SUPERADMIN, DESENVOLVEDOR ou GESTOR
   */
  @Patch(':id/impersonate/:logId/end')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR, UserRole.GESTOR)
  async endImpersonate(
    @Param('logId') logId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.clientsService.endImpersonate(logId, user);
  }

  /**
   * GET /clients/:id/impersonate-logs
   * Busca histórico de impersonate do cliente
   *
   * REQUER: SUPERADMIN, DESENVOLVEDOR ou GESTOR
   */
  @Get(':id/impersonate-logs')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR, UserRole.GESTOR)
  async getImpersonateLogs(@Param('id') id: string) {
    return this.clientsService.getClientImpersonateLogs(id);
  }

  /**
   * DELETE /clients/:id
   * Remove permanentemente um cliente e todos os dados relacionados
   *
   * REQUER: SUPERADMIN
   *
   * ATENÇÃO: Esta ação é IRREVERSÍVEL!
   * Deleta cliente, tenant, payments, finance transactions e logs.
   *
   * @version v2.39.2
   */
  @Delete(':id')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.clientsService.remove(id, user.id, user.role);
  }
}
