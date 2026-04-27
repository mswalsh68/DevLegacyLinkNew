-- ============================================================
-- 005_players_alumni_tables.sql
-- Creates dbo.players and dbo.alumni, and repairs all support
-- tables that had GUID user_id FK columns pointing at the old
-- monolithic dbo.users (which was replaced by migration 004_repair2).
--
-- Run on: LegacyLinkApp ONLY
-- Prerequisite: 004_repair2.sql must have already been applied.
-- ============================================================
-- Schema changes in this migration:
--   NEW TABLES:
--     dbo.players      — active roster (player_id INT = user_id INT)
--     dbo.alumni       — graduated/imported alumni (alumni_id IDENTITY INT)
--   DROPPED & RECREATED (data loss OK — dev env, old refs broken):
--     dbo.player_stats      — user_id GUID → player_id INT FK players
--     dbo.interaction_log   — user_id GUID → alumni_id INT FK alumni
--     dbo.graduation_log    — user_id GUID → player_id INT, alumni_id INT
--     dbo.feed_post_reads   — user_id GUID → user_id INT FK users
--     dbo.email_unsubscribes— user_id GUID → player_id + alumni_id INT
--     dbo.outreach_messages — user_id GUID → player_id + alumni_id INT
--     dbo.users_sports      — user_id GUID → user_id INT FK users
-- ============================================================

USE LegacyLinkApp
GO

-- ─── 1. Create dbo.players ────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'players' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.players (
    -- player_id mirrors dbo.users.user_id — same INT, one-to-one
    player_id               INT              NOT NULL
                              CONSTRAINT PK_players PRIMARY KEY
                              CONSTRAINT FK_players_users FOREIGN KEY REFERENCES dbo.users(user_id) ON DELETE CASCADE,

    sport_id                UNIQUEIDENTIFIER NULL
                              CONSTRAINT FK_players_sports FOREIGN KEY REFERENCES dbo.sports(id),

    jersey_number           TINYINT          NULL,
    position                NVARCHAR(10)     NULL,
    academic_year           NVARCHAR(20)     NULL,
    recruiting_class        SMALLINT         NULL,
    height_inches           TINYINT          NULL,
    weight_lbs              SMALLINT         NULL,
    home_town               NVARCHAR(100)    NULL,
    home_state              NVARCHAR(50)     NULL,
    high_school             NVARCHAR(150)    NULL,
    major                   NVARCHAR(100)    NULL,
    phone                   NVARCHAR(20)     NULL,
    personal_email          NVARCHAR(255)    NULL,
    instagram               NVARCHAR(100)    NULL,
    twitter                 NVARCHAR(100)    NULL,
    snapchat                NVARCHAR(100)    NULL,
    emergency_contact_name  NVARCHAR(150)    NULL,
    emergency_contact_phone NVARCHAR(20)     NULL,
    parent1_name            NVARCHAR(150)    NULL,
    parent1_phone           NVARCHAR(20)     NULL,
    parent1_email           NVARCHAR(255)    NULL,
    parent2_name            NVARCHAR(150)    NULL,
    parent2_phone           NVARCHAR(20)     NULL,
    parent2_email           NVARCHAR(255)    NULL,
    notes                   NVARCHAR(MAX)    NULL,

    is_active               BIT              NOT NULL DEFAULT 1,
    created_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at              DATETIME2        NULL
  );

  -- Unique jersey numbers per active sport (NULL jersey OK for multiple players)
  CREATE UNIQUE INDEX UQ_players_jersey_sport
    ON dbo.players (jersey_number, sport_id)
    WHERE jersey_number IS NOT NULL AND is_active = 1 AND sport_id IS NOT NULL;

  PRINT 'Created dbo.players';
END
ELSE
  PRINT 'dbo.players already exists — skipped';
GO

