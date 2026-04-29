-- ============================================================
-- 007_reorder_pk_fk_columns.sql
-- Run on: LegacyLinkApp (and every tenant App DB)
-- Run after: 006_bigint_user_ids.sql
-- ============================================================
-- SQL Server does not support reordering columns in-place.
-- Three tables are rebuilt with PK/FK columns first.
--
-- dbo.users:
--   Before: user_id (PK), email, first_name, last_name,
--           platform_role, program_role_id (FK), last_team_login, synced_at
--   After:  user_id (PK), program_role_id (FK),
--           email, first_name, last_name, platform_role,
--           last_team_login, synced_at
--
-- dbo.alumni:
--   Before: alumni_id (PK), user_id (FK), source_player_id (FK),
--           first_name, last_name, email, sport_id (FK), ...
--   After:  alumni_id (PK), user_id (FK), source_player_id (FK), sport_id (FK),
--           first_name, last_name, email, ...
--
-- dbo.graduation_log:
--   Before: id (PK), transaction_id, player_id, alumni_id, graduation_year,
--           graduation_semester, triggered_by_user_id, status, notes, logged_at
--   After:  id (PK), player_id, alumni_id, triggered_by_user_id,
--           transaction_id, graduation_year, graduation_semester,
--           status, notes, logged_at
-- ============================================================

USE LegacyLinkApp
GO

-- ─── Helper: dynamically drop all FKs on a given table column ────────────────

-- We'll use this pattern inline for each column rather than a proc,
-- since procedures can't be created/dropped within a migration cleanly.

-- ═══════════════════════════════════════════════════════════════════
-- SECTION A: dbo.users
-- ═══════════════════════════════════════════════════════════════════

-- ─── A0. Back up users data ───────────────────────────────────────────────────

IF OBJECT_ID('tempdb..#UsersData') IS NOT NULL DROP TABLE #UsersData;

SELECT user_id, program_role_id, email, first_name, last_name,
       platform_role, last_team_login, synced_at
INTO   #UsersData
FROM   dbo.users;
PRINT CONCAT('Backed up ', @@ROWCOUNT, ' users row(s)');
GO

-- ─── A1. Drop all FKs that reference dbo.users(user_id) ──────────────────────

DECLARE @DropUserFKs NVARCHAR(MAX) = N'';
SELECT @DropUserFKs += N'ALTER TABLE '
    + QUOTENAME(OBJECT_SCHEMA_NAME(fk.parent_object_id))
    + N'.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
    + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.users');
IF LEN(@DropUserFKs) > 0
BEGIN
  EXEC sp_executesql @DropUserFKs;
  PRINT 'Dropped all FK constraints referencing dbo.users';
END
GO

-- Also drop the FK from users → program_role so we can drop users
DECLARE @DropPRFK NVARCHAR(MAX) = N'';
SELECT @DropPRFK += N'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(fk.name) + N'; '
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID(N'dbo.users');
IF LEN(@DropPRFK) > 0
BEGIN
  EXEC sp_executesql @DropPRFK;
  PRINT 'Dropped FK constraints from dbo.users';
END
GO

-- ─── A2. Drop and recreate dbo.users ─────────────────────────────────────────

DROP TABLE dbo.users;
PRINT 'Dropped dbo.users';
GO

