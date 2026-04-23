-- ============================================================
-- MIGRATION 018 — Normalized roles table
-- Run on: LegacyLinkGlobal database
-- Run after: 017_access_requests.sql
-- ============================================================
-- Goals:
--   1. Create dbo.roles — single source of truth for all role definitions
--      (both global-level and app/team-level roles, ordered by privilege)
--   2. Add role_id FK columns to dbo.users, dbo.user_teams, dbo.access_requests
--   3. Backfill role_id from existing string columns
--   4. Enforce NOT NULL on role_id columns
--
-- NOTE: Old string role columns (global_role, role) are intentionally kept
-- in this migration so existing stored procedures keep working. They will be
-- dropped in migration 019 once all SPs are updated to use role_id.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 1. Create dbo.roles ─────────────────────────────────────────────────────
-- IDs are ordered from highest to lowest privilege so that simple comparisons
-- (e.g. role_id <= 3) can represent "app_admin or above" when needed.
--
--  ID  | role_type | role_name       | description
-- ─────────────────────────────────────────────────────────────
--   1  | global    | platform_owner  | Full platform access — no restrictions
--   2  | global    | global_admin    | Global administrator across all teams
--   3  | app       | app_admin       | Team/application administrator
--   4  | app       | coach_staff     | Coach or staff member
--   5  | app       | readonly        | Read-only access (view only)

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'roles'
)
BEGIN
  CREATE TABLE dbo.roles (
    id          INT           NOT NULL,
    role_type   NVARCHAR(10)  NOT NULL
                  CONSTRAINT CK_roles_role_type CHECK (role_type IN ('global', 'app')),
    role_name   NVARCHAR(50)  NOT NULL,
    description NVARCHAR(255) NOT NULL,
    CONSTRAINT PK_roles       PRIMARY KEY (id),
    CONSTRAINT UQ_roles_name  UNIQUE      (role_name)
  );

  PRINT 'Created dbo.roles';
END
ELSE
  PRINT 'dbo.roles already exists — skipping CREATE';
GO

-- ─── 2. Seed role definitions ─────────────────────────────────────────────────
-- Merge so this is safe to re-run.

MERGE dbo.roles AS target
USING (VALUES
  (1, 'global', 'platform_owner', 'Full platform access — unrestricted across all teams and features'),
  (2, 'global', 'global_admin',   'Global administrator — manages teams, users, and settings platform-wide'),
  (3, 'app',    'app_admin',      'Team administrator — manages roster, alumni, and team-level settings'),
  (4, 'app',    'coach_staff',    'Coach or staff member — full view and edit access within a team'),
  (5, 'app',    'readonly',       'Read-only — can view but not modify any team data')
) AS source (id, role_type, role_name, description)
ON target.id = source.id
WHEN MATCHED THEN
  UPDATE SET
    role_type   = source.role_type,
    role_name   = source.role_name,
    description = source.description
WHEN NOT MATCHED THEN
  INSERT (id, role_type, role_name, description)
  VALUES (source.id, source.role_type, source.role_name, source.description);

PRINT CONCAT('Seeded ', @@ROWCOUNT, ' role(s) into dbo.roles');
GO

-- ─── 3. Add role_id to dbo.users ─────────────────────────────────────────────
-- global_role_id references the user's platform-wide role (global or app type).
-- platform_owner and global_admin are IDs 1 and 2.

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'global_role_id'
)
BEGIN
  ALTER TABLE dbo.users
    ADD global_role_id INT NULL
        CONSTRAINT FK_users_global_role_id REFERENCES dbo.roles(id);

  PRINT 'Added global_role_id column to dbo.users';
END
ELSE
  PRINT 'users.global_role_id already exists — skipping';
GO

-- ─── 4. Backfill users.global_role_id from global_role string ────────────────
-- Legacy aliases: 'app_admin' → 3, 'coach' / 'staff' → 4, 'read_only' → 5

