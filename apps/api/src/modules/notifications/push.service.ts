import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import * as webpush from 'web-push';

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly vapidConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT', 'mailto:suporte@nexusatemporal.com');

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidConfigured = true;
      this.logger.log('VAPID keys configured — push notifications enabled');
    } else {
      this.vapidConfigured = false;
      this.logger.warn('VAPID keys not configured — push notifications disabled');
    }
  }

  getVapidPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  async subscribe(userId: string, dto: {
    endpoint: string;
    p256dh: string;
    auth: string;
    deviceType?: string;
    userAgent?: string;
  }) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.p256dh,
        auth: dto.auth,
        deviceType: dto.deviceType || 'web',
        userAgent: dto.userAgent,
      },
      update: {
        userId,
        p256dh: dto.p256dh,
        auth: dto.auth,
        deviceType: dto.deviceType || 'web',
        userAgent: dto.userAgent,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async getUserSubscriptions(userId: string) {
    return this.prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, deviceType: true, createdAt: true },
    });
  }

  /**
   * Send push notification to a user.
   * Respects NotificationPreference.push for the given type.
   * Automatically cleans up expired subscriptions (404/410).
   */
  async sendPush(userId: string, payload: PushPayload, notificationType?: NotificationType): Promise<void> {
    if (!this.vapidConfigured) return;

    // Check user preference for push channel
    if (notificationType) {
      const pref = await this.prisma.notificationPreference.findUnique({
        where: { userId_type: { userId, type: notificationType } },
        select: { push: true },
      });
      if (pref && !pref.push) return; // User opted out of push for this type
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return;

    const pushPayload = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            pushPayload,
          );
        } catch (error: unknown) {
          const statusCode = (error as { statusCode?: number })?.statusCode;
          // 404 or 410 = subscription expired, clean up
          if (statusCode === 404 || statusCode === 410) {
            this.logger.log(`Removing expired push subscription ${sub.id}`);
            await this.prisma.pushSubscription.delete({
              where: { id: sub.id },
            }).catch(() => {});
          }
          throw error;
        }
      }),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      this.logger.debug(`Push to ${userId}: ${succeeded} sent, ${failed} failed`);
    }
  }

  /** Send push test notification to user */
  async sendTestPush(userId: string): Promise<{ sent: number }> {
    if (!this.vapidConfigured) return { sent: 0 };

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    const payload = JSON.stringify({
      title: 'Gestor Nexus',
      body: 'Notificações push estão funcionando!',
      icon: '/logos/icon-dark.png',
      tag: 'test',
      data: { type: 'SYSTEM_UPDATE', link: '/notifications' },
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (error: unknown) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }

    return { sent };
  }
}
