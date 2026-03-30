import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LeadsController } from './leads.controller';
import { LeadsPartnerController } from './leads-partner.controller';
import { LeadsService } from './leads.service';
import { LeadScoreService } from './services/lead-score.service';
import { SubscriptionModule } from '../subscriptions/subscriptions.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SubscriptionModule, TenantsModule, ConfigModule],
  controllers: [LeadsController, LeadsPartnerController],
  providers: [LeadsService, LeadScoreService],
  exports: [LeadsService, LeadScoreService], // Exportar para uso em ClientsModule (conversão de lead)
})
export class LeadsModule {}
