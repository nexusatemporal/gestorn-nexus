import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, CreatePaymentSchema } from './dto/create-payment.dto';
import { UpdatePaymentDto, UpdatePaymentSchema } from './dto/update-payment.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole, PaymentStatus, PaymentMethod } from '@prisma/client';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AuthUser } from '@/common/interfaces/auth-user.interface';

/**
 * Payments Controller
 * Endpoints para gerenciar pagamentos
 *
 * PERMISSÕES:
 * - GET: Todos usuários autenticados (com scoping por role)
 * - POST/PUT: Apenas SUPERADMIN e ADMINISTRATIVO
 * - Webhooks dos gateways também podem criar/atualizar (via WebhooksModule)
 *
 * SCOPING:
 * - SUPERADMIN/ADMINISTRATIVO: Veem todos os pagamentos
 * - GESTOR: Vê pagamentos dos clientes da equipe
 * - VENDEDOR: Vê pagamentos dos seus clientes
 */
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * GET /payments
   * Lista pagamentos (com scoping por role)
   *
   * Query params:
   * - status?: PaymentStatus
   * - method?: PaymentMethod
   * - clientId?: string
   */
  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: PaymentStatus,
    @Query('method') method?: PaymentMethod,
    @Query('clientId') clientId?: string,
  ) {
    return this.paymentsService.findAll({
      currentUserId: user.id,
      currentUserRole: user.role,
      status,
      method,
      clientId,
    });
  }

  /**
   * GET /payments/stats
   * Estatísticas de pagamentos (dashboard)
   */
  @Get('stats')
  async getStats(@CurrentUser() user: AuthUser) {
    return this.paymentsService.getStats(user.id, user.role);
  }

  /**
   * GET /payments/:id
   * Busca pagamento por ID (com validação de acesso)
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.findOne(id, user.id, user.role);
  }

  /**
   * GET /payments/external/:externalId
   * Busca pagamento por external ID (gateway)
   * Apenas SUPERADMIN e ADMINISTRATIVO
   */
  @Get('external/:externalId')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async findByExternalId(@Param('externalId') externalId: string) {
    return this.paymentsService.findByExternalId(externalId);
  }

  /**
   * POST /payments
   * Cria um novo pagamento manualmente
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   * NOTA: Pagamentos são geralmente criados por webhooks
   */
  @Post()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @UsePipes(new ZodValidationPipe(CreatePaymentSchema))
  async create(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.create(dto, user.id, user.role);
  }

  /**
   * PUT /payments/:id
   * Atualiza um pagamento
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   * NOTA: Atualizações geralmente vêm de webhooks
   */
  @Put(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @UsePipes(new ZodValidationPipe(UpdatePaymentSchema))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.update(id, dto, user.id, user.role);
  }

  /**
   * POST /payments/:id/mark-as-paid
   * Marca pagamento como pago
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   */
  @Post(':id/mark-as-paid')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async markAsPaid(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.markAsPaid(id, user.id, user.role);
  }

  /**
   * POST /payments/:id/cancel
   * Cancela um pagamento
   *
   * REQUER: SUPERADMIN ou ADMINISTRATIVO
   */
  @Post(':id/cancel')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async cancel(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.cancel(id, user.id, user.role);
  }
}
