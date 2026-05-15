-- ============================================================
-- Migration 041: Release notes tables and stored procedure
--
-- Tables:
--   dbo.release_notes         — one row per version
--   dbo.release_note_sections — New Features / Improvements / Bug Fixes
--   dbo.release_note_items    — individual bullet points
--
-- SP:
--   dbo.sp_GetReleaseNotes    — returns all published releases with
--                               sections and items as nested JSON
--
-- Run on: DevLegacyLinkGlobal
-- Run after: 040_post_audience_permissions.sql
-- ============================================================

-- ── Tables ────────────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'release_notes')
BEGIN
    CREATE TABLE dbo.release_notes (
        id           INT           IDENTITY(1,1) PRIMARY KEY,
        version      NVARCHAR(20)  NOT NULL,          -- e.g. 'v1.6.0'
        release_date DATE          NOT NULL,
        is_published BIT           NOT NULL DEFAULT 1,
        created_at   DATETIME2     NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Created dbo.release_notes';
END
ELSE
    PRINT 'dbo.release_notes already exists — skipping';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'release_note_sections')
BEGIN
    CREATE TABLE dbo.release_note_sections (
        id         INT           IDENTITY(1,1) PRIMARY KEY,
        release_id INT           NOT NULL REFERENCES dbo.release_notes(id) ON DELETE CASCADE,
        label      NVARCHAR(50)  NOT NULL,   -- 'New Features' | 'Improvements' | 'Bug Fixes'
        color      NVARCHAR(20)  NOT NULL,   -- hex text colour for the badge
        bg         NVARCHAR(20)  NOT NULL,   -- hex background colour for the badge
        sort_order INT           NOT NULL DEFAULT 0
    );
    PRINT 'Created dbo.release_note_sections';
END
ELSE
    PRINT 'dbo.release_note_sections already exists — skipping';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'release_note_items')
BEGIN
    CREATE TABLE dbo.release_note_items (
        id         INT            IDENTITY(1,1) PRIMARY KEY,
        section_id INT            NOT NULL REFERENCES dbo.release_note_sections(id) ON DELETE CASCADE,
        body       NVARCHAR(1000) NOT NULL,
        sort_order INT            NOT NULL DEFAULT 0
    );
    PRINT 'Created dbo.release_note_items';
END
ELSE
    PRINT 'dbo.release_note_items already exists — skipping';
GO

-- ── Stored procedure ──────────────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_GetReleaseNotes
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    rn.version,
    FORMAT(rn.release_date, 'MMMM d, yyyy') AS releaseDate,
    (
      SELECT
        rns.label,
        rns.color,
        rns.bg,
        (
          SELECT rni.body
          FROM   dbo.release_note_items rni
          WHERE  rni.section_id = rns.id
          ORDER  BY rni.sort_order
          FOR JSON PATH, ROOT('items')
        ) AS itemsJson
      FROM   dbo.release_note_sections rns
      WHERE  rns.release_id = rn.id
      ORDER  BY rns.sort_order
      FOR JSON PATH
    ) AS sectionsJson
  FROM   dbo.release_notes rn
  WHERE  rn.is_published = 1
  ORDER  BY rn.release_date DESC;
END;
GO

PRINT 'sp_GetReleaseNotes created';
GO

