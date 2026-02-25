import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UsePipes,
} from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { UpdateIntegrationDto, UpdateIntegrationSchema } from './dto/update-integration.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

/**
 * Integrations Controller
 * Endpoints para gerenciar integrações externas
 *
 * PERMISSÕES:
 * - GET (listar/visualizar): SUPERADMIN, ADMINISTRATIVO, DESENVOLVEDOR
 * - PATCH (atualizar): SUPERADMIN, DESENVOLVEDOR
 * - POST (testar/sincronizar): SUPERADMIN, DESENVOLVEDOR
 */
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  /**
   * GET /integrations
   * Lista todas as integrações
   */
  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.DESENVOLVEDOR)
  async findAll() {
    return this.integrationsService.findAll();
  }

  /**
   * GET /integrations/:id
   * Busca integração por ID
   */
  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.DESENVOLVEDOR)
  async findOne(@Param('id') id: string) {
    return this.integrationsService.findOne(id);
  }

  /**
   * GET /integrations/name/:name
   * Busca integração por nome
   */
  @Get('name/:name')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.DESENVOLVEDOR)
  async findByName(@Param('name') name: string) {
    return this.integrationsService.findByName(name);
  }

  /**
   * PATCH /integrations/:id
   * Atualiza configuração de integração
   *
   * REQUER: SUPERADMIN ou DESENVOLVEDOR
   */
  @Patch(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  @UsePipes(new ZodValidationPipe(UpdateIntegrationSchema))
  async update(@Param('id') id: string, @Body() dto: UpdateIntegrationDto) {
    return this.integrationsService.update(id, dto);
  }

  /**
   * POST /integrations/:id/test
   * Testa conexão com integração
   *
   * REQUER: SUPERADMIN ou DESENVOLVEDOR
   */
  @Post(':id/test')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  async test(@Param('id') id: string) {
    return this.integrationsService.test(id);
  }

  /**
   * POST /integrations/:id/sync
   * Força sincronização com integração
   *
   * REQUER: SUPERADMIN ou DESENVOLVEDOR
   */
  @Post(':id/sync')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  async sync(@Param('id') id: string) {
    return this.integrationsService.sync(id);
  }
}
