-- ============================================================
-- 002_add_feed_post_sport.sql
-- Adds sport_id to feed_posts (if not already present) and
-- backfills all existing rows with the football sport.
--
-- Safe to re-run: IF NOT EXISTS guards prevent duplicate work.
--
-- Backfill priority:
--   1. Sport with name LIKE '%football%' (case-insensitive)
--   2. Sport with abbr = 'FB'
--   3. First active sport ordered by created_at
-- ============================================================

-- Step 1: Add column if missing
IF NOT EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.feed_posts')
    AND name      = 'sport_id'
)
BEGIN
  ALTER TABLE dbo.feed_posts
    ADD sport_id UNIQUEIDENTIFIER NULL
      CONSTRAINT fk_feed_posts_sport FOREIGN KEY REFERENCES dbo.sports(id);

  CREATE INDEX idx_feed_posts_sport ON dbo.feed_posts(sport_id);

  PRINT '002: Added sport_id column and index to dbo.feed_posts.';
END
ELSE
BEGIN
  PRINT '002: sport_id column already exists — skipped ALTER.';
END
GO

-- Step 2: Backfill existing NULL sport_id rows with the football sport
DECLARE @FootballId UNIQUEIDENTIFIER;

-- Try: name contains 'football'
SELECT TOP 1 @FootballId = id
FROM dbo.sports
WHERE LOWER(name) LIKE '%football%'
ORDER BY created_at;

-- Fallback: abbr = 'FB'
IF @FootballId IS NULL
BEGIN
  SELECT TOP 1 @FootballId = id
  FROM dbo.sports
  WHERE UPPER(abbr) = 'FB'
  ORDER BY created_at;
END

-- Fallback: first active sport
IF @FootballId IS NULL
BEGIN
  SELECT TOP 1 @FootballId = id
  FROM dbo.sports
  WHERE is_active = 1
  ORDER BY created_at;
END

-- Last resort: any sport
IF @FootballId IS NULL
BEGIN
  SELECT TOP 1 @FootballId = id
  FROM dbo.sports
  ORDER BY created_at;
END

IF @FootballId IS NOT NULL
BEGIN
  -- Exclude welcome posts — they belong to all sports (sport_id stays NULL)
  UPDATE dbo.feed_posts
  SET    sport_id = @FootballId
  WHERE  sport_id IS NULL
    AND  is_welcome_post = 0;

  PRINT '002: Backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR) + ' feed_post row(s) with sport_id ' + CAST(@FootballId AS NVARCHAR(36)) + ' (welcome post excluded).';
END
ELSE
BEGIN
  PRINT '002: No sports found in dbo.sports — skipped backfill. Run this migration again after adding at least one sport.';
END
GO
