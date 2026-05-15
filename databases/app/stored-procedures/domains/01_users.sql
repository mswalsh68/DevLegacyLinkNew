SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: Users & Roster
-- Procedures: sp_UpsertUser
-- Views:      vwRoster, vwAlumniRoster
-- Procedures: sp_GetRosterBySport, sp_GetAlumniBySport
-- Run on: each tenant AppDB
-- ============================================================

-- ============================================================
-- sp_UpsertUser
-- Syncs a LegacyLinkGlobal user into local dbo.users.
-- Called at login and before any role-assignment flow.
-- Program role now lives on dbo.users_sports (per sport).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertUser
  @UserId       INT,
  @Email        NVARCHAR(255),
  @FirstName    NVARCHAR(100),
  @LastName     NVARCHAR(100),
  @GlobalRoleId INT          = 3
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId)
  BEGIN
    UPDATE dbo.users SET
      email          = @Email,
      first_name     = @FirstName,
      last_name      = @LastName,
      global_role_id = @GlobalRoleId,
      synced_at      = SYSUTCDATETIME()
    WHERE user_id = @UserId;
  END
  ELSE IF EXISTS (SELECT 1 FROM dbo.users WHERE email = @Email)
  BEGIN
    -- Email exists under a stale/mismatched user_id — re-key to the Global DB user_id.
    -- Delete orphaned users_sports rows first (no ON UPDATE CASCADE on the FK).
    DELETE FROM dbo.users_sports WHERE user_id = (SELECT user_id FROM dbo.users WHERE email = @Email);
    UPDATE dbo.users SET
      user_id        = @UserId,
      first_name     = @FirstName,
      last_name      = @LastName,
      global_role_id = @GlobalRoleId,
      synced_at      = SYSUTCDATETIME()
    WHERE email = @Email;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.users (user_id, email, first_name, last_name, global_role_id)
    VALUES (@UserId, @Email, @FirstName, @LastName, @GlobalRoleId);
  END
END;
GO

-- ============================================================
-- vwRoster
-- Active current players (users_sports.program_role_id = 8).
-- ============================================================
CREATE OR ALTER VIEW dbo.vwRoster AS
SELECT
  us.id            AS userSportId,
  us.user_id,
  u.email,
  u.first_name,
  u.last_name,
  us.sport_id,
  s.name           AS sport_name,
  s.abbr           AS sport_abbr,
  us.position_id,
  sp.position_name AS position,
  us.jersey_number,
  us.seasons_played,
  us.class_year,
  us.joined_at     AS created_at,
  us.updated_at
FROM dbo.users_sports us
JOIN dbo.users         u  ON u.user_id       = us.user_id
JOIN dbo.sports        s  ON s.id            = us.sport_id
LEFT JOIN dbo.sports_position sp ON sp.position_id = us.position_id
WHERE us.program_role_id = 8   -- player
  AND us.is_active = 1
  AND u.is_active  = 1;
GO

-- ============================================================
-- vwAlumniRoster
-- All alumni (users_sports.program_role_id = 7).
-- ============================================================
CREATE OR ALTER VIEW dbo.vwAlumniRoster AS
SELECT
  us.id            AS userSportId,
  us.user_id,
  u.email,
  u.first_name,
  u.last_name,
  us.sport_id,
  s.name           AS sport_name,
  s.abbr           AS sport_abbr,
  us.position_id,
  sp.position_name AS position,
  us.jersey_number,
  us.seasons_played,
  us.class_year,
  us.joined_at     AS created_at,
  us.updated_at
FROM dbo.users_sports us
JOIN dbo.users         u  ON u.user_id       = us.user_id
JOIN dbo.sports        s  ON s.id            = us.sport_id
LEFT JOIN dbo.sports_position sp ON sp.position_id = us.position_id
WHERE us.program_role_id = 7   -- alumni
  AND us.is_active = 1
  AND u.is_active  = 1;
GO

