-- ============================================================
-- 006_bigint_user_ids.sql
-- Run on: LegacyLinkApp (and every tenant App DB)
-- Requires: 024_bigint_user_pk.sql to have run on Global DB
-- ============================================================
-- The Global DB users table now uses BIGINT for user_id (was INT).
-- This migration updates the two App DB columns that stored the old
-- UNIQUEIDENTIFIER JWT sub as a creator reference:
--   dbo.outreach_campaigns.created_by  UNIQUEIDENTIFIER → INT
--   dbo.feed_posts.created_by          UNIQUEIDENTIFIER → INT
-- All other App DB user FKs (user_id INT) are unchanged — INT is
-- assignment-compatible with BIGINT and all user_id values are small.
-- ============================================================

USE LegacyLinkApp
GO

-- ─── 1. outreach_campaigns.created_by ────────────────────────────────────────
IF COL_LENGTH('dbo.outreach_campaigns', 'created_by') IS NOT NULL
BEGIN
  DECLARE @col_type_oc NVARCHAR(50);
  SELECT @col_type_oc = tp.name
  FROM   sys.columns c
  JOIN   sys.types   tp ON tp.user_type_id = c.user_type_id
  WHERE  c.object_id = OBJECT_ID('dbo.outreach_campaigns')
    AND  c.name      = 'created_by';

  IF @col_type_oc = 'uniqueidentifier'
  BEGIN
    -- Drop any FK or default constraint on the column first
    DECLARE @oc_constraint NVARCHAR(200) = NULL;
    SELECT TOP 1 @oc_constraint = dc.name
    FROM   sys.default_constraints dc
    JOIN   sys.columns c ON c.default_object_id = dc.object_id
    WHERE  c.object_id = OBJECT_ID('dbo.outreach_campaigns')
      AND  c.name      = 'created_by';
    IF @oc_constraint IS NOT NULL
      EXEC(N'ALTER TABLE dbo.outreach_campaigns DROP CONSTRAINT [' + @oc_constraint + N']');

    -- Clear stale GUID values (dev env — no real data to preserve)
    UPDATE dbo.outreach_campaigns SET created_by = NULL;

    ALTER TABLE dbo.outreach_campaigns ALTER COLUMN created_by INT NULL;
    PRINT 'Altered outreach_campaigns.created_by: UNIQUEIDENTIFIER → INT';
  END
  ELSE
    PRINT 'outreach_campaigns.created_by already INT — skipped';
END
ELSE
  PRINT 'outreach_campaigns.created_by column not found — skipped';
GO

-- ─── 2. feed_posts.created_by ────────────────────────────────────────────────
IF COL_LENGTH('dbo.feed_posts', 'created_by') IS NOT NULL
BEGIN
  DECLARE @col_type_fp NVARCHAR(50);
  SELECT @col_type_fp = tp.name
  FROM   sys.columns c
  JOIN   sys.types   tp ON tp.user_type_id = c.user_type_id
  WHERE  c.object_id = OBJECT_ID('dbo.feed_posts')
    AND  c.name      = 'created_by';

  IF @col_type_fp = 'uniqueidentifier'
  BEGIN
    DECLARE @fp_constraint NVARCHAR(200) = NULL;
    SELECT TOP 1 @fp_constraint = dc.name
    FROM   sys.default_constraints dc
    JOIN   sys.columns c ON c.default_object_id = dc.object_id
    WHERE  c.object_id = OBJECT_ID('dbo.feed_posts')
      AND  c.name      = 'created_by';
    IF @fp_constraint IS NOT NULL
      EXEC(N'ALTER TABLE dbo.feed_posts DROP CONSTRAINT [' + @fp_constraint + N']');

    UPDATE dbo.feed_posts SET created_by = NULL;

    ALTER TABLE dbo.feed_posts ALTER COLUMN created_by INT NULL;
    PRINT 'Altered feed_posts.created_by: UNIQUEIDENTIFIER → INT';
  END
  ELSE
    PRINT 'feed_posts.created_by already INT — skipped';
END
ELSE
  PRINT 'feed_posts.created_by column not found — skipped';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT c.name AS column_name, tp.name AS data_type, c.is_nullable
FROM   sys.columns c
JOIN   sys.types   tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id IN (OBJECT_ID('dbo.outreach_campaigns'), OBJECT_ID('dbo.feed_posts'))
  AND  c.name = 'created_by'
ORDER  BY OBJECT_NAME(c.object_id), c.column_id;

PRINT '=== 006_bigint_user_ids complete ===';
GO
