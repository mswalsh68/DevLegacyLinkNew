-- ============================================================
-- Migration 004: App DB users table + program_role lookup
-- Run on: LegacyLinkApp (and every future tenant App DB)
-- Run after: 003_seed_all_sports.sql
-- ============================================================
-- Creates:
--   dbo.program_role  — UI category lookup (player, alumni, coach…)
--   dbo.users         — thin sync table, source of truth is Global DB
--
-- Design principles:
--   • user_id INT matches dbo.users.user_id in LegacyLinkGlobal exactly.
--     mswalsh68@gmail.com = 1 in Global = 1 in every App DB.
--   • platform_role synced from global dbo.roles.role_name
--     (the permission role — app_admin, head_coach, etc.)
--   • program_role_id FK → dbo.program_role
--     (the program-level category — player, alumni, staff, etc.)
--     Set manually per-team; not synced from global.
--   • first_name, last_name, email synced from global on team switch.
--   • last_team_login updated on each login to this specific client.
--   • synced_at records when global data was last pushed here.
--
-- Edit rules (enforced in global SPs, not here):
--   account_claimed = 0 → any admin with access may edit the user
--   account_claimed = 1 → only the user may edit their own profile
-- ============================================================

-- ─── 1. dbo.program_role lookup ──────────────────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'program_role'
)
BEGIN
  CREATE TABLE dbo.program_role (
    id           INT           NOT NULL IDENTITY(1,1)
                                 CONSTRAINT PK_program_role PRIMARY KEY,
    role_name    NVARCHAR(50)  NOT NULL
                                 CONSTRAINT UQ_program_role_name UNIQUE,
    display_name NVARCHAR(100) NOT NULL,
    sort_order   INT           NOT NULL DEFAULT 0,
    is_active    BIT           NOT NULL DEFAULT 1
  );

  SET IDENTITY_INSERT dbo.program_role ON;
  INSERT INTO dbo.program_role (id, role_name, display_name, sort_order) VALUES
    (1, 'player',            'Player',            1),
    (2, 'alumni',            'Alumni',            2),
    (3, 'head_coach',        'Head Coach',        3),
    (4, 'assistant_coach',   'Assistant Coach',   4),
    (5, 'athletic_director', 'Athletic Director', 5),
    (6, 'admin',             'Admin',             6),
    (7, 'staff',             'Staff',             7),
    (8, 'volunteer',         'Volunteer',         8);
  SET IDENTITY_INSERT dbo.program_role OFF;

  PRINT 'Created dbo.program_role and seeded 8 rows';
END
ELSE
  PRINT 'dbo.program_role already exists — skipping';
GO

-- ─── 2. dbo.users (App DB thin sync table) ───────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'users'
)
BEGIN
  CREATE TABLE dbo.users (
    -- user_id matches LegacyLinkGlobal.dbo.users.user_id (INT IDENTITY)
    -- Same integer across Global and every App DB — guaranteed by creation flow.
    user_id         INT           NOT NULL
                      CONSTRAINT PK_app_users PRIMARY KEY,

    -- Synced from global on team switch (delta-checked via user_contact.updated_date)
    email           NVARCHAR(255) NOT NULL,
    first_name      NVARCHAR(100) NOT NULL,
    last_name       NVARCHAR(100) NOT NULL,

    -- platform_role: synced from global dbo.roles.role_name
    -- Reflects the user's permission level (app_admin, head_coach, etc.)
    platform_role   NVARCHAR(50)  NOT NULL DEFAULT 'player',

    -- program_role: local to this team's App DB
    -- UI categorization only — player, alumni, coach, staff, etc.
    program_role_id INT           NULL
                      CONSTRAINT FK_app_users_program_role
                        FOREIGN KEY REFERENCES dbo.program_role(id),

    -- Per-client login tracking
    last_team_login DATETIME2     NULL,

    -- When global data was last pushed to this row
    synced_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UQ_app_users_email ON dbo.users(email);

  PRINT 'Created dbo.users (App DB sync table)';
END
ELSE
  PRINT 'dbo.users already exists — skipping';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT id, role_name, display_name FROM dbo.program_role ORDER BY sort_order;
SELECT user_id, email, platform_role, program_role_id, last_team_login FROM dbo.users ORDER BY user_id;

PRINT '=== Migration 004 complete ===';
GO
