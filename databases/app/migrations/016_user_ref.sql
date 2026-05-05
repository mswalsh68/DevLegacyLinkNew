-- ============================================================
-- Migration 016: Community consent + contact visibility columns
--
-- Adds four columns to dbo.users for community opt-in state and
-- contact visibility preference.
--
-- consent_tc_version is stored so the app can force re-consent
-- when the T&C version bumps.
--
-- Run on: each App DB (tenant)
-- Run after: 015_program_role_nullable.sql
-- ============================================================

IF COL_LENGTH('dbo.users', 'community_consent_accepted') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD community_consent_accepted BIT NOT NULL DEFAULT 0;
    PRINT 'Added dbo.users.community_consent_accepted';
END
ELSE PRINT 'dbo.users.community_consent_accepted already exists — skipped';
GO

IF COL_LENGTH('dbo.users', 'community_consent_timestamp') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD community_consent_timestamp DATETIME2(0) NULL;
    PRINT 'Added dbo.users.community_consent_timestamp';
END
ELSE PRINT 'dbo.users.community_consent_timestamp already exists — skipped';
GO

IF COL_LENGTH('dbo.users', 'community_consent_tc_version') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD community_consent_tc_version NVARCHAR(20) NULL;
    PRINT 'Added dbo.users.community_consent_tc_version';
END
ELSE PRINT 'dbo.users.community_consent_tc_version already exists — skipped';
GO

IF COL_LENGTH('dbo.users', 'contact_visible') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD contact_visible BIT NOT NULL DEFAULT 1;
    PRINT 'Added dbo.users.contact_visible';
END
ELSE PRINT 'dbo.users.contact_visible already exists — skipped';
GO

PRINT 'Migration 016 complete';
GO
