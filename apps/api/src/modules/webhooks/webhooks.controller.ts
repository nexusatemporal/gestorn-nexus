import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UsePipes,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { AsaasWebhookService } from './services/asaas-webhook.service';
import { AbacatePayWebhookService } from './services/abacatepay-webhook.service';
import {
  AsaasWebhookDto,
  AsaasWebhookSchema,
} from './dto/asaas-webhook.dto';
import {
  AbacatePayWebhookDto,
  AbacatePayWebhookSchema,
} from './dto/abacatepay-webhook.dto';

/**
 * Webhooks Controller
 *
 * Endpoints publicos para receber webhooks de integracoes externas.
 *
 * SEGURANCA:
 * - Rotas marcadas como @Public() (sem autenticacao JWT)
 * - Asaas: Validacao de access token no header
 * - AbacatePay: Validacao HMAC no header X-Signature
 *
 * IDEMPOTENCIA:
 * - Todos os webhooks sao idempotentes
 * - Cache em memoria com TTL de 24h
 *
 * ENDPOINTS:
 * - POST /webhooks/asaas - Webhooks do Asaas (pagamentos)
 * - POST /webhooks/abacatepay - Webhooks do AbacatePay (PIX)
 *
 * v2.54.0: Removido webhook Clerk (auth proprio JWT)
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly asaasWebhook: AsaasWebhookService,
    private readonly abacatePayWebhook: AbacatePayWebhookService,
  ) {}

  /**
   * POST /webhooks/asaas
   *
   * Recebe webhooks do Asaas (pagamentos).
   *
   * HEADERS ESPERADOS:
   * - asaas-access-token: Token de validação
   *
   * EVENTOS SUPORTADOS:
   * - PAYMENT_RECEIVED
   * - PAYMENT_CONFIRMED
   * - PAYMENT_OVERDUE
   * - PAYMENT_REFUNDED
   * - PAYMENT_DELETED
   */
  @Public()
  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(AsaasWebhookSchema))
  async handleAsaasWebhook(
    @Body() payload: AsaasWebhookDto,
    @Headers('asaas-access-token') accessToken?: string,
  ) {
    // Validar token de acesso
    if (!accessToken) {
      throw new UnauthorizedException('Header asaas-access-token ausente');
    }

    const isValid = this.asaasWebhook.validateAccessToken(accessToken);
    if (!isValid) {
      throw new UnauthorizedException('Token de acesso Asaas inválido');
    }

    await this.asaasWebhook.handleWebhook(payload);

    return { success: true };
  }

  /**
   * POST /webhooks/abacatepay
   *
   * Recebe webhooks do AbacatePay (PIX).
   *
   * HEADERS ESPERADOS:
   * - X-Signature: Assinatura HMAC SHA256
   *
   * EVENTOS SUPORTADOS:
   * - billing.paid
   * - billing.expired
   * - billing.refunded
   * - billing.updated
   */
  @Public()
  @Post('abacatepay')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(AbacatePayWebhookSchema))
  async handleAbacatePayWebhook(
    @Body() payload: AbacatePayWebhookDto,
    @Headers('x-signature') signature?: string,
    @Req() req?: Request,
  ) {
    // Validar assinatura HMAC
    if (!signature) {
      throw new UnauthorizedException('Header X-Signature ausente');
    }

    // Pegar body bruto para validação HMAC
    const rawBody = JSON.stringify(payload);

    const isValid = this.abacatePayWebhook.validateSignature(rawBody, signature);
    if (!isValid) {
      throw new UnauthorizedException('Assinatura HMAC inválida');
    }

    await this.abacatePayWebhook.handleWebhook(payload);

    return { success: true };
  }
}
