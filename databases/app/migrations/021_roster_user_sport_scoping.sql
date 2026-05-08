-- Migration 021: Enforce user sport scope on sp_GetRosterBySport and sp_GetAlumniBySport
--
-- Adds @RequestingUserId INT = NULL to both procs.
-- When provided, restricts results to sports the requesting user is scoped to:
--   - User has sport_id IS NULL row in users_sports → program-wide (no restriction)
--   - User has specific sport_id rows → only records matching those sports are returned
--   - @SportId filter still applies on top of scoping
-- When NULL (admin/internal calls), no scoping is applied.

USE LegacyLinkApp;
GO

-- ============================================================
-- sp_GetRosterBySport — add user sport scoping
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
  WHERE (@SportId     IS NULL OR r.sport_id   = @SportId)
    AND (@PositionId  IS NULL OR r.position_id = @PositionId)
    AND (@ClassYear   IS NULL OR r.class_year  = @ClassYear)
    AND (@Search IS NULL
         OR r.first_name    LIKE @SearchWild
         OR r.last_name     LIKE @SearchWild
         OR (r.jersey_number IS NOT NULL AND CAST(r.jersey_number AS NVARCHAR(10)) = @Search))
    -- Sport scoping: bypass if no user provided, or if user is program-wide (has NULL sport row),
    -- otherwise restrict to sports the user is explicitly scoped to.
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
  WHERE (@SportId     IS NULL OR r.sport_id   = @SportId)
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
-- sp_GetAlumniBySport — add user sport scoping
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
  WHERE (@SportId    IS NULL OR a.sport_id   = @SportId)
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
  WHERE (@SportId    IS NULL OR a.sport_id   = @SportId)
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
