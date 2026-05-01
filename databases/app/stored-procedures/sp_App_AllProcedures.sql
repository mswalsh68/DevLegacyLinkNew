SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- APP DB — ALL STORED PROCEDURES
-- Run on: each tenant AppDB after 009_outreach_feed_schema_update.sql
--
-- Schema (post-migration 008 + 009):
--   dbo.users          — thin sync: user_id INT PK (mirrors Global)
--   dbo.users_roles    — junction: user_id + program_role_id + sport_id + status
--   dbo.sports         — id INT PK (Football = 1)
--   dbo.sports_position — position lookup by sport
--   dbo.role_transfer_log — audit log for status transitions
--   dbo.interaction_log   — staff interactions, keyed on user_id
--   dbo.outreach_*     — campaign/email system (user_id based)
--   dbo.feed_*         — news feed (sport_id INT)
--
-- ID conventions:
--   @UserId    INT = dbo.users.user_id (global INT)
--   @UserRoleId INT = dbo.users_roles.user_role_id
--   @SportId   INT = dbo.sports.id
--   @AdminUserId INT = dbo.users.user_id of the acting staff member
-- ============================================================

-- ============================================================
-- sp_UpsertUser
-- Syncs a LegacyLinkGlobal user into local dbo.users.
-- Called at login and before any role-assignment flow.
-- NOTE: program_role_id removed from dbo.users in migration 008.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertUser
  @UserId       INT,
  @Email        NVARCHAR(255),
  @FirstName    NVARCHAR(100),
  @LastName     NVARCHAR(100),
  @PlatformRole NVARCHAR(50)  = 'player'
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId)
  BEGIN
    UPDATE dbo.users SET
      email         = @Email,
      first_name    = @FirstName,
      last_name     = @LastName,
      platform_role = ISNULL(@PlatformRole, platform_role),
      synced_at     = SYSUTCDATETIME()
    WHERE user_id = @UserId;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.users (user_id, email, first_name, last_name, platform_role)
    VALUES (@UserId, @Email, @FirstName, @LastName, ISNULL(@PlatformRole, 'player'));
  END
END;
GO

-- ============================================================
-- vwRoster
-- Active current players.
-- Joins users_roles (status='current_player') with users,
-- sports, and sports_position for display.
-- ============================================================
CREATE OR ALTER VIEW dbo.vwRoster AS
SELECT
  ur.user_role_id,
  ur.user_id,
  u.email,
  u.first_name,
  u.last_name,
  ur.sport_id,
  s.name          AS sport_name,
  s.abbr          AS sport_abbr,
  ur.position_id,
  sp.position_name AS position,
  ur.jersey_number,
  ur.seasons_played,
  ur.class_year,
  ur.created_at,
  ur.updated_at
FROM dbo.users_roles ur
JOIN dbo.users         u  ON u.user_id   = ur.user_id
JOIN dbo.sports        s  ON s.id        = ur.sport_id
LEFT JOIN dbo.sports_position sp ON sp.position_id = ur.position_id
WHERE ur.status = 'current_player'
  AND ur.sport_id IS NOT NULL;
GO

-- ============================================================
-- vwAlumniRoster
-- All alumni (status='alumni').
-- ============================================================
CREATE OR ALTER VIEW dbo.vwAlumniRoster AS
SELECT
  ur.user_role_id,
  ur.user_id,
  u.email,
  u.first_name,
  u.last_name,
  ur.sport_id,
  s.name          AS sport_name,
  s.abbr          AS sport_abbr,
  ur.position_id,
  sp.position_name AS position,
  ur.jersey_number,
  ur.seasons_played,
  ur.class_year,
  ur.created_at,
  ur.updated_at
