import { Injectable, Logger } from '@nestjs/common';

/**
 * Idempotency Service
 *
 * Garante que webhooks não sejam processados mais de uma vez,
 * mesmo se recebermos o mesmo evento múltiplas vezes.
 *
 * ESTRATÉGIA:
 * - Usa Map em memória com TTL de 24h
 * - Chave: "source:eventId" (ex: "clerk:evt_123", "asaas:pay_456")
 * - Cleanup automático a cada 1 hora
 *
 * TODO (Produção):
 * - Substituir por Redis para suportar múltiplas instâncias
 * - Ou criar model WebhookEvent no Prisma
 */

interface IdempotencyRecord {
  processedAt: Date;
  expiresAt: Date;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly cache = new Map<string, IdempotencyRecord>();

  // TTL: 24 horas (webhooks podem ser reenviados em até 24h)
  private readonly TTL_MS = 24 * 60 * 60 * 1000;

  // Cleanup a cada 1 hora
  private readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

  constructor() {
    // Iniciar cleanup periódico
    this.startCleanupTask();
    this.logger.log('✅ IdempotencyService inicializado com cache em memória');
  }

  /**
   * Verifica se um evento já foi processado
   *
   * @param source - Origem do webhook (clerk, asaas, abacatepay)
   * @param eventId - ID único do evento
   * @returns true se já foi processado, false caso contrário
   */
  isProcessed(source: string, eventId: string): boolean {
    const key = this.buildKey(source, eventId);
    const record = this.cache.get(key);

    if (!record) {
      return false;
    }

    // Verificar se expirou
    if (new Date() > record.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    this.logger.warn(`⚠️ Evento duplicado detectado: ${key} (processado em ${record.processedAt.toISOString()})`);
    return true;
  }

  /**
   * Marca um evento como processado
   *
   * @param source - Origem do webhook
   * @param eventId - ID único do evento
   */
  markAsProcessed(source: string, eventId: string): void {
    const key = this.buildKey(source, eventId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.TTL_MS);

    this.cache.set(key, {
      processedAt: now,
      expiresAt,
    });

    this.logger.log(`✅ Evento marcado como processado: ${key} (expira em ${expiresAt.toISOString()})`);
  }

  /**
   * Remove manualmente um evento do cache (útil para testes)
   */
  remove(source: string, eventId: string): void {
    const key = this.buildKey(source, eventId);
    this.cache.delete(key);
  }

  /**
   * Limpa todo o cache (útil para testes)
   */
  clear(): void {
    this.cache.clear();
    this.logger.warn('⚠️ Cache de idempotência limpo manualmente');
  }

  /**
   * Retorna estatísticas do cache
   */
  getStats() {
    return {
      totalRecords: this.cache.size,
      ttlMs: this.TTL_MS,
      cleanupIntervalMs: this.CLEANUP_INTERVAL_MS,
    };
  }

  /**
   * Constrói chave única para o cache
   */
  private buildKey(source: string, eventId: string): string {
    return `${source}:${eventId}`;
  }

  /**
   * Inicia task de cleanup periódico
   */
  private startCleanupTask(): void {
    setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Remove registros expirados do cache
   */
  private cleanup(): void {
    const now = new Date();
    let removedCount = 0;

    for (const [key, record] of this.cache.entries()) {
      if (now > record.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`🧹 Cleanup: ${removedCount} registros expirados removidos (total restante: ${this.cache.size})`);
    }
  }
}
