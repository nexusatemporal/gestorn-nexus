/**
 * 🧩 SALES AI MODULE
 */

import { Module } from '@nestjs/common';
import { SalesAIController } from './sales-ai.controller';
import { SalesAIService } from './sales-ai.service';

@Module({
  controllers: [SalesAIController],
  providers: [SalesAIService],
  exports: [SalesAIService],
})
export class SalesAIModule {}
