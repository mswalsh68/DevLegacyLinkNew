-- ============================================================
-- Migration 045: Log v1.9.0 release (internal record only)
--
-- Marketing-only release — adds the /story founder page,
-- condenses the homepage FounderStory section, and adds an
-- "Our Story" nav link. No in-app changes.
--
-- is_user_facing = 0: stored for record-keeping, not shown
-- on the user-facing release notes page.
--
-- Run on: LegacyLinkGlobal (and DevLegacyLinkGlobal for dev)
-- Run after: 044_release_notes_user_facing.sql
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.release_notes WHERE version = 'v1.9.0')
BEGIN
  INSERT INTO dbo.release_notes (version, release_date, is_published, is_user_facing)
  VALUES ('v1.9.0', '2026-05-17', 1, 0);

  PRINT 'Inserted v1.9.0 (internal — marketing only)';
END
ELSE
  PRINT 'v1.9.0 already exists — skipping';
GO

PRINT 'Migration 045 complete';
GO
