-- ============================================================
-- Migration 032: Fix FEED feature_permissions seed data
--
-- Migration 031 used incorrect program_role_id mappings.
-- Actual dbo.program_role IDs (platform-standard, never customized):
--   1=athletic_director  2=program_admin   3=alumni_director
--   4=head_coach         5=coach           6=support_staff
--   7=alumni             8=player
--
-- Deletes all FEED rows and re-seeds with correct IDs.
--
-- Run on: DevLegacyLinkGlobal
-- Run after: 031_feature_permissions.sql
-- ============================================================

DELETE FROM dbo.feature_permissions
WHERE feature_key IN ('feed:view','feed:like','feed:sport_filter','feed:post','feed:pin','feed:delete_any');

PRINT 'Cleared stale FEED feature_permissions rows';
GO

-- ─── feed:view — all roles, all tiers ─────────────────────────
-- Role 8 (player) scoped to own_sport; all others unrestricted.
INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
SELECT
    'feed:view',
    r.program_role_id,
    t.id,
    NULL,
    1,
    CASE WHEN r.program_role_id = 8 THEN 'own_sport' ELSE NULL END
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) AS r(program_role_id)
CROSS JOIN dbo.tiers t;

-- ─── feed:like — all roles, all tiers ─────────────────────────
INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
SELECT 'feed:like', r.program_role_id, t.id, NULL, 1, NULL
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) AS r(program_role_id)
CROSS JOIN dbo.tiers t;

-- ─── feed:sport_filter — all roles, all tiers ─────────────────
INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
SELECT 'feed:sport_filter', r.program_role_id, t.id, NULL, 1, NULL
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) AS r(program_role_id)
CROSS JOIN dbo.tiers t;

-- ─── feed:post — roles 1-3 (admin/director tier), any sport ───
INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
SELECT 'feed:post', r.program_role_id, t.id, NULL, 1, 'any_sport'
FROM (VALUES (1),(2),(3)) AS r(program_role_id)
CROSS JOIN dbo.tiers t;

-- ─── feed:post — roles 4-6 (coaching/staff), own sport only ───
INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
SELECT 'feed:post', r.program_role_id, t.id, NULL, 1, 'own_sport'
FROM (VALUES (4),(5),(6)) AS r(program_role_id)
CROSS JOIN dbo.tiers t;

-- ─── feed:post — role 7 (alumni), tier 2+ allowed (own sport); tier 1 denied
INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
SELECT 'feed:post', 7, t.id, NULL, 1, 'own_sport'
FROM dbo.tiers t WHERE t.id >= 2;

INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
VALUES ('feed:post', 7, 1, NULL, 0, NULL);

-- ─── feed:post — role 8 (player), all tiers denied ────────────
INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
SELECT 'feed:post', 8, t.id, NULL, 0, NULL
FROM dbo.tiers t;

-- ─── feed:pin — roles 1-3 (admin/director), all tiers ─────────
INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
SELECT 'feed:pin', r.program_role_id, t.id, NULL, 1, NULL
FROM (VALUES (1),(2),(3)) AS r(program_role_id)
CROSS JOIN dbo.tiers t;

-- ─── feed:delete_any — roles 1-2 (athletic_director, program_admin) ──
INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
SELECT 'feed:delete_any', r.program_role_id, t.id, NULL, 1, NULL
FROM (VALUES (1),(2)) AS r(program_role_id)
CROSS JOIN dbo.tiers t;

PRINT 'Re-seeded FEED feature_permissions with correct program_role_ids';
GO

PRINT 'Migration 032 complete';
GO
