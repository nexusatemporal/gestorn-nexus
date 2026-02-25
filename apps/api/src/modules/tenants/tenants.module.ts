import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService], // Exportar para uso em outros módulos (ex: ClientsModule)
})
export class TenantsModule {}
