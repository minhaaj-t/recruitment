import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra as { apiUrl?: string; socketUrl?: string } | undefined;

function trimBase(u: string) {
  return u.replace(/\/$/, '');
}

/**
 * When EXPO_PUBLIC_API_URL is unset, pick a sensible dev default.
 * - Android emulator: host machine → 10.0.2.2 (not localhost)
 * - Simulators / web: if Expo exposes a numeric LAN host for Metro, reuse it for API (same machine)
 * - Physical device: do NOT use hostUri — it can be a different NIC than the PC running `npm run api`
 *   (e.g. SQL/network adapter). Use EXPO_PUBLIC_API_URL in .env instead.
 * - Else → localhost
 */
function defaultDevApiUrl(): string {
  if (Platform.OS === 'android' && !Device.isDevice) {
    return 'http://10.0.2.2:4000';
  }
  if (Device.isDevice) {
    return 'http://localhost:4000';
  }
  const uri = Constants.expoConfig?.hostUri;
  if (uri) {
    const host = uri.split(':')[0];
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      return `http://${host}:4000`;
    }
  }
  return 'http://localhost:4000';
}

const inlinedApi = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';
const inlinedSocket = process.env.EXPO_PUBLIC_SOCKET_URL?.trim() ?? '';
const envApi = extra?.apiUrl?.trim() ?? '';
const envSocket = extra?.socketUrl?.trim() ?? '';

export const API_BASE_URL = trimBase(
  inlinedApi.length > 0 ? inlinedApi : envApi.length > 0 ? envApi : defaultDevApiUrl()
);
export const SOCKET_URL = trimBase(
  inlinedSocket.length > 0
    ? inlinedSocket
    : envSocket.length > 0
      ? envSocket
      : API_BASE_URL
);
