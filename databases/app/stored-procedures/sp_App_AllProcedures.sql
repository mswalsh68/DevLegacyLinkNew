USE LegacyLinkApp;
GO
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- APP DB — ALL STORED PROCEDURES
-- Run on: each tenant AppDB after 014_schema_consolidation.sql
--
-- Schema (post-migration 014):
--   dbo.users          — user_id INT PK, program_role_id INT FK → program_role
--                        global_role_id INT (1/2/3), is_active BIT
--   dbo.users_sports   — id INT PK, user_id + sport_id (UNIQUE)
--                        position_id, jersey_number, class_year, seasons_played
--                        is_active BIT (soft-delete for sport membership)
--   dbo.sports         — id INT PK (Football = 1)
--   dbo.sports_position — position lookup by sport
--   dbo.program_role   — 8 roles; 8=player, 7=alumni, 1-6=staff
--   dbo.role_change_log — audit log for program_role changes
--   dbo.interaction_log — staff interactions, keyed on user_id
--   dbo.outreach_*     — campaign/email system (user_id based)
--   dbo.feed_*         — news feed (sport_id INT)
--
-- ID conventions:
--   @UserId      INT = dbo.users.user_id (global INT)
--   @UserSportId INT = dbo.users_sports.id
--   @SportId     INT = dbo.sports.id
--   @AdminUserId INT = dbo.users.user_id of the acting staff member
--
-- Role IDs (dbo.program_role):
--   1=athletic_director  2=program_admin  3=alumni_director
--   4=head_coach  5=coach  6=support_staff  7=alumni  8=player
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
  @SportId    INT,
  @Search     NVARCHAR(255) = NULL,
  @PositionId INT           = NULL,
  @ClassYear  SMALLINT      = NULL,
  @Page       INT           = 1,
  @PageSize   INT           = 50,
  @TotalCount INT           OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Offset     INT           = (@Page - 1) * @PageSize;
  DECLARE @SearchWild NVARCHAR(257) = '%' + ISNULL(@Search, '') + '%';

  SELECT @TotalCount = COUNT(*)
  FROM dbo.vwRoster r
  WHERE (@SportId IS NULL OR r.sport_id = @SportId)
    AND (@PositionId IS NULL OR r.position_id  = @PositionId)
    AND (@ClassYear  IS NULL OR r.class_year   = @ClassYear)
    AND (@Search IS NULL
         OR r.first_name    LIKE @SearchWild
         OR r.last_name     LIKE @SearchWild
         OR (r.jersey_number IS NOT NULL AND CAST(r.jersey_number AS NVARCHAR(10)) = @Search));

  SELECT
    r.userSportId   AS userSportId,
    r.user_id       AS userId,
    r.first_name    AS firstName,
    r.last_name     AS lastName,
    r.email,
    r.sport_id      AS sportId,
    r.sport_name    AS sportName,
    r.position_id   AS positionId,
    r.position,
    r.jersey_number AS jerseyNumber,
    r.seasons_played AS seasonsPlayed,
    r.class_year    AS classYear,
    r.created_at    AS createdAt,
    r.updated_at    AS updatedAt
  FROM dbo.vwRoster r
  WHERE (@SportId IS NULL OR r.sport_id = @SportId)
    AND (@PositionId IS NULL OR r.position_id  = @PositionId)
    AND (@ClassYear  IS NULL OR r.class_year   = @ClassYear)
    AND (@Search IS NULL
         OR r.first_name    LIKE @SearchWild
         OR r.last_name     LIKE @SearchWild
         OR (r.jersey_number IS NOT NULL AND CAST(r.jersey_number AS NVARCHAR(10)) = @Search))
  ORDER BY r.last_name, r.first_name
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- ============================================================
-- sp_GetAlumniBySport
-- Returns alumni for a given sport with pagination.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetAlumniBySport
  @SportId    INT,
  @Search     NVARCHAR(255) = NULL,
  @PositionId INT           = NULL,
  @ClassYear  SMALLINT      = NULL,
  @Page       INT           = 1,
  @PageSize   INT           = 50,
  @TotalCount INT           OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Offset     INT           = (@Page - 1) * @PageSize;
  DECLARE @SearchWild NVARCHAR(257) = '%' + ISNULL(@Search, '') + '%';

  SELECT @TotalCount = COUNT(*)
  FROM dbo.vwAlumniRoster a
  WHERE (@SportId IS NULL OR a.sport_id = @SportId)
    AND (@PositionId IS NULL OR a.position_id = @PositionId)
    AND (@ClassYear  IS NULL OR a.class_year  = @ClassYear)
    AND (@Search IS NULL
         OR a.first_name LIKE @SearchWild
         OR a.last_name  LIKE @SearchWild
         OR a.email      LIKE @SearchWild);

  SELECT
    a.userSportId   AS userSportId,
    a.user_id       AS userId,
    a.first_name    AS firstName,
    a.last_name     AS lastName,
    a.email,
    a.sport_id      AS sportId,
    a.sport_name    AS sportName,
    a.position_id   AS positionId,
    a.position,
    a.jersey_number AS jerseyNumber,
    a.seasons_played AS seasonsPlayed,
    a.class_year    AS classYear,
    a.created_at    AS createdAt,
    a.updated_at    AS updatedAt
  FROM dbo.vwAlumniRoster a
  WHERE (@SportId IS NULL OR a.sport_id = @SportId)
    AND (@PositionId IS NULL OR a.position_id = @PositionId)
    AND (@ClassYear  IS NULL OR a.class_year  = @ClassYear)
    AND (@Search IS NULL
         OR a.first_name LIKE @SearchWild
         OR a.last_name  LIKE @SearchWild
         OR a.email      LIKE @SearchWild)
  ORDER BY a.last_name, a.first_name
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

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

