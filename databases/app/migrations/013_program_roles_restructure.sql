-- ============================================================
-- MIGRATION 012 — Restructure dbo.program_role
-- Run on: LegacyLinkApp (and every future tenant App DB)
-- Run after: 011_feed_v2.sql / 011_pinned_welcome_posts.sql
-- ============================================================
-- New order (aligns with global migration 028):
--
--   ID  role_name          display_name
--   1   athletic_director  Athletic Director
--   2   program_admin      Program Admin       ← new
--   3   alumni_director    Alumni Director
--   4   head_coach         Head Coach
--   5   coach              Coach               ← was assistant_coach
--   6   support_staff      Support Staff       ← was staff
--   7   alumni             Alumni
--   8   player             Player
--
-- Old → New ID mapping for users_roles FK:
--   1 (player)            → 8
--   2 (alumni)            → 7
--   3 (head_coach)        → 4
--   4 (assistant_coach)   → 5
--   5 (athletic_director) → 1
--   6 (admin)             → 2
--   7 (staff)             → 6
--   8 (volunteer)         → 6  (nearest equivalent: support_staff)
-- ============================================================

USE LegacyLinkApp
GO

-- ─── Step 1: Remap users_roles.program_role_id to new IDs ────────────────────
-- Use negative intermediates to avoid transient uniqueness collisions.

UPDATE dbo.users_roles
SET program_role_id = -program_role_id
WHERE program_role_id IN (1, 2, 3, 4, 5, 6, 7, 8);
PRINT CONCAT('Negated ', @@ROWCOUNT, ' users_roles row(s) for safe remapping');
GO

UPDATE dbo.users_roles SET program_role_id = 8 WHERE program_role_id = -1;  -- player → 8
UPDATE dbo.users_roles SET program_role_id = 7 WHERE program_role_id = -2;  -- alumni → 7
UPDATE dbo.users_roles SET program_role_id = 4 WHERE program_role_id = -3;  -- head_coach → 4
UPDATE dbo.users_roles SET program_role_id = 5 WHERE program_role_id = -4;  -- assistant_coach → 5 (coach)
UPDATE dbo.users_roles SET program_role_id = 1 WHERE program_role_id = -5;  -- athletic_director → 1
UPDATE dbo.users_roles SET program_role_id = 2 WHERE program_role_id = -6;  -- admin → 2 (program_admin)
UPDATE dbo.users_roles SET program_role_id = 6 WHERE program_role_id = -7;  -- staff → 6 (support_staff)
UPDATE dbo.users_roles SET program_role_id = 6 WHERE program_role_id = -8;  -- volunteer → 6 (support_staff)
PRINT 'Remapped all users_roles program_role_id values to new IDs';
GO

-- ─── Step 2: Drop FK constraint so we can rebuild the lookup table ────────────

IF EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = 'FK_users_roles_program_role'
)
BEGIN
  ALTER TABLE dbo.users_roles DROP CONSTRAINT FK_users_roles_program_role;
  PRINT 'Dropped FK_users_roles_program_role';
END
ELSE
  PRINT 'FK_users_roles_program_role not found — skipping drop';
GO

-- ─── Step 3: Clear and rebuild dbo.program_role ───────────────────────────────

DELETE FROM dbo.program_role;
PRINT CONCAT('Cleared dbo.program_role: ', @@ROWCOUNT, ' row(s) removed');
GO

SET IDENTITY_INSERT dbo.program_role ON;

INSERT INTO dbo.program_role (id, role_name, display_name, sort_order) VALUES
  (1, 'athletic_director', 'Athletic Director', 1),
  (2, 'program_admin',     'Program Admin',     2),
  (3, 'alumni_director',   'Alumni Director',   3),
  (4, 'head_coach',        'Head Coach',        4),
  (5, 'coach',             'Coach',             5),
  (6, 'support_staff',     'Support Staff',     6),
  (7, 'alumni',            'Alumni',            7),
  (8, 'player',            'Player',            8);

SET IDENTITY_INSERT dbo.program_role OFF;
PRINT 'Re-seeded dbo.program_role with 8 rows';
GO

-- ─── Step 4: Re-add FK constraint ────────────────────────────────────────────

ALTER TABLE dbo.users_roles
  ADD CONSTRAINT FK_users_roles_program_role
      FOREIGN KEY (program_role_id) REFERENCES dbo.program_role(id);
PRINT 'Re-added FK_users_roles_program_role';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────

SELECT id, role_name, display_name, sort_order
FROM   dbo.program_role
ORDER  BY sort_order;

SELECT pr.display_name AS program_role, COUNT(ur.user_role_id) AS user_count
FROM   dbo.program_role pr
LEFT JOIN dbo.users_roles ur ON ur.program_role_id = pr.id
GROUP  BY pr.id, pr.display_name, pr.sort_order
ORDER  BY pr.sort_order;
GO

PRINT '=== Migration 012 complete ===';
GO
