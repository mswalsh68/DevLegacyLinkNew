-- ============================================================
-- MIGRATION 014 — Schema Consolidation
-- Run on: LegacyLinkApp (and every future tenant App DB)
-- Run after: 013_program_roles_restructure.sql
-- ============================================================
-- Summary of changes:
--   1. dbo.users  — add program_role_id INT FK → program_role
--                   add global_role_id  INT (1=super_admin,2=support_admin,3=client)
--   2. dbo.users_sports — add position_id, jersey_number, class_year,
--                         seasons_played, updated_at
--   3. Backfill both from dbo.users_roles
--   4. Create dbo.role_change_log (replaces role_transfer_log)
--   5. Drop dbo.role_transfer_log
--   6. Drop dbo.users_roles
-- ============================================================

USE LegacyLinkApp
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 1: Add program_role_id and global_role_id to dbo.users
-- ──────────────────────────────────────────────────────────────

IF COL_LENGTH('dbo.users', 'program_role_id') IS NULL
BEGIN
  -- Add nullable first so we can backfill before adding NOT NULL
  ALTER TABLE dbo.users ADD program_role_id INT NULL;
  PRINT 'Added dbo.users.program_role_id (nullable — will be constrained after backfill)';
END
ELSE PRINT 'dbo.users.program_role_id already exists — skipped';
GO

IF COL_LENGTH('dbo.users', 'global_role_id') IS NULL
BEGIN
  -- Default 3 = client for all existing users
  ALTER TABLE dbo.users ADD global_role_id INT NOT NULL DEFAULT 3;
  PRINT 'Added dbo.users.global_role_id (default 3 = client)';
END
ELSE PRINT 'dbo.users.global_role_id already exists — skipped';
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 2: Backfill program_role_id from users_roles
-- Take the most-privileged (lowest sort_order) role per user.
-- ──────────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.users_roles', 'U') IS NOT NULL
BEGIN
  UPDATE u
  SET    u.program_role_id = best.program_role_id
  FROM   dbo.users u
  JOIN   (
    SELECT
      ur.user_id,
      -- pick the role with the lowest sort_order (most privileged)
      (SELECT TOP 1 ur2.program_role_id
       FROM   dbo.users_roles ur2
       JOIN   dbo.program_role pr2 ON pr2.id = ur2.program_role_id
       WHERE  ur2.user_id = ur.user_id
         AND  ur2.status <> 'removed'
       ORDER  BY pr2.sort_order ASC
      ) AS program_role_id
    FROM dbo.users_roles ur
    GROUP BY ur.user_id
  ) best ON best.user_id = u.user_id
  WHERE best.program_role_id IS NOT NULL;
  PRINT CONCAT('Backfilled program_role_id for ', @@ROWCOUNT, ' user(s) from users_roles');
END
ELSE
  PRINT 'dbo.users_roles not found — no backfill needed';
GO

-- Set remaining NULLs to 8 (player) as default
UPDATE dbo.users
SET    program_role_id = 8
WHERE  program_role_id IS NULL;
PRINT CONCAT('Defaulted ', @@ROWCOUNT, ' user(s) to program_role_id = 8 (Player)');
GO

-- Now make it NOT NULL with DEFAULT and FK
IF NOT EXISTS (
  SELECT 1 FROM sys.default_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.users') AND name = 'DF_users_program_role_id'
)
  ALTER TABLE dbo.users
    ADD CONSTRAINT DF_users_program_role_id DEFAULT 8 FOR program_role_id;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_users_program_role'
)
  ALTER TABLE dbo.users
    ADD CONSTRAINT FK_users_program_role
      FOREIGN KEY (program_role_id) REFERENCES dbo.program_role(id);
PRINT 'Added FK_users_program_role';
GO

-- Change to NOT NULL
ALTER TABLE dbo.users ALTER COLUMN program_role_id INT NOT NULL;
PRINT 'Set dbo.users.program_role_id NOT NULL';
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 3: Extend dbo.users_sports with player/alumni detail cols
-- ──────────────────────────────────────────────────────────────

IF COL_LENGTH('dbo.users_sports', 'position_id') IS NULL
BEGIN
  ALTER TABLE dbo.users_sports ADD position_id INT NULL;
  PRINT 'Added dbo.users_sports.position_id';
END
ELSE PRINT 'dbo.users_sports.position_id already exists — skipped';
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_users_sports_position'
)
  ALTER TABLE dbo.users_sports
    ADD CONSTRAINT FK_users_sports_position
      FOREIGN KEY (position_id) REFERENCES dbo.sports_position(position_id) ON DELETE SET NULL;
GO