-- ============================================================
-- sp_CreateCampaign
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreateCampaign
  @Name            NVARCHAR(200),
  @Description     NVARCHAR(MAX)    = NULL,
  @TargetAudience  NVARCHAR(30),
  @AudienceFilters NVARCHAR(MAX)    = NULL,
  @ScheduledAt     DATETIME2        = NULL,
  @CreatedBy       INT,
  @SportId         INT              = NULL,
  @SubjectLine     NVARCHAR(500)    = NULL,
  @BodyHtml        NVARCHAR(MAX)    = NULL,
  @FromName        NVARCHAR(200)    = NULL,
  @ReplyToEmail    NVARCHAR(255)    = NULL,
  @PhysicalAddress NVARCHAR(500)    = NULL,
  @NewCampaignId   UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode       NVARCHAR(50)     OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF LEN(LTRIM(RTRIM(@Name))) = 0 BEGIN SET @ErrorCode = 'NAME_REQUIRED'; RETURN; END
  IF @TargetAudience NOT IN ('all','players_only','alumni_only','byClass','byPosition','byGradYear','custom')
    BEGIN SET @ErrorCode = 'INVALID_TARGET_AUDIENCE'; RETURN; END
  IF @TargetAudience = 'custom' AND (@AudienceFilters IS NULL OR LEN(@AudienceFilters) < 2)
    BEGIN SET @ErrorCode = 'CUSTOM_AUDIENCE_REQUIRES_FILTERS'; RETURN; END
  IF @ScheduledAt IS NOT NULL AND @ScheduledAt < SYSUTCDATETIME()
    BEGIN SET @ErrorCode = 'SCHEDULED_DATE_IN_PAST'; RETURN; END

  SET @NewCampaignId = NEWID();

  INSERT INTO dbo.outreach_campaigns (
    id, sport_id, name, description, target_audience, audience_filters,
    scheduled_at, subject_line, body_html, from_name, reply_to_email,
    physical_address, created_by
  )
  VALUES (
    @NewCampaignId, @SportId, @Name, @Description, @TargetAudience, @AudienceFilters,
    @ScheduledAt, @SubjectLine, @BodyHtml, @FromName, @ReplyToEmail,
    @PhysicalAddress, @CreatedBy
  );
END;
GO

-- ============================================================
-- sp_GetCampaigns
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetCampaigns
  @SportId INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    c.id, c.sport_id AS sportId, c.name, c.description,
    c.target_audience AS targetAudience, c.status,
    c.scheduled_at AS scheduledAt, c.completed_at AS completedAt,
    c.created_by AS createdBy, c.created_at AS createdAt,
    COUNT(m.id)                                                       AS totalMessages,
    SUM(CASE WHEN m.status = 'sent'      THEN 1 ELSE 0 END)          AS sentCount,
    SUM(CASE WHEN m.status = 'responded' THEN 1 ELSE 0 END)          AS respondedCount,
    SUM(CASE WHEN m.status = 'bounced'   THEN 1 ELSE 0 END)          AS bouncedCount,
    CASE
      WHEN SUM(CASE WHEN m.status = 'sent' THEN 1 ELSE 0 END) > 0
      THEN CAST(SUM(CASE WHEN m.status = 'responded' THEN 1 ELSE 0 END) * 100.0 /
                SUM(CASE WHEN m.status = 'sent'      THEN 1 ELSE 0 END) AS DECIMAL(5,2))
      ELSE 0
    END AS responseRatePct
  FROM dbo.outreach_campaigns c
  LEFT JOIN dbo.outreach_messages m ON m.campaign_id = c.id
  WHERE (@SportId IS NULL OR c.sport_id = @SportId)
  GROUP BY c.id, c.sport_id, c.name, c.description, c.target_audience,
           c.status, c.scheduled_at, c.completed_at, c.created_by, c.created_at
  ORDER BY c.created_at DESC;
END;
GO

-- ============================================================
-- sp_GetCampaignDetail
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetCampaignDetail
  @CampaignId UNIQUEIDENTIFIER,
  @ErrorCode  NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.outreach_campaigns WHERE id = @CampaignId)
  BEGIN
    SET @ErrorCode = 'CAMPAIGN_NOT_FOUND';
    RETURN;
  END

  SELECT
    oc.id, oc.name, oc.description,
    oc.target_audience  AS targetAudience,
    oc.audience_filters AS audienceFilters,
    oc.status, oc.campaign_type AS campaignType,
    oc.subject_line     AS subjectLine,
    oc.scheduled_at     AS scheduledAt,
    oc.started_at       AS startedAt,
    oc.completed_at     AS completedAt,
    oc.created_at       AS createdAt,
    SUM(CASE WHEN om.status IN ('queued','sent','responded') THEN 1 ELSE 0 END) AS totalQueued,
    SUM(CASE WHEN om.status IN ('sent','responded')          THEN 1 ELSE 0 END) AS totalSent,
    SUM(CASE WHEN om.opened_at IS NOT NULL                   THEN 1 ELSE 0 END) AS totalOpened,
    (
      SELECT COUNT(*) FROM dbo.email_unsubscribes eu2
      JOIN   dbo.outreach_messages om2 ON eu2.user_id = om2.user_id
      WHERE  om2.campaign_id = oc.id
    ) AS unsubscribeCount,
    CASE
      WHEN SUM(CASE WHEN om.status IN ('sent','responded') THEN 1 ELSE 0 END) = 0 THEN 0
      ELSE CAST(
        100.0 * SUM(CASE WHEN om.opened_at IS NOT NULL THEN 1 ELSE 0 END)
        / NULLIF(SUM(CASE WHEN om.status IN ('sent','responded') THEN 1 ELSE 0 END), 0)
      AS DECIMAL(5,1))
    END AS openRatePct
  FROM dbo.outreach_campaigns oc
  LEFT JOIN dbo.outreach_messages om ON om.campaign_id = oc.id
  WHERE oc.id = @CampaignId
  GROUP BY
    oc.id, oc.name, oc.description, oc.target_audience, oc.audience_filters,
    oc.status, oc.campaign_type, oc.subject_line, oc.scheduled_at,
    oc.started_at, oc.completed_at, oc.created_at;
