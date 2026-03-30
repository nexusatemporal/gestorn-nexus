import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ChatNexusService } from './chat-nexus.service';
import { ChatNexusController } from './chat-nexus.controller';
import { LeadsModule } from '../../leads/leads.module';

@Module({
  imports: [
    HttpModule.register({ timeout: 10000 }),
    ConfigModule,
    LeadsModule,
  ],
  controllers: [ChatNexusController],
  providers: [ChatNexusService],
  exports: [ChatNexusService],
})
export class ChatNexusModule {}
