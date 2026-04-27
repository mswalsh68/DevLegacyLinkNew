-- ============================================================
-- Migration 021: Integer team IDs + simplified team_config PK
-- Run on: LegacyLinkGlobal database
-- Run after: 020_integer_user_id.sql
-- ============================================================
-- Changes:
--   1. Capture current team data (name, abbr, etc.)
--   2. Drop all FK constraints that reference teams.id (GUID)
--   3. Drop and recreate teams with INT IDENTITY(1,1) PK
--      Legacy Link = 1, USF = 2 (and so on for future teams)
--   4. Alter child table team_id columns: UNIQUEIDENTIFIER → INT
--   5. Simplify team_config: drop GUID id PK, use team_id INT as PK
--   6. Re-add FK constraints
--   7. Re-seed team_config rows linked to new INT team IDs
--
-- Why: GUIDs in teams/team_config serve no purpose — team IDs
-- are never shared externally, never need global uniqueness, and
-- INT is cleaner for joins, logging, and debugging.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 0. Capture current team rows before dropping the table ──────────────────

IF OBJECT_ID('tempdb..#TeamBackup') IS NOT NULL DROP TABLE #TeamBackup;

SELECT
  name,
  abbr,
  app_db,
  db_server,
  tier_id,
  level_id,
  is_active,
  created_at,
  expires_at,
  -- Assign deterministic INT id: LegacyLink (LLHQ) = 1, USF = 2, others follow
  CASE abbr
    WHEN 'LLHQ' THEN 1
    WHEN 'USF'  THEN 2
    ELSE NULL   -- will be assigned via IDENTITY for any future teams
  END AS new_int_id
INTO #TeamBackup
FROM dbo.teams;

