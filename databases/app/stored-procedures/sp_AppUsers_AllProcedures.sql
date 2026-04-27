-- ============================================================
-- APP DB — USER SYNC STORED PROCEDURES
-- Run this file on: LegacyLinkApp (and every tenant App DB)
-- Requires: 004_users_program_role.sql to have run
-- ============================================================
-- Procedures:
--   sp_UpsertAppUser       — sync global user record into App DB dbo.users
--   sp_UpdateLastTeamLogin — stamp last_team_login on successful app login
--   sp_GetProgramRoles     — returns program_role lookup for dropdowns
--   sp_SetProgramRole      — assigns a program_role to a user in this App DB
-- ============================================================

-- ============================================================
-- sp_UpsertAppUser
-- Called on team switch when global data has changed
-- (sp_SyncUserToAppDb returned a contactUpdatedDate newer than
-- the App DB users.synced_at).
-- Creates the row if the user has never logged into this team before.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertAppUser
  @UserId       INT,            -- global user_id (INT, not GUID)
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
-- Assigns a program_role to a user within this App DB.
-- Called by admins from the member management UI.
-- program_role is program-local only — never synced back to global.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SetProgramRole
  @UserId        INT,
  @ProgramRoleId INT,
  @ErrorCode     NVARCHAR(50) OUTPUT
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
