SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: Sports & Positions
-- Procedures: sp_GetSports, sp_GetSportsPositions, sp_GetUserSports,
--             sp_GetAllSports, sp_SetSportActive, sp_AddSport,
--             sp_AddSportsPosition, sp_UpdateSportsPosition,
--             sp_DeleteSportsPosition
-- Run on: each tenant AppDB
-- ============================================================

-- ============================================================
-- sp_GetSports
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetSports
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, name, abbr, is_active AS isActive
  FROM   dbo.sports
  WHERE  is_active = 1
  ORDER  BY name;
END;
GO

-- ============================================================
-- sp_GetSportsPositions
-- Returns positions for a given sport (or all if @SportId NULL).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetSportsPositions
  @SportId INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    sp.position_id   AS positionId,
    sp.sport_id      AS sportId,
    s.name           AS sportName,
    sp.position_name AS positionName,
    sp.abbreviation  AS positionAbbr,
    sp.is_active     AS isActive
  FROM dbo.sports_position sp
  JOIN dbo.sports s ON s.id = sp.sport_id
  WHERE (@SportId IS NULL OR sp.sport_id = @SportId)
  ORDER BY sp.sport_id, sp.position_id;
END;
GO

-- ============================================================
-- sp_GetUserSports
-- Returns the sports a user has access to.
-- NULL @UserId = admin (all active sports).
-- Non-null = sports from dbo.users_sports (active rows only).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserSports
  @UserId INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF @UserId IS NULL
  BEGIN
    SELECT s.id, s.name, s.abbr
    FROM   dbo.sports s
    WHERE  s.is_active = 1
    ORDER  BY s.name;
  END
  ELSE
  BEGIN
    SELECT s.id, s.name, s.abbr
    FROM   dbo.sports       s
    JOIN   dbo.users_sports us ON us.sport_id = s.id
    WHERE  us.user_id   = @UserId
      AND  us.is_active = 1
      AND  s.is_active  = 1
    ORDER  BY s.name;
  END
END;
GO

-- ============================================================
-- sp_GetAllSports
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetAllSports
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, name, abbr, is_active AS isActive
  FROM dbo.sports
  ORDER BY id;
END;
GO

-- ============================================================
-- sp_SetSportActive
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SetSportActive
  @SportId  INT,
  @IsActive BIT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.sports SET is_active = @IsActive WHERE id = @SportId;
  SELECT @@ROWCOUNT AS rowsAffected;
END;
GO

-- ============================================================
-- sp_AddSport
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_AddSport
  @Name     NVARCHAR(100),
  @Abbr     NVARCHAR(10),
  @IsActive BIT = 1
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (SELECT 1 FROM dbo.sports WHERE abbr = @Abbr)
  BEGIN
    SELECT -1 AS newId, 'DUPLICATE_ABBR' AS errorCode;
    RETURN;
  END

  INSERT INTO dbo.sports (name, abbr, is_active)
  VALUES (@Name, @Abbr, @IsActive);

  SELECT SCOPE_IDENTITY() AS newId, NULL AS errorCode;
END;
GO

-- ============================================================
-- sp_AddSportsPosition
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_AddSportsPosition
  @SportId      INT,
  @PositionName NVARCHAR(100),
  @Abbreviation NVARCHAR(10)
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (
    SELECT 1 FROM dbo.sports_position
    WHERE sport_id = @SportId AND abbreviation = @Abbreviation
  )
  BEGIN
    SELECT -1 AS newId, 'DUPLICATE_ABBR' AS errorCode;
    RETURN;
  END

  INSERT INTO dbo.sports_position (sport_id, position_name, abbreviation)
  VALUES (@SportId, @PositionName, @Abbreviation);

  SELECT SCOPE_IDENTITY() AS newId, NULL AS errorCode;
END;
GO

-- ============================================================
-- sp_UpdateSportsPosition
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateSportsPosition
  @PositionId   INT,
  @PositionName NVARCHAR(100) = NULL,
  @Abbreviation NVARCHAR(10)  = NULL,
  @IsActive     BIT           = NULL
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.sports_position
     SET position_name = ISNULL(@PositionName, position_name),
         abbreviation  = ISNULL(@Abbreviation, abbreviation),
         is_active     = ISNULL(@IsActive,     is_active)
   WHERE position_id = @PositionId;

  SELECT @@ROWCOUNT AS rowsAffected;
END;
GO

-- ============================================================
-- sp_DeleteSportsPosition
-- Hard-deletes a position.  Positions referenced by users_sports
-- will be NULLed via the FK ON DELETE SET NULL.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_DeleteSportsPosition
  @PositionId INT
AS
BEGIN
  SET NOCOUNT ON;
  DELETE FROM dbo.sports_position WHERE position_id = @PositionId;
  SELECT @@ROWCOUNT AS rowsAffected;
END;
GO
