-- ─── Invite Code & Access Request Stored Procedures ─────────────────────────
-- All procedures assume tables from migrations 016 + 017 + 018 + 019 + 024 exist.
-- Updated for migration 024: UNIQUEIDENTIFIER → BIGINT for all user IDs;
--   invite_codes.id and access_requests.id are now BIGINT IDENTITY (no NEWID()).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── sp_RegisterUserViaInvite ─────────────────────────────────────────────────
-- Creates a new user account for self-signup via invite code.
-- Returns EMAIL_EXISTS if the email is already in use.

CREATE OR ALTER PROCEDURE dbo.sp_RegisterUserViaInvite
  @Email        NVARCHAR(255),
  @PasswordHash NVARCHAR(MAX),
  @FirstName    NVARCHAR(100),
  @LastName     NVARCHAR(100),
  @UserId       BIGINT       OUTPUT,
  @ErrorCode    NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;

  SELECT @UserId = user_id FROM dbo.users WHERE email = @Email;

  IF @UserId IS NOT NULL
  BEGIN
    SET @ErrorCode = 'EMAIL_EXISTS';
    RETURN;
  END

  -- role_id = 7 (alumni) — lowest privilege, placeholder until request is approved
  INSERT INTO dbo.users (email, password_hash, first_name, last_name, role_id, is_active)
  VALUES (@Email, @PasswordHash, @FirstName, @LastName, 7, 1);

  SET @UserId = SCOPE_IDENTITY();

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
  VALUES (
    @UserId,
    'user_self_registered',
    'user',
    CAST(@UserId AS NVARCHAR(20)),
    (SELECT @Email AS email, 'invite_code' AS via FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    SYSUTCDATETIME()
  );
END
GO

-- ─── sp_ValidateInviteCode ────────────────────────────────────────────────────
-- Looks up a token and returns team + role info without modifying anything.

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
  @TeamId       INT,
  @Role         NVARCHAR(30),
  @Token        NVARCHAR(128),
  @CreatedBy    BIGINT,
  @ExpiresAt    DATETIME2     = NULL,
  @MaxUses      INT           = NULL,
  @InviteCodeId BIGINT        OUTPUT,
  @ErrorCode    NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode    = NULL;
  SET @InviteCodeId = NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.teams WHERE id = @TeamId AND is_active = 1)
  BEGIN
    SET @ErrorCode = 'TEAM_NOT_FOUND';
    RETURN;
  END

  IF NOT EXISTS (
    SELECT 1 FROM dbo.users WHERE user_id = @CreatedBy AND role_id IN (1, 2)
    UNION
    SELECT 1 FROM dbo.user_teams WHERE user_id = @CreatedBy AND team_id = @TeamId
  )
  BEGIN
    SET @ErrorCode = 'FORBIDDEN';
    RETURN;
  END

  INSERT INTO dbo.invite_codes (team_id, role, token, created_by, expires_at, max_uses)
  VALUES (@TeamId, @Role, @Token, @CreatedBy, @ExpiresAt, @MaxUses);

  SET @InviteCodeId = SCOPE_IDENTITY();

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
  VALUES (
    @CreatedBy,
    'invite_code_created',
    'invite_code',
    CAST(@InviteCodeId AS NVARCHAR(20)),
    (SELECT @TeamId AS teamId, @Role AS role FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    SYSUTCDATETIME()
  );
END
GO

-- ─── sp_ListInviteCodes ───────────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_ListInviteCodes
  @TeamId INT
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
  JOIN dbo.users u ON u.user_id = ic.created_by
  WHERE ic.team_id = @TeamId
  ORDER BY ic.created_at DESC;
END
GO

-- ─── sp_DeactivateInviteCode ──────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_DeactivateInviteCode
  @InviteCodeId  BIGINT,
  @DeactivatedBy BIGINT,
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
    CAST(@InviteCodeId AS NVARCHAR(20)),
    NULL,
    SYSUTCDATETIME()
  );
END
GO

-- ─── sp_SubmitAccessRequest ───────────────────────────────────────────────────
-- Creates an access_request row and increments the invite code use_count.

