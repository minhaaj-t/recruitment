import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { addTimelineEntry } from '../services/timeline.js';
import { sendPushToUserIds } from '../services/push.js';
import { emitToUsers } from '../realtime.js';

const router = Router();

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const HR_STATUSES = ['open', 'in_progress', 'on_hold', 'closed'];

async function getHodUserIdsForStoreAdmin(pool, storeAdminUserId) {
  const r = await pool
    .request()
    .input('sid', sql.Int, storeAdminUserId)
    .query(`SELECT HodUserId FROM dbo.HodAssignments WHERE StoreAdminUserId = @sid`);
  return r.recordset.map((x) => x.HodUserId);
}

async function getHrUserIdsForStore(pool, storeId) {
  const r = await pool
    .request()
    .input('st', sql.Int, storeId)
    .query(`SELECT HrUserId FROM dbo.HrStoreAssignments WHERE StoreId = @st`);
  return r.recordset.map((x) => x.HrUserId);
}

async function getSuperAdminIds(pool) {
  const r = await pool.request().query(
    `SELECT u.UserId FROM dbo.Users u
     JOIN dbo.Roles r ON r.RoleId = u.RoleId
     WHERE r.Code = N'super_admin' AND u.IsActive = 1`
  );
  return r.recordset.map((x) => x.UserId);
}

async function audienceForRequest(pool, row) {
  const ids = new Set();
  ids.add(row.StoreAdminUserId);
  (await getHodUserIdsForStoreAdmin(pool, row.StoreAdminUserId)).forEach((i) => ids.add(i));
  (await getHrUserIdsForStore(pool, row.StoreId)).forEach((i) => ids.add(i));
  (await getSuperAdminIds(pool)).forEach((i) => ids.add(i));
  return [...ids];
}

async function loadRequest(pool, requestId) {
  const r = await pool
    .request()
    .input('id', sql.Int, requestId)
    .query(
      `SELECT r.*, sa.FullName AS StoreAdminName, st.Name AS StoreName
       FROM dbo.RecruitmentRequests r
       JOIN dbo.Users sa ON sa.UserId = r.StoreAdminUserId
       JOIN dbo.Stores st ON st.StoreId = r.StoreId
       WHERE r.RequestId = @id`
    );
  return r.recordset[0];
}

