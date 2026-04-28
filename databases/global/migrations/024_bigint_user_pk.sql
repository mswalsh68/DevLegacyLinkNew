-- ============================================================
-- Migration 024: Drop GUID PK from users — promote user_id to BIGINT PK
-- Run on: LegacyLinkGlobal database
-- Run after: 023_user_contact_int_fk.sql
-- ============================================================
-- Goal:
--   users.id (UNIQUEIDENTIFIER) was the original PK; users.user_id (INT IDENTITY)
--   was added alongside it in migration 020. This migration makes user_id BIGINT
--   the sole primary key and removes the GUID id column entirely.
--
--   All child tables that FK → users(id) are dropped and recreated with BIGINT
--   FK → users(user_id). Table PKs that were UNIQUEIDENTIFIER (invite_codes.id,
--   access_requests.id, user_teams.id, app_permissions.id, refresh_tokens.id,
--   audit_log.id, password_reset_tokens.id) are also changed to BIGINT IDENTITY.
--
--   Column naming is normalized to uniform snake_case throughout.
--   mswalsh68@gmail.com keeps user_id = 1 (set in migration 020).
--
-- Drop order (most-dependent → least):
--   access_requests → invite_codes → user_team_preferences → user_contact
--   → password_reset_tokens → audit_log → refresh_tokens → app_permissions
--   → user_teams → users
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 0. GUID → INT mapping (captured before any drops) ───────────────────────
-- user_id INT values from migration 020 become the new BIGINT PKs.

IF OBJECT_ID('tempdb..#UserMap') IS NOT NULL DROP TABLE #UserMap;

SELECT id AS guid_id, user_id AS int_id
INTO   #UserMap
FROM   dbo.users;

PRINT CONCAT('Captured GUID→INT mapping for ', @@ROWCOUNT, ' user(s)');
GO

-- ─── 1. Back up all child tables ─────────────────────────────────────────────

-- users core data (will be restored with IDENTITY_INSERT)
IF OBJECT_ID('tempdb..#UsersData') IS NOT NULL DROP TABLE #UsersData;

SELECT
  user_id, email, password_hash, first_name, last_name,
  role_id, is_active, token_version,
  account_claimed, claimed_date,
  last_login_at, created_at, updated_at
INTO #UsersData
FROM dbo.users;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' users row(s)');
GO

-- user_teams (map GUID user_id → INT)
IF OBJECT_ID('tempdb..#UTData') IS NOT NULL DROP TABLE #UTData;

SELECT m.int_id AS user_id, ut.team_id, ut.is_active, ut.created_at
INTO   #UTData
FROM   dbo.user_teams ut
JOIN   #UserMap m ON m.guid_id = ut.user_id;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' user_teams row(s)');
GO

-- app_permissions (map both user_id and granted_by)
IF OBJECT_ID('tempdb..#APData') IS NOT NULL DROP TABLE #APData;

SELECT
  mu.int_id AS user_id, mg.int_id AS granted_by,
  ap.app_name, ap.role, ap.granted_at, ap.revoked_at
INTO   #APData
FROM   dbo.app_permissions ap
JOIN   #UserMap mu ON mu.guid_id = ap.user_id
JOIN   #UserMap mg ON mg.guid_id = ap.granted_by;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' app_permissions row(s)');
GO

-- refresh_tokens
IF OBJECT_ID('tempdb..#RTData') IS NOT NULL DROP TABLE #RTData;

SELECT m.int_id AS user_id, rt.token_hash, rt.expires_at, rt.revoked_at, rt.device_info, rt.created_at
INTO   #RTData
FROM   dbo.refresh_tokens rt
JOIN   #UserMap m ON m.guid_id = rt.user_id;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' refresh_tokens row(s)');
GO

-- audit_log (actor_id is nullable)
IF OBJECT_ID('tempdb..#ALData') IS NOT NULL DROP TABLE #ALData;

SELECT
  m.int_id AS actor_id, al.actor_email,
  al.action, al.target_type, al.target_id,
  al.payload, al.ip_address, al.performed_at