-- ── Seed: existing releases ───────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM dbo.release_notes)
BEGIN

  -- ── v1.0.0 ──────────────────────────────────────────────────────────────────
  DECLARE @id10 INT;
  INSERT INTO dbo.release_notes (version, release_date) VALUES ('v1.0.0', '2026-05-13');
  SET @id10 = SCOPE_IDENTITY();

  DECLARE @s10a INT, @s10b INT, @s10c INT;
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id10, 'New Features',  '#16a34a', '#f0fdf4', 0); SET @s10a = SCOPE_IDENTITY();
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id10, 'Improvements',  '#2563eb', '#eff6ff', 1); SET @s10b = SCOPE_IDENTITY();
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id10, 'Bug Fixes',     '#dc2626', '#fef2f2', 2); SET @s10c = SCOPE_IDENTITY();

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s10a, 'Two-tier role architecture — global roles and program roles', 0),
    (@s10a, 'Roster and alumni management with sport filtering', 1),
    (@s10a, 'Staff management page', 2),
    (@s10a, 'Feed with sport tagging and pinned welcome posts', 3),
    (@s10a, 'Mentor program (Elite tier)', 4),
    (@s10a, 'Team switcher with per-team theme support', 5),
    (@s10a, 'Tier-based dashboard tabs and feature flags', 6),
    (@s10a, 'Invite, claim, and member signup flows', 7),
    (@s10a, 'Community consent gate', 8),
    (@s10a, 'Welcome popup for new members', 9);

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s10b, 'Azure SQL cross-database coordination layer', 0),
    (@s10b, 'Responsive UI with compact filter bars', 1),
    (@s10b, 'Session-based team and role resolution', 2);

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s10c, 'Fixed tierId feature flag resolving as string instead of number', 0),
    (@s10c, 'Fixed case-insensitive tier normalization', 1),
    (@s10c, 'Fixed dashboard metric routes using session tierId', 2),
    (@s10c, 'Fixed mentor program stored procedure column references', 3);

  -- ── v1.4.0 ──────────────────────────────────────────────────────────────────
  DECLARE @id14 INT;
  INSERT INTO dbo.release_notes (version, release_date) VALUES ('v1.4.0', '2026-05-13');
  SET @id14 = SCOPE_IDENTITY();

  DECLARE @s14a INT, @s14b INT;
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id14, 'New Features',  '#16a34a', '#f0fdf4', 0); SET @s14a = SCOPE_IDENTITY();
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id14, 'Improvements',  '#2563eb', '#eff6ff', 1); SET @s14b = SCOPE_IDENTITY();

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s14a, 'Release notes page in user profile navigation', 0),
    (@s14a, 'Dashboard tile reordering — Feed, Alumni, Roster, Mentor, Staff, Add Member, Settings', 1);

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s14b, 'Real screenshots wired into marketing landing page', 0),
    (@s14b, 'Fixed demo metrics seed script compatibility with SQL Server', 1);

  -- ── v1.5.0 ──────────────────────────────────────────────────────────────────
  DECLARE @id15 INT;
  INSERT INTO dbo.release_notes (version, release_date) VALUES ('v1.5.0', '2026-05-14');
  SET @id15 = SCOPE_IDENTITY();

  DECLARE @s15a INT, @s15b INT, @s15c INT;
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id15, 'New Features',  '#16a34a', '#f0fdf4', 0); SET @s15a = SCOPE_IDENTITY();
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id15, 'Improvements',  '#2563eb', '#eff6ff', 1); SET @s15b = SCOPE_IDENTITY();
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id15, 'Bug Fixes',     '#dc2626', '#fef2f2', 2); SET @s15c = SCOPE_IDENTITY();

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s15a, 'Post and email audience enforcement by role and tier', 0),
    (@s15a, 'Tier 1 and alumni accounts locked to alumni-only recipients at UI and API level', 1),
    (@s15a, 'Create Email redesigned — explicit audience/recipient selection matching Create Post', 2);

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s15b, 'Marketing landing page screenshots live', 0);

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s15c, 'Fixed image filenames with spaces breaking URLs', 0),
    (@s15c, 'Fixed invalid audience values passed to feed API from email modal', 1);

  -- ── v1.6.0 ──────────────────────────────────────────────────────────────────
  DECLARE @id16 INT;
  INSERT INTO dbo.release_notes (version, release_date) VALUES ('v1.6.0', '2026-05-15');
  SET @id16 = SCOPE_IDENTITY();

  DECLARE @s16a INT, @s16b INT, @s16c INT;
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id16, 'New Features',  '#16a34a', '#f0fdf4', 0); SET @s16a = SCOPE_IDENTITY();
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id16, 'Improvements',  '#2563eb', '#eff6ff', 1); SET @s16b = SCOPE_IDENTITY();
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id16, 'Bug Fixes',     '#dc2626', '#fef2f2', 2); SET @s16c = SCOPE_IDENTITY();

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s16a, 'Create Email full page at /email/new — matches Create Post layout and functionality', 0),
    (@s16a, 'Unsubscribe page — public page linked from every email footer', 1),
    (@s16a, 'Email re-subscribe — users can opt back in from their profile page', 2);

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s16b, 'CAN-SPAM footer updated to Legacy Link HQ, LLC', 0),
    (@s16b, 'Unsubscribe URLs now use correct domain per environment (dev vs production)', 1);

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s16c, 'Fixed unsubscribe API resolving app DB without a session', 0),
    (@s16c, 'Fixed unsubscribe token type mismatch in mssql driver', 1),
    (@s16c, 'Fixed useSearchParams missing Suspense boundary on unsubscribe page', 2);

  PRINT 'Seeded release notes for v1.0.0, v1.4.0, v1.5.0, v1.6.0';
END
ELSE
    PRINT 'release_notes already has data — skipping seed';
GO

PRINT 'Migration 041 complete';
GO
