-- ============================================================
-- 021_REPAIR.sql
-- Fixes the partial failure of 021_integer_team_ids.sql
-- Run on: LegacyLinkGlobal ONLY
-- ============================================================
-- What went wrong in 021:
--   1. auto-named FK on user_teams (FK__user_team__team___xxx) was not
--      caught by the drop logic → blocked teams.id DROP COLUMN
--   2. team_config still had rows so ALTER COLUMN type change failed
--   3. Cascaded: teams had no PK, re-inserts failed, FKs not re-added
-- This script cleans up and completes the migration correctly.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 0. Capture current team rows (still have old GUIDs) ─────────────────────

IF OBJECT_ID('tempdb..#Teams') IS NOT NULL DROP TABLE #Teams;
IF OBJECT_ID('tempdb..#TeamConfig') IS NOT NULL DROP TABLE #TeamConfig;

SELECT
  CASE abbr WHEN 'LLHQ' THEN 1 WHEN 'USF' THEN 2 ELSE NULL END AS new_id,
  id   AS old_guid,
  name, abbr, app_db, db_server, tier_id, level_id, is_active, expires_at
INTO #Teams
FROM dbo.teams;

SELECT
  t_new.new_id AS new_team_id,
  tc.*
INTO #TeamConfig
FROM dbo.team_config tc
JOIN #Teams t_new ON t_new.old_guid = tc.team_id;

