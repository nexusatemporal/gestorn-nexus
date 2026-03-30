import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { ChatNexusModule } from './chat-nexus/chat-nexus.module';
import { OneNexusModule } from './one-nexus/one-nexus.module';

@Module({
  imports: [PrismaModule, ChatNexusModule, OneNexusModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService, ChatNexusModule, OneNexusModule],
})
export class IntegrationsModule {}
