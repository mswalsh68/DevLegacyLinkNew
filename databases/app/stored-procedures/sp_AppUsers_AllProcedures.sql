-- ============================================================
-- APP DB — USER SYNC STORED PROCEDURES
-- Run this file on: LegacyLinkApp (and every tenant App DB)
-- Requires: 014_schema_consolidation.sql to have run
-- ============================================================
-- Procedures:
--   sp_UpsertAppUser       — sync global user record into App DB dbo.users
--   sp_UpdateLastTeamLogin — stamp last_team_login on successful app login
--   sp_GetProgramRoles     — returns program_role lookup for dropdowns
--   sp_SetProgramRole      — updates program_role_id directly on dbo.users
--   sp_GetUserProgramRole  — returns a user's current program role
-- ============================================================
-- NOTE: program_role_id now lives on dbo.users (1-to-1).
--       Role assignment goes through sp_SetProgramRole or sp_AddUserRole.
-- ============================================================

-- ============================================================
-- sp_UpsertAppUser
-- Called on team switch when global data has changed.
-- Creates the row if the user has never logged into this team.
-- program_role_id defaults to 8 (player) on first insert;
-- it should be set via sp_AddUserRole / sp_SetProgramRole after.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertAppUser
  @UserId        INT,
  @Email         NVARCHAR(255),
  @FirstName     NVARCHAR(100),
  @LastName      NVARCHAR(100),
  @PlatformRole  NVARCHAR(50),       -- global dbo.roles.role_name
  @GlobalRoleId  INT          = 3,   -- 1=super_admin 2=support_admin 3=client
  @ProgramRoleId INT          = NULL -- override default if known at sync time
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
      global_role_id= @GlobalRoleId,
      synced_at     = SYSUTCDATETIME()
    WHERE user_id = @UserId;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.users (user_id, email, first_name, last_name, platform_role, global_role_id, program_role_id)
    VALUES (
      @UserId, @Email, @FirstName, @LastName, @PlatformRole,
      @GlobalRoleId,
      ISNULL(@ProgramRoleId, 8)   -- default to player if not specified
    );
  END
END;
GO

-- ============================================================
-- sp_UpdateLastTeamLogin
-- Stamps the current UTC time as last_team_login for the user
-- in this App DB. Called after a successful team-switch / login.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateLastTeamLogin
  @UserId INT
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
-- Directly sets a user's program_role_id on dbo.users.
-- Used by admins from the member management UI.
-- Roles are program-local — never synced back to global.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SetProgramRole
  @UserId        INT,
  @ProgramRoleId INT,
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

  UPDATE dbo.users
  SET    program_role_id = @ProgramRoleId
  WHERE  user_id = @UserId;
END;
GO

-- ============================================================
-- sp_GetUserProgramRole
-- Returns the user's current program role.
-- Used by the Add Members wizard to determine what the creator
-- is allowed to do (player=blocked, alumni=invite-only, staff=full).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserProgramRole
  @UserId INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    u.program_role_id   AS programRoleId,
    pr.role_name        AS roleName,
    pr.display_name     AS displayName,
    u.global_role_id    AS globalRoleId
  FROM   dbo.users u
  JOIN   dbo.program_role pr ON pr.id = u.program_role_id
  WHERE  u.user_id = @UserId;
END;
GO
