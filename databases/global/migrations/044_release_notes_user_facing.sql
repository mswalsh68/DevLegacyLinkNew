-- ============================================================
-- Migration 044: Release notes — add is_user_facing column
--
-- Adds is_user_facing BIT NOT NULL DEFAULT 1 to dbo.release_notes.
-- Controls whether a release appears on the user-facing release notes
-- page. Internal / patch releases can be stored for record-keeping
-- without being shown to users.
--
--   is_published = 1, is_user_facing = 1  → visible to users
--   is_published = 1, is_user_facing = 0  → internal record only
--
-- sp_GetReleaseNotes updated to filter on is_user_facing = 1.
-- All existing rows default to 1 — no change to current display.
--
-- Run on: LegacyLinkGlobal (or DevLegacyLinkGlobal for dev)
-- Run after: 043_release_notes_semver_sort_and_backfill.sql
-- ============================================================

-- ── Add column (idempotent) ───────────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.release_notes')
    AND name = 'is_user_facing'
)
BEGIN
  ALTER TABLE dbo.release_notes
    ADD is_user_facing BIT NOT NULL DEFAULT 1;
  PRINT 'Added is_user_facing column';
END
ELSE
  PRINT 'is_user_facing already exists — skipping ALTER';
GO

-- ── sp_GetReleaseNotes (filters on is_user_facing) ───────────────────────────
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
  WHERE  rn.is_published    = 1
    AND  rn.is_user_facing  = 1
  ORDER BY
    CAST(PARSENAME(REPLACE(rn.version, 'v', ''), 3) AS INT) DESC,
    CAST(PARSENAME(REPLACE(rn.version, 'v', ''), 2) AS INT) DESC,
    CAST(PARSENAME(REPLACE(rn.version, 'v', ''), 1) AS INT) DESC;
END;
GO

-- ── Insert v1.8.1 (internal patch — not shown to users) ──────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.release_notes WHERE version = 'v1.8.1')
BEGIN
  DECLARE @id INT;
  INSERT INTO dbo.release_notes (version, release_date, is_published, is_user_facing)
  VALUES ('v1.8.1', '2026-05-16', 1, 0);
  SET @id = SCOPE_IDENTITY();

  DECLARE @s INT;
  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order)
  VALUES (@id, 'Bug Fixes', '#dc2626', '#fef2f2', 0);
  SET @s = SCOPE_IDENTITY();

  INSERT INTO dbo.release_note_items (section_id, body, sort_order) VALUES
    (@s, 'Admin-created coaches and staff no longer land on the Awaiting Approval screen after claiming their account. The claim flow now checks team membership directly to determine whether to skip the approval queue.', 0);

  PRINT 'Inserted v1.8.1 (internal)';
END
ELSE
  PRINT 'v1.8.1 already exists — skipping';
GO

PRINT 'Migration 044 complete';
GO
