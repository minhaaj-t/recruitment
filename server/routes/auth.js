import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, sql } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const pool = await getPool();
    const r = await pool
      .request()
      .input('email', sql.NVarChar(255), email.trim().toLowerCase())
      .query(
        `SELECT u.UserId, u.Email, u.PasswordHash, u.FullName, u.RoleId, u.StoreId, u.IsActive, r.Code AS RoleCode, r.Name AS RoleName
         FROM dbo.Users u
         JOIN dbo.Roles r ON r.RoleId = u.RoleId
         WHERE LOWER(u.Email) = @email`
      );
    const user = r.recordset[0];
    if (!user || !user.IsActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      {
        sub: user.UserId,
        email: user.Email,
        roleCode: user.RoleCode,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    res.json({
      token,
      user: {
        userId: user.UserId,
        email: user.Email,
        fullName: user.FullName,
        roleCode: user.RoleCode,
        roleName: user.RoleName,
        storeId: user.StoreId,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .input('id', sql.Int, req.user.sub)
      .query(
        `SELECT u.UserId, u.Email, u.FullName, u.RoleId, u.StoreId, r.Code AS RoleCode, r.Name AS RoleName
         FROM dbo.Users u
         JOIN dbo.Roles r ON r.RoleId = u.RoleId
         WHERE u.UserId = @id AND u.IsActive = 1`
      );
    const user = r.recordset[0];
    if (!user) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      userId: user.UserId,
      email: user.Email,
      fullName: user.FullName,
      roleCode: user.RoleCode,
      roleName: user.RoleName,
      storeId: user.StoreId,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed' });
  }
});

export default router;
