import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator @Roles()
 * Define quais roles têm acesso a uma rota
 *
 * @example
 * @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
 * @Get('financeiro')
 * async getFinanceiro() {
 *   return { ... };
 * }
 *
 * @note
 * - SUPERADMIN sempre tem acesso (verificado no RolesGuard)
 * - Se não definir @Roles(), qualquer usuário autenticado tem acesso
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
