-- ============================================================
-- 008_repair.sql
-- Run on: LegacyLinkApp (and every tenant App DB)
-- Run after: 008_schema_refactor.sql (which ran but had partial failures)
-- ============================================================
-- Fixes three issues from the initial 008 run:
--
--   1. dbo.sports is EMPTY — the temp table (#SportsMap) used to
--      restore rows went out of scope between GO batches.
--      Fix: directly seed sports with deterministic INT IDs.
--
--   2. users_sports.sport_id is still UNIQUEIDENTIFIER — the
--      UQ_users_sports index was not dropped before the column
--      drop, causing Msg 5074 / 4922.
--      Fix: drop the index, finish the GUID→INT conversion.
--
--   3. interaction_log restore used explicit id without
--      IDENTITY_INSERT ON — Msg 544.
--      Fix: idempotent; 0 rows were affected so no action needed.
--      The SP file already uses the correct schema.
-- ============================================================

USE LegacyLinkApp
GO

-- ─── 1. Re-seed dbo.sports with deterministic INT IDs ────────────────────────
-- Safe to re-run: only inserts where the id does not already exist.

SET IDENTITY_INSERT dbo.sports ON;

INSERT INTO dbo.sports (id, name, abbr, is_active)
SELECT id, name, abbr, is_active FROM (VALUES
  ( 1, 'Football',                    'FB',   1),
  ( 2, 'Men''s Basketball',           'MBB',  0),
  ( 3, 'Women''s Basketball',         'WBB',  0),
  ( 4, 'Basketball',                  'BB',   0),
  ( 5, 'Baseball',                    'BA',   0),
  ( 6, 'Softball',                    'SB',   1),
  ( 7, 'Men''s Soccer',               'MS',   0),
  ( 8, 'Women''s Soccer',             'WS',   0),
  ( 9, 'Soccer',                      'SO',   0),
  (10, 'Men''s Volleyball',           'MVB',  0),
  (11, 'Women''s Volleyball',         'WVB',  0),
  (12, 'Beach Volleyball',            'BVB',  0),
  (13, 'Volleyball',                  'VB',   0),
  (14, 'Men''s Lacrosse',             'MLAX', 0),
  (15, 'Women''s Lacrosse',           'WLAX', 0),
  (16, 'Men''s Tennis',               'MTEN', 0),
  (17, 'Women''s Tennis',             'WTEN', 0),
  (18, 'Men''s Golf',                 'MGOL', 0),
  (19, 'Women''s Golf',               'WGOL', 0),
  (20, 'Men''s Cross Country',        'MCC',  0),
  (21, 'Women''s Cross Country',      'WCC',  0),
  (22, 'Men''s Indoor Track',         'MITR', 0),
  (23, 'Women''s Indoor Track',       'WITR', 0),
  (24, 'Men''s Outdoor Track',        'MOTR', 0),
  (25, 'Women''s Outdoor Track',      'WOTR', 0),
  (26, 'Men''s Swimming & Diving',    'MSWM', 0),
  (27, 'Women''s Swimming & Diving',  'WSWM', 0),
  (28, 'Men''s Gymnastics',           'MGYM', 0),
  (29, 'Women''s Gymnastics',         'WGYM', 0),
  (30, 'Men''s Rowing',               'MROW', 0),
  (31, 'Women''s Rowing',             'WROW', 0),
  (32, 'Men''s Ice Hockey',           'MHKY', 0),
  (33, 'Women''s Ice Hockey',         'WHKY', 0),
  (34, 'Men''s Water Polo',           'MWP',  0),
  (35, 'Women''s Water Polo',         'WWP',  0),
  (36, 'Wrestling',                   'WRES', 0),
  (37, 'Women''s Wrestling',          'WWRE', 0),
  (38, 'Field Hockey',                'FH',   0),
  (39, 'Men''s Rugby',                'MRUG', 0),
  (40, 'Women''s Rugby',              'WRUG', 0),
  (41, 'Men''s Bowling',              'MBWL', 0),
  (42, 'Women''s Bowling',            'WBWL', 0),
  (43, 'Equestrian',                  'EQ',   0),
  (44, 'Fencing',                     'FEN',  0),
  (45, 'Rifle',                       'RIF',  0),
  (46, 'Skiing & Snowboarding',       'SKI',  0),
  (47, 'Triathlon',                   'TRI',  0),
  (48, 'Stunt',                       'STN',  0),
  (49, 'Esports',                     'ESP',  0),
  (50, 'Cheer & Spirit',              'CHR',  0),
  (51, 'Dance',                       'DNC',  0)
) v(id, name, abbr, is_active)
WHERE NOT EXISTS (SELECT 1 FROM dbo.sports s WHERE s.id = v.id);

SET IDENTITY_INSERT dbo.sports OFF;
PRINT CONCAT('Seeded ', @@ROWCOUNT, ' sports row(s) into dbo.sports');
GO

-- ─── 2. Finish users_sports GUID→INT conversion ──────────────────────────────

-- 2a. Drop UQ_users_sports — drop as CONSTRAINT if it is one, else as INDEX
IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE  name = 'UQ_users_sports'
    AND  parent_object_id = OBJECT_ID('dbo.users_sports')
)
BEGIN
  ALTER TABLE dbo.users_sports DROP CONSTRAINT UQ_users_sports;
  PRINT 'Dropped UQ_users_sports constraint';
