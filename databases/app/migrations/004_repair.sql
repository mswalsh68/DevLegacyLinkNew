-- ============================================================
-- 004_repair.sql
-- Adds missing columns to existing dbo.users in LegacyLinkApp.
-- Run when 004_users_program_role.sql skipped CREATE TABLE
-- because dbo.users already existed (pre-migration table).
-- Run on: LegacyLinkApp ONLY
-- ============================================================

USE LegacyLinkApp
GO

-- ─── Add platform_role if missing ────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.users') AND name = 'platform_role'
)
BEGIN
  ALTER TABLE dbo.users ADD platform_role NVARCHAR(50) NOT NULL DEFAULT 'player';
  PRINT 'Added platform_role';
END
ELSE
  PRINT 'platform_role already exists';
GO

-- ─── Add program_role_id if missing ──────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.users') AND name = 'program_role_id'
)
BEGIN
  ALTER TABLE dbo.users ADD program_role_id INT NULL
    CONSTRAINT FK_app_users_program_role FOREIGN KEY REFERENCES dbo.program_role(id);
  PRINT 'Added program_role_id';
END
ELSE
  PRINT 'program_role_id already exists';
GO

-- ─── Add last_team_login if missing ──────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.users') AND name = 'last_team_login'
)
BEGIN
  ALTER TABLE dbo.users ADD last_team_login DATETIME2 NULL;
  PRINT 'Added last_team_login';
END
ELSE
  PRINT 'last_team_login already exists';
GO

-- ─── Add synced_at if missing ─────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.users') AND name = 'synced_at'
)
BEGIN
  ALTER TABLE dbo.users ADD synced_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
  PRINT 'Added synced_at';
END
ELSE
  PRINT 'synced_at already exists';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT
  c.name        AS column_name,
  tp.name       AS data_type,
  c.is_nullable
FROM sys.columns c
JOIN sys.types tp ON tp.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.users')
ORDER BY c.column_id;

SELECT user_id, email, platform_role, program_role_id, last_team_login, synced_at
FROM dbo.users
ORDER BY user_id;

PRINT '=== 004_repair complete ===';
GO