async function canViewRequest(pool, user, requestRow) {
  if (user.roleCode === 'super_admin') return true;
  if (user.roleCode === 'store_admin' && requestRow.StoreAdminUserId === user.sub) return true;
  if (user.roleCode === 'hod') {
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
    const r = await pool
      .request()
      .input('hr', sql.Int, user.sub)
      .input('st', sql.Int, requestRow.StoreId)
      .query(`SELECT 1 AS ok FROM dbo.HrStoreAssignments WHERE HrUserId = @hr AND StoreId = @st`);
    return !!r.recordset[0];
  }
  return false;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const { roleCode, sub } = req.user;
    let q;
    if (roleCode === 'super_admin') {
      q = await pool.request().query(
        `SELECT r.*, sa.FullName AS StoreAdminName, st.Name AS StoreName
         FROM dbo.RecruitmentRequests r
         JOIN dbo.Users sa ON sa.UserId = r.StoreAdminUserId
         JOIN dbo.Stores st ON st.StoreId = r.StoreId
         ORDER BY r.CreatedAt DESC`
      );
    } else if (roleCode === 'store_admin') {
      q = await pool
        .request()
        .input('uid', sql.Int, sub)
        .query(
          `SELECT r.*, sa.FullName AS StoreAdminName, st.Name AS StoreName
           FROM dbo.RecruitmentRequests r
           JOIN dbo.Users sa ON sa.UserId = r.StoreAdminUserId
           JOIN dbo.Stores st ON st.StoreId = r.StoreId
           WHERE r.StoreAdminUserId = @uid
           ORDER BY r.CreatedAt DESC`
        );
    } else if (roleCode === 'hod') {
      q = await pool
        .request()
        .input('hod', sql.Int, sub)
        .query(
          `SELECT r.*, sa.FullName AS StoreAdminName, st.Name AS StoreName
           FROM dbo.RecruitmentRequests r
           JOIN dbo.Users sa ON sa.UserId = r.StoreAdminUserId
           JOIN dbo.Stores st ON st.StoreId = r.StoreId
           WHERE r.StoreAdminUserId IN (
             SELECT StoreAdminUserId FROM dbo.HodAssignments WHERE HodUserId = @hod
           )
           ORDER BY r.CreatedAt DESC`
        );
    } else if (roleCode === 'hr') {
      q = await pool
        .request()
        .input('hr', sql.Int, sub)
        .query(
          `SELECT r.*, sa.FullName AS StoreAdminName, st.Name AS StoreName
           FROM dbo.RecruitmentRequests r
           JOIN dbo.Users sa ON sa.UserId = r.StoreAdminUserId
           JOIN dbo.Stores st ON st.StoreId = r.StoreId
           WHERE r.StoreId IN (SELECT StoreId FROM dbo.HrStoreAssignments WHERE HrUserId = @hr)
           ORDER BY r.CreatedAt DESC`
        );
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(q.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list requests' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const pool = await getPool();
    const row = await loadRequest(pool, id);
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    const ok = await canViewRequest(pool, req.user, row);
    if (!ok) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const tl = await pool
      .request()
      .input('rid', sql.Int, id)
      .query(
        `SELECT t.*, u.FullName AS UserName, u.Email AS UserEmail
         FROM dbo.RequestTimeline t
         LEFT JOIN dbo.Users u ON u.UserId = t.UserId
         WHERE t.RequestId = @rid
         ORDER BY t.CreatedAt ASC`
      );
    res.json({ request: row, timeline: tl.recordset });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load request' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  if (req.user.roleCode !== 'store_admin') {
    return res.status(403).json({ error: 'Only store admins can create requests' });
  }
  const {
    jobTitle,
    department,
    description,
    priority,
    requiredCount,
    deadline,
  } = req.body || {};
  if (!jobTitle?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'jobTitle and description required' });
  }
  if (!PRIORITIES.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }
  const count = parseInt(requiredCount, 10);
  if (Number.isNaN(count) || count < 1) {
    return res.status(400).json({ error: 'requiredCount must be >= 1' });
  }
  const pool = await getPool();
  const me = await pool
    .request()
    .input('id', sql.Int, req.user.sub)
    .query(`SELECT StoreId FROM dbo.Users WHERE UserId = @id`);
  const storeId = me.recordset[0]?.StoreId;
  if (!storeId) {
    return res.status(400).json({ error: 'Store admin has no store assigned' });
  }
  let deadlineVal = null;
  if (deadline) {
    const d = new Date(deadline);
    if (!Number.isNaN(d.getTime())) {
      deadlineVal = d;
    }
  }
  try {
    const ins = await pool
      .request()
      .input('admin', sql.Int, req.user.sub)
      .input('store', sql.Int, storeId)
      .input('title', sql.NVarChar(200), jobTitle.trim())
      .input('dept', sql.NVarChar(200), department?.trim() || null)
      .input('desc', sql.NVarChar, description.trim())
      .input('pri', sql.NVarChar(50), priority)
      .input('cnt', sql.Int, count)
      .input('deadline', sql.DateTime2, deadlineVal)
      .query(
        `INSERT INTO dbo.RecruitmentRequests
         (StoreAdminUserId, StoreId, JobTitle, Department, Description, Priority, RequiredCount, Deadline, WorkflowStatus, UpdatedAt)
         OUTPUT INSERTED.*
         VALUES (@admin, @store, @title, @dept, @desc, @pri, @cnt, @deadline, N'pending_hod', SYSUTCDATETIME())`
      );
    const row = ins.recordset[0];
    await addTimelineEntry({
      requestId: row.RequestId,
      userId: req.user.sub,
      actionType: 'created',
      comment: `Request created: ${row.JobTitle}`,
      fromStatus: null,
      toStatus: 'pending_hod',
    });
    const hods = await getHodUserIdsForStoreAdmin(pool, req.user.sub);
    const notifyIds = [...hods, ...(await getSuperAdminIds(pool))];
    const payload = { requestId: row.RequestId, workflowStatus: row.WorkflowStatus };
    emitToUsers(notifyIds, 'request:updated', payload);
    await sendPushToUserIds(
      notifyIds,
      'New recruitment request',
      `${row.JobTitle} — pending your approval`,
      { requestId: String(row.RequestId), type: 'request_created' }
    );
    const full = await loadRequest(pool, row.RequestId);
    res.status(201).json(full);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

router.post('/:id/hod-decision', requireAuth, async (req, res) => {
  if (req.user.roleCode !== 'hod') {
    return res.status(403).json({ error: 'HOD only' });
  }
  const id = parseInt(req.params.id, 10);
  const { decision, comment } = req.body || {};
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approve or reject' });
  }
  const pool = await getPool();
  const row = await loadRequest(pool, id);
  if (!row || row.WorkflowStatus !== 'pending_hod') {
    return res.status(400).json({ error: 'Request not pending HOD' });
  }
  const ok = await canViewRequest(pool, req.user, row);
  if (!ok) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const nextStatus = decision === 'approve' ? 'hod_approved' : 'hod_rejected';
  const hodComment = comment?.trim() || null;
  try {
    await pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar(50), nextStatus)
      .input('hodComment', sql.NVarChar, hodComment)
      .input('hodId', sql.Int, req.user.sub)
      .query(
        `UPDATE dbo.RecruitmentRequests
         SET WorkflowStatus = @status, HodComment = @hodComment, ApprovedByHodUserId = @hodId,
             HodActionAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
         WHERE RequestId = @id`
      );
    await addTimelineEntry({
      requestId: id,
      userId: req.user.sub,
      actionType: decision === 'approve' ? 'hod_approved' : 'hod_rejected',
      comment: hodComment,
      fromStatus: 'pending_hod',
      toStatus: nextStatus,
    });
    const hrs = await getHrUserIdsForStore(pool, row.StoreId);
    const notify = [row.StoreAdminUserId, ...hrs, ...(await getSuperAdminIds(pool))];
    emitToUsers(notify, 'request:updated', { requestId: id, workflowStatus: nextStatus });
    await sendPushToUserIds(
      notify,
      decision === 'approve' ? 'Request approved' : 'Request rejected',
      `${row.JobTitle} — ${decision === 'approve' ? 'Approved by HOD' : 'Rejected by HOD'}`,
      { requestId: String(id), type: 'hod_decision' }
    );
    res.json(await loadRequest(pool, id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update' });
  }
});

router.patch('/:id/hr', requireAuth, async (req, res) => {
  if (req.user.roleCode !== 'hr') {
    return res.status(403).json({ error: 'HR only' });
  }
  const id = parseInt(req.params.id, 10);
  const { workflowStatus, hrNotes, modifiedRequirements } = req.body || {};
  const pool = await getPool();
  const row = await loadRequest(pool, id);
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }
  const ok = await canViewRequest(pool, req.user, row);
  if (!ok) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (row.WorkflowStatus === 'pending_hod' || row.WorkflowStatus === 'hod_rejected') {
    return res.status(400).json({ error: 'Request not in HR queue' });
  }
  let next = row.WorkflowStatus;
  if (workflowStatus !== undefined && workflowStatus !== null && workflowStatus !== '') {
    if (!HR_STATUSES.includes(workflowStatus)) {
      return res.status(400).json({ error: 'Invalid HR status' });
    }
    next = workflowStatus;
  }
  const from = row.WorkflowStatus;
  const notes = hrNotes !== undefined ? hrNotes : row.HrNotes;
  const modReq =
    modifiedRequirements !== undefined ? modifiedRequirements : row.ModifiedRequirements;
  try {
    await pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar(50), next)
      .input('notes', sql.NVarChar, notes ?? null)
      .input('mod', sql.NVarChar, modReq ?? null)
      .query(
        `UPDATE dbo.RecruitmentRequests
         SET WorkflowStatus = @status, HrNotes = @notes, ModifiedRequirements = @mod, UpdatedAt = SYSUTCDATETIME()
         WHERE RequestId = @id`
      );
    if (workflowStatus && workflowStatus !== from) {
      await addTimelineEntry({
        requestId: id,
        userId: req.user.sub,
        actionType: 'hr_status',
        comment: hrNotes?.trim() || null,
        fromStatus: from,
        toStatus: next,
      });
    } else if (hrNotes !== undefined || modifiedRequirements !== undefined) {
      await addTimelineEntry({
        requestId: id,
        userId: req.user.sub,
        actionType: 'hr_update',
        comment: 'Requirements or notes updated',
        fromStatus: from,
        toStatus: next,
      });
    }
    const updated = await loadRequest(pool, id);
    const audience = await audienceForRequest(pool, updated);
    emitToUsers(audience, 'request:updated', { requestId: id, workflowStatus: next });
    await sendPushToUserIds(
      [row.StoreAdminUserId],
      'Recruitment update',
      `${row.JobTitle} — status: ${next}`,
      { requestId: String(id), type: 'hr_update' }
    );
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update' });
  }
});

