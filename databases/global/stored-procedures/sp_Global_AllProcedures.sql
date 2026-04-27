-- ============================================================
-- GLOBAL DB — ALL STORED PROCEDURES
-- Run this file on: LegacyLinkGlobal database
-- Requires: HASHBYTES support (Azure SQL — built in)
-- Run after: 018_roles_table.sql
-- ============================================================
-- Migration 018 changes reflected here:
--   • All platform_owner checks use role_id = 1 instead of global_role = 'platform_owner'
--   • UserJson now emits roleId (INT) + role (role_name string) from dbo.roles
--   • sp_CreateUser accepts @RoleId INT instead of @GlobalRole NVARCHAR
--   • sp_UpdateUser accepts @RoleId INT instead of @GlobalRole NVARCHAR
--   • sp_GetUsers filters by @RoleId INT instead of @GlobalRole NVARCHAR
--   • sp_GetOrCreateUser inserts role_id = 6 (player)
--   • DUAL-WRITE: global_role string is kept in sync until migration 019 drops it
-- ============================================================

-- ============================================================
-- sp_Login
-- Validates credentials; returns user + teams array + app
-- permissions as JSON. The API bcrypt-compares the password,
-- signs the JWT from the returned JSON. No cred logic in code.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_Login
  @Email       NVARCHAR(255),
  @IpAddress   NVARCHAR(50)   = NULL,
  @DeviceInfo  NVARCHAR(255)  = NULL,
  -- Outputs
  @UserId       UNIQUEIDENTIFIER OUTPUT,
  @PasswordHash NVARCHAR(255)    OUTPUT,
  @UserJson     NVARCHAR(MAX)    OUTPUT,  -- full user + teams + permissions payload
  @ErrorCode    NVARCHAR(50)     OUTPUT   -- NULL = success
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  -- Fetch user
  SELECT
    @UserId       = u.id,
    @PasswordHash = u.password_hash
  FROM dbo.users u
  WHERE u.email = @Email;

  IF @UserId IS NULL
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  -- Check account is active
  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @UserId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'ACCOUNT_INACTIVE';
    RETURN;
  END

  -- Resolve role from normalized table
  DECLARE @RoleId   INT;
  DECLARE @RoleName NVARCHAR(50);

  SELECT @RoleId = u.role_id, @RoleName = r.role_name
  FROM   dbo.users u
  JOIN   dbo.roles r ON r.id = u.role_id
  WHERE  u.id = @UserId;

  -- Build teams JSON:
  --   platform_owner (role_id = 1)  -> all active teams
  --   everyone else                 -> their user_teams rows
  DECLARE @TeamsJson NVARCHAR(MAX);

  IF @RoleId = 1  -- platform_owner
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
      WHERE ut.user_id  = @UserId
        AND ut.is_active = 1
      ORDER BY t.name
      FOR JSON PATH
    );
  END

  IF @TeamsJson IS NULL SET @TeamsJson = '[]';

  -- Resolve current team (first alphabetically)
  DECLARE @CurrentTeamId INT;
  DECLARE @AppDb         NVARCHAR(100) = '';
  DECLARE @DbServer      NVARCHAR(200) = '';

  IF @RoleId = 1  -- platform_owner
  BEGIN
    SELECT TOP 1
      @CurrentTeamId = t.id,
      @AppDb         = t.app_db,
      @DbServer      = t.db_server
    FROM dbo.teams t
    WHERE t.is_active = 1
    ORDER BY t.name;
  END
  ELSE
  BEGIN
    SELECT TOP 1
      @CurrentTeamId = t.id,
      @AppDb         = t.app_db,
      @DbServer      = t.db_server
    FROM dbo.user_teams ut
    JOIN dbo.teams t ON t.id = ut.team_id
    WHERE ut.user_id  = @UserId
      AND ut.is_active = 1
    ORDER BY t.name;
  END

  -- Resolve preferred team (NULL if not set or team no longer accessible)
  DECLARE @PreferredTeamId INT = NULL;

  IF @RoleId = 1  -- platform_owner
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
    WHERE utp.user_id   = @UserId
      AND ut.is_active   = 1
      AND t.is_active    = 1;
  END

  -- Build full payload JSON
  SELECT @UserJson = (
    SELECT
      u.id,
      u.user_id                             AS userIntId,
      u.email,
      u.first_name                          AS firstName,
      u.last_name                           AS lastName,
      u.role_id                             AS roleId,
      r.role_name                           AS role,
      u.is_active                           AS isActive,
      u.account_claimed                     AS accountClaimed,
      u.created_at                          AS createdAt,
      @CurrentTeamId AS currentTeamId,
      @PreferredTeamId                      AS preferredTeamId,
      @AppDb                                AS appDb,
      @DbServer                             AS dbServer,
      JSON_QUERY(@TeamsJson)                AS teams,
      (
        SELECT
          ap.app_name   AS app,
          ap.role,
          ap.granted_at AS grantedAt,
          ap.granted_by AS grantedBy
        FROM dbo.app_permissions ap
        WHERE ap.user_id   = u.id
          AND ap.revoked_at IS NULL
        FOR JSON PATH
      ) AS appPermissions
    FROM dbo.users u
    JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.id = @UserId
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
  );

  -- Update last login; claim account on first login
  UPDATE dbo.users
  SET last_login_at   = SYSUTCDATETIME(),
      account_claimed = 1,
      claimed_date    = CASE WHEN account_claimed = 0 THEN SYSUTCDATETIME() ELSE claimed_date END
  WHERE id = @UserId;

  INSERT INTO dbo.audit_log (actor_id, actor_email, action, target_type, target_id, ip_address, payload)
  SELECT @UserId, @Email, 'login', 'user', CAST(@UserId AS NVARCHAR(100)), @IpAddress,
    JSON_OBJECT('device': ISNULL(@DeviceInfo, ''));
