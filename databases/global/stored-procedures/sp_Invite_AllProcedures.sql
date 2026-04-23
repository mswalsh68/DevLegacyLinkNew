-- ─── Invite Code & Access Request Stored Procedures ─────────────────────────
-- All procedures assume tables from migrations 016 + 017 exist.
-- Run 016_invite_codes.sql and 017_access_requests.sql first.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── sp_RegisterUserViaInvite ─────────────────────────────────────────────────
-- Creates a new user account for self-signup via invite code.
-- Unlike sp_GetOrCreateUser (which sets password_hash = 'INVITE_PENDING'),
-- this SP stores the bcrypt hash supplied by the caller so the user can log in
-- immediately after their access request is approved.
-- Returns EMAIL_EXISTS if the email is already in use (caller should switch to login).

CREATE OR ALTER PROCEDURE dbo.sp_RegisterUserViaInvite
  @Email        NVARCHAR(255),
  @PasswordHash NVARCHAR(MAX),
  @FirstName    NVARCHAR(100),
  @LastName     NVARCHAR(100),
  @UserId       UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode    NVARCHAR(50)     OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;

  -- Check for existing account
  SELECT @UserId = id FROM dbo.users WHERE email = @Email;

  IF @UserId IS NOT NULL
  BEGIN
    SET @ErrorCode = 'EMAIL_EXISTS';
    RETURN;
  END

  SET @UserId = NEWID();

  INSERT INTO dbo.users (id, email, password_hash, first_name, last_name, global_role, is_active, created_at)
  VALUES (@UserId, @Email, @PasswordHash, @FirstName, @LastName, 'readonly', 1, SYSUTCDATETIME());

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
  VALUES (
    @UserId,
    'user_self_registered',
    'user',
    @UserId,
    (SELECT @Email AS email, 'invite_code' AS via FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    SYSUTCDATETIME()
  );
END
GO

-- ─── sp_ValidateInviteCode ────────────────────────────────────────────────────
-- Looks up a token and returns team + role info without modifying anything.
-- Use this for the preview card before account creation or form submission.

CREATE OR ALTER PROCEDURE dbo.sp_ValidateInviteCode
  @Token NVARCHAR(128)
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    ic.id                                                   AS inviteCodeId,
    ic.team_id                                              AS teamId,
    t.name                                                  AS teamName,
    t.abbr                                                  AS teamAbbr,
    tc.sport,
    ic.role,
    ic.use_count                                            AS useCount,
    ic.max_uses                                             AS maxUses,
    ic.expires_at                                           AS expiresAt,
    CASE
      WHEN ic.is_active = 0                                      THEN 'INACTIVE'
      WHEN ic.expires_at IS NOT NULL
       AND ic.expires_at < SYSUTCDATETIME()                      THEN 'EXPIRED'
      WHEN ic.max_uses IS NOT NULL
       AND ic.use_count >= ic.max_uses                           THEN 'MAX_USES_REACHED'
      ELSE NULL
    END                                                     AS errorReason
  FROM dbo.invite_codes ic
  JOIN dbo.teams t       ON t.id       = ic.team_id
  LEFT JOIN dbo.team_config tc ON tc.team_id = t.id
  WHERE ic.token = @Token;
END
GO

-- ─── sp_CreateInviteCode ──────────────────────────────────────────────────────
-- Creates a new invite code scoped to a team + role.
-- Token is passed in from the caller (UUID generated server-side).

CREATE OR ALTER PROCEDURE dbo.sp_CreateInviteCode
  @TeamId      UNIQUEIDENTIFIER,
  @Role        NVARCHAR(30),
  @Token       NVARCHAR(128),
  @CreatedBy   UNIQUEIDENTIFIER,
  @ExpiresAt   DATETIME2        = NULL,
  @MaxUses     INT              = NULL,
  @InviteCodeId UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode   NVARCHAR(50)     OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode    = NULL;
  SET @InviteCodeId = NEWID();

  -- Verify team exists and is active
  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  -- Verify creator has access to this team
  IF NOT EXISTS (
    SELECT 1 FROM dbo.users WHERE id = @CreatedBy
      AND (global_role IN ('global_admin', 'platform_owner'))
    UNION
    SELECT 1 FROM dbo.user_teams WHERE user_id = @CreatedBy AND team_id = @TeamId
  )
  BEGIN
    SET @ErrorCode = 'FORBIDDEN';
    RETURN;
  END

  INSERT INTO dbo.invite_codes (id, team_id, role, token, created_by, expires_at, max_uses)
  VALUES (@InviteCodeId, @TeamId, @Role, @Token, @CreatedBy, @ExpiresAt, @MaxUses);

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
  VALUES (
    @CreatedBy,
    'invite_code_created',
    'invite_code',
    @InviteCodeId,
    (SELECT @TeamId AS teamId, @Role AS role FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    SYSUTCDATETIME()
  );
END
GO

-- ─── sp_ListInviteCodes ───────────────────────────────────────────────────────
-- Returns all invite codes for a team (active and inactive).

CREATE OR ALTER PROCEDURE dbo.sp_ListInviteCodes
  @TeamId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    ic.id           AS inviteCodeId,
    ic.token,
    ic.role,
    ic.use_count    AS useCount,
    ic.max_uses     AS maxUses,
    ic.expires_at   AS expiresAt,
    ic.is_active    AS isActive,
    ic.created_at   AS createdAt,
    u.first_name    AS createdByFirstName,
    u.last_name     AS createdByLastName
  FROM dbo.invite_codes ic
  JOIN dbo.users u ON u.id = ic.created_by
  WHERE ic.team_id = @TeamId
  ORDER BY ic.created_at DESC;
END
GO

-- ─── sp_DeactivateInviteCode ──────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_DeactivateInviteCode
  @InviteCodeId  UNIQUEIDENTIFIER,
  @DeactivatedBy UNIQUEIDENTIFIER,
  @ErrorCode     NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.invite_codes WHERE id = @InviteCodeId)
  BEGIN
    SET @ErrorCode = 'NOT_FOUND';
    RETURN;
  END

  UPDATE dbo.invite_codes
  SET    is_active = 0
  WHERE  id = @InviteCodeId;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
  VALUES (
    @DeactivatedBy,
    'invite_code_deactivated',
    'invite_code',
    @InviteCodeId,
    NULL,
    SYSUTCDATETIME()
  );
END
GO

-- ─── sp_SubmitAccessRequest ───────────────────────────────────────────────────
-- Creates an access_request row and increments the invite code use_count.
-- Validates the code is still valid before writing.
-- One pending request per user+team is enforced (idempotent).

CREATE OR ALTER PROCEDURE dbo.sp_SubmitAccessRequest
  @UserId       UNIQUEIDENTIFIER,
  @Token        NVARCHAR(128),
  @RequestId    UNIQUEIDENTIFIER OUTPUT,
  @ErrorCode    NVARCHAR(50)     OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @RequestId = NULL;
  SET @ErrorCode = NULL;

  DECLARE @InviteCodeId UNIQUEIDENTIFIER;
  DECLARE @TeamId       UNIQUEIDENTIFIER;
  DECLARE @Role         NVARCHAR(30);
  DECLARE @IsActive     BIT;
  DECLARE @ExpiresAt    DATETIME2;
  DECLARE @MaxUses      INT;
  DECLARE @UseCount     INT;

  SELECT
    @InviteCodeId = ic.id,
    @TeamId       = ic.team_id,
    @Role         = ic.role,
    @IsActive     = ic.is_active,
    @ExpiresAt    = ic.expires_at,
    @MaxUses      = ic.max_uses,
    @UseCount     = ic.use_count
  FROM dbo.invite_codes ic
  WHERE ic.token = @Token;

  IF @InviteCodeId IS NULL
  BEGIN
    SET @ErrorCode = 'INVALID_CODE';
    RETURN;
  END

  IF @IsActive = 0
  BEGIN
    SET @ErrorCode = 'INACTIVE';
    RETURN;
  END

  IF @ExpiresAt IS NOT NULL AND @ExpiresAt < SYSUTCDATETIME()
  BEGIN
    SET @ErrorCode = 'EXPIRED';
    RETURN;
  END

  IF @MaxUses IS NOT NULL AND @UseCount >= @MaxUses
  BEGIN
    SET @ErrorCode = 'MAX_USES_REACHED';
    RETURN;
  END

  -- Idempotent: if a pending request already exists for this user+team, return it
  SELECT @RequestId = id
  FROM   dbo.access_requests
  WHERE  user_id = @UserId AND team_id = @TeamId AND status = 'pending';

  IF @RequestId IS NOT NULL
  BEGIN
    SET @ErrorCode = 'ALREADY_PENDING';
    RETURN;
  END

  SET @RequestId = NEWID();

  INSERT INTO dbo.access_requests
    (id, user_id, team_id, role, invite_code_id, status)
  VALUES
    (@RequestId, @UserId, @TeamId, @Role, @InviteCodeId, 'pending');

  -- Increment use count
  UPDATE dbo.invite_codes
  SET    use_count = use_count + 1
  WHERE  id = @InviteCodeId;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
  VALUES (
    @UserId,
    'access_request_submitted',
    'access_request',
    @RequestId,
    (SELECT @TeamId AS teamId, @Role AS role FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    SYSUTCDATETIME()
  );
END
GO

-- ─── sp_GetMyAccessRequests ───────────────────────────────────────────────────
-- Returns all access requests for a given user with team + status details.

CREATE OR ALTER PROCEDURE dbo.sp_GetMyAccessRequests
  @UserId UNIQUEIDENTIFIER
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    ar.id               AS requestId,
    ar.team_id          AS teamId,
    t.name              AS teamName,
    tc.sport,
    ar.role,
    ar.status,
    ar.denial_reason    AS denialReason,
    ar.reminder_sent_at AS reminderSentAt,
    ar.created_at       AS createdAt,
    ar.updated_at       AS updatedAt
  FROM dbo.access_requests ar
  JOIN dbo.teams t          ON t.id       = ar.team_id
  LEFT JOIN dbo.team_config tc ON tc.team_id = t.id
  WHERE ar.user_id = @UserId
  ORDER BY ar.created_at DESC;
END
GO

-- ─── sp_GetPendingAccessRequests ─────────────────────────────────────────────
-- Returns pending requests visible to a given admin.
-- global_admin / platform_owner see all teams; others see only their teams.

CREATE OR ALTER PROCEDURE dbo.sp_GetPendingAccessRequests
  @AdminUserId UNIQUEIDENTIFIER,
  @StatusFilter NVARCHAR(20) = 'pending'   -- 'pending' | 'approved' | 'denied' | 'all'
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @GlobalRole NVARCHAR(30);
  SELECT @GlobalRole = global_role FROM dbo.users WHERE id = @AdminUserId;

  SELECT
    ar.id               AS requestId,
    ar.user_id          AS userId,
    u.email,
    u.first_name        AS firstName,
    u.last_name         AS lastName,
    ar.team_id          AS teamId,
    t.name              AS teamName,
    ar.role,
    ar.status,
    ar.denial_reason    AS denialReason,
    ar.reminder_sent_at AS reminderSentAt,
    ar.created_at       AS createdAt,
    rv.first_name       AS reviewedByFirstName,
    rv.last_name        AS reviewedByLastName,
    ar.reviewed_at      AS reviewedAt
  FROM dbo.access_requests ar
  JOIN dbo.users u  ON u.id  = ar.user_id
  JOIN dbo.teams t  ON t.id  = ar.team_id
  LEFT JOIN dbo.users rv ON rv.id = ar.reviewed_by
  WHERE
    (@StatusFilter = 'all' OR ar.status = @StatusFilter)
    AND (
      @GlobalRole IN ('global_admin', 'platform_owner')
      OR EXISTS (
        SELECT 1 FROM dbo.user_teams ut
        WHERE ut.user_id = @AdminUserId AND ut.team_id = ar.team_id
      )
    )
  ORDER BY ar.created_at ASC;
END
GO

-- ─── sp_ReviewAccessRequest ───────────────────────────────────────────────────
-- Approves or denies an access request.
-- On APPROVE: inserts into user_teams (same write as sp_GetOrCreateUser approval)
--   and inserts an app_permission row matching the role.
-- On DENY: sets status and stores optional denial_reason.
-- Returns the userId + teamId so the server action can send a notification.

CREATE OR ALTER PROCEDURE dbo.sp_ReviewAccessRequest
  @RequestId    UNIQUEIDENTIFIER,
  @ReviewedBy   UNIQUEIDENTIFIER,
  @Action       NVARCHAR(10),          -- 'approve' | 'deny'
  @Role         NVARCHAR(30)  = NULL,  -- override role on approve (optional)
  @DenialReason NVARCHAR(MAX) = NULL,
  @UserId       UNIQUEIDENTIFIER OUTPUT,
  @TeamId       UNIQUEIDENTIFIER OUTPUT,
  @FinalRole    NVARCHAR(30)  OUTPUT,
  @ErrorCode    NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;
  SET @TeamId    = NULL;
  SET @FinalRole = NULL;

  DECLARE @CurrentStatus NVARCHAR(20);
  DECLARE @RequestedRole NVARCHAR(30);

  SELECT
    @UserId        = user_id,
    @TeamId        = team_id,
    @CurrentStatus = status,
    @RequestedRole = role
  FROM dbo.access_requests
  WHERE id = @RequestId;

  IF @UserId IS NULL
  BEGIN
    SET @ErrorCode = 'NOT_FOUND';
    RETURN;
  END

  IF @CurrentStatus <> 'pending'
  BEGIN
    SET @ErrorCode = 'ALREADY_REVIEWED';
    RETURN;
  END

  SET @FinalRole = COALESCE(@Role, @RequestedRole);

  IF @Action = 'approve'
  BEGIN
    -- Mirror sp_GetOrCreateUser: insert into user_teams
    IF NOT EXISTS (
      SELECT 1 FROM dbo.user_teams WHERE user_id = @UserId AND team_id = @TeamId
    )
    BEGIN
      INSERT INTO dbo.user_teams (user_id, team_id, role)
      VALUES (@UserId, @TeamId, @FinalRole);
    END
    ELSE
    BEGIN
      UPDATE dbo.user_teams
      SET    role = @FinalRole
      WHERE  user_id = @UserId AND team_id = @TeamId;
    END

    -- Grant app permission matching the role
    DECLARE @AppName NVARCHAR(50);
    SET @AppName = CASE
      WHEN @FinalRole IN ('roster', 'coach_staff') THEN 'roster'
      WHEN @FinalRole = 'alumni'                   THEN 'alumni'
      ELSE 'roster'
    END;

    IF NOT EXISTS (
      SELECT 1 FROM dbo.app_permissions
      WHERE user_id = @UserId AND app_name = @AppName AND revoked_at IS NULL
    )
    BEGIN
      INSERT INTO dbo.app_permissions (user_id, app_name, role, granted_by)
      VALUES (@UserId, @AppName, @FinalRole, @ReviewedBy);
    END

    UPDATE dbo.access_requests
    SET
      status      = 'approved',
      reviewed_by = @ReviewedBy,
      reviewed_at = SYSUTCDATETIME(),
      updated_at  = SYSUTCDATETIME()
    WHERE id = @RequestId;

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
    VALUES (
      @ReviewedBy,
      'access_request_approved',
      'access_request',
      @RequestId,
      (SELECT @UserId AS userId, @TeamId AS teamId, @FinalRole AS role FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
      SYSUTCDATETIME()
    );
  END
  ELSE IF @Action = 'deny'
  BEGIN
    UPDATE dbo.access_requests
    SET
      status        = 'denied',
      reviewed_by   = @ReviewedBy,
      reviewed_at   = SYSUTCDATETIME(),
      denial_reason = @DenialReason,
      updated_at    = SYSUTCDATETIME()
    WHERE id = @RequestId;

    INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
    VALUES (
      @ReviewedBy,
      'access_request_denied',
      'access_request',
      @RequestId,
      (SELECT @UserId AS userId, @DenialReason AS reason FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
      SYSUTCDATETIME()
    );
  END
  ELSE
  BEGIN
    SET @ErrorCode = 'INVALID_ACTION';
  END
END
GO

-- ─── sp_SendRequestReminder ───────────────────────────────────────────────────
-- Sets reminder_sent_at to now. Only allowed if null or older than 48 hours.

CREATE OR ALTER PROCEDURE dbo.sp_SendRequestReminder
  @RequestId UNIQUEIDENTIFIER,
  @UserId    UNIQUEIDENTIFIER,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @CurrentStatus     NVARCHAR(20);
  DECLARE @ReminderSentAt    DATETIME2;
  DECLARE @RequestUserId     UNIQUEIDENTIFIER;

  SELECT
    @CurrentStatus  = status,
    @ReminderSentAt = reminder_sent_at,
    @RequestUserId  = user_id
  FROM dbo.access_requests
  WHERE id = @RequestId;

  IF @RequestUserId IS NULL
  BEGIN
    SET @ErrorCode = 'NOT_FOUND';
    RETURN;
  END

  IF @RequestUserId <> @UserId
  BEGIN
    SET @ErrorCode = 'FORBIDDEN';
    RETURN;
  END

  IF @CurrentStatus <> 'pending'
  BEGIN
    SET @ErrorCode = 'NOT_PENDING';
    RETURN;
  END

  IF @ReminderSentAt IS NOT NULL
     AND DATEDIFF(HOUR, @ReminderSentAt, SYSUTCDATETIME()) < 48
  BEGIN
    SET @ErrorCode = 'REMINDER_TOO_SOON';
    RETURN;
  END

  UPDATE dbo.access_requests
  SET    reminder_sent_at = SYSUTCDATETIME(),
         updated_at       = SYSUTCDATETIME()
  WHERE  id = @RequestId;
END
GO
