-- ============================================================
-- 021_repair3.sql — Final fix for integer team ID migration
-- Run on: LegacyLinkGlobal ONLY
-- ============================================================
-- Root cause: SQL Server cannot ALTER COLUMN between incompatible
-- types (UNIQUEIDENTIFIER ↔ INT) even on empty tables.
-- Fix: DROP the old GUID column, ADD a new INT column.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 1. Drop every constraint / index that touches a team_id column ──────────

-- user_teams
IF EXISTS (SELECT 1 FROM sys.key_constraints  WHERE name = 'UQ_user_team'           AND parent_object_id = OBJECT_ID('dbo.user_teams'))
  ALTER TABLE dbo.user_teams DROP CONSTRAINT UQ_user_team;
IF EXISTS (SELECT 1 FROM sys.indexes          WHERE name = 'IX_user_teams_team_id'  AND object_id = OBJECT_ID('dbo.user_teams'))
  DROP INDEX IX_user_teams_team_id ON dbo.user_teams;
DECLARE @fk NVARCHAR(200);
SELECT TOP 1 @fk = fk.name FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.user_teams') AND c.name = 'team_id';
WHILE @fk IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.user_teams DROP CONSTRAINT [' + @fk + N']');
  SET @fk = NULL;
  SELECT TOP 1 @fk = fk.name FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.user_teams') AND c.name = 'team_id';
END
PRINT 'user_teams constraints cleared';

-- team_config
DECLARE @fk2 NVARCHAR(200);
SELECT TOP 1 @fk2 = fk.name FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.team_config') AND c.name = 'team_id';
WHILE @fk2 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.team_config DROP CONSTRAINT [' + @fk2 + N']');
  SET @fk2 = NULL;
  SELECT TOP 1 @fk2 = fk.name FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.team_config') AND c.name = 'team_id';
END
DECLARE @tcpk NVARCHAR(200);
SELECT @tcpk = kc.name FROM sys.key_constraints kc
WHERE kc.parent_object_id = OBJECT_ID('dbo.team_config') AND kc.type = 'PK';
IF @tcpk IS NOT NULL EXEC(N'ALTER TABLE dbo.team_config DROP CONSTRAINT [' + @tcpk + N']');
PRINT 'team_config constraints cleared';

-- invite_codes
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_invite_codes_team_id' AND object_id = OBJECT_ID('dbo.invite_codes'))
  DROP INDEX IX_invite_codes_team_id ON dbo.invite_codes;
DECLARE @fk3 NVARCHAR(200);
SELECT TOP 1 @fk3 = fk.name FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.invite_codes') AND c.name = 'team_id';
WHILE @fk3 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.invite_codes DROP CONSTRAINT [' + @fk3 + N']');
  SET @fk3 = NULL;
  SELECT TOP 1 @fk3 = fk.name FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.invite_codes') AND c.name = 'team_id';
END
PRINT 'invite_codes constraints cleared';

-- access_requests
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_access_requests_team_id' AND object_id = OBJECT_ID('dbo.access_requests'))
  DROP INDEX IX_access_requests_team_id ON dbo.access_requests;
DECLARE @fk4 NVARCHAR(200);
SELECT TOP 1 @fk4 = fk.name FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.access_requests') AND c.name = 'team_id';
WHILE @fk4 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.access_requests DROP CONSTRAINT [' + @fk4 + N']');
  SET @fk4 = NULL;
  SELECT TOP 1 @fk4 = fk.name FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.access_requests') AND c.name = 'team_id';
END
PRINT 'access_requests constraints cleared';

-- user_team_preferences
DECLARE @fk5 NVARCHAR(200);
SELECT TOP 1 @fk5 = fk.name FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.user_team_preferences') AND c.name = 'preferred_team_id';
WHILE @fk5 IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.user_team_preferences DROP CONSTRAINT [' + @fk5 + N']');
  SET @fk5 = NULL;
  SELECT TOP 1 @fk5 = fk.name FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.user_team_preferences') AND c.name = 'preferred_team_id';
END
PRINT 'user_team_preferences constraints cleared';
GO

