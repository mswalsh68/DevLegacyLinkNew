-- ============================================================
-- GLOBAL DB — USER CONTACT & PROFILE STORED PROCEDURES
-- Run this file on: LegacyLinkGlobal database
-- Requires: 024_bigint_user_pk.sql to have run
-- ============================================================
-- Procedures:
--   sp_GetUserProfile    — full profile (users + user_contact); @UserId BIGINT
--   sp_UpsertUserContact — create/update contact info;          @TargetUserId BIGINT
--   sp_UpdateUserProfile — update first/last name;              @TargetUserId BIGINT
--   sp_SyncUserToAppDb   — returns user record for App DB sync; @UserId BIGINT
-- ============================================================

-- ============================================================
-- sp_GetUserProfile
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetUserProfile
  @UserId BIGINT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    u.user_id                         AS userId,
    u.email,
    u.first_name                      AS firstName,
    u.last_name                       AS lastName,
    u.role_id                         AS roleId,
    r.role_name                       AS role,
    u.is_active                       AS isActive,
    u.account_claimed                 AS accountClaimed,
    u.claimed_date                    AS claimedDate,
    u.last_login_at                   AS lastLoginAt,
    u.created_at                      AS createdAt,
    uc.phone,
    uc.address,
    uc.city,
    uc.state,
    uc.zipcode,
    uc.country,
    uc.emergency_contact_name_1  AS emergencyContactName1,
    uc.emergency_contact_email_1 AS emergencyContactEmail1,
    uc.emergency_contact_phone_1 AS emergencyContactPhone1,
    uc.emergency_contact_name_2  AS emergencyContactName2,
    uc.emergency_contact_email_2 AS emergencyContactEmail2,
    uc.emergency_contact_phone_2 AS emergencyContactPhone2,
    uc.twitter,
    uc.instagram,
    uc.facebook,
    uc.linked_in                 AS linkedIn,
    uc.updated_date              AS contactUpdatedDate
  FROM dbo.users u
  JOIN dbo.roles r ON r.id = u.role_id
  LEFT JOIN dbo.user_contact uc ON uc.user_id = u.user_id
  WHERE u.user_id = @UserId;
END;
GO

-- ============================================================
-- sp_UpsertUserContact
-- NULL params = no change (PATCH semantics).
-- Pass '' to explicitly clear a field.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpsertUserContact
  @TargetUserId              BIGINT,
  @ActorId                   BIGINT,
  @Phone                     NVARCHAR(20)   = NULL,
  @Address                   NVARCHAR(255)  = NULL,
  @City                      NVARCHAR(100)  = NULL,
  @State                     NVARCHAR(100)  = NULL,
  @Zipcode                   NVARCHAR(20)   = NULL,
  @Country                   NVARCHAR(100)  = NULL,
  @EmergencyContactName1     NVARCHAR(150)  = NULL,
  @EmergencyContactEmail1    NVARCHAR(255)  = NULL,
  @EmergencyContactPhone1    NVARCHAR(20)   = NULL,
  @EmergencyContactName2     NVARCHAR(150)  = NULL,
  @EmergencyContactEmail2    NVARCHAR(255)  = NULL,
  @EmergencyContactPhone2    NVARCHAR(20)   = NULL,
  @Twitter                   NVARCHAR(100)  = NULL,
  @Instagram                 NVARCHAR(100)  = NULL,
  @Facebook                  NVARCHAR(100)  = NULL,
  @LinkedIn                  NVARCHAR(255)  = NULL,
  @ErrorCode                 NVARCHAR(50)   OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @AccountClaimed BIT;
  SELECT @AccountClaimed = account_claimed
  FROM   dbo.users
  WHERE  user_id = @TargetUserId;

  IF @AccountClaimed IS NULL
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  IF @AccountClaimed = 1 AND @ActorId <> @TargetUserId
  BEGIN
    DECLARE @ActorRoleId INT;
    SELECT @ActorRoleId = role_id FROM dbo.users WHERE user_id = @ActorId;

    IF @ActorRoleId IS NULL OR @ActorRoleId > 2
    BEGIN
      SET @ErrorCode = 'ACCOUNT_CLAIMED_EDIT_DENIED';
      RETURN;
    END
  END

  IF NOT EXISTS (SELECT 1 FROM dbo.user_contact WHERE user_id = @TargetUserId)
    INSERT INTO dbo.user_contact (user_id) VALUES (@TargetUserId);

  UPDATE dbo.user_contact SET
    phone                     = CASE WHEN @Phone                  IS NULL THEN phone                     WHEN @Phone                  = '' THEN NULL ELSE @Phone                  END,
    address                   = CASE WHEN @Address                IS NULL THEN address                   WHEN @Address                = '' THEN NULL ELSE @Address                END,
    city                      = CASE WHEN @City                   IS NULL THEN city                      WHEN @City                   = '' THEN NULL ELSE @City                   END,
    state                     = CASE WHEN @State                  IS NULL THEN state                     WHEN @State                  = '' THEN NULL ELSE @State                  END,
    zipcode                   = CASE WHEN @Zipcode                IS NULL THEN zipcode                   WHEN @Zipcode                = '' THEN NULL ELSE @Zipcode                END,
    country                   = CASE WHEN @Country                IS NULL THEN country                   WHEN @Country                = '' THEN NULL ELSE @Country                END,
    emergency_contact_name_1  = CASE WHEN @EmergencyContactName1  IS NULL THEN emergency_contact_name_1  WHEN @EmergencyContactName1  = '' THEN NULL ELSE @EmergencyContactName1  END,
    emergency_contact_email_1 = CASE WHEN @EmergencyContactEmail1 IS NULL THEN emergency_contact_email_1 WHEN @EmergencyContactEmail1 = '' THEN NULL ELSE @EmergencyContactEmail1 END,
    emergency_contact_phone_1 = CASE WHEN @EmergencyContactPhone1 IS NULL THEN emergency_contact_phone_1 WHEN @EmergencyContactPhone1 = '' THEN NULL ELSE @EmergencyContactPhone1 END,
    emergency_contact_name_2  = CASE WHEN @EmergencyContactName2  IS NULL THEN emergency_contact_name_2  WHEN @EmergencyContactName2  = '' THEN NULL ELSE @EmergencyContactName2  END,
    emergency_contact_email_2 = CASE WHEN @EmergencyContactEmail2 IS NULL THEN emergency_contact_email_2 WHEN @EmergencyContactEmail2 = '' THEN NULL ELSE @EmergencyContactEmail2 END,
    emergency_contact_phone_2 = CASE WHEN @EmergencyContactPhone2 IS NULL THEN emergency_contact_phone_2 WHEN @EmergencyContactPhone2 = '' THEN NULL ELSE @EmergencyContactPhone2 END,
    twitter                   = CASE WHEN @Twitter                IS NULL THEN twitter                   WHEN @Twitter                = '' THEN NULL ELSE @Twitter                END,
    instagram                 = CASE WHEN @Instagram              IS NULL THEN instagram                 WHEN @Instagram              = '' THEN NULL ELSE @Instagram              END,
    facebook                  = CASE WHEN @Facebook               IS NULL THEN facebook                 WHEN @Facebook               = '' THEN NULL ELSE @Facebook               END,
    linked_in                 = CASE WHEN @LinkedIn               IS NULL THEN linked_in                 WHEN @LinkedIn               = '' THEN NULL ELSE @LinkedIn               END,
    updated_date              = SYSUTCDATETIME()
  WHERE user_id = @TargetUserId;
