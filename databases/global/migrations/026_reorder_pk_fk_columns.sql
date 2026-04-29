-- ============================================================
-- Migration 026: Reorder columns — PK/FK first on teams + team_config
-- Run on: LegacyLinkGlobal database
-- Run after: 025_drop_teams_db_server.sql
-- ============================================================
-- SQL Server does not support reordering columns in-place.
-- Both tables are rebuilt using the backup / drop / recreate / restore pattern.
--
-- teams:
--   Before: name, abbr, app_db, is_active, created_at, expires_at,
--           tier_id (FK), level_id (FK), id (PK)
--   After:  id (PK), tier_id (FK), level_id (FK),
--           name, abbr, app_db, is_active, created_at, expires_at
--
-- team_config:
--   Before: team_name, team_abbr, sport, level, logo_url, colors...,
--           positions_json, academic_years_json, labels...,
--           created_at, updated_at, email_*, team_id (PK+FK — at end)
--   After:  team_id (PK+FK), team_name, team_abbr, sport, level, logo_url,
--           colors..., positions_json, academic_years_json, labels...,
--           created_at, updated_at, email_*
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 0. Back up both tables ───────────────────────────────────────────────────

IF OBJECT_ID('tempdb..#TeamsData')      IS NOT NULL DROP TABLE #TeamsData;
IF OBJECT_ID('tempdb..#TeamConfigData') IS NOT NULL DROP TABLE #TeamConfigData;

SELECT id, tier_id, level_id, name, abbr, app_db, is_active, created_at, expires_at
INTO   #TeamsData
FROM   dbo.teams;
PRINT CONCAT('Backed up ', @@ROWCOUNT, ' teams row(s)');
GO

SELECT
  team_id, team_name, team_abbr, sport, level, logo_url,
  color_primary, color_primary_dark, color_primary_light,
  color_accent,  color_accent_dark,  color_accent_light,
  positions_json, academic_years_json,
  alumni_label, roster_label, class_label,
  created_at, updated_at,
  email_from_address, email_from_name, email_reply_to,
  email_physical_address, email_daily_send_limit, email_monthly_send_limit
INTO   #TeamConfigData
FROM   dbo.team_config;
PRINT CONCAT('Backed up ', @@ROWCOUNT, ' team_config row(s)');
GO

-- ─── 1. Drop FK constraints that reference dbo.teams(id) ─────────────────────
-- Dynamically drop every FK pointing at teams so we don't hard-code names

DECLARE @DropFKs NVARCHAR(MAX) = N'';
SELECT @DropFKs += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
    + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
    + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.teams');
IF LEN(@DropFKs) > 0
BEGIN
  EXEC sp_executesql @DropFKs;
  PRINT 'Dropped all FK constraints referencing dbo.teams';
END
ELSE
  PRINT 'No FK constraints referencing dbo.teams — nothing to drop';
GO

-- ─── 2. Drop team_config (PK is team_id; no child tables) ────────────────────