UPDATE dbo.users
SET global_role_id = CASE global_role
    WHEN 'platform_owner' THEN 1
    WHEN 'global_admin'   THEN 2
    WHEN 'app_admin'      THEN 3
    WHEN 'coach_staff'    THEN 4
    WHEN 'coach'          THEN 4   -- legacy alias
    WHEN 'staff'          THEN 4   -- legacy alias
    WHEN 'player'         THEN 5   -- treat player as readonly for now
    WHEN 'readonly'       THEN 5
    WHEN 'read_only'      THEN 5   -- legacy alias
    ELSE                       5   -- safe default
  END
WHERE global_role_id IS NULL;

PRINT CONCAT('Backfilled global_role_id for ', @@ROWCOUNT, ' user(s)');
GO

-- ─── 5. Enforce NOT NULL on users.global_role_id ─────────────────────────────

DECLARE @NullCount INT = (SELECT COUNT(*) FROM dbo.users WHERE global_role_id IS NULL);
IF @NullCount > 0
BEGIN
  PRINT CONCAT('WARNING: ', @NullCount, ' user(s) still have NULL global_role_id — cannot set NOT NULL yet');
END
ELSE
BEGIN
  -- Drop the nullable FK, re-add as NOT NULL
  IF EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_global_role_id'
  )
    ALTER TABLE dbo.users DROP CONSTRAINT FK_users_global_role_id;

  ALTER TABLE dbo.users
    ALTER COLUMN global_role_id INT NOT NULL;

  ALTER TABLE dbo.users
    ADD CONSTRAINT FK_users_global_role_id FOREIGN KEY (global_role_id) REFERENCES dbo.roles(id);

  PRINT 'Set users.global_role_id NOT NULL and re-added FK constraint';
END
GO

-- ─── 6. Add role_id to dbo.user_teams ────────────────────────────────────────
-- app_role_id is the user's role within a specific team (always app-type: IDs 3-5).

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_teams' AND COLUMN_NAME = 'app_role_id'
)
BEGIN
  ALTER TABLE dbo.user_teams
    ADD app_role_id INT NULL
        CONSTRAINT FK_user_teams_app_role_id REFERENCES dbo.roles(id);

  PRINT 'Added app_role_id column to dbo.user_teams';
END
ELSE
  PRINT 'user_teams.app_role_id already exists — skipping';
GO

-- ─── 7. Backfill user_teams.app_role_id from role string ─────────────────────

UPDATE dbo.user_teams
SET app_role_id = CASE role
    WHEN 'platform_owner' THEN 1   -- platform owners may have team rows too
    WHEN 'global_admin'   THEN 2
    WHEN 'app_admin'      THEN 3
    WHEN 'coach_staff'    THEN 4
    WHEN 'coach'          THEN 4   -- legacy alias
    WHEN 'staff'          THEN 4   -- legacy alias
    WHEN 'player'         THEN 5   -- treat player as readonly
    WHEN 'readonly'       THEN 5
    WHEN 'read_only'      THEN 5   -- legacy alias
    ELSE                       5   -- safe default
  END
WHERE app_role_id IS NULL;

PRINT CONCAT('Backfilled app_role_id for ', @@ROWCOUNT, ' user_teams row(s)');
GO

-- ─── 8. Enforce NOT NULL on user_teams.app_role_id ───────────────────────────

DECLARE @NullCount INT = (SELECT COUNT(*) FROM dbo.user_teams WHERE app_role_id IS NULL);
IF @NullCount > 0
BEGIN
  PRINT CONCAT('WARNING: ', @NullCount, ' user_teams row(s) still have NULL app_role_id — cannot set NOT NULL yet');
END
ELSE
BEGIN
  IF EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_teams_app_role_id'
  )
    ALTER TABLE dbo.user_teams DROP CONSTRAINT FK_user_teams_app_role_id;

  ALTER TABLE dbo.user_teams
    ALTER COLUMN app_role_id INT NOT NULL;

  ALTER TABLE dbo.user_teams
    ADD CONSTRAINT FK_user_teams_app_role_id FOREIGN KEY (app_role_id) REFERENCES dbo.roles(id);

  PRINT 'Set user_teams.app_role_id NOT NULL and re-added FK constraint';