END;
GO

-- ============================================================
-- sp_StoreRefreshToken
-- Stores a hashed refresh token after successful login.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_StoreRefreshToken
  @UserId     UNIQUEIDENTIFIER,
  @TokenHash  NVARCHAR(255),
  @ExpiresAt  DATETIME2,
  @DeviceInfo NVARCHAR(255) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO dbo.refresh_tokens (user_id, token_hash, expires_at, device_info)
  VALUES (@UserId, @TokenHash, @ExpiresAt, @DeviceInfo);
END;
GO

-- ============================================================
-- sp_RefreshToken
-- Validates an existing refresh token, revokes it, issues a
-- new one. Returns fresh user payload including teams array.
-- Entire rotation is atomic — no partial state possible.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken
  @OldTokenHash  NVARCHAR(255),
  @NewTokenHash  NVARCHAR(255),
  @NewExpiresAt  DATETIME2,
  @CurrentTeamId INT = NULL,   -- client's active team; used to pin DB routing
  -- Outputs
  @UserJson      NVARCHAR(MAX) OUTPUT,
  @ErrorCode     NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  SET @ErrorCode = NULL;

  DECLARE @UserId UNIQUEIDENTIFIER;

  BEGIN TRANSACTION;

    SELECT @UserId = user_id
    FROM dbo.refresh_tokens
    WHERE token_hash  = @OldTokenHash
      AND revoked_at  IS NULL
      AND expires_at  > SYSUTCDATETIME();

    IF @UserId IS NULL
    BEGIN
      ROLLBACK TRANSACTION;
      SET @ErrorCode = 'TOKEN_INVALID_OR_EXPIRED';
      RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @UserId AND is_active = 1)
    BEGIN
      ROLLBACK TRANSACTION;
      SET @ErrorCode = 'ACCOUNT_INACTIVE';
      RETURN;
    END

    UPDATE dbo.refresh_tokens
    SET revoked_at = SYSUTCDATETIME()
    WHERE token_hash = @OldTokenHash;

    INSERT INTO dbo.refresh_tokens (user_id, token_hash, expires_at)
    VALUES (@UserId, @NewTokenHash, @NewExpiresAt);

  COMMIT TRANSACTION;

  -- Build fresh user payload (same structure as sp_Login)
  DECLARE @RoleId   INT;
  DECLARE @RoleName NVARCHAR(50);

  SELECT @RoleId = u.role_id, @RoleName = r.role_name
  FROM   dbo.users u
  JOIN   dbo.roles r ON r.id = u.role_id
  WHERE  u.id = @UserId;

  DECLARE @TeamsJson NVARCHAR(MAX);

  IF @RoleId = 1  -- platform_owner
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
      WHERE ut.user_id  = @UserId
        AND ut.is_active = 1
      ORDER BY t.name
      FOR JSON PATH
    );
  END

  IF @TeamsJson IS NULL SET @TeamsJson = '[]';

  DECLARE @ResolvedTeamId INT;
  DECLARE @AppDb          NVARCHAR(100) = '';
  DECLARE @DbServer       NVARCHAR(200) = '';

  -- Try to pin to the client's requested team.
  -- platform_owner can hold any active team; others must have a live user_teams row.
  IF @CurrentTeamId IS NOT NULL
  BEGIN
    IF @RoleId = 1  -- platform_owner
    BEGIN
      SELECT
        @ResolvedTeamId = t.id,
        @AppDb          = t.app_db,
        @DbServer       = t.db_server
      FROM dbo.teams t
      WHERE t.id        = @CurrentTeamId
        AND t.is_active = 1;
    END
    ELSE
    BEGIN
      SELECT
        @ResolvedTeamId = t.id,
        @AppDb          = t.app_db,
        @DbServer       = t.db_server
      FROM dbo.user_teams ut
      JOIN dbo.teams t ON t.id = ut.team_id
      WHERE ut.user_id  = @UserId
        AND ut.team_id  = @CurrentTeamId
        AND ut.is_active = 1
        AND t.is_active  = 1;
    END
  END

  -- Fall back to first-alphabetical accessible team if requested team was
  -- not found, not provided, or user lost access since the token was issued.
  IF @ResolvedTeamId IS NULL
  BEGIN
    IF @RoleId = 1  -- platform_owner
    BEGIN
      SELECT TOP 1
        @ResolvedTeamId = t.id,
        @AppDb          = t.app_db,
        @DbServer       = t.db_server
      FROM dbo.teams t
      WHERE t.is_active = 1
      ORDER BY t.name;
    END
    ELSE
    BEGIN
      SELECT TOP 1
        @ResolvedTeamId = t.id,
        @AppDb          = t.app_db,
        @DbServer       = t.db_server
      FROM dbo.user_teams ut
      JOIN dbo.teams t ON t.id = ut.team_id
      WHERE ut.user_id  = @UserId
        AND ut.is_active = 1
        AND t.is_active  = 1
      ORDER BY t.name;
    END
  END

  -- Resolve preferred team (same logic as sp_Login)
  DECLARE @PreferredTeamId INT = NULL;

  IF @RoleId = 1  -- platform_owner
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
    WHERE utp.user_id   = @UserId
      AND ut.is_active   = 1
      AND t.is_active    = 1;
  END

  SELECT @UserJson = (
    SELECT
      u.id,
      u.user_id                                AS userIntId,
      u.email,
      u.first_name                             AS firstName,
      u.last_name                              AS lastName,
      u.role_id                                AS roleId,
      r.role_name                              AS role,
      u.is_active                              AS isActive,
      u.account_claimed                        AS accountClaimed,
      u.token_version                          AS tokenVersion,
      @ResolvedTeamId AS currentTeamId,
      @PreferredTeamId                         AS preferredTeamId,
      @AppDb                                   AS appDb,
      @DbServer                                AS dbServer,
      JSON_QUERY(@TeamsJson)                   AS teams,
      (
        SELECT ap.app_name AS app, ap.role, ap.granted_at AS grantedAt, ap.granted_by AS grantedBy
        FROM dbo.app_permissions ap
        WHERE ap.user_id = u.id AND ap.revoked_at IS NULL
        FOR JSON PATH
      ) AS appPermissions
    FROM dbo.users u
    JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.id = @UserId
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
  );