-- ============================================================
-- sp_GetRosterBySport
-- Returns active roster for a given sport with pagination.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetRosterBySport
  @SportId          INT           = NULL,
  @RequestingUserId INT           = NULL,
  @Search           NVARCHAR(255) = NULL,
  @PositionId       INT           = NULL,
  @ClassYear        SMALLINT      = NULL,
  @Page             INT           = 1,
  @PageSize         INT           = 50,
  @TotalCount       INT           OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Offset     INT           = (@Page - 1) * @PageSize;
  DECLARE @SearchWild NVARCHAR(257) = '%' + ISNULL(@Search, '') + '%';

  SELECT @TotalCount = COUNT(*)
  FROM dbo.vwRoster r
  WHERE (@SportId     IS NULL OR r.sport_id    = @SportId)
    AND (@PositionId  IS NULL OR r.position_id = @PositionId)
    AND (@ClassYear   IS NULL OR r.class_year  = @ClassYear)
    AND (@Search IS NULL
         OR r.first_name    LIKE @SearchWild
         OR r.last_name     LIKE @SearchWild
         OR (r.jersey_number IS NOT NULL AND CAST(r.jersey_number AS NVARCHAR(10)) = @Search))
    AND (
      @RequestingUserId IS NULL
      OR EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @RequestingUserId AND sport_id IS NULL AND is_active = 1)
      OR EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @RequestingUserId AND sport_id = r.sport_id AND is_active = 1)
    );

  SELECT
    r.userSportId    AS userSportId,
    r.user_id        AS userId,
    r.first_name     AS firstName,
    r.last_name      AS lastName,
    r.email,
    r.sport_id       AS sportId,
    r.sport_name     AS sportName,
    r.position_id    AS positionId,
    r.position,
    r.jersey_number  AS jerseyNumber,
    r.seasons_played AS seasonsPlayed,
    r.class_year     AS classYear,
    r.created_at     AS createdAt,
    r.updated_at     AS updatedAt
  FROM dbo.vwRoster r
  WHERE (@SportId     IS NULL OR r.sport_id    = @SportId)
    AND (@PositionId  IS NULL OR r.position_id = @PositionId)
    AND (@ClassYear   IS NULL OR r.class_year  = @ClassYear)
    AND (@Search IS NULL
         OR r.first_name    LIKE @SearchWild
         OR r.last_name     LIKE @SearchWild
         OR (r.jersey_number IS NOT NULL AND CAST(r.jersey_number AS NVARCHAR(10)) = @Search))
    AND (
      @RequestingUserId IS NULL
      OR EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @RequestingUserId AND sport_id IS NULL AND is_active = 1)
      OR EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @RequestingUserId AND sport_id = r.sport_id AND is_active = 1)
    )
  ORDER BY r.last_name, r.first_name
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- ============================================================
-- sp_GetAlumniBySport
-- Returns alumni for a given sport with pagination.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetAlumniBySport
  @SportId          INT           = NULL,
  @RequestingUserId INT           = NULL,
  @Search           NVARCHAR(255) = NULL,
  @PositionId       INT           = NULL,
  @ClassYear        SMALLINT      = NULL,
  @Page             INT           = 1,
  @PageSize         INT           = 50,
  @TotalCount       INT           OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Offset     INT           = (@Page - 1) * @PageSize;
  DECLARE @SearchWild NVARCHAR(257) = '%' + ISNULL(@Search, '') + '%';

  SELECT @TotalCount = COUNT(*)
  FROM dbo.vwAlumniRoster a
  WHERE (@SportId    IS NULL OR a.sport_id    = @SportId)
    AND (@PositionId IS NULL OR a.position_id = @PositionId)
    AND (@ClassYear  IS NULL OR a.class_year  = @ClassYear)
    AND (@Search IS NULL
         OR a.first_name LIKE @SearchWild
         OR a.last_name  LIKE @SearchWild
         OR a.email      LIKE @SearchWild)
    AND (
      @RequestingUserId IS NULL
      OR EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @RequestingUserId AND sport_id IS NULL AND is_active = 1)
      OR EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @RequestingUserId AND sport_id = a.sport_id AND is_active = 1)
    );

  SELECT
    a.userSportId    AS userSportId,
    a.user_id        AS userId,
    a.first_name     AS firstName,
    a.last_name      AS lastName,
    a.email,
    a.sport_id       AS sportId,
    a.sport_name     AS sportName,
    a.position_id    AS positionId,
    a.position,
    a.jersey_number  AS jerseyNumber,
    a.seasons_played AS seasonsPlayed,
    a.class_year     AS classYear,
    a.created_at     AS createdAt,
    a.updated_at     AS updatedAt
  FROM dbo.vwAlumniRoster a
  WHERE (@SportId    IS NULL OR a.sport_id    = @SportId)
    AND (@PositionId IS NULL OR a.position_id = @PositionId)
    AND (@ClassYear  IS NULL OR a.class_year  = @ClassYear)
    AND (@Search IS NULL
         OR a.first_name LIKE @SearchWild
         OR a.last_name  LIKE @SearchWild
         OR a.email      LIKE @SearchWild)
    AND (
      @RequestingUserId IS NULL
      OR EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @RequestingUserId AND sport_id IS NULL AND is_active = 1)
      OR EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @RequestingUserId AND sport_id = a.sport_id AND is_active = 1)
    )
  ORDER BY a.last_name, a.first_name
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
