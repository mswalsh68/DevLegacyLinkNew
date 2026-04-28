-- ============================================================
-- GLOBAL DB — ALL STORED PROCEDURES
-- Run this file on: LegacyLinkGlobal database
-- Run after: 024_bigint_user_pk.sql
-- ============================================================
-- Migration 024 changes reflected here:
--   • All user ID params changed UNIQUEIDENTIFIER → BIGINT
--   • All WHERE/JOIN clauses updated: u.id → u.user_id
--   • sp_Login / sp_RefreshToken JSON: removed GUID id field,
--     renamed userIntId → userId
--   • sp_CreateUser / sp_GetOrCreateUser use SCOPE_IDENTITY()
--     instead of NEWID() — BIGINT IDENTITY does the work
--   • sp_GetOrCreateUser: removed @UserIntId output (redundant)
--   • Removed legacy invite_tokens SPs (table dropped in 024;
--     use sp_CreateInviteCode in sp_Invite_AllProcedures.sql)
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
  DECLARE @DbServer      NVARCHAR(200) = '';

  IF @RoleId = 1
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
      @DbServer                             AS dbServer,
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

-- ============================================================
-- sp_StoreRefreshToken
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_StoreRefreshToken
  @UserId     BIGINT,
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
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_RefreshToken
  @OldTokenHash  NVARCHAR(255),
  @NewTokenHash  NVARCHAR(255),
  @NewExpiresAt  DATETIME2,
  @CurrentTeamId INT = NULL,
  -- Outputs
  @UserJson      NVARCHAR(MAX) OUTPUT,
  @ErrorCode     NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  SET @ErrorCode = NULL;

  DECLARE @UserId BIGINT;

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

    IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId AND is_active = 1)
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

  DECLARE @RoleId   INT;
  DECLARE @RoleName NVARCHAR(50);

  SELECT @RoleId = u.role_id, @RoleName = r.role_name
  FROM   dbo.users u
  JOIN   dbo.roles r ON r.id = u.role_id
  WHERE  u.user_id = @UserId;

  DECLARE @TeamsJson NVARCHAR(MAX);

  IF @RoleId = 1
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
      WHERE ut.user_id   = @UserId
        AND ut.is_active = 1
      ORDER BY t.name
      FOR JSON PATH
    );
  END

  IF @TeamsJson IS NULL SET @TeamsJson = '[]';

  DECLARE @ResolvedTeamId INT;
  DECLARE @AppDb          NVARCHAR(100) = '';
  DECLARE @DbServer       NVARCHAR(200) = '';

  IF @CurrentTeamId IS NOT NULL
  BEGIN
    IF @RoleId = 1
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
      WHERE ut.user_id   = @UserId
        AND ut.team_id   = @CurrentTeamId
        AND ut.is_active = 1
        AND t.is_active  = 1;
    END
  END

  IF @ResolvedTeamId IS NULL
  BEGIN
    IF @RoleId = 1
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
      WHERE ut.user_id   = @UserId
        AND ut.is_active = 1
        AND t.is_active  = 1
      ORDER BY t.name;
    END
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

  SELECT @UserJson = (
    SELECT
      u.user_id                                AS userId,
      u.email,
      u.first_name                             AS firstName,
      u.last_name                              AS lastName,
      u.role_id                                AS roleId,
      r.role_name                              AS role,
      u.is_active                              AS isActive,
      u.account_claimed                        AS accountClaimed,
      u.token_version                          AS tokenVersion,
      @ResolvedTeamId                          AS currentTeamId,
      @PreferredTeamId                         AS preferredTeamId,
      @AppDb                                   AS appDb,
      @DbServer                                AS dbServer,
      JSON_QUERY(@TeamsJson)                   AS teams,
      (
        SELECT ap.app_name AS app, ap.role, ap.granted_at AS grantedAt, ap.granted_by AS grantedBy
        FROM dbo.app_permissions ap
        WHERE ap.user_id = u.user_id AND ap.revoked_at IS NULL
        FOR JSON PATH
      ) AS appPermissions
    FROM dbo.users u
    JOIN dbo.roles r ON r.id = u.role_id
    WHERE u.user_id = @UserId
    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
  );
END;
GO