END;
GO

-- ============================================================
-- sp_Logout
-- Revokes a refresh token by its hash.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_Logout
  @TokenHash NVARCHAR(255)
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.refresh_tokens
  SET revoked_at = SYSUTCDATETIME()
  WHERE token_hash = @TokenHash
    AND revoked_at IS NULL;
END;
GO

-- ============================================================
-- sp_SwitchTeam
-- Validates a user can access @NewTeamId, returns team details
-- so the API can re-issue the JWT with updated currentTeamId.
-- platform_owner (role_id = 1) bypasses the user_teams check.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SwitchTeam
  @UserId    UNIQUEIDENTIFIER,
  @NewTeamId INT,
  -- Outputs
  @TeamJson  NVARCHAR(MAX) OUTPUT,
  @ErrorCode NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @TeamJson  = NULL;

  -- Does the target team exist and is it active?
  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @NewTeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  -- Validate access (platform_owner bypasses user_teams check)
  DECLARE @RoleId INT;
  SELECT @RoleId = role_id FROM dbo.users WHERE id = @UserId;

  IF @RoleId <> 1  -- not platform_owner
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM dbo.user_teams
      WHERE user_id  = @UserId
        AND team_id  = @NewTeamId
        AND is_active = 1
    )
    BEGIN
      SET @ErrorCode = 'ACCESS_DENIED';
      RETURN;
    END
  END

  -- Return team details for JWT re-issue + ThemeProvider refresh
  SELECT @TeamJson = (
    SELECT
      t.id        AS teamId,
      t.name,
      t.abbr,
      t.app_db AS appDb,
      t.db_server AS dbServer,
      tc.logo_url            AS logoUrl,
      tc.color_primary       AS colorPrimary,
      tc.color_primary_dark  AS colorPrimaryDark,
      tc.color_primary_light AS colorPrimaryLight,
      tc.color_accent        AS colorAccent,
      tc.color_accent_dark   AS colorAccentDark,
      tc.color_accent_light  AS colorAccentLight,
      tc.positions_json      AS positionsJson,
      tc.academic_years_json AS academicYearsJson,
      tc.alumni_label        AS alumniLabel,
      tc.roster_label        AS rosterLabel,
      tc.class_label         AS classLabel
    FROM dbo.teams t
    LEFT JOIN dbo.team_config tc ON tc.team_id = t.id
    WHERE t.id = @NewTeamId
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
  );

  -- Audit the switch
  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @UserId, 'team_switch', 'team', CAST(@NewTeamId AS NVARCHAR(20)),
    JSON_OBJECT('isPlatformOwner': CASE WHEN @RoleId = 1 THEN 'true' ELSE 'false' END)
  );
END;
GO

