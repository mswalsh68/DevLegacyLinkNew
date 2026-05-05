-- ============================================================
-- Migration 031: Feature Permissions Table
-- Platform-wide permission matrix keyed by program_role, tier,
-- and level. Internal roles (super_admin, support_admin) bypass
-- this table entirely in application code.
--
-- program_role_id mirrors App DB dbo.program_role.id.
-- IDs are platform-standard and never tenant-customized:
--   1=player  2=alumni  3=head_coach  4=assistant_coach
--   5=athletic_director  6=admin  7=staff  8=volunteer
--
-- level_id NULL = rule applies to all levels.
-- A row with a specific level_id overrides the NULL row.
--
-- scope: NULL=unrestricted | 'own_sport' | 'any_sport'
--
-- Run on: DevLegacyLinkGlobal
-- Run after: 030_seed_reply_to_email.sql
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.tables
    WHERE  name = 'feature_permissions' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.feature_permissions (
        id              INT           NOT NULL IDENTITY(1,1)
                        CONSTRAINT PK_feature_permissions PRIMARY KEY,
        feature_key     NVARCHAR(100) NOT NULL,
        program_role_id INT           NOT NULL,
        tier_id         INT           NOT NULL
                        CONSTRAINT FK_feature_permissions_tier
                            REFERENCES dbo.tiers(id),
        level_id        INT               NULL
                        CONSTRAINT FK_feature_permissions_level
                            REFERENCES dbo.levels(id),
        is_allowed      BIT           NOT NULL DEFAULT 1,
        scope           NVARCHAR(50)      NULL,

        CONSTRAINT UQ_feature_permissions
            UNIQUE (feature_key, program_role_id, tier_id, level_id)
    );

    PRINT 'Created dbo.feature_permissions';
END
ELSE
    PRINT 'dbo.feature_permissions already exists — skipping';
GO

-- ─── Seed FEED permissions ────────────────────────────────────
-- Tiers:         1=starter  2=pro  3=enterprise
-- Program roles: 1=player  2=alumni  3=head_coach  4=assistant_coach
--                5=athletic_director  6=admin  7=staff  8=volunteer
--
-- Matrix:
--   feed:view        — all roles, all tiers, all levels
--                      role 1 (player): scope='own_sport'
--   feed:like        — all roles, all tiers, all levels
--   feed:sport_filter— all roles, all tiers, all levels
--   feed:post roles 1-3 — all tiers, scope='any_sport'
--   feed:post roles 4-6 — all tiers, scope='own_sport'
--   feed:post role 7    — tier 2+ allowed, tier 1 denied
--   feed:post role 8    — all tiers denied

IF NOT EXISTS (SELECT 1 FROM dbo.feature_permissions WHERE feature_key = 'feed:view')
BEGIN
    -- feed:view — all roles, all tiers; player (role 1) scoped to own_sport
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT
        'feed:view',
        r.program_role_id,
        t.id,
        NULL,
        1,
        CASE WHEN r.program_role_id = 1 THEN 'own_sport' ELSE NULL END
    FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t;

    -- feed:like — all roles, all tiers
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'feed:like', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t;

    -- feed:sport_filter — all roles, all tiers
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'feed:sport_filter', r.program_role_id, t.id, NULL, 1, NULL
    FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t;

    -- feed:post — roles 1-3 (head coaching staff), all tiers, any sport
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'feed:post', r.program_role_id, t.id, NULL, 1, 'any_sport'
    FROM (VALUES (3),(4),(5)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t;

    -- feed:post — roles 4-6 (admin/staff tier), all tiers, own sport only
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'feed:post', r.program_role_id, t.id, NULL, 1, 'own_sport'
    FROM (VALUES (6),(7),(8)) AS r(program_role_id)
    CROSS JOIN dbo.tiers t;

    -- feed:post — role 2 (alumni), tier 2+ allowed, own sport
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'feed:post', 2, t.id, NULL, 1, 'own_sport'
    FROM dbo.tiers t WHERE t.id >= 2;

    -- feed:post — role 2 (alumni), tier 1 explicitly denied
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    VALUES ('feed:post', 2, 1, NULL, 0, NULL);

    -- feed:post — role 1 (player), all tiers, never
    INSERT INTO dbo.feature_permissions (feature_key, program_role_id, tier_id, level_id, is_allowed, scope)
    SELECT 'feed:post', 1, t.id, NULL, 0, NULL
    FROM dbo.tiers t;

    PRINT 'Seeded FEED feature_permissions rows';
END
ELSE
    PRINT 'FEED permissions already seeded — skipping';
GO

PRINT 'Migration 031 complete';
GO
