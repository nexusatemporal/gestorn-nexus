import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { OneNexusModule } from '../integrations/one-nexus/one-nexus.module';

@Module({
  imports: [OneNexusModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
