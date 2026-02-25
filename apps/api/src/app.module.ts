import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

// Prisma
import { PrismaModule } from './prisma/prisma.module';

// Guards globais
import { RolesGuard } from './common/guards/roles.guard';

// Módulos
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { PlansModule } from './modules/plans/plans.module';
import { UsersModule } from './modules/users/users.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ClientsModule } from './modules/clients/clients.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { SalesAIModule } from './modules/sales-ai/sales-ai.module';
import { AuditModule } from './modules/audit/audit.module';
import { FunnelStagesModule } from './modules/funnel-stages/funnel-stages.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { FinanceModule } from './modules/finance/finance.module';
import { SubscriptionModule } from './modules/subscriptions/subscriptions.module';

/**
 * App Module - Módulo raiz da aplicação
 *
 * GUARDS GLOBAIS:
 * 1. JwtAuthGuard - Verifica autenticação JWT em TODAS as rotas (exceto @Public()) [v2.54.0]
 * 2. RolesGuard - Verifica permissões baseado em @Roles()
 *
 * IMPORTANTE:
 * - PrismaModule é @Global(), disponível em toda aplicação
 * - ConfigModule carrega variáveis de ambiente
 * - Guards são aplicados na ordem definida
 */
@Module({
  imports: [
    // ══════════════════════════════════════════════════════════════════════════
    // CONFIG - Variáveis de ambiente
    // ══════════════════════════════════════════════════════════════════════════
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ══════════════════════════════════════════════════════════════════════════
    // DATABASE - Prisma ORM
    // ══════════════════════════════════════════════════════════════════════════
    PrismaModule,

    // ══════════════════════════════════════════════════════════════════════════
    // SCHEDULER - Cron Jobs (v2.39.0)
    // ══════════════════════════════════════════════════════════════════════════
    ScheduleModule.forRoot(),

    // ══════════════════════════════════════════════════════════════════════════
    // AUTH - Autenticação JWT própria (v2.54.0 - substitui Clerk)
    // ══════════════════════════════════════════════════════════════════════════
    AuthModule,

    // ══════════════════════════════════════════════════════════════════════════
    // MÓDULOS DA APLICAÇÃO
    // ══════════════════════════════════════════════════════════════════════════
    HealthModule,
    PlansModule,
    UsersModule,
    LeadsModule,
    ClientsModule,
    PaymentsModule,
    TenantsModule,
    WebhooksModule,
    DashboardModule,
    CalendarModule,
    SalesAIModule,
    AuditModule,
    FunnelStagesModule,
    IntegrationsModule,
    FinanceModule,
    SubscriptionModule, // v2.40.0 - Billing Lifecycle
  ],
  providers: [
    // ══════════════════════════════════════════════════════════════════════════
    // GUARDS GLOBAIS (ordem importa!)
    // ══════════════════════════════════════════════════════════════════════════
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // 1º - Autentica usuário (v2.54.0 - JWT próprio)
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // 2º - Verifica permissões
    },
  ],
})
export class AppModule {}
