SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: Member Details
-- Procedures: sp_GetMemberDetails
-- Run on: each tenant AppDB
-- ============================================================

-- ============================================================
-- sp_GetMemberDetails
-- Returns a user's profile + sport memberships + interactions.
-- Result set 1: user base + program role + sport memberships
-- Result set 2: up to 20 most-recent interaction_log entries
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetMemberDetails
  @UserId    INT,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  -- Result set 1: user + sport memberships with per-sport role (one row per sport)
  SELECT
    u.user_id          AS userId,
    u.email,
    u.first_name       AS firstName,
    u.last_name        AS lastName,
    u.global_role_id   AS globalRoleId,
    u.is_active        AS isActive,
    u.last_team_login  AS lastTeamLogin,
    us.id              AS userSportId,
    us.sport_id        AS sportId,
    s.name             AS sportName,
    s.abbr             AS sportAbbr,
    us.program_role_id AS programRoleId,
    pr.display_name    AS programRoleDisplay,
    us.position_id     AS positionId,
    sp.position_name   AS position,
    us.jersey_number   AS jerseyNumber,
    us.seasons_played  AS seasonsPlayed,
    us.class_year      AS classYear,
    us.is_active       AS sportIsActive,
    us.joined_at       AS createdAt,
    us.updated_at      AS updatedAt
  FROM dbo.users u
  LEFT JOIN dbo.users_sports    us ON us.user_id      = u.user_id
  LEFT JOIN dbo.sports          s  ON s.id            = us.sport_id
  LEFT JOIN dbo.sports_position sp ON sp.position_id  = us.position_id
  LEFT JOIN dbo.program_role    pr ON pr.id            = us.program_role_id
  WHERE u.user_id = @UserId
  ORDER BY us.is_active DESC, s.name;

  -- Result set 2: recent interactions (latest 20)
  SELECT TOP 20
    il.id,
    il.channel,
    il.summary,
    il.outcome,
    il.follow_up_at           AS followUpAt,
    il.logged_at              AS loggedAt,
    il.logged_by_user_id      AS loggedByUserId,
    u2.first_name + ' ' + u2.last_name AS loggedByName
  FROM dbo.interaction_log il
  LEFT JOIN dbo.users u2 ON u2.user_id = il.logged_by_user_id
  WHERE il.user_id = @UserId
  ORDER BY il.logged_at DESC;
END;
GO
