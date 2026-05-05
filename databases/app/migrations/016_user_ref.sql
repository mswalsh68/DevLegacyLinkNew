-- ============================================================
-- Migration 016: User reference / community preferences table
--
-- Stores per-user, per-tenant community opt-in state and
-- contact visibility preference.  One row per user; created on
-- first consent interaction and left in place on decline so
-- declined state is durable.
--
-- consent_tc_version is stored so the app can force re-consent
-- when the T&C version bumps.
--
-- Run on: each App DB (tenant)
-- Run after: 015_program_role_nullable.sql
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.tables
    WHERE  name = 'user_ref' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.user_ref (
        user_id                     INT            NOT NULL
            CONSTRAINT PK_user_ref PRIMARY KEY
            CONSTRAINT FK_user_ref_users REFERENCES dbo.users(id) ON DELETE CASCADE,
        community_consent_accepted   BIT            NOT NULL DEFAULT 0,
        community_consent_timestamp  DATETIME2(0)       NULL,
        community_consent_tc_version NVARCHAR(20)       NULL,
        contact_visible              BIT            NOT NULL DEFAULT 1,
    );

    PRINT 'Created dbo.user_ref';
END
ELSE
    PRINT 'dbo.user_ref already exists — skipping';
GO

PRINT 'Migration 016 complete';
GO
