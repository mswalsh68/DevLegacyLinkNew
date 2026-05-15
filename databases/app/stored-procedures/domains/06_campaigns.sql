SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: Email Campaigns & Outreach
-- Procedures: sp_CreateCampaign, sp_GetCampaigns, sp_GetCampaignDetail,
--             sp_CancelCampaign, sp_ResolveAudienceForCampaign,
--             sp_DispatchEmailCampaign, sp_MarkEmailSent,
--             sp_MarkEmailOpened, sp_ProcessUnsubscribe
-- Run on: each tenant AppDB
-- ============================================================

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
