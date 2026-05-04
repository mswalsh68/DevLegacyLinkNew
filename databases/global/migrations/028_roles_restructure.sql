-- ============================================================
-- MIGRATION 028 — Restructure dbo.roles to 3 roles
-- Run on: LegacyLinkGlobal database
-- Run after: 027_eligibility_years.sql
-- ============================================================
-- Goal: collapse 7 roles → 3 roles
--
--   ID  Old name            New name        Type    Notes
--   1   platform_owner   →  super_admin     global  Internal — name change only
--   2   app_admin        →  support_admin   global  Internal — name change only
--   3   head_coach       →  client          app     External — repurposed; all non-Legacy-Link users
--   4   position_coach   →  (deleted)               → migrate users to client (3)
--   5   alumni_director  →  (deleted)               → migrate users to client (3)
--   6   player           →  (deleted)               → migrate users to client (3)
--   7   alumni           →  (deleted)               → migrate users to client (3)
--
-- Every external user now gets role_id = 3 (client).
-- Their program-level category (Head Coach, Player, etc.) is stored in
-- App DB dbo.users_roles.program_role_id.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 1. Rename role 1: platform_owner → super_admin ──────────────────────────

UPDATE dbo.roles
SET role_name   = 'super_admin',
    role_type   = 'global',
    description = 'Internal — full access to all teams and platform settings; no restrictions'
WHERE id = 1;
PRINT CONCAT('Renamed role 1 (platform_owner → super_admin): ', @@ROWCOUNT, ' row(s)');
GO

-- ─── 2. Rename role 2: app_admin → support_admin ─────────────────────────────

UPDATE dbo.roles
SET role_name   = 'support_admin',
    role_type   = 'global',
    description = 'Internal — support-level access across the platform'
WHERE id = 2;
PRINT CONCAT('Renamed role 2 (app_admin → support_admin): ', @@ROWCOUNT, ' row(s)');
GO

-- ─── 3. Repurpose role 3: head_coach → client ────────────────────────────────

UPDATE dbo.roles
SET role_name   = 'client',
    role_type   = 'app',
    description = 'External — every user not employed by Legacy Link; program category stored in App DB users_roles'
WHERE id = 3;
PRINT CONCAT('Repurposed role 3 (head_coach → client): ', @@ROWCOUNT, ' row(s)');
GO

-- ─── 4. Migrate users with old app roles (4–7) → client (3) ──────────────────

UPDATE dbo.users
SET role_id = 3
WHERE role_id IN (4, 5, 6, 7);
PRINT CONCAT('Migrated ', @@ROWCOUNT, ' user(s) to client role (3)');
GO

-- ─── 5. Migrate access_requests with old app roles (4–7) → client (3) ────────

UPDATE dbo.access_requests
SET role_id = 3
WHERE role_id IN (4, 5, 6, 7);
PRINT CONCAT('Migrated ', @@ROWCOUNT, ' access_request(s) to client role (3)');
GO

-- ─── 6. Delete obsolete roles 4–7 ────────────────────────────────────────────

DELETE FROM dbo.roles WHERE id IN (4, 5, 6, 7);
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' obsolete role(s) (4–7)');
GO

-- ─── Verification ─────────────────────────────────────────────────────────────

SELECT id, role_type, role_name, description
FROM   dbo.roles
ORDER  BY id;

SELECT r.id AS role_id, r.role_name, COUNT(u.user_id) AS user_count
FROM   dbo.roles r
LEFT JOIN dbo.users u ON u.role_id = r.id
GROUP  BY r.id, r.role_name
ORDER  BY r.id;
GO

PRINT '=== Migration 028 complete ===';
GO
