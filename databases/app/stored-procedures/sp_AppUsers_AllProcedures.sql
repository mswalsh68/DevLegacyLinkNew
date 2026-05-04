-- ============================================================
-- APP DB — USER SYNC STORED PROCEDURES
-- Run this file on: LegacyLinkApp (and every tenant App DB)
-- Requires: 008_schema_refactor.sql to have run
-- ============================================================
-- Procedures:
--   sp_UpsertAppUser       — sync global user record into App DB dbo.users
--   sp_UpdateLastTeamLogin — stamp last_team_login on successful app login
--   sp_GetProgramRoles     — returns program_role lookup for dropdowns
--   sp_SetProgramRole      — upserts a users_roles record for a user
--                            (program_role_id is now on users_roles, not users)
-- ============================================================

-- ============================================================
-- sp_UpsertAppUser
-- Called on team switch when global data has changed.
-- Creates the row if the user has never logged into this team before.
-- NOTE: program_role_id was removed from dbo.users in migration 008.
--       Role assignment goes through sp_SetProgramRole → users_roles.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertAppUser
  @UserId       INT,            -- global user_id (INT)
  @Email        NVARCHAR(255),
  @FirstName    NVARCHAR(100),
  @LastName     NVARCHAR(100),
  @PlatformRole NVARCHAR(50)    -- global dbo.roles.role_name
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId)
  BEGIN
    UPDATE dbo.users SET
      email         = @Email,
      first_name    = @FirstName,
      last_name     = @LastName,
      platform_role = @PlatformRole,
      synced_at     = SYSUTCDATETIME()
    WHERE user_id = @UserId;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.users (user_id, email, first_name, last_name, platform_role)
    VALUES (@UserId, @Email, @FirstName, @LastName, @PlatformRole);
  END
END;
GO

-- ============================================================
-- sp_UpdateLastTeamLogin
-- Stamps the current UTC time as last_team_login for the user
-- in this App DB. Called after a successful team-switch / login.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateLastTeamLogin
  @UserId INT     -- global user_id INT
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.users
  SET    last_team_login = SYSUTCDATETIME()
  WHERE  user_id = @UserId;
END;
GO

-- ============================================================
-- sp_GetProgramRoles
-- Returns all active program roles for dropdowns/admin UI.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetProgramRoles
AS
BEGIN
  SET NOCOUNT ON;

  SELECT id, role_name AS roleName, display_name AS displayName, sort_order AS sortOrder
  FROM   dbo.program_role
  WHERE  is_active = 1
  ORDER  BY sort_order;
END;
GO

-- ============================================================
-- sp_SetProgramRole
-- Upserts a users_roles record for a user within this App DB.
-- Called by admins from the member management UI.
-- Roles are program-local — never synced back to global.
--
-- @Status: 'current_player' | 'alumni' | 'removed'
-- @SportId: NULL means the role applies to any/all sports
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SetProgramRole
  @UserId        INT,
  @ProgramRoleId INT,
  @SportId       INT           = NULL,
  @Status        NVARCHAR(20)  = 'current_player',
  @ErrorCode     NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

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

  -- Upsert into users_roles
  IF EXISTS (
    SELECT 1 FROM dbo.users_roles
    WHERE user_id        = @UserId
      AND program_role_id= @ProgramRoleId
      AND ((@SportId IS NULL AND sport_id IS NULL) OR sport_id = @SportId)
  )
  BEGIN
    UPDATE dbo.users_roles SET
      status     = @Status,
      updated_at = SYSUTCDATETIME()
    WHERE user_id         = @UserId
      AND program_role_id = @ProgramRoleId
      AND ((@SportId IS NULL AND sport_id IS NULL) OR sport_id = @SportId);
  END
  ELSE
  BEGIN
    INSERT INTO dbo.users_roles (user_id, program_role_id, sport_id, status)
    VALUES (@UserId, @ProgramRoleId, @SportId, @Status);
  END
END;
GO

-- ============================================================
-- sp_GetUserProgramRole
-- Returns the most-privileged (lowest sort_order) program role
-- for a user across all their active users_roles records.
-- Used by the Add Members wizard to determine what the creator
-- is allowed to do (player=blocked, alumni=invite-only, staff=full).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserProgramRole
  @UserId INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT TOP 1
    ur.program_role_id  AS programRoleId,
    pr.role_name        AS roleName,
    pr.display_name     AS displayName
  FROM   dbo.users_roles ur
  JOIN   dbo.program_role pr ON pr.id = ur.program_role_id AND pr.is_active = 1
  WHERE  ur.user_id = @UserId
    AND  ur.status  <> 'removed'
  ORDER  BY pr.sort_order ASC;
END;
GO
