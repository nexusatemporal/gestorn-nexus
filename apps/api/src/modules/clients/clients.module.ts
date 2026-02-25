import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { SubscriptionModule } from '../subscriptions/subscriptions.module'; // v2.46.0

@Module({
  imports: [SubscriptionModule], // v2.46.0 - Billing Lifecycle
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService], // Exportar para uso em PaymentsModule, etc
})
export class ClientsModule {}