-- ============================================================
-- sp_Logout
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
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SwitchTeam
  @UserId    BIGINT,
  @NewTeamId INT,
  @TeamJson  NVARCHAR(MAX) OUTPUT,
  @ErrorCode NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @TeamJson  = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @NewTeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  DECLARE @RoleId INT;
  SELECT @RoleId = role_id FROM dbo.users WHERE user_id = @UserId;

  IF @RoleId <> 1
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

  SELECT @TeamJson = (
    SELECT
      t.id                   AS teamId,
      t.name,
      t.abbr,
      t.app_db               AS appDb,
      t.db_server            AS dbServer,
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
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserTeams
  @UserId BIGINT
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @RoleId   INT;
  DECLARE @RoleName NVARCHAR(50);

  SELECT @RoleId = u.role_id, @RoleName = r.role_name
  FROM   dbo.users u
  JOIN   dbo.roles r ON r.id = u.role_id
  WHERE  u.user_id = @UserId;

  IF @RoleId = 1
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
    WHERE ut.user_id   = @UserId
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
  @RoleId        INT,
  @CreatedBy     BIGINT,
  @TeamId        INT           = NULL,
  @GrantAppName  NVARCHAR(50)  = NULL,
  @GrantAppRole  NVARCHAR(50)  = NULL,
  @NewUserId     BIGINT        OUTPUT,
  @ErrorCode     NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  SET @ErrorCode = NULL;

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

    INSERT INTO dbo.users (email, password_hash, first_name, last_name, role_id)
    VALUES (@Email, @PasswordHash, @FirstName, @LastName, @RoleId);

    SET @NewUserId = SCOPE_IDENTITY();

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
      @CreatedBy, 'user_created', 'user', CAST(@NewUserId AS NVARCHAR(20)),
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
-- Updates role and/or active status.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateUser
  @TargetUserId  BIGINT,
  @RoleId        INT           = NULL,
  @IsActive      BIT           = NULL,
  @ActorId       BIGINT,
  @ErrorCode     NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @TargetUserId)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

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
  FROM dbo.users WHERE user_id = @TargetUserId;

  UPDATE dbo.users SET
    role_id    = COALESCE(@RoleId,   role_id),
    is_active  = COALESCE(@IsActive, is_active),
    updated_at = SYSUTCDATETIME()
  WHERE user_id = @TargetUserId;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @ActorId, 'user_updated', 'user', CAST(@TargetUserId AS NVARCHAR(20)),
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
  @UserId    BIGINT,
  @AppName   NVARCHAR(50),
  @Role      NVARCHAR(50),
  @GrantedBy BIGINT,
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
      @GrantedBy, 'permission_granted', 'user', CAST(@UserId AS NVARCHAR(20)),
      JSON_OBJECT('app': @AppName, 'role': @Role)
    );

  COMMIT TRANSACTION;
END;
GO

-- ============================================================
-- sp_RevokePermission
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_RevokePermission
  @UserId    BIGINT,
  @AppName   NVARCHAR(50),
  @RevokedBy BIGINT,
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
    @RevokedBy, 'permission_revoked', 'user', CAST(@UserId AS NVARCHAR(20)),
    JSON_OBJECT('app': @AppName)
  );
END;
GO

-- ============================================================
-- sp_TransferPlayerToAlumni
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_TransferPlayerToAlumni
  @UserId    BIGINT,
  @GrantedBy BIGINT
AS
BEGIN
  SET NOCOUNT ON;

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
    VALUES (@UserId, 'alumni', 'readonly', @GrantedBy);
  END

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @GrantedBy, 'player_graduated_to_alumni', 'user', CAST(@UserId AS NVARCHAR(20)),
    JSON_OBJECT('rosterRevoked': 'true', 'alumniGranted': 'true')
  );
END;
GO

-- ============================================================
-- sp_GetUsers
-- Returns paginated user list with role info.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUsers
  @Search     NVARCHAR(255) = NULL,
  @RoleId     INT           = NULL,
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
    u.user_id       AS userId,
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
      WHERE ap.user_id = u.user_id AND ap.revoked_at IS NULL
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
  @UserId BIGINT
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
  JOIN dbo.users gb ON gb.user_id = ap.granted_by
  WHERE ap.user_id = @UserId
  ORDER BY ap.granted_at DESC;
END;
GO

-- ============================================================
-- sp_CheckTeamActive
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CheckTeamActive
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
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetTokenVersion
  @UserId       BIGINT,
  @TokenVersion INT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @TokenVersion = NULL;

  SELECT @TokenVersion = token_version
  FROM   dbo.users
  WHERE  user_id = @UserId;
END;
GO

-- ============================================================
-- sp_RevokeAllSessions
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_RevokeAllSessions
  @UserId  BIGINT,
  @ActorId BIGINT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  BEGIN TRANSACTION;

    UPDATE dbo.users
    SET token_version = token_version + 1,
        updated_at    = SYSUTCDATETIME()
    WHERE user_id = @UserId;

    UPDATE dbo.refresh_tokens
    SET revoked_at = SYSUTCDATETIME()
    WHERE user_id  = @UserId
      AND revoked_at IS NULL;

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
    VALUES (
      @ActorId, 'sessions_revoked', 'user', CAST(@UserId AS NVARCHAR(20)),
      JSON_OBJECT('revokedBy': CAST(@ActorId AS NVARCHAR(20)))
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
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetOrCreateUser
  @Email     NVARCHAR(255),
  @FirstName NVARCHAR(100),
  @LastName  NVARCHAR(100),
  @TeamId    INT             = NULL,
  @CreatedBy BIGINT          = NULL,
  @UserId    BIGINT          OUTPUT,
  @ErrorCode NVARCHAR(50)    OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;

  IF @TeamId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  IF EXISTS (SELECT 1 FROM dbo.users WHERE email = @Email)
  BEGIN
    SELECT @UserId = user_id FROM dbo.users WHERE email = @Email;

    IF @TeamId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.user_teams WHERE user_id = @UserId AND team_id = @TeamId)
    BEGIN
      INSERT INTO dbo.user_teams (user_id, team_id)
      VALUES (@UserId, @TeamId);
    END

    RETURN;
  END

  BEGIN TRANSACTION;

    INSERT INTO dbo.users (email, password_hash, first_name, last_name, role_id)
    VALUES (
      @Email,
      'INVITE_PENDING',
      @FirstName,
      @LastName,
      6
    );

    SET @UserId = SCOPE_IDENTITY();

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
      CAST(@UserId AS NVARCHAR(20)),
      JSON_OBJECT(
        'email':    @Email,
        'roleId':   '6',
        'roleName': 'player',
        'source':   'bulk_import',
        'teamId':   ISNULL(CAST(@TeamId AS NVARCHAR(20)), '')
      )
    );

  COMMIT TRANSACTION;

  SET @ErrorCode = 'CREATED';
