-- ============================================================
-- Migration 043: Release notes — semver ordering + backfill v1.1.0–v1.3.0
--
-- sp_GetReleaseNotes updated to sort by semantic version number
-- (PARSENAME on major.minor.patch) so backfilled records always
-- land in the correct position regardless of insert order.
--
-- Inserts v1.1.0, v1.2.0, v1.3.0 release notes pulled from
-- PR #159, #161, #164.
--
-- Run on: DevLegacyLinkGlobal
-- Run after: 042_release_notes_admin_sps.sql
-- ============================================================

-- ── sp_GetReleaseNotes (semver sort) ─────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_GetReleaseNotes
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    rn.id,
    rn.version,
    FORMAT(rn.release_date, 'MMMM d, yyyy')     AS releaseDate,
    CONVERT(NVARCHAR(10), rn.release_date, 120)  AS releaseDateRaw,
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
  ORDER BY
    CAST(PARSENAME(REPLACE(rn.version, 'v', ''), 3) AS INT) DESC,
    CAST(PARSENAME(REPLACE(rn.version, 'v', ''), 2) AS INT) DESC,
    CAST(PARSENAME(REPLACE(rn.version, 'v', ''), 1) AS INT) DESC;
END;
GO

-- ── Backfill v1.1.0 (PR #159 — 2026-05-13) ───────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.release_notes WHERE version = 'v1.1.0')
BEGIN
  DECLARE @id11 INT;
  INSERT INTO dbo.release_notes (version, release_date) VALUES ('v1.1.0', '2026-05-13');
  SET @id11 = SCOPE_IDENTITY();

  DECLARE @s11a INT, @s11b INT;
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id11, 'New Features', '#16a34a', '#f0fdf4', 0); SET @s11a = SCOPE_IDENTITY();
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id11, 'Improvements', '#2563eb', '#eff6ff', 1); SET @s11b = SCOPE_IDENTITY();

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s11a, 'Marketing landing page v2 — Hero, ScreenshotHero, Screenshots, SportsTicker, FounderStory, CTABand sections', 0),
    (@s11a, 'Features grid with tier badges (All Plans / Pro & Elite / Elite Only)', 1),
    (@s11a, 'Contact form with Program Level dropdown and Request a Demo CTA', 2),
    (@s11a, 'Favicon and browser tab title set to "Legacy Link HQ"', 3),
    (@s11a, 'Release notes page added to app', 4),
    (@s11a, 'Release notes linked from profile dropdown', 5);

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s11b, 'Footer expanded to 3 columns with updated copyright', 0),
    (@s11b, 'Who It''s For section updated with 3 audience cards matching plan tiers', 1),
    (@s11b, 'Pricing section removed — demo-only model', 2);

  PRINT 'Inserted v1.1.0';
END
ELSE
  PRINT 'v1.1.0 already exists — skipping';
GO

-- ── Backfill v1.2.0 (PR #161 — 2026-05-14) ───────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.release_notes WHERE version = 'v1.2.0')
BEGIN
  DECLARE @id12 INT;
  INSERT INTO dbo.release_notes (version, release_date) VALUES ('v1.2.0', '2026-05-14');
  SET @id12 = SCOPE_IDENTITY();

  DECLARE @s12a INT;
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id12, 'Improvements', '#2563eb', '#eff6ff', 0); SET @s12a = SCOPE_IDENTITY();

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s12a, 'Platform renamed to "LegacyLink" throughout app, sidebar, nav, footer, and marketing', 0),
    (@s12a, 'All "DevLegacyLink" references removed from user-facing code', 1),
    (@s12a, 'Copyright updated to "Legacy Link HQ, LLC"', 2),
    (@s12a, 'Contact email updated to hello@legacylinkhq.app', 3),
    (@s12a, 'Sidebar monogram updated from DL to LL', 4),
    (@s12a, '"Teamworks" replaced with "competitors" in Who It''s For', 5);

  PRINT 'Inserted v1.2.0';
END
ELSE
  PRINT 'v1.2.0 already exists — skipping';
GO

-- ── Backfill v1.3.0 (PR #164 — 2026-05-14) ───────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.release_notes WHERE version = 'v1.3.0')
BEGIN
  DECLARE @id13 INT;
  INSERT INTO dbo.release_notes (version, release_date) VALUES ('v1.3.0', '2026-05-14');
  SET @id13 = SCOPE_IDENTITY();

  DECLARE @s13a INT, @s13b INT;
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id13, 'New Features', '#16a34a', '#f0fdf4', 0); SET @s13a = SCOPE_IDENTITY();
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order) VALUES (@id13, 'Improvements', '#2563eb', '#eff6ff', 1); SET @s13b = SCOPE_IDENTITY();

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s13a, 'Founder story section — Mike Walsh story and photo on marketing landing page', 0),
    (@s13a, '"Always a Link" motto added as gold-accented blockquote', 1);

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s13b, 'Landing page Plans nav link removed', 0);

  PRINT 'Inserted v1.3.0';
END
ELSE
  PRINT 'v1.3.0 already exists — skipping';
GO

PRINT 'Migration 043 complete';
GO
