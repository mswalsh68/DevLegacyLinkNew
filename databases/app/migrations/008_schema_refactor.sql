-- ============================================================
-- 008_schema_refactor.sql
-- Run on: LegacyLinkApp (and every tenant App DB)
-- Run after: 007_reorder_pk_fk_columns.sql
-- ============================================================
-- Summary of changes:
--   • dbo.users          — add created_at, is_active; drop program_role_id
--                          (roles now live in users_roles)
--   • dbo.sports         — convert id GUID → INT IDENTITY (Football = 1)
--   • dbo.users_sports   — convert sport_id GUID → INT; add is_active
--   • CREATE dbo.sports_position + seed all sports
--   • CREATE dbo.users_roles  (user × sport × role junction)
--   • Migrate existing program_role_id data → users_roles
--   • CREATE dbo.role_transfer_log
--   • DROP dbo.player_status_types  (if exists)
--   • DROP dbo.graduation_log
--   • REBUILD dbo.interaction_log   (alumni_id → user_id)
--   • DROP dbo.player_stats
--   • DROP dbo.alumni
--   • DROP dbo.players
-- ============================================================

USE LegacyLinkApp
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 0: dbo.users — add created_at, is_active
-- ══════════════════════════════════════════════════════════════

IF COL_LENGTH('dbo.users', 'is_active') IS NULL
BEGIN
  ALTER TABLE dbo.users ADD is_active BIT NOT NULL DEFAULT 1;
  PRINT 'Added dbo.users.is_active';
END
ELSE PRINT 'dbo.users.is_active already exists — skipped';
GO

IF COL_LENGTH('dbo.users', 'created_at') IS NULL
BEGIN
  ALTER TABLE dbo.users ADD created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME();
  PRINT 'Added dbo.users.created_at';
END
ELSE PRINT 'dbo.users.created_at already exists — skipped';
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: dbo.sports — GUID id → INT IDENTITY (Football = 1)
-- ══════════════════════════════════════════════════════════════

-- ─── 1a. Capture GUID→abbr mapping before drop ───────────────────────────────

IF OBJECT_ID('tempdb..#SportsMap') IS NOT NULL DROP TABLE #SportsMap;

SELECT
  id   AS old_guid,
  abbr,
  name,
  is_active,
  -- Assign deterministic INT IDs — Football must be 1
  CASE abbr
    WHEN 'FB'   THEN 1   WHEN 'MBB'  THEN 2   WHEN 'WBB'  THEN 3
    WHEN 'BB'   THEN 4   WHEN 'BA'   THEN 5   WHEN 'SB'   THEN 6
    WHEN 'MS'   THEN 7   WHEN 'WS'   THEN 8   WHEN 'SO'   THEN 9
    WHEN 'MVB'  THEN 10  WHEN 'WVB'  THEN 11  WHEN 'BVB'  THEN 12
    WHEN 'VB'   THEN 13  WHEN 'MLAX' THEN 14  WHEN 'WLAX' THEN 15
    WHEN 'MTEN' THEN 16  WHEN 'WTEN' THEN 17  WHEN 'MGOL' THEN 18
    WHEN 'WGOL' THEN 19  WHEN 'MCC'  THEN 20  WHEN 'WCC'  THEN 21
    WHEN 'MITR' THEN 22  WHEN 'WITR' THEN 23  WHEN 'MOTR' THEN 24
    WHEN 'WOTR' THEN 25  WHEN 'MSWM' THEN 26  WHEN 'WSWM' THEN 27
    WHEN 'MGYM' THEN 28  WHEN 'WGYM' THEN 29  WHEN 'MROW' THEN 30
    WHEN 'WROW' THEN 31  WHEN 'MHKY' THEN 32  WHEN 'WHKY' THEN 33
    WHEN 'MWP'  THEN 34  WHEN 'WWP'  THEN 35  WHEN 'WRES' THEN 36
    WHEN 'WWRE' THEN 37  WHEN 'FH'   THEN 38  WHEN 'MRUG' THEN 39
    WHEN 'WRUG' THEN 40  WHEN 'MBWL' THEN 41  WHEN 'WBWL' THEN 42
    WHEN 'EQ'   THEN 43  WHEN 'FEN'  THEN 44  WHEN 'RIF'  THEN 45
    WHEN 'SKI'  THEN 46  WHEN 'TRI'  THEN 47  WHEN 'STN'  THEN 48
    WHEN 'ESP'  THEN 49  WHEN 'CHR'  THEN 50  WHEN 'DNC'  THEN 51
    ELSE 100 + ROW_NUMBER() OVER (ORDER BY name)  -- future sports
  END AS new_int_id
