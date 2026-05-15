SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: Role Management
-- Procedures: sp_GetUserRoles, sp_AddUserRole,
--             sp_UpdateUserRole, sp_TransferUserRole
-- Run on: each tenant AppDB
-- ============================================================

-- ============================================================
-- sp_GetUserRoles
-- Returns user base info + all sport memberships with per-sport role.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserRoles
  @UserId INT
AS
BEGIN
  SET NOCOUNT ON;

  -- Row 1: user base
  SELECT
    u.user_id        AS userId,
    u.global_role_id AS globalRoleId,
    u.is_active      AS isActive
  FROM dbo.users u
  WHERE u.user_id = @UserId;

  -- Row 2+: sport memberships with per-sport program role
  SELECT
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
    us.is_active       AS isActive,
    us.joined_at       AS createdAt,
    us.updated_at      AS updatedAt
  FROM dbo.users_sports us
  LEFT JOIN dbo.sports          s  ON s.id            = us.sport_id
  LEFT JOIN dbo.sports_position sp ON sp.position_id  = us.position_id
  LEFT JOIN dbo.program_role    pr ON pr.id            = us.program_role_id
  WHERE us.user_id = @UserId
  ORDER BY s.name;
END;
GO

-- ============================================================
-- sp_AddUserRole
-- Sets a user's program role and creates/activates a sport
-- membership row in users_sports.
-- Returns @NewUserSportId = users_sports.id
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_AddUserRole
  @UserId        INT,
  @ProgramRoleId INT,
  @SportId       INT           = NULL,
  @PositionId    INT           = NULL,
  @JerseyNumber  TINYINT       = NULL,
  @SeasonsPlayed TINYINT       = NULL,
  @ClassYear     SMALLINT      = NULL,
  @AdminUserId   INT,
  @NewUserSportId INT          OUTPUT,
  @ErrorCode     NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode      = NULL;
  SET @NewUserSportId = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.program_role WHERE id = @ProgramRoleId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'INVALID_PROGRAM_ROLE';
    RETURN;
  END

  IF @SportId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.sports WHERE id = @SportId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'INVALID_SPORT';
    RETURN;
  END

  -- Jersey uniqueness check within sport (active players only)
  IF @JerseyNumber IS NOT NULL AND @SportId IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM dbo.users_sports us
       WHERE  us.sport_id        = @SportId
         AND  us.jersey_number   = @JerseyNumber
         AND  us.is_active       = 1
         AND  us.program_role_id = 8   -- only enforce for active players
         AND  us.user_id        <> @UserId
     )
  BEGIN
    SET @ErrorCode = 'JERSEY_NUMBER_IN_USE';
    RETURN;
  END

  -- Upsert the users_sports row (program role lives here, not on dbo.users)
  IF @SportId IS NOT NULL
  BEGIN
    IF EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @UserId AND sport_id = @SportId)
    BEGIN
      UPDATE dbo.users_sports SET
        is_active       = 1,
        program_role_id = @ProgramRoleId,
        position_id     = COALESCE(@PositionId,    position_id),
        jersey_number   = COALESCE(@JerseyNumber,  jersey_number),
        seasons_played  = COALESCE(@SeasonsPlayed, seasons_played),
        class_year      = COALESCE(@ClassYear,      class_year),
        updated_at      = SYSUTCDATETIME()
      WHERE user_id = @UserId AND sport_id = @SportId;

      SELECT @NewUserSportId = id FROM dbo.users_sports WHERE user_id = @UserId AND sport_id = @SportId;
    END
    ELSE
    BEGIN
      INSERT INTO dbo.users_sports (
        user_id, sport_id,
        program_role_id, position_id, jersey_number, seasons_played, class_year
      )
      VALUES (
        @UserId, @SportId,
        @ProgramRoleId, @PositionId, @JerseyNumber, @SeasonsPlayed, @ClassYear
      );

      SET @NewUserSportId = SCOPE_IDENTITY();
    END
  END
  ELSE
  BEGIN
    -- sport_id IS NULL — program-wide role (AD, Program Admin, etc.)
    -- Must use IS NULL comparison; NULL = NULL is always false in SQL.
    IF EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @UserId AND sport_id IS NULL)
    BEGIN
      UPDATE dbo.users_sports SET
        is_active       = 1,
        program_role_id = @ProgramRoleId,
        updated_at      = SYSUTCDATETIME()
      WHERE user_id = @UserId AND sport_id IS NULL;

      SELECT @NewUserSportId = id FROM dbo.users_sports WHERE user_id = @UserId AND sport_id IS NULL;
    END
    ELSE
    BEGIN
      INSERT INTO dbo.users_sports (user_id, sport_id, program_role_id)
      VALUES (@UserId, NULL, @ProgramRoleId);

      SET @NewUserSportId = SCOPE_IDENTITY();
    END
  END
