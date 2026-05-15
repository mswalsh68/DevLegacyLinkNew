SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: Interaction Logging
-- Procedures: sp_LogInteraction, sp_GetInteractionsByUser
-- Run on: each tenant AppDB
-- ============================================================

-- ============================================================
-- sp_LogInteraction
-- Logs a staff interaction with a user (player or alumni).
-- Keyed on user_id.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_LogInteraction
  @UserId     INT,
  @LoggedBy   INT,
  @Channel    NVARCHAR(30),
  @Summary    NVARCHAR(MAX),
  @Outcome    NVARCHAR(50)  = NULL,
  @FollowUpAt DATETIME2     = NULL,
  @ErrorCode  NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  IF LEN(LTRIM(RTRIM(@Summary))) = 0
  BEGIN
    SET @ErrorCode = 'SUMMARY_REQUIRED';
    RETURN;
  END

  INSERT INTO dbo.interaction_log (user_id, logged_by_user_id, channel, summary, outcome, follow_up_at)
  VALUES (@UserId, @LoggedBy, @Channel, @Summary, @Outcome, @FollowUpAt);
END;
GO

-- ============================================================
-- sp_GetInteractionsByUser
-- Returns interaction history for a user.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetInteractionsByUser
  @UserId   INT,
  @Page     INT = 1,
  @PageSize INT = 20
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Offset INT = (@Page - 1) * @PageSize;

  SELECT
    il.id,
    il.channel,
    il.summary,
    il.outcome,
    il.follow_up_at  AS followUpAt,
    il.logged_at     AS loggedAt,
    il.logged_by_user_id AS loggedByUserId,
    u.first_name + ' ' + u.last_name AS loggedByName
  FROM dbo.interaction_log il
  LEFT JOIN dbo.users u ON u.user_id = il.logged_by_user_id
  WHERE il.user_id = @UserId
  ORDER BY il.logged_at DESC
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