-- ============================================================
-- sp_GetUserTeams
-- Returns all teams a user has access to.
-- platform_owner (role_id = 1) gets all active teams.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserTeams
  @UserId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @RoleId   INT;
  DECLARE @RoleName NVARCHAR(50);

  SELECT @RoleId = u.role_id, @RoleName = r.role_name
  FROM   dbo.users u
  JOIN   dbo.roles r ON r.id = u.role_id
  WHERE  u.id = @UserId;

  IF @RoleId = 1  -- platform_owner
  BEGIN
    SELECT
      t.id        AS teamId,
      t.abbr,
      t.name,
      t.is_active AS isActive,
      @RoleName   AS role,
      tc.logo_url AS logoUrl,
      ISNULL(tc.color_primary, '#1B1B2F') AS colorPrimary,
      ISNULL(tc.color_accent,  '#B8973D') AS colorAccent
    FROM dbo.teams t
    LEFT JOIN dbo.team_config tc ON tc.team_id = t.id
    WHERE t.is_active = 1
    ORDER BY t.name;
  END
  ELSE
  BEGIN
    SELECT
      t.id        AS teamId,
      t.abbr,
      t.name,
      t.is_active AS isActive,
      @RoleName   AS role,
      tc.logo_url AS logoUrl,
      ISNULL(tc.color_primary, '#1B1B2F') AS colorPrimary,
      ISNULL(tc.color_accent,  '#B8973D') AS colorAccent
    FROM dbo.user_teams ut
    JOIN  dbo.teams t        ON t.id      = ut.team_id
    LEFT JOIN dbo.team_config tc ON tc.team_id = t.id
    WHERE ut.user_id  = @UserId
      AND ut.is_active = 1
    ORDER BY t.name;
  END
END;
GO

-- ============================================================
-- sp_CreateUser
-- Creates a user and optionally links them to a team.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreateUser
  @Email         NVARCHAR(255),
  @PasswordHash  NVARCHAR(255),
  @FirstName     NVARCHAR(100),
  @LastName      NVARCHAR(100),
  @RoleId        INT,                         -- FK → dbo.roles.id
  @CreatedBy     UNIQUEIDENTIFIER,
  @TeamId        INT = NULL,
  -- Optional: immediately grant access to an app
  @GrantAppName  NVARCHAR(50)  = NULL,
  @GrantAppRole  NVARCHAR(50)  = NULL,
  -- Output
  @NewUserId     UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode     NVARCHAR(50)      OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  SET @ErrorCode = NULL;

  -- Validate the role exists
  DECLARE @RoleName NVARCHAR(50);
  SELECT @RoleName = role_name FROM dbo.roles WHERE id = @RoleId;

  IF @RoleName IS NULL
  BEGIN
    SET @ErrorCode = 'INVALID_ROLE';
    RETURN;
  END

  IF EXISTS (SELECT 1 FROM dbo.users WHERE email = @Email)
  BEGIN
    SET @ErrorCode = 'EMAIL_ALREADY_EXISTS';
    RETURN;
  END

  IF @TeamId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  BEGIN TRANSACTION;

    SET @NewUserId = NEWID();

    INSERT INTO dbo.users (id, email, password_hash, first_name, last_name, role_id)
    VALUES (@NewUserId, @Email, @PasswordHash, @FirstName, @LastName, @RoleId);

    IF @TeamId IS NOT NULL
    BEGIN
      INSERT INTO dbo.user_teams (user_id, team_id)
      VALUES (@NewUserId, @TeamId);
    END

    IF @GrantAppName IS NOT NULL AND @GrantAppRole IS NOT NULL
    BEGIN
      INSERT INTO dbo.app_permissions (user_id, app_name, role, granted_by)
      VALUES (@NewUserId, @GrantAppName, @GrantAppRole, @CreatedBy);
    END

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
    VALUES (
      @CreatedBy, 'user_created', 'user', CAST(@NewUserId AS NVARCHAR(100)),
      JSON_OBJECT(
        'email':      @Email,
        'roleId':     CAST(@RoleId AS NVARCHAR),
        'roleName':   @RoleName,
        'teamId':     ISNULL(CAST(@TeamId AS NVARCHAR(20)), ''),
        'grantedApp': ISNULL(@GrantAppName, ''),
        'grantedRole':ISNULL(@GrantAppRole, '')
      )
    );

  COMMIT TRANSACTION;
END;
GO

-- ============================================================
-- sp_UpdateUser
-- Updates role and/or active status. App Admin or higher only
-- (enforced in the API layer).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateUser
  @TargetUserId  UNIQUEIDENTIFIER,
  @RoleId        INT           = NULL,        -- FK → dbo.roles.id; NULL = no change
  @IsActive      BIT           = NULL,
  @ActorId       UNIQUEIDENTIFIER,
  @ErrorCode     NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @TargetUserId)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  -- Validate role if being changed
  DECLARE @RoleName NVARCHAR(50) = NULL;

  IF @RoleId IS NOT NULL
  BEGIN
    SELECT @RoleName = role_name FROM dbo.roles WHERE id = @RoleId;
    IF @RoleName IS NULL
    BEGIN
      SET @ErrorCode = 'INVALID_ROLE';
      RETURN;
    END
  END

  DECLARE @Before NVARCHAR(MAX);
  SELECT @Before = JSON_OBJECT(
    'roleId':   CAST(role_id AS NVARCHAR),
    'isActive': CAST(is_active AS NVARCHAR)
  )
  FROM dbo.users WHERE id = @TargetUserId;

  UPDATE dbo.users SET
    role_id    = COALESCE(@RoleId,   role_id),
    is_active  = COALESCE(@IsActive, is_active),
    updated_at = SYSUTCDATETIME()
  WHERE id = @TargetUserId;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @ActorId, 'user_updated', 'user', CAST(@TargetUserId AS NVARCHAR(100)),
    JSON_OBJECT(
      'before':     @Before,
      'newRoleId':  ISNULL(CAST(@RoleId AS NVARCHAR), ''),
      'newRoleName':ISNULL(@RoleName, ''),
      'newActive':  ISNULL(CAST(@IsActive AS NVARCHAR), '')
    )
  );