IF OBJECT_ID('dbo.team_config', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.team_config;
  PRINT 'Dropped dbo.team_config';
END
GO

-- ─── 3. Drop dbo.teams ───────────────────────────────────────────────────────

IF OBJECT_ID('dbo.teams', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.teams;
  PRINT 'Dropped dbo.teams';
END
GO

-- ─── 4. Recreate dbo.teams — id (PK) first, FKs next ────────────────────────

CREATE TABLE dbo.teams (
  id          INT           NOT NULL IDENTITY(1,1)
                CONSTRAINT PK_teams PRIMARY KEY,
  tier_id     INT           NOT NULL DEFAULT 1
                CONSTRAINT FK_teams_tier_id  REFERENCES dbo.tiers(id),
  level_id    INT           NOT NULL DEFAULT 1
                CONSTRAINT FK_teams_level_id REFERENCES dbo.levels(id),
  name        NVARCHAR(100) NOT NULL,
  abbr        NVARCHAR(10)  NOT NULL CONSTRAINT UQ_teams_abbr UNIQUE,
  app_db      NVARCHAR(150) NOT NULL,
  is_active   BIT           NOT NULL DEFAULT 1,
  created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  expires_at  DATETIME2     NULL
);

CREATE INDEX IX_teams_is_active ON dbo.teams(is_active);
PRINT 'Created dbo.teams (id PK first)';
GO

-- ─── 5. Restore teams rows (preserve INT ids) ────────────────────────────────

SET IDENTITY_INSERT dbo.teams ON;

INSERT INTO dbo.teams (id, tier_id, level_id, name, abbr, app_db, is_active, created_at, expires_at)
SELECT                  id, tier_id, level_id, name, abbr, app_db, is_active, created_at, expires_at
FROM   #TeamsData;

SET IDENTITY_INSERT dbo.teams OFF;
PRINT CONCAT('Restored ', @@ROWCOUNT, ' teams row(s)');
GO

-- ─── 6. Recreate dbo.team_config — team_id (PK+FK) first ────────────────────

CREATE TABLE dbo.team_config (
  team_id                INT           NOT NULL
                           CONSTRAINT PK_team_config        PRIMARY KEY
                           CONSTRAINT FK_team_config_teams  REFERENCES dbo.teams(id) ON DELETE CASCADE,
  team_name              NVARCHAR(100) NOT NULL DEFAULT 'Team Portal',
  team_abbr              NVARCHAR(10)  NOT NULL DEFAULT 'TEAM',
  sport                  NVARCHAR(50)  NOT NULL DEFAULT 'football',
  level                  NVARCHAR(20)  NOT NULL DEFAULT 'college'
                           CHECK (level IN ('college', 'high_school', 'club')),
  logo_url               NVARCHAR(500) NULL,
  color_primary          NVARCHAR(7)   NOT NULL DEFAULT '#006747',
  color_primary_dark     NVARCHAR(7)   NOT NULL DEFAULT '#005432',
  color_primary_light    NVARCHAR(7)   NOT NULL DEFAULT '#E0F0EA',
  color_accent           NVARCHAR(7)   NOT NULL DEFAULT '#CFC493',
  color_accent_dark      NVARCHAR(7)   NOT NULL DEFAULT '#A89C6A',
  color_accent_light     NVARCHAR(7)   NOT NULL DEFAULT '#EDEBD1',
  positions_json         NVARCHAR(MAX) NULL,
  academic_years_json    NVARCHAR(MAX) NULL,
  alumni_label           NVARCHAR(50)  NOT NULL DEFAULT 'Alumni',
  roster_label           NVARCHAR(50)  NOT NULL DEFAULT 'Roster',
  class_label            NVARCHAR(50)  NOT NULL DEFAULT 'Recruiting Class',
  created_at             DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at             DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  email_from_address     NVARCHAR(255) NULL,
  email_from_name        NVARCHAR(200) NULL,
  email_reply_to         NVARCHAR(255) NULL,
  email_physical_address NVARCHAR(500) NULL,
  email_daily_send_limit INT           NOT NULL DEFAULT 500,
  email_monthly_send_limit INT         NOT NULL DEFAULT 5000
);

PRINT 'Created dbo.team_config (team_id PK first)';
GO

-- ─── 7. Restore team_config rows ─────────────────────────────────────────────

INSERT INTO dbo.team_config (
  team_id, team_name, team_abbr, sport, level, logo_url,
  color_primary, color_primary_dark, color_primary_light,
  color_accent,  color_accent_dark,  color_accent_light,
  positions_json, academic_years_json,
  alumni_label, roster_label, class_label,
  created_at, updated_at,
  email_from_address, email_from_name, email_reply_to,
  email_physical_address, email_daily_send_limit, email_monthly_send_limit
)
SELECT
  team_id, team_name, team_abbr, sport, level, logo_url,
  color_primary, color_primary_dark, color_primary_light,
  color_accent,  color_accent_dark,  color_accent_light,
  positions_json, academic_years_json,
  alumni_label, roster_label, class_label,
  created_at, updated_at,
  email_from_address, email_from_name, email_reply_to,
  email_physical_address, email_daily_send_limit, email_monthly_send_limit
FROM #TeamConfigData;
PRINT CONCAT('Restored ', @@ROWCOUNT, ' team_config row(s)');
GO

-- ─── 8. Re-add FK constraints on child tables ────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_teams_teams')
  ALTER TABLE dbo.user_teams ADD CONSTRAINT FK_user_teams_teams
    FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_invite_codes_teams')
  ALTER TABLE dbo.invite_codes ADD CONSTRAINT FK_invite_codes_teams
    FOREIGN KEY (team_id) REFERENCES dbo.teams(id) ON DELETE CASCADE;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ar_team')
  ALTER TABLE dbo.access_requests ADD CONSTRAINT FK_ar_team
    FOREIGN KEY (team_id) REFERENCES dbo.teams(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_utp_team')
  ALTER TABLE dbo.user_team_preferences ADD CONSTRAINT FK_utp_team
    FOREIGN KEY (preferred_team_id) REFERENCES dbo.teams(id);

PRINT 'Re-added FK constraints on child tables';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────

SELECT c.column_id, c.name, tp.name AS data_type, c.is_nullable
FROM   sys.columns c
JOIN   sys.types   tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id = OBJECT_ID('dbo.teams')
ORDER  BY c.column_id;

SELECT c.column_id, c.name, tp.name AS data_type, c.is_nullable
FROM   sys.columns c
JOIN   sys.types   tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id = OBJECT_ID('dbo.team_config')
ORDER  BY c.column_id;

PRINT '=== Migration 026 complete ===';
GO
