-- ============================================================
-- 020_feed_audience_targeting.sql
-- Converts feed_posts role/tier string columns to integer IDs
-- and adds target_program_role_id for audience targeting.
--
-- Run on: each tenant App DB
-- Run after: 019_drop_username_from_users_sports.sql
--
-- Changes:
--   1. Add target_program_role_id INT NULL FK -> dbo.program_role(id)
--   2. Add target_tier_id INT NULL (matches teams.tier_id: 1=starter 2=pro 3=enterprise)
--   3. Backfill target_program_role_id from role_group string
--   4. Backfill target_tier_id from tier_group string
--   5. Drop role_group column
--   6. Drop tier_group column
-- ============================================================

USE LegacyLinkApp;
GO

-- ── Step 1: Add target_program_role_id ───────────────────────────────────────

IF COL_LENGTH('dbo.feed_posts', 'target_program_role_id') IS NULL
BEGIN
  ALTER TABLE dbo.feed_posts ADD target_program_role_id INT NULL;
  PRINT '020: Added dbo.feed_posts.target_program_role_id';
END
ELSE PRINT '020: target_program_role_id already exists — skipped';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_feed_posts_program_role')
BEGIN
  ALTER TABLE dbo.feed_posts
    ADD CONSTRAINT FK_feed_posts_program_role
      FOREIGN KEY (target_program_role_id) REFERENCES dbo.program_role(id);
  PRINT '020: Added FK_feed_posts_program_role';
END
GO

-- ── Step 2: Add target_tier_id ────────────────────────────────────────────────

IF COL_LENGTH('dbo.feed_posts', 'target_tier_id') IS NULL
BEGIN
  ALTER TABLE dbo.feed_posts ADD target_tier_id INT NULL;
  PRINT '020: Added dbo.feed_posts.target_tier_id';
END
ELSE PRINT '020: target_tier_id already exists — skipped';
GO

-- ── Step 3: Backfill target_program_role_id from role_group ──────────────────
-- role_group values in use: 'player' -> 8, 'alumni' -> 7, 'admin' -> NULL

IF COL_LENGTH('dbo.feed_posts', 'role_group') IS NOT NULL
BEGIN
  UPDATE dbo.feed_posts
  SET target_program_role_id = CASE role_group
    WHEN 'player' THEN 8
    WHEN 'alumni' THEN 7
    ELSE NULL  -- 'admin' and any other values -> NULL (visible to all-sports viewers)
  END
  WHERE target_program_role_id IS NULL AND role_group IS NOT NULL;
  PRINT CONCAT('020: Backfilled target_program_role_id for ', @@ROWCOUNT, ' row(s) from role_group');
END
GO

-- ── Step 4: Backfill target_tier_id from tier_group ──────────────────────────
-- tier_group values: 'starter' -> 1, 'pro' -> 2, 'enterprise' -> 3

IF COL_LENGTH('dbo.feed_posts', 'tier_group') IS NOT NULL
BEGIN
  UPDATE dbo.feed_posts
  SET target_tier_id = CASE tier_group
    WHEN 'starter'    THEN 1
    WHEN 'pro'        THEN 2
    WHEN 'enterprise' THEN 3
    ELSE NULL
  END
  WHERE target_tier_id IS NULL AND tier_group IS NOT NULL;
  PRINT CONCAT('020: Backfilled target_tier_id for ', @@ROWCOUNT, ' row(s) from tier_group');
END
GO

-- ── Step 5: Drop role_group ───────────────────────────────────────────────────

IF COL_LENGTH('dbo.feed_posts', 'role_group') IS NOT NULL
BEGIN
  -- Drop any default constraint dynamically
  DECLARE @RoleGroupDefault NVARCHAR(200);
  SELECT @RoleGroupDefault = dc.name
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.default_object_id = dc.object_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.feed_posts') AND c.name = 'role_group';
  IF @RoleGroupDefault IS NOT NULL
    EXEC ('ALTER TABLE dbo.feed_posts DROP CONSTRAINT [' + @RoleGroupDefault + ']');

  ALTER TABLE dbo.feed_posts DROP COLUMN role_group;
  PRINT '020: Dropped dbo.feed_posts.role_group';
END
ELSE PRINT '020: role_group already gone — skipped';
GO

-- ── Step 6: Drop tier_group ───────────────────────────────────────────────────

IF COL_LENGTH('dbo.feed_posts', 'tier_group') IS NOT NULL
BEGIN
  DECLARE @TierGroupDefault NVARCHAR(200);
  SELECT @TierGroupDefault = dc.name
  FROM sys.default_constraints dc
  JOIN sys.columns c ON c.default_object_id = dc.object_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.feed_posts') AND c.name = 'tier_group';
  IF @TierGroupDefault IS NOT NULL
    EXEC ('ALTER TABLE dbo.feed_posts DROP CONSTRAINT [' + @TierGroupDefault + ']');

  ALTER TABLE dbo.feed_posts DROP COLUMN tier_group;
  PRINT '020: Dropped dbo.feed_posts.tier_group';
END
ELSE PRINT '020: tier_group already gone — skipped';
GO

-- ── Verification ──────────────────────────────────────────────────────────────

SELECT
  fp.id,
  fp.audience,
  fp.is_welcome_post    AS isWelcomePost,
  fp.target_program_role_id AS targetProgramRoleId,
  pr.display_name       AS targetRole,
  fp.target_tier_id     AS targetTierId,
  fp.is_deleted
FROM dbo.feed_posts fp
LEFT JOIN dbo.program_role pr ON pr.id = fp.target_program_role_id
ORDER BY fp.is_welcome_post DESC, fp.published_at DESC;

IF COL_LENGTH('dbo.feed_posts', 'role_group') IS NULL PRINT 'PASS: role_group dropped';
IF COL_LENGTH('dbo.feed_posts', 'tier_group') IS NULL PRINT 'PASS: tier_group dropped';
IF COL_LENGTH('dbo.feed_posts', 'target_program_role_id') IS NOT NULL PRINT 'PASS: target_program_role_id added';
IF COL_LENGTH('dbo.feed_posts', 'target_tier_id') IS NOT NULL PRINT 'PASS: target_tier_id added';
PRINT '=== Migration 020 complete ===';
GO
