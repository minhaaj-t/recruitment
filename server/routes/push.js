import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { Expo } from 'expo-server-sdk';

const router = Router();

router.post('/register-token', requireAuth, async (req, res) => {
  try {
    const { expoPushToken } = req.body || {};
    if (!expoPushToken || !Expo.isExpoPushToken(expoPushToken)) {
      return res.status(400).json({ error: 'Invalid Expo push token' });
    }
    const pool = await getPool();
    const userId = req.user.sub;
    const rq = pool.request();
    rq.input('userId', sql.Int, userId);
    rq.input('token', sql.NVarChar(500), expoPushToken);
    const up = await rq.query(
      `UPDATE dbo.PushTokens SET UpdatedAt = SYSUTCDATETIME()
       WHERE UserId = @userId AND ExpoPushToken = @token`
    );
    if (!up.rowsAffected[0]) {
      await pool
        .request()
        .input('userId', sql.Int, userId)
        .input('token', sql.NVarChar(500), expoPushToken)
        .query(
          `INSERT INTO dbo.PushTokens (UserId, ExpoPushToken, UpdatedAt)
           VALUES (@userId, @token, SYSUTCDATETIME())`
        );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save token' });
  }
});

export default router;
