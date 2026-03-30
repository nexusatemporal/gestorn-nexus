import { api } from './api';

const MUTED_KEY = 'gnx_push_muted';
const MOBILE_PUSH_ENABLED = true; // Ativado — layout mobile pronto (v2.67.0)

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private initialized = false;

  // ──────────────────────────────────────────────────────────────────────
  // Init & Lifecycle
  // ──────────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    if (this.initialized) return;
    if (!this.isSupported()) return;

    // Skip mobile until layout is ready
    if (!MOBILE_PUSH_ENABLED && this.getDeviceType() !== 'web') return;

    // Only register SW in production (avoid Vite HMR conflicts in dev)
    if (!import.meta.env.PROD) {
      console.debug('[Push] Skipping SW registration in development');
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      this.initialized = true;

      // Sync muted state to SW
      this.syncMutedState();

      // Listen for navigation messages from SW (notification click)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'NAVIGATE' && event.data.url) {
          window.location.href = event.data.url;
        }
      });

      // Sync visibility state
      document.addEventListener('visibilitychange', () => {
        this.postMessage({ type: 'APP_VISIBILITY', data: { visible: !document.hidden } });
      });

      // If already subscribed, re-sync with backend
      const existing = await this.registration.pushManager.getSubscription();
      if (existing) {
        await this.sendSubscriptionToBackend(existing);
      }
    } catch (err) {
      console.error('[Push] Service Worker registration failed:', err);
    }
  }

  async cleanup(): Promise<void> {
    // Called on logout
    this.initialized = false;
    this.registration = null;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Subscribe / Unsubscribe
  // ──────────────────────────────────────────────────────────────────────

  async subscribe(): Promise<boolean> {
    if (!this.registration) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    try {
      const vapidKey = await this.getVapidKey();
      if (!vapidKey) return false;

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      await this.sendSubscriptionToBackend(subscription);
      return true;
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
      return false;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.registration) return;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete('/notifications/push/unsubscribe', {
          data: { endpoint: subscription.endpoint },
        }).catch(() => {});
        await subscription.unsubscribe();
      }
    } catch (err) {
      console.error('[Push] Unsubscribe failed:', err);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Mute (suppresses native notifications, in-app still works)
  // ──────────────────────────────────────────────────────────────────────

  isMuted(): boolean {
    return localStorage.getItem(MUTED_KEY) === 'true';
  }

  setMuted(muted: boolean): void {
    localStorage.setItem(MUTED_KEY, String(muted));
    this.postMessage({ type: 'SET_MUTED', data: { muted } });
  }

  toggleMute(): boolean {
    const newState = !this.isMuted();
    this.setMuted(newState);
    return newState;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Status
  // ──────────────────────────────────────────────────────────────────────

  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.registration) return false;
    const sub = await this.registration.pushManager.getSubscription();
    return !!sub;
  }

  getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  getDeviceType(): 'web' | 'android' | 'ios' {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'web';
  }

  // ──────────────────────────────────────────────────────────────────────
  // Test
  // ──────────────────────────────────────────────────────────────────────

  async sendTest(): Promise<{ sent: number }> {
    const { data } = await api.post('/notifications/push/test');
    return data;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────

  private async getVapidKey(): Promise<string | null> {
    try {
      const { data } = await api.get('/notifications/vapid-key');
      return data?.publicKey || null;
    } catch {
      console.error('[Push] Failed to fetch VAPID key');
      return null;
    }
  }

  private async sendSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
    const keys = subscription.toJSON().keys;
    if (!keys?.p256dh || !keys?.auth) return;

    try {
      await api.post('/notifications/push/subscribe', {
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        deviceType: this.getDeviceType(),
        userAgent: navigator.userAgent,
      });
    } catch (err) {
      console.error('[Push] Failed to send subscription to backend:', err);
    }
  }

  private syncMutedState(): void {
    this.postMessage({ type: 'SET_MUTED', data: { muted: this.isMuted() } });
    this.postMessage({ type: 'APP_VISIBILITY', data: { visible: !document.hidden } });
  }

  private postMessage(msg: { type: string; data: Record<string, unknown> }): void {
    if (this.registration?.active) {
      this.registration.active.postMessage(msg);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export const pushNotificationService = new PushNotificationService();