END;
GO

-- ============================================================
-- sp_GrantPermission
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GrantPermission
  @UserId    UNIQUEIDENTIFIER,
  @AppName   NVARCHAR(50),
  @Role      NVARCHAR(50),
  @GrantedBy UNIQUEIDENTIFIER,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  SET @ErrorCode = NULL;

  IF @AppName NOT IN ('roster','alumni','global-admin')
  BEGIN
    SET @ErrorCode = 'INVALID_APP';
    RETURN;
  END

  IF @Role NOT IN ('global_admin','app_admin','coach_staff','player','readonly')
  BEGIN
    SET @ErrorCode = 'INVALID_ROLE';
    RETURN;
  END

  BEGIN TRANSACTION;

    UPDATE dbo.app_permissions
    SET revoked_at = SYSUTCDATETIME()
    WHERE user_id  = @UserId
      AND app_name = @AppName
      AND revoked_at IS NULL;

    INSERT INTO dbo.app_permissions (user_id, app_name, role, granted_by)
    VALUES (@UserId, @AppName, @Role, @GrantedBy);

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
    VALUES (
      @GrantedBy, 'permission_granted', 'user', CAST(@UserId AS NVARCHAR(100)),
      JSON_OBJECT('app': @AppName, 'role': @Role)
    );

  COMMIT TRANSACTION;
END;
GO

-- ============================================================
-- sp_RevokePermission
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_RevokePermission
  @UserId    UNIQUEIDENTIFIER,
  @AppName   NVARCHAR(50),
  @RevokedBy UNIQUEIDENTIFIER,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (
    SELECT 1 FROM dbo.app_permissions
    WHERE user_id = @UserId AND app_name = @AppName AND revoked_at IS NULL
  )
  BEGIN
    SET @ErrorCode = 'PERMISSION_NOT_FOUND';
    RETURN;
  END

  UPDATE dbo.app_permissions
  SET revoked_at = SYSUTCDATETIME()
  WHERE user_id  = @UserId
    AND app_name = @AppName
    AND revoked_at IS NULL;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @RevokedBy, 'permission_revoked', 'user', CAST(@UserId AS NVARCHAR(100)),
    JSON_OBJECT('app': @AppName)
  );
END;
GO

-- ============================================================
-- sp_TransferPlayerToAlumni
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_TransferPlayerToAlumni
  @UserId    UNIQUEIDENTIFIER,
  @GrantedBy NVARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @GrantedByGuid UNIQUEIDENTIFIER = TRY_CAST(@GrantedBy AS UNIQUEIDENTIFIER);

  UPDATE dbo.app_permissions
  SET revoked_at = SYSUTCDATETIME()
  WHERE user_id  = @UserId
    AND app_name = 'roster'
    AND revoked_at IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM dbo.app_permissions
    WHERE user_id = @UserId AND app_name = 'alumni' AND revoked_at IS NULL
  )
  BEGIN
    INSERT INTO dbo.app_permissions (user_id, app_name, role, granted_by)
    VALUES (@UserId, 'alumni', 'readonly', @GrantedByGuid);
  END

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @GrantedByGuid, 'player_graduated_to_alumni', 'user', CAST(@UserId AS NVARCHAR(100)),
    JSON_OBJECT('rosterRevoked': 'true', 'alumniGranted': 'true')
  );
END;
GO

-- ============================================================
-- sp_GetUsers
-- Returns paginated user list with role info from dbo.roles.
-- @RoleId INT = NULL filters to a specific role; NULL = all.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUsers
  @Search     NVARCHAR(255) = NULL,
  @RoleId     INT           = NULL,   -- FK → dbo.roles.id; NULL = all roles
  @Page       INT           = 1,
  @PageSize   INT           = 50,
  @TotalCount INT           OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Offset INT = (@Page - 1) * @PageSize;
  DECLARE @SearchWild NVARCHAR(257) = '%' + ISNULL(@Search, '') + '%';

  SELECT @TotalCount = COUNT(*)
  FROM dbo.users u
  WHERE (@Search IS NULL OR u.email LIKE @SearchWild OR u.first_name LIKE @SearchWild OR u.last_name LIKE @SearchWild)
    AND (@RoleId IS NULL OR u.role_id = @RoleId);

  SELECT
    u.id,
    u.email,
    u.first_name    AS firstName,
    u.last_name     AS lastName,
    u.role_id       AS roleId,
    r.role_name     AS role,
    u.is_active     AS isActive,
    u.last_login_at AS lastLoginAt,
    u.created_at    AS createdAt,
    (
      SELECT COUNT(*) FROM dbo.app_permissions ap
      WHERE ap.user_id = u.id AND ap.revoked_at IS NULL
    ) AS activePermissionCount
  FROM dbo.users u
  JOIN dbo.roles r ON r.id = u.role_id
  WHERE (@Search IS NULL OR u.email LIKE @SearchWild OR u.first_name LIKE @SearchWild OR u.last_name LIKE @SearchWild)
    AND (@RoleId IS NULL OR u.role_id = @RoleId)
  ORDER BY u.last_name, u.first_name
  OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO

-- ============================================================
-- sp_GetUserPermissions
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserPermissions
  @UserId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    ap.id,
    ap.app_name      AS appName,
    ap.role,
    ap.granted_at    AS grantedAt,
    ap.revoked_at    AS revokedAt,
    gb.email         AS grantedByEmail,
    CASE WHEN ap.revoked_at IS NULL THEN 1 ELSE 0 END AS isActive
  FROM dbo.app_permissions ap
  JOIN dbo.users gb ON gb.id = ap.granted_by
  WHERE ap.user_id = @UserId
  ORDER BY ap.granted_at DESC;
END;
GO

-- ============================================================
-- sp_CreateInviteToken
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreateInviteToken
  @UserId    UNIQUEIDENTIFIER,
  @TokenHash VARCHAR(128),
  @ExpiresAt DATETIME2
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.invite_tokens
  SET    used_at = SYSUTCDATETIME()
  WHERE  user_id = @UserId AND used_at IS NULL;

  INSERT INTO dbo.invite_tokens (user_id, token_hash, expires_at)
  VALUES (@UserId, @TokenHash, @ExpiresAt);
END;
GO

-- ============================================================
-- sp_ValidateInviteToken
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_ValidateInviteToken
  @TokenHash VARCHAR(128)
AS
BEGIN
  SET NOCOUNT ON;

  SELECT u.first_name AS firstName, u.last_name AS lastName, u.email
  FROM   dbo.invite_tokens it
  JOIN   dbo.users u ON u.id = it.user_id
  WHERE  it.token_hash = @TokenHash
    AND  it.used_at    IS NULL
    AND  it.expires_at  > SYSUTCDATETIME();
END;
GO

-- ============================================================
-- sp_RedeemInviteToken
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_RedeemInviteToken
  @TokenHash    VARCHAR(128),
  @PasswordHash VARCHAR(255),
  @ErrorCode    NVARCHAR(50)  OUTPUT,
  @UserId       UNIQUEIDENTIFIER OUTPUT,
  @Email        NVARCHAR(255) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;
  SET @Email     = NULL;

  SELECT @UserId = it.user_id
  FROM   dbo.invite_tokens it
  WHERE  it.token_hash = @TokenHash
    AND  it.used_at    IS NULL
    AND  it.expires_at  > SYSUTCDATETIME();

  IF @UserId IS NULL
  BEGIN
    SET @ErrorCode = 'INVALID_OR_EXPIRED';
    RETURN;
  END

  SELECT @Email = email FROM dbo.users WHERE id = @UserId;

  BEGIN TRANSACTION;
  BEGIN TRY
    UPDATE dbo.users
    SET    password_hash = @PasswordHash,
           is_active     = 1
    WHERE  id = @UserId;

    UPDATE dbo.invite_tokens
    SET    used_at = SYSUTCDATETIME()
    WHERE  token_hash = @TokenHash;

    COMMIT TRANSACTION;
  END TRY
  BEGIN CATCH
    ROLLBACK TRANSACTION;
    SET @ErrorCode = 'TRANSACTION_FAILED';
  END CATCH
END;
GO