INTO   #ALData
FROM   dbo.audit_log al
LEFT JOIN #UserMap m ON m.guid_id = al.actor_id;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' audit_log row(s)');
GO

-- password_reset_tokens
IF OBJECT_ID('tempdb..#PRTData') IS NOT NULL DROP TABLE #PRTData;

SELECT m.int_id AS user_id, prt.token_hash, prt.expires_at, prt.used_at, prt.created_at
INTO   #PRTData
FROM   dbo.password_reset_tokens prt
JOIN   #UserMap m ON m.guid_id = prt.user_id;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' password_reset_tokens row(s)');
GO

-- user_team_preferences (map GUID user_id → INT)
IF OBJECT_ID('tempdb..#UTPData') IS NOT NULL DROP TABLE #UTPData;

SELECT m.int_id AS user_id, utp.preferred_team_id, utp.updated_at
INTO   #UTPData
FROM   dbo.user_team_preferences utp
JOIN   #UserMap m ON m.guid_id = utp.user_id;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' user_team_preferences row(s)');
GO

-- user_contact (already uses user_id INT from migration 023 — just copy)
IF OBJECT_ID('tempdb..#UCData') IS NOT NULL DROP TABLE #UCData;

SELECT * INTO #UCData FROM dbo.user_contact;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' user_contact row(s)');
GO

-- invite_codes — store old GUID id alongside data for later mapping
IF OBJECT_ID('tempdb..#ICData') IS NOT NULL DROP TABLE #ICData;

SELECT
  ic.id AS old_guid_id,
  ic.team_id,
  ic.role,
  ic.token,
  m.int_id AS created_by,
  ic.expires_at, ic.max_uses, ic.use_count,
  ic.is_active, ic.created_at
INTO   #ICData
FROM   dbo.invite_codes ic
JOIN   #UserMap m ON m.guid_id = ic.created_by;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' invite_codes row(s)');
GO

-- access_requests — store old invite_code GUID for remapping after IC recreation
IF OBJECT_ID('tempdb..#ARData') IS NOT NULL DROP TABLE #ARData;

SELECT
  mu.int_id  AS user_id,
  ar.team_id,
  ar.role_id,
  ar.invite_code_id  AS old_invite_code_guid,   -- remapped after invite_codes recreated
  ar.status,
  mr.int_id  AS reviewed_by,
  ar.reviewed_at, ar.reminder_sent_at,
  ar.denial_reason,
  ar.created_at, ar.updated_at
INTO   #ARData
FROM   dbo.access_requests ar
JOIN   #UserMap mu ON mu.guid_id = ar.user_id
LEFT JOIN #UserMap mr ON mr.guid_id = ar.reviewed_by;

PRINT CONCAT('Backed up ', @@ROWCOUNT, ' access_requests row(s)');
GO

-- ─── 2. Drop tables in dependency order ──────────────────────────────────────
-- invite_tokens is a legacy table (superseded by invite_codes) that also FKs
-- to users(id). Print a warning if any unused tokens remain, then drop it.

IF OBJECT_ID('dbo.invite_tokens', 'U') IS NOT NULL
BEGIN
  DECLARE @PendingInviteCount INT = (
    SELECT COUNT(*) FROM dbo.invite_tokens WHERE used_at IS NULL AND expires_at > SYSUTCDATETIME()
  );
  IF @PendingInviteCount > 0
    PRINT CONCAT('WARNING: ', @PendingInviteCount, ' active invite_token(s) will be lost — users will need new invites');

  DROP TABLE dbo.invite_tokens;
  PRINT 'Dropped dbo.invite_tokens (legacy table, superseded by invite_codes)';
END
GO