END;
GO

-- ============================================================
-- sp_CancelCampaign
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CancelCampaign
  @CampaignId UNIQUEIDENTIFIER,
  @ErrorCode  NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @CurStatus NVARCHAR(20);
  SELECT @CurStatus = status FROM dbo.outreach_campaigns WHERE id = @CampaignId;

  IF @CurStatus IS NULL BEGIN SET @ErrorCode = 'CAMPAIGN_NOT_FOUND'; RETURN; END
  IF @CurStatus NOT IN ('draft','scheduled') BEGIN SET @ErrorCode = 'CANNOT_CANCEL'; RETURN; END

  UPDATE dbo.outreach_campaigns
  SET status = 'cancelled', updated_at = SYSUTCDATETIME()
  WHERE id = @CampaignId;
END;
GO

-- ============================================================
-- sp_ResolveAudienceForCampaign
-- Returns eligible recipients based on program_role_id + users_sports.
-- Recipients: active users with program_role_id IN (7,8)
-- who have an email address and are not unsubscribed.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_ResolveAudienceForCampaign
  @CampaignId UNIQUEIDENTIFIER,
  @ErrorCode  NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @Audience    NVARCHAR(30);
  DECLARE @FiltersJson NVARCHAR(MAX);
  DECLARE @SportId     INT;

  SELECT @Audience = target_audience, @FiltersJson = audience_filters, @SportId = sport_id
  FROM dbo.outreach_campaigns
  WHERE id = @CampaignId;

  IF @Audience IS NULL BEGIN SET @ErrorCode = 'CAMPAIGN_NOT_FOUND'; RETURN; END

  DECLARE @FilterClassYear  SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.classYear')  AS SMALLINT);
  DECLARE @FilterGradYear   SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.gradYear')   AS SMALLINT);
  DECLARE @FilterPositionId INT          = TRY_CAST(JSON_VALUE(@FiltersJson, '$.positionId') AS INT);
  DECLARE @FilterGradYears  NVARCHAR(MAX)= JSON_QUERY(@FiltersJson, '$.gradYears');

  SELECT DISTINCT
    u.user_id           AS recipientId,
    CASE us.program_role_id WHEN 8 THEN 'current_player' ELSE 'alumni' END AS recipientType,
    u.first_name        AS firstName,
    u.last_name         AS lastName,
    u.email,
    sp.position_name    AS position,
    us.class_year       AS classYear,
    CASE WHEN eu.id IS NOT NULL THEN 1 ELSE 0 END AS isUnsubscribed
  FROM dbo.users u
  JOIN dbo.users_sports    us ON us.user_id  = u.user_id
    AND us.is_active        = 1
    AND us.program_role_id IN (7, 8)
    AND (@SportId IS NULL OR us.sport_id = @SportId)
  LEFT JOIN dbo.sports_position sp ON sp.position_id = us.position_id
  LEFT JOIN dbo.email_unsubscribes eu ON eu.user_id = u.user_id AND eu.channel = 'email'
  WHERE u.email IS NOT NULL
    AND u.is_active = 1
    AND (
      (@Audience = 'all'             AND us.program_role_id IN (7, 8))
      OR (@Audience = 'players_only' AND us.program_role_id = 8)
      OR (@Audience = 'alumni_only'  AND us.program_role_id = 7)
      OR (@Audience = 'byClass'
          AND us.program_role_id = 8
          AND @FilterClassYear IS NOT NULL
          AND us.class_year = @FilterClassYear)
      OR (@Audience = 'byGradYear'
          AND us.program_role_id = 7
          AND (
            (@FilterGradYear  IS NOT NULL AND us.class_year = @FilterGradYear)
            OR (@FilterGradYears IS NOT NULL AND EXISTS (
              SELECT 1 FROM OPENJSON(@FilterGradYears) WHERE CAST([value] AS SMALLINT) = us.class_year
            ))
          ))
      OR (@Audience = 'byPosition'
          AND us.program_role_id IN (7, 8)
          AND @FilterPositionId IS NOT NULL
          AND us.position_id = @FilterPositionId)
      OR (@Audience = 'custom'
          AND us.program_role_id IN (7, 8)
          AND (@FilterPositionId IS NULL OR us.position_id = @FilterPositionId)
          AND (@FilterGradYear   IS NULL OR us.class_year  = @FilterGradYear))
    );
END;
GO