-- ─── 2. Create dbo.alumni ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'alumni' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.alumni (
    alumni_id               INT              NOT NULL IDENTITY(1,1)
                              CONSTRAINT PK_alumni PRIMARY KEY,

    -- NULL if imported without a global account; set when they claim their account
    user_id                 INT              NULL
                              CONSTRAINT FK_alumni_users FOREIGN KEY REFERENCES dbo.users(user_id),

    -- Non-NULL when this alumni graduated through sp_GraduatePlayer
    source_player_id        INT              NULL
                              CONSTRAINT FK_alumni_players FOREIGN KEY REFERENCES dbo.players(player_id),

    -- Core identity (copied from players at graduation, or provided on direct import)
    first_name              NVARCHAR(100)    NOT NULL,
    last_name               NVARCHAR(100)    NOT NULL,
    email                   NVARCHAR(255)    NULL,   -- global account email (NULL for historical imports)

    -- Athletic context
    sport_id                UNIQUEIDENTIFIER NULL
                              CONSTRAINT FK_alumni_sports FOREIGN KEY REFERENCES dbo.sports(id),
    position                NVARCHAR(10)     NULL,
    recruiting_class        SMALLINT         NULL,
    graduation_year         SMALLINT         NOT NULL,
    graduation_semester     NVARCHAR(10)     NOT NULL DEFAULT 'spring',
    graduated_at            DATETIME2        NULL,

    -- Contact
    phone                   NVARCHAR(20)     NULL,
    personal_email          NVARCHAR(255)    NULL,
    linkedin_url            NVARCHAR(500)    NULL,
    twitter_url             NVARCHAR(100)    NULL,

    -- Career
    current_employer        NVARCHAR(200)    NULL,
    current_job_title       NVARCHAR(150)    NULL,
    current_city            NVARCHAR(100)    NULL,
    current_state           NVARCHAR(50)     NULL,

    -- Engagement / giving
    is_donor                BIT              NOT NULL DEFAULT 0,
    last_donation_date      DATE             NULL,
    total_donations         DECIMAL(10,2)    NOT NULL DEFAULT 0,
    engagement_score        TINYINT          NOT NULL DEFAULT 0,
    communication_consent   BIT              NOT NULL DEFAULT 1,
    years_on_roster         TINYINT          NULL,

    notes                   NVARCHAR(MAX)    NULL,
    created_at              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at              DATETIME2        NULL
  );

  CREATE UNIQUE INDEX UQ_alumni_user_id ON dbo.alumni(user_id) WHERE user_id IS NOT NULL;
  CREATE INDEX IX_alumni_sport          ON dbo.alumni(sport_id);
  CREATE INDEX IX_alumni_graduation     ON dbo.alumni(graduation_year);

  PRINT 'Created dbo.alumni';
END
ELSE
  PRINT 'dbo.alumni already exists — skipped';
GO

