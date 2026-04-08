import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { sendPushToUserIds } from '../services/push.js';

const router = Router();

async function canTriggerManual(pool, user, requestRow) {
  if (user.roleCode === 'super_admin') return true;
  if (user.roleCode === 'store_admin' && requestRow.StoreAdminUserId === user.sub) return true;
  if (user.roleCode === 'hod' && requestRow.WorkflowStatus === 'pending_hod') {
    const r = await pool
      .request()
      .input('hod', sql.Int, user.sub)
      .input('admin', sql.Int, requestRow.StoreAdminUserId)
      .query(
        `SELECT 1 AS ok FROM dbo.HodAssignments WHERE HodUserId = @hod AND StoreAdminUserId = @admin`
      );
    return !!r.recordset[0];
  }
  if (user.roleCode === 'hr') {
    const inQueue = ['hod_approved', 'open', 'in_progress', 'on_hold'].includes(
      requestRow.WorkflowStatus
    );
    if (!inQueue) return false;
    const r = await pool
      .request()
      .input('hr', sql.Int, user.sub)
      .input('st', sql.Int, requestRow.StoreId)
      .query(`SELECT 1 AS ok FROM dbo.HrStoreAssignments WHERE HrUserId = @hr AND StoreId = @st`);
    return !!r.recordset[0];
  }
  return false;
}

router.post('/request/:id/manual', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const pool = await getPool();
    const r = await pool
      .request()
      .input('id', sql.Int, id)
      .query(`SELECT * FROM dbo.RecruitmentRequests WHERE RequestId = @id`);
    const row = r.recordset[0];
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    const ok = await canTriggerManual(pool, req.user, row);
    if (!ok) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    let targets = [];
    if (row.WorkflowStatus === 'pending_hod') {
      const h = await pool
        .request()
        .input('admin', sql.Int, row.StoreAdminUserId)
        .query(`SELECT HodUserId FROM dbo.HodAssignments WHERE StoreAdminUserId = @admin`);
      targets = h.recordset.map((x) => x.HodUserId);
    } else if (['hod_approved', 'open', 'in_progress', 'on_hold'].includes(row.WorkflowStatus)) {
      const h = await pool
        .request()
        .input('st', sql.Int, row.StoreId)
        .query(`SELECT HrUserId FROM dbo.HrStoreAssignments WHERE StoreId = @st`);
      targets = h.recordset.map((x) => x.HrUserId);
    } else {
      return res.status(400).json({ error: 'Nothing to remind for this status' });
    }
    await pool
      .request()
      .input('rid', sql.Int, id)
      .input('type', sql.NVarChar(100), 'manual')
      .query(
        `INSERT INTO dbo.ReminderLog (RequestId, ReminderType, SentAt) VALUES (@rid, @type, SYSUTCDATETIME())`
      );
    await sendPushToUserIds(
      targets,
      'Reminder',
      `Action needed: ${row.JobTitle}`,
      { requestId: String(id), type: 'manual_reminder' }
    );
    res.json({ ok: true, notified: targets.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Reminder failed' });
  }
});

export default router;