END;
GO

-- ============================================================
-- sp_GetUserProfile
-- Returns profile fields for the authenticated user.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserProfile
  @UserId BIGINT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    u.user_id       AS userId,
    u.email,
    u.first_name    AS firstName,
    u.last_name     AS lastName,
    u.role_id       AS roleId,
    r.role_name     AS role,
    u.last_login_at AS lastLoginAt,
    u.created_at    AS createdAt,
    utp.preferred_team_id AS preferredTeamId
  FROM dbo.users u
  JOIN dbo.roles r ON r.id = u.role_id
  LEFT JOIN dbo.user_team_preferences utp ON utp.user_id = u.user_id
  WHERE u.user_id = @UserId;
END;
GO

-- ============================================================
-- sp_UpdateProfile
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateProfile
  @UserId    BIGINT,
  @FirstName NVARCHAR(100),
  @LastName  NVARCHAR(100),
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  UPDATE dbo.users
  SET    first_name = @FirstName,
         last_name  = @LastName,
         updated_at = SYSUTCDATETIME()
  WHERE  user_id = @UserId;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
  VALUES (
    @UserId, 'profile_updated', 'user', CAST(@UserId AS NVARCHAR(20)),
    JSON_OBJECT('firstName': @FirstName, 'lastName': @LastName)
  );
END;
GO

-- ============================================================
-- sp_GetPasswordHash
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetPasswordHash
  @UserId       BIGINT,
  @PasswordHash NVARCHAR(255) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @PasswordHash = NULL;

  SELECT @PasswordHash = password_hash
  FROM   dbo.users
  WHERE  user_id = @UserId AND is_active = 1;
END;
GO

-- ============================================================
-- sp_ChangeEmail
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_ChangeEmail
  @UserId    BIGINT,
  @NewEmail  NVARCHAR(255),
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  IF EXISTS (SELECT 1 FROM dbo.users WHERE email = @NewEmail AND user_id <> @UserId)
  BEGIN
    SET @ErrorCode = 'EMAIL_ALREADY_EXISTS';
    RETURN;
  END

  BEGIN TRANSACTION;
    UPDATE dbo.users
    SET    email         = @NewEmail,
           token_version = token_version + 1,
           updated_at    = SYSUTCDATETIME()
    WHERE  user_id = @UserId;

    UPDATE dbo.refresh_tokens
    SET    revoked_at = SYSUTCDATETIME()
    WHERE  user_id    = @UserId
      AND  revoked_at IS NULL;

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
    VALUES (
      @UserId, 'email_changed', 'user', CAST(@UserId AS NVARCHAR(20)),
      JSON_OBJECT('newEmail': @NewEmail)
    );
  COMMIT TRANSACTION;
END;
GO

-- ============================================================
-- sp_ChangePassword
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_ChangePassword
  @UserId          BIGINT,
  @NewPasswordHash NVARCHAR(255),
  @ErrorCode       NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  BEGIN TRANSACTION;
    UPDATE dbo.users
    SET    password_hash  = @NewPasswordHash,
           token_version  = token_version + 1,
           updated_at     = SYSUTCDATETIME()
    WHERE  user_id = @UserId;

    UPDATE dbo.refresh_tokens
    SET    revoked_at = SYSUTCDATETIME()
    WHERE  user_id    = @UserId
      AND  revoked_at IS NULL;

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload)
    VALUES (
      @UserId, 'password_changed', 'user', CAST(@UserId AS NVARCHAR(20)),
      JSON_OBJECT('source': 'self_service')
    );
  COMMIT TRANSACTION;
END;
GO

-- ============================================================
-- sp_SetPreferredTeam
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SetPreferredTeam
  @UserId    BIGINT,
  @TeamId    INT,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  DECLARE @RoleId INT;
  SELECT @RoleId = role_id FROM dbo.users WHERE user_id = @UserId AND is_active = 1;

  IF @RoleId IS NULL
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  IF @RoleId <> 1
    AND NOT EXISTS (
      SELECT 1 FROM dbo.user_teams
      WHERE user_id = @UserId AND team_id = @TeamId AND is_active = 1
    )
  BEGIN
    SET @ErrorCode = 'ACCESS_DENIED';
    RETURN;
  END

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