-- ============================================================
-- sp_DispatchEmailCampaign
-- Queues outreach_messages for all eligible recipients.
-- Returns: Resultset 1 = campaign header, Resultset 2 = queued recipients
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_DispatchEmailCampaign
  @CampaignId       UNIQUEIDENTIFIER,
  @DailyRemaining   INT,
  @MonthlyRemaining INT,
  @QueuedCount      INT OUTPUT,
  @ErrorCode        NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode   = NULL;
  SET @QueuedCount = 0;

  DECLARE @CampaignStatus  NVARCHAR(20),
          @Audience        NVARCHAR(30),
          @FiltersJson     NVARCHAR(MAX),
          @SportId         INT,
          @SubjectLine     NVARCHAR(255),
          @BodyHtml        NVARCHAR(MAX),
          @FromName        NVARCHAR(100),
          @ReplyToEmail    NVARCHAR(255),
          @PhysicalAddress NVARCHAR(500),
          @CampaignName    NVARCHAR(100);

  SELECT
    @CampaignStatus  = status,
    @Audience        = target_audience,
    @FiltersJson     = audience_filters,
    @SportId         = sport_id,
    @SubjectLine     = subject_line,
    @BodyHtml        = body_html,
    @FromName        = from_name,
    @ReplyToEmail    = reply_to_email,
    @PhysicalAddress = physical_address,
    @CampaignName    = name
  FROM dbo.outreach_campaigns
  WHERE id = @CampaignId;

  IF @CampaignStatus IS NULL BEGIN SET @ErrorCode = 'CAMPAIGN_NOT_FOUND'; RETURN; END
  IF @CampaignStatus NOT IN ('draft','scheduled') BEGIN SET @ErrorCode = 'INVALID_CAMPAIGN_STATUS'; RETURN; END

  DECLARE @FilterClassYear  SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.classYear')  AS SMALLINT);
  DECLARE @FilterGradYear   SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.gradYear')   AS SMALLINT);
  DECLARE @FilterPositionId INT          = TRY_CAST(JSON_VALUE(@FiltersJson, '$.positionId') AS INT);
  DECLARE @FilterGradYears  NVARCHAR(MAX)= JSON_QUERY(@FiltersJson, '$.gradYears');

  SELECT DISTINCT
    u.user_id    AS userId,
    u.email      AS emailAddress,
    u.first_name AS firstName,
    NEWID()      AS unsubToken
  INTO #recipients
  FROM dbo.users u
  JOIN dbo.users_sports us ON us.user_id  = u.user_id
    AND us.is_active        = 1
    AND us.program_role_id IN (7, 8)
    AND (@SportId IS NULL OR us.sport_id = @SportId)
  WHERE u.email IS NOT NULL
    AND u.is_active = 1
    AND NOT EXISTS (
      SELECT 1 FROM dbo.email_unsubscribes eu
      WHERE eu.user_id = u.user_id AND eu.channel = 'email'
    )
    AND NOT EXISTS (
      SELECT 1 FROM dbo.outreach_messages om
      WHERE om.campaign_id = @CampaignId AND om.user_id = u.user_id
    )
    AND (
      (@Audience = 'all'             AND us.program_role_id IN (7, 8))
      OR (@Audience = 'players_only' AND us.program_role_id = 8)
      OR (@Audience = 'alumni_only'  AND us.program_role_id = 7)
      OR (@Audience = 'byClass'
          AND us.program_role_id = 8
          AND @FilterClassYear IS NOT NULL
          AND us.class_year = @FilterClassYear)
      OR (@Audience = 'byGradYear'
          AND us.program_role_id = 7
          AND (
            (@FilterGradYear IS NOT NULL AND us.class_year = @FilterGradYear)
            OR (@FilterGradYears IS NOT NULL AND EXISTS (
              SELECT 1 FROM OPENJSON(@FilterGradYears) WHERE CAST([value] AS SMALLINT) = us.class_year
            ))
          ))
      OR (@Audience = 'byPosition'
          AND us.program_role_id IN (7, 8)
          AND @FilterPositionId IS NOT NULL
          AND us.position_id = @FilterPositionId)
      OR (@Audience = 'custom'
          AND us.program_role_id IN (7, 8)
          AND (@FilterPositionId IS NULL OR us.position_id = @FilterPositionId)
          AND (@FilterGradYear   IS NULL OR us.class_year  = @FilterGradYear))
    );

  SET @QueuedCount = (SELECT COUNT(*) FROM #recipients);

  IF @QueuedCount = 0 BEGIN SET @ErrorCode = 'NO_ELIGIBLE_RECIPIENTS'; DROP TABLE #recipients; RETURN; END
  IF @QueuedCount > @DailyRemaining   BEGIN SET @ErrorCode = 'DAILY_LIMIT_EXCEEDED';   DROP TABLE #recipients; RETURN; END
  IF @QueuedCount > @MonthlyRemaining BEGIN SET @ErrorCode = 'MONTHLY_LIMIT_EXCEEDED'; DROP TABLE #recipients; RETURN; END

  INSERT INTO dbo.outreach_messages (
    campaign_id, user_id, channel, status, email_address, unsubscribe_token
  )
  SELECT
    @CampaignId, r.userId, 'email', 'queued', r.emailAddress, r.unsubToken
  FROM #recipients r;

  UPDATE dbo.outreach_campaigns
  SET status = 'active', started_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
  WHERE id = @CampaignId;

  -- Resultset 1 — campaign header (single row; caller uses this to build each email)
  SELECT
    @SubjectLine     AS subjectLine,
    @BodyHtml        AS bodyHtml,
    @FromName        AS fromName,
    @ReplyToEmail    AS replyToEmail,
    @PhysicalAddress AS physicalAddress,
    @CampaignName    AS campaignName;

  -- Resultset 2 — queued recipients
  SELECT
    om.id                AS messageId,
    om.user_id           AS userId,
    r.firstName,
    om.email_address     AS emailAddress,
    om.unsubscribe_token AS unsubscribeToken
  FROM dbo.outreach_messages om
  JOIN #recipients r ON om.user_id = r.userId
  WHERE om.campaign_id = @CampaignId AND om.status = 'queued';

  DROP TABLE #recipients;
END;
GO

-- ============================================================
-- sp_MarkEmailSent
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_MarkEmailSent
  @MessagesJson NVARCHAR(MAX),
  @ErrorCode    NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  UPDATE om
  SET    om.status    = 'sent',
         om.sent_at   = SYSUTCDATETIME(),
         om.resend_id = j.resendId
  FROM   dbo.outreach_messages om
  JOIN   OPENJSON(@MessagesJson)
         WITH (
           messageId UNIQUEIDENTIFIER '$.messageId',
           resendId  NVARCHAR(100)    '$.resendId'
         ) j ON j.messageId = om.id
  WHERE  om.status = 'queued';

  UPDATE oc
  SET    oc.status       = 'completed',
         oc.completed_at = SYSUTCDATETIME(),
         oc.updated_at   = SYSUTCDATETIME()
  FROM   dbo.outreach_campaigns oc
  WHERE  oc.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM dbo.outreach_messages om2
      WHERE om2.campaign_id = oc.id AND om2.status = 'queued'
    );
