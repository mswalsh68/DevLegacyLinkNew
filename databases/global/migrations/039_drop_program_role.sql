-- Migration 039: Drop stale dbo.program_role from Global DB
-- This table was created in error — program roles belong in each
-- tenant's App DB (dbo.program_role). The Global DB references
-- program_role_id as a plain INT in feature_permissions and
-- preview_sessions (no FK constraint), so dropping the table
-- has no side effects.
-- Run on: LegacyLinkGlobal ONLY
-- ============================================================

USE LegacyLinkGlobal
GO

IF OBJECT_ID('dbo.program_role', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.program_role;
  PRINT 'Dropped dbo.program_role from LegacyLinkGlobal';
END
ELSE
  PRINT 'dbo.program_role does not exist — nothing to drop';
GO

PRINT '=== 039_drop_program_role complete ===';
GO
