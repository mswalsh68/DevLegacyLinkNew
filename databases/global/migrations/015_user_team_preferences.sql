-- ============================================================
-- Migration 015: User Team Preferences
-- Stores each user's preferred default team so that on next
-- login they land in their chosen team rather than the
-- alphabetically-first team.
--
-- Resolution priority at login (unchanged for existing rules):
--   1. Team matching DEFAULT_TEAM_ABBR env var ('LL') if the
--      user belongs to that team — preserves platform-owner
--      and LegacyLink auto-default behaviour.
--   2. preferred_team_id from this table (if set + still valid)
--   3. First team alphabetically (existing fallback)
--
-- Run on: DevLegacyLinkGlobal
-- Run after: 014_tiers_levels_refactor.sql
-- ============================================================

IF NOT EXISTS (
  SELECT * FROM sys.tables
  WHERE name = 'user_team_preferences' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE dbo.user_team_preferences (
    user_id           UNIQUEIDENTIFIER NOT NULL,
    preferred_team_id UNIQUEIDENTIFIER NOT NULL,
    updated_at        DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_user_team_preferences
      PRIMARY KEY (user_id),

    CONSTRAINT FK_utp_user
      FOREIGN KEY (user_id) REFERENCES dbo.users (id) ON DELETE CASCADE,

    CONSTRAINT FK_utp_team
      FOREIGN KEY (preferred_team_id) REFERENCES dbo.teams (id)
  );

  PRINT 'Created dbo.user_team_preferences';
END
ELSE
BEGIN
  PRINT 'dbo.user_team_preferences already exists — skipped';
END
GO