END
ELSE IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE  name = 'UQ_users_sports'
    AND  object_id = OBJECT_ID('dbo.users_sports')
    AND  is_unique_constraint = 0
)
BEGIN
  DROP INDEX UQ_users_sports ON dbo.users_sports;
  PRINT 'Dropped UQ_users_sports index';
END
ELSE
  PRINT 'UQ_users_sports already gone — skipped';
GO

-- 2b. Drop any remaining FK constraint on users_sports.sport_id (the GUID column)
DECLARE @DropUSFK NVARCHAR(MAX) = N'';
SELECT @DropUSFK += N'ALTER TABLE dbo.users_sports DROP CONSTRAINT '
                  + QUOTENAME(fk.name) + N'; '
FROM   sys.foreign_keys fk
JOIN   sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN   sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE  fk.parent_object_id = OBJECT_ID('dbo.users_sports')
  AND  c.name = 'sport_id';
IF LEN(@DropUSFK) > 0
BEGIN
  EXEC sp_executesql @DropUSFK;
  PRINT 'Dropped remaining FK on users_sports.sport_id';
END
GO

-- 2c. Drop the GUID sport_id column (now that UQ index is gone)
IF COL_LENGTH('dbo.users_sports', 'sport_id') IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM sys.columns c
     JOIN sys.types t ON t.user_type_id = c.user_type_id
     WHERE c.object_id = OBJECT_ID('dbo.users_sports')
       AND c.name = 'sport_id'
       AND t.name = 'uniqueidentifier'
   )
BEGIN
  -- Drop any default constraint first
  DECLARE @USDc NVARCHAR(200);
  SELECT TOP 1 @USDc = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.default_object_id = dc.object_id
  WHERE  c.object_id = OBJECT_ID('dbo.users_sports')
    AND  c.name = 'sport_id';
  IF @USDc IS NOT NULL
    EXEC(N'ALTER TABLE dbo.users_sports DROP CONSTRAINT [' + @USDc + N']');

  ALTER TABLE dbo.users_sports DROP COLUMN sport_id;
  PRINT 'Dropped users_sports.sport_id (GUID)';
END
ELSE
  PRINT 'users_sports.sport_id is not GUID or does not exist — skipped';
GO

-- 2d. Rename sport_id_int → sport_id (if the rename hasn't happened yet)
IF COL_LENGTH('dbo.users_sports', 'sport_id_int') IS NOT NULL
   AND COL_LENGTH('dbo.users_sports', 'sport_id') IS NULL
BEGIN
  EXEC sp_rename 'dbo.users_sports.sport_id_int', 'sport_id', 'COLUMN';
  PRINT 'Renamed sport_id_int → sport_id';
END
ELSE IF COL_LENGTH('dbo.users_sports', 'sport_id_int') IS NOT NULL
        AND COL_LENGTH('dbo.users_sports', 'sport_id') IS NOT NULL
BEGIN
  -- sport_id_int leftover alongside the new INT sport_id — just drop it
  ALTER TABLE dbo.users_sports DROP COLUMN sport_id_int;
  PRINT 'Dropped leftover sport_id_int column';
END
ELSE
  PRINT 'sport_id_int already renamed or does not exist — skipped';
GO

-- 2e. Make sport_id NOT NULL (it was added as INT NULL)
ALTER TABLE dbo.users_sports ALTER COLUMN sport_id INT NOT NULL;
PRINT 'Set users_sports.sport_id NOT NULL';
GO

-- 2f. Re-add FK to dbo.sports
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_sports_sports')
BEGIN
  ALTER TABLE dbo.users_sports ADD CONSTRAINT FK_users_sports_sports
    FOREIGN KEY (sport_id) REFERENCES dbo.sports(id);
  PRINT 'Re-added FK_users_sports_sports';
END
ELSE
  PRINT 'FK_users_sports_sports already exists — skipped';
GO

-- 2g. Re-add unique index on (user_id, sport_id)
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE  name = 'UQ_users_sports'
    AND  object_id = OBJECT_ID('dbo.users_sports')
)
BEGIN
  CREATE UNIQUE INDEX UQ_users_sports ON dbo.users_sports(user_id, sport_id);
  PRINT 'Re-added UQ_users_sports (user_id, sport_id)';
END
ELSE
  PRINT 'UQ_users_sports already exists — skipped';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────

SELECT COUNT(*) AS sports_count FROM dbo.sports;

SELECT c.name, tp.name AS data_type, c.is_nullable
FROM   sys.columns c
JOIN   sys.types tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id = OBJECT_ID('dbo.users_sports')
  AND  c.name IN ('sport_id', 'sport_id_int')
ORDER  BY c.column_id;

SELECT name, type_desc
FROM   sys.indexes
WHERE  object_id = OBJECT_ID('dbo.users_sports');

SELECT name FROM sys.foreign_keys
WHERE  parent_object_id = OBJECT_ID('dbo.users_sports');

PRINT '=== 008_repair complete ===';
GO
