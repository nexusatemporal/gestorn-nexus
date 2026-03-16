import { Controller, Get, Patch, Delete, Param, Post, Put, Body, Query, Sse, MessageEvent } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Observable, EMPTY } from 'rxjs';
import { UserRole, NotificationType } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { AuthUser } from '@/common/interfaces/auth-user.interface';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * GET /notifications — lista as últimas 50 (painel dropdown)
   * GET /notifications?page=1&limit=20&type=X&isRead=false — paginado (Centro)
   */
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('isRead') isRead?: string,
    @Query('search') search?: string,
  ) {
    // Se page está presente, usa modo paginado (Centro de Notificações)
    if (page !== undefined) {
      return this.service.findAllPaginated(user.id, user.role, {
        page: parseInt(page, 10),
        limit: limit ? parseInt(limit, 10) : 20,
        type: type || undefined,
        isRead: isRead === 'true' ? true : isRead === 'false' ? false : undefined,
        search: search || undefined,
      });
    }

    // Modo legacy: retorna array simples (usado pelo NotificationPanel)
    return this.service.findAll(user.id, user.role);
  }

  /** GET /notifications/unread-count */
  @Get('unread-count')
  countUnread(@CurrentUser() user: AuthUser) {
    return this.service.countUnread(user.id);
  }

  /**
   * GET /notifications/stream?token=<jwt>
   * SSE real-time: client abre stream persistente.
   */
  @Public()
  @Sse('stream')
  stream(@Query('token') token: string): Observable<MessageEvent> {
    if (!token) return EMPTY;

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      return this.service.getStream(payload.sub);
    } catch {
      return EMPTY;
    }
  }

  /** GET /notifications/preferences — preferências do usuário logado */
  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthUser) {
    return this.service.getPreferences(user.id);
  }

  /** PUT /notifications/preferences — atualiza preferências */
  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() body: Array<{ type: NotificationType; inApp: boolean; email: boolean }>,
  ) {
    return this.service.updatePreferences(user.id, body);
  }

  /**
   * POST /notifications/broadcast
   * Envia SYSTEM_UPDATE para todos os usuários (ou roles selecionadas).
   */
  @Post('broadcast')
  @Roles(UserRole.SUPERADMIN, UserRole.ADMINISTRATIVO)
  broadcast(
    @Body() body: { title: string; message: string; link?: string; targetRoles?: UserRole[] },
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.broadcast({ ...body, createdBy: user.id });
  }

  /** PATCH /notifications/:id/read */
  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.markAsRead(id, user.id, user.role);
  }

  /** PATCH /notifications/read-all */
  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: AuthUser) {
    return this.service.markAllAsRead(user.id, user.role);
  }

  /** DELETE /notifications/all */
  @Delete('all')
  removeAll(@CurrentUser() user: AuthUser) {
    return this.service.removeAll(user.id, user.role);
  }

  /** DELETE /notifications/:id */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.id, user.role);
  }
}