IF COL_LENGTH('dbo.users_sports', 'jersey_number') IS NULL
BEGIN
  ALTER TABLE dbo.users_sports ADD jersey_number TINYINT NULL;
  PRINT 'Added dbo.users_sports.jersey_number';
END
ELSE PRINT 'dbo.users_sports.jersey_number already exists — skipped';
GO

IF COL_LENGTH('dbo.users_sports', 'class_year') IS NULL
BEGIN
  ALTER TABLE dbo.users_sports ADD class_year SMALLINT NULL;
  PRINT 'Added dbo.users_sports.class_year';
END
ELSE PRINT 'dbo.users_sports.class_year already exists — skipped';
GO

IF COL_LENGTH('dbo.users_sports', 'seasons_played') IS NULL
BEGIN
  ALTER TABLE dbo.users_sports ADD seasons_played TINYINT NULL;
  PRINT 'Added dbo.users_sports.seasons_played';
END
ELSE PRINT 'dbo.users_sports.seasons_played already exists — skipped';
GO

IF COL_LENGTH('dbo.users_sports', 'updated_at') IS NULL
BEGIN
  ALTER TABLE dbo.users_sports ADD updated_at DATETIME2 NULL;
  PRINT 'Added dbo.users_sports.updated_at';
END
ELSE PRINT 'dbo.users_sports.updated_at already exists — skipped';
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 4: Backfill users_sports from users_roles
-- For each users_roles row with a sport_id, ensure a users_sports
-- row exists and populate the new detail columns.
-- ──────────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.users_roles', 'U') IS NOT NULL
BEGIN
  -- Insert any users_roles rows that have no matching users_sports row
  INSERT INTO dbo.users_sports (user_id, sport_id, username, position_id, jersey_number, class_year, seasons_played, joined_at)
  SELECT
    ur.user_id,
    ur.sport_id,
    u.first_name + N' ' + u.last_name,
    ur.position_id,
    TRY_CAST(ur.jersey_number AS TINYINT),
    TRY_CAST(ur.class_year    AS SMALLINT),
    TRY_CAST(ur.seasons_played AS TINYINT),
    ur.created_at
  FROM dbo.users_roles ur
  JOIN dbo.users u ON u.user_id = ur.user_id
  WHERE ur.sport_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM dbo.users_sports us
      WHERE us.user_id = ur.user_id AND us.sport_id = ur.sport_id
    );
  PRINT CONCAT('Inserted ', @@ROWCOUNT, ' missing users_sports row(s) from users_roles');

  -- Update existing users_sports rows with detail data from users_roles (where cols are NULL)
  UPDATE us
  SET
    us.position_id    = COALESCE(us.position_id,    ur.position_id),
    us.jersey_number  = COALESCE(us.jersey_number,  TRY_CAST(ur.jersey_number  AS TINYINT)),
    us.class_year     = COALESCE(us.class_year,     TRY_CAST(ur.class_year     AS SMALLINT)),
    us.seasons_played = COALESCE(us.seasons_played, TRY_CAST(ur.seasons_played AS TINYINT))
  FROM dbo.users_sports us
  JOIN dbo.users_roles ur ON ur.user_id = us.user_id AND ur.sport_id = us.sport_id;
  PRINT CONCAT('Updated ', @@ROWCOUNT, ' users_sports row(s) with detail data from users_roles');

  -- Mark users_sports.is_active = 0 for any removed role
  UPDATE us
  SET    us.is_active = 0
  FROM   dbo.users_sports us
  JOIN   dbo.users_roles ur ON ur.user_id = us.user_id AND ur.sport_id = us.sport_id
  WHERE  ur.status = 'removed';
  PRINT CONCAT('Deactivated ', @@ROWCOUNT, ' users_sports row(s) matching removed users_roles');
END
ELSE
  PRINT 'dbo.users_roles not found — no backfill needed';
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 5: Create dbo.role_change_log
-- Audit trail for program role changes (e.g. player → alumni).
-- ──────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_change_log' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.role_change_log (
    log_id               INT           NOT NULL IDENTITY(1,1)
                           CONSTRAINT PK_role_change_log PRIMARY KEY,
    user_id              INT           NOT NULL
                           CONSTRAINT FK_rcl_user        REFERENCES dbo.users(user_id),
    sport_id             INT           NULL
                           CONSTRAINT FK_rcl_sport       REFERENCES dbo.sports(id),
    from_program_role_id INT           NULL
                           CONSTRAINT FK_rcl_from_role   REFERENCES dbo.program_role(id),
    to_program_role_id   INT           NOT NULL
                           CONSTRAINT FK_rcl_to_role     REFERENCES dbo.program_role(id),
    changed_by           INT           NOT NULL
                           CONSTRAINT FK_rcl_changed_by  REFERENCES dbo.users(user_id),
    changed_at           DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    notes                NVARCHAR(500) NULL
  );
  CREATE INDEX IX_rcl_user_id   ON dbo.role_change_log(user_id);
  CREATE INDEX IX_rcl_sport_id  ON dbo.role_change_log(sport_id);
  CREATE INDEX IX_rcl_changed_at ON dbo.role_change_log(changed_at DESC);
  PRINT 'Created dbo.role_change_log';
