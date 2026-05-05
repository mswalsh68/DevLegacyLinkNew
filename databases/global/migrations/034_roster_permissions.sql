-- ============================================================
-- Migration 034: Roster feature permissions
--
-- Tiers:         1=starter (denied — no rows)  2=pro  3=enterprise
-- Program roles: 1=athletic_director  2=program_admin   3=alumni_director
--                4=head_coach         5=coach           6=support_staff
--                7=alumni             8=player
--
-- roster:manage         — roles 1-6, tiers 2-3
-- roster:player_accounts— role 8,    tiers 2-3
-- roster:promote_to_alumni — roles 1-6, tiers 2-3
--
-- Tier 1 is implicitly denied (no rows = canAsync returns false).
-- T3 HS vs T3 Col are not yet differentiated (level_id NULL covers both).
--
-- Run on: DevLegacyLinkGlobal
-- Run after: 033_alumni_community_permissions.sql
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'roster:manage')
BEGIN
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'roster:manage', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t
    WHERE t.id >= 2;

    PRINT 'Seeded roster:manage rows';
END
ELSE
    PRINT 'roster:manage already seeded — skipping';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'roster:player_accounts')
BEGIN
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'roster:player_accounts', 8, t.id, NULL, 1, NULL
    FROM dbo.tiers t
    WHERE t.id >= 2;

    PRINT 'Seeded roster:player_accounts rows';
END
ELSE
    PRINT 'roster:player_accounts already seeded — skipping';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'roster:promote_to_alumni')
BEGIN
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'roster:promote_to_alumni', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t
    WHERE t.id >= 2;

    PRINT 'Seeded roster:promote_to_alumni rows';
END
ELSE
    PRINT 'roster:promote_to_alumni already seeded — skipping';
GO

PRINT 'Migration 034 complete';
GO
