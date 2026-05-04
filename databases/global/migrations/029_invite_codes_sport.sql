-- Migration 029: Add sport_id to invite_codes
-- Scopes player/alumni invite links to a specific sport so the join flow
-- can auto-assign the correct sport membership. Staff invite codes have
-- sport_id = NULL (not sport-specific).

USE LegacyLinkGlobal
GO

IF COL_LENGTH('dbo.invite_codes', 'sport_id') IS NULL
BEGIN
  ALTER TABLE dbo.invite_codes ADD sport_id INT NULL;
  PRINT 'Added sport_id column to dbo.invite_codes';
END
ELSE
  PRINT 'sport_id already exists on dbo.invite_codes — skipped';
GO
