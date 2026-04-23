-- ============================================================
-- MIGRATION 019 — Drop legacy role string columns
-- Run on: LegacyLinkGlobal database
-- Run after: 018_roles_table.sql AND sp_Global_AllProcedures.sql
--            (all SPs must be updated to use role_id before running this)
-- ============================================================
-- This migration removes the legacy string role columns that were
-- kept in migration 018 for backward compatibility while SPs were
-- being updated. All SPs now use role_id (INT FK → dbo.roles).
--
-- Columns dropped:
--   dbo.users.global_role           NVARCHAR(50) — replaced by role_id
--   dbo.user_teams.role             NVARCHAR(50) — role is now on the user, not per-team
--   dbo.access_requests.role        NVARCHAR(50) — replaced by role_id (added in 018)
--
-- NOTE: user_teams.role and access_requests.role were already dropped
-- if this script was partially run before. All steps are idempotent.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── Safety check: abort if any user is missing role_id ──────────────────────

DECLARE @MissingRoleCount INT = (
  SELECT COUNT(*) FROM dbo.users WHERE role_id IS NULL
);

IF @MissingRoleCount > 0
BEGIN
  DECLARE @ErrMsg NVARCHAR(200) = 'ABORT: ' + CAST(@MissingRoleCount AS NVARCHAR) + ' user(s) have NULL role_id. Fix before running migration 019.';
  RAISERROR(@ErrMsg, 16, 1);
  RETURN;
END

PRINT 'role_id check passed — all users have a role_id';
GO

-- ─── 1. Drop users.global_role ────────────────────────────────────────────────

IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'global_role'
)
BEGIN
  -- Drop CHECK constraint (e.g. CK_users_global_role) if present
  DECLARE @CK_global_role NVARCHAR(200);

  SELECT @CK_global_role = cc.name
  FROM   sys.check_constraints cc
  JOIN   sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
  JOIN   sys.tables  t ON t.object_id = c.object_id
  WHERE  t.name = 'users' AND c.name = 'global_role';

  IF @CK_global_role IS NOT NULL
  BEGIN
    EXEC ('ALTER TABLE dbo.users DROP CONSTRAINT ' + @CK_global_role);
    PRINT 'Dropped CHECK constraint on users.global_role';
  END

  -- Drop index (e.g. IX_users_global_role) if present
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_users_global_role' AND object_id = OBJECT_ID('dbo.users'))
  BEGIN
    DROP INDEX IX_users_global_role ON dbo.users;
    PRINT 'Dropped index IX_users_global_role';
  END

  -- Drop DEFAULT constraint if present
  DECLARE @DF_global_role NVARCHAR(200);

  SELECT @DF_global_role = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  JOIN   sys.tables  t ON t.object_id = c.object_id
  WHERE  t.name = 'users' AND c.name = 'global_role';

  IF @DF_global_role IS NOT NULL
    EXEC ('ALTER TABLE dbo.users DROP CONSTRAINT ' + @DF_global_role);

  ALTER TABLE dbo.users DROP COLUMN global_role;
  PRINT 'Dropped dbo.users.global_role';
END
ELSE
  PRINT 'users.global_role not found — already dropped';
GO

-- ─── 2. Drop user_teams.role ─────────────────────────────────────────────────
-- Role is now on the user (dbo.users.role_id), not per-team-membership.

IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_teams' AND COLUMN_NAME = 'role'
)
BEGIN
  DECLARE @DF_ut_role NVARCHAR(200);

  SELECT @DF_ut_role = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  JOIN   sys.tables  t ON t.object_id = c.object_id
  WHERE  t.name = 'user_teams' AND c.name = 'role';

  IF @DF_ut_role IS NOT NULL
    EXEC ('ALTER TABLE dbo.user_teams DROP CONSTRAINT ' + @DF_ut_role);

  ALTER TABLE dbo.user_teams DROP COLUMN role;
  PRINT 'Dropped dbo.user_teams.role';
END
ELSE
  PRINT 'user_teams.role not found — already dropped';
GO

-- ─── 3. Drop access_requests.role ────────────────────────────────────────────

IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'access_requests' AND COLUMN_NAME = 'role'
)
BEGIN
  DECLARE @DF_ar_role NVARCHAR(200);

  SELECT @DF_ar_role = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  JOIN   sys.tables  t ON t.object_id = c.object_id
  WHERE  t.name = 'access_requests' AND c.name = 'role';

  IF @DF_ar_role IS NOT NULL
    EXEC ('ALTER TABLE dbo.access_requests DROP CONSTRAINT ' + @DF_ar_role);

  ALTER TABLE dbo.access_requests DROP COLUMN role;
  PRINT 'Dropped dbo.access_requests.role';
END
ELSE
  PRINT 'access_requests.role not found — already dropped';
GO

-- ─── Verification queries ─────────────────────────────────────────────────────
--
-- Run these after the migration to confirm:
--
--   -- Confirm columns are gone
--   SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
--   WHERE TABLE_SCHEMA = 'dbo'
--     AND TABLE_NAME IN ('users', 'user_teams', 'access_requests')
--     AND COLUMN_NAME IN ('global_role', 'role')
--   ORDER BY TABLE_NAME, COLUMN_NAME;
--   -- Expected: 0 rows
--
--   -- Confirm role_id is intact and all users are mapped
--   SELECT r.role_name, COUNT(*) AS user_count
--   FROM   dbo.users u
--   JOIN   dbo.roles r ON r.id = u.role_id
--   GROUP  BY r.role_name
--   ORDER  BY r.role_name;
--
-- ─────────────────────────────────────────────────────────────────────────────

PRINT '=== Migration 019 complete ===';
GO
