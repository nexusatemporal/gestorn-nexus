import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator @Public()
 * Marca uma rota como pública (sem autenticação)
 *
 * @example
 * @Public()
 * @Get('health')
 * async healthCheck() {
 *   return { status: 'ok' };
 * }
 *
 * @note
 * Use apenas para rotas que realmente não precisam de autenticação:
 * - Health check
 * - Webhooks (que verificam assinatura)
 * - Páginas públicas de status
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