-- ============================================================
-- sp_CheckTeamActive
-- Returns whether a team's subscription is currently active.
-- Used by requireActiveTeam middleware.
-- ============================================================
IF OBJECT_ID('dbo.sp_CheckTeamActive', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_CheckTeamActive;
GO

CREATE PROCEDURE dbo.sp_CheckTeamActive
  @TeamId   INT,
  @IsActive BIT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @IsActive = 0;

  SELECT @IsActive = CAST(is_active AS BIT)
  FROM   dbo.teams
  WHERE  id = @TeamId;
END;
GO

-- ============================================================
-- sp_GetTokenVersion
-- Returns the current token_version for a user.
-- Called by requireAuth middleware on every authenticated request
-- to detect revoke-all-sessions invalidation.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetTokenVersion
  @UserId       UNIQUEIDENTIFIER,
  @TokenVersion INT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @TokenVersion = NULL;
  SELECT @TokenVersion = token_version
  FROM   dbo.users
  WHERE  id = @UserId;
END;
GO

-- ============================================================
-- sp_RevokeAllSessions
-- Increments token_version (invalidating all existing JWTs)
-- and revokes all active refresh tokens for a user.
-- Called by POST /auth/revoke-all-sessions.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_RevokeAllSessions
  @UserId  UNIQUEIDENTIFIER,
  @ActorId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRANSACTION;

    UPDATE dbo.users
    SET token_version = token_version + 1,
        updated_at    = SYSUTCDATETIME()
    WHERE id = @UserId;

    UPDATE dbo.refresh_tokens
    SET revoked_at = SYSUTCDATETIME()
    WHERE user_id  = @UserId
      AND revoked_at IS NULL;

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
    VALUES (
      @ActorId, 'sessions_revoked', 'user', CAST(@UserId AS NVARCHAR(100)),
      JSON_OBJECT('revokedBy': CAST(@ActorId AS NVARCHAR(100)))
    );

  COMMIT TRANSACTION;
END;
GO

-- ============================================================
-- sp_CleanExpiredTokens
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CleanExpiredTokens
AS
BEGIN
  SET NOCOUNT ON;

  DELETE FROM dbo.refresh_tokens
  WHERE expires_at < DATEADD(DAY, -1, SYSUTCDATETIME())
     OR revoked_at < DATEADD(DAY, -30, SYSUTCDATETIME());
END;
GO

-- ============================================================
-- sp_GetOrCreateUser
-- Idempotent user lookup/creation for the app-DB create-player
-- and bulk-import flows.
--
-- If a user with @Email already exists: returns their ID.
-- If not: creates the account with role_id = 6 (player) and
--   a placeholder password hash (account requires invite to
--   set a real password before they can log in).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetOrCreateUser
  @Email     NVARCHAR(255),
  @FirstName NVARCHAR(100),
  @LastName  NVARCHAR(100),
  @TeamId    INT = NULL,
  @CreatedBy UNIQUEIDENTIFIER = NULL,   -- who triggered the import; NULL = system
  -- Output
  @UserId    UNIQUEIDENTIFIER OUTPUT,
  @UserIntId INT              OUTPUT,   -- integer user_id, consistent across Global + App DBs
  @ErrorCode NVARCHAR(50)     OUTPUT    -- NULL = success; 'CREATED' = new account made
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;
  SET @UserIntId = NULL;

  -- Validate team if provided
  IF @TeamId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  -- Return existing user if email already registered
  IF EXISTS (SELECT 1 FROM dbo.users WHERE email = @Email)
  BEGIN
    SELECT @UserId = id, @UserIntId = user_id FROM dbo.users WHERE email = @Email;
    -- Ensure they are linked to this team
    IF @TeamId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.user_teams WHERE user_id = @UserId AND team_id = @TeamId)
    BEGIN
      INSERT INTO dbo.user_teams (user_id, team_id)
      VALUES (@UserId, @TeamId);
    END
    RETURN;   -- @ErrorCode stays NULL — caller treats this as success
  END

  -- Create new account
  -- Password hash is a sentinel value; account cannot log in until the
  -- user redeems an invite token and sets a real password.
  BEGIN TRANSACTION;

    SET @UserId = NEWID();

    INSERT INTO dbo.users (id, email, password_hash, first_name, last_name, role_id)
    VALUES (
      @UserId,
      @Email,
      'INVITE_PENDING',   -- bcrypt never matches this; login blocked until invite redeemed
      @FirstName,
      @LastName,
      6          -- player (dbo.roles.id = 6)
    );

    SELECT @UserIntId = user_id FROM dbo.users WHERE id = @UserId;

    IF @TeamId IS NOT NULL
    BEGIN
      INSERT INTO dbo.user_teams (user_id, team_id)
      VALUES (@UserId, @TeamId);
    END

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
    VALUES (
      @CreatedBy,
      'user_created',
      'user',
      CAST(@UserId AS NVARCHAR(100)),
      JSON_OBJECT(
        'email':    @Email,
        'roleId':   '6',
        'roleName': 'player',
        'source':   'bulk_import',
        'teamId':   ISNULL(CAST(@TeamId AS NVARCHAR(20)), '')
      )
    );

  COMMIT TRANSACTION;

  SET @ErrorCode = 'CREATED';   -- informational: caller knows a new account was made
END;
GO

-- ============================================================
-- sp_GetUserProfile
-- Returns profile fields for the authenticated user.
-- Called by GET /api/profile.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserProfile
  @UserId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    u.id,
    u.email,
    u.first_name    AS firstName,
    u.last_name     AS lastName,
    u.role_id       AS roleId,
    r.role_name     AS role,
    u.last_login_at AS lastLoginAt,
    u.created_at    AS createdAt,
    CAST(utp.preferred_team_id AS NVARCHAR(100)) AS preferredTeamId
  FROM dbo.users u
  JOIN dbo.roles r ON r.id = u.role_id
  LEFT JOIN dbo.user_team_preferences utp ON utp.user_id = u.id
  WHERE u.id = @UserId;
END;
GO

