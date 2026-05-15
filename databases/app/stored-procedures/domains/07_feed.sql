SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: News Feed
-- Procedures: sp_CreatePost, sp_GetFeed, sp_GetFeedPost,
--             sp_MarkPostRead, sp_GetPostReadStats,
--             sp_TogglePostLike, sp_SoftDeletePost, sp_EditPost,
--             sp_PinPost, sp_GetUserSportAssociations
-- Run on: each tenant AppDB
-- ============================================================

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
