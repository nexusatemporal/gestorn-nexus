import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { IdempotencyService } from './idempotency.service';
import { AbacatePayWebhookDto, AbacatePayStatusMap } from '../dto/abacatepay-webhook.dto';
import { PaymentStatus, ClientStatus } from '@prisma/client';
import { createHmac } from 'crypto';

/**
 * AbacatePay Webhook Service
 *
 * Processa webhooks do gateway AbacatePay (PIX).
 *
 * EVENTOS SUPORTADOS:
 * - billing.paid: Pagamento PIX confirmado → atualizar Payment e Client
 * - billing.expired: PIX expirado → cancelar Payment
 * - billing.refunded: PIX estornado → atualizar status
 * - billing.updated: Atualização de status
 *
 * SEGURANÇA:
 * - Validação HMAC signature no header X-Signature
 * - Idempotência via IdempotencyService
 *
 * REFERÊNCIA:
 * - https://docs.abacatepay.com/webhooks
 */

@Injectable()
export class AbacatePayWebhookService {
  private readonly logger = new Logger(AbacatePayWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Valida assinatura HMAC do webhook
   *
   * @param payload - Corpo do webhook (string)
   * @param signature - Assinatura do header X-Signature
   * @returns true se válida, false caso contrário
   */
  validateSignature(payload: string, signature: string): boolean {
    const secret = this.config.get<string>('ABACATEPAY_WEBHOOK_SECRET');

    if (!secret) {
      this.logger.error('❌ ABACATEPAY_WEBHOOK_SECRET não configurado');
      return false;
    }

    // Calcular HMAC SHA256
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Comparar com timing-safe
    const isValid = this.timingSafeEqual(signature, expectedSignature);

    if (!isValid) {
      this.logger.error('❌ Assinatura HMAC inválida');
    }

    return isValid;
  }

  /**
   * Processa webhook do AbacatePay
   */
  async handleWebhook(payload: AbacatePayWebhookDto): Promise<void> {
    const eventId = `${payload.event}_${payload.data.id}`;

    // Verificar idempotência
    if (this.idempotency.isProcessed('abacatepay', eventId)) {
      this.logger.warn(`⚠️ Evento AbacatePay duplicado ignorado: ${eventId}`);
      return;
    }

    this.logger.log(`📥 Processando webhook AbacatePay: ${payload.event} (${payload.data.id})`);

    try {
      switch (payload.event) {
        case 'billing.paid':
          await this.handleBillingPaid(payload);
          break;

        case 'billing.expired':
          await this.handleBillingExpired(payload);
          break;

        case 'billing.refunded':
          await this.handleBillingRefunded(payload);
          break;

        case 'billing.updated':
          await this.handleBillingUpdated(payload);
          break;

        default:
          this.logger.warn(`⚠️ Evento AbacatePay não tratado: ${payload.event}`);
      }

      // Marcar como processado
      this.idempotency.markAsProcessed('abacatepay', eventId);
      this.logger.log(`✅ Webhook AbacatePay processado com sucesso: ${payload.event}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao processar webhook AbacatePay: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handler: billing.paid
   * PIX confirmado → atualizar Payment e Client
   */
  private async handleBillingPaid(payload: AbacatePayWebhookDto): Promise<void> {
    const { data } = payload;

    // Buscar Payment usando payment_id do metadata ou gatewayId
    const paymentId = data.metadata?.payment_id;
    let dbPayment;

    if (paymentId) {
      // Buscar por ID interno
      dbPayment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { client: true },
      });
    } else {
      // Buscar por gatewayId (ID do AbacatePay)
      dbPayment = await this.prisma.payment.findFirst({
        where: {
          gateway: 'ABACATEPAY',
          gatewayId: data.id,
        },
        include: { client: true },
      });
    }

    if (!dbPayment) {
      this.logger.warn(`⚠️ Payment não encontrado para AbacatePay ID: ${data.id}`);
      return;
    }

    // Atualizar Payment
    const updatedPayment = await this.prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
        gatewayData: data as any, // Salvar dados brutos
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
   * Handler: billing.expired
   * PIX expirado → cancelar Payment
   */
  private async handleBillingExpired(payload: AbacatePayWebhookDto): Promise<void> {
    const { data } = payload;

    const dbPayment = await this.prisma.payment.findFirst({
      where: {
        gateway: 'ABACATEPAY',
        gatewayId: data.id,
      },
    });

    if (!dbPayment) {
      this.logger.warn(`⚠️ Payment não encontrado para AbacatePay ID: ${data.id}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: PaymentStatus.CANCELLED,
        gatewayData: data as any,
      },
    });

    this.logger.log(`⚠️ Payment expirado: ${dbPayment.id} → CANCELLED`);
  }

  /**
   * Handler: billing.refunded
   * PIX estornado → atualizar status
   */
  private async handleBillingRefunded(payload: AbacatePayWebhookDto): Promise<void> {
    const { data } = payload;

    const dbPayment = await this.prisma.payment.findFirst({
      where: {
        gateway: 'ABACATEPAY',
        gatewayId: data.id,
      },
    });

    if (!dbPayment) {
      this.logger.warn(`⚠️ Payment não encontrado para AbacatePay ID: ${data.id}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: dbPayment.id },
      data: {
        status: PaymentStatus.REFUNDED,
        gatewayData: data as any,
      },
    });

    this.logger.log(`✅ Payment estornado: ${dbPayment.id} → REFUNDED`);
  }

  /**
   * Handler: billing.updated
   * Status atualizado (pode ser qualquer mudança)
   */
  private async handleBillingUpdated(payload: AbacatePayWebhookDto): Promise<void> {
    const { data } = payload;

    // Apenas logar, status específicos são tratados pelos outros eventos
    this.logger.log(`ℹ️ Billing atualizado: ${data.id} → ${data.status}`);

    // Atualizar gatewayData se Payment existir
    const dbPayment = await this.prisma.payment.findFirst({
      where: {
        gateway: 'ABACATEPAY',
        gatewayId: data.id,
      },
    });

    if (dbPayment) {
      await this.prisma.payment.update({
        where: { id: dbPayment.id },
        data: {
          gatewayData: data as any,
        },
      });
    }
  }

  /**
   * Comparação timing-safe para evitar timing attacks
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
