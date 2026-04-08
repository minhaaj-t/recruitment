import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getPool, sql } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRoles('super_admin'), async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT u.UserId, u.Email, u.FullName, u.StoreId, u.IsActive, u.CreatedAt,
              r.Code AS RoleCode, r.Name AS RoleName,
              s.Name AS StoreName
       FROM dbo.Users u
       JOIN dbo.Roles r ON r.RoleId = u.RoleId
       LEFT JOIN dbo.Stores s ON s.StoreId = u.StoreId
       ORDER BY u.CreatedAt DESC`
    );
    const users = r.recordset;
    const hod = await pool.request().query(
      `SELECT HodUserId, StoreAdminUserId FROM dbo.HodAssignments`
    );
    const hr = await pool.request().query(`SELECT HrUserId, StoreId FROM dbo.HrStoreAssignments`);
    const enriched = users.map((u) => ({
      ...u,
      hodStoreAdminIds: hod.recordset.filter((h) => h.HodUserId === u.UserId).map((h) => h.StoreAdminUserId),
      hrStoreIds: hr.recordset.filter((h) => h.HrUserId === u.UserId).map((h) => h.StoreId),
    }));
    res.json(enriched);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/', requireAuth, requireRoles('super_admin'), async (req, res) => {
  const {
    email,
    password,
    fullName,
    roleCode,
    storeId,
    hodStoreAdminIds,
    hrStoreIds,
  } = req.body || {};
  if (!email || !password || !fullName || !roleCode) {
    return res.status(400).json({ error: 'email, password, fullName, roleCode required' });
  }
  const pool = await getPool();
  const roleR = await pool
    .request()
    .input('code', sql.NVarChar(50), roleCode)
    .query(`SELECT RoleId, Code FROM dbo.Roles WHERE Code = @code`);
  const role = roleR.recordset[0];
  if (!role) {
    return res.status(400).json({ error: 'Invalid roleCode' });
  }
  if (roleCode === 'store_admin' && !storeId) {
    return res.status(400).json({ error: 'storeId required for store_admin' });
  }
  if (roleCode === 'hod' && (!Array.isArray(hodStoreAdminIds) || hodStoreAdminIds.length === 0)) {
    return res.status(400).json({ error: 'hodStoreAdminIds required for hod' });
  }
  if (roleCode === 'hr' && (!Array.isArray(hrStoreIds) || hrStoreIds.length === 0)) {
    return res.status(400).json({ error: 'hrStoreIds required for hr' });
  }
  const hash = await bcrypt.hash(password, 10);
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    const ins = await new sql.Request(tx)
      .input('email', sql.NVarChar(255), email.trim().toLowerCase())
      .input('hash', sql.NVarChar(500), hash)
      .input('fullName', sql.NVarChar(200), fullName.trim())
      .input('roleId', sql.Int, role.RoleId)
      .input('storeId', sql.Int, roleCode === 'store_admin' ? storeId : null)
      .query(
        `INSERT INTO dbo.Users (Email, PasswordHash, FullName, RoleId, StoreId)
         OUTPUT INSERTED.UserId, INSERTED.Email, INSERTED.FullName, INSERTED.StoreId, INSERTED.IsActive
         VALUES (@email, @hash, @fullName, @roleId, @storeId)`
      );
    const user = ins.recordset[0];
    if (roleCode === 'hod') {
      for (const sid of hodStoreAdminIds) {
        await new sql.Request(tx)
          .input('hod', sql.Int, user.UserId)
          .input('admin', sql.Int, sid)
          .query(
            `INSERT INTO dbo.HodAssignments (HodUserId, StoreAdminUserId) VALUES (@hod, @admin)`
          );
      }
    }
    if (roleCode === 'hr') {
      for (const st of hrStoreIds) {
        await new sql.Request(tx)
          .input('hr', sql.Int, user.UserId)
          .input('st', sql.Int, st)
          .query(`INSERT INTO dbo.HrStoreAssignments (HrUserId, StoreId) VALUES (@hr, @st)`);
      }
    }
    await tx.commit();
    res.status(201).json({ ...user, roleCode });
  } catch (e) {
    await tx.rollback();
    if (e.number === 2627 || e.code === 'EREQUEST') {
      return res.status(409).json({ error: 'Email may already exist' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/:id/active', requireAuth, requireRoles('super_admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { isActive } = req.body || {};
    if (Number.isNaN(id) || typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const pool = await getPool();
    await pool
      .request()
      .input('id', sql.Int, id)
      .input('active', sql.Bit, isActive)
      .query(`UPDATE dbo.Users SET IsActive = @active, UpdatedAt = SYSUTCDATETIME() WHERE UserId = @id`);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
