import { Router } from 'express';
import { getPool, sql } from '../db/pool.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRoles('super_admin', 'store_admin', 'hod', 'hr'), async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      `SELECT StoreId, Name, Code, IsActive FROM dbo.Stores WHERE IsActive = 1 ORDER BY Name`
    );
    res.json(r.recordset);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load stores' });
  }
});

router.post('/', requireAuth, requireRoles('super_admin'), async (req, res) => {
  try {
    const { name, code } = req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Name required' });
    }
    const pool = await getPool();
    const ins = await pool
      .request()
      .input('name', sql.NVarChar(200), name.trim())
      .input('code', sql.NVarChar(50), code?.trim() || null)
      .query(
        `INSERT INTO dbo.Stores (Name, Code) OUTPUT INSERTED.StoreId, INSERTED.Name, INSERTED.Code, INSERTED.IsActive
         VALUES (@name, @code)`
      );
    res.status(201).json(ins.recordset[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

export default router;