END;
GO

-- ============================================================
-- sp_MarkEmailOpened
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_MarkEmailOpened
  @ResendId  NVARCHAR(100),
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  UPDATE dbo.outreach_messages
  SET opened_at = ISNULL(opened_at, SYSUTCDATETIME()),
      status    = CASE WHEN status = 'sent' THEN 'responded' ELSE status END
  WHERE resend_id = @ResendId;

  IF @@ROWCOUNT = 0
    SET @ErrorCode = 'MESSAGE_NOT_FOUND';
END;
GO

-- ============================================================
-- sp_ProcessUnsubscribe
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_ProcessUnsubscribe
  @Token     UNIQUEIDENTIFIER,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @UserId    INT;
  DECLARE @FirstName NVARCHAR(100);

  SELECT @UserId = om.user_id
  FROM   dbo.outreach_messages om
  WHERE  om.unsubscribe_token = @Token;

  IF @UserId IS NULL
  BEGIN
    SET @ErrorCode = 'INVALID_TOKEN';
    RETURN;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.email_unsubscribes WHERE user_id = @UserId AND channel = 'email')
    INSERT INTO dbo.email_unsubscribes (user_id, channel) VALUES (@UserId, 'email');

  SELECT @FirstName = first_name FROM dbo.users WHERE user_id = @UserId;
  SELECT @FirstName AS firstName;
END;
GO

-- ============================================================
-- sp_CreatePost
-- V3: audience = 'all_sports' | 'sport_specific' | 'multi_sport'.
-- target_program_role_id = NULL (all) | 7 (alumni) | 8 (roster).
-- Alumni validated against their sport(s) in users_sports.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreatePost
  @CreatedBy            INT,
  @BodyHtml             NVARCHAR(MAX),
  @Audience             NVARCHAR(30),
  @Title                NVARCHAR(300)    = NULL,
  @AudienceJson         NVARCHAR(MAX)    = NULL,
  @SportId              INT              = NULL,
  @IsPinned             BIT              = 0,
  @AlsoEmail            BIT              = 0,
  @EmailSubject         NVARCHAR(500)    = NULL,
  @PosterProgramRoleId  INT              = NULL,
  @TargetProgramRoleId  INT              = NULL,
  @NewPostId            UNIQUEIDENTIFIER OUTPUT,
  @CampaignId           UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode            NVARCHAR(50)     OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode  = NULL;
  SET @NewPostId  = NULL;
  SET @CampaignId = NULL;

  IF @Audience NOT IN ('all_sports', 'sport_specific', 'multi_sport')
  BEGIN
    SET @ErrorCode = 'INVALID_AUDIENCE';
    RETURN;
  END

  IF @Audience = 'sport_specific' AND @SportId IS NULL
  BEGIN
    SET @ErrorCode = 'SPORT_REQUIRED_FOR_SPORT_SPECIFIC';
    RETURN;
  END

  IF @Audience = 'multi_sport' AND (@AudienceJson IS NULL OR @AudienceJson = N'[]')
  BEGIN
    SET @ErrorCode = 'SPORTS_REQUIRED_FOR_MULTI_SPORT';
    RETURN;
  END

  IF @TargetProgramRoleId IS NOT NULL AND @TargetProgramRoleId NOT IN (7, 8)
  BEGIN
    SET @ErrorCode = 'INVALID_TARGET_PROGRAM_ROLE';
    RETURN;
  END

  -- Alumni (program_role_id = 7) may only post to their OWN sport(s)
  IF @PosterProgramRoleId = 7 AND @Audience = 'sport_specific'
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM dbo.users_sports
      WHERE user_id  = @CreatedBy
        AND sport_id = @SportId
        AND is_active = 1
    )
    BEGIN
      SET @ErrorCode = 'SPORT_NOT_ALLOWED';
      RETURN;
    END
  END

  IF @PosterProgramRoleId = 7 AND @Audience = 'multi_sport'
  BEGIN
    IF EXISTS (
      SELECT 1 FROM OPENJSON(@AudienceJson) oj
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.users_sports
        WHERE user_id  = @CreatedBy
          AND sport_id = CAST(oj.[value] AS INT)
          AND is_active = 1
      )
    )
    BEGIN
      SET @ErrorCode = 'SPORT_NOT_ALLOWED';
      RETURN;
    END
  END

  IF @AlsoEmail = 1 AND @EmailSubject IS NULL
  BEGIN
    SET @ErrorCode = 'EMAIL_SUBJECT_REQUIRED';
    RETURN;
  END

  IF @IsPinned = 1
    UPDATE dbo.feed_posts SET is_pinned = 0 WHERE is_pinned = 1;

  SET @NewPostId = NEWID();

  INSERT INTO dbo.feed_posts (
    id, created_by, title, body_html, audience, audience_json,
    sport_id, is_pinned, published_at, target_program_role_id
  )
  VALUES (
    @NewPostId, @CreatedBy, @Title, @BodyHtml, @Audience, @AudienceJson,
    CASE @Audience WHEN 'sport_specific' THEN @SportId ELSE NULL END,
    ISNULL(@IsPinned, 0), SYSUTCDATETIME(),
    @TargetProgramRoleId
  );

  IF @AlsoEmail = 1
  BEGIN
    SET @CampaignId = NEWID();
    INSERT INTO dbo.outreach_campaigns (
      id, name, description, target_audience, audience_filters,
      status, campaign_type, subject_line, body_html, sport_id, created_by
    )
    VALUES (
      @CampaignId,
      ISNULL(@Title, LEFT(@BodyHtml, 100)),
      N'Auto-created from feed post',
      CASE @TargetProgramRoleId
        WHEN 7 THEN 'alumni_only'
        WHEN 8 THEN 'players_only'
        ELSE        'all'
      END,
      NULL,
      'draft', 'post_notification',
      @EmailSubject, @BodyHtml,
      CASE @Audience WHEN 'sport_specific' THEN @SportId ELSE NULL END,
      @CreatedBy
    );
    UPDATE dbo.feed_posts SET campaign_id = @CampaignId WHERE id = @NewPostId;
  END