INTO #SportsMap
FROM dbo.sports;

PRINT CONCAT('Captured ', @@ROWCOUNT, ' sports row(s) for remapping');
GO

-- ─── 1b. Drop all FK constraints referencing dbo.sports ──────────────────────

DECLARE @DropSportFKs NVARCHAR(MAX) = N'';
SELECT @DropSportFKs += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
    + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
    + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.sports');
IF LEN(@DropSportFKs) > 0
BEGIN
  EXEC sp_executesql @DropSportFKs;
  PRINT 'Dropped all FK constraints referencing dbo.sports';
END
GO

-- ─── 1c. Drop and recreate dbo.sports with INT IDENTITY ──────────────────────

IF OBJECT_ID('dbo.sports', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.sports;
  PRINT 'Dropped dbo.sports';
END
GO

CREATE TABLE dbo.sports (
  id        INT           NOT NULL IDENTITY(1,1)
              CONSTRAINT PK_sports PRIMARY KEY,
  name      NVARCHAR(100) NOT NULL,
  abbr      NVARCHAR(10)  NOT NULL CONSTRAINT UQ_sports_abbr UNIQUE,
  is_active BIT           NOT NULL DEFAULT 1
);

CREATE INDEX IX_sports_is_active ON dbo.sports(is_active);
PRINT 'Created dbo.sports (INT IDENTITY PK)';
GO

-- ─── 1d. Re-seed sports with assigned INT IDs ────────────────────────────────

SET IDENTITY_INSERT dbo.sports ON;

INSERT INTO dbo.sports (id, name, abbr, is_active)
SELECT new_int_id, name, abbr, is_active
FROM   #SportsMap
ORDER  BY new_int_id;

SET IDENTITY_INSERT dbo.sports OFF;
PRINT CONCAT('Restored ', @@ROWCOUNT, ' sports row(s) with INT IDs');
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 2: dbo.users_sports — sport_id GUID → INT; add is_active
-- ══════════════════════════════════════════════════════════════

-- ─── 2a. Add sport_id_int using the mapping ───────────────────────────────────

IF COL_LENGTH('dbo.users_sports', 'sport_id_int') IS NULL
  ALTER TABLE dbo.users_sports ADD sport_id_int INT NULL;
GO

UPDATE us
SET    us.sport_id_int = sm.new_int_id
FROM   dbo.users_sports us
JOIN   #SportsMap sm ON sm.old_guid = us.sport_id;
PRINT CONCAT('Mapped ', @@ROWCOUNT, ' users_sports.sport_id values to INT');
GO

-- ─── 2b. Drop old GUID sport_id column ───────────────────────────────────────

-- Drop any FK on users_sports.sport_id first
DECLARE @USSportFK NVARCHAR(MAX) = N'';
SELECT @USSportFK += N'ALTER TABLE dbo.users_sports DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE fk.parent_object_id = OBJECT_ID('dbo.users_sports') AND c.name = 'sport_id';
IF LEN(@USSportFK) > 0 EXEC sp_executesql @USSportFK;

-- Drop any default constraint on the old sport_id
DECLARE @USSportDC NVARCHAR(200);
SELECT TOP 1 @USSportDC = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON c.default_object_id = dc.object_id
WHERE c.object_id = OBJECT_ID('dbo.users_sports') AND c.name = 'sport_id';
IF @USSportDC IS NOT NULL EXEC(N'ALTER TABLE dbo.users_sports DROP CONSTRAINT [' + @USSportDC + N']');

ALTER TABLE dbo.users_sports DROP COLUMN sport_id;
EXEC sp_rename 'dbo.users_sports.sport_id_int', 'sport_id', 'COLUMN';
PRINT 'Converted users_sports.sport_id GUID → INT';
GO

-- ─── 2c. Make sport_id NOT NULL and add FK ────────────────────────────────────

ALTER TABLE dbo.users_sports ALTER COLUMN sport_id INT NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_sports_sports')
  ALTER TABLE dbo.users_sports ADD CONSTRAINT FK_users_sports_sports
    FOREIGN KEY (sport_id) REFERENCES dbo.sports(id);
GO

-- ─── 2d. Add is_active if missing ────────────────────────────────────────────

IF COL_LENGTH('dbo.users_sports', 'is_active') IS NULL
BEGIN
  ALTER TABLE dbo.users_sports ADD is_active BIT NOT NULL DEFAULT 1;
  PRINT 'Added dbo.users_sports.is_active';
END
ELSE PRINT 'dbo.users_sports.is_active already exists — skipped';
GO

-- Re-add FK from users_sports to users (was dropped with sports FK above if dynamic)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_sports_users')
  ALTER TABLE dbo.users_sports ADD CONSTRAINT FK_users_sports_users
    FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE;
GO

PRINT 'dbo.users_sports updated';
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 3: CREATE dbo.sports_position (if not exists) + seed
-- ══════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'sports_position' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.sports_position (
    position_id   INT           NOT NULL IDENTITY(1,1)
                    CONSTRAINT PK_sports_position PRIMARY KEY,
    sport_id      INT           NOT NULL
                    CONSTRAINT FK_sports_position_sports REFERENCES dbo.sports(id) ON DELETE CASCADE,
    position_name NVARCHAR(100) NOT NULL,
    abbreviation  NVARCHAR(10)  NOT NULL,
    is_active     BIT           NOT NULL DEFAULT 1,
    CONSTRAINT UQ_sports_position UNIQUE (sport_id, abbreviation)
  );
  CREATE INDEX IX_sports_position_sport ON dbo.sports_position(sport_id);
  PRINT 'Created dbo.sports_position';
END
ELSE PRINT 'dbo.sports_position already exists — checking for missing rows only';
GO

-- ─── Seed positions (INSERT only if abbreviation not present for that sport) ──

-- Football (id=1)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Quarterback',       'QB'), ('Running Back',      'RB'), ('Fullback',          'FB'),
  ('Wide Receiver',     'WR'), ('Tight End',          'TE'), ('Center',            'C'),
  ('Guard',             'G'),  ('Tackle',             'T'),  ('Defensive End',     'DE'),
  ('Defensive Tackle',  'DT'), ('Nose Tackle',        'NT'), ('Linebacker',        'LB'),
  ('Inside Linebacker', 'ILB'),('Outside Linebacker', 'OLB'),('Cornerback',        'CB'),
  ('Safety',            'S'),  ('Free Safety',        'FS'), ('Strong Safety',     'SS'),
  ('Kicker',            'K'),  ('Punter',             'P'),  ('Long Snapper',      'LS'),
  ('Athlete',           'ATH')
) v(position_name, abbreviation)
WHERE s.abbr = 'FB'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Men's & Women's Basketball + generic (id=2,3,4)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Point Guard',  'PG'), ('Shooting Guard', 'SG'), ('Small Forward', 'SF'),
  ('Power Forward','PF'), ('Center',          'C')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MBB','WBB','BB')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Baseball (id=5)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Pitcher','P'),('Catcher','C'),('First Base','1B'),('Second Base','2B'),
  ('Third Base','3B'),('Shortstop','SS'),('Left Field','LF'),('Center Field','CF'),
  ('Right Field','RF'),('Designated Hitter','DH'),('Utility','UTL')
) v(position_name, abbreviation)
WHERE s.abbr = 'BA'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Softball (id=6)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Pitcher','P'),('Catcher','C'),('First Base','1B'),('Second Base','2B'),
  ('Third Base','3B'),('Shortstop','SS'),('Left Field','LF'),('Center Field','CF'),
  ('Right Field','RF'),('Designated Player','DP'),('Utility','UTL')
) v(position_name, abbreviation)
WHERE s.abbr = 'SB'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Men's Soccer, Women's Soccer, generic Soccer (id=7,8,9)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Goalkeeper','GK'),('Defender','DEF'),('Midfielder','MID'),
  ('Forward','FWD'),('Striker','ST')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MS','WS','SO')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Men's Volleyball, Women's Volleyball, Beach Volleyball, generic Volleyball (id=10-13)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Setter','S'),('Outside Hitter','OH'),('Right Side Hitter','RS'),
  ('Middle Blocker','MB'),('Libero','L'),('Defensive Specialist','DS')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MVB','WVB','BVB','VB')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Men's Lacrosse (id=14)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Goalie','G'),('Defense','D'),('Long Stick Midfielder','LSM'),
  ('Midfielder','M'),('Face-Off Specialist','FO'),('Attack','A')
) v(position_name, abbreviation)
WHERE s.abbr = 'MLAX'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Women's Lacrosse (id=15)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Goalie','G'),('Defense','D'),('Midfielder','M'),
  ('Attack','A'),('Draw Specialist','DS')
) v(position_name, abbreviation)
WHERE s.abbr = 'WLAX'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Tennis (id=16,17)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Singles','SING'),('Doubles','DOUB')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MTEN','WTEN')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Golf (id=18,19)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES ('Golfer','GOLF')) v(position_name, abbreviation)
WHERE s.abbr IN ('MGOL','WGOL')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Cross Country (id=20,21)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES ('Runner','XC')) v(position_name, abbreviation)
WHERE s.abbr IN ('MCC','WCC')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Track & Field (id=22-25)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Sprinter','SPR'),('Middle Distance','MID'),('Distance','DIST'),
  ('Thrower','THR'),('Jumper','JMP'),('Multi-Event','MULTI'),('Relay','REL')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MITR','WITR','MOTR','WOTR')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Swimming & Diving (id=26,27)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Freestyle','FREE'),('Backstroke','BACK'),('Breaststroke','BREA'),
  ('Butterfly','FLY'),('Individual Medley','IM'),('Relay','REL'),('Diver','DIVE')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MSWM','WSWM')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Gymnastics (id=28,29)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('All-Around','AA'),('Vault','VT'),('Floor Exercise','FX')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MGYM','WGYM')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO
-- Women's-only events
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Uneven Bars','UB'),('Balance Beam','BB')
) v(position_name, abbreviation)
WHERE s.abbr = 'WGYM'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO
-- Men's-only events
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Pommel Horse','PH'),('Still Rings','SR'),('Parallel Bars','PB'),('High Bar','HB')
) v(position_name, abbreviation)
WHERE s.abbr = 'MGYM'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Rowing (id=30,31)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Coxswain','COX'),('Stroke','STR'),('Sculler','SCUL'),('Sweep','SWP')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MROW','WROW')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Ice Hockey (id=32,33)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Goalie','G'),('Defense','D'),('Left Wing','LW'),('Center','C'),('Right Wing','RW')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MHKY','WHKY')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Water Polo (id=34,35)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Goalie','G'),('Field Player','FP'),('Driver','DR'),('Hole Set','HS')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MWP','WWP')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Wrestling (id=36,37)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES ('Wrestler','WRES')) v(position_name, abbreviation)
WHERE s.abbr IN ('WRES','WWRE')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Field Hockey (id=38)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Goalkeeper','GK'),('Defender','DEF'),('Midfielder','MID'),('Forward','FWD')
) v(position_name, abbreviation)
WHERE s.abbr = 'FH'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Rugby (id=39,40)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES
  ('Prop','PR'),('Hooker','HK'),('Lock','LO'),('Flanker','FL'),
  ('Number 8','N8'),('Scrum Half','SH'),('Fly Half','FH'),
  ('Center','CTR'),('Wing','W'),('Fullback','FB')
) v(position_name, abbreviation)
WHERE s.abbr IN ('MRUG','WRUG')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Bowling (id=41,42)
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, v.position_name, v.abbreviation
FROM dbo.sports s
CROSS APPLY (VALUES ('Bowler','BWL')) v(position_name, abbreviation)
WHERE s.abbr IN ('MBWL','WBWL')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = v.abbreviation
  );
