-- ============================================================
-- 025_add_cheer_positions.sql
-- Activates the Cheer & Spirit sport (CHR, id=50) and seeds
-- its roster positions.
--
-- Safe to re-run: NOT EXISTS guards prevent duplicates.
-- ============================================================

-- Step 1: Activate Cheer & Spirit
UPDATE dbo.sports
SET    is_active = 1
WHERE  abbr = 'CHR';
PRINT '025: Cheer & Spirit (CHR) set to active.';
GO

-- Step 2: Seed positions for Cheer & Spirit
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS JOIN (VALUES
  ('Flyer',       'FLY'),
  ('Base',        'BASE'),
  ('Back Spot',   'BKSP'),
  ('Front Spot',  'FRSP'),
  ('Spotter',     'SPOT'),
  ('Tumbler',     'TMBL'),
  ('Jumper',      'JMPR'),
  ('Captain',     'CAPT'),
  ('Co-Captain',  'COCPT')
) v(position_name, abbreviation)
WHERE s.abbr = 'CHR'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
PRINT '025: Cheer & Spirit positions seeded.';
GO
