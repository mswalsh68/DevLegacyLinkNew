-- ============================================================
-- Migration 009: Outreach + Feed schema alignment post-008 refactor
-- Run on: LegacyLinkApp (and every tenant App DB)
-- Run after: 008_schema_refactor.sql
-- ============================================================
-- Migration 008 dropped dbo.players and dbo.alumni and converted
-- dbo.sports.id from GUID to INT.  Four tables still carried the
-- old shape and need to be updated:
--
--   outreach_campaigns.sport_id   UNIQUEIDENTIFIER → INT
--   feed_posts.sport_id           UNIQUEIDENTIFIER → INT
--   outreach_messages             player_id/alumni_id → user_id INT
--   email_unsubscribes            player_id/alumni_id → user_id INT
--
-- All four tables use the add-new / drop-old / rename pattern.
-- In dev these tables are empty so no data migration is needed.
-- ============================================================

USE LegacyLinkApp
GO

-- ─── 1. outreach_campaigns.sport_id  UNIQUEIDENTIFIER → INT ─────────────────

IF COL_LENGTH('dbo.outreach_campaigns', 'sport_id') IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM sys.columns c
     JOIN   sys.types  t ON t.user_type_id = c.user_type_id
     WHERE  c.object_id = OBJECT_ID('dbo.outreach_campaigns')
       AND  c.name      = 'sport_id'
       AND  t.name      = 'uniqueidentifier'
   )
BEGIN
  -- Drop default constraint if any
  DECLARE @oc_dc NVARCHAR(200);
  SELECT TOP 1 @oc_dc = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.default_object_id = dc.object_id
  WHERE  c.object_id = OBJECT_ID('dbo.outreach_campaigns')
    AND  c.name      = 'sport_id';
  IF @oc_dc IS NOT NULL
    EXEC(N'ALTER TABLE dbo.outreach_campaigns DROP CONSTRAINT [' + @oc_dc + N']');

  -- Drop FK if any
  DECLARE @oc_fk NVARCHAR(MAX) = N'';
  SELECT @oc_fk += N'ALTER TABLE dbo.outreach_campaigns DROP CONSTRAINT '
                 + QUOTENAME(fk.name) + N'; '
  FROM   sys.foreign_keys fk
  JOIN   sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN   sys.columns c ON c.object_id = fk.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE  fk.parent_object_id = OBJECT_ID('dbo.outreach_campaigns')
    AND  c.name = 'sport_id';
  IF LEN(@oc_fk) > 0 EXEC sp_executesql @oc_fk;

  ALTER TABLE dbo.outreach_campaigns DROP COLUMN sport_id;
  ALTER TABLE dbo.outreach_campaigns ADD sport_id INT NULL
    CONSTRAINT FK_oc_sport REFERENCES dbo.sports(id);
  PRINT 'outreach_campaigns.sport_id converted to INT';
END
ELSE
  PRINT 'outreach_campaigns.sport_id already INT or does not exist — skipped';
GO

-- ─── 2. feed_posts.sport_id  UNIQUEIDENTIFIER → INT ─────────────────────────

IF COL_LENGTH('dbo.feed_posts', 'sport_id') IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM sys.columns c
     JOIN   sys.types  t ON t.user_type_id = c.user_type_id
     WHERE  c.object_id = OBJECT_ID('dbo.feed_posts')
       AND  c.name      = 'sport_id'
       AND  t.name      = 'uniqueidentifier'
   )
BEGIN
  -- Drop default/FK if any
  DECLARE @fp_dc NVARCHAR(200);
  SELECT TOP 1 @fp_dc = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.default_object_id = dc.object_id
  WHERE  c.object_id = OBJECT_ID('dbo.feed_posts')
    AND  c.name      = 'sport_id';
  IF @fp_dc IS NOT NULL
    EXEC(N'ALTER TABLE dbo.feed_posts DROP CONSTRAINT [' + @fp_dc + N']');

  DECLARE @fp_fk NVARCHAR(MAX) = N'';
  SELECT @fp_fk += N'ALTER TABLE dbo.feed_posts DROP CONSTRAINT '
                 + QUOTENAME(fk.name) + N'; '
  FROM   sys.foreign_keys fk
  JOIN   sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN   sys.columns c ON c.object_id = fk.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE  fk.parent_object_id = OBJECT_ID('dbo.feed_posts')
    AND  c.name = 'sport_id';
  IF LEN(@fp_fk) > 0 EXEC sp_executesql @fp_fk;

  ALTER TABLE dbo.feed_posts DROP COLUMN sport_id;
  ALTER TABLE dbo.feed_posts ADD sport_id INT NULL
    CONSTRAINT FK_fp_sport REFERENCES dbo.sports(id);
  PRINT 'feed_posts.sport_id converted to INT';
END
ELSE
  PRINT 'feed_posts.sport_id already INT or does not exist — skipped';
GO

-- ─── 3. outreach_messages: replace player_id / alumni_id with user_id ────────

-- 3a. Drop old columns (FKs to players/alumni already removed in migration 008)
IF COL_LENGTH('dbo.outreach_messages', 'player_id') IS NOT NULL
BEGIN
  -- Drop any residual default constraints
  DECLARE @om_dc1 NVARCHAR(200);
  SELECT TOP 1 @om_dc1 = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.default_object_id = dc.object_id
  WHERE  c.object_id = OBJECT_ID('dbo.outreach_messages')
    AND  c.name = 'player_id';
  IF @om_dc1 IS NOT NULL
    EXEC(N'ALTER TABLE dbo.outreach_messages DROP CONSTRAINT [' + @om_dc1 + N']');

  ALTER TABLE dbo.outreach_messages DROP COLUMN player_id;
  PRINT 'Dropped outreach_messages.player_id';