FROM dbo.users_roles ur
JOIN dbo.users         u  ON u.user_id   = ur.user_id
JOIN dbo.sports        s  ON s.id        = ur.sport_id
LEFT JOIN dbo.sports_position sp ON sp.position_id = ur.position_id
WHERE ur.status = 'alumni'
  AND ur.sport_id IS NOT NULL;
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
  WHERE r.sport_id = @SportId
    AND (@PositionId IS NULL OR r.position_id  = @PositionId)
    AND (@ClassYear  IS NULL OR r.class_year   = @ClassYear)
    AND (@Search IS NULL
         OR r.first_name    LIKE @SearchWild
         OR r.last_name     LIKE @SearchWild
         OR CAST(ISNULL(r.jersey_number, -1) AS NVARCHAR) = @Search);

  SELECT
    r.user_role_id  AS userRoleId,
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
  WHERE r.sport_id = @SportId
    AND (@PositionId IS NULL OR r.position_id  = @PositionId)
    AND (@ClassYear  IS NULL OR r.class_year   = @ClassYear)
    AND (@Search IS NULL
         OR r.first_name    LIKE @SearchWild
         OR r.last_name     LIKE @SearchWild
         OR CAST(ISNULL(r.jersey_number, -1) AS NVARCHAR) = @Search)
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
  WHERE a.sport_id = @SportId
    AND (@PositionId IS NULL OR a.position_id = @PositionId)
    AND (@ClassYear  IS NULL OR a.class_year  = @ClassYear)
    AND (@Search IS NULL
         OR a.first_name LIKE @SearchWild
         OR a.last_name  LIKE @SearchWild
         OR a.email      LIKE @SearchWild);

  SELECT
    a.user_role_id  AS userRoleId,
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
  WHERE a.sport_id = @SportId
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
-- Returns all roles for a user across all sports.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserRoles
  @UserId INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    ur.user_role_id  AS userRoleId,
    ur.user_id       AS userId,
    ur.sport_id      AS sportId,
    s.name           AS sportName,
    s.abbr           AS sportAbbr,
    ur.program_role_id AS programRoleId,
    pr.display_name  AS programRoleDisplay,
    ur.status,
    ur.position_id   AS positionId,
    sp.position_name AS position,
    ur.jersey_number AS jerseyNumber,
    ur.seasons_played AS seasonsPlayed,
    ur.class_year    AS classYear,
    ur.created_at    AS createdAt,
    ur.updated_at    AS updatedAt
  FROM dbo.users_roles ur
  LEFT JOIN dbo.sports          s  ON s.id  = ur.sport_id
  LEFT JOIN dbo.program_role    pr ON pr.id = ur.program_role_id
  LEFT JOIN dbo.sports_position sp ON sp.position_id = ur.position_id
  WHERE ur.user_id = @UserId
  ORDER BY s.name, pr.sort_order;
END;
GO

-- ============================================================
-- sp_AddUserRole
-- Adds a new users_roles record for a user.
-- Called when adding a player to a sport roster.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_AddUserRole
  @UserId        INT,
  @ProgramRoleId INT,
  @SportId       INT           = NULL,
  @Status        NVARCHAR(20)  = 'current_player',
  @PositionId    INT           = NULL,
  @JerseyNumber  TINYINT       = NULL,
  @SeasonsPlayed TINYINT       = NULL,
  @ClassYear     SMALLINT      = NULL,
  @AdminUserId   INT,
  @NewUserRoleId INT           OUTPUT,
  @ErrorCode     NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode     = NULL;
  SET @NewUserRoleId = NULL;

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

  IF @Status NOT IN ('current_player', 'alumni', 'removed')
  BEGIN
    SET @ErrorCode = 'INVALID_STATUS';
    RETURN;
  END

  IF @JerseyNumber IS NOT NULL AND @SportId IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM dbo.users_roles
       WHERE sport_id      = @SportId
         AND jersey_number = @JerseyNumber
         AND status        = 'current_player'
         AND user_id       <> @UserId
     )
  BEGIN
    SET @ErrorCode = 'JERSEY_NUMBER_IN_USE';
    RETURN;
  END

  -- Check for duplicate active role
  IF EXISTS (
    SELECT 1 FROM dbo.users_roles
    WHERE user_id         = @UserId
      AND program_role_id = @ProgramRoleId
      AND status          NOT IN ('removed')
      AND ((@SportId IS NULL AND sport_id IS NULL) OR sport_id = @SportId)
  )
  BEGIN
    SET @ErrorCode = 'ROLE_ALREADY_EXISTS';
    RETURN;
  END

  INSERT INTO dbo.users_roles (
    user_id, program_role_id, sport_id, status,
    position_id, jersey_number, seasons_played, class_year
  )
  VALUES (
    @UserId, @ProgramRoleId, @SportId, @Status,
    @PositionId, @JerseyNumber, @SeasonsPlayed, @ClassYear
  );

  SET @NewUserRoleId = SCOPE_IDENTITY();

  -- Ensure the user has a users_sports entry for this sport
  IF @SportId IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @UserId AND sport_id = @SportId)
  BEGIN
    INSERT INTO dbo.users_sports (user_id, sport_id, username)
    SELECT @UserId, @SportId, first_name + ' ' + last_name
    FROM   dbo.users WHERE user_id = @UserId;
  END
