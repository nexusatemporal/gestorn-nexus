import { Module } from '@nestjs/common';
import { StatusConfigsService } from './status-configs.service';
import { StatusConfigsController } from './status-configs.controller';

@Module({
  controllers: [StatusConfigsController],
  providers: [StatusConfigsService],
  exports: [StatusConfigsService],
})
export class StatusConfigsModule {}
