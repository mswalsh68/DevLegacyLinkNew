USE LegacyLinkApp;
GO
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
-- Program role is now per-sport on dbo.users_sports.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertAppUser
  @UserId        INT,
  @Email         NVARCHAR(255),
  @FirstName     NVARCHAR(100),
  @LastName      NVARCHAR(100),
  @GlobalRoleId  INT          = 3   -- 1=super_admin 2=support_admin 3=client
AS
BEGIN
  SET NOCOUNT ON;

  IF EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @UserId)
  BEGIN
    UPDATE dbo.users SET
      email          = @Email,
      first_name     = @FirstName,
      last_name      = @LastName,
      global_role_id = @GlobalRoleId,
      synced_at      = SYSUTCDATETIME()
    WHERE user_id = @UserId;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.users (user_id, email, first_name, last_name, global_role_id)
    VALUES (@UserId, @Email, @FirstName, @LastName, @GlobalRoleId);
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
-- Sets a user's program_role_id on a specific users_sports row.
-- @SportId is required — role is now per user×sport.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SetProgramRole
  @UserId        INT,
  @SportId       INT,
  @ProgramRoleId INT,
  @ErrorCode     NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.users_sports WHERE user_id = @UserId AND sport_id = @SportId)
  BEGIN
    SET @ErrorCode = 'SPORT_NOT_FOUND';
    RETURN;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.program_role WHERE id = @ProgramRoleId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'INVALID_PROGRAM_ROLE';
    RETURN;
  END

  UPDATE dbo.users_sports
  SET    program_role_id = @ProgramRoleId,
         updated_at      = SYSUTCDATETIME()
  WHERE  user_id = @UserId AND sport_id = @SportId;
END;
GO

-- ============================================================
-- sp_GetUserProgramRole
-- Returns the user's program role for each sport.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserProgramRole
  @UserId INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    us.sport_id        AS sportId,
    s.name             AS sportName,
    us.program_role_id AS programRoleId,
    pr.role_name       AS roleName,
    pr.display_name    AS displayName,
    u.global_role_id   AS globalRoleId
  FROM   dbo.users u
  JOIN   dbo.users_sports  us ON us.user_id = u.user_id AND us.is_active = 1
  JOIN   dbo.sports         s ON s.id        = us.sport_id
  JOIN   dbo.program_role  pr ON pr.id       = us.program_role_id
  WHERE  u.user_id = @UserId
  ORDER  BY s.name;
END;
GO
