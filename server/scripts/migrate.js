import 'dotenv/config';
import { getPool, sql } from '../db/pool.js';

const statements = [
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles' AND schema_id = SCHEMA_ID('dbo'))
   CREATE TABLE dbo.Roles (
     RoleId INT IDENTITY(1,1) PRIMARY KEY,
     Code NVARCHAR(50) NOT NULL UNIQUE,
     Name NVARCHAR(100) NOT NULL
   )`,
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Stores' AND schema_id = SCHEMA_ID('dbo'))
   CREATE TABLE dbo.Stores (
     StoreId INT IDENTITY(1,1) PRIMARY KEY,
     Name NVARCHAR(200) NOT NULL,
     Code NVARCHAR(50) NULL,
     IsActive BIT NOT NULL CONSTRAINT DF_Stores_IsActive DEFAULT (1),
     CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Stores_CreatedAt DEFAULT (SYSUTCDATETIME())
   )`,
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users' AND schema_id = SCHEMA_ID('dbo'))
   CREATE TABLE dbo.Users (
     UserId INT IDENTITY(1,1) PRIMARY KEY,
     Email NVARCHAR(255) NOT NULL UNIQUE,
     PasswordHash NVARCHAR(500) NOT NULL,
     FullName NVARCHAR(200) NOT NULL,
     RoleId INT NOT NULL REFERENCES dbo.Roles(RoleId),
     StoreId INT NULL REFERENCES dbo.Stores(StoreId),
     IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
     CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
     UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSUTCDATETIME())
   )`,
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HodAssignments' AND schema_id = SCHEMA_ID('dbo'))
   CREATE TABLE dbo.HodAssignments (
     Id INT IDENTITY(1,1) PRIMARY KEY,
     HodUserId INT NOT NULL REFERENCES dbo.Users(UserId),
     StoreAdminUserId INT NOT NULL REFERENCES dbo.Users(UserId),
     CONSTRAINT UQ_Hod UNIQUE (HodUserId, StoreAdminUserId)
   )`,
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'HrStoreAssignments' AND schema_id = SCHEMA_ID('dbo'))
   CREATE TABLE dbo.HrStoreAssignments (
     Id INT IDENTITY(1,1) PRIMARY KEY,
     HrUserId INT NOT NULL REFERENCES dbo.Users(UserId),
     StoreId INT NOT NULL REFERENCES dbo.Stores(StoreId),
     CONSTRAINT UQ_HrStore UNIQUE (HrUserId, StoreId)
   )`,
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RecruitmentRequests' AND schema_id = SCHEMA_ID('dbo'))
   CREATE TABLE dbo.RecruitmentRequests (
     RequestId INT IDENTITY(1,1) PRIMARY KEY,
     StoreAdminUserId INT NOT NULL REFERENCES dbo.Users(UserId),
     StoreId INT NOT NULL REFERENCES dbo.Stores(StoreId),
     JobTitle NVARCHAR(200) NOT NULL,
     Department NVARCHAR(200) NULL,
     Description NVARCHAR(MAX) NOT NULL,
     Priority NVARCHAR(50) NOT NULL,
     RequiredCount INT NOT NULL,
     Deadline DATETIME2 NULL,
     WorkflowStatus NVARCHAR(50) NOT NULL,
     HodComment NVARCHAR(MAX) NULL,
     HrNotes NVARCHAR(MAX) NULL,
     ModifiedRequirements NVARCHAR(MAX) NULL,
     ApprovedByHodUserId INT NULL REFERENCES dbo.Users(UserId),
     HodActionAt DATETIME2 NULL,
     CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Req_Created DEFAULT (SYSUTCDATETIME()),
     UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Req_Updated DEFAULT (SYSUTCDATETIME())
   )`,
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'RequestTimeline' AND schema_id = SCHEMA_ID('dbo'))
   CREATE TABLE dbo.RequestTimeline (
     TimelineId INT IDENTITY(1,1) PRIMARY KEY,
     RequestId INT NOT NULL REFERENCES dbo.RecruitmentRequests(RequestId) ON DELETE CASCADE,
     UserId INT NULL REFERENCES dbo.Users(UserId),
     ActionType NVARCHAR(100) NOT NULL,
     Comment NVARCHAR(MAX) NULL,
     FromStatus NVARCHAR(50) NULL,
     ToStatus NVARCHAR(50) NULL,
     CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Timeline_Created DEFAULT (SYSUTCDATETIME())
   )`,
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PushTokens' AND schema_id = SCHEMA_ID('dbo'))
   CREATE TABLE dbo.PushTokens (
     Id INT IDENTITY(1,1) PRIMARY KEY,
     UserId INT NOT NULL REFERENCES dbo.Users(UserId) ON DELETE CASCADE,
     ExpoPushToken NVARCHAR(500) NOT NULL,
     UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Push_Updated DEFAULT (SYSUTCDATETIME()),
     CONSTRAINT UQ_Push_User_Token UNIQUE (UserId, ExpoPushToken)
   )`,
  `IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ReminderLog' AND schema_id = SCHEMA_ID('dbo'))
   CREATE TABLE dbo.ReminderLog (
     Id INT IDENTITY(1,1) PRIMARY KEY,
     RequestId INT NOT NULL REFERENCES dbo.RecruitmentRequests(RequestId),
     ReminderType NVARCHAR(100) NOT NULL,
     SentAt DATETIME2 NOT NULL CONSTRAINT DF_Rem_Sent DEFAULT (SYSUTCDATETIME())
   )`,
];

async function main() {
  const pool = await getPool();
  for (const s of statements) {
    await pool.request().query(s);
    console.log('OK:', s.slice(0, 60).replace(/\s+/g, ' ') + '...');
  }
  console.log('Migration complete.');
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