END;
GO

-- ============================================================
-- sp_UpdateUserRole
-- Updates mutable fields on a users_roles record.
-- NULL = no change.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateUserRole
  @UserRoleId    INT,
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

  DECLARE @SportId INT, @CurUser INT;
  SELECT @SportId = sport_id, @CurUser = user_id
  FROM   dbo.users_roles WHERE user_role_id = @UserRoleId;

  IF @CurUser IS NULL
  BEGIN
    SET @ErrorCode = 'ROLE_NOT_FOUND';
    RETURN;
  END

  IF @JerseyNumber IS NOT NULL AND @SportId IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM dbo.users_roles
       WHERE sport_id      = @SportId
         AND jersey_number = @JerseyNumber
         AND status        = 'current_player'
         AND user_role_id  <> @UserRoleId
     )
  BEGIN
    SET @ErrorCode = 'JERSEY_NUMBER_IN_USE';
    RETURN;
  END

  UPDATE dbo.users_roles SET
    position_id   = COALESCE(@PositionId,    position_id),
    jersey_number = COALESCE(@JerseyNumber,  jersey_number),
    seasons_played= COALESCE(@SeasonsPlayed, seasons_played),
    class_year    = COALESCE(@ClassYear,     class_year),
    updated_at    = SYSUTCDATETIME()
  WHERE user_role_id = @UserRoleId;
END;
GO

