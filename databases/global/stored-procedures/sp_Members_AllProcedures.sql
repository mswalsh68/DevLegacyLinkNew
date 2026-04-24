-- ─── Member Management Stored Procedures ─────────────────────────────────────
-- Handles direct admin creation of coaches / staff with immediate team access.
-- Role is stored on dbo.users.role_id (FK → dbo.roles) — not on user_teams.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── sp_CreateTeamMember ──────────────────────────────────────────────────────
-- Creates or looks up a user, sets their role_id, adds them to the team,
-- and grants matching app_permissions.
-- @Role: role_name from dbo.roles — 'app_admin' | 'head_coach' | 'position_coach' | 'alumni_director'

CREATE OR ALTER PROCEDURE dbo.sp_CreateTeamMember
  @Email        NVARCHAR(255),
  @FirstName    NVARCHAR(100),
  @LastName     NVARCHAR(100),
  @TeamId       UNIQUEIDENTIFIER,
  @Role         NVARCHAR(50),          -- role_name from dbo.roles
  @CreatedBy    UNIQUEIDENTIFIER,
  @UserId       UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode    NVARCHAR(50)    OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;

  -- Resolve role_id from role_name
  DECLARE @RoleId INT;
  SELECT @RoleId = id FROM dbo.roles WHERE role_name = @Role;

  IF @RoleId IS NULL
  BEGIN
    SET @ErrorCode = 'INVALID_ROLE';
    RETURN;
  END

  -- Verify team exists
  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  -- Get or create the user account
  SELECT @UserId = id FROM dbo.users WHERE email = @Email;

  IF @UserId IS NULL
  BEGIN
    SET @UserId = NEWID();
    INSERT INTO dbo.users (id, email, password_hash, first_name, last_name, role_id, is_active, created_at)
    VALUES (@UserId, @Email, 'INVITE_PENDING', @FirstName, @LastName, @RoleId, 1, SYSUTCDATETIME());
  END
  ELSE
  BEGIN
    -- Update role on existing user
    UPDATE dbo.users SET role_id = @RoleId WHERE id = @UserId;
  END

  -- Add to team if not already a member
  IF NOT EXISTS (SELECT 1 FROM dbo.user_teams WHERE user_id = @UserId AND team_id = @TeamId)
  BEGIN
    INSERT INTO dbo.user_teams (user_id, team_id) VALUES (@UserId, @TeamId);
  END

  -- Grant roster app permission
  IF NOT EXISTS (
    SELECT 1 FROM dbo.app_permissions
    WHERE user_id = @UserId AND app_name = 'roster' AND revoked_at IS NULL
  )
  BEGIN
    INSERT INTO dbo.app_permissions (user_id, app_name, role, granted_by)
    VALUES (@UserId, 'roster', @Role, @CreatedBy);
  END

  -- app_admin, head_coach, and alumni_director also get alumni access
  IF @RoleId IN (2, 3, 5)
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM dbo.app_permissions
      WHERE user_id = @UserId AND app_name = 'alumni' AND revoked_at IS NULL
    )
    BEGIN
      INSERT INTO dbo.app_permissions (user_id, app_name, role, granted_by)
      VALUES (@UserId, 'alumni', @Role, @CreatedBy);
    END
  END

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
  VALUES (
    @CreatedBy,
    'team_member_created',
    'user',
    @UserId,
    (SELECT @TeamId AS teamId, @Role AS role, @RoleId AS roleId FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    SYSUTCDATETIME()
  );
END
GO