CREATE TABLE dbo.users (
  user_id         INT           NOT NULL
                    CONSTRAINT PK_app_users PRIMARY KEY,
  program_role_id INT           NULL
                    CONSTRAINT FK_app_users_program_role
                      FOREIGN KEY REFERENCES dbo.program_role(id),
  email           NVARCHAR(255) NOT NULL,
  first_name      NVARCHAR(100) NOT NULL,
  last_name       NVARCHAR(100) NOT NULL,
  platform_role   NVARCHAR(50)  NOT NULL DEFAULT 'player',
  last_team_login DATETIME2     NULL,
  synced_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX UQ_app_users_email ON dbo.users(email);
PRINT 'Created dbo.users (program_role_id FK second)';
GO

-- ─── A3. Restore users data ───────────────────────────────────────────────────

INSERT INTO dbo.users (user_id, program_role_id, email, first_name, last_name,
                       platform_role, last_team_login, synced_at)
SELECT                  user_id, program_role_id, email, first_name, last_name,
                        platform_role, last_team_login, synced_at
FROM #UsersData;
PRINT CONCAT('Restored ', @@ROWCOUNT, ' users row(s)');
GO

-- ─── A4. Re-add FK constraints on tables that reference users ─────────────────

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_players_users')
  ALTER TABLE dbo.players ADD CONSTRAINT FK_players_users
    FOREIGN KEY (player_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_alumni_users')
  ALTER TABLE dbo.alumni ADD CONSTRAINT FK_alumni_users
    FOREIGN KEY (user_id) REFERENCES dbo.users(user_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_interaction_log_users')
  ALTER TABLE dbo.interaction_log ADD CONSTRAINT FK_interaction_log_users
    FOREIGN KEY (logged_by_user_id) REFERENCES dbo.users(user_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_feed_post_reads_users')
  ALTER TABLE dbo.feed_post_reads ADD CONSTRAINT FK_feed_post_reads_users
    FOREIGN KEY (user_id) REFERENCES dbo.users(user_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_sports_users')
  ALTER TABLE dbo.users_sports ADD CONSTRAINT FK_users_sports_users
    FOREIGN KEY (user_id) REFERENCES dbo.users(user_id);

PRINT 'Re-added FK constraints referencing dbo.users';
GO

-- ═══════════════════════════════════════════════════════════════════
-- SECTION B: dbo.alumni
-- ═══════════════════════════════════════════════════════════════════

-- ─── B0. Back up alumni data ──────────────────────────────────────────────────

IF OBJECT_ID('tempdb..#AlumniData') IS NOT NULL DROP TABLE #AlumniData;

SELECT
  alumni_id, user_id, source_player_id, sport_id,
  first_name, last_name, email,
  position, recruiting_class,
  graduation_year, graduation_semester, graduated_at,
  phone, personal_email, linkedin_url, twitter_url,
  current_employer, current_job_title, current_city, current_state,
  is_donor, last_donation_date, total_donations,
  engagement_score, communication_consent, years_on_roster,
  notes, created_at, updated_at
INTO   #AlumniData
FROM   dbo.alumni;
PRINT CONCAT('Backed up ', @@ROWCOUNT, ' alumni row(s)');
GO

-- ─── B1. Drop FK from interaction_log → alumni ───────────────────────────────

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_interaction_log_alumni')
BEGIN
  ALTER TABLE dbo.interaction_log DROP CONSTRAINT FK_interaction_log_alumni;
  PRINT 'Dropped FK_interaction_log_alumni';
END
GO

-- ─── B2. Drop and recreate dbo.alumni ────────────────────────────────────────

DROP TABLE dbo.alumni;
PRINT 'Dropped dbo.alumni';
GO

CREATE TABLE dbo.alumni (
  alumni_id               INT              NOT NULL IDENTITY(1,1)
                            CONSTRAINT PK_alumni PRIMARY KEY,
  user_id                 INT              NULL
                            CONSTRAINT FK_alumni_users    FOREIGN KEY REFERENCES dbo.users(user_id),
  source_player_id        INT              NULL
                            CONSTRAINT FK_alumni_players  FOREIGN KEY REFERENCES dbo.players(player_id),
  sport_id                UNIQUEIDENTIFIER NULL
                            CONSTRAINT FK_alumni_sports   FOREIGN KEY REFERENCES dbo.sports(id),
  first_name              NVARCHAR(100)    NOT NULL,
  last_name               NVARCHAR(100)    NOT NULL,
  email                   NVARCHAR(255)    NULL,
  position                NVARCHAR(10)     NULL,
  recruiting_class        SMALLINT         NULL,
  graduation_year         SMALLINT         NOT NULL,
  graduation_semester     NVARCHAR(10)     NOT NULL DEFAULT 'spring',
  graduated_at            DATETIME2        NULL,
  phone                   NVARCHAR(20)     NULL,
  personal_email          NVARCHAR(255)    NULL,
  linkedin_url            NVARCHAR(500)    NULL,
  twitter_url             NVARCHAR(100)    NULL,
  current_employer        NVARCHAR(200)    NULL,
  current_job_title       NVARCHAR(150)    NULL,
  current_city            NVARCHAR(100)    NULL,
  current_state           NVARCHAR(50)     NULL,
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
PRINT 'Created dbo.alumni (sport_id FK fourth)';
GO

-- ─── B3. Restore alumni data (preserve IDENTITY values) ──────────────────────

SET IDENTITY_INSERT dbo.alumni ON;

INSERT INTO dbo.alumni (
  alumni_id, user_id, source_player_id, sport_id,
  first_name, last_name, email,
  position, recruiting_class,
  graduation_year, graduation_semester, graduated_at,
  phone, personal_email, linkedin_url, twitter_url,
  current_employer, current_job_title, current_city, current_state,
  is_donor, last_donation_date, total_donations,
  engagement_score, communication_consent, years_on_roster,
  notes, created_at, updated_at
)
SELECT
  alumni_id, user_id, source_player_id, sport_id,
  first_name, last_name, email,
  position, recruiting_class,
  graduation_year, graduation_semester, graduated_at,
  phone, personal_email, linkedin_url, twitter_url,
  current_employer, current_job_title, current_city, current_state,
  is_donor, last_donation_date, total_donations,
  engagement_score, communication_consent, years_on_roster,
  notes, created_at, updated_at
FROM #AlumniData;

SET IDENTITY_INSERT dbo.alumni OFF;
PRINT CONCAT('Restored ', @@ROWCOUNT, ' alumni row(s)');
GO

-- ─── B4. Re-add FK from interaction_log → alumni ─────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_interaction_log_alumni')
  ALTER TABLE dbo.interaction_log ADD CONSTRAINT FK_interaction_log_alumni
    FOREIGN KEY (alumni_id) REFERENCES dbo.alumni(alumni_id) ON DELETE CASCADE;

PRINT 'Re-added FK_interaction_log_alumni';
GO

-- ═══════════════════════════════════════════════════════════════════
-- SECTION C: dbo.graduation_log
-- ═══════════════════════════════════════════════════════════════════

-- ─── C0. Back up graduation_log ──────────────────────────────────────────────

IF OBJECT_ID('tempdb..#GradLogData') IS NOT NULL DROP TABLE #GradLogData;

SELECT id, player_id, alumni_id, triggered_by_user_id,
       transaction_id, graduation_year, graduation_semester,
       status, notes, logged_at
INTO   #GradLogData
FROM   dbo.graduation_log;
PRINT CONCAT('Backed up ', @@ROWCOUNT, ' graduation_log row(s)');
GO

-- ─── C1. Drop and recreate dbo.graduation_log ────────────────────────────────

DROP TABLE dbo.graduation_log;
PRINT 'Dropped dbo.graduation_log';
GO

CREATE TABLE dbo.graduation_log (
  id                   INT              NOT NULL IDENTITY(1,1) PRIMARY KEY,
  player_id            INT              NOT NULL,
  alumni_id            INT              NULL,
  triggered_by_user_id INT              NULL,
  transaction_id       UNIQUEIDENTIFIER NOT NULL,
  graduation_year      SMALLINT         NOT NULL,
  graduation_semester  NVARCHAR(10)     NOT NULL,
  status               NVARCHAR(20)     NOT NULL DEFAULT 'success',
  notes                NVARCHAR(MAX)    NULL,
  logged_at            DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_graduation_log_txn    ON dbo.graduation_log(transaction_id);
CREATE INDEX IX_graduation_log_player ON dbo.graduation_log(player_id);
PRINT 'Created dbo.graduation_log (player_id/alumni_id/triggered_by first)';
GO

-- ─── C2. Restore graduation_log (preserve IDENTITY) ──────────────────────────

SET IDENTITY_INSERT dbo.graduation_log ON;

INSERT INTO dbo.graduation_log (
  id, player_id, alumni_id, triggered_by_user_id,
  transaction_id, graduation_year, graduation_semester,
  status, notes, logged_at
)
SELECT
  id, player_id, alumni_id, triggered_by_user_id,
  transaction_id, graduation_year, graduation_semester,
  status, notes, logged_at
FROM #GradLogData;

SET IDENTITY_INSERT dbo.graduation_log OFF;
PRINT CONCAT('Restored ', @@ROWCOUNT, ' graduation_log row(s)');
GO

-- ─── Verification ─────────────────────────────────────────────────────────────

SELECT c.column_id, c.name, tp.name AS data_type, c.is_nullable
FROM   sys.columns c
JOIN   sys.types   tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id IN (
  OBJECT_ID('dbo.users'),
  OBJECT_ID('dbo.alumni'),
  OBJECT_ID('dbo.graduation_log')
)
ORDER  BY c.object_id, c.column_id;

PRINT '=== Migration 007 complete ===';
GO
