import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { IdempotencyService } from './services/idempotency.service';
import { AsaasWebhookService } from './services/asaas-webhook.service';
import { AbacatePayWebhookService } from './services/abacatepay-webhook.service';

/**
 * Webhooks Module
 *
 * Modulo para processar webhooks de integracoes externas.
 *
 * INTEGRACOES:
 * - Asaas: Webhooks de pagamento (cartao/boleto)
 * - AbacatePay: Webhooks de pagamento PIX
 *
 * FEATURES:
 * - Validacao de assinaturas (access token, HMAC)
 * - Idempotencia com cache em memoria (TTL 24h)
 * - Retry logic (futuro: usar fila como BullMQ)
 * - Audit logging
 *
 * ROTAS:
 * - POST /webhooks/asaas
 * - POST /webhooks/abacatepay
 *
 * v2.54.0: Removido ClerkWebhookService (auth proprio JWT)
 */
@Module({
  controllers: [WebhooksController],
  providers: [
    IdempotencyService,
    AsaasWebhookService,
    AbacatePayWebhookService,
  ],
  exports: [
    IdempotencyService,
    AsaasWebhookService,
    AbacatePayWebhookService,
  ],
})
export class WebhooksModule {}
