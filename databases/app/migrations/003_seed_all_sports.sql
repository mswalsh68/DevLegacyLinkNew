-- ============================================================
-- 003_seed_all_sports.sql
-- Ensures dbo.sports has is_active column, inserts every
-- HS/college sport, then sets all inactive except Football + Softball.
--
-- Safe to re-run: IF NOT EXISTS guards on abbr prevent duplicates.
-- ============================================================

-- Step 1: Add is_active column if missing (created without it on older DBs)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE  object_id = OBJECT_ID('dbo.sports') AND name = 'is_active'
)
BEGIN
  ALTER TABLE dbo.sports
    ADD is_active BIT NOT NULL DEFAULT 1;
  PRINT '003: Added is_active column to dbo.sports.';
END
GO

-- Step 2: Insert all HS / college sports (skip if abbr already exists)
-- ── Football ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'FB')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Football',                  'FB');

-- ── Basketball ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MBB')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Basketball',         'MBB');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WBB')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Basketball',       'WBB');
-- Legacy generic entry (keep if exists, add if not)
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'BB')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Basketball',                'BB');

-- ── Baseball / Softball ───────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'BA')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Baseball',                  'BA');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'SB')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Softball',                  'SB');

-- ── Soccer ────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MS')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Soccer',             'MS');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WS')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Soccer',           'WS');
-- Legacy generic entry
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'SO')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Soccer',                    'SO');

-- ── Volleyball ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MVB')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Volleyball',         'MVB');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WVB')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Volleyball',       'WVB');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'BVB')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Beach Volleyball',          'BVB');
-- Legacy generic entry
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'VB')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Volleyball',                'VB');

-- ── Lacrosse ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MLAX')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Lacrosse',           'MLAX');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WLAX')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Lacrosse',         'WLAX');

-- ── Tennis ────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MTEN')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Tennis',             'MTEN');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WTEN')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Tennis',           'WTEN');

-- ── Golf ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MGOL')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Golf',               'MGOL');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WGOL')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Golf',             'WGOL');

-- ── Cross Country ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MCC')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Cross Country',      'MCC');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WCC')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Cross Country',    'WCC');

-- ── Track & Field ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MITR')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Indoor Track',       'MITR');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WITR')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Indoor Track',     'WITR');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MOTR')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Outdoor Track',      'MOTR');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WOTR')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Outdoor Track',    'WOTR');

-- ── Swimming & Diving ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MSWM')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Swimming & Diving',  'MSWM');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WSWM')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Swimming & Diving','WSWM');

-- ── Gymnastics ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MGYM')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Gymnastics',         'MGYM');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WGYM')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Gymnastics',       'WGYM');

-- ── Rowing ────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MROW')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Rowing',             'MROW');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WROW')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Rowing',           'WROW');

-- ── Ice Hockey ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MHKY')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Ice Hockey',         'MHKY');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WHKY')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Ice Hockey',       'WHKY');

-- ── Water Polo ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MWP')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Water Polo',         'MWP');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WWP')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Water Polo',       'WWP');

-- ── Wrestling ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WRES')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Wrestling',                 'WRES');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WWRE')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Wrestling',        'WWRE');

-- ── Field Hockey ──────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'FH')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Field Hockey',              'FH');

-- ── Rugby ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MRUG')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Rugby',              'MRUG');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WRUG')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Rugby',            'WRUG');

-- ── Bowling ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'MBWL')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Men''s Bowling',            'MBWL');
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'WBWL')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Women''s Bowling',          'WBWL');

-- ── Equestrian ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'EQ')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Equestrian',                'EQ');

-- ── Fencing ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'FEN')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Fencing',                   'FEN');

-- ── Rifle ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'RIF')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Rifle',                     'RIF');

-- ── Skiing / Snowboarding ─────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'SKI')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Skiing & Snowboarding',     'SKI');

-- ── Triathlon ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'TRI')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Triathlon',                 'TRI');

-- ── Stunt ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'STN')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Stunt',                     'STN');

-- ── Esports ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'ESP')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Esports',                   'ESP');

-- ── Cheer & Spirit ────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'CHR')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Cheer & Spirit',            'CHR');

-- ── Dance ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = 'DNC')
  INSERT INTO dbo.sports (id, name, abbr) VALUES (NEWID(), 'Dance',                     'DNC');

PRINT '003: Sport rows seeded.';
GO

-- Step 3: Set ALL sports inactive
UPDATE dbo.sports SET is_active = 0;
PRINT '003: All sports set to inactive.';
GO

-- Step 4: Activate Football and Softball only
UPDATE dbo.sports SET is_active = 1 WHERE abbr IN ('FB', 'SB');
PRINT '003: Football and Softball set to active.';
GO
