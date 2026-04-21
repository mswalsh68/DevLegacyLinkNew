-- ============================================================
-- Migration 014: Tiers & Levels Lookup Tables
-- Replaces free-text subscription_tier and level columns on
-- dbo.teams with FK references to new ID-based lookup tables.
-- Removes sport column from dbo.teams (sport lives in AppDB).
-- Run on: DevLegacyLinkGlobal
-- Run after: 013_team_config_email.sql
-- ============================================================

-- ─── 1. Create dbo.tiers lookup table ────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'tiers' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.tiers (
    id           INT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    name         NVARCHAR(20) NOT NULL,   -- 'starter', 'pro', 'enterprise'
    display_name NVARCHAR(50) NOT NULL,   -- 'Starter', 'Pro', 'Enterprise'
    sort_order   INT          NOT NULL DEFAULT 0,
    is_active    BIT          NOT NULL DEFAULT 1,
    CONSTRAINT UQ_tiers_name UNIQUE (name)
  );

  SET IDENTITY_INSERT dbo.tiers ON;
  INSERT INTO dbo.tiers (id, name, display_name, sort_order) VALUES
    (1, 'starter',    'Starter',    1),
    (2, 'pro',        'Pro',        2),
    (3, 'enterprise', 'Enterprise', 3);
  SET IDENTITY_INSERT dbo.tiers OFF;

  PRINT 'Created dbo.tiers and seeded 3 rows';
END
ELSE
  PRINT 'dbo.tiers already exists — skipping';
GO

-- ─── 2. Create dbo.levels lookup table ───────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'levels' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.levels (
    id           INT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
    name         NVARCHAR(30) NOT NULL,   -- 'college', 'high_school', 'club'
    display_name NVARCHAR(50) NOT NULL,   -- 'College', 'High School', 'Club'
    sort_order   INT          NOT NULL DEFAULT 0,
    is_active    BIT          NOT NULL DEFAULT 1,
    CONSTRAINT UQ_levels_name UNIQUE (name)
  );

  SET IDENTITY_INSERT dbo.levels ON;
  INSERT INTO dbo.levels (id, name, display_name, sort_order) VALUES
    (1, 'college',     'College',     1),
    (2, 'high_school', 'High School', 2),
    (3, 'club',        'Club',        3);
  SET IDENTITY_INSERT dbo.levels OFF;

  PRINT 'Created dbo.levels and seeded 3 rows';
END
ELSE
  PRINT 'dbo.levels already exists — skipping';
GO

-- ─── 3. Add tier_id to dbo.teams ─────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.teams') AND name = 'tier_id')
BEGIN
  ALTER TABLE dbo.teams ADD tier_id INT NULL;
  PRINT 'Added tier_id column to dbo.teams';
END
GO

-- Populate from existing subscription_tier text
UPDATE t
SET    t.tier_id = tr.id
FROM   dbo.teams t
JOIN   dbo.tiers tr ON tr.name = t.subscription_tier
WHERE  t.tier_id IS NULL;

-- Default any unmapped rows to starter (id = 1)
UPDATE dbo.teams SET tier_id = 1 WHERE tier_id IS NULL;
PRINT CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' team(s) defaulted to starter tier';
GO

ALTER TABLE dbo.teams ALTER COLUMN tier_id INT NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_teams_tier_id')
  ALTER TABLE dbo.teams ADD CONSTRAINT DF_teams_tier_id DEFAULT 1 FOR tier_id;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_teams_tier_id')
BEGIN
  ALTER TABLE dbo.teams ADD CONSTRAINT FK_teams_tier_id
    FOREIGN KEY (tier_id) REFERENCES dbo.tiers (id);
  PRINT 'Added FK_teams_tier_id';
END
GO

-- ─── 4. Add level_id to dbo.teams ────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.teams') AND name = 'level_id')
BEGIN
  ALTER TABLE dbo.teams ADD level_id INT NULL;
  PRINT 'Added level_id column to dbo.teams';
