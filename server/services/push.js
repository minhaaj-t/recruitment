import { Expo } from 'expo-server-sdk';
import { getPool, sql } from '../db/pool.js';

const expo = new Expo();

export async function getPushTokensForUsers(userIds) {
  if (!userIds?.length) return [];
  const pool = await getPool();
  const req = pool.request();
  userIds.forEach((id, i) => req.input(`u${i}`, sql.Int, id));
  const placeholders = userIds.map((_, i) => `@u${i}`).join(',');
  const r = await req.query(
    `SELECT DISTINCT ExpoPushToken FROM dbo.PushTokens WHERE UserId IN (${placeholders})`
  );
  return r.recordset.map((x) => x.ExpoPushToken).filter((t) => Expo.isExpoPushToken(t));
}

export async function sendPushToUserIds(userIds, title, body, data = {}) {
  const tokens = await getPushTokensForUsers([...new Set(userIds)]);
  if (!tokens.length) return { sent: 0 };
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
  }));
  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      sent += receipts.filter((x) => x.status === 'ok').length;
    } catch (e) {
      console.error('Push chunk error', e);
    }
  }
  return { sent };
}
