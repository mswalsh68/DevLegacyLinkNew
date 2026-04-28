SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- APP DB — ALL STORED PROCEDURES
-- Run on: each tenant AppDB after 005_players_alumni_tables.sql
--
-- Schema (migration 004_repair2 + 005):
--   dbo.users   — thin sync: user_id INT PK (mirrors Global)
--   dbo.players — active roster: player_id INT PK = user_id
--   dbo.alumni  — graduates/imports: alumni_id INT IDENTITY PK
--
-- ID conventions:
--   @PlayerId INT   = dbo.players.player_id
--   @AlumniId INT   = dbo.alumni.alumni_id
--   @UserId   INT   = dbo.users.user_id  (logged-in staff/viewer)
--   @RequestingUserId INT = NULL = Global user_id of the calling user (authorization)
--   @CreatedBy / @UpdatedBy INT = Global user_id of staff member (stored in campaign tables)
-- ============================================================

-- ============================================================
-- sp_UpsertUser
-- Syncs a LegacyLinkGlobal user into local dbo.users.
-- Called at login and before create-player flow.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertUser
  @UserId       INT,
  @Email        NVARCHAR(255),
  @FirstName    NVARCHAR(100),
  @LastName     NVARCHAR(100),
  @PlatformRole NVARCHAR(50)  = 'player',
  @ProgramRoleId INT          = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId)
  BEGIN
    UPDATE dbo.users SET
      email           = @Email,
      first_name      = @FirstName,
      last_name       = @LastName,
      platform_role   = ISNULL(@PlatformRole,  platform_role),
      program_role_id = COALESCE(@ProgramRoleId, program_role_id),
      synced_at       = SYSUTCDATETIME()
    WHERE user_id = @UserId;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.users (user_id, email, first_name, last_name, platform_role, program_role_id)
    VALUES (@UserId, @Email, @FirstName, @LastName, ISNULL(@PlatformRole, 'player'), @ProgramRoleId);
  END
END;
GO

-- ============================================================
-- vwPlayers
-- All active players. Joins dbo.players + dbo.users for name/email.
-- Returns player_id AS id for callers that use the generic 'id' alias.
-- ============================================================
CREATE OR ALTER VIEW dbo.vwPlayers AS
SELECT
  p.player_id,
  p.player_id                    AS id,
  u.user_id,
  p.sport_id,
  p.jersey_number,
  u.first_name,
  u.last_name,
  p.position,
  p.academic_year,
  p.recruiting_class,
  p.height_inches,
  p.weight_lbs,
  p.home_town,
  p.home_state,
  p.high_school,
  p.major,
  p.phone,
  p.personal_email,
  p.instagram,
  p.twitter,
  p.snapchat,
  p.emergency_contact_name,
  p.emergency_contact_phone,
  p.parent1_name,
  p.parent1_phone,
  p.parent1_email,
  p.parent2_name,
  p.parent2_phone,
  p.parent2_email,
  p.notes,
  p.is_active,
  p.created_at,
  p.updated_at
FROM dbo.players p
JOIN dbo.users   u ON u.user_id = p.player_id
WHERE p.is_active = 1;
GO

-- ============================================================
-- vwAlumni
-- All alumni. Returns alumni_id AS id.
-- ============================================================
CREATE OR ALTER VIEW dbo.vwAlumni AS
SELECT
  a.alumni_id,
  a.alumni_id            AS id,
  a.user_id,
  a.source_player_id,
  a.sport_id,
  a.first_name,
  a.last_name,
  a.email,
  a.position,
  a.recruiting_class,
  a.graduation_year,
  a.graduation_semester,
  a.graduated_at,
  a.phone,
  a.personal_email,
  a.linkedin_url,
  a.twitter_url,
  a.current_employer,
  a.current_job_title,
  a.current_city,
  a.current_state,
  a.is_donor,
  a.last_donation_date,
  a.total_donations,
  a.engagement_score,
  a.communication_consent,
  a.years_on_roster,
  a.notes,
  a.created_at,
  a.updated_at
FROM dbo.alumni a;
GO

-- ============================================================
-- sp_GetPlayers
-- Returns active players with pagination and filtering.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetPlayers
  @Search          NVARCHAR(255)    = NULL,
  @Position        NVARCHAR(10)     = NULL,
  @AcademicYear    NVARCHAR(20)     = NULL,
  @RecruitingClass SMALLINT         = NULL,
  @SportId         UNIQUEIDENTIFIER = NULL,
  @Page            INT              = 1,
  @PageSize        INT              = 50,
  @TotalCount      INT              OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Offset     INT           = (@Page - 1) * @PageSize;
  DECLARE @SearchWild NVARCHAR(257) = '%' + ISNULL(@Search, '') + '%';
  DECLARE @ExactNum   NVARCHAR(10)  = ISNULL(@Search, '');

  SELECT @TotalCount = COUNT(*)
  FROM dbo.vwPlayers p
  WHERE (@Position        IS NULL OR p.position         = @Position)
    AND (@AcademicYear    IS NULL OR p.academic_year    = @AcademicYear)
    AND (@RecruitingClass IS NULL OR p.recruiting_class = @RecruitingClass)
    AND (@SportId         IS NULL OR p.sport_id         = @SportId)
    AND (@Search IS NULL
         OR p.first_name LIKE @SearchWild
         OR p.last_name  LIKE @SearchWild
         OR CAST(p.jersey_number AS NVARCHAR) = @ExactNum);

  SELECT
    p.player_id             AS playerId,
    p.id,
    p.sport_id              AS sportId,
    p.jersey_number         AS jerseyNumber,
    p.first_name            AS firstName,
    p.last_name             AS lastName,
    p.position,
    p.academic_year         AS academicYear,
    p.height_inches         AS heightInches,
    p.weight_lbs            AS weightLbs,
    p.home_town             AS homeTown,
    p.home_state            AS homeState,
    p.high_school           AS highSchool,
    p.recruiting_class      AS recruitingClass,
    p.major,
    p.phone,
    p.personal_email        AS email,
    p.instagram,
    p.twitter,
    p.snapchat,
    p.emergency_contact_name  AS emergencyContactName,
    p.emergency_contact_phone AS emergencyContactPhone,
    p.notes,
    p.created_at            AS createdAt,
    p.updated_at            AS updatedAt
  FROM dbo.vwPlayers p
  WHERE (@Position        IS NULL OR p.position         = @Position)
    AND (@AcademicYear    IS NULL OR p.academic_year    = @AcademicYear)
    AND (@RecruitingClass IS NULL OR p.recruiting_class = @RecruitingClass)
    AND (@SportId         IS NULL OR p.sport_id         = @SportId)
    AND (@Search IS NULL
         OR p.first_name LIKE @SearchWild
         OR p.last_name  LIKE @SearchWild
         OR CAST(p.jersey_number AS NVARCHAR) = @ExactNum)
  ORDER BY p.last_name, p.first_name
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- ============================================================
-- sp_GetPlayerById
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetPlayerById
  @PlayerId  INT,
  @ErrorCode NVARCHAR(50) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.vwPlayers WHERE player_id = @PlayerId)
  BEGIN
    SET @ErrorCode = 'PLAYER_NOT_FOUND';
    RETURN;
  END

  SELECT
    p.player_id             AS playerId,
    p.id,
    p.sport_id              AS sportId,
    p.jersey_number         AS jerseyNumber,
    p.first_name            AS firstName,
    p.last_name             AS lastName,
    p.position,
    p.academic_year         AS academicYear,
    p.height_inches         AS heightInches,
    p.weight_lbs            AS weightLbs,
    p.home_town             AS homeTown,
    p.home_state            AS homeState,
    p.high_school           AS highSchool,
    p.recruiting_class      AS recruitingClass,
    p.major,
    p.phone,
    p.personal_email        AS email,
    p.instagram,
    p.twitter,
    p.snapchat,
    p.emergency_contact_name  AS emergencyContactName,
    p.emergency_contact_phone AS emergencyContactPhone,
    p.parent1_name            AS parent1Name,
    p.parent1_phone           AS parent1Phone,
    p.parent1_email           AS parent1Email,
    p.parent2_name            AS parent2Name,
    p.parent2_phone           AS parent2Phone,
    p.parent2_email           AS parent2Email,
    p.notes,
    p.created_at            AS createdAt,
    p.updated_at            AS updatedAt
  FROM dbo.vwPlayers p
  WHERE p.player_id = @PlayerId;

  SELECT
    ps.season_year  AS seasonYear,
    ps.games_played AS gamesPlayed,
    ps.stats_json   AS statsJson,
    ps.updated_at   AS updatedAt
  FROM dbo.player_stats ps
  WHERE ps.player_id = @PlayerId
  ORDER BY ps.season_year DESC;
END;
GO

