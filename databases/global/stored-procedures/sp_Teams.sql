-- ============================================================
-- GLOBAL DB — TEAMS STORED PROCEDURES
-- Run this file on: DevLegacyLinkGlobal database
-- Run after: 014_tiers_levels_refactor.sql
-- ============================================================

-- ============================================================
-- sp_GetTiers
-- Returns all subscription tiers (for dropdowns / onboarding UI).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetTiers
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, name, display_name AS displayName, sort_order AS sortOrder
  FROM   dbo.tiers
  WHERE  is_active = 1
  ORDER  BY sort_order;
END;
GO

-- ============================================================
-- sp_GetLevels
-- Returns all program levels (for dropdowns / onboarding UI).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetLevels
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, name, display_name AS displayName, sort_order AS sortOrder
  FROM   dbo.levels
  WHERE  is_active = 1
  ORDER  BY sort_order;
END;
GO

-- ============================================================
-- sp_GetTeams
-- Returns all teams with tier and level names resolved via JOIN.
-- Pass @IncludeInactive = 1 to include deactivated teams.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetTeams
  @IncludeInactive BIT = 0
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    t.id,
    t.name,
    t.abbr,
    t.tier_id                 AS tierId,
    tr.name                   AS subscriptionTier,
    tr.display_name           AS tierDisplayName,
    t.level_id                AS levelId,
    lv.name                   AS level,
    lv.display_name           AS levelDisplayName,
    t.app_db                  AS appDb,
    t.db_server               AS dbServer,
    t.is_active               AS isActive,
    t.created_at              AS createdAt,
    t.expires_at              AS expiresAt
  FROM  dbo.teams t
  JOIN  dbo.tiers  tr ON tr.id = t.tier_id
  JOIN  dbo.levels lv ON lv.id = t.level_id
  WHERE @IncludeInactive = 1 OR t.is_active = 1
  ORDER BY t.name;
END;
GO

-- ============================================================
-- sp_GetTeamById
-- Returns a single team by primary key.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetTeamById
  @TeamId    UNIQUEIDENTIFIER,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  SELECT
    t.id,
    t.name,
    t.abbr,
    t.tier_id                 AS tierId,
    tr.name                   AS subscriptionTier,
    tr.display_name           AS tierDisplayName,
    t.level_id                AS levelId,
    lv.name                   AS level,
    lv.display_name           AS levelDisplayName,
    t.app_db                  AS appDb,
    t.db_server               AS dbServer,
    t.is_active               AS isActive,
    t.created_at              AS createdAt,
    t.expires_at              AS expiresAt
  FROM  dbo.teams t
  JOIN  dbo.tiers  tr ON tr.id = t.tier_id
  JOIN  dbo.levels lv ON lv.id = t.level_id
  WHERE t.id = @TeamId;
END;
GO

-- ============================================================
-- sp_CreateTeam
-- Creates a new team record. Enforces unique abbreviation.
-- @TierId  — FK to dbo.tiers  (default 1 = starter)
-- @LevelId — FK to dbo.levels (default 1 = college)
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreateTeam
  @Name      NVARCHAR(100),
  @Abbr      NVARCHAR(10),
  @TierId    INT              = 1,
  @LevelId   INT              = 1,
  @AppDb     NVARCHAR(150),
  @DbServer  NVARCHAR(200)    = 'localhost\SQLEXPRESS',
  @ExpiresAt DATETIME2        = NULL,
  @CreatedBy UNIQUEIDENTIFIER,
  -- Outputs
  @NewTeamId UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode NVARCHAR(50)     OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.tiers WHERE id = @TierId)
  BEGIN
    SET @ErrorCode = 'INVALID_TIER_ID';
    RETURN;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.levels WHERE id = @LevelId)
  BEGIN
    SET @ErrorCode = 'INVALID_LEVEL_ID';
    RETURN;
  END

  IF EXISTS (SELECT 1 FROM dbo.teams WHERE abbr = @Abbr)
  BEGIN
    SET @ErrorCode = 'ABBR_ALREADY_EXISTS';
    RETURN;
  END

  SET @NewTeamId = NEWID();

  INSERT INTO dbo.teams (id, name, abbr, tier_id, level_id, app_db, db_server, expires_at)
  VALUES (@NewTeamId, @Name, @Abbr, @TierId, @LevelId, @AppDb, @DbServer, @ExpiresAt);

  DECLARE @TierName  NVARCHAR(20);
  DECLARE @LevelName NVARCHAR(30);
  SELECT @TierName  = name FROM dbo.tiers  WHERE id = @TierId;
  SELECT @LevelName = name FROM dbo.levels WHERE id = @LevelId;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @CreatedBy, 'team_created', 'team', CAST(@NewTeamId AS NVARCHAR(100)),
    JSON_OBJECT(
      'name':    @Name,
      'abbr':    @Abbr,
      'tierId':  CAST(@TierId  AS NVARCHAR(10)),
      'tier':    @TierName,
      'levelId': CAST(@LevelId AS NVARCHAR(10)),
      'level':   @LevelName
    )
  );
END;
GO

-- ============================================================
-- sp_UpdateTeam
-- Updates team details. NULL params = no change (PATCH semantics).
-- Pass @TierId / @LevelId to change tier or level.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateTeam
  @TeamId    UNIQUEIDENTIFIER,
  @Name      NVARCHAR(100)    = NULL,
  @Abbr      NVARCHAR(10)     = NULL,
  @TierId    INT              = NULL,
  @LevelId   INT              = NULL,
  @AppDb     NVARCHAR(150)    = NULL,
  @DbServer  NVARCHAR(200)    = NULL,
  @IsActive  BIT              = NULL,
  @ExpiresAt DATETIME2        = NULL,
  @ActorId   UNIQUEIDENTIFIER,
  -- Output
  @ErrorCode NVARCHAR(50)     OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  IF @TierId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.tiers WHERE id = @TierId)
  BEGIN
    SET @ErrorCode = 'INVALID_TIER_ID';
    RETURN;
  END

  IF @LevelId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.levels WHERE id = @LevelId)
  BEGIN
    SET @ErrorCode = 'INVALID_LEVEL_ID';
    RETURN;
  END

  DECLARE @Before NVARCHAR(MAX);
  SELECT @Before = JSON_OBJECT(
    'name':    name,
    'abbr':    abbr,
    'tierId':  CAST(tier_id  AS NVARCHAR(10)),
    'levelId': CAST(level_id AS NVARCHAR(10)),
    'isActive': CAST(is_active AS NVARCHAR(5))
  )
  FROM dbo.teams WHERE id = @TeamId;

  UPDATE dbo.teams SET
    name       = COALESCE(@Name,      name),
    abbr       = COALESCE(@Abbr,      abbr),
    tier_id    = COALESCE(@TierId,    tier_id),
    level_id   = COALESCE(@LevelId,   level_id),
    app_db     = COALESCE(@AppDb,     app_db),
    db_server  = COALESCE(@DbServer,  db_server),
    is_active  = COALESCE(@IsActive,  is_active),
    expires_at = COALESCE(@ExpiresAt, expires_at)
  WHERE id = @TeamId;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @ActorId, 'team_updated', 'team', CAST(@TeamId AS NVARCHAR(100)),
    JSON_OBJECT('before': @Before)
  );
END;
GO
