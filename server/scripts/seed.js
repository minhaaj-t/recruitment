import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getPool, sql } from '../db/pool.js';

const PASSWORD = process.env.SEED_PASSWORD || 'ChangeMe@123';

async function main() {
  const pool = await getPool();
  const hash = await bcrypt.hash(PASSWORD, 10);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = N'super_admin')
      INSERT INTO dbo.Roles (Code, Name) VALUES (N'super_admin', N'Super Admin');
    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = N'store_admin')
      INSERT INTO dbo.Roles (Code, Name) VALUES (N'store_admin', N'Store Admin');
    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = N'hod')
      INSERT INTO dbo.Roles (Code, Name) VALUES (N'hod', N'Head of Department');
    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Code = N'hr')
      INSERT INTO dbo.Roles (Code, Name) VALUES (N'hr', N'HR');
  `);

  let storeId = 1;
  const st = await pool.request().query(`SELECT TOP 1 StoreId FROM dbo.Stores ORDER BY StoreId`);
  if (!st.recordset[0]) {
    const ins = await pool
      .request()
      .input('name', sql.NVarChar(200), 'Main Store')
      .input('code', sql.NVarChar(50), 'MAIN')
      .query(
        `INSERT INTO dbo.Stores (Name, Code) OUTPUT INSERTED.StoreId VALUES (@name, @code)`
      );
    storeId = ins.recordset[0].StoreId;
  } else {
    storeId = st.recordset[0].StoreId;
  }

  async function ensureUser(email, fullName, roleCode, storeIdVal) {
    const ex = await pool
      .request()
      .input('em', sql.NVarChar(255), email)
      .query(`SELECT UserId FROM dbo.Users WHERE Email = @em`);
    if (ex.recordset[0]) {
      return ex.recordset[0].UserId;
    }
    const roleR = await pool
      .request()
      .input('c', sql.NVarChar(50), roleCode)
      .query(`SELECT RoleId FROM dbo.Roles WHERE Code = @c`);
    const roleId = roleR.recordset[0].RoleId;
    const ins = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .input('hash', sql.NVarChar(500), hash)
      .input('name', sql.NVarChar(200), fullName)
      .input('rid', sql.Int, roleId)
      .input('sid', sql.Int, storeIdVal)
      .query(
        `INSERT INTO dbo.Users (Email, PasswordHash, FullName, RoleId, StoreId)
         OUTPUT INSERTED.UserId
         VALUES (@email, @hash, @name, @rid, @sid)`
      );
    return ins.recordset[0].UserId;
  }

  const superId = await ensureUser('superadmin@recruit.local', 'Super Admin', 'super_admin', null);
  const storeAdminId = await ensureUser(
    'storeadmin@recruit.local',
    'Store Admin',
    'store_admin',
    storeId
  );
  const hodId = await ensureUser('hod@recruit.local', 'HOD User', 'hod', null);
  const hrId = await ensureUser('hr@recruit.local', 'HR User', 'hr', null);

  const ha = await pool
    .request()
    .input('h', sql.Int, hodId)
    .input('a', sql.Int, storeAdminId)
    .query(`SELECT 1 AS ok FROM dbo.HodAssignments WHERE HodUserId = @h AND StoreAdminUserId = @a`);
  if (!ha.recordset[0]) {
    await pool
      .request()
      .input('h', sql.Int, hodId)
      .input('a', sql.Int, storeAdminId)
      .query(`INSERT INTO dbo.HodAssignments (HodUserId, StoreAdminUserId) VALUES (@h, @a)`);
  }

  const hrAs = await pool
    .request()
    .input('hr', sql.Int, hrId)
    .input('st', sql.Int, storeId)
    .query(`SELECT 1 AS ok FROM dbo.HrStoreAssignments WHERE HrUserId = @hr AND StoreId = @st`);
  if (!hrAs.recordset[0]) {
    await pool
      .request()
      .input('hr', sql.Int, hrId)
      .input('st', sql.Int, storeId)
      .query(`INSERT INTO dbo.HrStoreAssignments (HrUserId, StoreId) VALUES (@hr, @st)`);
  }

  const sample = await pool
    .request()
    .input('admin', sql.Int, storeAdminId)
    .query(`SELECT TOP 1 RequestId FROM dbo.RecruitmentRequests WHERE StoreAdminUserId = @admin`);
  if (!sample.recordset[0]) {
    await pool
      .request()
      .input('admin', sql.Int, storeAdminId)
      .input('st', sql.Int, storeId)
      .input('title', sql.NVarChar(200), 'Sales Associate')
      .input('dept', sql.NVarChar(200), 'Retail')
      .input('desc', sql.NVarChar, 'Sample recruitment request with job description.')
      .input('pri', sql.NVarChar(50), 'high')
      .input('cnt', sql.Int, 2)
      .query(
        `INSERT INTO dbo.RecruitmentRequests
         (StoreAdminUserId, StoreId, JobTitle, Department, Description, Priority, RequiredCount, WorkflowStatus, UpdatedAt)
         VALUES (@admin, @st, @title, @dept, @desc, @pri, @cnt, N'pending_hod', SYSUTCDATETIME())`
      );
    const ridR = await pool
      .request()
      .input('admin', sql.Int, storeAdminId)
      .query(
        `SELECT TOP 1 RequestId FROM dbo.RecruitmentRequests WHERE StoreAdminUserId = @admin ORDER BY RequestId DESC`
      );
    const rid = ridR.recordset[0].RequestId;
    await pool
      .request()
      .input('rid', sql.Int, rid)
      .input('uid', sql.Int, storeAdminId)
      .query(
        `INSERT INTO dbo.RequestTimeline (RequestId, UserId, ActionType, Comment, FromStatus, ToStatus)
         VALUES (@rid, @uid, N'created', N'Seed sample request', NULL, N'pending_hod')`
      );
  }

  console.log('Seed complete.');
  console.log('Default password for all seeded accounts:', PASSWORD);
  console.log('superadmin@recruit.local | storeadmin@recruit.local | hod@recruit.local | hr@recruit.local');
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
