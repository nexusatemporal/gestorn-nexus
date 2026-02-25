import { Module } from '@nestjs/common';
import { FunnelStagesService } from './funnel-stages.service';
import { FunnelStagesController } from './funnel-stages.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FunnelStagesController],
  providers: [FunnelStagesService],
  exports: [FunnelStagesService],
})
export class FunnelStagesModule {}