-- ─── 2. Clear all child tables so DROP COLUMN has no data concerns ────────────
DELETE FROM dbo.user_teams;
DELETE FROM dbo.user_team_preferences;
DELETE FROM dbo.invite_codes;
DELETE FROM dbo.access_requests;
DELETE FROM dbo.team_config;
PRINT 'Child tables cleared';
GO

-- ─── 3. DROP old GUID columns and ADD new INT columns ────────────────────────

-- user_teams.team_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.user_teams')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.user_teams DROP COLUMN team_id;
  ALTER TABLE dbo.user_teams ADD   team_id INT NOT NULL DEFAULT 0;
  -- Remove the default immediately (only needed to satisfy NOT NULL during ADD)
  DECLARE @ud NVARCHAR(200);
  SELECT @ud = dc.name FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.user_teams') AND c.name = 'team_id';
  IF @ud IS NOT NULL EXEC(N'ALTER TABLE dbo.user_teams DROP CONSTRAINT [' + @ud + N']');
  PRINT 'Rebuilt user_teams.team_id as INT';
END
ELSE PRINT 'user_teams.team_id already INT';

-- team_config.team_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.team_config')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.team_config DROP COLUMN team_id;
  ALTER TABLE dbo.team_config ADD   team_id INT NOT NULL DEFAULT 0;
  DECLARE @td NVARCHAR(200);
  SELECT @td = dc.name FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.team_config') AND c.name = 'team_id';
  IF @td IS NOT NULL EXEC(N'ALTER TABLE dbo.team_config DROP CONSTRAINT [' + @td + N']');
  PRINT 'Rebuilt team_config.team_id as INT';
END
ELSE PRINT 'team_config.team_id already INT';

-- invite_codes.team_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.invite_codes')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.invite_codes DROP COLUMN team_id;
  ALTER TABLE dbo.invite_codes ADD   team_id INT NOT NULL DEFAULT 0;
  DECLARE @id NVARCHAR(200);
  SELECT @id = dc.name FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.invite_codes') AND c.name = 'team_id';
  IF @id IS NOT NULL EXEC(N'ALTER TABLE dbo.invite_codes DROP CONSTRAINT [' + @id + N']');
  PRINT 'Rebuilt invite_codes.team_id as INT';
END
ELSE PRINT 'invite_codes.team_id already INT';

-- access_requests.team_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.access_requests')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.access_requests DROP COLUMN team_id;
  ALTER TABLE dbo.access_requests ADD   team_id INT NOT NULL DEFAULT 0;
  DECLARE @ad NVARCHAR(200);
  SELECT @ad = dc.name FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.access_requests') AND c.name = 'team_id';
  IF @ad IS NOT NULL EXEC(N'ALTER TABLE dbo.access_requests DROP CONSTRAINT [' + @ad + N']');
  PRINT 'Rebuilt access_requests.team_id as INT';
END
ELSE PRINT 'access_requests.team_id already INT';

-- user_team_preferences.preferred_team_id
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.user_team_preferences')
           AND name = 'preferred_team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.user_team_preferences DROP COLUMN preferred_team_id;
  ALTER TABLE dbo.user_team_preferences ADD   preferred_team_id INT NOT NULL DEFAULT 0;
  DECLARE @pd NVARCHAR(200);
  SELECT @pd = dc.name FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.user_team_preferences') AND c.name = 'preferred_team_id';
  IF @pd IS NOT NULL EXEC(N'ALTER TABLE dbo.user_team_preferences DROP CONSTRAINT [' + @pd + N']');
  PRINT 'Rebuilt user_team_preferences.preferred_team_id as INT';
END
ELSE PRINT 'user_team_preferences.preferred_team_id already INT';
GO

-- team_config: make team_id the PK
IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_team_config' AND parent_object_id = OBJECT_ID('dbo.team_config'))
  ALTER TABLE dbo.team_config ADD CONSTRAINT PK_team_config PRIMARY KEY (team_id);
PRINT 'PK_team_config ensured';
GO

