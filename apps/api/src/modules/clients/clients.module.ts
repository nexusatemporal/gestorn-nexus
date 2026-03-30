import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { SubscriptionModule } from '../subscriptions/subscriptions.module'; // v2.46.0
import { TenantsModule } from '../tenants/tenants.module';
import { OneNexusModule } from '../integrations/one-nexus/one-nexus.module';

@Module({
  imports: [SubscriptionModule, TenantsModule, OneNexusModule], // v2.46.0 - Billing Lifecycle
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService], // Exportar para uso em PaymentsModule, etc
})
export class ClientsModule {}
