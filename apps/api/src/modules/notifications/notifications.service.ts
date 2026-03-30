import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Subject, Observable, filter, map } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationType, UserRole, Prisma } from '@prisma/client';
import { PushService } from './push.service';

/** Tipos que disparam email + Slack além de notificação in-app */
const EMAIL_TYPES = new Set<NotificationType>([
  NotificationType.PAYMENT_OVERDUE,
  NotificationType.AI_CHURN_ALERT,
  NotificationType.SYSTEM_ALERT,
]);

@Injectable()
export class NotificationsService {
  /** Bus SSE: uma stream global, filtrada por userId no subscribe */
  private readonly eventBus = new Subject<{ userId: string; notification: unknown }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
    private readonly pushService: PushService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // FIND ALL (legacy — retorna array, usado pelo NotificationPanel)
  // ──────────────────────────────────────────────────────────────────────────

  async findAll(userId: string, userRole: UserRole) {
    const where = userRole === UserRole.SUPERADMIN || userRole === UserRole.ADMINISTRATIVO
      ? {}
      : { userId };

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FIND ALL PAGINATED (Centro de Notificações)
  // ──────────────────────────────────────────────────────────────────────────

  async findAllPaginated(
    userId: string,
    userRole: UserRole,
    query: {
      page?: number;
      limit?: number;
      type?: string;
      isRead?: boolean;
      search?: string;
    },
  ) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {};

    if (userRole !== UserRole.SUPERADMIN && userRole !== UserRole.ADMINISTRATIVO) {
      where.userId = userId;
    }

    if (query.type) {
      const types = query.type.split(',') as NotificationType[];
      where.type = types.length === 1 ? types[0] : { in: types };
    }
    if (query.isRead !== undefined) where.isRead = query.isRead;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { message: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, isRead: false },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // UNREAD COUNT
  // ──────────────────────────────────────────────────────────────────────────

  async countUnread(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MARK AS READ / DELETE
  // ──────────────────────────────────────────────────────────────────────────

  async markAsRead(id: string, userId: string, userRole: UserRole) {
    const where: Prisma.NotificationWhereInput = { id };
    if (userRole !== UserRole.SUPERADMIN && userRole !== UserRole.ADMINISTRATIVO) {
      where.userId = userId;
    }
    return this.prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, userRole: UserRole) {
    const where: Prisma.NotificationWhereInput = { isRead: false };
    if (userRole !== UserRole.SUPERADMIN && userRole !== UserRole.ADMINISTRATIVO) {
      where.userId = userId;
    }
    return this.prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const where: Prisma.NotificationWhereInput = { id };
    if (userRole !== UserRole.SUPERADMIN && userRole !== UserRole.ADMINISTRATIVO) {
      where.userId = userId;
    }
    return this.prisma.notification.deleteMany({ where });
  }

  async removeAll(userId: string, userRole: UserRole) {
    const where: Prisma.NotificationWhereInput = {};
    if (userRole !== UserRole.SUPERADMIN && userRole !== UserRole.ADMINISTRATIVO) {
      where.userId = userId;
    }
    return this.prisma.notification.deleteMany({ where });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CREATE (preferências + throttle anti-spam + Slack)
  // ──────────────────────────────────────────────────────────────────────────

  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
    /** v2.59.0: Chave de deduplicação (leadId, subscriptionId, clientId…) */
    dedupeKey?: string;
    /** v2.59.0: Janela de throttle em horas (default: 24h) */
    throttleHours?: number;
  }) {
    // ✅ Throttle anti-spam (v2.59.0): bloqueia notificação duplicada na janela definida
    if (params.dedupeKey) {
      const hours = params.throttleHours ?? 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const exists = await this.prisma.notification.findFirst({
        where: {
          userId: params.userId,
          type: params.type,
          dedupeKey: params.dedupeKey,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (exists) return null; // throttled — notificação já enviada nessa janela
    }

    // ✅ Verificar preferência do usuário (opt-out)
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId: params.userId, type: params.type } },
    });

    // Se o usuário desabilitou in-app para este tipo, não criar
    if (pref && !pref.inApp) return null;

    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        dedupeKey: params.dedupeKey,
        metadata: params.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });

    // Push SSE para entrega em tempo real
    this.eventBus.next({ userId: params.userId, notification });

    // Email para tipos críticos (respeita preferência de email)
    const emailEnabled = pref ? pref.email : true;
    if (EMAIL_TYPES.has(params.type) && emailEnabled) {
      this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { email: true, name: true },
      }).then((user) => {
        if (user?.email) {
          this.mailService.sendNotificationEmail({
            to: user.email,
            name: user.name || 'Usuário',
            title: params.title,
            message: params.message,
            type: params.type,
            link: params.link,
          });
        }
      }).catch(() => {});
    }

    // Slack para tipos críticos (v2.59.0) — fire-and-forget
    if (EMAIL_TYPES.has(params.type)) {
      this.sendToSlack(params.title, params.message, params.type).catch(() => {});
    }

    // Push notification nativa (v2.66.0)
    const pushEnabled = pref ? pref.push : true;
    if (pushEnabled) {
      this.pushService.sendPush(params.userId, {
        title: params.title,
        body: params.message,
        icon: '/logos/icon-dark.png',
        tag: `${params.type}-${params.dedupeKey ?? Date.now()}`,
        data: { type: params.type, link: params.link },
      }, params.type).catch(() => {});
    }

    return notification;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CREATE BULK (para broadcast/crons — não verifica preferências individuais)
  // ──────────────────────────────────────────────────────────────────────────

  async createBulk(params: {
    userIds: string[];
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }) {
    const { userIds, ...rest } = params;
    const result = await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, ...rest })),
    });

    // Push SSE para cada destinatário
    for (const userId of userIds) {
      this.eventBus.next({ userId, notification: { type: params.type, title: params.title } });
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SSE STREAM
  // ──────────────────────────────────────────────────────────────────────────

  getStream(userId: string): Observable<MessageEvent> {
    return this.eventBus.pipe(
      filter((e) => e.userId === userId),
      map((e) => ({ data: e.notification }) as MessageEvent),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BROADCAST
  // ──────────────────────────────────────────────────────────────────────────

  async broadcast(params: {
    title: string;
    message: string;
    link?: string;
    targetRoles?: UserRole[];
    createdBy: string;
  }) {
    const roles = params.targetRoles?.length ? params.targetRoles : Object.values(UserRole) as UserRole[];

    const users = await this.prisma.user.findMany({
      where: { role: { in: roles }, isActive: true },
      select: { id: true },
    });

    const userIds = users.map((u) => u.id).filter((id) => id !== params.createdBy);

    if (userIds.length === 0) return { count: 0 };

    const result = await this.createBulk({
      userIds,
      type: NotificationType.SYSTEM_UPDATE,
      title: params.title,
      message: params.message,
      link: params.link,
    });

    return { count: result.count };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PREFERÊNCIAS
  // ──────────────────────────────────────────────────────────────────────────

  async getPreferences(userId: string) {
    const existing = await this.prisma.notificationPreference.findMany({
      where: { userId },
      select: { type: true, inApp: true, email: true, push: true },
    });

    // Retorna mapa completo para todos os tipos (padrão true/true se sem registro)
    const result: Record<string, { inApp: boolean; email: boolean; push: boolean }> = {};
    for (const type of Object.values(NotificationType)) {
      const found = existing.find((p) => p.type === type);
      result[type] = found
        ? { inApp: found.inApp, email: found.email, push: found.push }
        : { inApp: true, email: true, push: true };
    }

    return result;
  }

  async updatePreferences(
    userId: string,
    prefs: Array<{ type: NotificationType; inApp: boolean; email: boolean; push?: boolean }>,
  ) {
    await Promise.all(
      prefs.map((pref) =>
        this.prisma.notificationPreference.upsert({
          where: { userId_type: { userId, type: pref.type } },
          create: { userId, type: pref.type, inApp: pref.inApp, email: pref.email, push: pref.push ?? true },
          update: { inApp: pref.inApp, email: pref.email, push: pref.push ?? true },
        }),
      ),
    );

    return this.getPreferences(userId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DIGEST DIÁRIO (07:00 BRT = 10:00 UTC) — v2.59.0
  // ──────────────────────────────────────────────────────────────────────────

  @Cron('0 10 * * *')
  async handleDailyDigest(): Promise<void> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Agrupar usuários que têm notificações não lidas nas últimas 24h
    const unreadGroups = await this.prisma.notification.groupBy({
      by: ['userId'],
      where: { isRead: false, createdAt: { gte: yesterday } },
      _count: { id: true },
    });

    if (unreadGroups.length === 0) return;

    const userIds = unreadGroups.map((g) => g.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { id: true, email: true, name: true },
    });

    for (const user of users) {
      const group = unreadGroups.find((g) => g.userId === user.id);
      if (!group || !user.email) continue;

      const count = group._count.id;
      const notifications = await this.prisma.notification.findMany({
        where: { userId: user.id, isRead: false, createdAt: { gte: yesterday } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { title: true, message: true, type: true, createdAt: true },
      });

      this.mailService.sendDigestEmail({
        to: user.email,
        name: user.name,
        count,
        notifications,
      }).catch(() => {});
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SLACK (tipos críticos, fire-and-forget) — v2.59.0
  // ──────────────────────────────────────────────────────────────────────────

  private async sendToSlack(title: string, message: string, type: NotificationType): Promise<void> {
    const webhookUrl = this.config.get<string>('SLACK_WEBHOOK_URL');
    if (!webhookUrl) return;

    const emojis: Partial<Record<NotificationType, string>> = {
      [NotificationType.PAYMENT_OVERDUE]: '⚠️',
      [NotificationType.AI_CHURN_ALERT]: '🔴',
      [NotificationType.SYSTEM_ALERT]: '🚨',
    };
    const emoji = emojis[type] ?? '🔔';

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `${emoji} *${title}*\n${message}` }),
    });
  }
}
