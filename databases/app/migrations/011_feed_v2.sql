-- ============================================================
-- App DB — Migration 011: Feed V2
-- Run this file on: the tenant App DB (e.g. LegacyLinkApp)
-- Run after: 010_outreach_resend_tracking.sql
-- ============================================================
-- Changes:
--   1. Creates dbo.feed_post_likes (likes/unlike tracking)
--   2. Adds is_deleted, deleted_at, updated_at to dbo.feed_posts
--      (soft delete + edit timestamp)
--   3. Migrates existing audience values to the new two-value model:
--      all_sports | sport_specific
-- ============================================================

-- ── 1. Likes table ────────────────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM sys.tables WHERE name = 'feed_post_likes' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE dbo.feed_post_likes (
    id       INT IDENTITY(1,1)  NOT NULL,
    post_id  UNIQUEIDENTIFIER   NOT NULL REFERENCES dbo.feed_posts(id),
    user_id  INT                NOT NULL REFERENCES dbo.users(user_id),
    liked_at DATETIME2          NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_feed_post_likes PRIMARY KEY (id),
    CONSTRAINT UQ_feed_post_likes_post_user UNIQUE (post_id, user_id)
  );
END;
GO

-- ── 2. Soft delete + edit tracking columns on feed_posts ──────

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.feed_posts') AND name = 'is_deleted'
)
BEGIN
  ALTER TABLE dbo.feed_posts
    ADD is_deleted BIT       NOT NULL DEFAULT 0,
        deleted_at DATETIME2 NULL,
        updated_at DATETIME2 NULL;
END;
GO

-- ── 3. Audience data migration ────────────────────────────────
-- Old audience values: all, players_only, alumni_only, by_position,
--   by_grad_year, custom
-- New audience values: all_sports | sport_specific
-- All old values collapse to all_sports (no sport-level targeting existed).

UPDATE dbo.feed_posts
  SET audience = 'all_sports'
  WHERE audience IN (
    'all', 'players_only', 'alumni_only',
    'by_position', 'by_grad_year', 'custom'
  );
GO