END;
GO

-- ============================================================
-- sp_GetFeed  (V3)
-- Audience scoping:
--   Internal (global role 1/2) or program roles 1,2,3,6 = all sports.
--   Program roles 4,5,7,8 = sport-scoped to their users_sports rows.
--   @MySport = 1 narrows all-sports viewers to their own sport.
-- Recipient scoping:
--   Program role 7 (alumni) hard-scoped: sees target_program_role_id NULL or 7.
--   Program role 8 (player) hard-scoped: sees target_program_role_id NULL or 8.
--   Roles 1-6 + internal: see all; @TargetGroupFilter optionally narrows.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetFeed
  @ViewerUserId        INT,
  @MySport             BIT = 0,
  @Page                INT = 1,
  @PageSize            INT = 20,
  @ViewerTierId        INT = NULL,
  @ViewerGlobalRoleId  INT = NULL,
  @ViewerProgramRoleId INT = NULL,
  @TargetGroupFilter   INT = NULL,
  @TotalCount          INT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @TotalCount = 0;

  DECLARE @Offset    INT = (@Page - 1) * @PageSize;
  IF @Offset < 0 SET @Offset = 0;

  -- All-sports viewer: internal (global 1/2) OR program roles 1,2,3,6
  DECLARE @AllSports BIT = CASE
    WHEN @ViewerGlobalRoleId IN (1, 2)         THEN 1
    WHEN @ViewerProgramRoleId IN (1, 2, 3, 6)  THEN 1
    ELSE 0
  END;

  -- Effective recipient filter:
  --   alumni (7) and player (8) are always hard-scoped to their own role.
  --   All-sports viewers use @TargetGroupFilter (NULL = no filter).
  DECLARE @EffectiveTarget INT = CASE
    WHEN @ViewerProgramRoleId IN (7, 8) THEN @ViewerProgramRoleId
    ELSE @TargetGroupFilter
  END;

  ;WITH visible_posts AS (
    SELECT fp.*
    FROM dbo.feed_posts fp
    WHERE fp.is_deleted = 0

      -- ── Audience / sport scoping ──────────────────────────────
      AND (
        fp.audience = 'all_sports'

        -- All-sports viewers with no sport filter: see everything
        OR (@AllSports = 1 AND @MySport = 0)

        -- Sport-match: covers all-sports viewers with @MySport=1
        --              AND sport-scoped viewers (always filtered)
        OR (
          fp.audience = 'sport_specific'
          AND fp.sport_id IN (
            SELECT sport_id FROM dbo.users_sports
            WHERE user_id = @ViewerUserId AND is_active = 1
          )
        )
        OR (
          fp.audience = 'multi_sport'
          AND EXISTS (
            SELECT 1 FROM OPENJSON(fp.audience_json) oj
            WHERE CAST(oj.[value] AS INT) IN (
              SELECT sport_id FROM dbo.users_sports
              WHERE user_id = @ViewerUserId AND is_active = 1
            )
          )
        )
      )

      -- ── Regular post recipient filter ─────────────────────────
      AND (
        fp.is_welcome_post = 1                          -- welcome posts handled below
        OR fp.target_program_role_id IS NULL            -- post targets everyone
        OR @EffectiveTarget IS NULL                     -- viewer has no active filter
        OR fp.target_program_role_id = @EffectiveTarget -- post matches viewer's filter
      )

      -- ── Welcome post tier + role filter ──────────────────────
      AND (
        fp.is_welcome_post = 0
        OR (
          (@ViewerTierId IS NULL OR fp.target_tier_id IS NULL OR fp.target_tier_id = @ViewerTierId)
          AND (
            -- NULL target = admin/staff welcome post -> visible to non-player/alumni viewers
            (fp.target_program_role_id IS NULL
              AND (@ViewerProgramRoleId IS NULL OR @ViewerProgramRoleId NOT IN (7, 8)))
            -- Exact role match (player sees player post, alumni sees alumni post)
            OR (fp.target_program_role_id IS NOT NULL
              AND fp.target_program_role_id = @ViewerProgramRoleId)
          )
        )
      )
  )
  SELECT @TotalCount = COUNT(*) FROM visible_posts;

  ;WITH visible_posts AS (
    SELECT fp.*
    FROM dbo.feed_posts fp
    WHERE fp.is_deleted = 0
      AND (
        fp.audience = 'all_sports'
        OR (@AllSports = 1 AND @MySport = 0)
        OR (
          fp.audience = 'sport_specific'
          AND fp.sport_id IN (
            SELECT sport_id FROM dbo.users_sports
            WHERE user_id = @ViewerUserId AND is_active = 1
          )
        )
        OR (
          fp.audience = 'multi_sport'
          AND EXISTS (
            SELECT 1 FROM OPENJSON(fp.audience_json) oj
            WHERE CAST(oj.[value] AS INT) IN (
              SELECT sport_id FROM dbo.users_sports
              WHERE user_id = @ViewerUserId AND is_active = 1
            )
          )
        )
      )
      AND (
        fp.is_welcome_post = 1
        OR fp.target_program_role_id IS NULL
        OR @EffectiveTarget IS NULL
        OR fp.target_program_role_id = @EffectiveTarget
      )
      AND (
        fp.is_welcome_post = 0
        OR (
          (@ViewerTierId IS NULL OR fp.target_tier_id IS NULL OR fp.target_tier_id = @ViewerTierId)
          AND (
            (fp.target_program_role_id IS NULL
              AND (@ViewerProgramRoleId IS NULL OR @ViewerProgramRoleId NOT IN (7, 8)))
            OR (fp.target_program_role_id IS NOT NULL
              AND fp.target_program_role_id = @ViewerProgramRoleId)
          )
        )
      )
  )
  SELECT
    vp.id,
    vp.title,
    vp.body_html              AS bodyHtml,
    vp.audience,
    vp.audience_json          AS audienceJson,
    vp.sport_id               AS sportId,
    s.name                    AS sportName,
    vp.is_pinned              AS isPinned,
    vp.is_welcome_post        AS isWelcomePost,
    vp.image_url              AS imageUrl,
    vp.campaign_id            AS campaignId,
    vp.created_by             AS createdBy,
    vp.target_program_role_id AS targetProgramRoleId,
    CONCAT(u.first_name, ' ', u.last_name) AS createdByName,
    vp.published_at           AS publishedAt,
    vp.created_at             AS createdAt,
    vp.updated_at             AS updatedAt,
    CASE WHEN fpr.id IS NOT NULL THEN 1 ELSE 0 END AS isRead,
    (
      SELECT COUNT(*) FROM dbo.feed_post_likes l WHERE l.post_id = vp.id
    ) AS likeCount,
    CASE WHEN EXISTS (
      SELECT 1 FROM dbo.feed_post_likes l2
      WHERE l2.post_id = vp.id AND l2.user_id = @ViewerUserId
    ) THEN 1 ELSE 0 END AS userHasLiked
  FROM visible_posts vp
  LEFT JOIN dbo.users            u   ON u.user_id  = vp.created_by
  LEFT JOIN dbo.sports           s   ON s.id       = vp.sport_id
  LEFT JOIN dbo.feed_post_reads  fpr ON fpr.post_id = vp.id AND fpr.user_id = @ViewerUserId
  ORDER BY vp.is_pinned DESC, vp.published_at DESC
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- ============================================================
-- sp_GetFeedPost  (V2)
-- Returns a single post. Audience check via users_sports.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetFeedPost
  @PostId       UNIQUEIDENTIFIER,
  @ViewerUserId INT,
  @ErrorCode    NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  SELECT
    fp.id, fp.title,
    fp.body_html       AS bodyHtml,
    fp.audience,
    fp.audience_json   AS audienceJson,
    fp.sport_id        AS sportId,
    s.name             AS sportName,
    fp.is_pinned       AS isPinned,
    fp.is_welcome_post AS isWelcomePost,
    fp.campaign_id     AS campaignId,
    fp.created_by      AS createdBy,
    CONCAT(u.first_name, ' ', u.last_name) AS createdByName,
    fp.published_at    AS publishedAt,
    fp.created_at      AS createdAt,
    fp.updated_at      AS updatedAt,
    CASE WHEN fpr.id IS NOT NULL THEN 1 ELSE 0 END AS isRead,
    (
      SELECT COUNT(*) FROM dbo.feed_post_likes l WHERE l.post_id = fp.id
    ) AS likeCount,
    CASE WHEN EXISTS (
      SELECT 1 FROM dbo.feed_post_likes l2
      WHERE l2.post_id = fp.id AND l2.user_id = @ViewerUserId
    ) THEN 1 ELSE 0 END AS userHasLiked
  FROM dbo.feed_posts fp
  LEFT JOIN dbo.users           u   ON u.user_id  = fp.created_by
  LEFT JOIN dbo.sports          s   ON s.id       = fp.sport_id
  LEFT JOIN dbo.feed_post_reads fpr ON fpr.post_id = fp.id AND fpr.user_id = @ViewerUserId
  WHERE fp.id        = @PostId
    AND fp.is_deleted = 0
    AND (
      fp.audience = 'all_sports'
      OR (
        fp.audience = 'sport_specific'
        AND fp.sport_id IN (
          SELECT sport_id FROM dbo.users_sports
          WHERE user_id = @ViewerUserId AND is_active = 1
        )
      )
    );

  IF @@ROWCOUNT = 0
    SET @ErrorCode = 'NOT_FOUND_OR_UNAUTHORIZED';
