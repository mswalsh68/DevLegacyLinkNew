-- Migration 022: Add description column to dbo.program_role
--               + null out sport_id for program-wide roles (1, 2)
-- Run on: LegacyLinkApp (each tenant DB)
-- ============================================================

USE LegacyLinkApp
GO

-- ─── 1. Add description column ───────────────────────────────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.program_role') AND name = 'description'
)
BEGIN
  ALTER TABLE dbo.program_role
    ADD description NVARCHAR(500) NULL;
  PRINT 'Added description column to dbo.program_role';
END
ELSE
  PRINT 'description column already exists — skipping';
GO

-- ─── 2. Populate descriptions ────────────────────────────────────────────────
UPDATE dbo.program_role SET description = 'Program-wide administrator with full access across all sports. Not scoped to a single sport.'  WHERE id = 1;
UPDATE dbo.program_role SET description = 'Program-wide administrator with full access across all sports. Not scoped to a single sport.'  WHERE id = 2;
UPDATE dbo.program_role SET description = 'Manages alumni across the entire program. Not scoped to a single sport.'                       WHERE id = 3;
UPDATE dbo.program_role SET description = 'Head coach for a specific sport. Must be assigned to a sport.'                                 WHERE id = 4;
UPDATE dbo.program_role SET description = 'Position coach. Can be scoped to a specific sport or assigned program-wide (all sports).'      WHERE id = 5;
UPDATE dbo.program_role SET description = 'Support staff. Can be scoped to a specific sport or assigned program-wide (all sports).'       WHERE id = 6;
UPDATE dbo.program_role SET description = 'Alumni member. Scoped to their sport.'                                                         WHERE id = 7;
UPDATE dbo.program_role SET description = 'Active player on the current roster. Scoped to their sport.'                                   WHERE id = 8;

PRINT 'Updated program_role descriptions';
GO

-- ─── 3. Null out sport_id for program-wide roles (1 and 2) ───────────────────
UPDATE dbo.users_sports
SET    sport_id   = NULL,
       updated_at = SYSUTCDATETIME()
WHERE  program_role_id IN (1, 2)
  AND  sport_id IS NOT NULL;

PRINT CONCAT('Nulled sport_id for ', @@ROWCOUNT, ' Athletic Director / Program Admin row(s)');
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT id, role_name, display_name, description FROM dbo.program_role ORDER BY id;

SELECT us.id, u.email, us.program_role_id, pr.display_name, us.sport_id
FROM   dbo.users_sports us
JOIN   dbo.users        u  ON u.user_id = us.user_id
JOIN   dbo.program_role pr ON pr.id     = us.program_role_id
WHERE  us.program_role_id IN (1, 2)
ORDER  BY us.program_role_id, u.email;

PRINT '=== 022_program_role_description complete ===';
GO
