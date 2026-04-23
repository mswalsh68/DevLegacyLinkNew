-- ─── Member Management Stored Procedures ─────────────────────────────────────
-- Handles direct admin creation of coaches / staff with immediate team access.
-- Unlike sp_GetOrCreateUser (readonly) this SP sets the caller-supplied role
-- and grants the appropriate app permissions in a single transaction.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── sp_CreateTeamMember ──────────────────────────────────────────────────────
-- Creates or looks up a user, assigns them to a team with the given role,
-- and grants matching app_permissions.
-- Used for direct coach/staff creation by an admin (not invite flow).

CREATE OR ALTER PROCEDURE dbo.sp_CreateTeamMember
  @Email        NVARCHAR(255),
  @FirstName    NVARCHAR(100),
  @LastName     NVARCHAR(100),
  @TeamId       UNIQUEIDENTIFIER,
  @Role         NVARCHAR(30),          -- 'coach_staff' | 'readonly' | 'global_admin'
  @CreatedBy    UNIQUEIDENTIFIER,
  @UserId       UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode    NVARCHAR(50)    OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;

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
    INSERT INTO dbo.users (id, email, password_hash, first_name, last_name, global_role, is_active, created_at)
    VALUES (@UserId, @Email, 'INVITE_PENDING', @FirstName, @LastName, 'readonly', 1, SYSUTCDATETIME());
  END

  -- Set / update role in user_teams
  IF NOT EXISTS (SELECT 1 FROM dbo.user_teams WHERE user_id = @UserId AND team_id = @TeamId)
  BEGIN
    INSERT INTO dbo.user_teams (user_id, team_id, role) VALUES (@UserId, @TeamId, @Role);
  END
  ELSE
  BEGIN
    UPDATE dbo.user_teams SET role = @Role WHERE user_id = @UserId AND team_id = @TeamId;
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

  -- Coaches also get alumni access
  IF @Role IN ('coach_staff', 'global_admin', 'platform_owner')
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

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, created_at)
  VALUES (
    @CreatedBy,
    'team_member_created',
    'user',
    @UserId,
    (SELECT @TeamId AS teamId, @Role AS role FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    SYSUTCDATETIME()
  );
END
GO