END
GO

-- Populate from existing level text
UPDATE t
SET    t.level_id = lv.id
FROM   dbo.teams t
JOIN   dbo.levels lv ON lv.name = t.level
WHERE  t.level_id IS NULL;

-- Default any unmapped rows to college (id = 1)
UPDATE dbo.teams SET level_id = 1 WHERE level_id IS NULL;
PRINT CAST(@@ROWCOUNT AS NVARCHAR(10)) + ' team(s) defaulted to college level';
GO

ALTER TABLE dbo.teams ALTER COLUMN level_id INT NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_teams_level_id')
  ALTER TABLE dbo.teams ADD CONSTRAINT DF_teams_level_id DEFAULT 1 FOR level_id;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_teams_level_id')
BEGIN
  ALTER TABLE dbo.teams ADD CONSTRAINT FK_teams_level_id
    FOREIGN KEY (level_id) REFERENCES dbo.levels (id);
  PRINT 'Added FK_teams_level_id';
END
GO

-- ─── 5. Drop old text columns from dbo.teams ─────────────────
-- Each column may have a system-named DEFAULT constraint and/or a
-- CHECK constraint. Both must be dropped before the column can be dropped.

-- subscription_tier
DECLARE @con NVARCHAR(200);
-- DEFAULT constraint
SELECT @con = dc.name
FROM   sys.default_constraints dc
JOIN   sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE  dc.parent_object_id = OBJECT_ID('dbo.teams') AND c.name = 'subscription_tier';
IF @con IS NOT NULL EXEC(N'ALTER TABLE dbo.teams DROP CONSTRAINT [' + @con + N']');
-- CHECK constraint
SELECT @con = cc.name
FROM   sys.check_constraints cc
JOIN   sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
WHERE  cc.parent_object_id = OBJECT_ID('dbo.teams') AND c.name = 'subscription_tier';
IF @con IS NOT NULL EXEC(N'ALTER TABLE dbo.teams DROP CONSTRAINT [' + @con + N']');
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.teams') AND name = 'subscription_tier')
BEGIN
  ALTER TABLE dbo.teams DROP COLUMN subscription_tier;
  PRINT 'Dropped subscription_tier column';
END
GO

-- level
DECLARE @con2 NVARCHAR(200);
-- DEFAULT constraint
SELECT @con2 = dc.name
FROM   sys.default_constraints dc
JOIN   sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE  dc.parent_object_id = OBJECT_ID('dbo.teams') AND c.name = 'level';
IF @con2 IS NOT NULL EXEC(N'ALTER TABLE dbo.teams DROP CONSTRAINT [' + @con2 + N']');
-- CHECK constraint
SELECT @con2 = cc.name
FROM   sys.check_constraints cc
JOIN   sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
WHERE  cc.parent_object_id = OBJECT_ID('dbo.teams') AND c.name = 'level';
IF @con2 IS NOT NULL EXEC(N'ALTER TABLE dbo.teams DROP CONSTRAINT [' + @con2 + N']');
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.teams') AND name = 'level')
BEGIN
  ALTER TABLE dbo.teams DROP COLUMN level;
  PRINT 'Dropped level column from dbo.teams';
END
GO

-- sport
DECLARE @con3 NVARCHAR(200);
-- DEFAULT constraint
SELECT @con3 = dc.name
FROM   sys.default_constraints dc
JOIN   sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE  dc.parent_object_id = OBJECT_ID('dbo.teams') AND c.name = 'sport';
IF @con3 IS NOT NULL EXEC(N'ALTER TABLE dbo.teams DROP CONSTRAINT [' + @con3 + N']');
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.teams') AND name = 'sport')
BEGIN
  ALTER TABLE dbo.teams DROP COLUMN sport;
  PRINT 'Dropped sport column from dbo.teams';
END
GO

PRINT 'Migration 014 complete';
GO
