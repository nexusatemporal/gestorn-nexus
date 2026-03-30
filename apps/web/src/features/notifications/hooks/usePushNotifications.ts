import { useState, useEffect, useCallback } from 'react';
import { pushNotificationService } from '@/services/push-notification.service';

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isMuted, setIsMuted] = useState(() => pushNotificationService.isMuted());
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    pushNotificationService.getPermission(),
  );
  const isSupported = pushNotificationService.isSupported();

  useEffect(() => {
    let cancelled = false;
    pushNotificationService.isSubscribed().then((sub) => {
      if (!cancelled) setIsSubscribed(sub);
    });
    return () => { cancelled = true; };
  }, []);

  const subscribe = useCallback(async () => {
    const success = await pushNotificationService.subscribe();
    if (success) {
      setIsSubscribed(true);
      setPermission(Notification.permission);
    }
    return success;
  }, []);

  const unsubscribe = useCallback(async () => {
    await pushNotificationService.unsubscribe();
    setIsSubscribed(false);
  }, []);

  const toggleMute = useCallback(() => {
    const newState = pushNotificationService.toggleMute();
    setIsMuted(newState);
    return newState;
  }, []);

  const sendTest = useCallback(() => {
    return pushNotificationService.sendTest();
  }, []);

  return {
    isSupported,
    isSubscribed,
    isMuted,
    permission,
    subscribe,
    unsubscribe,
    toggleMute,
    sendTest,
  };
}