IF OBJECT_ID('dbo.access_requests',       'U') IS NOT NULL DROP TABLE dbo.access_requests;
IF OBJECT_ID('dbo.invite_codes',          'U') IS NOT NULL DROP TABLE dbo.invite_codes;
IF OBJECT_ID('dbo.user_team_preferences', 'U') IS NOT NULL DROP TABLE dbo.user_team_preferences;
IF OBJECT_ID('dbo.user_contact',          'U') IS NOT NULL DROP TABLE dbo.user_contact;
IF OBJECT_ID('dbo.password_reset_tokens', 'U') IS NOT NULL DROP TABLE dbo.password_reset_tokens;
IF OBJECT_ID('dbo.audit_log',             'U') IS NOT NULL DROP TABLE dbo.audit_log;
IF OBJECT_ID('dbo.refresh_tokens',        'U') IS NOT NULL DROP TABLE dbo.refresh_tokens;
IF OBJECT_ID('dbo.app_permissions',       'U') IS NOT NULL DROP TABLE dbo.app_permissions;
IF OBJECT_ID('dbo.user_teams',            'U') IS NOT NULL DROP TABLE dbo.user_teams;
IF OBJECT_ID('dbo.users',                 'U') IS NOT NULL DROP TABLE dbo.users;

PRINT 'Dropped all user-dependent tables';
GO

-- ─── 3. Recreate dbo.users — BIGINT IDENTITY PK, no GUID ─────────────────────

CREATE TABLE dbo.users (
  user_id         BIGINT          NOT NULL IDENTITY(1,1)
                    CONSTRAINT PK_users PRIMARY KEY,
  email           NVARCHAR(255)   NOT NULL
                    CONSTRAINT UQ_users_email UNIQUE,
  password_hash   NVARCHAR(255)   NOT NULL,
  first_name      NVARCHAR(100)   NOT NULL,
  last_name       NVARCHAR(100)   NOT NULL,
  role_id         INT             NOT NULL
                    CONSTRAINT FK_users_role_id REFERENCES dbo.roles(id),
  is_active       BIT             NOT NULL DEFAULT 1,
  token_version   INT             NOT NULL DEFAULT 1,
  account_claimed BIT             NOT NULL DEFAULT 0,
  claimed_date    DATETIME2       NULL,
  last_login_at   DATETIME2       NULL,
  created_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at      DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_users_email   ON dbo.users(email);
CREATE INDEX IX_users_role_id ON dbo.users(role_id);

PRINT 'Created dbo.users (BIGINT PK)';
GO

-- Restore users using their existing integer IDs as BIGINT
SET IDENTITY_INSERT dbo.users ON;

INSERT INTO dbo.users (
  user_id, email, password_hash, first_name, last_name,
  role_id, is_active, token_version,
  account_claimed, claimed_date,
  last_login_at, created_at, updated_at
)
SELECT
  user_id, email, password_hash, first_name, last_name,
  role_id, is_active, token_version,
  account_claimed, claimed_date,
  last_login_at, created_at, updated_at
FROM #UsersData;

SET IDENTITY_INSERT dbo.users OFF;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' users row(s) with BIGINT IDs');
GO

-- ─── 4. Recreate dbo.user_teams ──────────────────────────────────────────────

CREATE TABLE dbo.user_teams (
  id          BIGINT    NOT NULL IDENTITY(1,1)
                CONSTRAINT PK_user_teams PRIMARY KEY,
  user_id     BIGINT    NOT NULL
                CONSTRAINT FK_user_teams_users REFERENCES dbo.users(user_id) ON DELETE CASCADE,
  team_id     INT       NOT NULL
                CONSTRAINT FK_user_teams_teams REFERENCES dbo.teams(id),
  is_active   BIT       NOT NULL DEFAULT 1,
  created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_user_team UNIQUE (user_id, team_id)
);

CREATE INDEX IX_user_teams_user_id ON dbo.user_teams(user_id);
CREATE INDEX IX_user_teams_team_id ON dbo.user_teams(team_id);

INSERT INTO dbo.user_teams (user_id, team_id, is_active, created_at)
SELECT user_id, team_id, is_active, created_at
FROM   #UTData;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' user_teams row(s)');
GO

-- ─── 5. Recreate dbo.app_permissions ─────────────────────────────────────────

