-- ============================================================
-- MIGRATION 018 — Normalized roles table (revised)
-- Run on: LegacyLinkGlobal database
-- Run after: 017_access_requests.sql
-- ============================================================
-- Design:
--   ONE role per user. The role defines what a user can do.
--   Team scope (which team) comes from dbo.user_teams (junction, no role column).
--   Sport scope (which sport) comes from App DB dbo.users_sports + dbo.sports.
--
-- Role hierarchy (ordered by privilege, lowest ID = highest privilege):
--
--   ID  role_name         type    Description
--   1   platform_owner    global  Full access, all teams, no restrictions
--   2   app_admin         app     Full access within their assigned team
--   3   head_coach        app     Full player + alumni access for their sport(s);
--                                 can edit player/alumni records and transfer players
--   4   position_coach    app     Full player profile + edit for their sport(s),
--                                 current roster only; no alumni access
--   5   alumni_director   app     View roster; transfer players to alumni;
--                                 full alumni view + edit; cannot message players
--   6   player            app     Own profile, player feed, message players
--   7   alumni            app     Own profile, alumni feed, message alumni
--
-- Changes in this migration:
--   1. Create dbo.roles with 7 seed rows
--   2. Add users.role_id (INT FK) — the single role for this user
--   3. Backfill role_id from legacy global_role string
--   4. Enforce NOT NULL on users.role_id
--   5. Add access_requests.role_id (INT FK) and backfill
--   6. Drop the legacy app_role_id from user_teams (if migration 018 was
--      previously run with the old two-role design)
--
-- NOTE: Legacy string columns (users.global_role, user_teams.role,
-- access_requests.role) are kept in this migration so existing SPs
-- continue working. They will be dropped in migration 019 after all
-- SPs are updated to use role_id.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 1. Create dbo.roles ─────────────────────────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'roles'
)
BEGIN
  CREATE TABLE dbo.roles (
    id          INT           NOT NULL,
    role_type   NVARCHAR(10)  NOT NULL
                  CONSTRAINT CK_roles_role_type CHECK (role_type IN ('global', 'app')),
    role_name   NVARCHAR(50)  NOT NULL,
    description NVARCHAR(255) NOT NULL,
    CONSTRAINT PK_roles      PRIMARY KEY (id),
    CONSTRAINT UQ_roles_name UNIQUE      (role_name)
  );
  PRINT 'Created dbo.roles';
END
ELSE
  PRINT 'dbo.roles already exists — skipping CREATE';
GO

-- ─── 2. Seed role definitions ─────────────────────────────────────────────────

MERGE dbo.roles AS target
USING (VALUES
  (1, 'global', 'platform_owner',   'Full access to all teams and platform settings — no restrictions'),
  (2, 'app',    'app_admin',         'Full access within their assigned team (Athletic Director or admin)'),
  (3, 'app',    'head_coach',        'Full player and alumni access for assigned sport(s); can edit records and transfer players to alumni'),
  (4, 'app',    'position_coach',    'Full player profile and edit access for assigned sport(s), current roster only; no alumni access'),
  (5, 'app',    'alumni_director',   'View roster; transfer players to alumni; full alumni view and edit; cannot message players'),
  (6, 'app',    'player',            'Own profile, player feed, and player-to-player messaging'),
  (7, 'app',    'alumni',            'Own profile, alumni feed, and alumni-to-alumni messaging')
) AS source (id, role_type, role_name, description)
ON target.id = source.id
WHEN MATCHED THEN
  UPDATE SET
    role_type   = source.role_type,
    role_name   = source.role_name,
    description = source.description
WHEN NOT MATCHED THEN
  INSERT (id, role_type, role_name, description)
  VALUES (source.id, source.role_type, source.role_name, source.description);

PRINT CONCAT('Upserted ', @@ROWCOUNT, ' role(s)');
GO

-- ─── 3. Add users.role_id ────────────────────────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role_id'
)
BEGIN
  ALTER TABLE dbo.users
    ADD role_id INT NULL
        CONSTRAINT FK_users_role_id REFERENCES dbo.roles(id);
  PRINT 'Added role_id to dbo.users';
END
ELSE
  PRINT 'users.role_id already exists — skipping';
GO

-- Clean up old two-role column if previous draft of 018 ran
IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'global_role_id'
)
BEGIN
  -- Drop FK first
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_global_role_id')
    ALTER TABLE dbo.users DROP CONSTRAINT FK_users_global_role_id;
  ALTER TABLE dbo.users DROP COLUMN global_role_id;
  PRINT 'Dropped users.global_role_id (replaced by role_id)';
END
GO

-- ─── 4. Backfill users.role_id from global_role string ───────────────────────
--
-- Mapping from legacy string → new role ID:
--   platform_owner → 1
--   global_admin   → 2  (treated as app_admin at platform level)
--   app_admin      → 2
--   coach_staff    → 3  (head_coach is most permissive — can be corrected per user)
--   coach          → 3  (legacy alias)
--   staff          → 3  (legacy alias — reassign manually if needed)
--   player         → 6
--   readonly       → 7  (alumni is closest read-only; reassign manually if needed)
--   read_only      → 7  (legacy alias)
--   (anything else)→ 7  (safe default — least privilege)