-- ============================================================
-- sp_TransferUserRole
-- Transitions a user_role status (e.g. current_player → alumni).
-- Logs the change to dbo.role_transfer_log.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_TransferUserRole
  @UserRoleId          INT,
  @NewStatus           NVARCHAR(20),
  @SeasonsPlayed       TINYINT      = NULL,
  @ClassYear           SMALLINT     = NULL,
  @AdminUserId         INT,
  @AdminAcknowledged   BIT          = 0,
  @Notes               NVARCHAR(MAX)= NULL,
  @ErrorCode           NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF @NewStatus NOT IN ('current_player', 'alumni', 'removed')
  BEGIN
    SET @ErrorCode = 'INVALID_STATUS';
    RETURN;
  END

  DECLARE @FromStatus NVARCHAR(20);
  SELECT @FromStatus = status FROM dbo.users_roles WHERE user_role_id = @UserRoleId;

  IF @FromStatus IS NULL
  BEGIN
    SET @ErrorCode = 'ROLE_NOT_FOUND';
    RETURN;
  END

  IF @FromStatus = @NewStatus
  BEGIN
    SET @ErrorCode = 'STATUS_UNCHANGED';
    RETURN;
  END

  BEGIN TRANSACTION;
  BEGIN TRY
    UPDATE dbo.users_roles SET
      status        = @NewStatus,
      seasons_played= COALESCE(@SeasonsPlayed, seasons_played),
      class_year    = COALESCE(@ClassYear,     class_year),
      updated_at    = SYSUTCDATETIME()
    WHERE user_role_id = @UserRoleId;

    INSERT INTO dbo.role_transfer_log (
      user_role_id, admin_user_id,
      from_status, to_status,
      seasons_played, class_year,
      admin_acknowledged, notes
    )
    VALUES (
      @UserRoleId, @AdminUserId,
      @FromStatus, @NewStatus,
      @SeasonsPlayed, @ClassYear,
      @AdminAcknowledged, @Notes
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
-- @UserId INT NULL = staff user_id. NULL = admin (all sports).
-- sport_id is now INT (after migration 008).
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
-- sp_LogInteraction
-- Logs a staff interaction with a user (player or alumni).
-- Keyed on user_id (no longer alumni_id).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_LogInteraction
  @UserId     INT,            -- dbo.users.user_id of the member
  @LoggedBy   INT,            -- dbo.users.user_id of the staff member
  @Channel    NVARCHAR(30),   -- 'email' | 'phone' | 'text' | 'in_person' | 'other'
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
-- sp_GetRosterStats
-- Summary stats for a sport's roster and alumni.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetRosterStats
  @SportId INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    COUNT(CASE WHEN ur.status = 'current_player' THEN 1 END) AS totalCurrentPlayers,
    COUNT(CASE WHEN ur.status = 'alumni'         THEN 1 END) AS totalAlumni,
    MIN(CASE WHEN ur.status = 'alumni' THEN ur.class_year END) AS earliestClass,
    MAX(CASE WHEN ur.status = 'alumni' THEN ur.class_year END) AS latestClass
  FROM dbo.users_roles ur
  WHERE (@SportId IS NULL OR ur.sport_id = @SportId)
    AND ur.status IN ('current_player', 'alumni');
END;
GO

-- ============================================================
-- sp_CreateCampaign
-- sport_id is now INT (after migration 009).
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
-- Returns eligible recipients from dbo.users_roles.
-- Recipients are users with status='current_player' or 'alumni'
-- who have an email address on file.
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

  DECLARE @FilterClassYear SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.classYear')  AS SMALLINT);
  DECLARE @FilterGradYear  SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.gradYear')   AS SMALLINT);
  DECLARE @FilterPositionId INT         = TRY_CAST(JSON_VALUE(@FiltersJson, '$.positionId') AS INT);
  DECLARE @FilterGradYears NVARCHAR(MAX)= JSON_QUERY(@FiltersJson, '$.gradYears');

  SELECT
    ur.user_id          AS recipientId,
    ur.status           AS recipientType,
    u.first_name        AS firstName,
    u.last_name         AS lastName,
    u.email,
    sp.position_name    AS position,
    ur.class_year       AS classYear,
    CASE WHEN eu.id IS NOT NULL THEN 1 ELSE 0 END AS isUnsubscribed
  FROM dbo.users_roles ur
  JOIN dbo.users u ON u.user_id = ur.user_id
  LEFT JOIN dbo.sports_position sp ON sp.position_id = ur.position_id
  LEFT JOIN dbo.email_unsubscribes eu ON eu.user_id = ur.user_id AND eu.channel = 'email'
  WHERE u.email IS NOT NULL
    AND (@SportId IS NULL OR ur.sport_id = @SportId)
    AND (
      (@Audience = 'all'         AND ur.status IN ('current_player','alumni'))
      OR (@Audience = 'players_only' AND ur.status = 'current_player')
      OR (@Audience = 'alumni_only'  AND ur.status = 'alumni')
      OR (@Audience = 'byClass'
          AND ur.status = 'current_player'
          AND @FilterClassYear IS NOT NULL
          AND ur.class_year = @FilterClassYear)
      OR (@Audience = 'byGradYear'
          AND ur.status = 'alumni'
          AND (
            (@FilterGradYear  IS NOT NULL AND ur.class_year = @FilterGradYear)
            OR (@FilterGradYears IS NOT NULL AND EXISTS (
              SELECT 1 FROM OPENJSON(@FilterGradYears) WHERE CAST([value] AS SMALLINT) = ur.class_year
            ))
          ))
      OR (@Audience = 'byPosition'
          AND ur.status IN ('current_player','alumni')
          AND @FilterPositionId IS NOT NULL
          AND ur.position_id = @FilterPositionId)
      OR (@Audience = 'custom'
          AND ur.status IN ('current_player','alumni')
          AND (@FilterPositionId IS NULL OR ur.position_id = @FilterPositionId)
          AND (@FilterGradYear   IS NULL OR ur.class_year  = @FilterGradYear))
    );
END;
GO

-- ============================================================
-- sp_DispatchEmailCampaign
-- Queues outreach_messages for all eligible recipients.
-- outreach_messages now uses user_id (migration 009).
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

  DECLARE @FilterClassYear SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.classYear')  AS SMALLINT);
  DECLARE @FilterGradYear  SMALLINT     = TRY_CAST(JSON_VALUE(@FiltersJson, '$.gradYear')   AS SMALLINT);
  DECLARE @FilterPositionId INT         = TRY_CAST(JSON_VALUE(@FiltersJson, '$.positionId') AS INT);
  DECLARE @FilterGradYears NVARCHAR(MAX)= JSON_QUERY(@FiltersJson, '$.gradYears');

  SELECT
    ur.user_id   AS userId,
    u.email      AS emailAddress,
    u.first_name AS firstName,
    NEWID()      AS unsubToken
  INTO #recipients
  FROM dbo.users_roles ur
  JOIN dbo.users u ON u.user_id = ur.user_id
  WHERE u.email IS NOT NULL
    AND (@SportId IS NULL OR ur.sport_id = @SportId)
    AND NOT EXISTS (
      SELECT 1 FROM dbo.email_unsubscribes eu
      WHERE eu.user_id = ur.user_id AND eu.channel = 'email'
    )
    AND NOT EXISTS (
      SELECT 1 FROM dbo.outreach_messages om
      WHERE om.campaign_id = @CampaignId AND om.user_id = ur.user_id
    )
    AND (
      (@Audience = 'all'         AND ur.status IN ('current_player','alumni'))
      OR (@Audience = 'players_only' AND ur.status = 'current_player')
      OR (@Audience = 'alumni_only'  AND ur.status = 'alumni')
      OR (@Audience = 'byClass'
          AND ur.status = 'current_player'
          AND @FilterClassYear IS NOT NULL
          AND ur.class_year = @FilterClassYear)
      OR (@Audience = 'byGradYear'
          AND ur.status = 'alumni'
          AND (
            (@FilterGradYear IS NOT NULL AND ur.class_year = @FilterGradYear)
            OR (@FilterGradYears IS NOT NULL AND EXISTS (
              SELECT 1 FROM OPENJSON(@FilterGradYears) WHERE CAST([value] AS SMALLINT) = ur.class_year
            ))
          ))
      OR (@Audience = 'byPosition'
          AND ur.status IN ('current_player','alumni')
          AND @FilterPositionId IS NOT NULL
          AND ur.position_id = @FilterPositionId)
      OR (@Audience = 'custom'
          AND ur.status IN ('current_player','alumni')
          AND (@FilterPositionId IS NULL OR ur.position_id = @FilterPositionId)
          AND (@FilterGradYear   IS NULL OR ur.class_year  = @FilterGradYear))
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
  -- JSON array of objects: [{"messageId":"<uuid>","resendId":"re_xxx"},...]
  @MessagesJson NVARCHAR(MAX),
  @ErrorCode    NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  -- Mark each message as sent and store the Resend ID for webhook correlation
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

  -- Auto-complete campaigns that have no queued messages left
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
  -- resend_id is the Resend message ID from the webhook event (data.email_id)
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
-- Records an email unsubscribe. outreach_messages and
-- email_unsubscribes now use user_id (migration 009).
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
-- V2: audience = 'all_sports' | 'sport_specific' only.
-- Alumni posters are validated against their sport in users_roles.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreatePost
  @CreatedBy    INT,
  @BodyHtml     NVARCHAR(MAX),
  @Audience     NVARCHAR(30),
  @Title        NVARCHAR(300)    = NULL,
  @AudienceJson NVARCHAR(MAX)    = NULL,
  @SportId      INT              = NULL,
  @IsPinned     BIT              = 0,
  @AlsoEmail    BIT              = 0,
  @EmailSubject NVARCHAR(500)    = NULL,
  @PosterRole   NVARCHAR(50)     = NULL,   -- JWT global role, used for alumni sport check
  @NewPostId    UNIQUEIDENTIFIER OUTPUT,
  @CampaignId   UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode    NVARCHAR(50)     OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode  = NULL;
  SET @NewPostId  = NULL;
  SET @CampaignId = NULL;

  IF @Audience NOT IN ('all_sports', 'sport_specific')
  BEGIN
    SET @ErrorCode = 'INVALID_AUDIENCE';
    RETURN;
  END

  IF @Audience = 'sport_specific' AND @SportId IS NULL
  BEGIN
    SET @ErrorCode = 'SPORT_REQUIRED_FOR_SPORT_SPECIFIC';
    RETURN;
  END

  -- Alumni may only post to all_sports or their OWN sport
  IF @PosterRole = 'alumni' AND @Audience = 'sport_specific'
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM dbo.users_roles
      WHERE user_id  = @CreatedBy
        AND sport_id = @SportId
        AND status  <> 'removed'
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

  -- When pinning, unpin all other posts first (only one pinned at a time)
  IF @IsPinned = 1
    UPDATE dbo.feed_posts SET is_pinned = 0 WHERE is_pinned = 1;

  SET @NewPostId = NEWID();

  INSERT INTO dbo.feed_posts (
    id, created_by, title, body_html, audience, audience_json,
    sport_id, is_pinned, published_at
  )
  VALUES (
    @NewPostId, @CreatedBy, @Title, @BodyHtml, @Audience, @AudienceJson,
    @SportId, ISNULL(@IsPinned, 0), SYSUTCDATETIME()
  );

  -- Campaign audience: 'all' for all_sports; sport_id restricts recipients for sport_specific
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
      'all', NULL,
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
-- sp_GetFeed  (V2)
-- Audience model: all_sports (everyone) | sport_specific (sport only).
-- @MySport = 1 → filter to viewer's own sport(s) + all_sports.
-- @MySport = 0 → all posts regardless of sport.
-- Includes like count, user_has_liked, updated_at, poster name,
-- sport name. Excludes soft-deleted posts.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetFeed
  @ViewerUserId INT,
  @MySport      BIT  = 0,
  @Page         INT  = 1,
  @PageSize     INT  = 20,
  @TotalCount   INT  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @TotalCount = 0;

  DECLARE @Offset    INT          = (@Page - 1) * @PageSize;
  DECLARE @TierGroup NVARCHAR(20) = NULL;  -- not used in V2; kept for welcome-post compat
  DECLARE @RoleGroup NVARCHAR(20) = NULL;
  IF @Offset < 0 SET @Offset = 0;

  ;WITH visible_posts AS (
    SELECT fp.*
    FROM dbo.feed_posts fp
    WHERE fp.is_deleted = 0
      AND (
        fp.audience = 'all_sports'
        OR (
          fp.audience = 'sport_specific'
          AND (
            @MySport = 0
            OR fp.sport_id IN (
              SELECT sport_id FROM dbo.users_roles
              WHERE user_id = @ViewerUserId AND status <> 'removed'
            )
          )
        )
      )
      -- Welcome posts are filtered to only the matching tier + role group
      AND (
        fp.is_welcome_post = 0
        OR (
          (@TierGroup IS NULL OR fp.tier_group  IS NULL OR fp.tier_group  = @TierGroup)
          AND (@RoleGroup IS NULL OR fp.role_group IS NULL OR fp.role_group = @RoleGroup)
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
        OR (
          fp.audience = 'sport_specific'
          AND (
            @MySport = 0
            OR fp.sport_id IN (
              SELECT sport_id FROM dbo.users_roles
              WHERE user_id = @ViewerUserId AND status <> 'removed'
            )
          )
        )
      )
      -- Welcome posts filtered to matching tier + role group only
      AND (
        fp.is_welcome_post = 0
        OR (
          (@TierGroup IS NULL OR fp.tier_group  IS NULL OR fp.tier_group  = @TierGroup)
          AND (@RoleGroup IS NULL OR fp.role_group IS NULL OR fp.role_group = @RoleGroup)
        )
      )
  )
  SELECT
    vp.id,
    vp.title,
    vp.body_html       AS bodyHtml,
    vp.audience,
    vp.audience_json   AS audienceJson,
    vp.sport_id        AS sportId,
    s.name             AS sportName,
    vp.is_pinned       AS isPinned,
    vp.is_welcome_post AS isWelcomePost,
    vp.image_url       AS imageUrl,
    vp.campaign_id     AS campaignId,
    vp.created_by      AS createdBy,
    CONCAT(u.first_name, ' ', u.last_name) AS createdByName,
    vp.published_at    AS publishedAt,
    vp.created_at      AS createdAt,
    vp.updated_at      AS updatedAt,
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
-- Returns a single post with like count, user_has_liked, updated_at.
-- Audience check uses the new all_sports / sport_specific model.
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
          SELECT sport_id FROM dbo.users_roles
          WHERE user_id = @ViewerUserId AND status <> 'removed'
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
-- Audience model: all_sports counts all active members;
-- sport_specific counts members of that sport only.
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
    SELECT @TotalEligible = COUNT(DISTINCT ur.user_id)
    FROM   dbo.users_roles ur
    WHERE  ur.status IN ('current_player','alumni');
  END
  ELSE
  BEGIN
    SELECT @TotalEligible = COUNT(DISTINCT ur.user_id)
    FROM   dbo.users_roles ur
    WHERE  ur.sport_id = @SportId
      AND  ur.status IN ('current_player','alumni');
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
-- Returns a user's profile (from dbo.users) + all role records
-- (from dbo.users_roles) + recent interaction history.
-- Used by player detail and alumni detail pages.
-- Returns two result sets:
--   [0] One row per users_roles entry (joined to users + sports + position)
--   [1] Up to 20 most-recent interaction_log entries for this user
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

  -- Result set 1: user base row + all role rows (one row per users_roles entry)
  SELECT
    u.user_id          AS userId,
    u.email,
    u.first_name       AS firstName,
    u.last_name        AS lastName,
    u.platform_role    AS platformRole,
    u.last_team_login  AS lastTeamLogin,
    ur.user_role_id    AS userRoleId,
    ur.sport_id        AS sportId,
    s.name             AS sportName,
    s.abbr             AS sportAbbr,
    ur.program_role_id AS programRoleId,
    pr.display_name    AS programRoleDisplay,
    ur.status,
    ur.position_id     AS positionId,
    sp.position_name   AS position,
    ur.jersey_number   AS jerseyNumber,
    ur.seasons_played  AS seasonsPlayed,
    ur.class_year      AS classYear,
    ur.created_at      AS createdAt,
    ur.updated_at      AS updatedAt
  FROM dbo.users u
  LEFT JOIN dbo.users_roles     ur ON ur.user_id      = u.user_id
  LEFT JOIN dbo.sports          s  ON s.id            = ur.sport_id
  LEFT JOIN dbo.program_role    pr ON pr.id           = ur.program_role_id
  LEFT JOIN dbo.sports_position sp ON sp.position_id  = ur.position_id
  WHERE u.user_id = @UserId
  ORDER BY ur.status, s.name;

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
-- Returns ALL sports (active and inactive) for the admin
-- settings panel.  Ordered by id so seeded sports stay stable.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetAllSports
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    id,
    name,
    abbr,
    is_active AS isActive
  FROM dbo.sports
  ORDER BY id;
END;
GO

-- ============================================================
-- sp_SetSportActive
-- Toggles the is_active flag on a single sport row.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SetSportActive
  @SportId  INT,
  @IsActive BIT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.sports
     SET is_active = @IsActive
   WHERE id = @SportId;

  SELECT @@ROWCOUNT AS rowsAffected;
END;
GO

-- ============================================================
-- sp_AddSport
-- Inserts a new sport.  Returns newId + errorCode.
-- errorCode = 'DUPLICATE_ABBR' if abbr already exists.
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
-- Inserts a new position for a sport.
-- errorCode = 'DUPLICATE_ABBR' if abbreviation already exists
-- for that sport.
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
-- Patches a position row.  NULL params = keep existing value.
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
-- Hard-deletes a position.  Positions referenced by users_roles
-- will be NULLed by the FK cascade (ON DELETE SET NULL).
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
-- Toggles a like for a user on a post. Idempotent — second call
-- removes the like.  Returns new like count and liked status.
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
-- Soft-deletes a feed post (is_deleted = 1).
-- @CanDeleteAny = 1 → admin/AD can delete any post.
-- @CanDeleteAny = 0 → only the post owner can delete.
-- Welcome posts cannot be deleted by their owner.
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

  -- Welcome posts can only be deleted by admin (CanDeleteAny)
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
-- Updates a post's body and sets updated_at.
-- Only the post owner can edit. Welcome posts are not editable.
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
-- Pins a post (admin-only action; caller must gate on role).
-- Unpins all other posts first — only one pinned post at a time.
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
-- Returns the sports a user is associated with via users_roles.
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
  FROM dbo.users_roles ur
  JOIN dbo.sports s ON s.id = ur.sport_id
  WHERE ur.user_id  = @UserId
    AND ur.status  <> 'removed'
    AND s.is_active  = 1
  ORDER BY s.name;
END;
GO