END;
GO

-- ============================================================
-- sp_MarkPostRead
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_MarkPostRead
  @PostId UNIQUEIDENTIFIER,
  @UserId INT
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.feed_posts WHERE id = @PostId) RETURN;

  IF NOT EXISTS (
    SELECT 1 FROM dbo.feed_post_reads WHERE post_id = @PostId AND user_id = @UserId
  )
  BEGIN
    INSERT INTO dbo.feed_post_reads (post_id, user_id) VALUES (@PostId, @UserId);
  END
END;
GO

-- ============================================================
-- sp_GetPostReadStats  (V2)
-- Counts eligible audience from users + users_sports.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetPostReadStats
  @PostId    UNIQUEIDENTIFIER,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @Audience NVARCHAR(30);
  DECLARE @SportId  INT;

  SELECT @Audience = audience, @SportId = sport_id
  FROM   dbo.feed_posts WHERE id = @PostId AND is_deleted = 0;

  IF @Audience IS NULL BEGIN SET @ErrorCode = 'POST_NOT_FOUND'; RETURN; END

  DECLARE @TotalEligible INT = 0;

  IF @Audience = 'all_sports'
  BEGIN
    -- All active players + alumni (across any sport)
    SELECT @TotalEligible = COUNT(DISTINCT us.user_id)
    FROM   dbo.users_sports us
    JOIN   dbo.users u ON u.user_id = us.user_id
    WHERE  us.is_active        = 1
      AND  us.program_role_id IN (7, 8)
      AND  u.is_active         = 1;
  END
  ELSE
  BEGIN
    -- Active players + alumni who have a users_sports row for this sport
    SELECT @TotalEligible = COUNT(DISTINCT us.user_id)
    FROM   dbo.users_sports us
    JOIN   dbo.users u ON u.user_id = us.user_id
    WHERE  us.sport_id         = @SportId
      AND  us.is_active        = 1
      AND  us.program_role_id IN (7, 8)
      AND  u.is_active         = 1;
  END

  DECLARE @TotalRead INT;
  SELECT @TotalRead = COUNT(*) FROM dbo.feed_post_reads WHERE post_id = @PostId;

  SELECT
    @TotalEligible AS totalEligible,
    @TotalRead     AS totalRead,
    CASE WHEN @TotalEligible = 0 THEN 0
         ELSE CAST(@TotalRead * 100.0 / @TotalEligible AS DECIMAL(5,1))
    END AS readRatePct;