-- ============================================================
-- sp_CreatePlayer
-- Upserts a player into dbo.users + dbo.players.
-- @UserId = the INT user_id resolved by the caller via sp_GetOrCreateUser on Global DB.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreatePlayer
  @UserId                INT,
  @Email                 NVARCHAR(255),
  @FirstName             NVARCHAR(100),
  @LastName              NVARCHAR(100),
  @Position              NVARCHAR(10),
  @AcademicYear          NVARCHAR(20),
  @RecruitingClass       SMALLINT,
  @SportId               UNIQUEIDENTIFIER = NULL,
  @JerseyNumber          TINYINT          = NULL,
  @HeightInches          TINYINT          = NULL,
  @WeightLbs             SMALLINT         = NULL,
  @HomeTown              NVARCHAR(100)    = NULL,
  @HomeState             NVARCHAR(50)     = NULL,
  @HighSchool            NVARCHAR(150)    = NULL,
  @Major                 NVARCHAR(100)    = NULL,
  @Phone                 NVARCHAR(20)     = NULL,
  @Instagram             NVARCHAR(100)    = NULL,
  @Twitter               NVARCHAR(100)    = NULL,
  @Snapchat              NVARCHAR(100)    = NULL,
  @EmergencyContactName  NVARCHAR(150)    = NULL,
  @EmergencyContactPhone NVARCHAR(20)     = NULL,
  @Parent1Name           NVARCHAR(150)    = NULL,
  @Parent1Phone          NVARCHAR(20)     = NULL,
  @Parent1Email          NVARCHAR(255)    = NULL,
  @Parent2Name           NVARCHAR(150)    = NULL,
  @Parent2Phone          NVARCHAR(20)     = NULL,
  @Parent2Email          NVARCHAR(255)    = NULL,
  @Notes                 NVARCHAR(MAX)    = NULL,
  @CreatedBy             INT,
  @ErrorCode             NVARCHAR(50)     OUTPUT,
  @RequestingUserId      INT              = NULL,
  @RequestingUserRole    NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF @RecruitingClass < 2000 OR @RecruitingClass > 2100
  BEGIN
    SET @ErrorCode = 'INVALID_RECRUITING_CLASS';
    RETURN;
  END

  IF @JerseyNumber IS NOT NULL AND EXISTS (
    SELECT 1 FROM dbo.players
    WHERE jersey_number = @JerseyNumber AND is_active = 1 AND player_id <> @UserId
      AND (@SportId IS NULL OR sport_id = @SportId)
  )
  BEGIN
    SET @ErrorCode = 'JERSEY_NUMBER_IN_USE';
    RETURN;
  END

  -- Sync into thin dbo.users
  EXEC dbo.sp_UpsertUser
    @UserId       = @UserId,
    @Email        = @Email,
    @FirstName    = @FirstName,
    @LastName     = @LastName,
    @PlatformRole = 'player';

  -- Upsert into dbo.players
  IF EXISTS (SELECT 1 FROM dbo.players WHERE player_id = @UserId)
  BEGIN
    UPDATE dbo.players SET
      sport_id                = COALESCE(@SportId,               sport_id),
      jersey_number           = COALESCE(@JerseyNumber,          jersey_number),
      position                = @Position,
      academic_year           = @AcademicYear,
      recruiting_class        = @RecruitingClass,
      height_inches           = COALESCE(@HeightInches,          height_inches),
      weight_lbs              = COALESCE(@WeightLbs,             weight_lbs),
      home_town               = COALESCE(@HomeTown,              home_town),
      home_state              = COALESCE(@HomeState,             home_state),
      high_school             = COALESCE(@HighSchool,            high_school),
      major                   = COALESCE(@Major,                 major),
      phone                   = COALESCE(@Phone,                 phone),
      personal_email          = COALESCE(@Email,                 personal_email),
      instagram               = COALESCE(@Instagram,             instagram),
      twitter                 = COALESCE(@Twitter,               twitter),
      snapchat                = COALESCE(@Snapchat,              snapchat),
      emergency_contact_name  = COALESCE(@EmergencyContactName,  emergency_contact_name),
      emergency_contact_phone = COALESCE(@EmergencyContactPhone, emergency_contact_phone),
      parent1_name            = COALESCE(@Parent1Name,           parent1_name),
      parent1_phone           = COALESCE(@Parent1Phone,          parent1_phone),
      parent1_email           = COALESCE(@Parent1Email,          parent1_email),
      parent2_name            = COALESCE(@Parent2Name,           parent2_name),
      parent2_phone           = COALESCE(@Parent2Phone,          parent2_phone),
      parent2_email           = COALESCE(@Parent2Email,          parent2_email),
      notes                   = COALESCE(@Notes,                 notes),
      is_active               = 1,
      updated_at              = SYSUTCDATETIME()
    WHERE player_id = @UserId;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.players (
      player_id, sport_id, jersey_number, position, academic_year, recruiting_class,
      height_inches, weight_lbs, home_town, home_state, high_school,
      major, phone, personal_email, instagram, twitter, snapchat,
      emergency_contact_name, emergency_contact_phone,
      parent1_name, parent1_phone, parent1_email,
      parent2_name, parent2_phone, parent2_email, notes
    )
    VALUES (
      @UserId, @SportId, @JerseyNumber, @Position, @AcademicYear, @RecruitingClass,
      @HeightInches, @WeightLbs, @HomeTown, @HomeState, @HighSchool,
      @Major, @Phone, @Email, @Instagram, @Twitter, @Snapchat,
      @EmergencyContactName, @EmergencyContactPhone,
      @Parent1Name, @Parent1Phone, @Parent1Email,
      @Parent2Name, @Parent2Phone, @Parent2Email, @Notes
    );
  END

  IF @SportId IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @UserId AND sport_id = @SportId)
  BEGIN
    INSERT INTO dbo.users_sports (user_id, sport_id, username)
    VALUES (@UserId, @SportId, @FirstName + ' ' + @LastName);
  END
END;
GO

-- ============================================================
-- sp_UpdatePlayer
-- Updates player profile. NULL = no change.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdatePlayer
  @PlayerId              INT,
  @JerseyNumber          TINYINT          = NULL,
  @Position              NVARCHAR(10)     = NULL,
  @AcademicYear          NVARCHAR(20)     = NULL,
  @HeightInches          TINYINT          = NULL,
  @WeightLbs             SMALLINT         = NULL,
  @Major                 NVARCHAR(100)    = NULL,
  @Phone                 NVARCHAR(20)     = NULL,
  @Email                 NVARCHAR(255)    = NULL,
  @Instagram             NVARCHAR(100)    = NULL,
  @Twitter               NVARCHAR(100)    = NULL,
  @Snapchat              NVARCHAR(100)    = NULL,
  @EmergencyContactName  NVARCHAR(150)    = NULL,
  @EmergencyContactPhone NVARCHAR(20)     = NULL,
  @Parent1Name           NVARCHAR(150)    = NULL,
  @Parent1Phone          NVARCHAR(20)     = NULL,
  @Parent1Email          NVARCHAR(255)    = NULL,
  @Parent2Name           NVARCHAR(150)    = NULL,
  @Parent2Phone          NVARCHAR(20)     = NULL,
  @Parent2Email          NVARCHAR(255)    = NULL,
  @Notes                 NVARCHAR(MAX)    = NULL,
  @UpdatedBy             INT,
  @ErrorCode             NVARCHAR(50)     OUTPUT,
  @RequestingUserId      INT              = NULL,
  @RequestingUserRole    NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.players WHERE player_id = @PlayerId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'PLAYER_NOT_FOUND';
    RETURN;
  END

  IF @JerseyNumber IS NOT NULL AND EXISTS (
    SELECT 1 FROM dbo.players
    WHERE jersey_number = @JerseyNumber AND is_active = 1 AND player_id <> @PlayerId
  )
  BEGIN
    SET @ErrorCode = 'JERSEY_NUMBER_IN_USE';
    RETURN;
  END

  UPDATE dbo.players SET
    jersey_number           = COALESCE(@JerseyNumber,          jersey_number),
    position                = COALESCE(@Position,              position),
    academic_year           = COALESCE(@AcademicYear,          academic_year),
    height_inches           = COALESCE(@HeightInches,          height_inches),
    weight_lbs              = COALESCE(@WeightLbs,             weight_lbs),
    major                   = COALESCE(@Major,                 major),
    phone                   = COALESCE(@Phone,                 phone),
    personal_email          = COALESCE(@Email,                 personal_email),
    instagram               = COALESCE(@Instagram,             instagram),
    twitter                 = COALESCE(@Twitter,               twitter),
    snapchat                = COALESCE(@Snapchat,              snapchat),
    emergency_contact_name  = COALESCE(@EmergencyContactName,  emergency_contact_name),
    emergency_contact_phone = COALESCE(@EmergencyContactPhone, emergency_contact_phone),
    parent1_name            = COALESCE(@Parent1Name,           parent1_name),
    parent1_phone           = COALESCE(@Parent1Phone,          parent1_phone),
    parent1_email           = COALESCE(@Parent1Email,          parent1_email),
    parent2_name            = COALESCE(@Parent2Name,           parent2_name),
    parent2_phone           = COALESCE(@Parent2Phone,          parent2_phone),
    parent2_email           = COALESCE(@Parent2Email,          parent2_email),
    notes                   = COALESCE(@Notes,                 notes),
    updated_at              = SYSUTCDATETIME()
  WHERE player_id = @PlayerId;
END;
GO

-- ============================================================
-- sp_GraduatePlayer
-- Deactivates players and creates alumni rows.
-- @PlayerIds = JSON array of INT player_ids.
-- Returns @SucceededJson with {playerId, alumniId} pairs so the
-- caller can invoke sp_TransferPlayerToAlumni on Global DB.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GraduatePlayer
  @PlayerIds      NVARCHAR(MAX),   -- JSON array of INT player_ids
  @GraduationYear SMALLINT,
  @Semester       NVARCHAR(10),    -- 'spring' | 'fall' | 'summer'
  @TriggeredBy    INT,
  @TransactionId  UNIQUEIDENTIFIER OUTPUT,
  @SuccessCount   INT              OUTPUT,
  @FailureJson    NVARCHAR(MAX)    OUTPUT,
  @SucceededJson  NVARCHAR(MAX)    OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  SET @TransactionId = NEWID();
  SET @SuccessCount  = 0;
  SET @FailureJson   = '[]';
  SET @SucceededJson = '[]';

  DECLARE @failures   TABLE (player_id INT, reason NVARCHAR(500));
  DECLARE @succeeded  TABLE (player_id INT, alumni_id INT);
  DECLARE @idList     TABLE (player_id INT);
  DECLARE @currentId  INT;

  IF @GraduationYear < 2000 OR @GraduationYear > 2100
  BEGIN
    SET @FailureJson = N'[{"error":"Invalid graduation year"}]';
    RETURN;
  END

  IF @Semester NOT IN ('spring','fall','summer')
  BEGIN
    SET @FailureJson = N'[{"error":"Invalid semester"}]';
    RETURN;
  END

  INSERT INTO @idList
  SELECT TRY_CAST([value] AS INT)
  FROM OPENJSON(@PlayerIds)
  WHERE TRY_CAST([value] AS INT) IS NOT NULL;

  DECLARE cur CURSOR FOR SELECT player_id FROM @idList;
  OPEN cur;
  FETCH NEXT FROM cur INTO @currentId;

  WHILE @@FETCH_STATUS = 0
  BEGIN
    BEGIN TRY
      BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.players WHERE player_id = @currentId AND is_active = 1)
        BEGIN
          ROLLBACK TRANSACTION;
          INSERT INTO @failures VALUES (@currentId,
            CASE WHEN EXISTS (SELECT 1 FROM dbo.alumni WHERE source_player_id = @currentId)
                 THEN 'Already graduated'
                 ELSE 'Player not found' END);
          FETCH NEXT FROM cur INTO @currentId;
          CONTINUE;
        END

        -- Deactivate player
        UPDATE dbo.players SET
          is_active  = 0,
          updated_at = SYSUTCDATETIME()
        WHERE player_id = @currentId;

        -- Create alumni row, copying identity from dbo.players + dbo.users
        DECLARE @newAlumniId INT;
        DECLARE @fn NVARCHAR(100), @ln NVARCHAR(100), @em NVARCHAR(255);
        DECLARE @sId UNIQUEIDENTIFIER, @pos NVARCHAR(10), @rc SMALLINT;

        SELECT
          @fn  = u.first_name,
          @ln  = u.last_name,
          @em  = u.email,
          @sId = p.sport_id,
          @pos = p.position,
          @rc  = p.recruiting_class
        FROM dbo.players p
        JOIN dbo.users   u ON u.user_id = p.player_id
        WHERE p.player_id = @currentId;

        INSERT INTO dbo.alumni (
          user_id, source_player_id, first_name, last_name, email,
          sport_id, position, recruiting_class,
          graduation_year, graduation_semester, graduated_at
        )
        VALUES (
          @currentId, @currentId, @fn, @ln, @em,
          @sId, @pos, @rc,
          @GraduationYear, @Semester, SYSUTCDATETIME()
        );

        SET @newAlumniId = SCOPE_IDENTITY();

        -- Audit log
        INSERT INTO dbo.graduation_log
          (transaction_id, player_id, alumni_id, graduation_year, graduation_semester,
           triggered_by_user_id, status)
        VALUES
          (@TransactionId, @currentId, @newAlumniId, @GraduationYear, @Semester,
           @TriggeredBy, 'success');

      COMMIT TRANSACTION;
      SET @SuccessCount += 1;
      INSERT INTO @succeeded VALUES (@currentId, @newAlumniId);

    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;

      DECLARE @errMsg NVARCHAR(500) = ERROR_MESSAGE();
      INSERT INTO @failures VALUES (@currentId, @errMsg);

      INSERT INTO dbo.graduation_log
        (transaction_id, player_id, alumni_id, graduation_year, graduation_semester,
         triggered_by_user_id, status, notes)
      VALUES
        (@TransactionId, @currentId, NULL, @GraduationYear, @Semester,
         @TriggeredBy, 'failed', @errMsg);
    END CATCH;

    FETCH NEXT FROM cur INTO @currentId;
  END

  CLOSE cur;
  DEALLOCATE cur;

  SELECT @FailureJson = ISNULL(
    (SELECT player_id AS playerId, reason FROM @failures FOR JSON PATH), '[]');
  SELECT @SucceededJson = ISNULL(
    (SELECT player_id AS playerId, alumni_id AS alumniId FROM @succeeded FOR JSON PATH), '[]');
