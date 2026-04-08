import { api } from './client';

export async function registerPushToken(expoPushToken: string) {
  await api.post('/push/register-token', { expoPushToken });
}