CREATE OR ALTER PROCEDURE dbo.sp_SubmitAccessRequest
  @UserId       BIGINT,
  @Token        NVARCHAR(128),
  @RequestId    BIGINT       OUTPUT,
  @ErrorCode    NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @RequestId = NULL;
  SET @ErrorCode = NULL;

  DECLARE @InviteCodeId BIGINT;
  DECLARE @TeamId       INT;
  DECLARE @RoleName     NVARCHAR(30);
  DECLARE @RoleId       INT;
  DECLARE @IsActive     BIT;
  DECLARE @ExpiresAt    DATETIME2;
  DECLARE @MaxUses      INT;
  DECLARE @UseCount     INT;

  SELECT
    @InviteCodeId = ic.id,
    @TeamId       = ic.team_id,
    @RoleName     = ic.role,
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

  -- Idempotent: return existing pending request if already submitted
  SELECT @RequestId = id
  FROM   dbo.access_requests
  WHERE  user_id = @UserId AND team_id = @TeamId AND status = 'pending';

  IF @RequestId IS NOT NULL
  BEGIN
    SET @ErrorCode = 'ALREADY_PENDING';
    RETURN;
  END

  SELECT @RoleId = id FROM dbo.roles WHERE role_name = @RoleName;
  IF @RoleId IS NULL SET @RoleId = 7;

  INSERT INTO dbo.access_requests
    (user_id, team_id, role_id, invite_code_id, status)
  VALUES
    (@UserId, @TeamId, @RoleId, @InviteCodeId, 'pending');

  SET @RequestId = SCOPE_IDENTITY();

  UPDATE dbo.invite_codes
  SET    use_count = use_count + 1
  WHERE  id = @InviteCodeId;

  INSERT INTO dbo.audit_log (actor_id, action, target_type, target_id, payload, performed_at)
  VALUES (
    @UserId,
    'access_request_submitted',
    'access_request',
    CAST(@RequestId AS NVARCHAR(20)),
    (SELECT @TeamId AS teamId, @RoleName AS role FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
    SYSUTCDATETIME()
  );
END
GO

-- ─── sp_GetMyAccessRequests ───────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_GetMyAccessRequests
  @UserId BIGINT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    ar.id               AS requestId,
    ar.team_id          AS teamId,
    t.name              AS teamName,
    tc.sport,
    r.role_name         AS role,
    ar.status,
    ar.denial_reason    AS denialReason,
    ar.reminder_sent_at AS reminderSentAt,
    ar.created_at       AS createdAt,
    ar.updated_at       AS updatedAt
  FROM dbo.access_requests ar
  JOIN dbo.teams t              ON t.id      = ar.team_id
  LEFT JOIN dbo.team_config tc  ON tc.team_id = t.id
  LEFT JOIN dbo.roles r         ON r.id       = ar.role_id
  WHERE ar.user_id = @UserId
  ORDER BY ar.created_at DESC;
END
GO

-- ─── sp_GetPendingAccessRequests ─────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_GetPendingAccessRequests
  @AdminUserId  BIGINT,
  @StatusFilter NVARCHAR(20) = 'pending'
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @AdminRoleId INT;
  SELECT @AdminRoleId = role_id FROM dbo.users WHERE user_id = @AdminUserId;

  SELECT
    ar.id               AS requestId,
    ar.user_id          AS userId,
    u.email,
    u.first_name        AS firstName,
    u.last_name         AS lastName,
    ar.team_id          AS teamId,
    t.name              AS teamName,
    r.role_name         AS role,
    ar.status,
    ar.denial_reason    AS denialReason,
    ar.reminder_sent_at AS reminderSentAt,
    ar.created_at       AS createdAt,
    rv.first_name       AS reviewedByFirstName,
    rv.last_name        AS reviewedByLastName,
    ar.reviewed_at      AS reviewedAt
  FROM dbo.access_requests ar
  JOIN dbo.users u             ON u.user_id  = ar.user_id
  JOIN dbo.teams t             ON t.id       = ar.team_id
  LEFT JOIN dbo.users rv       ON rv.user_id = ar.reviewed_by
  LEFT JOIN dbo.roles r        ON r.id       = ar.role_id
  WHERE
    (@StatusFilter = 'all' OR ar.status = @StatusFilter)
    AND (
      @AdminRoleId IN (1, 2)
      OR EXISTS (
        SELECT 1 FROM dbo.user_teams ut
        WHERE ut.user_id = @AdminUserId AND ut.team_id = ar.team_id
      )
    )
  ORDER BY ar.created_at ASC;
END
GO

-- ─── sp_ReviewAccessRequest ───────────────────────────────────────────────────

CREATE OR ALTER PROCEDURE dbo.sp_ReviewAccessRequest
  @RequestId    BIGINT,
  @ReviewedBy   BIGINT,
  @Action       NVARCHAR(10),
  @Role         NVARCHAR(30)  = NULL,
  @DenialReason NVARCHAR(MAX) = NULL,
  @UserId       BIGINT        OUTPUT,
  @TeamId       INT           OUTPUT,
  @FinalRole    NVARCHAR(30)  OUTPUT,
  @ErrorCode    NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;
  SET @UserId    = NULL;
  SET @TeamId    = NULL;
  SET @FinalRole = NULL;

  DECLARE @CurrentStatus   NVARCHAR(20);
  DECLARE @RequestedRoleId INT;
  DECLARE @RequestedRole   NVARCHAR(30);

  SELECT
    @UserId          = ar.user_id,
    @TeamId          = ar.team_id,
    @CurrentStatus   = ar.status,
    @RequestedRoleId = ar.role_id
  FROM dbo.access_requests ar
  WHERE ar.id = @RequestId;

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

  SELECT @RequestedRole = role_name FROM dbo.roles WHERE id = @RequestedRoleId;

  SET @FinalRole = COALESCE(@Role, @RequestedRole);

  IF @Action = 'approve'
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM dbo.user_teams WHERE user_id = @UserId AND team_id = @TeamId
    )
    BEGIN
      INSERT INTO dbo.user_teams (user_id, team_id)
      VALUES (@UserId, @TeamId);
    END

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
      CAST(@RequestId AS NVARCHAR(20)),
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
      CAST(@RequestId AS NVARCHAR(20)),
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

CREATE OR ALTER PROCEDURE dbo.sp_SendRequestReminder
  @RequestId BIGINT,
  @UserId    BIGINT,
  @ErrorCode NVARCHAR(50) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @CurrentStatus  NVARCHAR(20);
  DECLARE @ReminderSentAt DATETIME2;
  DECLARE @RequestUserId  BIGINT;

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
