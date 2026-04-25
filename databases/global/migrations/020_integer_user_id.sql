-- ============================================================
-- MIGRATION 020 — Add sequential integer user_id to users
-- Run on: LegacyLinkGlobal database
-- Run after: 000_wipe_test_data.sql (wipe first so mswalsh68 = 1)
-- ============================================================
-- Adds an IDENTITY(1,1) integer user_id alongside the existing
-- GUID id. The GUID remains the PK and FK target across all
-- tables. user_id is a human-readable sequential identifier.
-- After the wipe, mswalsh68@gmail.com will be the only user and
-- will receive user_id = 1.
-- ============================================================

USE LegacyLinkGlobal
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'user_id'
)
BEGIN
  ALTER TABLE dbo.users
    ADD user_id INT IDENTITY(1,1) NOT NULL;

  CREATE UNIQUE INDEX UQ_users_user_id ON dbo.users(user_id);

  PRINT 'Added user_id INT IDENTITY(1,1) to dbo.users';
END
ELSE
  PRINT 'users.user_id already exists — skipping';
GO

-- Verify
SELECT user_id, id AS guid, email, first_name, last_name
FROM   dbo.users
ORDER  BY user_id;
GO

PRINT '=== Migration 020 complete ===';
GO