END
GO

IF COL_LENGTH('dbo.outreach_messages', 'alumni_id') IS NOT NULL
BEGIN
  DECLARE @om_dc2 NVARCHAR(200);
  SELECT TOP 1 @om_dc2 = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.default_object_id = dc.object_id
  WHERE  c.object_id = OBJECT_ID('dbo.outreach_messages')
    AND  c.name = 'alumni_id';
  IF @om_dc2 IS NOT NULL
    EXEC(N'ALTER TABLE dbo.outreach_messages DROP CONSTRAINT [' + @om_dc2 + N']');

  ALTER TABLE dbo.outreach_messages DROP COLUMN alumni_id;
  PRINT 'Dropped outreach_messages.alumni_id';
END
GO

-- 3b. Add user_id if not already present
IF COL_LENGTH('dbo.outreach_messages', 'user_id') IS NULL
BEGIN
  ALTER TABLE dbo.outreach_messages ADD user_id INT NOT NULL
    CONSTRAINT FK_outreach_msg_user REFERENCES dbo.users(user_id);
  PRINT 'Added outreach_messages.user_id (INT FK → users)';
END
ELSE
  PRINT 'outreach_messages.user_id already exists — skipped';
GO

-- ─── 4. email_unsubscribes: replace player_id / alumni_id with user_id ───────

-- 4a. Drop old columns (FKs already removed in migration 008)
IF COL_LENGTH('dbo.email_unsubscribes', 'player_id') IS NOT NULL
BEGIN
  -- Drop any unique indexes referencing player_id
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_unsub_player_channel')
    DROP INDEX UQ_unsub_player_channel ON dbo.email_unsubscribes;

  DECLARE @eu_dc1 NVARCHAR(200);
  SELECT TOP 1 @eu_dc1 = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.default_object_id = dc.object_id
  WHERE  c.object_id = OBJECT_ID('dbo.email_unsubscribes')
    AND  c.name = 'player_id';
  IF @eu_dc1 IS NOT NULL
    EXEC(N'ALTER TABLE dbo.email_unsubscribes DROP CONSTRAINT [' + @eu_dc1 + N']');

  ALTER TABLE dbo.email_unsubscribes DROP COLUMN player_id;
  PRINT 'Dropped email_unsubscribes.player_id';
END
GO

IF COL_LENGTH('dbo.email_unsubscribes', 'alumni_id') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_unsub_alumni_channel')
    DROP INDEX UQ_unsub_alumni_channel ON dbo.email_unsubscribes;

  DECLARE @eu_dc2 NVARCHAR(200);
  SELECT TOP 1 @eu_dc2 = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.default_object_id = dc.object_id
  WHERE  c.object_id = OBJECT_ID('dbo.email_unsubscribes')
    AND  c.name = 'alumni_id';
  IF @eu_dc2 IS NOT NULL
    EXEC(N'ALTER TABLE dbo.email_unsubscribes DROP CONSTRAINT [' + @eu_dc2 + N']');

  ALTER TABLE dbo.email_unsubscribes DROP COLUMN alumni_id;
  PRINT 'Dropped email_unsubscribes.alumni_id';
END
GO

-- 4b. Add user_id + unique index
IF COL_LENGTH('dbo.email_unsubscribes', 'user_id') IS NULL
BEGIN
  ALTER TABLE dbo.email_unsubscribes ADD user_id INT NOT NULL
    CONSTRAINT FK_unsub_user REFERENCES dbo.users(user_id);
  PRINT 'Added email_unsubscribes.user_id (INT FK → users)';
END
ELSE
  PRINT 'email_unsubscribes.user_id already exists — skipped';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_unsub_user_channel'
               AND object_id = OBJECT_ID('dbo.email_unsubscribes'))
BEGIN
  CREATE UNIQUE INDEX UQ_unsub_user_channel
    ON dbo.email_unsubscribes(user_id, channel);
  PRINT 'Created UQ_unsub_user_channel index';
END
GO

-- ─── Verification ─────────────────────────────────────────────────────────────

SELECT c.name, tp.name AS data_type, c.is_nullable
FROM   sys.columns c
JOIN   sys.types tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id = OBJECT_ID('dbo.outreach_campaigns')
  AND  c.name = 'sport_id';

SELECT c.name, tp.name AS data_type, c.is_nullable
FROM   sys.columns c
JOIN   sys.types tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id = OBJECT_ID('dbo.feed_posts')
  AND  c.name = 'sport_id';

SELECT c.name, tp.name AS data_type
FROM   sys.columns c
JOIN   sys.types tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id = OBJECT_ID('dbo.outreach_messages')
  AND  c.name IN ('user_id', 'player_id', 'alumni_id')
ORDER  BY c.column_id;

SELECT c.name, tp.name AS data_type
FROM   sys.columns c
JOIN   sys.types tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id = OBJECT_ID('dbo.email_unsubscribes')
  AND  c.name IN ('user_id', 'player_id', 'alumni_id')
ORDER  BY c.column_id;

PRINT '=== Migration 009 complete ===';
GO
