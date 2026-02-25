import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { QueryAuditDto } from './dto/query-audit.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { AuthUser } from '@/common/interfaces/auth-user.interface';

/**
 * Audit Controller
 * Endpoints para visualizar logs de auditoria
 *
 * PERMISSÕES:
 * - SUPERADMIN: Acesso total
 * - ADMINISTRATIVO: Acesso total
 * - DESENVOLVEDOR: Acesso total (para debugging)
 * - GESTOR/VENDEDOR: Sem acesso
 */
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /audit
   * Lista logs de auditoria com filtros
   */
  @Get()
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.DESENVOLVEDOR)
  async findAll(@Query() query: QueryAuditDto, @CurrentUser() user: AuthUser) {
    return this.auditService.findAll(query, user.role);
  }

  /**
   * GET /audit/:id
   * Busca log específico
   */
  @Get(':id')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO, UserRole.DESENVOLVEDOR)
  async findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }

  /**
   * GET /audit/impersonate/logs
   * Lista logs de impersonate
   */
  @Get('impersonate/logs')
  @Roles(UserRole.SUPERADMIN, UserRole.DESENVOLVEDOR)
  async findImpersonateLogs(@CurrentUser() user: AuthUser) {
    return this.auditService.findImpersonateLogs(user.role);
  }

  /**
   * GET /audit/export
   * Exporta logs para CSV
   */
  @Get('export')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  async export(@Query() query: QueryAuditDto, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.auditService.export(query, user.role);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  }
}
