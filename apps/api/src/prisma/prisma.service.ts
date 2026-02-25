import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service
 * Gerencia a conexão com o banco de dados PostgreSQL via Prisma ORM
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });

    // Log de queries em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      // @ts-ignore
      this.$on('query', (e: any) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }

    // @ts-ignore
    this.$on('error', (e: any) => {
      this.logger.error(`Prisma Error: ${e.message}`);
    });

    // @ts-ignore
    this.$on('warn', (e: any) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Conectado ao banco de dados PostgreSQL');
    } catch (error) {
      this.logger.error('❌ Falha ao conectar ao banco de dados', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Desconectado do banco de dados');
  }

  /**
   * Executa uma transação com retry automático em caso de deadlock
   */
  async executeTransaction<T>(
    fn: (prisma: PrismaClient) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.$transaction(fn);
      } catch (error) {
        lastError = error as Error;

        // Retry apenas em deadlocks
        if (
          error.code === 'P2034' || // Transaction failed due to write conflict
          error.code === 'P2028'    // Transaction API error
        ) {
          this.logger.warn(
            `Tentativa ${attempt}/${maxRetries} falhou, retentando...`,
          );

          // Backoff exponencial
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 100),
          );

          continue;
        }

        // Para outros erros, lançar imediatamente
        throw error;
      }
    }

    throw lastError || new Error('Transaction failed after max retries');
  }

  /**
   * Soft delete helper - atualiza isActive para false
   */
  async softDelete(model: string, id: string): Promise<any> {
    // @ts-ignore
    return this[model].update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Restore helper - atualiza isActive para true
   */
  async restore(model: string, id: string): Promise<any> {
    // @ts-ignore
    return this[model].update({
      where: { id },
      data: { isActive: true },
    });
  }
}