END
GO

-- ─── 9. Add role_id to dbo.access_requests ───────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'access_requests' AND COLUMN_NAME = 'role_id'
)
BEGIN
  ALTER TABLE dbo.access_requests
    ADD role_id INT NULL
        CONSTRAINT FK_access_requests_role_id REFERENCES dbo.roles(id);

  PRINT 'Added role_id column to dbo.access_requests';
END
ELSE
  PRINT 'access_requests.role_id already exists — skipping';
GO

-- ─── 10. Backfill access_requests.role_id from role string ───────────────────

UPDATE dbo.access_requests
SET role_id = CASE role
    WHEN 'platform_owner' THEN 1
    WHEN 'global_admin'   THEN 2
    WHEN 'app_admin'      THEN 3
    WHEN 'coach_staff'    THEN 4
    WHEN 'coach'          THEN 4
    WHEN 'staff'          THEN 4
    WHEN 'readonly'       THEN 5
    WHEN 'read_only'      THEN 5
    ELSE                       5
  END
WHERE role_id IS NULL;

PRINT CONCAT('Backfilled role_id for ', @@ROWCOUNT, ' access_requests row(s)');
GO

-- ─── 11. Enforce NOT NULL on access_requests.role_id ─────────────────────────

DECLARE @NullCount INT = (SELECT COUNT(*) FROM dbo.access_requests WHERE role_id IS NULL);
IF @NullCount > 0
BEGIN
  PRINT CONCAT('WARNING: ', @NullCount, ' access_requests row(s) still have NULL role_id — cannot set NOT NULL yet');
END
ELSE
BEGIN
  IF EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_access_requests_role_id'
  )
    ALTER TABLE dbo.access_requests DROP CONSTRAINT FK_access_requests_role_id;

  ALTER TABLE dbo.access_requests
    ALTER COLUMN role_id INT NOT NULL;

  ALTER TABLE dbo.access_requests
    ADD CONSTRAINT FK_access_requests_role_id FOREIGN KEY (role_id) REFERENCES dbo.roles(id);

  PRINT 'Set access_requests.role_id NOT NULL and re-added FK constraint';
END
GO

-- ─── 12. Indexes ─────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_users_global_role_id' AND object_id = OBJECT_ID('dbo.users'))
  CREATE INDEX IX_users_global_role_id      ON dbo.users(global_role_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_teams_app_role_id' AND object_id = OBJECT_ID('dbo.user_teams'))
  CREATE INDEX IX_user_teams_app_role_id    ON dbo.user_teams(app_role_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_access_requests_role_id' AND object_id = OBJECT_ID('dbo.access_requests'))
  CREATE INDEX IX_access_requests_role_id   ON dbo.access_requests(role_id);

PRINT 'Created indexes on role_id columns';
GO

-- ─── Summary ─────────────────────────────────────────────────────────────────
-- After running this migration:
--
--   SELECT r.id, r.role_type, r.role_name, r.description FROM dbo.roles r ORDER BY r.id;
--
--   SELECT u.email, u.global_role, u.global_role_id, r.role_name
--   FROM   dbo.users u JOIN dbo.roles r ON r.id = u.global_role_id ORDER BY u.email;
--
--   SELECT ut.user_id, ut.team_id, ut.role, ut.app_role_id, r.role_name
--   FROM   dbo.user_teams ut JOIN dbo.roles r ON r.id = ut.app_role_id;
--
-- Next steps (migration 019):
--   - Update all stored procedures to return / accept role_id instead of role strings
--   - Drop dbo.users.global_role, dbo.user_teams.role, dbo.access_requests.role
-- ─────────────────────────────────────────────────────────────────────────────

PRINT '=== Migration 018 complete ===';
GO
