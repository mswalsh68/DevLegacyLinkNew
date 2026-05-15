SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: Onboarding / Welcome Flow
-- Procedures: sp_GetPendingWelcomePopup, sp_MarkWelcomePopupShown,
--             sp_DeactivateUserSport
-- Run on: each tenant AppDB
-- ============================================================

-- ============================================================
-- sp_GetPendingWelcomePopup
-- Returns the pending welcome popup (if any) for a user who
-- has been promoted to alumni (to_program_role_id = 7) and has
-- not yet dismissed the popup (popup_shown = 0).
-- @ViewerTierId: 1=starter | 2=pro | 3=enterprise — from session.tierId
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetPendingWelcomePopup
    @UserId      INT,
    @ViewerTierId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        rcl.log_id,
        fp.id         AS post_id,
        fp.title,
        fp.body_html,
        fp.image_url,
        fp.target_tier_id,
        fp.target_program_role_id
    FROM   dbo.role_change_log rcl
    JOIN   dbo.feed_posts fp
        ON  fp.target_tier_id          = @ViewerTierId
        AND fp.target_program_role_id  = 7   -- 7 = alumni
        AND fp.is_welcome_post         = 1
        AND fp.is_deleted              = 0
    WHERE  rcl.user_id            = @UserId
      AND  rcl.to_program_role_id = 7        -- 7 = alumni
      AND  rcl.popup_shown        = 0
    ORDER BY rcl.changed_at DESC;
END
GO

-- ============================================================
-- sp_MarkWelcomePopupShown
-- Flips popup_shown = 1 on the specified role_change_log row.
-- @UserId guard ensures a user can only dismiss their own popup.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_MarkWelcomePopupShown
    @LogId     INT,
    @UserId    INT,
    @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @ErrorCode = NULL;

    UPDATE dbo.role_change_log
    SET    popup_shown = 1
    WHERE  log_id  = @LogId
      AND  user_id = @UserId
      AND  popup_shown = 0;   -- idempotent — no-op if already shown

    IF @@ROWCOUNT = 0
        SET @ErrorCode = 'NOT_FOUND_OR_ALREADY_SHOWN';
END
GO

-- ============================================================
-- sp_DeactivateUserSport
-- Soft-removes a user from a sport (is_active = 0).
-- Does NOT change the user's program role.
-- Logs a note to role_change_log for audit.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_DeactivateUserSport
  @UserId      INT,
  @SportId     INT,
  @AdminUserId INT,
  @Notes       NVARCHAR(MAX) = NULL,
  @ErrorCode   NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @UserId AND sport_id = @SportId)
  BEGIN
    SET @ErrorCode = 'SPORT_NOT_FOUND';
    RETURN;
  END

  DECLARE @CurrentRoleId INT;
  SELECT @CurrentRoleId = program_role_id
  FROM   dbo.users_sports
  WHERE  user_id  = @UserId
    AND  sport_id = @SportId;

  UPDATE dbo.users_sports SET is_active = 0, updated_at = SYSUTCDATETIME()
  WHERE user_id = @UserId AND sport_id = @SportId;

  -- Log deactivation as a role event (same from/to role, sport context)
  INSERT INTO dbo.role_change_log (
    user_id, sport_id,
    from_program_role_id, to_program_role_id,
    changed_by, notes
  )
  VALUES (
    @UserId, @SportId,
    @CurrentRoleId, @CurrentRoleId,
    @AdminUserId, ISNULL(@Notes, N'Removed from sport')
  );
END;
GO