END;
GO

-- ============================================================
-- sp_RemovePlayer
-- Deactivates a player (is_active = 0).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_RemovePlayer
  @PlayerId  INT,
  @RemovedBy INT,
  @ErrorCode NVARCHAR(50) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.players WHERE player_id = @PlayerId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'PLAYER_NOT_FOUND';
    RETURN;
  END

  UPDATE dbo.players SET
    is_active  = 0,
    updated_at = SYSUTCDATETIME()
  WHERE player_id = @PlayerId;
END;
GO

-- ============================================================
-- sp_UpsertPlayerStats
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertPlayerStats
  @PlayerId    INT,
  @SeasonYear  SMALLINT,
  @GamesPlayed TINYINT       = NULL,
  @StatsJson   NVARCHAR(MAX) = NULL,
  @ErrorCode   NVARCHAR(50)  OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.players WHERE player_id = @PlayerId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'PLAYER_NOT_FOUND';
    RETURN;
  END

  IF EXISTS (SELECT 1 FROM dbo.player_stats WHERE player_id = @PlayerId AND season_year = @SeasonYear)
  BEGIN
    UPDATE dbo.player_stats SET
      games_played = COALESCE(@GamesPlayed, games_played),
      stats_json   = COALESCE(@StatsJson,   stats_json),
      updated_at   = SYSUTCDATETIME()
    WHERE player_id = @PlayerId AND season_year = @SeasonYear;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.player_stats (player_id, season_year, games_played, stats_json)
    VALUES (@PlayerId, @SeasonYear, @GamesPlayed, @StatsJson);
  END
END;
GO

-- ============================================================
-- sp_GetAlumni
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetAlumni
  @Search    NVARCHAR(255)    = NULL,
  @IsDonor   BIT              = NULL,
  @GradYear  SMALLINT         = NULL,
  @Position  NVARCHAR(10)     = NULL,
  @SportId   UNIQUEIDENTIFIER = NULL,
  @Page      INT              = 1,
  @PageSize  INT              = 50,
  @TotalCount INT             OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Offset     INT           = (@Page - 1) * @PageSize;
  DECLARE @SearchWild NVARCHAR(257) = '%' + ISNULL(@Search, '') + '%';

  SELECT @TotalCount = COUNT(*)
  FROM dbo.vwAlumni a
  WHERE (@IsDonor  IS NULL OR a.is_donor        = @IsDonor)
    AND (@GradYear IS NULL OR a.graduation_year = @GradYear)
    AND (@Position IS NULL OR a.position        = @Position)
    AND (@SportId  IS NULL OR a.sport_id        = @SportId)
    AND (@Search IS NULL
         OR a.first_name       LIKE @SearchWild
         OR a.last_name        LIKE @SearchWild
         OR a.current_employer LIKE @SearchWild
         OR a.current_city     LIKE @SearchWild
         OR a.personal_email   LIKE @SearchWild);

  SELECT
    a.alumni_id             AS alumniId,
    a.id,
    a.sport_id              AS sportId,
    a.first_name            AS firstName,
    a.last_name             AS lastName,
    a.graduation_year       AS graduationYear,
    a.graduation_semester   AS graduationSemester,
    a.position,
    a.recruiting_class      AS recruitingClass,
    a.personal_email        AS personalEmail,
    a.phone,
    a.linkedin_url          AS linkedInUrl,
    a.twitter_url           AS twitterUrl,
    a.current_employer      AS currentEmployer,
    a.current_job_title     AS currentJobTitle,
    a.current_city          AS currentCity,
    a.current_state         AS currentState,
    a.is_donor              AS isDonor,
    a.last_donation_date    AS lastDonationDate,
    a.total_donations       AS totalDonations,
    a.engagement_score      AS engagementScore,
    a.notes,
    a.created_at            AS createdAt,
    a.updated_at            AS updatedAt
  FROM dbo.vwAlumni a
  WHERE (@IsDonor  IS NULL OR a.is_donor        = @IsDonor)
    AND (@GradYear IS NULL OR a.graduation_year = @GradYear)
    AND (@Position IS NULL OR a.position        = @Position)
    AND (@SportId  IS NULL OR a.sport_id        = @SportId)
    AND (@Search IS NULL
         OR a.first_name       LIKE @SearchWild
         OR a.last_name        LIKE @SearchWild
         OR a.current_employer LIKE @SearchWild
         OR a.current_city     LIKE @SearchWild
         OR a.personal_email   LIKE @SearchWild)
  ORDER BY a.last_name, a.first_name
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- ============================================================
-- sp_GetAlumniById
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetAlumniById
  @AlumniId  INT,
  @ErrorCode NVARCHAR(50) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.alumni WHERE alumni_id = @AlumniId)
  BEGIN
    SET @ErrorCode = 'ALUMNI_NOT_FOUND';
    RETURN;
  END

  SELECT
    a.alumni_id             AS alumniId,
    a.id,
    a.sport_id              AS sportId,
    a.first_name            AS firstName,
    a.last_name             AS lastName,
    a.graduation_year       AS graduationYear,
    a.graduation_semester   AS graduationSemester,
    a.position,
    a.recruiting_class      AS recruitingClass,
    a.personal_email        AS personalEmail,
    a.phone,
    a.linkedin_url          AS linkedInUrl,
    a.twitter_url           AS twitterUrl,
    a.current_employer      AS currentEmployer,
    a.current_job_title     AS currentJobTitle,
    a.current_city          AS currentCity,
    a.current_state         AS currentState,
    a.is_donor              AS isDonor,
    a.last_donation_date    AS lastDonationDate,
    a.total_donations       AS totalDonations,
    a.engagement_score      AS engagementScore,
    a.communication_consent AS communicationConsent,
    a.years_on_roster       AS yearsOnRoster,
    a.notes,
    a.created_at            AS createdAt,
    a.updated_at            AS updatedAt
  FROM dbo.vwAlumni a
  WHERE a.alumni_id = @AlumniId;

  SELECT
    il.id,
    il.channel,
    il.summary,
    il.outcome,
    il.follow_up_at AS followUpAt,
    il.logged_at    AS loggedAt,
    il.logged_by_user_id AS loggedBy
  FROM dbo.interaction_log il
  WHERE il.alumni_id = @AlumniId
  ORDER BY il.logged_at DESC;
END;
GO

-- ============================================================
-- sp_UpdateAlumni
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateAlumni
  @AlumniId        INT,
  @PersonalEmail   NVARCHAR(255)  = NULL,
  @Phone           NVARCHAR(20)   = NULL,
  @LinkedInUrl     NVARCHAR(500)  = NULL,
  @TwitterUrl      NVARCHAR(100)  = NULL,
  @CurrentEmployer NVARCHAR(200)  = NULL,
  @CurrentJobTitle NVARCHAR(150)  = NULL,
  @CurrentCity     NVARCHAR(100)  = NULL,
  @CurrentState    NVARCHAR(50)   = NULL,
  @IsDonor         BIT            = NULL,
  @LastDonationDate DATE          = NULL,
  @TotalDonations  DECIMAL(10,2)  = NULL,
  @Notes           NVARCHAR(MAX)  = NULL,
  @UpdatedBy       INT,
  @ErrorCode       NVARCHAR(50)   OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.alumni WHERE alumni_id = @AlumniId)
  BEGIN
    SET @ErrorCode = 'ALUMNI_NOT_FOUND';
    RETURN;
  END

  UPDATE dbo.alumni SET
    personal_email    = COALESCE(@PersonalEmail,   personal_email),
    phone             = COALESCE(@Phone,            phone),
    linkedin_url      = COALESCE(@LinkedInUrl,      linkedin_url),
    twitter_url       = COALESCE(@TwitterUrl,       twitter_url),
    current_employer  = COALESCE(@CurrentEmployer, current_employer),
    current_job_title = COALESCE(@CurrentJobTitle, current_job_title),
    current_city      = COALESCE(@CurrentCity,     current_city),
    current_state     = COALESCE(@CurrentState,    current_state),
    is_donor          = COALESCE(@IsDonor,         is_donor),
    last_donation_date= COALESCE(@LastDonationDate,last_donation_date),
    total_donations   = COALESCE(@TotalDonations,  total_donations),
    notes             = COALESCE(@Notes,           notes),
    updated_at        = SYSUTCDATETIME()
  WHERE alumni_id = @AlumniId;

  -- Recalculate engagement score
  UPDATE dbo.alumni SET
    engagement_score = CAST(
      30
      + CASE WHEN personal_email   IS NOT NULL THEN 10 ELSE 0 END
      + CASE WHEN phone            IS NOT NULL THEN 8  ELSE 0 END
      + CASE WHEN linkedin_url     IS NOT NULL THEN 7  ELSE 0 END
      + CASE WHEN current_employer IS NOT NULL THEN 10 ELSE 0 END
      + CASE WHEN current_job_title IS NOT NULL THEN 10 ELSE 0 END
      + CASE WHEN is_donor = 1 THEN 25 ELSE 0 END
    AS TINYINT)
  WHERE alumni_id = @AlumniId;
END;
GO

-- ============================================================
-- sp_LogInteraction
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_LogInteraction
  @AlumniId   INT,
  @LoggedBy   INT,            -- dbo.users.user_id of the staff member
  @Channel    NVARCHAR(30),
  @Summary    NVARCHAR(MAX),
  @Outcome    NVARCHAR(50)  = NULL,
  @FollowUpAt DATETIME2     = NULL,
  @ErrorCode  NVARCHAR(50)  OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.alumni WHERE alumni_id = @AlumniId)
  BEGIN
    SET @ErrorCode = 'ALUMNI_NOT_FOUND';
    RETURN;
  END

  IF LEN(LTRIM(RTRIM(@Summary))) = 0
  BEGIN
    SET @ErrorCode = 'SUMMARY_REQUIRED';
    RETURN;
  END

  INSERT INTO dbo.interaction_log (alumni_id, logged_by_user_id, channel, summary, outcome, follow_up_at)
  VALUES (@AlumniId, @LoggedBy, @Channel, @Summary, @Outcome, @FollowUpAt);

  UPDATE dbo.alumni SET
    engagement_score = CAST(CASE
        WHEN engagement_score + 2 > 100 THEN 100
        ELSE engagement_score + 2
      END AS TINYINT),
    updated_at = SYSUTCDATETIME()
  WHERE alumni_id = @AlumniId;
END;
GO

