-- ============================================================
-- Migration 037: Apply preferred team on login
--
-- sp_Login fetched @PreferredTeamId but never used it — the
-- alphabetical-first team was always written into the JWT.
-- This update overrides @CurrentTeamId with @PreferredTeamId
-- (and re-fetches appDb) so users actually land on the team
-- they starred on their profile page.
--
-- Run on: LegacyLinkGlobal
-- Run after: 036_preview_sessions.sql
-- ============================================================

CREATE OR ALTER PROCEDURE dbo.sp_Login
  @Email       NVARCHAR(255),
  @IpAddress   NVARCHAR(50)   = NULL,
  @DeviceInfo  NVARCHAR(255)  = NULL,
  -- Outputs
  @UserId       BIGINT           OUTPUT,
  @PasswordHash NVARCHAR(255)    OUTPUT,
  @UserJson     NVARCHAR(MAX)    OUTPUT,
  @ErrorCode    NVARCHAR(50)     OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  SELECT
    @UserId       = u.user_id,
    @PasswordHash = u.password_hash
  FROM dbo.users u
  WHERE u.email = @Email;

  IF @UserId IS NULL
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'ACCOUNT_INACTIVE';
    RETURN;
  END

  DECLARE @RoleId   INT;
  DECLARE @RoleName NVARCHAR(50);

  SELECT @RoleId = u.role_id, @RoleName = r.role_name
  FROM   dbo.users u
  JOIN   dbo.roles r ON r.id = u.role_id
  WHERE  u.user_id = @UserId;

  DECLARE @TeamsJson NVARCHAR(MAX);

  IF @RoleId = 1  -- platform_owner: all active teams
  BEGIN
    SELECT @TeamsJson = (
      SELECT
        t.id               AS teamId,
        t.abbr,
        t.name,
        @RoleName          AS role,
        tc.logo_url        AS logoUrl,
        ISNULL(tc.color_primary, '#1B1B2F') AS colorPrimary,
        ISNULL(tc.color_accent,  '#B8973D') AS colorAccent
      FROM dbo.teams t
      LEFT JOIN dbo.team_config tc ON tc.team_id = t.id
      WHERE t.is_active = 1
      ORDER BY t.name
      FOR JSON PATH
    );
  END
  ELSE
  BEGIN
    SELECT @TeamsJson = (
      SELECT
        t.id        AS teamId,
        t.abbr,
        t.name,
        @RoleName   AS role,
        tc.logo_url AS logoUrl,
        ISNULL(tc.color_primary, '#1B1B2F') AS colorPrimary,
        ISNULL(tc.color_accent,  '#B8973D') AS colorAccent
      FROM dbo.user_teams ut
      JOIN  dbo.teams t        ON t.id      = ut.team_id
      LEFT JOIN dbo.team_config tc ON tc.team_id = t.id
      WHERE ut.user_id   = @UserId
        AND ut.is_active = 1
      ORDER BY t.name
      FOR JSON PATH
    );
  END

  IF @TeamsJson IS NULL SET @TeamsJson = '[]';

  DECLARE @CurrentTeamId INT;
  DECLARE @AppDb         NVARCHAR(100) = '';

  IF @RoleId = 1
  BEGIN
    SELECT TOP 1
      @CurrentTeamId = t.id,
      @AppDb         = t.app_db
    FROM dbo.teams t
    WHERE t.is_active = 1
    ORDER BY t.name;
  END
  ELSE
  BEGIN
    SELECT TOP 1
      @CurrentTeamId = t.id,
      @AppDb         = t.app_db
    FROM dbo.user_teams ut
    JOIN dbo.teams t ON t.id = ut.team_id
    WHERE ut.user_id   = @UserId
      AND ut.is_active = 1
    ORDER BY t.name;
  END

  DECLARE @PreferredTeamId INT = NULL;

  IF @RoleId = 1
  BEGIN
    SELECT @PreferredTeamId = utp.preferred_team_id
    FROM dbo.user_team_preferences utp
    JOIN dbo.teams t ON t.id = utp.preferred_team_id
    WHERE utp.user_id = @UserId
      AND t.is_active = 1;
  END
  ELSE
  BEGIN
    SELECT @PreferredTeamId = utp.preferred_team_id
    FROM dbo.user_team_preferences utp
    JOIN dbo.user_teams ut ON ut.user_id = utp.user_id AND ut.team_id = utp.preferred_team_id
    JOIN dbo.teams t       ON t.id = utp.preferred_team_id
    WHERE utp.user_id  = @UserId
      AND ut.is_active  = 1
      AND t.is_active   = 1;
  END

  -- Apply preferred team: override the alphabetical default when user has set one
  IF @PreferredTeamId IS NOT NULL
  BEGIN
    SET @CurrentTeamId = @PreferredTeamId;
    SELECT @AppDb = t.app_db FROM dbo.teams t WHERE t.id = @PreferredTeamId AND t.is_active = 1;
  END

  DECLARE @TierId   INT        = NULL;
  DECLARE @TierName NVARCHAR(50) = N'starter';

  IF @CurrentTeamId IS NOT NULL
  BEGIN
    SELECT @TierId = t.tier_id, @TierName = tr.name
    FROM   dbo.teams t
    JOIN   dbo.tiers tr ON tr.id = t.tier_id
    WHERE  t.id = @CurrentTeamId;
  END

  SELECT @UserJson = (
    SELECT
      u.user_id                             AS userId,
      u.email,
      u.first_name                          AS firstName,
      u.last_name                           AS lastName,
      u.role_id                             AS roleId,
      r.role_name                           AS role,
      u.is_active                           AS isActive,
      u.account_claimed                     AS accountClaimed,
      u.created_at                          AS createdAt,
      @CurrentTeamId                        AS currentTeamId,
      @PreferredTeamId                      AS preferredTeamId,
      @AppDb                                AS appDb,
      @TierId                               AS tierId,
      @TierName                             AS tierName,
      (SELECT level_id FROM dbo.teams WHERE id = @CurrentTeamId) AS levelId,
      JSON_QUERY(@TeamsJson)                AS teams,
      (
        SELECT
          ap.app_name   AS app,
          ap.role,
          ap.granted_at AS grantedAt,
          ap.granted_by AS grantedBy
        FROM dbo.app_permissions ap
        WHERE ap.user_id   = u.user_id
          AND ap.revoked_at IS NULL
        FOR JSON PATH
      ) AS appPermissions
    FROM dbo.users u
    JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.user_id = @UserId
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
  );

  UPDATE dbo.users
  SET last_login_at   = SYSUTCDATETIME(),
      account_claimed = 1,
      claimed_date    = CASE WHEN account_claimed = 0 THEN SYSUTCDATETIME() ELSE claimed_date END
  WHERE user_id = @UserId;

  INSERT INTO dbo.audit_log (actor_id, actor_email, action, target_type, target_id, ip_address, payload)
  VALUES (
    @UserId, @Email, 'login', 'user', CAST(@UserId AS NVARCHAR(20)), @IpAddress,
    JSON_OBJECT('device': ISNULL(@DeviceInfo, ''))
  );
END;
GO