-- ─── 4. Re-add FK constraints ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_teams_teams')
  ALTER TABLE dbo.user_teams
    ADD CONSTRAINT FK_user_teams_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_user_team' AND parent_object_id = OBJECT_ID('dbo.user_teams'))
  ALTER TABLE dbo.user_teams
    ADD CONSTRAINT UQ_user_team UNIQUE (user_id, team_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_team_config_teams')
  ALTER TABLE dbo.team_config
    ADD CONSTRAINT FK_team_config_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_invite_codes_teams')
  ALTER TABLE dbo.invite_codes
    ADD CONSTRAINT FK_invite_codes_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(id) ON DELETE CASCADE;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_access_requests_teams')
  ALTER TABLE dbo.access_requests
    ADD CONSTRAINT FK_access_requests_teams FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_utp_team')
  ALTER TABLE dbo.user_team_preferences
    ADD CONSTRAINT FK_utp_team FOREIGN KEY (preferred_team_id) REFERENCES dbo.teams(id);

PRINT 'All FKs re-added';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_teams_team_id'      AND object_id = OBJECT_ID('dbo.user_teams'))
  CREATE INDEX IX_user_teams_team_id      ON dbo.user_teams(team_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_invite_codes_team_id'    AND object_id = OBJECT_ID('dbo.invite_codes'))
  CREATE INDEX IX_invite_codes_team_id    ON dbo.invite_codes(team_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_access_requests_team_id' AND object_id = OBJECT_ID('dbo.access_requests'))
  CREATE INDEX IX_access_requests_team_id ON dbo.access_requests(team_id);
PRINT 'Indexes re-created';
GO

-- ─── 5. Re-seed team_config ───────────────────────────────────────────────────
INSERT INTO dbo.team_config (
  team_id, team_name, team_abbr,
  color_primary, color_primary_dark, color_primary_light,
  color_accent,  color_accent_dark,  color_accent_light,
  positions_json, academic_years_json,
  alumni_label, roster_label, class_label
) VALUES
(1, 'Legacy Link', 'LLHQ',
 '#1A1A2E', '#12121F', '#E8E8F0',
 '#CFC493', '#A89C6A', '#EDEBD1',
 '["QB","RB","WR","TE","OL","DL","LB","DB","K","P","LS","ATH"]',
 '[{"value":"freshman","label":"Freshman"},{"value":"sophomore","label":"Sophomore"},{"value":"junior","label":"Junior"},{"value":"senior","label":"Senior"},{"value":"graduate","label":"Graduate"}]',
 'Alumni', 'Roster', 'Recruiting Class'),
(2, 'USF Bulls', 'USF',
 '#006747', '#005432', '#E0F0EA',
 '#CFC493', '#A89C6A', '#EDEBD1',
 '["QB","RB","WR","TE","OL","DL","LB","DB","K","P","LS","ATH"]',
 '[{"value":"freshman","label":"Freshman"},{"value":"sophomore","label":"Sophomore"},{"value":"junior","label":"Junior"},{"value":"senior","label":"Senior"},{"value":"graduate","label":"Graduate"}]',
 'Alumni', 'Roster', 'Recruiting Class');
PRINT 'team_config seeded';
GO

-- ─── 6. Re-link mswalsh68 ────────────────────────────────────────────────────
DECLARE @uid UNIQUEIDENTIFIER = (SELECT id FROM dbo.users WHERE email = 'mswalsh68@gmail.com');
IF @uid IS NOT NULL
BEGIN
  INSERT INTO dbo.user_teams (user_id, team_id, is_active)
  SELECT @uid, t.id, 1 FROM dbo.teams t
  WHERE NOT EXISTS (SELECT 1 FROM dbo.user_teams ut WHERE ut.user_id = @uid AND ut.team_id = t.id);
  PRINT 'mswalsh68 linked to teams';
END
ELSE PRINT 'WARNING: mswalsh68@gmail.com not found';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT id, name, abbr, app_db FROM dbo.teams ORDER BY id;
SELECT team_id, team_name, team_abbr FROM dbo.team_config ORDER BY team_id;
SELECT ut.user_id, u.email, ut.team_id, t.name
FROM dbo.user_teams ut
JOIN dbo.users u ON u.id = ut.user_id
JOIN dbo.teams t ON t.id = ut.team_id;

-- Confirm column types are all INT now
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME IN ('team_id', 'preferred_team_id')
  AND TABLE_NAME IN ('user_teams','team_config','invite_codes','access_requests','user_team_preferences')
ORDER BY TABLE_NAME;

PRINT '=== 021_repair3 complete ===';
GO