-- ============================================================
-- sp_GetAlumniStats
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetAlumniStats
  @SportId            UNIQUEIDENTIFIER = NULL,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    COUNT(*)                                                      AS totalAlumni,
    SUM(CASE WHEN is_donor = 1 THEN 1 ELSE 0 END)                AS donors,
    ISNULL(SUM(total_donations), 0)                              AS totalDonations,
    ISNULL(CAST(AVG(CAST(engagement_score AS FLOAT)) AS DECIMAL(5,1)), 0) AS avgEngagement,
    MIN(graduation_year)                                          AS earliestClass,
    MAX(graduation_year)                                          AS latestClass,
    (
      SELECT graduation_year AS gradYear, COUNT(*) AS cnt
      FROM dbo.vwAlumni
      WHERE (@SportId IS NULL OR sport_id = @SportId)
      GROUP BY graduation_year
      ORDER BY graduation_year DESC
      FOR JSON PATH
    ) AS classCounts
  FROM dbo.vwAlumni
  WHERE (@SportId IS NULL OR sport_id = @SportId);
END;
GO

-- ============================================================
-- sp_CreateAlumni
-- Direct alumni creation (no player history).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreateAlumni
  @UserId             INT              = NULL,  -- global INT user_id (NULL for historical imports)
  @FirstName          NVARCHAR(100),
  @LastName           NVARCHAR(100),
  @GraduationYear     SMALLINT,
  @GraduationSemester NVARCHAR(10)     = 'spring',
  @Position           NVARCHAR(10)     = NULL,
  @RecruitingClass    SMALLINT         = NULL,
  @SportId            UNIQUEIDENTIFIER = NULL,
  @Phone              NVARCHAR(20)     = NULL,
  @PersonalEmail      NVARCHAR(255)    = NULL,
  @CurrentEmployer    NVARCHAR(200)    = NULL,
  @CurrentJobTitle    NVARCHAR(150)    = NULL,
  @CurrentCity        NVARCHAR(100)    = NULL,
  @CurrentState       NVARCHAR(50)     = NULL,
  @Notes              NVARCHAR(MAX)    = NULL,
  @NewAlumniId        INT              OUTPUT,
  @ErrorCode          NVARCHAR(50)     OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode   = NULL;
  SET @NewAlumniId = NULL;

  IF @GraduationYear < 1950 OR @GraduationYear > 2100
  BEGIN
    SET @ErrorCode = 'INVALID_GRADUATION_YEAR';
    RETURN;
  END

  IF @GraduationSemester NOT IN ('spring','fall','summer')
  BEGIN
    SET @ErrorCode = 'INVALID_SEMESTER';
    RETURN;
  END

  -- Idempotent: already an alumni with this user_id
  IF @UserId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.alumni WHERE user_id = @UserId)
  BEGIN
    SELECT @NewAlumniId = alumni_id FROM dbo.alumni WHERE user_id = @UserId;
    SET @ErrorCode = 'ALUMNI_ALREADY_EXISTS';
    RETURN;
  END

  INSERT INTO dbo.alumni (
    user_id, first_name, last_name,
    graduation_year, graduation_semester,
    position, recruiting_class, sport_id,
    phone, personal_email,
    current_employer, current_job_title, current_city, current_state,
    notes, graduated_at
  )
  VALUES (
    @UserId, @FirstName, @LastName,
    @GraduationYear, @GraduationSemester,
    @Position, @RecruitingClass, @SportId,
    @Phone, @PersonalEmail,
    @CurrentEmployer, @CurrentJobTitle, @CurrentCity, @CurrentState,
    @Notes, SYSUTCDATETIME()
  );

  SET @NewAlumniId = SCOPE_IDENTITY();

  IF @UserId IS NOT NULL AND @SportId IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @UserId AND sport_id = @SportId)
  BEGIN
    INSERT INTO dbo.users_sports (user_id, sport_id, username)
    VALUES (@UserId, @SportId, @FirstName + ' ' + @LastName);
  END
END;
GO

-- ============================================================
-- sp_BulkCreatePlayers
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_BulkCreatePlayers
  @PlayersJson  NVARCHAR(MAX),  -- each row: userId INT, email, firstName, lastName, ...
  @CreatedBy    INT,
  @SportId      UNIQUEIDENTIFIER = NULL,
  @SuccessCount INT OUTPUT,
  @SkippedCount INT OUTPUT,
  @ErrorJson    NVARCHAR(MAX) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @SuccessCount = 0;
  SET @SkippedCount = 0;
  SET @ErrorJson    = '[]';

  DECLARE @errors TABLE (row_num INT, reason NVARCHAR(500));
  DECLARE @rows TABLE (
    row_num          INT,
    user_id          INT,
    email            NVARCHAR(255),
    first_name       NVARCHAR(100),
    last_name        NVARCHAR(100),
    jersey_number    TINYINT,
    position         NVARCHAR(10),
    academic_year    NVARCHAR(20),
    recruiting_class SMALLINT,
    height_inches    TINYINT,
    weight_lbs       SMALLINT,
    home_town        NVARCHAR(100),
    home_state       NVARCHAR(50),
    high_school      NVARCHAR(150),
    major            NVARCHAR(100),
    phone            NVARCHAR(20),
    emergency_contact_name  NVARCHAR(150),
    emergency_contact_phone NVARCHAR(20),
    parent1_name     NVARCHAR(150),
    parent1_phone    NVARCHAR(20),
    parent1_email    NVARCHAR(255),
    parent2_name     NVARCHAR(150),
    parent2_phone    NVARCHAR(20),
    parent2_email    NVARCHAR(255),
    notes            NVARCHAR(MAX)
  );

  INSERT INTO @rows (
    row_num, user_id, email, first_name, last_name,
    jersey_number, position, academic_year, recruiting_class,
    height_inches, weight_lbs, home_town, home_state, high_school,
    major, phone, emergency_contact_name, emergency_contact_phone,
    parent1_name, parent1_phone, parent1_email,
    parent2_name, parent2_phone, parent2_email, notes
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY (SELECT NULL)),
    TRY_CAST(JSON_VALUE(value, '$.userId')         AS INT),
    JSON_VALUE(value, '$.email'),
    JSON_VALUE(value, '$.firstName'),
    JSON_VALUE(value, '$.lastName'),
    TRY_CAST(JSON_VALUE(value, '$.jerseyNumber')    AS TINYINT),
    JSON_VALUE(value, '$.position'),
    JSON_VALUE(value, '$.academicYear'),
    TRY_CAST(JSON_VALUE(value, '$.recruitingClass') AS SMALLINT),
    TRY_CAST(JSON_VALUE(value, '$.heightInches')    AS TINYINT),
    TRY_CAST(JSON_VALUE(value, '$.weightLbs')       AS SMALLINT),
    JSON_VALUE(value, '$.homeTown'),
    JSON_VALUE(value, '$.homeState'),
    JSON_VALUE(value, '$.highSchool'),
    JSON_VALUE(value, '$.major'),
    JSON_VALUE(value, '$.phone'),
    JSON_VALUE(value, '$.emergencyContactName'),
    JSON_VALUE(value, '$.emergencyContactPhone'),
    JSON_VALUE(value, '$.parent1Name'),
    JSON_VALUE(value, '$.parent1Phone'),
    JSON_VALUE(value, '$.parent1Email'),
    JSON_VALUE(value, '$.parent2Name'),
    JSON_VALUE(value, '$.parent2Phone'),
    JSON_VALUE(value, '$.parent2Email'),
    JSON_VALUE(value, '$.notes')
  FROM OPENJSON(@PlayersJson);

  DECLARE @rowNum  INT, @uid INT, @email NVARCHAR(255), @fn NVARCHAR(100), @ln NVARCHAR(100);
  DECLARE @jersey TINYINT, @pos NVARCHAR(10), @acYear NVARCHAR(20), @recClass SMALLINT;
  DECLARE @heightIn TINYINT, @wt SMALLINT, @town NVARCHAR(100), @state NVARCHAR(50);
  DECLARE @hs NVARCHAR(150), @major NVARCHAR(100), @phone NVARCHAR(20);
  DECLARE @ecName NVARCHAR(150), @ecPhone NVARCHAR(20);
  DECLARE @p1n NVARCHAR(150), @p1ph NVARCHAR(20), @p1em NVARCHAR(255);
  DECLARE @p2n NVARCHAR(150), @p2ph NVARCHAR(20), @p2em NVARCHAR(255);
  DECLARE @notes NVARCHAR(MAX);

  DECLARE cur CURSOR FOR
    SELECT row_num, user_id, email, first_name, last_name,
           jersey_number, position, academic_year, recruiting_class,
           height_inches, weight_lbs, home_town, home_state, high_school,
           major, phone, emergency_contact_name, emergency_contact_phone,
           parent1_name, parent1_phone, parent1_email,
           parent2_name, parent2_phone, parent2_email, notes
    FROM @rows;

  OPEN cur;
  FETCH NEXT FROM cur INTO
    @rowNum, @uid, @email, @fn, @ln, @jersey, @pos, @acYear, @recClass,
    @heightIn, @wt, @town, @state, @hs, @major, @phone, @ecName, @ecPhone,
    @p1n, @p1ph, @p1em, @p2n, @p2ph, @p2em, @notes;

  WHILE @@FETCH_STATUS = 0
  BEGIN
    BEGIN TRY
      IF @fn IS NULL OR LEN(LTRIM(RTRIM(@fn))) = 0
        BEGIN INSERT INTO @errors VALUES (@rowNum,'First name is required'); SET @SkippedCount += 1; GOTO NextRow; END
      IF @ln IS NULL OR LEN(LTRIM(RTRIM(@ln))) = 0
        BEGIN INSERT INTO @errors VALUES (@rowNum,'Last name is required');  SET @SkippedCount += 1; GOTO NextRow; END
      IF @recClass IS NULL OR @recClass < 2000 OR @recClass > 2100
        BEGIN INSERT INTO @errors VALUES (@rowNum,'Invalid recruiting class year'); SET @SkippedCount += 1; GOTO NextRow; END
      IF @uid IS NULL
        BEGIN INSERT INTO @errors VALUES (@rowNum,'userId (INT) is required'); SET @SkippedCount += 1; GOTO NextRow; END

      IF @jersey IS NOT NULL AND EXISTS (
        SELECT 1 FROM dbo.players
        WHERE jersey_number = @jersey AND is_active = 1 AND player_id <> @uid
          AND (@SportId IS NULL OR sport_id = @SportId)
      )
        BEGIN INSERT INTO @errors VALUES (@rowNum,'Jersey #' + CAST(@jersey AS NVARCHAR) + ' already in use'); SET @SkippedCount += 1; GOTO NextRow; END

      EXEC dbo.sp_UpsertUser @UserId = @uid, @Email = @email, @FirstName = @fn, @LastName = @ln;

      IF EXISTS (SELECT 1 FROM dbo.players WHERE player_id = @uid)
      BEGIN
        UPDATE dbo.players SET
          sport_id                = COALESCE(@SportId, sport_id),
          jersey_number           = COALESCE(@jersey,   jersey_number),
          position                = ISNULL(@pos,        position),
          academic_year           = ISNULL(@acYear,     academic_year),
          recruiting_class        = ISNULL(@recClass,   recruiting_class),
          height_inches           = COALESCE(@heightIn, height_inches),
          weight_lbs              = COALESCE(@wt,       weight_lbs),
          home_town               = COALESCE(@town,     home_town),
          home_state              = COALESCE(@state,    home_state),
          high_school             = COALESCE(@hs,       high_school),
          major                   = COALESCE(@major,    major),
          phone                   = COALESCE(@phone,    phone),
          emergency_contact_name  = COALESCE(@ecName,   emergency_contact_name),
          emergency_contact_phone = COALESCE(@ecPhone,  emergency_contact_phone),
          parent1_name            = COALESCE(@p1n,      parent1_name),
          parent1_phone           = COALESCE(@p1ph,     parent1_phone),
          parent1_email           = COALESCE(@p1em,     parent1_email),
          parent2_name            = COALESCE(@p2n,      parent2_name),
          parent2_phone           = COALESCE(@p2ph,     parent2_phone),
          parent2_email           = COALESCE(@p2em,     parent2_email),
          notes                   = COALESCE(@notes,    notes),
          is_active               = 1,
          updated_at              = SYSUTCDATETIME()
        WHERE player_id = @uid;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.players (
          player_id, sport_id, jersey_number, position, academic_year, recruiting_class,
          height_inches, weight_lbs, home_town, home_state, high_school, major, phone,
          emergency_contact_name, emergency_contact_phone,
          parent1_name, parent1_phone, parent1_email,
          parent2_name, parent2_phone, parent2_email, notes
        )
        VALUES (
          @uid, @SportId, @jersey, @pos, @acYear, @recClass,
          @heightIn, @wt, @town, @state, @hs, @major, @phone,
          @ecName, @ecPhone, @p1n, @p1ph, @p1em, @p2n, @p2ph, @p2em, @notes
        );
      END

      IF @SportId IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @uid AND sport_id = @SportId)
        INSERT INTO dbo.users_sports (user_id, sport_id, username) VALUES (@uid, @SportId, @fn + ' ' + @ln);

      SET @SuccessCount += 1;

    END TRY
    BEGIN CATCH
      INSERT INTO @errors VALUES (@rowNum, ERROR_MESSAGE());
      SET @SkippedCount += 1;
    END CATCH;

    NextRow:
    FETCH NEXT FROM cur INTO
      @rowNum, @uid, @email, @fn, @ln, @jersey, @pos, @acYear, @recClass,
      @heightIn, @wt, @town, @state, @hs, @major, @phone, @ecName, @ecPhone,
      @p1n, @p1ph, @p1em, @p2n, @p2ph, @p2em, @notes;
  END

  CLOSE cur;
  DEALLOCATE cur;

  SELECT @ErrorJson = ISNULL(
    (SELECT row_num AS rowNum, reason FROM @errors FOR JSON PATH), '[]');
