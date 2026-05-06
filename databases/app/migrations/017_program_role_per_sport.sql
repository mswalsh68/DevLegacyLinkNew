-- ============================================================
-- Migration 017 — Program role per sport + column cleanup
-- Run on: LegacyLinkApp (and every future tenant App DB)
-- Run after: 016_user_ref.sql
--
-- Changes:
--   1. Add program_role_id to dbo.users_sports (per user×sport role)
--   2. Backfill from dbo.users.program_role_id
--   3. Drop program_role_id from dbo.users (now redundant)
--   4. Drop platform_role from dbo.users (superseded by global_role_id)
-- ============================================================

USE LegacyLinkApp;
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 1: Add program_role_id to dbo.users_sports
-- ──────────────────────────────────────────────────────────────

IF COL_LENGTH('dbo.users_sports', 'program_role_id') IS NULL
BEGIN
  ALTER TABLE dbo.users_sports ADD program_role_id INT NULL;
  PRINT 'Added dbo.users_sports.program_role_id (nullable — will be constrained after backfill)';
END
ELSE PRINT 'dbo.users_sports.program_role_id already exists — skipped';
GO

-- FK to program_role
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_sports_program_role'
)
BEGIN
  ALTER TABLE dbo.users_sports
    ADD CONSTRAINT FK_users_sports_program_role
      FOREIGN KEY (program_role_id) REFERENCES dbo.program_role(id);
  PRINT 'Added FK_users_sports_program_role';
END
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 2: Backfill from dbo.users.program_role_id
-- Each users_sports row inherits the user's current program role.
-- ──────────────────────────────────────────────────────────────

UPDATE us
SET    us.program_role_id = u.program_role_id
FROM   dbo.users_sports us
JOIN   dbo.users u ON u.user_id = us.user_id
WHERE  u.program_role_id IS NOT NULL
  AND  us.program_role_id IS NULL;
PRINT CONCAT('Backfilled program_role_id for ', @@ROWCOUNT, ' users_sports row(s)');
GO

-- Default any still-null rows to 8 (player)
UPDATE dbo.users_sports
SET    program_role_id = 8
WHERE  program_role_id IS NULL;
PRINT CONCAT('Defaulted ', @@ROWCOUNT, ' users_sports row(s) to program_role_id = 8 (Player)');
GO

-- Make NOT NULL
ALTER TABLE dbo.users_sports ALTER COLUMN program_role_id INT NOT NULL;
PRINT 'Set dbo.users_sports.program_role_id NOT NULL';
GO

-- Add DEFAULT constraint
IF NOT EXISTS (
  SELECT 1 FROM sys.default_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.users_sports') AND name = 'DF_users_sports_program_role_id'
)
  ALTER TABLE dbo.users_sports
    ADD CONSTRAINT DF_users_sports_program_role_id DEFAULT 8 FOR program_role_id;
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 3: Drop program_role_id from dbo.users
-- Drop FK and DEFAULT constraints before dropping the column.
-- ──────────────────────────────────────────────────────────────

-- Drop FK
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_program_role')
BEGIN
  ALTER TABLE dbo.users DROP CONSTRAINT FK_users_program_role;
  PRINT 'Dropped FK_users_program_role';
END
GO

-- Drop DEFAULT
IF EXISTS (
  SELECT 1 FROM sys.default_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.users') AND name = 'DF_users_program_role_id'
)
BEGIN
  ALTER TABLE dbo.users DROP CONSTRAINT DF_users_program_role_id;
  PRINT 'Dropped DF_users_program_role_id';
END
GO

-- Drop column
IF COL_LENGTH('dbo.users', 'program_role_id') IS NOT NULL
BEGIN
  ALTER TABLE dbo.users DROP COLUMN program_role_id;
  PRINT 'Dropped dbo.users.program_role_id';
END
ELSE PRINT 'dbo.users.program_role_id already gone — skipped';
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 4: Drop platform_role from dbo.users
-- Superseded by global_role_id (INT 1/2/3) added in migration 014.
-- ──────────────────────────────────────────────────────────────

-- Drop DEFAULT if it exists (name varies by environment — find it dynamically)
DECLARE @PlatformRoleDefault NVARCHAR(200);
SELECT @PlatformRoleDefault = dc.name
FROM   sys.default_constraints dc
JOIN   sys.columns c ON c.default_object_id = dc.object_id
WHERE  dc.parent_object_id = OBJECT_ID('dbo.users')
  AND  c.name = 'platform_role';

IF @PlatformRoleDefault IS NOT NULL
BEGIN
  EXEC ('ALTER TABLE dbo.users DROP CONSTRAINT [' + @PlatformRoleDefault + ']');
  PRINT 'Dropped DEFAULT constraint on dbo.users.platform_role';
END
GO

IF COL_LENGTH('dbo.users', 'platform_role') IS NOT NULL
BEGIN
  ALTER TABLE dbo.users DROP COLUMN platform_role;
  PRINT 'Dropped dbo.users.platform_role';
END
ELSE PRINT 'dbo.users.platform_role already gone — skipped';
GO

-- ──────────────────────────────────────────────────────────────
-- Verification
-- ──────────────────────────────────────────────────────────────

SELECT
  us.id,
  us.user_id,
  us.sport_id,
  s.name           AS sport,
  us.program_role_id,
  pr.display_name  AS programRole,
  us.jersey_number,
  us.class_year,
  us.is_active
FROM dbo.users_sports us
JOIN dbo.sports       s  ON s.id  = us.sport_id
JOIN dbo.program_role pr ON pr.id = us.program_role_id
ORDER BY us.user_id, us.sport_id;

SELECT
  u.user_id, u.email, u.first_name, u.last_name,
  u.global_role_id, u.is_active
FROM dbo.users u
ORDER BY u.user_id;

IF COL_LENGTH('dbo.users', 'program_role_id') IS NULL PRINT 'PASS: users.program_role_id dropped';
IF COL_LENGTH('dbo.users', 'platform_role')   IS NULL PRINT 'PASS: users.platform_role dropped';
IF COL_LENGTH('dbo.users_sports', 'program_role_id') IS NOT NULL PRINT 'PASS: users_sports.program_role_id added';
PRINT '=== Migration 017 complete ===';
GO
