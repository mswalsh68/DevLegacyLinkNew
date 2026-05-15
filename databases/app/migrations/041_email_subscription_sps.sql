-- ============================================================
-- Migration 041: Email subscription stored procedures
--
-- sp_GetEmailSubscription  — check if a user is unsubscribed
-- sp_ResubscribeEmail      — re-subscribe (delete from email_unsubscribes)
--
-- Run on: LegacyLinkApp (app DB)
-- Run after: any migration that created dbo.email_unsubscribes
-- ============================================================

-- ── sp_GetEmailSubscription ───────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_GetEmailSubscription
  @UserId    INT,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  SELECT
    CASE WHEN EXISTS (
      SELECT 1 FROM dbo.email_unsubscribes
      WHERE user_id = @UserId AND channel = 'email'
    ) THEN 1 ELSE 0 END AS isUnsubscribed;
END;
GO

-- ── sp_ResubscribeEmail ───────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_ResubscribeEmail
  @UserId    INT,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DELETE FROM dbo.email_unsubscribes
  WHERE user_id = @UserId AND channel = 'email';
END;
GO

PRINT 'Migration 041 complete';
GO
