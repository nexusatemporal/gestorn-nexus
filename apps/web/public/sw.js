// ════════════════════════════════════════════════════════════════════════════
// Gestor Nexus — Service Worker for Push Notifications
// ════════════════════════════════════════════════════════════════════════════

let isMuted = false;
let appIsVisible = false;

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};
  switch (type) {
    case 'SET_MUTED':
      isMuted = data.muted;
      break;
    case 'APP_VISIBILITY':
      appIsVisible = data.visible;
      break;
  }
});

// Notification type → icon mapping
const TYPE_ICONS = {
  PAYMENT_RECEIVED: '/logos/icon-dark.png',
  PAYMENT_OVERDUE: '/logos/icon-dark.png',
  SUBSCRIPTION_EXPIRING: '/logos/icon-dark.png',
  NEW_LEAD: '/logos/icon-dark.png',
  LEAD_ASSIGNED: '/logos/icon-dark.png',
  LEAD_CONVERTED: '/logos/icon-dark.png',
  AI_CHURN_ALERT: '/logos/icon-dark.png',
  AI_OPPORTUNITY: '/logos/icon-dark.png',
  AI_LEAD_SCORE: '/logos/icon-dark.png',
  SYSTEM_UPDATE: '/logos/icon-dark.png',
  SYSTEM_ALERT: '/logos/icon-dark.png',
};

self.addEventListener('push', (event) => {
  // If muted, do not show native notification
  if (isMuted) return;

  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {
      title: 'Gestor Nexus',
      body: 'Você recebeu uma nova notificação',
    };
  }

  const { title, body, icon, badge, tag, data } = payload;
  const notificationType = data?.type || 'SYSTEM_UPDATE';

  event.waitUntil(
    self.registration.showNotification(title || 'Gestor Nexus', {
      body: body || 'Nova notificação',
      icon: icon || TYPE_ICONS[notificationType] || '/logos/icon-dark.png',
      badge: badge || '/favicon.png',
      tag: tag || `gnx-${notificationType}-${Date.now()}`,
      renotify: true,
      data: data || {},
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { link } = event.notification.data || {};
  const targetUrl = link
    ? new URL(link, self.location.origin).href
    : self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to focus an existing window
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin)) {
          client.focus();
          if (link) {
            client.postMessage({ type: 'NAVIGATE', url: link });
          }
          return;
        }
      }
      // Open new window if none exists
      return self.clients.openWindow(targetUrl);
    })
  );
});

// Skip waiting on install (activate immediately)
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