END;
GO

-- ============================================================
-- sp_UpdateUserProfile
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_UpdateUserProfile
  @TargetUserId BIGINT,
  @ActorId      BIGINT,
  @FirstName    NVARCHAR(100) = NULL,
  @LastName     NVARCHAR(100) = NULL,
  @ErrorCode    NVARCHAR(50)  OUTPUT
AS
BEGIN
  SET NOCOUNT ON;
  SET @ErrorCode = NULL;

  DECLARE @AccountClaimed BIT;
  SELECT @AccountClaimed = account_claimed
  FROM   dbo.users WHERE user_id = @TargetUserId;

  IF @AccountClaimed IS NULL
  BEGIN
    SET @ErrorCode = 'USER_NOT_FOUND';
    RETURN;
  END

  IF @AccountClaimed = 1 AND @ActorId <> @TargetUserId
  BEGIN
    DECLARE @ActorRoleId INT;
    SELECT @ActorRoleId = role_id FROM dbo.users WHERE user_id = @ActorId;
    IF @ActorRoleId IS NULL OR @ActorRoleId > 2
    BEGIN
      SET @ErrorCode = 'ACCOUNT_CLAIMED_EDIT_DENIED';
      RETURN;
    END
  END

  UPDATE dbo.users SET
    first_name = COALESCE(@FirstName, first_name),
    last_name  = COALESCE(@LastName,  last_name),
    updated_at = SYSUTCDATETIME()
  WHERE user_id = @TargetUserId;

  IF EXISTS (SELECT 1 FROM dbo.user_contact WHERE user_id = @TargetUserId)
    UPDATE dbo.user_contact
    SET    updated_date = SYSUTCDATETIME()
    WHERE  user_id = @TargetUserId;
  ELSE
    INSERT INTO dbo.user_contact (user_id) VALUES (@TargetUserId);
END;
GO

-- ============================================================
-- sp_SyncUserToAppDb
-- Returns the current user record for syncing to an App DB.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_SyncUserToAppDb
  @UserId BIGINT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    u.user_id        AS userId,
    u.email,
    u.first_name     AS firstName,
    u.last_name      AS lastName,
    r.role_name      AS platformRole,
    uc.updated_date  AS contactUpdatedDate
  FROM dbo.users u
  JOIN dbo.roles r ON r.id = u.role_id
  LEFT JOIN dbo.user_contact uc ON uc.user_id = u.user_id
  WHERE u.user_id = @UserId;
END;
GO
