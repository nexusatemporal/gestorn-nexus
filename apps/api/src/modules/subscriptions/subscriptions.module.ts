import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscriptions.service';
import { SubscriptionController } from './subscriptions.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