END
ELSE PRINT 'dbo.role_change_log already exists — skipped';
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 6: Migrate role_transfer_log entries → role_change_log
-- Maps old from_status/to_status to program_role_id values.
-- ──────────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.role_transfer_log', 'U') IS NOT NULL
  AND OBJECT_ID('dbo.users_roles',     'U') IS NOT NULL
BEGIN
  INSERT INTO dbo.role_change_log (user_id, sport_id, from_program_role_id, to_program_role_id, changed_by, changed_at, notes)
  SELECT
    ur.user_id,
    ur.sport_id,
    -- Map from_status → program_role_id (best effort)
    CASE rtl.from_status
      WHEN 'current_player' THEN 8
      WHEN 'alumni'         THEN 7
      ELSE NULL
    END,
    -- Map to_status → program_role_id
    CASE rtl.to_status
      WHEN 'current_player' THEN 8
      WHEN 'alumni'         THEN 7
      ELSE ur.program_role_id  -- fallback: current role
    END,
    rtl.admin_user_id,
    rtl.transferred_at,
    rtl.notes
  FROM dbo.role_transfer_log rtl
  JOIN dbo.users_roles ur ON ur.user_role_id = rtl.user_role_id;
  PRINT CONCAT('Migrated ', @@ROWCOUNT, ' role_transfer_log row(s) to role_change_log');
END
ELSE
  PRINT 'role_transfer_log or users_roles not found — no migration needed';
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 7: Drop dbo.role_transfer_log
-- ──────────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.role_transfer_log', 'U') IS NOT NULL
BEGIN
  -- Drop any FKs that point INTO role_transfer_log
  DECLARE @DropRTLFKs NVARCHAR(MAX) = N'';
  SELECT @DropRTLFKs += N'ALTER TABLE '
      + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
      + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
      + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.role_transfer_log');
  IF LEN(@DropRTLFKs) > 0 EXEC sp_executesql @DropRTLFKs;

  DROP TABLE dbo.role_transfer_log;
  PRINT 'Dropped dbo.role_transfer_log';
END
ELSE PRINT 'dbo.role_transfer_log not found — skipped';
GO

-- ──────────────────────────────────────────────────────────────
-- STEP 8: Drop dbo.users_roles
-- Must drop all FKs pointing to it first.
-- ──────────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.users_roles', 'U') IS NOT NULL
BEGIN
  DECLARE @DropURFKs NVARCHAR(MAX) = N'';
  SELECT @DropURFKs += N'ALTER TABLE '
      + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
      + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
      + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.users_roles');
  IF LEN(@DropURFKs) > 0 EXEC sp_executesql @DropURFKs;

  DROP TABLE dbo.users_roles;
  PRINT 'Dropped dbo.users_roles';
END
ELSE PRINT 'dbo.users_roles not found — skipped';
GO

-- ──────────────────────────────────────────────────────────────
-- Verification
-- ──────────────────────────────────────────────────────────────

SELECT
  u.user_id,
  u.first_name,
  u.last_name,
  u.program_role_id,
  pr.display_name   AS programRole,
  u.global_role_id
FROM dbo.users u
JOIN dbo.program_role pr ON pr.id = u.program_role_id
ORDER BY u.user_id;

SELECT
  us.id,
  us.user_id,
  us.sport_id,
  s.name         AS sport,
  us.position_id,
  sp.position_name AS position,
  us.jersey_number,
  us.class_year,
  us.seasons_played,
  us.is_active
FROM dbo.users_sports us
JOIN dbo.sports s ON s.id = us.sport_id
LEFT JOIN dbo.sports_position sp ON sp.position_id = us.position_id
ORDER BY us.user_id, us.sport_id;

SELECT COUNT(*) AS role_change_log_rows FROM dbo.role_change_log;

IF OBJECT_ID('dbo.users_roles',     'U') IS NULL PRINT 'PASS: users_roles dropped';
IF OBJECT_ID('dbo.role_transfer_log','U') IS NULL PRINT 'PASS: role_transfer_log dropped';
PRINT '=== Migration 014 complete ===';
GO