END;
GO

-- ============================================================
-- sp_BulkCreateAlumni
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_BulkCreateAlumni
  @AlumniJson   NVARCHAR(MAX),
  @CreatedBy    INT,
  @SportId      UNIQUEIDENTIFIER = NULL,
  @SuccessCount INT OUTPUT,
  @SkippedCount INT OUTPUT,
  @ErrorJson    NVARCHAR(MAX) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @SuccessCount = 0;
  SET @SkippedCount = 0;
  SET @ErrorJson    = '[]';

  DECLARE @errors TABLE (row_num INT, reason NVARCHAR(500));
  DECLARE @rows TABLE (
    row_num             INT,
    user_id             INT,
    first_name          NVARCHAR(100),
    last_name           NVARCHAR(100),
    graduation_year     SMALLINT,
    graduation_semester NVARCHAR(10),
    phone               NVARCHAR(20),
    linkedin_url        NVARCHAR(500),
    current_employer    NVARCHAR(200),
    current_job_title   NVARCHAR(150),
    current_city        NVARCHAR(100),
    current_state       NVARCHAR(50),
    is_donor            BIT,
    notes               NVARCHAR(MAX)
  );

  INSERT INTO @rows (
    row_num, user_id, first_name, last_name,
    graduation_year, graduation_semester,
    phone, linkedin_url,
    current_employer, current_job_title, current_city, current_state,
    is_donor, notes
  )
  SELECT
    ROW_NUMBER() OVER (ORDER BY (SELECT NULL)),
    TRY_CAST(JSON_VALUE(value, '$.userId')           AS INT),
    JSON_VALUE(value, '$.firstName'),
    JSON_VALUE(value, '$.lastName'),
    TRY_CAST(JSON_VALUE(value, '$.graduationYear')   AS SMALLINT),
    ISNULL(JSON_VALUE(value, '$.graduationSemester'), 'spring'),
    JSON_VALUE(value, '$.phone'),
    JSON_VALUE(value, '$.linkedInUrl'),
    JSON_VALUE(value, '$.currentEmployer'),
    JSON_VALUE(value, '$.currentJobTitle'),
    JSON_VALUE(value, '$.currentCity'),
    JSON_VALUE(value, '$.currentState'),
    CASE WHEN LOWER(JSON_VALUE(value, '$.isDonor')) IN ('yes','true','1') THEN 1 ELSE 0 END,
    JSON_VALUE(value, '$.notes')
  FROM OPENJSON(@AlumniJson);

  DECLARE @rowNum   INT, @uid INT, @fn NVARCHAR(100), @ln NVARCHAR(100);
  DECLARE @gradYear SMALLINT, @semester NVARCHAR(10), @phone NVARCHAR(20);
  DECLARE @linkedin NVARCHAR(500), @employer NVARCHAR(200), @jobTitle NVARCHAR(150);
  DECLARE @city NVARCHAR(100), @state NVARCHAR(50), @isDonor BIT, @notes NVARCHAR(MAX);

  DECLARE cur CURSOR FOR
    SELECT row_num, user_id, first_name, last_name,
           graduation_year, graduation_semester, phone, linkedin_url,
           current_employer, current_job_title, current_city, current_state,
           is_donor, notes
    FROM @rows;

  OPEN cur;
  FETCH NEXT FROM cur INTO
    @rowNum, @uid, @fn, @ln, @gradYear, @semester, @phone, @linkedin,
    @employer, @jobTitle, @city, @state, @isDonor, @notes;

  WHILE @@FETCH_STATUS = 0
  BEGIN
    BEGIN TRY
      IF @fn IS NULL OR LEN(LTRIM(RTRIM(@fn))) = 0 BEGIN INSERT INTO @errors VALUES (@rowNum,'First name required'); SET @SkippedCount += 1; GOTO NextAlumRow; END
      IF @ln IS NULL OR LEN(LTRIM(RTRIM(@ln))) = 0 BEGIN INSERT INTO @errors VALUES (@rowNum,'Last name required');  SET @SkippedCount += 1; GOTO NextAlumRow; END
      IF @gradYear IS NULL OR @gradYear < 1950 OR @gradYear > 2100 BEGIN INSERT INTO @errors VALUES (@rowNum,'Invalid graduation year'); SET @SkippedCount += 1; GOTO NextAlumRow; END

      IF @uid IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.alumni WHERE user_id = @uid)
      BEGIN
        UPDATE dbo.alumni SET
          sport_id            = COALESCE(@SportId,   sport_id),
          graduation_year     = @gradYear,
          graduation_semester = @semester,
          phone               = COALESCE(@phone,     phone),
          linkedin_url        = COALESCE(@linkedin,  linkedin_url),
          current_employer    = COALESCE(@employer,  current_employer),
          current_job_title   = COALESCE(@jobTitle,  current_job_title),
          current_city        = COALESCE(@city,      current_city),
          current_state       = COALESCE(@state,     current_state),
          is_donor            = COALESCE(@isDonor,   is_donor),
          notes               = COALESCE(@notes,     notes),
          updated_at          = SYSUTCDATETIME()
        WHERE user_id = @uid;
      END
      ELSE
      BEGIN
        INSERT INTO dbo.alumni (
          user_id, first_name, last_name, sport_id,
          graduation_year, graduation_semester,
          phone, linkedin_url,
          current_employer, current_job_title, current_city, current_state,
          is_donor, notes
        )
        VALUES (
          @uid, @fn, @ln, @SportId,
          @gradYear, @semester,
          @phone, @linkedin,
          @employer, @jobTitle, @city, @state,
          ISNULL(@isDonor, 0), @notes
        );
      END

      IF @uid IS NOT NULL AND @SportId IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @uid AND sport_id = @SportId)
        INSERT INTO dbo.users_sports (user_id, sport_id, username) VALUES (@uid, @SportId, @fn + ' ' + @ln);

      SET @SuccessCount += 1;

    END TRY
    BEGIN CATCH
      INSERT INTO @errors VALUES (@rowNum, ERROR_MESSAGE());
      SET @SkippedCount += 1;
    END CATCH;

    NextAlumRow:
    FETCH NEXT FROM cur INTO
      @rowNum, @uid, @fn, @ln, @gradYear, @semester, @phone, @linkedin,
      @employer, @jobTitle, @city, @state, @isDonor, @notes;
  END

  CLOSE cur;
  DEALLOCATE cur;

  SELECT @ErrorJson = ISNULL(
    (SELECT row_num AS rowNum, reason FROM @errors FOR JSON PATH), '[]');
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
-- sp_GetUserSports
-- @UserId INT NULL = staff user_id. NULL = admin (all sports).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserSports
  @TenantId INT,
  @UserId   INT = NULL
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
    WHERE  us.user_id  = @UserId
      AND  s.is_active = 1
    ORDER  BY s.name;
  END
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
  @SportId         UNIQUEIDENTIFIER = NULL,
  @SubjectLine     NVARCHAR(500)    = NULL,
  @BodyHtml        NVARCHAR(MAX)    = NULL,
  @FromName        NVARCHAR(200)    = NULL,
  @ReplyToEmail    NVARCHAR(255)    = NULL,
  @PhysicalAddress NVARCHAR(500)    = NULL,
  @NewCampaignId   UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode       NVARCHAR(50)     OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
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
  @SportId            UNIQUEIDENTIFIER = NULL,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
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
  @ErrorCode  NVARCHAR(50) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
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
      JOIN dbo.outreach_messages om2 ON
        (eu2.player_id IS NOT NULL AND eu2.player_id = om2.player_id) OR
        (eu2.alumni_id IS NOT NULL AND eu2.alumni_id = om2.alumni_id)
      WHERE om2.campaign_id = oc.id
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
  @ErrorCode  NVARCHAR(50) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
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
-- Returns eligible recipients as a result set.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_ResolveAudienceForCampaign
  @CampaignId UNIQUEIDENTIFIER,
  @ErrorCode  NVARCHAR(50) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @Audience    NVARCHAR(30);
  DECLARE @FiltersJson NVARCHAR(MAX);

  SELECT @Audience = target_audience, @FiltersJson = audience_filters
  FROM dbo.outreach_campaigns
  WHERE id = @CampaignId;

  IF @Audience IS NULL BEGIN SET @ErrorCode = 'CAMPAIGN_NOT_FOUND'; RETURN; END

  DECLARE @FilterGradYear  SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.gradYear')  AS SMALLINT);
  DECLARE @FilterPosition  NVARCHAR(10) = JSON_VALUE(@FiltersJson, '$.position');
  DECLARE @FilterGradYears NVARCHAR(MAX)= JSON_QUERY(@FiltersJson, '$.gradYears');
  DECLARE @FilterPositions NVARCHAR(MAX)= JSON_QUERY(@FiltersJson, '$.positions');

  -- Players
  SELECT
    p.player_id     AS recipientId,
    'player'        AS recipientType,
    u.first_name    AS firstName,
    u.last_name     AS lastName,
    p.personal_email AS personalEmail,
    p.phone,
    p.position,
    NULL            AS graduationYear,
    CASE WHEN eu.id IS NOT NULL THEN 1 ELSE 0 END AS isUnsubscribed
  FROM dbo.players p
  JOIN dbo.users   u  ON u.user_id = p.player_id
  LEFT JOIN dbo.email_unsubscribes eu ON eu.player_id = p.player_id AND eu.channel = 'email'
  WHERE p.is_active = 1
    AND p.personal_email IS NOT NULL
    AND @Audience IN ('all','players_only','byClass','byPosition','custom')
    AND (
      @Audience IN ('all','players_only')
      OR (@Audience = 'byClass'    AND p.recruiting_class = @FilterGradYear)
      OR (@Audience = 'byPosition' AND (
            (@FilterPosition IS NOT NULL AND p.position = @FilterPosition)
            OR (@FilterPositions IS NOT NULL AND EXISTS (
              SELECT 1 FROM OPENJSON(@FilterPositions) WHERE CAST([value] AS NVARCHAR(10)) = p.position
            ))
          ))
      OR (@Audience = 'custom'
          AND (@FilterPosition IS NULL OR p.position = @FilterPosition))
    )

  UNION ALL

  -- Alumni
  SELECT
    a.alumni_id     AS recipientId,
    'alumni'        AS recipientType,
    a.first_name,
    a.last_name,
    a.personal_email,
    a.phone,
    a.position,
    a.graduation_year AS graduationYear,
    CASE WHEN eu.id IS NOT NULL THEN 1 ELSE 0 END AS isUnsubscribed
  FROM dbo.alumni a
  LEFT JOIN dbo.email_unsubscribes eu ON eu.alumni_id = a.alumni_id AND eu.channel = 'email'
  WHERE a.personal_email IS NOT NULL
    AND @Audience IN ('all','alumni_only','byGradYear','byPosition','custom')
    AND (
      @Audience IN ('all','alumni_only')
      OR (@Audience = 'byGradYear' AND (
            (@FilterGradYear IS NOT NULL AND a.graduation_year = @FilterGradYear)
            OR (@FilterGradYears IS NOT NULL AND EXISTS (
              SELECT 1 FROM OPENJSON(@FilterGradYears) WHERE CAST([value] AS SMALLINT) = a.graduation_year
            ))
          ))
      OR (@Audience = 'byPosition' AND (
            (@FilterPosition IS NOT NULL AND a.position = @FilterPosition)
            OR (@FilterPositions IS NOT NULL AND EXISTS (
              SELECT 1 FROM OPENJSON(@FilterPositions) WHERE CAST([value] AS NVARCHAR(10)) = a.position
            ))
          ))
      OR (@Audience = 'custom'
          AND (@FilterGradYear IS NULL OR a.graduation_year = @FilterGradYear)
          AND (@FilterPosition IS NULL OR a.position        = @FilterPosition))
    );
