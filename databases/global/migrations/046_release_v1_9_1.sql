-- ============================================================
-- Migration 046: Log v1.9.1 release (internal record only)
--
-- Image updates and demo seed script improvements.
-- No in-app changes. is_user_facing = 0.
--
-- Run on: LegacyLinkGlobal (and DevLegacyLinkGlobal for dev)
-- Run after: 045_release_v1_9_0.sql
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.release_notes WHERE version = 'v1.9.1')
BEGIN
  INSERT INTO dbo.release_notes (version, release_date, is_published, is_user_facing)
  VALUES ('v1.9.1', '2026-05-17', 1, 0);

  PRINT 'Inserted v1.9.1 (internal — images + seed tooling)';
END
ELSE
  PRINT 'v1.9.1 already exists — skipping';
GO

PRINT 'Migration 046 complete';
GO