-- Verify we have both known teams
IF NOT EXISTS (SELECT 1 FROM #TeamBackup WHERE abbr = 'LLHQ')
  PRINT 'WARNING: LLHQ team not found — check abbr value in dbo.teams';
IF NOT EXISTS (SELECT 1 FROM #TeamBackup WHERE abbr = 'USF')
  PRINT 'WARNING: USF team not found — check abbr value in dbo.teams';

PRINT CONCAT('Captured ', (SELECT COUNT(*) FROM #TeamBackup), ' team(s) for re-insert');
GO

-- ─── 1. Drop FK constraints on child tables ───────────────────────────────────

-- user_teams
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_teams_teams')
BEGIN
  ALTER TABLE dbo.user_teams DROP CONSTRAINT FK_user_teams_teams;
  PRINT 'Dropped FK_user_teams_teams';
END
GO

-- team_config
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_team_config_teams')
BEGIN
  ALTER TABLE dbo.team_config DROP CONSTRAINT FK_team_config_teams;
  PRINT 'Dropped FK_team_config_teams';
END
-- Also catch any auto-named FKs on team_config.team_id
DECLARE @fk NVARCHAR(200);
SELECT @fk = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.team_config') AND c.name = 'team_id';
IF @fk IS NOT NULL EXEC(N'ALTER TABLE dbo.team_config DROP CONSTRAINT [' + @fk + N']');
GO

-- invite_codes
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK__invite_co__team___' )
  PRINT 'invite_codes FK already gone';
DECLARE @fk2 NVARCHAR(200);
SELECT @fk2 = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.invite_codes') AND c.name = 'team_id';
IF @fk2 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.invite_codes DROP CONSTRAINT [' + @fk2 + N']');
  PRINT CONCAT('Dropped FK on invite_codes.team_id: ', @fk2);
END
GO

-- access_requests
DECLARE @fk3 NVARCHAR(200);
SELECT @fk3 = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.access_requests') AND c.name = 'team_id';
IF @fk3 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.access_requests DROP CONSTRAINT [' + @fk3 + N']');
  PRINT CONCAT('Dropped FK on access_requests.team_id: ', @fk3);
END
GO

-- ─── 2. Drop indexes on child team_id columns (needed before ALTER COLUMN) ───

-- user_teams
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_teams_team_id' AND object_id = OBJECT_ID('dbo.user_teams'))
BEGIN
  DROP INDEX IX_user_teams_team_id ON dbo.user_teams;
  PRINT 'Dropped IX_user_teams_team_id';
END
GO

-- invite_codes
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_invite_codes_team_id' AND object_id = OBJECT_ID('dbo.invite_codes'))
BEGIN
  DROP INDEX IX_invite_codes_team_id ON dbo.invite_codes;
  PRINT 'Dropped IX_invite_codes_team_id';
END
GO

-- access_requests
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_access_requests_team_id' AND object_id = OBJECT_ID('dbo.access_requests'))
BEGIN
  DROP INDEX IX_access_requests_team_id ON dbo.access_requests;
  PRINT 'Dropped IX_access_requests_team_id';
END
GO

-- ─── 3. Alter child team_id columns: UNIQUEIDENTIFIER → INT ──────────────────
-- All child tables were wiped in 000_wipe_test_data.sql so no data to migrate.

-- Drop UQ constraint on user_teams before altering
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_user_team' AND parent_object_id = OBJECT_ID('dbo.user_teams'))
BEGIN
  ALTER TABLE dbo.user_teams DROP CONSTRAINT UQ_user_team;
  PRINT 'Dropped UQ_user_team';
END
GO

-- Drop FK on user_team_preferences.preferred_team_id before altering
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_utp_team')
BEGIN
  ALTER TABLE dbo.user_team_preferences DROP CONSTRAINT FK_utp_team;
  PRINT 'Dropped FK_utp_team';
END
GO

ALTER TABLE dbo.user_teams              ALTER COLUMN team_id           INT NOT NULL;
ALTER TABLE dbo.invite_codes            ALTER COLUMN team_id           INT NOT NULL;
ALTER TABLE dbo.access_requests         ALTER COLUMN team_id           INT NOT NULL;
ALTER TABLE dbo.user_team_preferences   ALTER COLUMN preferred_team_id INT NOT NULL;
PRINT 'Altered team_id/preferred_team_id columns to INT';
GO

-- ─── 4. Rebuild teams table with INT IDENTITY PK ─────────────────────────────

-- Drop unique index on abbr if it exists
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_abbr' AND object_id = OBJECT_ID('dbo.teams'))
  DROP INDEX IX_teams_abbr ON dbo.teams;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_is_active' AND object_id = OBJECT_ID('dbo.teams'))
  DROP INDEX IX_teams_is_active ON dbo.teams;
GO

-- Drop old PK constraint (system-named) and then the column
DECLARE @pk NVARCHAR(200);
SELECT @pk = kc.name
FROM sys.key_constraints kc
WHERE kc.parent_object_id = OBJECT_ID('dbo.teams') AND kc.type = 'PK';
IF @pk IS NOT NULL EXEC(N'ALTER TABLE dbo.teams DROP CONSTRAINT [' + @pk + N']');
PRINT 'Dropped PK on dbo.teams';
GO

-- Add new INT IDENTITY id column
ALTER TABLE dbo.teams DROP COLUMN id;
GO

ALTER TABLE dbo.teams
  ADD id INT NOT NULL IDENTITY(1,1)
      CONSTRAINT PK_teams PRIMARY KEY;
PRINT 'Added INT IDENTITY id to dbo.teams';
GO

-- Re-add indexes
CREATE UNIQUE INDEX IX_teams_abbr      ON dbo.teams(abbr);
CREATE        INDEX IX_teams_is_active ON dbo.teams(is_active);
PRINT 'Re-created teams indexes';
GO

-- ─── 5. Wipe and re-insert teams in canonical order ──────────────────────────
-- The data-wipe already cleared child tables.
-- Delete current rows so we can re-insert with controlled IDENTITY values.

DELETE FROM dbo.teams;
PRINT 'Cleared dbo.teams for controlled re-insert';
GO

SET IDENTITY_INSERT dbo.teams ON;

INSERT INTO dbo.teams (id, name, abbr, app_db, db_server, tier_id, level_id, is_active)
SELECT new_int_id, name, abbr, app_db, db_server, tier_id, level_id, is_active
FROM   #TeamBackup
WHERE  new_int_id IS NOT NULL
ORDER  BY new_int_id;

SET IDENTITY_INSERT dbo.teams OFF;

-- Re-seed the identity sequence past the highest inserted id
-- (SQL Server IDENTITY resumes from the max value automatically after SET IDENTITY_INSERT OFF)

PRINT CONCAT('Re-inserted ', @@ROWCOUNT, ' team(s) with canonical INT IDs');
GO

-- ─── 6. Simplify team_config: drop GUID id, use team_id INT as PK ────────────

-- Drop current PK on team_config (the GUID id column)
DECLARE @tcpk NVARCHAR(200);
SELECT @tcpk = kc.name
FROM sys.key_constraints kc
WHERE kc.parent_object_id = OBJECT_ID('dbo.team_config') AND kc.type = 'PK';
IF @tcpk IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.team_config DROP CONSTRAINT [' + @tcpk + N']');
  PRINT CONCAT('Dropped team_config PK: ', @tcpk);
END
GO

-- Drop the GUID id column
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.team_config') AND name = 'id')
BEGIN
  ALTER TABLE dbo.team_config DROP COLUMN id;
  PRINT 'Dropped team_config.id (GUID)';
END
GO

-- Drop the unique index on team_id if it exists (prevents adding PK)
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_team_config_team_id' AND object_id = OBJECT_ID('dbo.team_config'))
BEGIN
  DROP INDEX UQ_team_config_team_id ON dbo.team_config;
  PRINT 'Dropped UQ_team_config_team_id';
END
GO

-- Alter team_config.team_id to INT (was UNIQUEIDENTIFIER)
ALTER TABLE dbo.team_config ALTER COLUMN team_id INT NOT NULL;
PRINT 'Altered team_config.team_id to INT';
GO

-- Make team_id the PK
ALTER TABLE dbo.team_config
  ADD CONSTRAINT PK_team_config PRIMARY KEY (team_id);
PRINT 'team_id is now PK on team_config';
GO

-- ─── 7. Re-add FK constraints ─────────────────────────────────────────────────

ALTER TABLE dbo.user_teams
  ADD CONSTRAINT FK_user_teams_teams
      FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

ALTER TABLE dbo.user_teams
  ADD CONSTRAINT UQ_user_team UNIQUE (user_id, team_id);

ALTER TABLE dbo.team_config
  ADD CONSTRAINT FK_team_config_teams
      FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

ALTER TABLE dbo.invite_codes
  ADD CONSTRAINT FK_invite_codes_teams
      FOREIGN KEY (team_id) REFERENCES dbo.teams(id) ON DELETE CASCADE;

ALTER TABLE dbo.access_requests
  ADD CONSTRAINT FK_access_requests_teams
      FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

ALTER TABLE dbo.user_team_preferences
  ADD CONSTRAINT FK_utp_team
      FOREIGN KEY (preferred_team_id) REFERENCES dbo.teams(id);

PRINT 'Re-added all FK constraints on team_id columns';
GO

-- Rebuild indexes
CREATE INDEX IX_user_teams_team_id      ON dbo.user_teams(team_id);
CREATE INDEX IX_invite_codes_team_id    ON dbo.invite_codes(team_id);
CREATE INDEX IX_access_requests_team_id ON dbo.access_requests(team_id);
PRINT 'Re-created team_id indexes';
GO

-- ─── 8. Re-seed team_config ────────────────────────────────────────────────────
-- One config row per team. Wipe removed any existing rows.

DELETE FROM dbo.team_config;

INSERT INTO dbo.team_config (
  team_id,
  team_name, team_abbr,
  color_primary, color_primary_dark, color_primary_light,
  color_accent,  color_accent_dark,  color_accent_light,
  positions_json, academic_years_json,
  alumni_label, roster_label, class_label
) VALUES
-- 1: Legacy Link (platform default — neutral colors)
(
  1,
  'Legacy Link', 'LLHQ',
  '#1A1A2E', '#12121F', '#E8E8F0',
  '#CFC493', '#A89C6A', '#EDEBD1',
  '["QB","RB","WR","TE","OL","DL","LB","DB","K","P","LS","ATH"]',
  '[{"value":"freshman","label":"Freshman"},{"value":"sophomore","label":"Sophomore"},{"value":"junior","label":"Junior"},{"value":"senior","label":"Senior"},{"value":"graduate","label":"Graduate"}]',
  'Alumni', 'Roster', 'Recruiting Class'
),
-- 2: USF Bulls
(
  2,
  'USF Bulls', 'USF',
  '#006747', '#005432', '#E0F0EA',
  '#CFC493', '#A89C6A', '#EDEBD1',
  '["QB","RB","WR","TE","OL","DL","LB","DB","K","P","LS","ATH"]',
  '[{"value":"freshman","label":"Freshman"},{"value":"sophomore","label":"Sophomore"},{"value":"junior","label":"Junior"},{"value":"senior","label":"Senior"},{"value":"graduate","label":"Graduate"}]',
  'Alumni', 'Roster', 'Recruiting Class'
);

PRINT CONCAT('Seeded ', @@ROWCOUNT, ' team_config row(s)');
GO

-- ─── 9. Re-link mswalsh68@gmail.com to both teams ────────────────────────────

DECLARE @PlatformUserId UNIQUEIDENTIFIER = (
  SELECT id FROM dbo.users WHERE email = 'mswalsh68@gmail.com'
);

IF @PlatformUserId IS NULL
BEGIN
  PRINT 'WARNING: mswalsh68@gmail.com not found — skipping user_teams seed';
END
ELSE
BEGIN
  INSERT INTO dbo.user_teams (user_id, team_id, is_active)
  SELECT @PlatformUserId, t.id, 1
  FROM   dbo.teams t
  WHERE  NOT EXISTS (
    SELECT 1 FROM dbo.user_teams ut
    WHERE ut.user_id = @PlatformUserId AND ut.team_id = t.id
  );
  PRINT CONCAT('Seeded ', @@ROWCOUNT, ' user_teams row(s) for platform owner');
END
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT id, name, abbr, app_db, tier_id, level_id, is_active FROM dbo.teams ORDER BY id;
SELECT team_id, team_name, team_abbr FROM dbo.team_config ORDER BY team_id;
SELECT ut.user_id, u.email, ut.team_id, t.name AS team_name
FROM   dbo.user_teams ut
JOIN   dbo.users u  ON u.id  = ut.user_id
JOIN   dbo.teams t  ON t.id  = ut.team_id
ORDER  BY ut.team_id;

PRINT '=== Migration 021 complete ===';
GO