PRINT CONCAT('Captured ', (SELECT COUNT(*) FROM #Teams), ' team(s)');
PRINT CONCAT('Captured ', (SELECT COUNT(*) FROM #TeamConfig), ' team_config row(s)');
GO

-- ─── 1. Drop ALL remaining FKs that block column changes ─────────────────────

-- Drop every FK on user_teams.team_id (catches both named and auto-named)
DECLARE @fk NVARCHAR(200);
SELECT TOP 1 @fk = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.user_teams') AND c.name = 'team_id';
WHILE @fk IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.user_teams DROP CONSTRAINT [' + @fk + N']');
  PRINT CONCAT('Dropped FK on user_teams.team_id: ', @fk);
  SET @fk = NULL;
  SELECT TOP 1 @fk = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.user_teams') AND c.name = 'team_id';
END

-- Drop every FK on team_config.team_id
DECLARE @fk2 NVARCHAR(200);
SELECT TOP 1 @fk2 = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.team_config') AND c.name = 'team_id';
WHILE @fk2 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.team_config DROP CONSTRAINT [' + @fk2 + N']');
  PRINT CONCAT('Dropped FK on team_config.team_id: ', @fk2);
  SET @fk2 = NULL;
  SELECT TOP 1 @fk2 = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.team_config') AND c.name = 'team_id';
END

-- Drop every FK on invite_codes.team_id
DECLARE @fk3 NVARCHAR(200);
SELECT TOP 1 @fk3 = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.invite_codes') AND c.name = 'team_id';
WHILE @fk3 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.invite_codes DROP CONSTRAINT [' + @fk3 + N']');
  PRINT CONCAT('Dropped FK on invite_codes.team_id: ', @fk3);
  SET @fk3 = NULL;
  SELECT TOP 1 @fk3 = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.invite_codes') AND c.name = 'team_id';
END

-- Drop every FK on access_requests.team_id
DECLARE @fk4 NVARCHAR(200);
SELECT TOP 1 @fk4 = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.access_requests') AND c.name = 'team_id';
WHILE @fk4 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.access_requests DROP CONSTRAINT [' + @fk4 + N']');
  PRINT CONCAT('Dropped FK on access_requests.team_id: ', @fk4);
  SET @fk4 = NULL;
  SELECT TOP 1 @fk4 = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.access_requests') AND c.name = 'team_id';
END

-- Drop every FK on user_team_preferences.preferred_team_id
DECLARE @fk5 NVARCHAR(200);
SELECT TOP 1 @fk5 = fk.name
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.user_team_preferences') AND c.name = 'preferred_team_id';
WHILE @fk5 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.user_team_preferences DROP CONSTRAINT [' + @fk5 + N']');
  PRINT CONCAT('Dropped FK on user_team_preferences.preferred_team_id: ', @fk5);
  SET @fk5 = NULL;
  SELECT TOP 1 @fk5 = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.user_team_preferences') AND c.name = 'preferred_team_id';
END

PRINT 'All blocking FKs dropped';
GO

-- ─── 2. Drop remaining UQ/PK/indexes that block column changes ───────────────

-- UQ on user_teams (may have been re-added by 021)
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_user_team' AND parent_object_id = OBJECT_ID('dbo.user_teams'))
BEGIN ALTER TABLE dbo.user_teams DROP CONSTRAINT UQ_user_team; PRINT 'Dropped UQ_user_team'; END

-- team_config PK (may still be dropped from 021, or may exist as PK_team_config)
DECLARE @tcpk NVARCHAR(200);
SELECT @tcpk = kc.name FROM sys.key_constraints kc
WHERE kc.parent_object_id = OBJECT_ID('dbo.team_config') AND kc.type = 'PK';
IF @tcpk IS NOT NULL
BEGIN EXEC(N'ALTER TABLE dbo.team_config DROP CONSTRAINT [' + @tcpk + N']'); PRINT CONCAT('Dropped team_config PK: ', @tcpk); END

-- Drop teams PK if it somehow got re-added
DECLARE @tpk NVARCHAR(200);
SELECT @tpk = kc.name FROM sys.key_constraints kc
WHERE kc.parent_object_id = OBJECT_ID('dbo.teams') AND kc.type = 'PK';
IF @tpk IS NOT NULL
BEGIN EXEC(N'ALTER TABLE dbo.teams DROP CONSTRAINT [' + @tpk + N']'); PRINT CONCAT('Dropped teams PK: ', @tpk); END

-- teams indexes
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_abbr'      AND object_id = OBJECT_ID('dbo.teams')) DROP INDEX IX_teams_abbr      ON dbo.teams;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_is_active'  AND object_id = OBJECT_ID('dbo.teams')) DROP INDEX IX_teams_is_active  ON dbo.teams;

-- Drop team_config DEFAULT on id if it still exists
DECLARE @def NVARCHAR(200);
SELECT @def = dc.name FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.team_config') AND c.name = 'id';
IF @def IS NOT NULL
BEGIN EXEC(N'ALTER TABLE dbo.team_config DROP CONSTRAINT [' + @def + N']'); PRINT CONCAT('Dropped DEFAULT on team_config.id: ', @def); END

-- Drop UQ_team_config_team_id if re-added
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_team_config_team_id' AND object_id = OBJECT_ID('dbo.team_config'))
  DROP INDEX UQ_team_config_team_id ON dbo.team_config;

PRINT 'Remaining constraints and indexes dropped';
GO

-- ─── 3. Clear child tables and team_config (wipe already emptied most) ────────

DELETE FROM dbo.user_teams;
DELETE FROM dbo.user_team_preferences;
DELETE FROM dbo.invite_tokens;
DELETE FROM dbo.invite_codes;
DELETE FROM dbo.access_requests;
DELETE FROM dbo.team_config;
PRINT 'Child tables cleared';
GO

-- ─── 4. Fix teams.id: drop GUID column, add INT IDENTITY ─────────────────────

-- Drop DEFAULT on teams.id
DECLARE @tdef NVARCHAR(200);
SELECT @tdef = dc.name FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.teams') AND c.name = 'id';
IF @tdef IS NOT NULL
BEGIN EXEC(N'ALTER TABLE dbo.teams DROP CONSTRAINT [' + @tdef + N']'); PRINT CONCAT('Dropped DEFAULT on teams.id: ', @tdef); END
GO

-- Now safe to drop the GUID id column (no FKs, no PK, no DEFAULT)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.teams') AND name = 'id'
           AND system_type_id = 36 /* uniqueidentifier */)
BEGIN
  ALTER TABLE dbo.teams DROP COLUMN id;
  PRINT 'Dropped teams.id (UNIQUEIDENTIFIER)';
END
GO

-- Add INT IDENTITY PK
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.teams') AND name = 'id')
BEGIN
  ALTER TABLE dbo.teams ADD id INT NOT NULL IDENTITY(1,1) CONSTRAINT PK_teams PRIMARY KEY;
  PRINT 'Added teams.id INT IDENTITY(1,1) PK';
END
GO

-- Re-create indexes
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_abbr'     AND object_id = OBJECT_ID('dbo.teams')) CREATE UNIQUE INDEX IX_teams_abbr     ON dbo.teams(abbr);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_teams_is_active' AND object_id = OBJECT_ID('dbo.teams')) CREATE INDEX IX_teams_is_active ON dbo.teams(is_active);
PRINT 'teams indexes recreated';
GO

-- ─── 5. Re-insert teams with correct INT IDs ─────────────────────────────────

DELETE FROM dbo.teams; -- clear the old GUID rows (now safe — no FKs)
GO

SET IDENTITY_INSERT dbo.teams ON;
INSERT INTO dbo.teams (id, name, abbr, app_db, db_server, tier_id, level_id, is_active, expires_at)
SELECT new_id, name, abbr, app_db, db_server, tier_id, level_id, is_active, expires_at
FROM   #Teams
WHERE  new_id IS NOT NULL
ORDER  BY new_id;
SET IDENTITY_INSERT dbo.teams OFF;

PRINT CONCAT('Re-inserted ', @@ROWCOUNT, ' team(s) with INT IDs');
GO

-- ─── 6. Fix child table team_id columns: ensure INT type ─────────────────────
-- Tables are empty so type conversion is safe regardless of current type.

-- Determine current type and alter only if still UNIQUEIDENTIFIER
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.user_teams')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.user_teams ALTER COLUMN team_id INT NOT NULL;
  PRINT 'Altered user_teams.team_id to INT';
END
ELSE PRINT 'user_teams.team_id already INT — skipping';

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.team_config')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.team_config ALTER COLUMN team_id INT NULL; -- nullable during PK add
  PRINT 'Altered team_config.team_id to INT';
END
ELSE PRINT 'team_config.team_id already INT — skipping';

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.invite_codes')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.invite_codes ALTER COLUMN team_id INT NOT NULL;
  PRINT 'Altered invite_codes.team_id to INT';
END
ELSE PRINT 'invite_codes.team_id already INT — skipping';

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.access_requests')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.access_requests ALTER COLUMN team_id INT NOT NULL;
  PRINT 'Altered access_requests.team_id to INT';
END
ELSE PRINT 'access_requests.team_id already INT — skipping';

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.user_team_preferences')
           AND name = 'preferred_team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.user_team_preferences ALTER COLUMN preferred_team_id INT NOT NULL;
  PRINT 'Altered user_team_preferences.preferred_team_id to INT';
END
ELSE PRINT 'user_team_preferences.preferred_team_id already INT — skipping';
GO

-- ─── 7. Drop team_config.id (GUID) and make team_id the PK ──────────────────

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.team_config') AND name = 'id')
BEGIN
  ALTER TABLE dbo.team_config DROP COLUMN id;
  PRINT 'Dropped team_config.id';
END

ALTER TABLE dbo.team_config ALTER COLUMN team_id INT NOT NULL;
ALTER TABLE dbo.team_config ADD CONSTRAINT PK_team_config PRIMARY KEY (team_id);
PRINT 'team_config.team_id is now NOT NULL PK';
GO

-- ─── 8. Re-add all FK constraints ────────────────────────────────────────────

ALTER TABLE dbo.user_teams
  ADD CONSTRAINT FK_user_teams_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(id);
ALTER TABLE dbo.user_teams
  ADD CONSTRAINT UQ_user_team UNIQUE (user_id, team_id);

ALTER TABLE dbo.team_config
  ADD CONSTRAINT FK_team_config_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

ALTER TABLE dbo.invite_codes
  ADD CONSTRAINT FK_invite_codes_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(id) ON DELETE CASCADE;

ALTER TABLE dbo.access_requests
  ADD CONSTRAINT FK_access_requests_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

ALTER TABLE dbo.user_team_preferences
  ADD CONSTRAINT FK_utp_team FOREIGN KEY (preferred_team_id) REFERENCES dbo.teams(id);

PRINT 'All FK constraints re-added';
GO

CREATE INDEX IX_user_teams_team_id      ON dbo.user_teams(team_id);
CREATE INDEX IX_invite_codes_team_id    ON dbo.invite_codes(team_id);
CREATE INDEX IX_access_requests_team_id ON dbo.access_requests(team_id);
PRINT 'Indexes re-created';
GO

-- ─── 9. Re-seed team_config ───────────────────────────────────────────────────

INSERT INTO dbo.team_config (
  team_id, team_name, team_abbr,
  color_primary, color_primary_dark, color_primary_light,
  color_accent,  color_accent_dark,  color_accent_light,
  positions_json, academic_years_json,
  alumni_label, roster_label, class_label
)
SELECT
  tc.new_team_id,
  tc.team_name, tc.team_abbr,
  tc.color_primary, tc.color_primary_dark, tc.color_primary_light,
  tc.color_accent,  tc.color_accent_dark,  tc.color_accent_light,
  tc.positions_json, tc.academic_years_json,
  tc.alumni_label, tc.roster_label, tc.class_label
FROM #TeamConfig tc
WHERE tc.new_team_id IS NOT NULL;

PRINT CONCAT('Re-seeded ', @@ROWCOUNT, ' team_config row(s)');
GO

-- ─── 10. Re-link mswalsh68 to both teams ─────────────────────────────────────

DECLARE @PlatformUserId UNIQUEIDENTIFIER = (SELECT id FROM dbo.users WHERE email = 'mswalsh68@gmail.com');

IF @PlatformUserId IS NOT NULL
BEGIN
  INSERT INTO dbo.user_teams (user_id, team_id, is_active)
  SELECT @PlatformUserId, t.id, 1
  FROM   dbo.teams t
  WHERE  NOT EXISTS (SELECT 1 FROM dbo.user_teams ut WHERE ut.user_id = @PlatformUserId AND ut.team_id = t.id);
  PRINT CONCAT('Linked mswalsh68 to ', @@ROWCOUNT, ' team(s)');
END
ELSE
  PRINT 'WARNING: mswalsh68@gmail.com not found';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT id, name, abbr, app_db, tier_id, level_id, is_active FROM dbo.teams ORDER BY id;
SELECT team_id, team_name, team_abbr FROM dbo.team_config ORDER BY team_id;
SELECT ut.user_id, u.email, ut.team_id, t.name AS team_name
FROM   dbo.user_teams ut
JOIN   dbo.users u ON u.id = ut.user_id
JOIN   dbo.teams t ON t.id = ut.team_id
ORDER  BY ut.team_id;

PRINT '=== 021_repair complete ===';
GO
