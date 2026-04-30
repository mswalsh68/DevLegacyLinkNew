-- ============================================================
-- Migration 010 — Resend email open tracking
-- Adds resend_id column to outreach_messages so webhook events
-- can be correlated back to the correct message row.
-- Run on: each tenant AppDB
-- ============================================================

USE [$(AppDb)]
GO

-- Add resend_id column (Resend returns an ID like "re_AbCdEfGh_...")
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.outreach_messages')
    AND name = 'resend_id'
)
BEGIN
  ALTER TABLE dbo.outreach_messages
    ADD resend_id NVARCHAR(100) NULL;
  PRINT 'Column resend_id added.';
END
ELSE
  PRINT 'Column resend_id already exists — skipped.';
GO

-- Index for fast webhook lookups by resend_id
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.outreach_messages')
    AND name = 'IX_outreach_messages_resend_id'
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_outreach_messages_resend_id
    ON dbo.outreach_messages (resend_id)
    WHERE resend_id IS NOT NULL;
  PRINT 'Index IX_outreach_messages_resend_id created.';
END
ELSE
  PRINT 'Index IX_outreach_messages_resend_id already exists — skipped.';
GO

PRINT '=== Migration 010: resend_id added to outreach_messages ===';
GO
