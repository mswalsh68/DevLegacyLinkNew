-- ============================================================
-- Migration 040: Post and email audience permissions
--
-- Tiers:         1=starter (alumni-only — implicitly denied below)
--                2=pro  3=enterprise
-- Program roles: 1=athletic_director  2=program_admin   3=alumni_director
--                4=head_coach         5=coach           6=support_staff
--                7=alumni             8=player
--
-- post:audience_all    — roles 1-6 can post to Everyone (alumni + roster)
--                        Tier 2+ only. Tier 1 = implicit deny (alumni-only plan).
-- post:audience_roster — roles 1-6 can post to Roster only.
--                        Tier 2+ only.
-- email:audience_all   — roles 1-6 can email Everyone.
--                        Tier 2+ only.
-- email:audience_roster— roles 1-6 can email Roster only.
--                        Tier 2+ only.
--
-- Roles 7 (alumni) and 8 (player) are never seeded = always denied.
-- Tier 1 is implicitly denied (no rows = canAsync returns false).
--
-- Run on: DevLegacyLinkGlobal
-- Run after: 039_drop_program_role.sql
-- ============================================================

-- ── post:audience_all ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'post:audience_all')
BEGIN
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'post:audience_all', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t
    WHERE t.id >= 2;

    PRINT 'Seeded post:audience_all rows (roles 1-6, tiers 2-3)';
END
ELSE
    PRINT 'post:audience_all already seeded — skipping';
GO

-- ── post:audience_roster ──────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'post:audience_roster')
BEGIN
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'post:audience_roster', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t
    WHERE t.id >= 2;

    PRINT 'Seeded post:audience_roster rows (roles 1-6, tiers 2-3)';
END
ELSE
    PRINT 'post:audience_roster already seeded — skipping';
GO

-- ── email:audience_all ────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'email:audience_all')
BEGIN
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'email:audience_all', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t
    WHERE t.id >= 2;

    PRINT 'Seeded email:audience_all rows (roles 1-6, tiers 2-3)';
END
ELSE
    PRINT 'email:audience_all already seeded — skipping';
GO

-- ── email:audience_roster ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'email:audience_roster')
BEGIN
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'email:audience_roster', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t
    WHERE t.id >= 2;

    PRINT 'Seeded email:audience_roster rows (roles 1-6, tiers 2-3)';
END
ELSE
    PRINT 'email:audience_roster already seeded — skipping';
GO

PRINT 'Migration 040 complete';
GO