END;
GO

-- ============================================================
-- sp_DispatchEmailCampaign
-- Queues outreach_messages for all eligible recipients.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_DispatchEmailCampaign
  @CampaignId       UNIQUEIDENTIFIER,
  @DailyRemaining   INT,
  @MonthlyRemaining INT,
  @QueuedCount      INT OUTPUT,
  @ErrorCode        NVARCHAR(50) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode   = NULL;
  SET @QueuedCount = 0;

  DECLARE @CampaignStatus NVARCHAR(20), @Audience NVARCHAR(30), @FiltersJson NVARCHAR(MAX);

  SELECT
    @CampaignStatus = status,
    @Audience       = target_audience,
    @FiltersJson    = audience_filters
  FROM dbo.outreach_campaigns
  WHERE id = @CampaignId;

  IF @CampaignStatus IS NULL BEGIN SET @ErrorCode = 'CAMPAIGN_NOT_FOUND'; RETURN; END
  IF @CampaignStatus NOT IN ('draft','scheduled') BEGIN SET @ErrorCode = 'INVALID_CAMPAIGN_STATUS'; RETURN; END

  DECLARE @FilterGradYear  SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.gradYear')  AS SMALLINT);
  DECLARE @FilterPosition  NVARCHAR(10) = JSON_VALUE(@FiltersJson, '$.position');
  DECLARE @FilterGradYears NVARCHAR(MAX)= JSON_QUERY(@FiltersJson, '$.gradYears');
  DECLARE @FilterPositions NVARCHAR(MAX)= JSON_QUERY(@FiltersJson, '$.positions');

  -- Build recipient temp table
  SELECT
    r.recipientId,
    r.recipientType,
    r.emailAddress,
    r.firstName,
    NEWID() AS unsubToken
  INTO #recipients
  FROM (
    -- Active players
    SELECT
      p.player_id    AS recipientId,
      'player'       AS recipientType,
      p.personal_email AS emailAddress,
      u.first_name   AS firstName
    FROM dbo.players p
    JOIN dbo.users   u ON u.user_id = p.player_id
    WHERE p.is_active = 1
      AND p.personal_email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.email_unsubscribes eu WHERE eu.player_id = p.player_id AND eu.channel = 'email')
      AND NOT EXISTS (SELECT 1 FROM dbo.outreach_messages om WHERE om.campaign_id = @CampaignId AND om.player_id = p.player_id)
      AND @Audience IN ('all','players_only','byClass','byPosition','custom')
      AND (
        @Audience IN ('all','players_only')
        OR (@Audience = 'byClass'    AND p.recruiting_class = @FilterGradYear)
        OR (@Audience = 'byPosition' AND (
              (@FilterPosition IS NOT NULL AND p.position = @FilterPosition)
              OR (@FilterPositions IS NOT NULL AND EXISTS (
                SELECT 1 FROM OPENJSON(@FilterPositions) WHERE CAST([value] AS NVARCHAR(10)) = p.position
              ))
            ))
        OR (@Audience = 'custom' AND (@FilterPosition IS NULL OR p.position = @FilterPosition))
      )

    UNION ALL

    -- Alumni
    SELECT
      a.alumni_id    AS recipientId,
      'alumni'       AS recipientType,
      a.personal_email AS emailAddress,
      a.first_name
    FROM dbo.alumni a
    WHERE a.personal_email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.email_unsubscribes eu WHERE eu.alumni_id = a.alumni_id AND eu.channel = 'email')
      AND NOT EXISTS (SELECT 1 FROM dbo.outreach_messages om WHERE om.campaign_id = @CampaignId AND om.alumni_id = a.alumni_id)
      AND @Audience IN ('all','alumni_only','byGradYear','byPosition','custom')
      AND (
        @Audience IN ('all','alumni_only')
        OR (@Audience = 'byGradYear' AND (
              (@FilterGradYear IS NOT NULL AND a.graduation_year = @FilterGradYear)
              OR (@FilterGradYears IS NOT NULL AND EXISTS (
                SELECT 1 FROM OPENJSON(@FilterGradYears) WHERE CAST([value] AS SMALLINT) = a.graduation_year
              ))
            ))
        OR (@Audience = 'byPosition' AND (
              (@FilterPosition IS NOT NULL AND a.position = @FilterPosition)
              OR (@FilterPositions IS NOT NULL AND EXISTS (
                SELECT 1 FROM OPENJSON(@FilterPositions) WHERE CAST([value] AS NVARCHAR(10)) = a.position
              ))
            ))
        OR (@Audience = 'custom'
            AND (@FilterGradYear IS NULL OR a.graduation_year = @FilterGradYear)
            AND (@FilterPosition IS NULL OR a.position        = @FilterPosition))
      )
  ) r;

  SET @QueuedCount = (SELECT COUNT(*) FROM #recipients);

  IF @QueuedCount = 0 BEGIN SET @ErrorCode = 'NO_ELIGIBLE_RECIPIENTS'; DROP TABLE #recipients; RETURN; END
  IF @QueuedCount > @DailyRemaining   BEGIN SET @ErrorCode = 'DAILY_LIMIT_EXCEEDED';   DROP TABLE #recipients; RETURN; END
  IF @QueuedCount > @MonthlyRemaining BEGIN SET @ErrorCode = 'MONTHLY_LIMIT_EXCEEDED'; DROP TABLE #recipients; RETURN; END

  INSERT INTO dbo.outreach_messages (
    campaign_id, player_id, alumni_id, channel, status, email_address, unsubscribe_token
  )
  SELECT
    @CampaignId,
    CASE WHEN r.recipientType = 'player' THEN r.recipientId ELSE NULL END,
    CASE WHEN r.recipientType = 'alumni' THEN r.recipientId ELSE NULL END,
    'email', 'queued', r.emailAddress, r.unsubToken
  FROM #recipients r;

  UPDATE dbo.outreach_campaigns
  SET status = 'active', started_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
  WHERE id = @CampaignId;

  SELECT
    om.id                AS messageId,
    om.player_id         AS playerId,
    om.alumni_id         AS alumniId,
    r.firstName,
    om.email_address     AS emailAddress,
    om.unsubscribe_token AS unsubscribeToken
  FROM dbo.outreach_messages om
  JOIN #recipients r ON
    (om.player_id IS NOT NULL AND om.player_id = r.recipientId AND r.recipientType = 'player') OR
    (om.alumni_id IS NOT NULL AND om.alumni_id = r.recipientId AND r.recipientType = 'alumni')
  WHERE om.campaign_id = @CampaignId AND om.status = 'queued';

  DROP TABLE #recipients;
END;
GO

-- ============================================================
-- sp_MarkEmailSent
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_MarkEmailSent
  @MessageIdsJson NVARCHAR(MAX),
  @ErrorCode      NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  UPDATE om
  SET    om.status  = 'sent',
         om.sent_at = SYSUTCDATETIME()
  FROM   dbo.outreach_messages om
  JOIN   OPENJSON(@MessageIdsJson) j ON CAST(j.[value] AS UNIQUEIDENTIFIER) = om.id
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
  @MessageId UNIQUEIDENTIFIER,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.outreach_messages WHERE id = @MessageId)
  BEGIN
    SET @ErrorCode = 'MESSAGE_NOT_FOUND';
    RETURN;
  END

  UPDATE dbo.outreach_messages
  SET opened_at = ISNULL(opened_at, SYSUTCDATETIME()),
      status    = CASE WHEN status = 'sent' THEN 'responded' ELSE status END
  WHERE id = @MessageId;
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

  DECLARE @PlayerId INT, @AlumniId INT, @FirstName NVARCHAR(100);

  SELECT @PlayerId = om.player_id, @AlumniId = om.alumni_id
  FROM   dbo.outreach_messages om
  WHERE  om.unsubscribe_token = @Token;

  IF @PlayerId IS NULL AND @AlumniId IS NULL
  BEGIN
    SET @ErrorCode = 'INVALID_TOKEN';
    RETURN;
  END

  IF @PlayerId IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.email_unsubscribes WHERE player_id = @PlayerId AND channel = 'email')
      INSERT INTO dbo.email_unsubscribes (player_id, channel) VALUES (@PlayerId, 'email');
    SELECT @FirstName = u.first_name FROM dbo.users u WHERE u.user_id = @PlayerId;
  END
  ELSE
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.email_unsubscribes WHERE alumni_id = @AlumniId AND channel = 'email')
      INSERT INTO dbo.email_unsubscribes (alumni_id, channel) VALUES (@AlumniId, 'email');
    SELECT @FirstName = first_name FROM dbo.alumni WHERE alumni_id = @AlumniId;
  END

  SELECT @FirstName AS firstName;
END;
GO

