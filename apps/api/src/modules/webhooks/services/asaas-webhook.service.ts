import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { IdempotencyService } from './idempotency.service';
import { AsaasWebhookDto, AsaasStatusMap } from '../dto/asaas-webhook.dto';
import { PaymentStatus, ClientStatus } from '@prisma/client';

/**
 * Asaas Webhook Service
 *
 * Processa webhooks do gateway Asaas (cartão e boleto).
 *
 * EVENTOS SUPORTADOS:
 * - PAYMENT_RECEIVED: Pagamento confirmado → atualizar Payment
 * - PAYMENT_CONFIRMED: Pagamento compensado → atualizar lastPaymentDate
 * - PAYMENT_OVERDUE: Pagamento vencido → marcar cliente como inadimplente
 * - PAYMENT_REFUNDED: Pagamento estornado → atualizar status
 *
 * SEGURANÇA:
 * - Validação de access token no header (via controller)
 * - Idempotência via IdempotencyService
 *
 * REFERÊNCIA:
 * - https://docs.asaas.com/reference/webhooks
 */

@Injectable()
export class AsaasWebhookService {
  private readonly logger = new Logger(AsaasWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Valida token de acesso do Asaas
   */
  validateAccessToken(token: string): boolean {
    const expectedToken = this.config.get<string>('ASAAS_WEBHOOK_TOKEN');

    if (!expectedToken) {
      this.logger.error('❌ ASAAS_WEBHOOK_TOKEN não configurado');
      return false;
    }

    return token === expectedToken;
  }

  /**
   * Processa webhook do Asaas
   */
  async handleWebhook(payload: AsaasWebhookDto): Promise<void> {
    const eventId = `${payload.event}_${payload.payment.id}`;

    // Verificar idempotência
    if (this.idempotency.isProcessed('asaas', eventId)) {
      this.logger.warn(`⚠️ Evento Asaas duplicado ignorado: ${eventId}`);
      return;
    }

    this.logger.log(`📥 Processando webhook Asaas: ${payload.event} (${payload.payment.id})`);

    try {
      switch (payload.event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          await this.handlePaymentReceived(payload);
          break;

        case 'PAYMENT_OVERDUE':
          await this.handlePaymentOverdue(payload);
          break;

        case 'PAYMENT_REFUNDED':
          await this.handlePaymentRefunded(payload);
          break;

        case 'PAYMENT_CREATED':
        case 'PAYMENT_AWAITING_PAYMENT':
          // Apenas logar, não precisa atualizar nada
          this.logger.log(`ℹ️ Evento informativo: ${payload.event}`);
          break;

        case 'PAYMENT_DELETED':
          await this.handlePaymentDeleted(payload);
          break;

        default:
          this.logger.warn(`⚠️ Evento Asaas não tratado: ${payload.event}`);
      }

      // Marcar como processado
      this.idempotency.markAsProcessed('asaas', eventId);
      this.logger.log(`✅ Webhook Asaas processado com sucesso: ${payload.event}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao processar webhook Asaas: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handler: PAYMENT_RECEIVED / PAYMENT_CONFIRMED
   * Marca pagamento como pago e atualiza cliente
   */
  private async handlePaymentReceived(payload: AsaasWebhookDto): Promise<void> {
    const { payment } = payload;

    // Buscar Payment pelo gatewayId (ID no Asaas)
    const dbPayment = await this.prisma.payment.findFirst({
      where: {
        gateway: 'ASAAS',
        gatewayId: payment.id,
      },
      include: {
        client: true,
      },
    });

    if (!dbPayment) {
      // Se não encontrar, pode ser que ainda não foi criado
      // Logar como warning mas não falhar
      this.logger.warn(`⚠️ Payment não encontrado para Asaas ID: ${payment.id}`);
      return;
    }

    // Atualizar Payment
    const updatedPayment = await this.prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: payment.paymentDate ? new Date(payment.paymentDate) : new Date(),
        gatewayData: payment as any, // Salvar dados brutos
      },
    });

    this.logger.log(`✅ Payment atualizado: ${updatedPayment.id} → PAID`);

    // Atualizar Cliente
    await this.prisma.client.update({
      where: { id: dbPayment.clientId },
      data: {
        status: ClientStatus.ATIVO,
      },
    });

    this.logger.log(`✅ Cliente reativado: ${dbPayment.client.company} → ATIVO`);
  }

  /**
   * Handler: PAYMENT_OVERDUE
   * Marca pagamento como vencido e cliente como inadimplente
   */
  private async handlePaymentOverdue(payload: AsaasWebhookDto): Promise<void> {
    const { payment } = payload;

    const dbPayment = await this.prisma.payment.findFirst({
      where: {
        gateway: 'ASAAS',
        gatewayId: payment.id,
      },
      include: {
        client: true,
      },
    });

    if (!dbPayment) {
      this.logger.warn(`⚠️ Payment não encontrado para Asaas ID: ${payment.id}`);
      return;
    }

    // Atualizar Payment
    await this.prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: PaymentStatus.OVERDUE,
        gatewayData: payment as any,
      },
    });

    // Atualizar Cliente para INADIMPLENTE
    await this.prisma.client.update({
      where: { id: dbPayment.clientId },
      data: {
        status: ClientStatus.INADIMPLENTE,
      },
    });

    this.logger.warn(`⚠️ Cliente marcado como INADIMPLENTE: ${dbPayment.client.company}`);
  }

  /**
   * Handler: PAYMENT_REFUNDED
   * Marca pagamento como estornado
   */
  private async handlePaymentRefunded(payload: AsaasWebhookDto): Promise<void> {
    const { payment } = payload;

    const dbPayment = await this.prisma.payment.findFirst({
      where: {
        gateway: 'ASAAS',
        gatewayId: payment.id,
      },
    });

    if (!dbPayment) {
      this.logger.warn(`⚠️ Payment não encontrado para Asaas ID: ${payment.id}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        gatewayData: payment as any,
      },
    });

    this.logger.log(`✅ Payment estornado: ${dbPayment.id} → REFUNDED`);
  }

  /**
   * Handler: PAYMENT_DELETED
   * Marca pagamento como cancelado
   */
  private async handlePaymentDeleted(payload: AsaasWebhookDto): Promise<void> {
    const { payment } = payload;

    const dbPayment = await this.prisma.payment.findFirst({
      where: {
        gateway: 'ASAAS',
        gatewayId: payment.id,
      },
    });

    if (!dbPayment) {
      this.logger.warn(`⚠️ Payment não encontrado para Asaas ID: ${payment.id}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: PaymentStatus.CANCELLED,
      },
    });

    this.logger.log(`✅ Payment cancelado: ${dbPayment.id} → CANCELLED`);
  }
}
