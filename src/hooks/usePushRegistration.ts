import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore';
import { registerPushToken } from '../api/pushApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }
  if (!Device.isDevice) {
    return false;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus === 'granted';
}

export function usePushRegistration() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ok = await ensurePermissions();
        if (!ok || cancelled) return;
        const expoToken = await Notifications.getExpoPushTokenAsync();
        const value = expoToken.data;
        if (value && !cancelled) {
          await registerPushToken(value);
        }
      } catch {
        /* simulator / missing projectId — non-fatal */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);
}