-- ============================================================
-- sp_CreatePost
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreatePost
  @CreatedBy    INT,
  @BodyHtml     NVARCHAR(MAX),
  @Audience     NVARCHAR(30),
  @Title        NVARCHAR(300)    = NULL,
  @AudienceJson NVARCHAR(MAX)    = NULL,
  @SportId      UNIQUEIDENTIFIER = NULL,
  @IsPinned     BIT              = 0,
  @AlsoEmail    BIT              = 0,
  @EmailSubject NVARCHAR(500)    = NULL,
  @NewPostId    UNIQUEIDENTIFIER OUTPUT,
  @CampaignId   UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode    NVARCHAR(50)     OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode  = NULL;
  SET @NewPostId  = NULL;
  SET @CampaignId = NULL;

  IF @Audience NOT IN ('all','players_only','alumni_only','by_position','by_grad_year','custom')
  BEGIN
    SET @ErrorCode = 'INVALID_AUDIENCE';
    RETURN;
  END

  IF @AlsoEmail = 1 AND @EmailSubject IS NULL
  BEGIN
    SET @ErrorCode = 'EMAIL_SUBJECT_REQUIRED';
    RETURN;
  END

  SET @NewPostId = NEWID();

  INSERT INTO dbo.feed_posts (
    id, created_by, title, body_html, audience, audience_json,
    sport_id, is_pinned, published_at
  )
  VALUES (
    @NewPostId, @CreatedBy, @Title, @BodyHtml, @Audience, @AudienceJson,
    @SportId, ISNULL(@IsPinned, 0), SYSUTCDATETIME()
  );

  DECLARE @CampaignAudience NVARCHAR(30) = CASE @Audience
    WHEN 'by_position'  THEN 'byPosition'
    WHEN 'by_grad_year' THEN 'byGradYear'
    ELSE @Audience
  END;

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
      @CampaignAudience, @AudienceJson,
      'draft', 'post_notification',
      @EmailSubject, @BodyHtml, @SportId, @CreatedBy
    );
    UPDATE dbo.feed_posts SET campaign_id = @CampaignId WHERE id = @NewPostId;
  END
END;
GO

-- ============================================================
-- sp_GetFeed
-- Viewer status determined by membership in dbo.players / dbo.alumni.
-- @ViewerUserId INT = dbo.users.user_id (the logged-in user).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetFeed
  @ViewerUserId INT,
  @SportId      UNIQUEIDENTIFIER = NULL,
  @Page         INT              = 1,
  @PageSize     INT              = 20,
  @TotalCount   INT              OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @TotalCount = 0;

  DECLARE @ViewerIsPlayer  BIT = 0;
  DECLARE @ViewerIsAlumni  BIT = 0;
  DECLARE @ViewerPosition  NVARCHAR(10) = NULL;
  DECLARE @ViewerGradYear  SMALLINT     = NULL;

  IF EXISTS (SELECT 1 FROM dbo.players WHERE player_id = @ViewerUserId AND is_active = 1)
  BEGIN
    SET @ViewerIsPlayer = 1;
    SELECT @ViewerPosition = position FROM dbo.players WHERE player_id = @ViewerUserId;
  END
  ELSE IF EXISTS (SELECT 1 FROM dbo.alumni WHERE user_id = @ViewerUserId)
  BEGIN
    SET @ViewerIsAlumni = 1;
    SELECT @ViewerGradYear = graduation_year, @ViewerPosition = position
    FROM dbo.alumni WHERE user_id = @ViewerUserId;
  END

  DECLARE @Offset INT = (@Page - 1) * @PageSize;
  IF @Offset < 0 SET @Offset = 0;

  ;WITH visible_posts AS (
    SELECT fp.*
    FROM dbo.feed_posts fp
    WHERE (fp.sport_id IS NULL OR fp.sport_id = @SportId OR @SportId IS NULL)
      AND (
        fp.audience = 'all'
        OR (fp.audience = 'players_only'  AND @ViewerIsPlayer = 1)
        OR (fp.audience = 'alumni_only'   AND @ViewerIsAlumni = 1)
        OR (fp.audience = 'by_position'
            AND @ViewerPosition IS NOT NULL
            AND fp.audience_json IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM OPENJSON(fp.audience_json, '$.positions')
              WHERE CAST([value] AS NVARCHAR(10)) = @ViewerPosition
            ))
        OR (fp.audience = 'by_grad_year'
            AND @ViewerIsAlumni = 1
            AND @ViewerGradYear IS NOT NULL
            AND fp.audience_json IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM OPENJSON(fp.audience_json, '$.gradYears')
              WHERE CAST([value] AS SMALLINT) = @ViewerGradYear
            ))
        OR (fp.audience = 'custom'
            AND fp.audience_json IS NOT NULL
            AND (JSON_VALUE(fp.audience_json, '$.position') IS NULL
                 OR JSON_VALUE(fp.audience_json, '$.position') = @ViewerPosition)
            AND (JSON_VALUE(fp.audience_json, '$.gradYear') IS NULL
                 OR CAST(JSON_VALUE(fp.audience_json, '$.gradYear') AS SMALLINT) = @ViewerGradYear))
      )
  )
  SELECT @TotalCount = COUNT(*) FROM visible_posts;

  ;WITH visible_posts AS (
    SELECT fp.*
    FROM dbo.feed_posts fp
    WHERE (fp.sport_id IS NULL OR fp.sport_id = @SportId OR @SportId IS NULL)
      AND (
        fp.audience = 'all'
        OR (fp.audience = 'players_only'  AND @ViewerIsPlayer = 1)
        OR (fp.audience = 'alumni_only'   AND @ViewerIsAlumni = 1)
        OR (fp.audience = 'by_position'
            AND @ViewerPosition IS NOT NULL
            AND fp.audience_json IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM OPENJSON(fp.audience_json, '$.positions')
              WHERE CAST([value] AS NVARCHAR(10)) = @ViewerPosition
            ))
        OR (fp.audience = 'by_grad_year'
            AND @ViewerIsAlumni = 1
            AND @ViewerGradYear IS NOT NULL
            AND fp.audience_json IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM OPENJSON(fp.audience_json, '$.gradYears')
              WHERE CAST([value] AS SMALLINT) = @ViewerGradYear
            ))
        OR (fp.audience = 'custom'
            AND fp.audience_json IS NOT NULL
            AND (JSON_VALUE(fp.audience_json, '$.position') IS NULL
                 OR JSON_VALUE(fp.audience_json, '$.position') = @ViewerPosition)
            AND (JSON_VALUE(fp.audience_json, '$.gradYear') IS NULL
                 OR CAST(JSON_VALUE(fp.audience_json, '$.gradYear') AS SMALLINT) = @ViewerGradYear))
      )
  )
  SELECT
    vp.id,
    vp.title,
    vp.body_html       AS bodyHtml,
    vp.audience,
    vp.audience_json   AS audienceJson,
    vp.sport_id        AS sportId,
    vp.is_pinned       AS isPinned,
    vp.is_welcome_post AS isWelcomePost,
    vp.campaign_id     AS campaignId,
    vp.created_by      AS createdBy,
    vp.published_at    AS publishedAt,
    vp.created_at      AS createdAt,
    CASE WHEN fpr.id IS NOT NULL THEN 1 ELSE 0 END AS isRead
  FROM visible_posts vp
  LEFT JOIN dbo.feed_post_reads fpr ON fpr.post_id = vp.id AND fpr.user_id = @ViewerUserId
  ORDER BY vp.is_pinned DESC, vp.published_at DESC
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- ============================================================
-- sp_GetFeedPost
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetFeedPost
  @PostId       UNIQUEIDENTIFIER,
  @ViewerUserId INT,
  @ErrorCode    NVARCHAR(50) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @ViewerIsPlayer BIT = 0, @ViewerIsAlumni BIT = 0;
  DECLARE @ViewerPosition NVARCHAR(10) = NULL, @ViewerGradYear SMALLINT = NULL;

  IF EXISTS (SELECT 1 FROM dbo.players WHERE player_id = @ViewerUserId AND is_active = 1)
  BEGIN
    SET @ViewerIsPlayer = 1;
    SELECT @ViewerPosition = position FROM dbo.players WHERE player_id = @ViewerUserId;
  END
  ELSE IF EXISTS (SELECT 1 FROM dbo.alumni WHERE user_id = @ViewerUserId)
  BEGIN
    SET @ViewerIsAlumni = 1;
    SELECT @ViewerGradYear = graduation_year, @ViewerPosition = position
    FROM dbo.alumni WHERE user_id = @ViewerUserId;
  END

  SELECT
    fp.id, fp.title,
    fp.body_html       AS bodyHtml,
    fp.audience,
    fp.audience_json   AS audienceJson,
    fp.sport_id        AS sportId,
    fp.is_pinned       AS isPinned,
    fp.is_welcome_post AS isWelcomePost,
    fp.campaign_id     AS campaignId,
    fp.created_by      AS createdBy,
    fp.published_at    AS publishedAt,
    fp.created_at      AS createdAt,
    CASE WHEN fpr.id IS NOT NULL THEN 1 ELSE 0 END AS isRead
  FROM dbo.feed_posts fp
  LEFT JOIN dbo.feed_post_reads fpr ON fpr.post_id = fp.id AND fpr.user_id = @ViewerUserId
  WHERE fp.id = @PostId
    AND (
      fp.audience = 'all'
      OR (fp.audience = 'players_only' AND @ViewerIsPlayer = 1)
      OR (fp.audience = 'alumni_only'  AND @ViewerIsAlumni = 1)
      OR (fp.audience = 'by_position'
          AND @ViewerPosition IS NOT NULL
          AND fp.audience_json IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM OPENJSON(fp.audience_json, '$.positions')
            WHERE CAST([value] AS NVARCHAR(10)) = @ViewerPosition
          ))
      OR (fp.audience = 'by_grad_year'
          AND @ViewerIsAlumni = 1
          AND @ViewerGradYear IS NOT NULL
          AND fp.audience_json IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM OPENJSON(fp.audience_json, '$.gradYears')
            WHERE CAST([value] AS SMALLINT) = @ViewerGradYear
          ))
      OR (fp.audience = 'custom'
          AND fp.audience_json IS NOT NULL
          AND (JSON_VALUE(fp.audience_json, '$.position') IS NULL
               OR JSON_VALUE(fp.audience_json, '$.position') = @ViewerPosition)
          AND (JSON_VALUE(fp.audience_json, '$.gradYear') IS NULL
               OR CAST(JSON_VALUE(fp.audience_json, '$.gradYear') AS SMALLINT) = @ViewerGradYear))
    );
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
-- sp_GetPostReadStats
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetPostReadStats
  @PostId    UNIQUEIDENTIFIER,
  @ErrorCode NVARCHAR(50) OUTPUT,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @Audience     NVARCHAR(30), @AudienceJson NVARCHAR(MAX), @SportId UNIQUEIDENTIFIER;

  SELECT @Audience = audience, @AudienceJson = audience_json, @SportId = sport_id
  FROM   dbo.feed_posts WHERE id = @PostId;

  IF @Audience IS NULL BEGIN SET @ErrorCode = 'POST_NOT_FOUND'; RETURN; END

  DECLARE @FilterGradYear  SMALLINT     = TRY_CAST(JSON_VALUE(@AudienceJson, '$.gradYear')  AS SMALLINT);
  DECLARE @FilterPosition  NVARCHAR(10) = JSON_VALUE(@AudienceJson, '$.position');
  DECLARE @FilterGradYears NVARCHAR(MAX)= JSON_QUERY(@AudienceJson, '$.gradYears');
  DECLARE @FilterPositions NVARCHAR(MAX)= JSON_QUERY(@AudienceJson, '$.positions');

  DECLARE @TotalEligible INT = 0;
  DECLARE @PlayerCount   INT = 0;
  DECLARE @AlumniCount   INT = 0;

  IF @Audience IN ('all','players_only','byClass','byPosition','custom')
    SELECT @PlayerCount = COUNT(*) FROM dbo.players p
    WHERE p.is_active = 1
      AND (@SportId IS NULL OR p.sport_id = @SportId)
      AND (
        @Audience IN ('all','players_only')
        OR (@Audience = 'byClass'    AND p.recruiting_class = @FilterGradYear)
        OR (@Audience = 'byPosition' AND (
              (@FilterPosition IS NOT NULL AND p.position = @FilterPosition)
              OR (@FilterPositions IS NOT NULL AND EXISTS (
                SELECT 1 FROM OPENJSON(@FilterPositions) WHERE CAST([value] AS NVARCHAR(10)) = p.position
              ))
            ))
        OR (@Audience = 'custom' AND (@FilterPosition IS NULL OR p.position = @FilterPosition))
      );

  IF @Audience IN ('all','alumni_only','byGradYear','byPosition','custom')
    SELECT @AlumniCount = COUNT(*) FROM dbo.alumni a
    WHERE (@SportId IS NULL OR a.sport_id = @SportId)
      AND (
        @Audience IN ('all','alumni_only')
        OR (@Audience = 'byGradYear' AND (
              (@FilterGradYear IS NOT NULL AND a.graduation_year = @FilterGradYear)
              OR (@FilterGradYears IS NOT NULL AND EXISTS (
                SELECT 1 FROM OPENJSON(@FilterGradYears) WHERE CAST([value] AS SMALLINT) = a.graduation_year
              ))
            ))
        OR (@Audience = 'byPosition' AND (
              (@FilterPosition IS NOT NULL AND a.position = @FilterPosition)
              OR (@FilterPositions IS NOT NULL AND EXISTS (
                SELECT 1 FROM OPENJSON(@FilterPositions) WHERE CAST([value] AS NVARCHAR(10)) = a.position
              ))
            ))
        OR (@Audience = 'custom'
            AND (@FilterGradYear IS NULL OR a.graduation_year = @FilterGradYear)
            AND (@FilterPosition IS NULL OR a.position        = @FilterPosition))
      );

  SET @TotalEligible = @PlayerCount + @AlumniCount;

  DECLARE @TotalRead INT;
  SELECT @TotalRead = COUNT(*) FROM dbo.feed_post_reads WHERE post_id = @PostId;

  SELECT
    @TotalEligible AS totalEligible,
    @TotalRead     AS totalRead,
    CASE WHEN @TotalEligible = 0 THEN 0
         ELSE CAST(100.0 * @TotalRead / @TotalEligible AS DECIMAL(5,1))
    END AS readThroughRatePct;