GO

-- Remaining sports — generic Athlete position
INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
SELECT s.id, 'Athlete', 'ATH'
FROM dbo.sports s
WHERE s.abbr IN ('EQ','FEN','RIF','SKI','TRI','STN','ESP','CHR','DNC')
  AND NOT EXISTS (
    SELECT 1 FROM dbo.sports_position sp
    WHERE sp.sport_id = s.id AND sp.abbreviation = 'ATH'
  );
GO

PRINT 'sports_position seed complete';
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 4: CREATE dbo.users_roles (if not exists)
-- ══════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'users_roles' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.users_roles (
    user_role_id   INT           NOT NULL IDENTITY(1,1)
                     CONSTRAINT PK_users_roles PRIMARY KEY,
    user_id        INT           NOT NULL
                     CONSTRAINT FK_users_roles_users        REFERENCES dbo.users(user_id) ON DELETE CASCADE,
    program_role_id INT          NOT NULL
                     CONSTRAINT FK_users_roles_program_role REFERENCES dbo.program_role(id),
    sport_id       INT           NULL
                     CONSTRAINT FK_users_roles_sports       REFERENCES dbo.sports(id),
    status         NVARCHAR(20)  NOT NULL DEFAULT 'current_player'
                     CONSTRAINT CK_users_roles_status CHECK (status IN ('current_player','alumni','removed')),
    position_id    INT           NULL
                     CONSTRAINT FK_users_roles_position     REFERENCES dbo.sports_position(position_id),
    jersey_number  NVARCHAR(10)  NULL,
    seasons_played NVARCHAR(50)  NULL,   -- alumni only: e.g. "2019,2020,2021"
    class_year     INT           NULL,   -- alumni only: graduation year
    created_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );
  CREATE INDEX IX_users_roles_user_id  ON dbo.users_roles(user_id);
  CREATE INDEX IX_users_roles_sport_id ON dbo.users_roles(sport_id);
  CREATE INDEX IX_users_roles_status   ON dbo.users_roles(status);
  PRINT 'Created dbo.users_roles';