UPDATE dbo.users
SET role_id = CASE global_role
    WHEN 'platform_owner' THEN 1
    WHEN 'global_admin'   THEN 2
    WHEN 'app_admin'      THEN 2
    WHEN 'coach_staff'    THEN 3
    WHEN 'coach'          THEN 3
    WHEN 'staff'          THEN 3
    WHEN 'player'         THEN 6
    WHEN 'readonly'       THEN 7
    WHEN 'read_only'      THEN 7
    ELSE                       7
  END
WHERE role_id IS NULL;

PRINT CONCAT('Backfilled role_id for ', @@ROWCOUNT, ' user(s)');
GO

-- ─── 5. Enforce NOT NULL on users.role_id ────────────────────────────────────

DECLARE @NullCount INT = (SELECT COUNT(*) FROM dbo.users WHERE role_id IS NULL);
IF @NullCount > 0
  PRINT CONCAT('WARNING: ', @NullCount, ' user(s) still have NULL role_id — fix before enforcing NOT NULL');
ELSE
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_users_role_id')
    ALTER TABLE dbo.users DROP CONSTRAINT FK_users_role_id;

  ALTER TABLE dbo.users ALTER COLUMN role_id INT NOT NULL;

  ALTER TABLE dbo.users
    ADD CONSTRAINT FK_users_role_id FOREIGN KEY (role_id) REFERENCES dbo.roles(id);

  PRINT 'Set users.role_id NOT NULL';
END
GO

-- ─── 6. Clean up user_teams — role lives on the user, not the team row ───────
-- user_teams is now a clean junction: user ↔ team (+ optional sport scope in App DB).
-- Drop app_role_id if previous draft of 018 added it.

IF EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'user_teams' AND COLUMN_NAME = 'app_role_id'
)
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_teams_app_role_id')
    ALTER TABLE dbo.user_teams DROP CONSTRAINT FK_user_teams_app_role_id;
  ALTER TABLE dbo.user_teams DROP COLUMN app_role_id;
  PRINT 'Dropped user_teams.app_role_id (role is now on the user record)';
END
ELSE
  PRINT 'user_teams.app_role_id not found — nothing to drop';
GO

-- ─── 7. Add access_requests.role_id ─────────────────────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'access_requests' AND COLUMN_NAME = 'role_id'
)
BEGIN
  ALTER TABLE dbo.access_requests
    ADD role_id INT NULL
        CONSTRAINT FK_access_requests_role_id REFERENCES dbo.roles(id);
  PRINT 'Added role_id to dbo.access_requests';
END
ELSE
  PRINT 'access_requests.role_id already exists — skipping';
GO

UPDATE dbo.access_requests
SET role_id = CASE role
    WHEN 'platform_owner'  THEN 1
    WHEN 'global_admin'    THEN 2
    WHEN 'app_admin'       THEN 2
    WHEN 'coach_staff'     THEN 3
    WHEN 'coach'           THEN 3
    WHEN 'staff'           THEN 3
    WHEN 'alumni_director' THEN 5
    WHEN 'player'          THEN 6
    WHEN 'readonly'        THEN 7
    WHEN 'read_only'       THEN 7
    ELSE                        7
  END
WHERE role_id IS NULL;

PRINT CONCAT('Backfilled role_id for ', @@ROWCOUNT, ' access_request(s)');
GO

-- ─── 8. Indexes ──────────────────────────────────────────────────────────────

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_users_role_id' AND object_id = OBJECT_ID('dbo.users'))
  CREATE INDEX IX_users_role_id ON dbo.users(role_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_access_requests_role_id' AND object_id = OBJECT_ID('dbo.access_requests'))
  CREATE INDEX IX_access_requests_role_id ON dbo.access_requests(role_id);

PRINT 'Indexes created';
GO

-- ─── Verification queries ─────────────────────────────────────────────────────
--
-- Run these after the migration to confirm:
--
--   SELECT id, role_type, role_name, description FROM dbo.roles ORDER BY id;
--
--   SELECT u.email, u.global_role, u.role_id, r.role_name
--   FROM   dbo.users u
--   JOIN   dbo.roles r ON r.id = u.role_id
--   ORDER  BY r.id, u.email;
--
--   -- Confirm no user has a role_id that doesn't match their intent:
--   SELECT u.email, u.global_role AS legacy_role, r.role_name AS new_role
--   FROM   dbo.users u JOIN dbo.roles r ON r.id = u.role_id
--   WHERE  u.global_role NOT IN ('platform_owner','global_admin','app_admin','player')
--   ORDER  BY u.email;
--   -- Review any coach_staff / staff rows and manually UPDATE role_id to 4 or 5 as needed.
--
-- ─── Next steps (migration 019) ──────────────────────────────────────────────
--   1. Update all stored procedures to SELECT/JOIN dbo.roles and return role_id + role_name
--   2. Update sp_Login to emit roleId in UserJson
--   3. Update sp_SwitchTeam to emit roleId
--   4. Update JWT / AuthProvider / permissions.ts to use role IDs
--   5. DROP users.global_role, user_teams.role, access_requests.role
-- ─────────────────────────────────────────────────────────────────────────────

PRINT '=== Migration 018 complete ===';
GO
