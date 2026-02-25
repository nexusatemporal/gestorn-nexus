import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Decorator @CurrentUser()
 * Extrai o usuário autenticado do request
 *
 * @example
 * @Get('me')
 * async getMe(@CurrentUser() user: AuthUser) {
 *   return user;
 * }
 *
 * @example
 * // Extrair apenas o ID
 * @Get('me')
 * async getMe(@CurrentUser('id') userId: string) {
 *   return { userId };
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