END
ELSE
BEGIN
  -- Table exists — add any missing columns
  IF COL_LENGTH('dbo.users_roles', 'sport_id')      IS NULL ALTER TABLE dbo.users_roles ADD sport_id       INT          NULL CONSTRAINT FK_users_roles_sports    REFERENCES dbo.sports(id);
  IF COL_LENGTH('dbo.users_roles', 'status')         IS NULL ALTER TABLE dbo.users_roles ADD status         NVARCHAR(20) NOT NULL DEFAULT 'current_player';
  IF COL_LENGTH('dbo.users_roles', 'position_id')    IS NULL ALTER TABLE dbo.users_roles ADD position_id    INT          NULL CONSTRAINT FK_users_roles_position REFERENCES dbo.sports_position(position_id);
  IF COL_LENGTH('dbo.users_roles', 'jersey_number')  IS NULL ALTER TABLE dbo.users_roles ADD jersey_number  NVARCHAR(10) NULL;
  IF COL_LENGTH('dbo.users_roles', 'seasons_played') IS NULL ALTER TABLE dbo.users_roles ADD seasons_played NVARCHAR(50) NULL;
  IF COL_LENGTH('dbo.users_roles', 'class_year')     IS NULL ALTER TABLE dbo.users_roles ADD class_year     INT          NULL;
  IF COL_LENGTH('dbo.users_roles', 'created_at')     IS NULL ALTER TABLE dbo.users_roles ADD created_at     DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME();
  IF COL_LENGTH('dbo.users_roles', 'updated_at')     IS NULL ALTER TABLE dbo.users_roles ADD updated_at     DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME();
  PRINT 'dbo.users_roles already exists — added any missing columns';
END
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 5: Migrate existing program_role_id → users_roles
-- ══════════════════════════════════════════════════════════════
-- Only migrate player (1) and alumni (2) roles — staff roles
-- are platform-level and do not get sport-specific users_roles rows.

INSERT INTO dbo.users_roles (user_id, program_role_id, sport_id, status)
SELECT
  u.user_id,
  u.program_role_id,
  NULL,  -- sport unknown at migration time; admin assigns later
  CASE u.program_role_id WHEN 1 THEN 'current_player' WHEN 2 THEN 'alumni' END
FROM dbo.users u
WHERE u.program_role_id IN (1, 2)
  AND NOT EXISTS (
    SELECT 1 FROM dbo.users_roles ur
    WHERE ur.user_id = u.user_id
  );
PRINT CONCAT('Migrated ', @@ROWCOUNT, ' existing program_role assignments to users_roles');
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 6: Drop program_role_id from dbo.users
-- ══════════════════════════════════════════════════════════════

IF COL_LENGTH('dbo.users', 'program_role_id') IS NOT NULL
BEGIN
  -- Drop FK constraint first
  DECLARE @PRFKName NVARCHAR(200);
  SELECT TOP 1 @PRFKName = fk.name
  FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.users') AND c.name = 'program_role_id';
  IF @PRFKName IS NOT NULL
    EXEC(N'ALTER TABLE dbo.users DROP CONSTRAINT [' + @PRFKName + N']');

  ALTER TABLE dbo.users DROP COLUMN program_role_id;
  PRINT 'Dropped dbo.users.program_role_id (now in users_roles)';