END;
GO

-- ============================================================
-- sp_UpdateUserRole
-- Updates mutable fields on a users_sports row.
-- Identified by userId + sportId. NULL = no change.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateUserRole
  @UserId        INT,
  @SportId       INT,
  @PositionId    INT          = NULL,
  @JerseyNumber  TINYINT      = NULL,
  @SeasonsPlayed TINYINT      = NULL,
  @ClassYear     SMALLINT     = NULL,
  @AdminUserId   INT,
  @ErrorCode     NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @UserId AND sport_id = @SportId)
  BEGIN
    SET @ErrorCode = 'SPORT_NOT_FOUND';
    RETURN;
  END

  -- Jersey uniqueness check for active players in this sport
  IF @JerseyNumber IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM dbo.users_sports us
       WHERE  us.sport_id        = @SportId
         AND  us.jersey_number   = @JerseyNumber
         AND  us.is_active       = 1
         AND  us.program_role_id = 8
         AND  us.user_id        <> @UserId
     )
  BEGIN
    SET @ErrorCode = 'JERSEY_NUMBER_IN_USE';
    RETURN;
  END

  UPDATE dbo.users_sports SET
    position_id    = COALESCE(@PositionId,    position_id),
    jersey_number  = COALESCE(@JerseyNumber,  jersey_number),
    seasons_played = COALESCE(@SeasonsPlayed, seasons_played),
    class_year     = COALESCE(@ClassYear,      class_year),
    updated_at     = SYSUTCDATETIME()
  WHERE user_id = @UserId AND sport_id = @SportId;
END;
GO

-- ============================================================
-- sp_TransferUserRole
-- Changes a user's program role for a specific sport
-- (e.g. player → alumni on users_sports).
-- @SportId is required — role is now per user×sport.
-- Logs the change to dbo.role_change_log.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_TransferUserRole
  @UserId            INT,
  @NewProgramRoleId  INT,
  @SportId           INT,
  @SeasonsPlayed     TINYINT       = NULL,
  @ClassYear         SMALLINT      = NULL,
  @AdminUserId       INT,
  @Notes             NVARCHAR(MAX) = NULL,
  @ErrorCode         NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.program_role WHERE id = @NewProgramRoleId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'INVALID_PROGRAM_ROLE';
    RETURN;
  END

  DECLARE @FromProgramRoleId INT;
  SELECT @FromProgramRoleId = program_role_id
  FROM   dbo.users_sports
  WHERE  user_id  = @UserId
    AND  sport_id = @SportId
    AND  is_active = 1;

  IF @FromProgramRoleId IS NULL
  BEGIN
    SET @ErrorCode = 'SPORT_NOT_FOUND';
    RETURN;
  END

  IF @FromProgramRoleId = @NewProgramRoleId
  BEGIN
    SET @ErrorCode = 'ROLE_UNCHANGED';
    RETURN;
  END

  BEGIN TRANSACTION;
  BEGIN TRY
    -- Update program role on the specific sport membership row
    UPDATE dbo.users_sports SET
      program_role_id = @NewProgramRoleId,
      seasons_played  = COALESCE(@SeasonsPlayed, seasons_played),
      class_year      = COALESCE(@ClassYear,      class_year),
      updated_at      = SYSUTCDATETIME()
    WHERE user_id = @UserId AND sport_id = @SportId;

    -- Log the change
    INSERT INTO dbo.role_change_log (
      user_id, sport_id,
      from_program_role_id, to_program_role_id,
      changed_by, notes
    )
    VALUES (
      @UserId, @SportId,
      @FromProgramRoleId, @NewProgramRoleId,
      @AdminUserId, @Notes
    );

    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    SET @ErrorCode = 'TRANSFER_FAILED';
  END CATCH;
END;
GO
