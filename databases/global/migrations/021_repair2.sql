-- ============================================================
-- 021_repair2.sql
-- Completes the migration after 021_repair.sql partial failure.
-- Run on: LegacyLinkGlobal ONLY
-- ============================================================
-- Current state going into this script:
--   teams         — INT IDENTITY PK exists, but table is EMPTY
--   user_teams    — team_id still UNIQUEIDENTIFIER; IX_user_teams_team_id exists
--   team_config   — team_id still UNIQUEIDENTIFIER; id column still exists; empty
--   invite_codes / access_requests / user_team_preferences — likely INT already
--   All FKs referencing teams are dropped
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 1. Drop IX_user_teams_team_id so ALTER COLUMN can run ───────────────────
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_teams_team_id' AND object_id = OBJECT_ID('dbo.user_teams'))
BEGIN
  DROP INDEX IX_user_teams_team_id ON dbo.user_teams;
  PRINT 'Dropped IX_user_teams_team_id';
END
GO

-- ─── 2. Fix user_teams.team_id → INT ─────────────────────────────────────────
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.user_teams') AND name = 'team_id'
    AND system_type_id = 36  -- uniqueidentifier
)
BEGIN
  ALTER TABLE dbo.user_teams ALTER COLUMN team_id INT NOT NULL;
  PRINT 'Altered user_teams.team_id to INT';
END
ELSE
  PRINT 'user_teams.team_id already INT';
GO

-- ─── 3. Fix team_config ───────────────────────────────────────────────────────

-- Drop DEFAULT on id if it still exists
DECLARE @def NVARCHAR(200);
SELECT @def = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.team_config') AND c.name = 'id';
IF @def IS NOT NULL
BEGIN
  EXEC(N'ALTER TABLE dbo.team_config DROP CONSTRAINT [' + @def + N']');
  PRINT 'Dropped DEFAULT on team_config.id';
END

-- Drop id column
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.team_config') AND name = 'id')
BEGIN
  ALTER TABLE dbo.team_config DROP COLUMN id;
  PRINT 'Dropped team_config.id';
END

-- Alter team_id to INT NOT NULL and make it PK
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.team_config') AND name = 'team_id'
    AND system_type_id = 36  -- still uniqueidentifier
)
BEGIN
  ALTER TABLE dbo.team_config ALTER COLUMN team_id INT NOT NULL;
  PRINT 'Altered team_config.team_id to INT';
END
ELSE
BEGIN
  -- Already INT — just make NOT NULL
  ALTER TABLE dbo.team_config ALTER COLUMN team_id INT NOT NULL;
  PRINT 'Set team_config.team_id NOT NULL';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'PK_team_config' AND parent_object_id = OBJECT_ID('dbo.team_config'))
BEGIN
  ALTER TABLE dbo.team_config ADD CONSTRAINT PK_team_config PRIMARY KEY (team_id);
  PRINT 'Added PK_team_config';
END
GO

-- ─── 4. Ensure invite_codes / access_requests / user_team_preferences are INT ─

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.invite_codes')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.invite_codes ALTER COLUMN team_id INT NOT NULL;
  PRINT 'Altered invite_codes.team_id to INT';
END

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.access_requests')
           AND name = 'team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.access_requests ALTER COLUMN team_id INT NOT NULL;
  PRINT 'Altered access_requests.team_id to INT';
END

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.user_team_preferences')
           AND name = 'preferred_team_id' AND system_type_id = 36)
BEGIN
  ALTER TABLE dbo.user_team_preferences ALTER COLUMN preferred_team_id INT NOT NULL;
  PRINT 'Altered user_team_preferences.preferred_team_id to INT';
END
GO

-- ─── 5. Re-add FK constraints ─────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_teams_teams')
  ALTER TABLE dbo.user_teams ADD CONSTRAINT FK_user_teams_teams
    FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_user_team' AND parent_object_id = OBJECT_ID('dbo.user_teams'))
  ALTER TABLE dbo.user_teams ADD CONSTRAINT UQ_user_team UNIQUE (user_id, team_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_team_config_teams')
  ALTER TABLE dbo.team_config ADD CONSTRAINT FK_team_config_teams
    FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_invite_codes_teams')
  ALTER TABLE dbo.invite_codes ADD CONSTRAINT FK_invite_codes_teams
    FOREIGN KEY (team_id) REFERENCES dbo.teams(id) ON DELETE CASCADE;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_access_requests_teams')
  ALTER TABLE dbo.access_requests ADD CONSTRAINT FK_access_requests_teams
    FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_utp_team')
  ALTER TABLE dbo.user_team_preferences ADD CONSTRAINT FK_utp_team
    FOREIGN KEY (preferred_team_id) REFERENCES dbo.teams(id);

PRINT 'FK constraints re-added';
GO

-- Re-create indexes (skip if already exist)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_teams_team_id' AND object_id = OBJECT_ID('dbo.user_teams'))
  CREATE INDEX IX_user_teams_team_id ON dbo.user_teams(team_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_invite_codes_team_id' AND object_id = OBJECT_ID('dbo.invite_codes'))
  CREATE INDEX IX_invite_codes_team_id ON dbo.invite_codes(team_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_access_requests_team_id' AND object_id = OBJECT_ID('dbo.access_requests'))
  CREATE INDEX IX_access_requests_team_id ON dbo.access_requests(team_id);
PRINT 'Indexes re-created';
GO

-- ─── 6. Re-insert teams (hard-coded — no temp table needed) ──────────────────
-- Teams table is empty with INT IDENTITY PK already in place.

SET IDENTITY_INSERT dbo.teams ON;

IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = 1)
  INSERT INTO dbo.teams (id, name, abbr, app_db, db_server, tier_id, level_id, is_active)
  VALUES (1, 'Legacy Link', 'LLHQ', 'LegacyLinkApp', 'localhost\SQLEXPRESS', 1, 1, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = 2)
  INSERT INTO dbo.teams (id, name, abbr, app_db, db_server, tier_id, level_id, is_active)
  VALUES (2, 'USF Bulls', 'USF', 'LegacyLinkApp', 'localhost\SQLEXPRESS', 1, 1, 1);

SET IDENTITY_INSERT dbo.teams OFF;
PRINT 'Teams re-inserted';
GO

-- ─── 7. Re-seed team_config ───────────────────────────────────────────────────

DELETE FROM dbo.team_config;

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

PRINT 'team_config re-seeded';
GO

-- ─── 8. Re-link mswalsh68 to both teams ──────────────────────────────────────

DECLARE @uid UNIQUEIDENTIFIER = (SELECT id FROM dbo.users WHERE email = 'mswalsh68@gmail.com');

IF @uid IS NOT NULL
BEGIN
  INSERT INTO dbo.user_teams (user_id, team_id, is_active)
  SELECT @uid, t.id, 1 FROM dbo.teams t
  WHERE NOT EXISTS (SELECT 1 FROM dbo.user_teams ut WHERE ut.user_id = @uid AND ut.team_id = t.id);
  PRINT 'mswalsh68 linked to teams';
END
ELSE
  PRINT 'WARNING: mswalsh68@gmail.com not found';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT id, name, abbr, app_db, tier_id, level_id, is_active FROM dbo.teams ORDER BY id;
SELECT team_id, team_name, team_abbr FROM dbo.team_config ORDER BY team_id;
SELECT ut.user_id, u.email, ut.team_id, t.name AS team_name
FROM dbo.user_teams ut
JOIN dbo.users u ON u.id = ut.user_id
JOIN dbo.teams t ON t.id = ut.team_id;

PRINT '=== 021_repair2 complete ===';
GO
