-- ============================================================
-- Migration 010 — Resend email open tracking
-- Adds resend_id column to outreach_messages so webhook events
-- can be correlated back to the correct message row.
-- Run on: each tenant AppDB
-- ============================================================

USE [$(AppDb)]
GO

-- Add resend_id column (Resend returns an ID like "re_AbCdEfGh_...")
ALTER TABLE dbo.outreach_messages
  ADD resend_id NVARCHAR(100) NULL;
GO

-- Index for fast webhook lookups by resend_id
CREATE NONCLUSTERED INDEX IX_outreach_messages_resend_id
  ON dbo.outreach_messages (resend_id)
  WHERE resend_id IS NOT NULL;
GO

PRINT '=== Migration 010: resend_id added to outreach_messages ===';
GO