-- ============================================================
-- sp_UpdateProfile
-- Updates the display name for the authenticated user.
-- Called by PATCH /api/profile.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateProfile
  @UserId    UNIQUEIDENTIFIER,
  @FirstName NVARCHAR(100),
  @LastName  NVARCHAR(100),
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @UserId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  UPDATE dbo.users
  SET    first_name = @FirstName,
         last_name  = @LastName,
         updated_at = SYSUTCDATETIME()
  WHERE  id = @UserId;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @UserId, 'profile_updated', 'user', CAST(@UserId AS NVARCHAR(100)),
    JSON_OBJECT('firstName': @FirstName, 'lastName': @LastName)
  );
END;
GO

-- ============================================================
-- sp_GetPasswordHash
-- Returns the bcrypt password hash for a user.
-- The route handler calls bcrypt.compare — password logic
-- never lives in SQL.
-- Called by PATCH /api/profile/email and /api/profile/password.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetPasswordHash
  @UserId       UNIQUEIDENTIFIER,
  @PasswordHash NVARCHAR(255) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @PasswordHash = NULL;

  SELECT @PasswordHash = password_hash
  FROM   dbo.users
  WHERE  id = @UserId AND is_active = 1;
END;
GO

-- ============================================================
-- sp_ChangeEmail
-- Updates email and bumps token_version (invalidates all JWTs).
-- Route handler must verify current password via bcrypt before
-- calling this SP.
-- Called by PATCH /api/profile/email.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_ChangeEmail
  @UserId    UNIQUEIDENTIFIER,
  @NewEmail  NVARCHAR(255),
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @UserId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  IF EXISTS (SELECT 1 FROM dbo.users WHERE email = @NewEmail AND id <> @UserId)
  BEGIN
    SET @ErrorCode = 'EMAIL_ALREADY_EXISTS';
    RETURN;
  END

  BEGIN TRANSACTION;
    UPDATE dbo.users
    SET    email         = @NewEmail,
           token_version = token_version + 1,
           updated_at    = SYSUTCDATETIME()
    WHERE  id = @UserId;

    -- Revoke all refresh tokens so the user must re-login with the new email
    UPDATE dbo.refresh_tokens
    SET    revoked_at = SYSUTCDATETIME()
    WHERE  user_id    = @UserId
      AND  revoked_at IS NULL;

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
    VALUES (
      @UserId, 'email_changed', 'user', CAST(@UserId AS NVARCHAR(100)),
      JSON_OBJECT('newEmail': @NewEmail)
    );
  COMMIT TRANSACTION;
END;
GO

-- ============================================================
-- sp_ChangePassword
-- Updates the password hash and bumps token_version.
-- Route handler must verify current password via bcrypt before
-- calling this SP.
-- Called by PATCH /api/profile/password.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_ChangePassword
  @UserId          UNIQUEIDENTIFIER,
  @NewPasswordHash NVARCHAR(255),
  @ErrorCode       NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE id = @UserId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  BEGIN TRANSACTION;
    UPDATE dbo.users
    SET    password_hash  = @NewPasswordHash,
           token_version  = token_version + 1,
           updated_at     = SYSUTCDATETIME()
    WHERE  id = @UserId;

    UPDATE dbo.refresh_tokens
    SET    revoked_at = SYSUTCDATETIME()
    WHERE  user_id    = @UserId
      AND  revoked_at IS NULL;

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
    VALUES (
      @UserId, 'password_changed', 'user', CAST(@UserId AS NVARCHAR(100)),
      JSON_OBJECT('source': 'self_service')
    );
  COMMIT TRANSACTION;
END;
GO

-- ============================================================
-- sp_SetPreferredTeam
-- Upserts a user's preferred default team.
-- Validates the user still has access to the requested team
-- before persisting. platform_owner (role_id = 1) can pin any
-- active team.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SetPreferredTeam
  @UserId    UNIQUEIDENTIFIER,
  @TeamId    INT,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  -- Verify the team is active
  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  -- Verify the user exists and get their role
  DECLARE @RoleId INT;
  SELECT @RoleId = role_id FROM dbo.users WHERE id = @UserId AND is_active = 1;

  IF @RoleId IS NULL
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  -- platform_owner (role_id = 1) can pin any active team; others must have user_teams access
  IF @RoleId <> 1
    AND NOT EXISTS (
      SELECT 1 FROM dbo.user_teams
      WHERE user_id = @UserId AND team_id = @TeamId AND is_active = 1
    )
  BEGIN
    SET @ErrorCode = 'ACCESS_DENIED';
    RETURN;
  END

  -- Upsert the preference
  IF EXISTS (SELECT 1 FROM dbo.user_team_preferences WHERE user_id = @UserId)
    UPDATE dbo.user_team_preferences
    SET    preferred_team_id = @TeamId,
           updated_at        = SYSUTCDATETIME()
    WHERE  user_id = @UserId;
  ELSE
    INSERT INTO dbo.user_team_preferences (user_id, preferred_team_id)
    VALUES (@UserId, @TeamId);

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @UserId, 'set_preferred_team', 'team', CAST(@TeamId AS NVARCHAR(20)),
    JSON_OBJECT('teamId': CAST(@TeamId AS NVARCHAR(20)))
  );
END;
GO