END
ELSE PRINT 'dbo.users.program_role_id already gone — skipped';
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 7: CREATE dbo.role_transfer_log (if not exists)
-- ══════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'role_transfer_log' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.role_transfer_log (
    transfer_log_id    INT           NOT NULL IDENTITY(1,1)
                         CONSTRAINT PK_role_transfer_log PRIMARY KEY,
    user_role_id       INT           NOT NULL
                         CONSTRAINT FK_rtl_users_roles REFERENCES dbo.users_roles(user_role_id),
    admin_user_id      INT           NOT NULL
                         CONSTRAINT FK_rtl_admin_user  REFERENCES dbo.users(user_id),
    from_status        NVARCHAR(20)  NOT NULL,
    to_status          NVARCHAR(20)  NOT NULL,
    seasons_played     NVARCHAR(50)  NULL,
    class_year         INT           NULL,
    admin_acknowledged BIT           NOT NULL DEFAULT 0,
    transferred_at     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    notes              NVARCHAR(500) NULL
  );
  CREATE INDEX IX_rtl_user_role_id ON dbo.role_transfer_log(user_role_id);
  CREATE INDEX IX_rtl_transferred  ON dbo.role_transfer_log(transferred_at DESC);
  PRINT 'Created dbo.role_transfer_log';
END
ELSE PRINT 'dbo.role_transfer_log already exists — skipped';
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 8: DROP dbo.player_status_types (if exists)
-- ══════════════════════════════════════════════════════════════

IF OBJECT_ID('dbo.player_status_types', 'U') IS NOT NULL
BEGIN
  -- Drop any FKs referencing it first
  DECLARE @DropPSTFKs NVARCHAR(MAX) = N'';
  SELECT @DropPSTFKs += N'ALTER TABLE '
      + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
      + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
      + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.player_status_types');
  IF LEN(@DropPSTFKs) > 0 EXEC sp_executesql @DropPSTFKs;

  DROP TABLE dbo.player_status_types;
  PRINT 'Dropped dbo.player_status_types';
END
ELSE PRINT 'dbo.player_status_types not found — skipped';
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 9: DROP dbo.graduation_log
-- ══════════════════════════════════════════════════════════════

