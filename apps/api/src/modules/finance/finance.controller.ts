import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FinanceService } from './finance.service';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { UserRole } from '@prisma/client';
import {
  CreateTransactionDto, createTransactionSchema,
  UpdateTransactionDto, updateTransactionSchema,
  TransactionFiltersDto, transactionFiltersSchema,
} from './dto';

@Controller('finance')
@UseGuards(RolesGuard)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  // MÉTRICAS
  @Get('metrics')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async getMetrics(@Query('productType') productType?: string) {
    const data = await this.service.getMetrics(productType);
    return { success: true, data };
  }

  @Get('mrr-history')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async getMrrHistory(
    @Query('months') months?: string,
    @Query('productType') productType?: string,
  ) {
    const data = await this.service.getMrrHistory(
      months ? parseInt(months) : 6,
      productType,
    );
    return { success: true, data };
  }

  @Get('arr-history')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async getArrHistory(@Query('productType') productType?: string) {
    const data = await this.service.getArrHistory(productType);
    return { success: true, data };
  }

  @Get('aging-report')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async getAgingReport(@Query('productType') productType?: string) {
    const data = await this.service.getAgingReport(productType);
    return { success: true, data };
  }

  // NOVOS ENDPOINTS - INTEGRAÇÃO COM CLIENTES
  @Get('overdue')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async getOverdueClients() {
    const data = await this.service.getOverdueClients();
    return { success: true, data };
  }

  @Get('upcoming')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async getUpcomingDueDates() {
    const data = await this.service.getUpcomingDueDates();
    return { success: true, data };
  }

  @Get('client/:clientId/transactions')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async getClientTransactions(@Param('clientId') clientId: string) {
    const data = await this.service.getClientTransactions(clientId);
    return { success: true, data };
  }

  // CRUD
  @Get('transactions')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async findAll(@Query(new ZodValidationPipe(transactionFiltersSchema)) filters: TransactionFiltersDto) {
    const data = await this.service.findAll(filters);
    return { success: true, data };
  }

  @Get('transactions/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async findById(@Param('id') id: string) {
    const data = await this.service.findById(id);
    return { success: true, data };
  }

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async create(
    @Body(new ZodValidationPipe(createTransactionSchema)) body: CreateTransactionDto,
    @CurrentUser('id') userId: string,
  ) {
    const data = await this.service.create(body, userId);
    return { success: true, data, message: 'Transação criada' };
  }

  @Patch('transactions/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTransactionSchema)) body: UpdateTransactionDto,
  ) {
    const data = await this.service.update(id, body);
    return { success: true, data, message: 'Transação atualizada' };
  }

  @Patch('transactions/:id/pay')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async markAsPaid(@Param('id') id: string) {
    const data = await this.service.markAsPaid(id);
    return { success: true, data, message: 'Marcado como pago' };
  }

  @Delete('transactions/:id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
    return { success: true, message: 'Transação excluída' };
  }

  @Post('import-pdf')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  @UseInterceptors(FileInterceptor('file'))
  async importPdf(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo foi enviado');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('O arquivo deve ser um PDF');
    }
    const data = await this.service.importPdf(file.buffer, userId);
    return { success: true, data, message: 'PDF processado' };
  }
}