CREATE TABLE dbo.app_permissions (
  id          BIGINT        NOT NULL IDENTITY(1,1)
                CONSTRAINT PK_app_permissions PRIMARY KEY,
  user_id     BIGINT        NOT NULL
                CONSTRAINT FK_app_perms_user    REFERENCES dbo.users(user_id) ON DELETE CASCADE,
  app_name    NVARCHAR(50)  NOT NULL,
  role        NVARCHAR(50)  NOT NULL,
  granted_by  BIGINT        NOT NULL
                CONSTRAINT FK_app_perms_granter REFERENCES dbo.users(user_id),
  granted_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  revoked_at  DATETIME2     NULL,
  CONSTRAINT UQ_user_app UNIQUE (user_id, app_name)
);

CREATE INDEX IX_app_permissions_user_id ON dbo.app_permissions(user_id);
CREATE INDEX IX_app_permissions_app     ON dbo.app_permissions(app_name);

INSERT INTO dbo.app_permissions (user_id, app_name, role, granted_by, granted_at, revoked_at)
SELECT user_id, app_name, role, granted_by, granted_at, revoked_at
FROM   #APData;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' app_permissions row(s)');
GO

-- ─── 6. Recreate dbo.refresh_tokens ──────────────────────────────────────────

CREATE TABLE dbo.refresh_tokens (
  id           BIGINT        NOT NULL IDENTITY(1,1)
                 CONSTRAINT PK_refresh_tokens PRIMARY KEY,
  user_id      BIGINT        NOT NULL
                 CONSTRAINT FK_refresh_tokens_user REFERENCES dbo.users(user_id) ON DELETE CASCADE,
  token_hash   NVARCHAR(255) NOT NULL
                 CONSTRAINT UQ_refresh_tokens_hash UNIQUE,
  expires_at   DATETIME2     NOT NULL,
  revoked_at   DATETIME2     NULL,
  device_info  NVARCHAR(255) NULL,
  created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_refresh_tokens_user_id ON dbo.refresh_tokens(user_id);

INSERT INTO dbo.refresh_tokens (user_id, token_hash, expires_at, revoked_at, device_info, created_at)
SELECT user_id, token_hash, expires_at, revoked_at, device_info, created_at
FROM   #RTData;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' refresh_tokens row(s)');
GO

-- ─── 7. Recreate dbo.audit_log ───────────────────────────────────────────────

CREATE TABLE dbo.audit_log (
  id           BIGINT        NOT NULL IDENTITY(1,1)
                 CONSTRAINT PK_audit_log PRIMARY KEY,
  actor_id     BIGINT        NULL
                 CONSTRAINT FK_audit_log_actor REFERENCES dbo.users(user_id) ON DELETE SET NULL,
  actor_email  NVARCHAR(255) NULL,
  action       NVARCHAR(100) NOT NULL,
  target_type  NVARCHAR(50)  NULL,
  target_id    NVARCHAR(255) NULL,
  payload      NVARCHAR(MAX) NULL,
  ip_address   NVARCHAR(50)  NULL,
  performed_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_audit_log_actor_id    ON dbo.audit_log(actor_id);
CREATE INDEX IX_audit_log_performed_at ON dbo.audit_log(performed_at DESC);

INSERT INTO dbo.audit_log (actor_id, actor_email, action, target_type, target_id, payload, ip_address, performed_at)
SELECT actor_id, actor_email, action, target_type, target_id, payload, ip_address, performed_at
FROM   #ALData;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' audit_log row(s)');
GO

-- ─── 8. Recreate dbo.password_reset_tokens ───────────────────────────────────

CREATE TABLE dbo.password_reset_tokens (
  id          BIGINT        NOT NULL IDENTITY(1,1)
                CONSTRAINT PK_password_reset_tokens PRIMARY KEY,
  user_id     BIGINT        NOT NULL
                CONSTRAINT FK_prt_user REFERENCES dbo.users(user_id) ON DELETE CASCADE,
  token_hash  NVARCHAR(255) NOT NULL
                CONSTRAINT UQ_prt_hash UNIQUE,
  expires_at  DATETIME2     NOT NULL,
  used_at     DATETIME2     NULL,
  created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_prt_user_id ON dbo.password_reset_tokens(user_id);

INSERT INTO dbo.password_reset_tokens (user_id, token_hash, expires_at, used_at, created_at)
SELECT user_id, token_hash, expires_at, used_at, created_at
FROM   #PRTData;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' password_reset_tokens row(s)');
GO

-- ─── 9. Recreate dbo.user_team_preferences ───────────────────────────────────

CREATE TABLE dbo.user_team_preferences (
  user_id           BIGINT    NOT NULL
                      CONSTRAINT PK_user_team_preferences PRIMARY KEY
                      CONSTRAINT FK_utp_user REFERENCES dbo.users(user_id) ON DELETE CASCADE,
  preferred_team_id INT       NOT NULL
                      CONSTRAINT FK_utp_team REFERENCES dbo.teams(id),
  updated_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

INSERT INTO dbo.user_team_preferences (user_id, preferred_team_id, updated_at)
SELECT user_id, preferred_team_id, updated_at
FROM   #UTPData;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' user_team_preferences row(s)');
GO

-- ─── 10. Recreate dbo.user_contact ───────────────────────────────────────────

CREATE TABLE dbo.user_contact (
  user_id                   BIGINT         NOT NULL
                              CONSTRAINT PK_user_contact       PRIMARY KEY
                              CONSTRAINT FK_user_contact_users FOREIGN KEY
                                REFERENCES dbo.users(user_id) ON DELETE CASCADE,
  phone                     NVARCHAR(20)   NULL,
  address                   NVARCHAR(255)  NULL,
  city                      NVARCHAR(100)  NULL,
  state                     NVARCHAR(100)  NULL,
  zipcode                   NVARCHAR(20)   NULL,
  country                   NVARCHAR(100)  NULL DEFAULT 'US',
  emergency_contact_name_1  NVARCHAR(150)  NULL,
  emergency_contact_email_1 NVARCHAR(255)  NULL,
  emergency_contact_phone_1 NVARCHAR(20)   NULL,
  emergency_contact_name_2  NVARCHAR(150)  NULL,
  emergency_contact_email_2 NVARCHAR(255)  NULL,
  emergency_contact_phone_2 NVARCHAR(20)   NULL,
  twitter                   NVARCHAR(100)  NULL,
  instagram                 NVARCHAR(100)  NULL,
  facebook                  NVARCHAR(100)  NULL,
  linked_in                 NVARCHAR(255)  NULL,
  updated_date              DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

INSERT INTO dbo.user_contact (
  user_id, phone, address, city, state, zipcode, country,
  emergency_contact_name_1, emergency_contact_email_1, emergency_contact_phone_1,
  emergency_contact_name_2, emergency_contact_email_2, emergency_contact_phone_2,
  twitter, instagram, facebook, linked_in, updated_date
)
SELECT
  user_id, phone, address, city, state, zipcode, country,
  emergency_contact_name_1, emergency_contact_email_1, emergency_contact_phone_1,
  emergency_contact_name_2, emergency_contact_email_2, emergency_contact_phone_2,
  twitter, instagram, facebook, linked_in, updated_date
FROM #UCData;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' user_contact row(s)');
GO

-- ─── 11. Recreate dbo.invite_codes (BIGINT PK) ───────────────────────────────

CREATE TABLE dbo.invite_codes (
  id          BIGINT        NOT NULL IDENTITY(1,1)
                CONSTRAINT PK_invite_codes PRIMARY KEY,
  team_id     INT           NOT NULL
                CONSTRAINT FK_invite_codes_teams REFERENCES dbo.teams(id) ON DELETE CASCADE,
  role        NVARCHAR(30)  NOT NULL,
  token       NVARCHAR(128) NOT NULL,
  created_by  BIGINT        NOT NULL
                CONSTRAINT FK_invite_codes_creator REFERENCES dbo.users(user_id),
  expires_at  DATETIME2     NULL,
  max_uses    INT           NULL,
  use_count   INT           NOT NULL DEFAULT 0,
  is_active   BIT           NOT NULL DEFAULT 1,
  created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_invite_codes_token UNIQUE (token)
);

CREATE INDEX IX_invite_codes_team_id  ON dbo.invite_codes(team_id);
CREATE INDEX IX_invite_codes_is_active ON dbo.invite_codes(is_active);

INSERT INTO dbo.invite_codes (team_id, role, token, created_by, expires_at, max_uses, use_count, is_active, created_at)
SELECT team_id, role, token, created_by, expires_at, max_uses, use_count, is_active, created_at
FROM   #ICData;

PRINT CONCAT('Restored ', @@ROWCOUNT, ' invite_codes row(s)');
GO

-- Build invite_code GUID → new BIGINT id mapping (join on unique token)
IF OBJECT_ID('tempdb..#ICMap') IS NOT NULL DROP TABLE #ICMap;

SELECT ic.id AS new_id, b.old_guid_id
INTO   #ICMap
FROM   dbo.invite_codes ic
JOIN   #ICData b ON b.token = ic.token;

PRINT CONCAT('Built invite_code mapping for ', @@ROWCOUNT, ' row(s)');
GO

-- ─── 12. Recreate dbo.access_requests ────────────────────────────────────────

CREATE TABLE dbo.access_requests (
  id               BIGINT        NOT NULL IDENTITY(1,1)
                     CONSTRAINT PK_access_requests PRIMARY KEY,
  user_id          BIGINT        NOT NULL
                     CONSTRAINT FK_ar_user REFERENCES dbo.users(user_id),
  team_id          INT           NOT NULL
                     CONSTRAINT FK_ar_team REFERENCES dbo.teams(id),
  role_id          INT           NOT NULL
                     CONSTRAINT FK_ar_role REFERENCES dbo.roles(id),
  invite_code_id   BIGINT        NOT NULL
                     CONSTRAINT FK_ar_invite_code REFERENCES dbo.invite_codes(id),
  status           NVARCHAR(20)  NOT NULL DEFAULT 'pending'
                     CONSTRAINT CK_ar_status CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by      BIGINT        NULL
                     CONSTRAINT FK_ar_reviewer REFERENCES dbo.users(user_id),
  reviewed_at      DATETIME2     NULL,
  reminder_sent_at DATETIME2     NULL,
  denial_reason    NVARCHAR(MAX) NULL,
  created_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_ar_user_id   ON dbo.access_requests(user_id);
CREATE INDEX IX_ar_team_id   ON dbo.access_requests(team_id);
CREATE INDEX IX_ar_status    ON dbo.access_requests(status);
CREATE INDEX IX_ar_role_id   ON dbo.access_requests(role_id);

INSERT INTO dbo.access_requests (
  user_id, team_id, role_id, invite_code_id,
  status, reviewed_by, reviewed_at,
  reminder_sent_at, denial_reason,
  created_at, updated_at
)
SELECT
  ar.user_id,
  ar.team_id,
  ar.role_id,
  m.new_id AS invite_code_id,
  ar.status,
  ar.reviewed_by,
  ar.reviewed_at,
  ar.reminder_sent_at,
  ar.denial_reason,
  ar.created_at,
  ar.updated_at
FROM   #ARData ar
JOIN   #ICMap  m ON CAST(m.old_guid_id AS NVARCHAR(50)) = CAST(ar.old_invite_code_guid AS NVARCHAR(50));

PRINT CONCAT('Restored ', @@ROWCOUNT, ' access_requests row(s)');
GO

-- ─── Verification ─────────────────────────────────────────────────────────────

SELECT user_id, email, first_name, last_name, role_id,
       is_active, account_claimed
FROM   dbo.users
ORDER  BY user_id;

SELECT ut.user_id, u.email, ut.team_id, t.name AS team_name
FROM   dbo.user_teams ut
JOIN   dbo.users u ON u.user_id = ut.user_id
JOIN   dbo.teams t ON t.id     = ut.team_id
ORDER  BY ut.user_id;

PRINT '=== Migration 024 complete ===';
GO