IF OBJECT_ID('dbo.graduation_log', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.graduation_log;
  PRINT 'Dropped dbo.graduation_log (superseded by role_transfer_log)';
END
ELSE PRINT 'dbo.graduation_log not found — skipped';
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 10: REBUILD dbo.interaction_log (alumni_id → user_id)
-- ══════════════════════════════════════════════════════════════

IF OBJECT_ID('dbo.interaction_log', 'U') IS NOT NULL
BEGIN
  -- Back up existing rows (0 in dev; safe to capture)
  IF OBJECT_ID('tempdb..#InteractionData') IS NOT NULL DROP TABLE #InteractionData;

  -- Map alumni_id → user_id where possible; NULL if no mapping exists
  SELECT
    il.id,
    COALESCE(il.logged_by_user_id, NULL) AS logged_by_user_id,
    il.channel,
    il.summary,
    il.outcome,
    il.follow_up_at,
    il.logged_at,
    -- Try to resolve alumni → user_id (alumni.user_id column if table still exists)
    CASE
      WHEN OBJECT_ID('dbo.alumni') IS NOT NULL
        THEN (SELECT a.user_id FROM dbo.alumni a WHERE a.alumni_id = il.alumni_id)
      ELSE NULL
    END AS user_id
  INTO #InteractionData
  FROM dbo.interaction_log il;

  -- Drop all FKs referencing interaction_log
  DECLARE @DropILFKs NVARCHAR(MAX) = N'';
  SELECT @DropILFKs += N'ALTER TABLE '
      + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
      + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
      + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.interaction_log');
  IF LEN(@DropILFKs) > 0 EXEC sp_executesql @DropILFKs;

  -- Drop all FKs from interaction_log
  DECLARE @DropILOutFKs NVARCHAR(MAX) = N'';
  SELECT @DropILOutFKs += N'ALTER TABLE dbo.interaction_log DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE fk.parent_object_id = OBJECT_ID(N'dbo.interaction_log');
  IF LEN(@DropILOutFKs) > 0 EXEC sp_executesql @DropILOutFKs;

  DROP TABLE dbo.interaction_log;
  PRINT 'Dropped old dbo.interaction_log';
END
GO

CREATE TABLE dbo.interaction_log (
  id                 INT           NOT NULL IDENTITY(1,1)
                       CONSTRAINT PK_interaction_log PRIMARY KEY,
  user_id            INT           NOT NULL
                       CONSTRAINT FK_interaction_log_users  REFERENCES dbo.users(user_id) ON DELETE CASCADE,
  logged_by_user_id  INT           NULL
                       CONSTRAINT FK_interaction_log_logger REFERENCES dbo.users(user_id),
  channel            NVARCHAR(30)  NOT NULL,
  summary            NVARCHAR(MAX) NOT NULL,
  outcome            NVARCHAR(50)  NULL,
  follow_up_at       DATETIME2     NULL,
  logged_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_interaction_log_user   ON dbo.interaction_log(user_id);
CREATE INDEX IX_interaction_log_logger ON dbo.interaction_log(logged_by_user_id);
PRINT 'Created new dbo.interaction_log (user_id replaces alumni_id)';
GO

-- Restore backed-up rows
INSERT INTO dbo.interaction_log (id, user_id, logged_by_user_id, channel, summary, outcome, follow_up_at, logged_at)
SELECT id, ISNULL(user_id, logged_by_user_id), logged_by_user_id, channel, summary, outcome, follow_up_at, logged_at
FROM   #InteractionData
WHERE  ISNULL(user_id, logged_by_user_id) IS NOT NULL;
PRINT CONCAT('Restored ', @@ROWCOUNT, ' interaction_log row(s)');
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 11: Drop FKs from email_unsubscribes / outreach_messages
--             that reference players or alumni
-- ══════════════════════════════════════════════════════════════

DECLARE @DropOrphanFKs NVARCHAR(MAX) = N'';
SELECT @DropOrphanFKs += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
    + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
    + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id IN (
  OBJECT_ID(N'dbo.players'),
  OBJECT_ID(N'dbo.alumni')
);
IF LEN(@DropOrphanFKs) > 0
BEGIN
  EXEC sp_executesql @DropOrphanFKs;
  PRINT 'Dropped FK constraints from email_unsubscribes/outreach_messages → players/alumni';
END
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 12: DROP dbo.player_stats
-- ══════════════════════════════════════════════════════════════

IF OBJECT_ID('dbo.player_stats', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.player_stats;
  PRINT 'Dropped dbo.player_stats';
END
ELSE PRINT 'dbo.player_stats not found — skipped';
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 13: DROP dbo.alumni
-- ══════════════════════════════════════════════════════════════

IF OBJECT_ID('dbo.alumni', 'U') IS NOT NULL
BEGIN
  DECLARE @DropAlumniFKs2 NVARCHAR(MAX) = N'';
  SELECT @DropAlumniFKs2 += N'ALTER TABLE '
      + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
      + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
      + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.alumni');
  IF LEN(@DropAlumniFKs2) > 0 EXEC sp_executesql @DropAlumniFKs2;

  DROP TABLE dbo.alumni;
  PRINT 'Dropped dbo.alumni';
END
ELSE PRINT 'dbo.alumni not found — skipped';
GO

-- ══════════════════════════════════════════════════════════════
-- SECTION 14: DROP dbo.players
-- ══════════════════════════════════════════════════════════════

IF OBJECT_ID('dbo.players', 'U') IS NOT NULL
BEGIN
  DECLARE @DropPlayerFKs NVARCHAR(MAX) = N'';
  SELECT @DropPlayerFKs += N'ALTER TABLE '
      + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
      + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
      + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
  FROM sys.foreign_keys fk
  WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.players');
  IF LEN(@DropPlayerFKs) > 0 EXEC sp_executesql @DropPlayerFKs;

  DROP TABLE dbo.players;
  PRINT 'Dropped dbo.players';
END
ELSE PRINT 'dbo.players not found — skipped';
GO

-- ══════════════════════════════════════════════════════════════
-- Verification
-- ══════════════════════════════════════════════════════════════

SELECT t.name AS table_name,
       (SELECT COUNT(*) FROM sys.columns WHERE object_id = t.object_id) AS column_count
FROM sys.tables t
WHERE t.schema_id = SCHEMA_ID('dbo')
ORDER BY t.name;

PRINT '=== Migration 008 complete ===';
GO
