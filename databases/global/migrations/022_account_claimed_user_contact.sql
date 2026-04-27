-- ============================================================
-- Migration 022: account_claimed flag + dbo.user_contact table
-- Run on: LegacyLinkGlobal database
-- Run after: 021_integer_team_ids.sql
-- ============================================================
-- Changes:
--   1. Add account_claimed BIT + claimed_date DATETIME2 to dbo.users
--      account_claimed = 0 → admins may edit the user record
--      account_claimed = 1 → only the user may edit their own record
--      claimed_date    = timestamp of the user's very first successful login
--
--   2. Create dbo.user_contact (1-to-1 with dbo.users)
--      All PII / social / emergency contact data lives here.
--      updated_date is used by App DB sync (delta check on team switch).
--      Source of truth for contact data — never duplicated to App DB.
--
--   3. Seed an empty user_contact row for the platform owner.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 1. Add account_claimed + claimed_date to dbo.users ──────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'account_claimed'
)
BEGIN
  ALTER TABLE dbo.users
    ADD account_claimed BIT          NOT NULL DEFAULT 0,
        claimed_date    DATETIME2    NULL;

  -- mswalsh68 has already logged in — mark as claimed
  UPDATE dbo.users
  SET    account_claimed = 1,
         claimed_date    = created_at
  WHERE  email = 'mswalsh68@gmail.com';

  PRINT 'Added account_claimed + claimed_date to dbo.users';
END
ELSE
  PRINT 'account_claimed already exists — skipping';
GO

-- ─── 2. Create dbo.user_contact ──────────────────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_contact'
)
BEGIN
  CREATE TABLE dbo.user_contact (
    -- Identity
    user_id                   UNIQUEIDENTIFIER NOT NULL
                                CONSTRAINT PK_user_contact       PRIMARY KEY
                                CONSTRAINT FK_user_contact_users FOREIGN KEY
                                  REFERENCES dbo.users (id) ON DELETE CASCADE,

    -- Address
    phone                     NVARCHAR(20)     NULL,
    address                   NVARCHAR(255)    NULL,
    city                      NVARCHAR(100)    NULL,
    state                     NVARCHAR(100)    NULL,
    zipcode                   NVARCHAR(20)     NULL,
    country                   NVARCHAR(100)    NULL DEFAULT 'US',

    -- Emergency contacts (two slots, all nullable)
    emergency_contact_name_1  NVARCHAR(150)    NULL,
    emergency_contact_email_1 NVARCHAR(255)    NULL,
    emergency_contact_phone_1 NVARCHAR(20)     NULL,
    emergency_contact_name_2  NVARCHAR(150)    NULL,
    emergency_contact_email_2 NVARCHAR(255)    NULL,
    emergency_contact_phone_2 NVARCHAR(20)     NULL,

    -- Social
    twitter                   NVARCHAR(100)    NULL,
    instagram                 NVARCHAR(100)    NULL,
    facebook                  NVARCHAR(100)    NULL,
    linked_in                 NVARCHAR(255)    NULL,

    -- Sync timestamp — App DB checks this on team switch to decide
    -- whether a re-sync of display fields (name, email) is needed.
    updated_date              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
  );

  PRINT 'Created dbo.user_contact';
END
ELSE
  PRINT 'dbo.user_contact already exists — skipping';
GO

-- ─── 3. Seed empty contact row for mswalsh68 ─────────────────────────────────

INSERT INTO dbo.user_contact (user_id)
SELECT id FROM dbo.users WHERE email = 'mswalsh68@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM dbo.user_contact uc
  JOIN   dbo.users u ON u.id = uc.user_id
  WHERE  u.email = 'mswalsh68@gmail.com'
);

PRINT CONCAT('Seeded ', @@ROWCOUNT, ' user_contact row(s) for platform owner');
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT user_id, id AS guid, email, first_name, last_name,
       account_claimed, claimed_date
FROM   dbo.users
ORDER  BY user_id;

SELECT uc.user_id, u.email, uc.updated_date
FROM   dbo.user_contact uc
JOIN   dbo.users u ON u.id = uc.user_id;

PRINT '=== Migration 022 complete ===';
GO
