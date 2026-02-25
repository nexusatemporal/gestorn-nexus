import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import * as express from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Criar aplicação com raw body para webhooks
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // ══════════════════════════════════════════════════════════════════════════════
  // CORS
  // ══════════════════════════════════════════════════════════════════════════════
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:5173')
    .split(',');

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  logger.log(`✅ CORS habilitado para: ${corsOrigins.join(', ')}`);

  // ══════════════════════════════════════════════════════════════════════════════
  // GLOBAL PREFIX
  // ══════════════════════════════════════════════════════════════════════════════
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  // ══════════════════════════════════════════════════════════════════════════════
  // VALIDATION PIPE (Class Validator + Zod)
  // ══════════════════════════════════════════════════════════════════════════════
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove propriedades não definidas no DTO
      forbidNonWhitelisted: true, // Rejeita se houver propriedades extras
      transform: true, // Transforma payloads em instâncias de DTO
      transformOptions: {
        enableImplicitConversion: true, // Converte tipos automaticamente
      },
    }),
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // RAW BODY para Webhooks (AbacatePay, Asaas)
  // ══════════════════════════════════════════════════════════════════════════════
  app.use(
    `/${apiPrefix}/webhooks/abacatepay`,
    express.raw({ type: 'application/json' }),
  );
  app.use(
    `/${apiPrefix}/webhooks/asaas`,
    express.raw({ type: 'application/json' }),
  );

  // ══════════════════════════════════════════════════════════════════════════════
  // GRACEFUL SHUTDOWN
  // ══════════════════════════════════════════════════════════════════════════════
  app.enableShutdownHooks();

  // ══════════════════════════════════════════════════════════════════════════════
  // START SERVER
  // ══════════════════════════════════════════════════════════════════════════════
  const port = configService.get<number>('PORT', 3001);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  await app.listen(port);

  logger.log(`
  ╔══════════════════════════════════════════════════════════════════════════════╗
  ║                       🚀 GESTOR NEXUS API                                    ║
  ╠══════════════════════════════════════════════════════════════════════════════╣
  ║  Ambiente:    ${nodeEnv.toUpperCase().padEnd(60)} ║
  ║  URL:         http://localhost:${port}/${apiPrefix.padEnd(41)} ║
  ║  Health:      http://localhost:${port}/${apiPrefix}/health${' '.repeat(33)} ║
  ║  Docs:        http://localhost:${port}/${apiPrefix}/docs${' '.repeat(35)} ║
  ╚══════════════════════════════════════════════════════════════════════════════╝
  `);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('❌ Falha ao iniciar aplicação', error);
  process.exit(1);
});
