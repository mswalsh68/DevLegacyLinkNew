SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: Community & Staff
-- Procedures: sp_GetCommunityConsent, sp_UpsertCommunityConsent,
--             sp_GetStaff, sp_SetContactVisible
-- Run on: each tenant AppDB
-- ============================================================

-- ============================================================
-- sp_GetCommunityConsent
-- Returns the community consent state for a user from dbo.users.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetCommunityConsent
  @UserId INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    community_consent_accepted                   AS consentAccepted,
    ISNULL(community_consent_tc_version, '')     AS consentTcVersion,
    community_consent_timestamp                  AS consentTimestamp,
    contact_visible                              AS contactVisible
  FROM dbo.users
  WHERE user_id = @UserId;
END;
GO

-- ============================================================
-- sp_UpsertCommunityConsent
-- Updates consent columns on dbo.users for a user.
-- Pass @Accepted = 1 to accept, 0 to decline.
-- @TcVersion should match the app constant COMMUNITY_TC_VERSION.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertCommunityConsent
  @UserId    INT,
  @Accepted  BIT,
  @TcVersion NVARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.users
  SET
    community_consent_accepted   = @Accepted,
    community_consent_timestamp  = CASE WHEN @Accepted = 1 THEN SYSUTCDATETIME() ELSE NULL END,
    community_consent_tc_version = CASE WHEN @Accepted = 1 THEN @TcVersion ELSE NULL END
  WHERE user_id = @UserId;
END;
GO

-- ============================================================
-- sp_GetStaff
-- Returns active staff members (program_role_id 1-6) with pagination.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetStaff
  @SportId    INT           = NULL,
  @RoleId     INT           = NULL,
  @Search     NVARCHAR(255) = NULL,
  @Page       INT           = 1,
  @PageSize   INT           = 50,
  @TotalCount INT           OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Offset     INT           = (@Page - 1) * @PageSize;
  DECLARE @SearchWild NVARCHAR(257) = '%' + ISNULL(@Search, '') + '%';

  SELECT @TotalCount = COUNT(*)
  FROM dbo.users_sports us
  JOIN      dbo.users       u  ON u.user_id  = us.user_id
  LEFT JOIN dbo.sports      s  ON s.id       = us.sport_id
  JOIN      dbo.program_role pr ON pr.id     = us.program_role_id
  WHERE us.program_role_id BETWEEN 1 AND 6
    AND us.is_active = 1
    AND u.is_active  = 1
    AND (@SportId IS NULL OR us.sport_id        = @SportId)
    AND (@RoleId  IS NULL OR us.program_role_id = @RoleId)
    AND (@Search  IS NULL
         OR u.first_name LIKE @SearchWild
         OR u.last_name  LIKE @SearchWild
         OR u.email      LIKE @SearchWild);

  SELECT
    us.id              AS userSportId,
    u.user_id          AS userId,
    u.first_name       AS firstName,
    u.last_name        AS lastName,
    u.email,
    us.sport_id        AS sportId,
    s.name             AS sportName,
    us.program_role_id AS programRoleId,
    pr.display_name    AS programRoleName,
    us.position_id     AS positionId,
    sp.position_name   AS position,
    us.joined_at       AS createdAt,
    us.updated_at      AS updatedAt
  FROM dbo.users_sports us
  JOIN      dbo.users          u  ON u.user_id       = us.user_id
  LEFT JOIN dbo.sports         s  ON s.id            = us.sport_id
  JOIN      dbo.program_role   pr ON pr.id           = us.program_role_id
  LEFT JOIN dbo.sports_position sp ON sp.position_id = us.position_id
  WHERE us.program_role_id BETWEEN 1 AND 6
    AND us.is_active = 1
    AND u.is_active  = 1
    AND (@SportId IS NULL OR us.sport_id        = @SportId)
    AND (@RoleId  IS NULL OR us.program_role_id = @RoleId)
    AND (@Search  IS NULL
         OR u.first_name LIKE @SearchWild
         OR u.last_name  LIKE @SearchWild
         OR u.email      LIKE @SearchWild)
  ORDER BY pr.id, u.last_name, u.first_name
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- ============================================================
-- sp_SetContactVisible
-- Flips contact_visible on dbo.users for a user.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SetContactVisible
  @UserId  INT,
  @Visible BIT
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.users
  SET contact_visible = @Visible
  WHERE user_id = @UserId;
END;
GO
