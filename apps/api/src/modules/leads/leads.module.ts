import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadScoreService } from './services/lead-score.service';
import { SubscriptionModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadScoreService],
  exports: [LeadsService, LeadScoreService], // Exportar para uso em ClientsModule (conversão de lead)
})
export class LeadsModule {}
