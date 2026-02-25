import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Guard de Autorização (RBAC)
 * Verifica se o usuário tem permissão baseado no role
 *
 * FUNCIONAMENTO:
 * 1. Lê as roles permitidas do decorator @Roles()
 * 2. Verifica se o usuário tem uma das roles permitidas
 * 3. SUPERADMIN sempre tem acesso a tudo
 *
 * REGRAS:
 * - Se não tem @Roles(), qualquer usuário autenticado pode acessar
 * - SUPERADMIN bypassa qualquer verificação de role
 * - Outros roles devem estar explicitamente na lista
 *
 * @example
 * @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
 * @Get('financeiro')
 * async getFinanceiro() {
 *   // Apenas SUPERADMIN e ADMINISTRATIVO podem acessar
 * }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Ler roles permitidas do decorator
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Se não tem @Roles(), libera
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      this.logger.warn('RolesGuard: Usuário não encontrado no request');
      throw new ForbiddenException('Usuário não autenticado');
    }

    // 2. SUPERADMIN tem acesso a tudo
    if (user.role === UserRole.SUPERADMIN) {
      this.logger.debug(`✅ SUPERADMIN ${user.email} tem acesso total`);
      return true;
    }

    // 3. Verificar se tem a role necessária
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      this.logger.warn(
        `❌ Acesso negado: ${user.email} (${user.role}) tentou acessar rota que requer: ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException(
        `Acesso negado. Permissões necessárias: ${requiredRoles.join(', ')}`,
      );
    }

    this.logger.debug(`✅ ${user.email} (${user.role}) autorizado`);
    return true;
  }
}
