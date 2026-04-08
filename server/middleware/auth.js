import jwt from 'jsonwebtoken';
import { getPool, sql } from '../db/pool.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRoles(...allowedCodes) {
  return (req, res, next) => {
    if (!req.user?.roleCode || !allowedCodes.includes(req.user.roleCode)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/** Load fresh user row (active check) */
export async function attachUserRow(req, res, next) {
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .input('id', sql.Int, req.user.sub)
      .query(
        `SELECT u.UserId, u.Email, u.FullName, u.RoleId, u.StoreId, u.IsActive, r.Code AS RoleCode, r.Name AS RoleName
         FROM dbo.Users u
         JOIN dbo.Roles r ON r.RoleId = u.RoleId
         WHERE u.UserId = @id`
      );
    const row = r.recordset[0];
    if (!row || !row.IsActive) {
      return res.status(401).json({ error: 'User inactive or not found' });
    }
    req.dbUser = row;
    next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Auth lookup failed' });
  }
}
