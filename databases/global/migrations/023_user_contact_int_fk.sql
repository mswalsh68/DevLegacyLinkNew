-- ============================================================
-- Migration 023: Repair dbo.user_contact — change user_id FK
--                from UNIQUEIDENTIFIER → INT
-- Run on: LegacyLinkGlobal database
-- Run after: 022_account_claimed_user_contact.sql
-- ============================================================
-- Migration 022 created user_contact.user_id as UNIQUEIDENTIFIER
-- referencing dbo.users.id (GUID). This is inconsistent with the
-- INT-first identity strategy established in migration 020.
-- This migration drops and recreates the table with user_id INT
-- referencing dbo.users.user_id, then re-seeds any existing rows.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 1. Capture existing rows before drop (user_id via GUID→INT join) ─────────

IF OBJECT_ID('tempdb..#contact_backup') IS NOT NULL DROP TABLE #contact_backup;

SELECT
  u.user_id                   AS user_id_int,
  uc.phone,
  uc.address,
  uc.city,
  uc.state,
  uc.zipcode,
  uc.country,
  uc.emergency_contact_name_1,
  uc.emergency_contact_email_1,
  uc.emergency_contact_phone_1,
  uc.emergency_contact_name_2,
  uc.emergency_contact_email_2,
  uc.emergency_contact_phone_2,
  uc.twitter,
  uc.instagram,
  uc.facebook,
  uc.linked_in,
  uc.updated_date
INTO #contact_backup
FROM dbo.user_contact uc
JOIN dbo.users u ON u.id = uc.user_id;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' user_contact row(s) to #contact_backup');
GO

-- ─── 2. Drop old table (GUID FK) ─────────────────────────────────────────────

IF OBJECT_ID('dbo.user_contact', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.user_contact;
  PRINT 'Dropped dbo.user_contact (GUID FK version)';
END
GO

-- ─── 3. Recreate with INT FK → dbo.users.user_id ─────────────────────────────

CREATE TABLE dbo.user_contact (
  -- Identity — INT FK matching dbo.users.user_id (canonical across all DBs)
  user_id                   INT              NOT NULL
                              CONSTRAINT PK_user_contact       PRIMARY KEY
                              CONSTRAINT FK_user_contact_users FOREIGN KEY
                                REFERENCES dbo.users (user_id) ON DELETE CASCADE,

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

  -- Sync timestamp — App DB checks this on team switch
  updated_date              DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
);

PRINT 'Created dbo.user_contact (INT FK version)';
GO

-- ─── 4. Restore backed-up rows ────────────────────────────────────────────────

INSERT INTO dbo.user_contact (
  user_id,
  phone, address, city, state, zipcode, country,
  emergency_contact_name_1, emergency_contact_email_1, emergency_contact_phone_1,
  emergency_contact_name_2, emergency_contact_email_2, emergency_contact_phone_2,
  twitter, instagram, facebook, linked_in,
  updated_date
)
SELECT
  user_id_int,
  phone, address, city, state, zipcode, country,
  emergency_contact_name_1, emergency_contact_email_1, emergency_contact_phone_1,
  emergency_contact_name_2, emergency_contact_email_2, emergency_contact_phone_2,
  twitter, instagram, facebook, linked_in,
  updated_date
FROM #contact_backup;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' user_contact row(s)');
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT uc.user_id, u.email, uc.updated_date
FROM   dbo.user_contact uc
JOIN   dbo.users u ON u.user_id = uc.user_id;

PRINT '=== Migration 023 complete ===';
GO
