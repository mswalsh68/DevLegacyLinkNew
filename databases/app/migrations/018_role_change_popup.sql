-- ============================================================
-- Migration 018: Add popup_shown to role_change_log
--
-- Tracks whether a user has dismissed the welcome popup for a
-- specific role-change event. Resets naturally when a new row
-- is created on the next role change.
--
-- Run on: each tenant App DB
-- Run after: 017_program_role_per_sport.sql
-- ============================================================

IF COL_LENGTH('dbo.role_change_log', 'popup_shown') IS NULL
BEGIN
    ALTER TABLE dbo.role_change_log
        ADD popup_shown BIT NOT NULL DEFAULT 0;
    PRINT 'Added dbo.role_change_log.popup_shown';
END
ELSE
    PRINT 'popup_shown already exists — skipped';
GO

PRINT 'Migration 018 complete';
GO