/** Super admin can patch requirements / notes when needed */
router.patch('/:id/admin', requireAuth, async (req, res) => {
  if (req.user.roleCode !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin only' });
  }
  const id = parseInt(req.params.id, 10);
  const { hrNotes, modifiedRequirements, workflowStatus } = req.body || {};
  const pool = await getPool();
  const row = await loadRequest(pool, id);
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }
  let next = row.WorkflowStatus;
  if (workflowStatus) {
    const allowed = ['pending_hod', 'hod_rejected', 'hod_approved', ...HR_STATUSES];
    if (!allowed.includes(workflowStatus)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    next = workflowStatus;
  }
  try {
    await pool
      .request()
      .input('id', sql.Int, id)
      .input('status', sql.NVarChar(50), next)
      .input(
        'notes',
        sql.NVarChar,
        hrNotes !== undefined ? hrNotes : row.HrNotes
      )
      .input(
        'mod',
        sql.NVarChar,
        modifiedRequirements !== undefined ? modifiedRequirements : row.ModifiedRequirements
      )
      .query(
        `UPDATE dbo.RecruitmentRequests
         SET WorkflowStatus = @status, HrNotes = @notes, ModifiedRequirements = @mod, UpdatedAt = SYSUTCDATETIME()
         WHERE RequestId = @id`
      );
    await addTimelineEntry({
      requestId: id,
      userId: req.user.sub,
      actionType: 'super_admin_update',
      comment: null,
      fromStatus: row.WorkflowStatus,
      toStatus: next,
    });
    const updated = await loadRequest(pool, id);
    const audience = await audienceForRequest(pool, updated);
    emitToUsers(audience, 'request:updated', { requestId: id, workflowStatus: next });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
