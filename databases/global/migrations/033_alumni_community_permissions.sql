-- ============================================================
-- Migration 033: Alumni Community feature permissions
--
-- Adds permission rows for:
--   community:directory_view  — view the alumni directory
--   community:email_alumni    — send email to an alumnus
--
-- Program roles (App DB dbo.program_role, platform-standard):
--   1=athletic_director  2=program_admin   3=alumni_director
--   4=head_coach         5=coach           6=support_staff
--   7=alumni             8=player
--
-- Tiers: 1=starter  2=pro  3=enterprise
--
-- Matrix:
--   community:directory_view — roles 1-8, all tiers allowed
--   community:email_alumni   — roles 1-6 (staff), all tiers
--                              role 7 (alumni): tier 2+ only
--                              role 8 (player): denied all tiers
--
-- Run on: DevLegacyLinkGlobal
-- Run after: 032_fix_feed_permissions.sql
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'community:directory_view')
BEGIN
    -- community:directory_view — all roles, all tiers
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'community:directory_view', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t;

    PRINT 'Seeded community:directory_view rows';
END
ELSE
    PRINT 'community:directory_view already seeded — skipping';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'community:email_alumni')
BEGIN
    -- community:email_alumni — roles 1-6 (staff), all tiers
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'community:email_alumni', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t;

    -- role 7 (alumni): tier 2+ allowed
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'community:email_alumni', 7, t.id, NULL, 1, NULL
    FROM dbo.tiers t WHERE t.id >= 2;

    -- role 7 (alumni): tier 1 denied
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    VALUES ('community:email_alumni', 7, 1, NULL, 0, NULL);

    -- role 8 (player): all tiers denied
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'community:email_alumni', 8, t.id, NULL, 0, NULL
    FROM dbo.tiers t;

    PRINT 'Seeded community:email_alumni rows';
END
ELSE
    PRINT 'community:email_alumni already seeded — skipping';
GO

PRINT 'Migration 033 complete';
GO
