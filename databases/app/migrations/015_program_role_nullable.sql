-- Migration 015 — Make program_role_id nullable for internal LegacyLink staff
-- Run on: LegacyLinkApp (and every future tenant App DB)
-- Run after: 014_schema_consolidation.sql
--
-- Internal staff (global_role_id 1=super_admin, 2=support_admin) sit above the
-- application-level role system. They should have program_role_id = NULL, not a
-- program role like Athletic Director or Player. The NOT NULL constraint added in
-- 014 was wrong for this user class.

USE LegacyLinkApp
GO

-- Allow NULL so internal staff can have no program role
IF COL_LENGTH('dbo.users', 'program_role_id') IS NOT NULL
BEGIN
  ALTER TABLE dbo.users ALTER COLUMN program_role_id INT NULL;
  PRINT 'Set dbo.users.program_role_id to allow NULL';
END
GO

-- Null out any internal staff who were incorrectly assigned a program role
UPDATE dbo.users
SET    program_role_id = NULL
WHERE  global_role_id IN (1, 2);
PRINT CONCAT('Nulled program_role_id for ', @@ROWCOUNT, ' internal staff user(s)');
GO

-- Verify
SELECT
  user_id,
  email,
  platform_role,
  global_role_id,
  program_role_id
FROM dbo.users
ORDER BY user_id;
GO

PRINT '=== Migration 015 complete ===';
GO
