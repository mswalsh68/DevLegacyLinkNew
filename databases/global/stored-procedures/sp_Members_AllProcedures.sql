-- ─── Member Management Stored Procedures ─────────────────────────────────────
-- Handles direct admin creation of coaches / staff with immediate team access.
-- Role is stored on dbo.users.role_id (FK → dbo.roles) — not on user_teams.
-- Updated for migration 024: UNIQUEIDENTIFIER → BIGINT for user IDs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── sp_CreateTeamMember ──────────────────────────────────────────────────────
-- Creates or looks up a user, assigns global role_id=3 (client) for all
-- external users (migration 028), adds them to the team, and grants
-- app_permissions. The @Role string is the program-level role name and is
-- stored as metadata in app_permissions — it is NOT looked up in dbo.roles.
--
-- Alumni-access roles: athletic_director, app_admin, alumni_director, head_coach

CREATE OR ALTER PROCEDURE dbo.sp_CreateTeamMember
  @Email        NVARCHAR(255),
  @FirstName    NVARCHAR(100),
  @LastName     NVARCHAR(100),
  @TeamId       INT,
  @Role         NVARCHAR(50),   -- program role name (metadata only)
  @CreatedBy    BIGINT,
  @UserId       BIGINT       OUTPUT,
  @ErrorCode    NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;

  -- All external users get global role_id=3 (client) per migration 028.
  DECLARE @ClientRoleId INT = 3;

  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  SELECT @UserId = user_id FROM dbo.users WHERE email = @Email;

  IF @UserId IS NULL
  BEGIN
    INSERT INTO dbo.users (email, password_hash, first_name, last_name, role_id, is_active)
    VALUES (@Email, 'INVITE_PENDING', @FirstName, @LastName, @ClientRoleId, 1);

    SET @UserId = SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    -- Ensure existing users are on the client global role
    UPDATE dbo.users SET role_id = @ClientRoleId WHERE user_id = @UserId AND role_id > @ClientRoleId;
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.user_teams WHERE user_id = @UserId AND team_id = @TeamId)
  BEGIN
    INSERT INTO dbo.user_teams (user_id, team_id) VALUES (@UserId, @TeamId);
  END

  IF NOT EXISTS (
    SELECT 1 FROM dbo.app_permissions
    WHERE user_id = @UserId AND app_name = 'roster' AND revoked_at IS NULL
  )
  BEGIN
    INSERT INTO dbo.app_permissions (user_id, app_name, role, granted_by)
    VALUES (@UserId, 'roster', @Role, @CreatedBy);
  END

  -- Admin/director/coach roles also get alumni app access
  IF @Role IN ('athletic_director', 'app_admin', 'alumni_director', 'head_coach')
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
    CAST(@UserId AS NVARCHAR(20)),
    (SELECT @TeamId AS teamId, @Role AS role FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    SYSUTCDATETIME()
  );
END
GO