END;
GO

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

-- ============================================================
-- sp_TogglePostLike
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_TogglePostLike
  @PostId    UNIQUEIDENTIFIER,
  @UserId    INT,
  @Liked     BIT          OUTPUT,
  @LikeCount INT          OUTPUT,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @Liked     = 0;
  SET @LikeCount = 0;

  IF NOT EXISTS (SELECT 1 FROM dbo.feed_posts WHERE id = @PostId AND is_deleted = 0)
  BEGIN
    SET @ErrorCode = 'POST_NOT_FOUND';
    RETURN;
  END

  IF EXISTS (
    SELECT 1 FROM dbo.feed_post_likes
    WHERE post_id = @PostId AND user_id = @UserId
  )
  BEGIN
    DELETE FROM dbo.feed_post_likes
    WHERE post_id = @PostId AND user_id = @UserId;
    SET @Liked = 0;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.feed_post_likes (post_id, user_id)
    VALUES (@PostId, @UserId);
    SET @Liked = 1;
  END

  SELECT @LikeCount = COUNT(*) FROM dbo.feed_post_likes WHERE post_id = @PostId;
END;
GO

-- ============================================================
-- sp_SoftDeletePost
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SoftDeletePost
  @PostId       UNIQUEIDENTIFIER,
  @UserId       INT,
  @CanDeleteAny BIT          = 0,
  @ErrorCode    NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @CreatedBy      INT;
  DECLARE @IsWelcomePost  BIT;

  SELECT @CreatedBy = created_by, @IsWelcomePost = is_welcome_post
  FROM   dbo.feed_posts
  WHERE  id = @PostId AND is_deleted = 0;

  IF @CreatedBy IS NULL
  BEGIN
    SET @ErrorCode = 'POST_NOT_FOUND';
    RETURN;
  END

  IF @IsWelcomePost = 1 AND @CanDeleteAny = 0
  BEGIN
    SET @ErrorCode = 'FORBIDDEN';
    RETURN;
  END

  IF @CanDeleteAny = 0 AND @CreatedBy <> @UserId
  BEGIN
    SET @ErrorCode = 'FORBIDDEN';
    RETURN;
  END

  UPDATE dbo.feed_posts
  SET is_deleted = 1,
      deleted_at = SYSUTCDATETIME(),
      is_pinned  = 0
  WHERE id = @PostId;
END;
GO

-- ============================================================
-- sp_EditPost
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_EditPost
  @PostId    UNIQUEIDENTIFIER,
  @UserId    INT,
  @BodyHtml  NVARCHAR(MAX),
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @CreatedBy     INT;
  DECLARE @IsWelcomePost BIT;

  SELECT @CreatedBy = created_by, @IsWelcomePost = is_welcome_post
  FROM   dbo.feed_posts
  WHERE  id = @PostId AND is_deleted = 0;

  IF @CreatedBy IS NULL
  BEGIN
    SET @ErrorCode = 'POST_NOT_FOUND';
    RETURN;
  END

  IF @IsWelcomePost = 1
  BEGIN
    SET @ErrorCode = 'WELCOME_POST_NOT_EDITABLE';
    RETURN;
  END

  IF @CreatedBy <> @UserId
  BEGIN
    SET @ErrorCode = 'FORBIDDEN';
    RETURN;
  END

  UPDATE dbo.feed_posts
  SET body_html  = @BodyHtml,
      updated_at = SYSUTCDATETIME()
  WHERE id = @PostId;
END;
GO

-- ============================================================
-- sp_PinPost
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_PinPost
  @PostId    UNIQUEIDENTIFIER,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.feed_posts WHERE id = @PostId AND is_deleted = 0)
  BEGIN
    SET @ErrorCode = 'POST_NOT_FOUND';
    RETURN;
  END

  UPDATE dbo.feed_posts SET is_pinned = 0 WHERE is_pinned = 1;
  UPDATE dbo.feed_posts SET is_pinned = 1 WHERE id = @PostId AND is_deleted = 0;
END;
GO

-- ============================================================
-- sp_GetUserSportAssociations
-- Returns the sports a user is active in (via users_sports).
-- Used by the new-post page to restrict alumni sport selection.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserSportAssociations
  @UserId INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT DISTINCT
    s.id   AS sportId,
    s.name AS sportName,
    s.abbr AS sportAbbr
  FROM dbo.users_sports us
  JOIN dbo.sports s ON s.id = us.sport_id
  WHERE us.user_id   = @UserId
    AND us.is_active = 1
    AND s.is_active  = 1
  ORDER BY s.name;
END;
GO

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
