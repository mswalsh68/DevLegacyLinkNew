-- ============================================================
-- 006_bigint_user_ids.sql
-- Run on: LegacyLinkApp (and every tenant App DB)
-- Requires: 024_bigint_user_pk.sql to have run on Global DB
-- ============================================================
-- SQL Server does not allow ALTER COLUMN from UNIQUEIDENTIFIER to INT directly.
-- We use the add-new / drop-old / rename pattern instead.
--
-- Columns changed:
--   dbo.outreach_campaigns.created_by  UNIQUEIDENTIFIER → INT NULL
--   dbo.feed_posts.created_by          UNIQUEIDENTIFIER → INT NULL
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
    -- Drop any default constraint on the old column
    DECLARE @oc_constraint NVARCHAR(200) = NULL;
    SELECT TOP 1 @oc_constraint = dc.name
    FROM   sys.default_constraints dc
    JOIN   sys.columns c ON c.default_object_id = dc.object_id
    WHERE  c.object_id = OBJECT_ID('dbo.outreach_campaigns')
      AND  c.name      = 'created_by';
    IF @oc_constraint IS NOT NULL
      EXEC(N'ALTER TABLE dbo.outreach_campaigns DROP CONSTRAINT [' + @oc_constraint + N']');

    -- Add replacement INT column, drop old, rename
    ALTER TABLE dbo.outreach_campaigns ADD created_by_int INT NULL;
    ALTER TABLE dbo.outreach_campaigns DROP COLUMN created_by;
    EXEC sp_rename 'dbo.outreach_campaigns.created_by_int', 'created_by', 'COLUMN';
    PRINT 'Altered outreach_campaigns.created_by: UNIQUEIDENTIFIER → INT NULL';
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
    -- Drop any default constraint on the old column
    DECLARE @fp_constraint NVARCHAR(200) = NULL;
    SELECT TOP 1 @fp_constraint = dc.name
    FROM   sys.default_constraints dc
    JOIN   sys.columns c ON c.default_object_id = dc.object_id
    WHERE  c.object_id = OBJECT_ID('dbo.feed_posts')
      AND  c.name      = 'created_by';
    IF @fp_constraint IS NOT NULL
      EXEC(N'ALTER TABLE dbo.feed_posts DROP CONSTRAINT [' + @fp_constraint + N']');

    -- Add replacement INT column, drop old, rename
    -- Dev data in created_by is stale GUIDs — no value to preserve
    ALTER TABLE dbo.feed_posts ADD created_by_int INT NULL;
    ALTER TABLE dbo.feed_posts DROP COLUMN created_by;
    EXEC sp_rename 'dbo.feed_posts.created_by_int', 'created_by', 'COLUMN';
    PRINT 'Altered feed_posts.created_by: UNIQUEIDENTIFIER → INT NULL';
  END
  ELSE
    PRINT 'feed_posts.created_by already INT — skipped';
END
ELSE
  PRINT 'feed_posts.created_by column not found — skipped';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT OBJECT_NAME(c.object_id) AS table_name, c.name AS column_name,
       tp.name AS data_type, c.is_nullable
FROM   sys.columns c
JOIN   sys.types   tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id IN (OBJECT_ID('dbo.outreach_campaigns'), OBJECT_ID('dbo.feed_posts'))
  AND  c.name = 'created_by'
ORDER  BY table_name;

PRINT '=== 006_bigint_user_ids complete ===';
GO
