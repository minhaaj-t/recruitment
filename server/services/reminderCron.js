import cron from 'node-cron';
import { getPool, sql } from '../db/pool.js';
import { sendPushToUserIds } from './push.js';

const HOURS = parseInt(process.env.REMINDER_PENDING_HOURS || '24', 10);

export function startReminderCron() {
  cron.schedule('*/30 * * * *', async () => {
    try {
      const pool = await getPool();
      const pendingHod = await pool.request().query(`
        SELECT r.RequestId, r.JobTitle, r.StoreAdminUserId, r.UpdatedAt
        FROM dbo.RecruitmentRequests r
        WHERE r.WorkflowStatus = N'pending_hod'
          AND DATEDIFF(HOUR, r.UpdatedAt, SYSUTCDATETIME()) >= ${HOURS}
      `);
      for (const row of pendingHod.recordset) {
        const recent = await pool
          .request()
          .input('rid', sql.Int, row.RequestId)
          .input('type', sql.NVarChar(100), 'auto_hod')
          .query(
            `SELECT TOP 1 1 AS ok FROM dbo.ReminderLog
             WHERE RequestId = @rid AND ReminderType = @type
               AND SentAt > DATEADD(HOUR, -${HOURS}, SYSUTCDATETIME())`
          );
        if (recent.recordset[0]) continue;
        const h = await pool
          .request()
          .input('admin', sql.Int, row.StoreAdminUserId)
          .query(`SELECT HodUserId FROM dbo.HodAssignments WHERE StoreAdminUserId = @admin`);
        const targets = h.recordset.map((x) => x.HodUserId);
        if (!targets.length) continue;
        await pool
          .request()
          .input('rid', sql.Int, row.RequestId)
          .input('type', sql.NVarChar(100), 'auto_hod')
          .query(
            `INSERT INTO dbo.ReminderLog (RequestId, ReminderType, SentAt) VALUES (@rid, @type, SYSUTCDATETIME())`
          );
        await sendPushToUserIds(
          targets,
          'Pending HOD approval',
          `${row.JobTitle} is waiting for approval`,
          { requestId: String(row.RequestId), type: 'reminder_hod' }
        );
      }

      const pendingHr = await pool.request().query(`
        SELECT r.RequestId, r.JobTitle, r.StoreId, r.UpdatedAt
        FROM dbo.RecruitmentRequests r
        WHERE r.WorkflowStatus = N'hod_approved'
          AND DATEDIFF(HOUR, r.UpdatedAt, SYSUTCDATETIME()) >= ${HOURS}
      `);
      for (const row of pendingHr.recordset) {
        const recent = await pool
          .request()
          .input('rid', sql.Int, row.RequestId)
          .input('type', sql.NVarChar(100), 'auto_hr')
          .query(
            `SELECT TOP 1 1 AS ok FROM dbo.ReminderLog
             WHERE RequestId = @rid AND ReminderType = @type
               AND SentAt > DATEADD(HOUR, -${HOURS}, SYSUTCDATETIME())`
          );
        if (recent.recordset[0]) continue;
        const h = await pool
          .request()
          .input('st', sql.Int, row.StoreId)
          .query(`SELECT HrUserId FROM dbo.HrStoreAssignments WHERE StoreId = @st`);
        const targets = h.recordset.map((x) => x.HrUserId);
        if (!targets.length) continue;
        await pool
          .request()
          .input('rid', sql.Int, row.RequestId)
          .input('type', sql.NVarChar(100), 'auto_hr')
          .query(
            `INSERT INTO dbo.ReminderLog (RequestId, ReminderType, SentAt) VALUES (@rid, @type, SYSUTCDATETIME())`
          );
        await sendPushToUserIds(
          targets,
          'Pending HR action',
          `${row.JobTitle} needs HR processing`,
          { requestId: String(row.RequestId), type: 'reminder_hr' }
        );
      }
    } catch (e) {
      console.error('Reminder cron error', e);
    }
  });
}