END;
GO

-- ============================================================
-- sp_GetDashboardMetrics_Alumni
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetDashboardMetrics_Alumni
  @TenantId           INT,
  @SportId            UNIQUEIDENTIFIER = NULL,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @MonthStart    DATETIME2 =
    CAST(DATEADD(DAY, 1 - DAY(GETUTCDATE()), CAST(GETUTCDATE() AS DATE)) AS DATETIME2);
  DECLARE @ThirtyDaysAgo DATETIME2 = DATEADD(DAY, -30, SYSUTCDATETIME());

  DECLARE @TotalInteractions INT, @MonthInteractions INT;

  SELECT @TotalInteractions = COUNT(*)
  FROM   dbo.interaction_log il
  WHERE  EXISTS (
    SELECT 1 FROM dbo.alumni a
    WHERE  a.alumni_id = il.alumni_id
      AND  (@SportId IS NULL OR a.sport_id = @SportId)
  );

  SELECT @MonthInteractions = COUNT(*)
  FROM   dbo.interaction_log il
  WHERE  il.logged_at >= @MonthStart
    AND  EXISTS (
      SELECT 1 FROM dbo.alumni a
      WHERE  a.alumni_id = il.alumni_id
        AND  (@SportId IS NULL OR a.sport_id = @SportId)
    );

  DECLARE @TotalEmailsSent INT, @MonthEmailsSent INT;

  SELECT @TotalEmailsSent = COUNT(om.id)
  FROM   dbo.outreach_messages  om
  JOIN   dbo.outreach_campaigns oc ON oc.id = om.campaign_id
  WHERE  om.status           IN ('sent','responded')
    AND  oc.target_audience  IN ('all','alumni_only')
    AND  om.alumni_id IS NOT NULL
    AND  (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.alumni a WHERE a.alumni_id = om.alumni_id AND a.sport_id = @SportId
    ));

  SELECT @MonthEmailsSent = COUNT(om.id)
  FROM   dbo.outreach_messages  om
  JOIN   dbo.outreach_campaigns oc ON oc.id = om.campaign_id
  WHERE  om.status           IN ('sent','responded')
    AND  om.sent_at          >= @MonthStart
    AND  oc.target_audience  IN ('all','alumni_only')
    AND  om.alumni_id IS NOT NULL
    AND  (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.alumni a WHERE a.alumni_id = om.alumni_id AND a.sport_id = @SportId
    ));

  SELECT
    ISNULL(@TotalInteractions,  0) AS totalInteractions,
    ISNULL(@MonthInteractions,  0) AS monthInteractions,
    ISNULL(@TotalEmailsSent,    0) AS totalEmailsSent,
    ISNULL(@MonthEmailsSent,    0) AS monthEmailsSent,
    0                              AS alumniLoginsLast30Days,
    0                              AS emailOpenRatePct;
END;
GO

-- ============================================================
-- sp_GetDashboardMetrics_Players
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetDashboardMetrics_Players
  @TenantId           INT,
  @SportId            UNIQUEIDENTIFIER = NULL,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @MonthStart DATETIME2 =
    CAST(DATEADD(DAY, 1 - DAY(GETUTCDATE()), CAST(GETUTCDATE() AS DATE)) AS DATETIME2);

  DECLARE @TotalEmailsSent INT, @MonthEmailsSent INT;
  SELECT
    @TotalEmailsSent = ISNULL(COUNT(*), 0),
    @MonthEmailsSent = ISNULL(SUM(CASE WHEN om.sent_at >= @MonthStart THEN 1 ELSE 0 END), 0)
  FROM dbo.outreach_messages  om
  JOIN dbo.outreach_campaigns oc ON oc.id = om.campaign_id
  WHERE oc.target_audience IN ('all','players_only')
    AND om.status IN ('sent','responded')
    AND om.player_id IS NOT NULL
    AND (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.players p WHERE p.player_id = om.player_id AND p.sport_id = @SportId
    ));

  DECLARE @TotalFeedPosts INT, @MonthFeedPosts INT;
  SELECT
    @TotalFeedPosts = ISNULL(COUNT(*), 0),
    @MonthFeedPosts = ISNULL(SUM(CASE WHEN fp.published_at >= @MonthStart THEN 1 ELSE 0 END), 0)
  FROM dbo.feed_posts fp
  WHERE fp.audience IN ('all','players_only');

  SELECT
    ISNULL(@TotalEmailsSent, 0) AS totalEmailsSent,
    ISNULL(@MonthEmailsSent, 0) AS monthEmailsSent,
    ISNULL(@TotalFeedPosts,  0) AS totalFeedPosts,
    ISNULL(@MonthFeedPosts,  0) AS monthFeedPosts;
END;
GO

-- ============================================================
-- sp_GetDashboardMetrics_All
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetDashboardMetrics_All
  @TenantId           INT,
  @SportId            UNIQUEIDENTIFIER = NULL,
  @RequestingUserId   INT              = NULL,
  @RequestingUserRole NVARCHAR(50)     = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @MonthStart DATETIME2 =
    CAST(DATEADD(DAY, 1 - DAY(GETUTCDATE()), CAST(GETUTCDATE() AS DATE)) AS DATETIME2);

  DECLARE @TotalInteractions INT, @MonthInteractions INT;
  SELECT @TotalInteractions = COUNT(*)
  FROM   dbo.interaction_log il
  WHERE  EXISTS (
    SELECT 1 FROM dbo.alumni a WHERE a.alumni_id = il.alumni_id
      AND (@SportId IS NULL OR a.sport_id = @SportId)
  );
  SELECT @MonthInteractions = COUNT(*)
  FROM   dbo.interaction_log il
  WHERE  il.logged_at >= @MonthStart
    AND  EXISTS (
      SELECT 1 FROM dbo.alumni a WHERE a.alumni_id = il.alumni_id
        AND (@SportId IS NULL OR a.sport_id = @SportId)
    );

  DECLARE @AlumniEmailsTotal INT, @AlumniEmailsMonth INT;
  SELECT
    @AlumniEmailsTotal = ISNULL(COUNT(*), 0),
    @AlumniEmailsMonth = ISNULL(SUM(CASE WHEN om.sent_at >= @MonthStart THEN 1 ELSE 0 END), 0)
  FROM   dbo.outreach_messages  om
  JOIN   dbo.outreach_campaigns oc ON oc.id = om.campaign_id
  WHERE  om.status          IN ('sent','responded')
    AND  oc.target_audience IN ('all','alumni_only')
    AND  om.alumni_id IS NOT NULL
    AND  (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.alumni a WHERE a.alumni_id = om.alumni_id AND a.sport_id = @SportId
    ));

  DECLARE @PlayerEmailsTotal INT, @PlayerEmailsMonth INT;
  SELECT
    @PlayerEmailsTotal = ISNULL(COUNT(*), 0),
    @PlayerEmailsMonth = ISNULL(SUM(CASE WHEN om.sent_at >= @MonthStart THEN 1 ELSE 0 END), 0)
  FROM   dbo.outreach_messages  om
  JOIN   dbo.outreach_campaigns oc ON oc.id = om.campaign_id
  WHERE  om.status          IN ('sent','responded')
    AND  oc.target_audience IN ('all','players_only')
    AND  om.player_id IS NOT NULL
    AND  (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.players p WHERE p.player_id = om.player_id AND p.sport_id = @SportId
    ));

  DECLARE @TotalFeedPosts INT, @MonthFeedPosts INT;
  SELECT
    @TotalFeedPosts = ISNULL(COUNT(*), 0),
    @MonthFeedPosts = ISNULL(SUM(CASE WHEN fp.published_at >= @MonthStart THEN 1 ELSE 0 END), 0)
  FROM dbo.feed_posts fp;

  SELECT
    ISNULL(@TotalInteractions,  0) AS totalInteractions,
    ISNULL(@MonthInteractions,  0) AS monthInteractions,
    ISNULL(@AlumniEmailsTotal,  0) AS alumniEmailsTotal,
    ISNULL(@AlumniEmailsMonth,  0) AS alumniEmailsMonth,
    0                              AS alumniLoginsLast30Days,
    ISNULL(@PlayerEmailsTotal,  0) AS playerEmailsTotal,
    ISNULL(@PlayerEmailsMonth,  0) AS playerEmailsMonth,
    ISNULL(@TotalFeedPosts,     0) AS totalFeedPosts,
    ISNULL(@MonthFeedPosts,     0) AS monthFeedPosts;
END;
GO