-- ─── 3. Drop & recreate dbo.player_stats ─────────────────────────────────────
-- Old: user_id UNIQUEIDENTIFIER FK → dbo.users(id)  [broken — users.id no longer exists]
-- New: player_id INT FK → dbo.players(player_id)
IF OBJECT_ID('dbo.player_stats', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.player_stats;
  PRINT 'Dropped old dbo.player_stats';
END

CREATE TABLE dbo.player_stats (
  id           INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
  player_id    INT           NOT NULL
                 CONSTRAINT FK_player_stats_players FOREIGN KEY REFERENCES dbo.players(player_id) ON DELETE CASCADE,
  season_year  SMALLINT      NOT NULL,
  games_played TINYINT       NULL,
  stats_json   NVARCHAR(MAX) NULL,
  updated_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_player_stats UNIQUE (player_id, season_year)
);
PRINT 'Created new dbo.player_stats';
GO

-- ─── 4. Drop & recreate dbo.interaction_log ──────────────────────────────────
-- Old: user_id UNIQUEIDENTIFIER FK → dbo.users(id)  [broken]
-- New: alumni_id INT FK → dbo.alumni(alumni_id)
--      logged_by_user_id INT FK → dbo.users(user_id)  (the staff member who logged it)
IF OBJECT_ID('dbo.interaction_log', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.interaction_log;
  PRINT 'Dropped old dbo.interaction_log';
END

CREATE TABLE dbo.interaction_log (
  id                 INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
  alumni_id          INT           NOT NULL
                       CONSTRAINT FK_interaction_log_alumni FOREIGN KEY REFERENCES dbo.alumni(alumni_id) ON DELETE CASCADE,
  logged_by_user_id  INT           NULL
                       CONSTRAINT FK_interaction_log_users FOREIGN KEY REFERENCES dbo.users(user_id),
  channel            NVARCHAR(30)  NOT NULL,
  summary            NVARCHAR(MAX) NOT NULL,
  outcome            NVARCHAR(50)  NULL,
  follow_up_at       DATETIME2     NULL,
  logged_at          DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_interaction_log_alumni ON dbo.interaction_log(alumni_id);
PRINT 'Created new dbo.interaction_log';
GO

-- ─── 5. Drop & recreate dbo.graduation_log ───────────────────────────────────
-- Old: user_id UNIQUEIDENTIFIER, triggered_by UNIQUEIDENTIFIER  [both broken]
-- New: player_id INT (the player who was graduated)
--      alumni_id INT NULL (the resulting alumni row; NULL on failure)
IF OBJECT_ID('dbo.graduation_log', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.graduation_log;
  PRINT 'Dropped old dbo.graduation_log';
END

CREATE TABLE dbo.graduation_log (
  id                   INT              NOT NULL IDENTITY(1,1) PRIMARY KEY,
  transaction_id       UNIQUEIDENTIFIER NOT NULL,
  player_id            INT              NOT NULL,  -- player at time of graduation (may be is_active=0 now)
  alumni_id            INT              NULL,      -- resulting alumni row (NULL if the insert failed)
  graduation_year      SMALLINT         NOT NULL,
  graduation_semester  NVARCHAR(10)     NOT NULL,
  triggered_by_user_id INT              NULL,      -- staff user_id who triggered the graduation
  status               NVARCHAR(20)     NOT NULL DEFAULT 'success',
  notes                NVARCHAR(MAX)    NULL,
  logged_at            DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_graduation_log_txn    ON dbo.graduation_log(transaction_id);
CREATE INDEX IX_graduation_log_player ON dbo.graduation_log(player_id);
PRINT 'Created new dbo.graduation_log';
GO

-- ─── 6. Drop & recreate dbo.feed_post_reads ──────────────────────────────────
-- Old: user_id UNIQUEIDENTIFIER FK → dbo.users(id)  [broken]
-- New: user_id INT FK → dbo.users(user_id)  (any logged-in user who reads a post)
IF OBJECT_ID('dbo.feed_post_reads', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.feed_post_reads;
  PRINT 'Dropped old dbo.feed_post_reads';
END

CREATE TABLE dbo.feed_post_reads (
  id      INT              NOT NULL IDENTITY(1,1) PRIMARY KEY,
  post_id UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.feed_posts(id) ON DELETE CASCADE,
  user_id INT              NOT NULL REFERENCES dbo.users(user_id),
  read_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_post_read UNIQUE (post_id, user_id)
);
CREATE INDEX IX_feed_reads_post ON dbo.feed_post_reads(post_id);
CREATE INDEX IX_feed_reads_user ON dbo.feed_post_reads(user_id);
PRINT 'Created new dbo.feed_post_reads';
GO

-- ─── 7. Drop & recreate dbo.email_unsubscribes ───────────────────────────────
-- Old: user_id UNIQUEIDENTIFIER FK → dbo.users(id)  [broken]
-- New: player_id INT NULL FK → dbo.players, alumni_id INT NULL FK → dbo.alumni
--      Exactly one of player_id / alumni_id is non-NULL per row.
IF OBJECT_ID('dbo.email_unsubscribes', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.email_unsubscribes;
  PRINT 'Dropped old dbo.email_unsubscribes';
END

CREATE TABLE dbo.email_unsubscribes (
  id              INT              NOT NULL IDENTITY(1,1) PRIMARY KEY,
  player_id       INT              NULL REFERENCES dbo.players(player_id) ON DELETE CASCADE,
  alumni_id       INT              NULL REFERENCES dbo.alumni(alumni_id),
  token           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
  channel         NVARCHAR(20)     NOT NULL DEFAULT 'email',
  unsubscribed_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CHK_unsub_recipient CHECK (
    (player_id IS NOT NULL AND alumni_id IS NULL) OR
    (player_id IS NULL AND alumni_id IS NOT NULL)
  )
);
-- Filtered unique indexes must be created outside CREATE TABLE in SQL Server
CREATE UNIQUE INDEX UQ_unsub_player_channel    ON dbo.email_unsubscribes(player_id, channel) WHERE player_id IS NOT NULL;
CREATE UNIQUE INDEX UQ_unsub_alumni_channel     ON dbo.email_unsubscribes(alumni_id,  channel) WHERE alumni_id  IS NOT NULL;
CREATE UNIQUE INDEX UQ_email_unsubscribes_token ON dbo.email_unsubscribes(token);
PRINT 'Created new dbo.email_unsubscribes';
GO

-- ─── 8. Drop & recreate dbo.outreach_messages ────────────────────────────────
-- Old: user_id UNIQUEIDENTIFIER FK → dbo.users(id)  [broken]
-- New: player_id INT NULL FK → dbo.players, alumni_id INT NULL FK → dbo.alumni
--      Exactly one non-NULL.

-- Drop any FKs from other tables that reference dbo.outreach_messages before dropping
DECLARE @DropOMFKs NVARCHAR(MAX) = N'';
SELECT @DropOMFKs += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
                   + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
                   + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.outreach_messages');
IF LEN(@DropOMFKs) > 0 EXEC sp_executesql @DropOMFKs;

IF OBJECT_ID('dbo.outreach_messages', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.outreach_messages;
  PRINT 'Dropped old dbo.outreach_messages';
END

CREATE TABLE dbo.outreach_messages (
  id                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  campaign_id         UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.outreach_campaigns(id) ON DELETE CASCADE,
  player_id           INT              NULL REFERENCES dbo.players(player_id),
  alumni_id           INT              NULL REFERENCES dbo.alumni(alumni_id),
  channel             NVARCHAR(20)     NOT NULL,
  status              NVARCHAR(20)     NOT NULL DEFAULT 'queued',
  email_address       NVARCHAR(255)    NULL,
  unsubscribe_token   UNIQUEIDENTIFIER NULL,
  sent_at             DATETIME2        NULL,
  delivered_at        DATETIME2        NULL,
  opened_at           DATETIME2        NULL,
  created_at          DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CHK_om_recipient CHECK (
    (player_id IS NOT NULL AND alumni_id IS NULL) OR
    (player_id IS NULL AND alumni_id IS NOT NULL)
  )
);
CREATE INDEX IX_outreach_messages_campaign ON dbo.outreach_messages(campaign_id);
CREATE INDEX IX_outreach_messages_player   ON dbo.outreach_messages(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IX_outreach_messages_alumni   ON dbo.outreach_messages(alumni_id) WHERE alumni_id IS NOT NULL;
PRINT 'Created new dbo.outreach_messages';
GO

-- ─── 9. Drop & recreate dbo.users_sports ─────────────────────────────────────
-- Old: user_id UNIQUEIDENTIFIER FK → dbo.users(id)  [broken]
-- New: user_id INT FK → dbo.users(user_id)
--      Used by staff users to grant sport-specific access.
IF OBJECT_ID('dbo.users_sports', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.users_sports;
  PRINT 'Dropped old dbo.users_sports';
END

CREATE TABLE dbo.users_sports (
  id        INT              NOT NULL IDENTITY(1,1) PRIMARY KEY,
  user_id   INT              NOT NULL REFERENCES dbo.users(user_id) ON DELETE CASCADE,
  sport_id  UNIQUEIDENTIFIER NOT NULL REFERENCES dbo.sports(id)    ON DELETE CASCADE,
  username  NVARCHAR(100)    NULL,
  joined_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_users_sports UNIQUE (user_id, sport_id)
);
PRINT 'Created new dbo.users_sports';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT 'dbo.players'            AS table_name, COUNT(*) AS row_count FROM dbo.players
UNION ALL
SELECT 'dbo.alumni',              COUNT(*) FROM dbo.alumni
UNION ALL
SELECT 'dbo.player_stats',        COUNT(*) FROM dbo.player_stats
UNION ALL
SELECT 'dbo.interaction_log',     COUNT(*) FROM dbo.interaction_log
UNION ALL
SELECT 'dbo.graduation_log',      COUNT(*) FROM dbo.graduation_log
UNION ALL
SELECT 'dbo.feed_post_reads',     COUNT(*) FROM dbo.feed_post_reads
UNION ALL
SELECT 'dbo.email_unsubscribes',  COUNT(*) FROM dbo.email_unsubscribes
UNION ALL
SELECT 'dbo.outreach_messages',   COUNT(*) FROM dbo.outreach_messages
UNION ALL
SELECT 'dbo.users_sports',        COUNT(*) FROM dbo.users_sports;

PRINT '=== 005_players_alumni_tables complete ===';
GO
