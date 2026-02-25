import { Controller, Get } from '@nestjs/common';
import { Public } from '@/common/decorators/public.decorator';

/**
 * Health Check Controller
 * Endpoint público para verificar se a API está funcionando
 */
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Gestor Nexus API',
      version: '1.0.0',
    };
  }
}
