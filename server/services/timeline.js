import { getPool, sql } from '../db/pool.js';

export async function addTimelineEntry({
  requestId,
  userId,
  actionType,
  comment = null,
  fromStatus = null,
  toStatus = null,
}) {
  const pool = await getPool();
  await pool
    .request()
    .input('requestId', sql.Int, requestId)
    .input('userId', sql.Int, userId)
    .input('actionType', sql.NVarChar(100), actionType)
    .input('comment', sql.NVarChar, comment)
    .input('fromStatus', sql.NVarChar(50), fromStatus)
    .input('toStatus', sql.NVarChar(50), toStatus)
    .query(`INSERT INTO dbo.RequestTimeline (RequestId, UserId, ActionType, Comment, FromStatus, ToStatus)
            VALUES (@requestId, @userId, @actionType, @comment, @fromStatus, @toStatus)`);
}
