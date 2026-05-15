-- ============================================================
-- Migration 042: Release notes admin stored procedures
--
-- sp_GetReleaseNotes    — updated to also return id + releaseDateRaw
-- sp_CreateReleaseNote  — insert a new release
-- sp_UpdateReleaseNote  — update metadata + fully rebuild sections/items
-- sp_DeleteReleaseNote  — delete a release (cascade removes sections/items)
--
-- SectionsJson format for sp_UpdateReleaseNote:
-- [
--   {
--     "label":     "New Features",
--     "color":     "#16a34a",
--     "bg":        "#f0fdf4",
--     "sortOrder": 0,
--     "items":     [
--       { "body": "...", "sortOrder": 0 },
--       ...
--     ]
--   },
--   ...
-- ]
--
-- Run on: DevLegacyLinkGlobal
-- Run after: 041_release_notes.sql
-- ============================================================

-- ── sp_GetReleaseNotes (updated: adds id + releaseDateRaw) ───────────────────
CREATE OR ALTER PROCEDURE dbo.sp_GetReleaseNotes
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    rn.id,
    rn.version,
    FORMAT(rn.release_date, 'MMMM d, yyyy')              AS releaseDate,
    CONVERT(NVARCHAR(10), rn.release_date, 120)           AS releaseDateRaw,
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

-- ── sp_CreateReleaseNote ──────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_CreateReleaseNote
  @Version     NVARCHAR(20),
  @ReleaseDate DATE,
  @NewId       INT OUTPUT,
  @ErrorCode   NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @NewId     = NULL;

  IF EXISTS (SELECT 1 FROM dbo.release_notes WHERE version = @Version)
  BEGIN
    SET @ErrorCode = 'DUPLICATE_VERSION';
    RETURN;
  END

  INSERT INTO dbo.release_notes (version, release_date)
  VALUES (@Version, @ReleaseDate);

  SET @NewId = SCOPE_IDENTITY();
END;
GO

-- ── sp_UpdateReleaseNote ──────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_UpdateReleaseNote
  @Id           INT,
  @Version      NVARCHAR(20),
  @ReleaseDate  DATE,
  @SectionsJson NVARCHAR(MAX),   -- JSON array of sections with nested items
  @ErrorCode    NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.release_notes WHERE id = @Id)
  BEGIN
    SET @ErrorCode = 'NOT_FOUND';
    RETURN;
  END

  -- Update release metadata
  UPDATE dbo.release_notes
  SET    version      = @Version,
         release_date = @ReleaseDate
  WHERE  id = @Id;

  -- Rebuild sections and items (delete + re-insert)
  DELETE FROM dbo.release_note_sections WHERE release_id = @Id;

  INSERT INTO dbo.release_note_sections (release_id, label, color, bg, sort_order)
  SELECT
    @Id,
    s.label,
    s.color,
    s.bg,
    s.sortOrder
  FROM OPENJSON(@SectionsJson)
  WITH (
    label     NVARCHAR(50)   '$.label',
    color     NVARCHAR(20)   '$.color',
    bg        NVARCHAR(20)   '$.bg',
    sortOrder INT            '$.sortOrder',
    items     NVARCHAR(MAX)  '$.items' AS JSON
  ) s;

  -- Insert items for each newly-inserted section
  -- Match sections back by sort_order (unique within a release)
  INSERT INTO dbo.release_note_items (section_id, body, sort_order)
  SELECT
    sec.id,
    item.body,
    item.sortOrder
  FROM dbo.release_note_sections sec
  CROSS APPLY OPENJSON(
    (
      SELECT s.items
      FROM OPENJSON(@SectionsJson)
      WITH (
        sortOrder INT           '$.sortOrder',
        items     NVARCHAR(MAX) '$.items' AS JSON
      ) s
      WHERE s.sortOrder = sec.sort_order
    )
  )
  WITH (
    body      NVARCHAR(1000) '$.body',
    sortOrder INT            '$.sortOrder'
  ) item
  WHERE sec.release_id = @Id;
END;
GO

-- ── sp_DeleteReleaseNote ──────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_DeleteReleaseNote
  @Id        INT,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.release_notes WHERE id = @Id)
  BEGIN
    SET @ErrorCode = 'NOT_FOUND';
    RETURN;
  END

  -- Cascade handles sections and items via FK ON DELETE CASCADE
  DELETE FROM dbo.release_notes WHERE id = @Id;
END;
GO

PRINT 'Migration 042 complete';
GO
