-- Migration 023: Make users_sports.sport_id nullable
-- Required so program-wide roles (1=AD, 2=program_admin) can have
-- sport_id = NULL instead of being forced into a specific sport.
-- Run on: LegacyLinkApp (each tenant DB)
-- ============================================================

USE LegacyLinkApp
GO

-- ─── 1. Drop the FK constraint on sport_id so we can alter the column ─────────
DECLARE @fk NVARCHAR(255)
SELECT  @fk = fk.name
FROM    sys.foreign_keys        fk
JOIN    sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN    sys.columns             c   ON c.object_id = fkc.parent_object_id
                                   AND c.column_id = fkc.parent_column_id
WHERE   fk.parent_object_id  = OBJECT_ID('dbo.users_sports')
  AND   c.name               = 'sport_id';

IF @fk IS NOT NULL
BEGIN
  EXEC('ALTER TABLE dbo.users_sports DROP CONSTRAINT ' + @fk);
  PRINT 'Dropped FK on users_sports.sport_id';
END
ELSE
  PRINT 'No FK found on users_sports.sport_id — skipping drop';
GO

-- ─── 2. Make sport_id nullable ───────────────────────────────────────────────
ALTER TABLE dbo.users_sports
  ALTER COLUMN sport_id INT NULL;

PRINT 'Made users_sports.sport_id nullable';
GO

-- ─── 3. Re-add FK (now nullable — NULL rows simply skip the FK check) ─────────
ALTER TABLE dbo.users_sports
  ADD CONSTRAINT FK_users_sports_sport
    FOREIGN KEY (sport_id) REFERENCES dbo.sports(id);

PRINT 'Re-added FK on users_sports.sport_id';
GO

-- ─── 4. Null out sport_id for program-wide roles (1 and 2) ───────────────────
UPDATE dbo.users_sports
SET    sport_id   = NULL,
       updated_at = SYSUTCDATETIME()
WHERE  program_role_id IN (1, 2)
  AND  sport_id IS NOT NULL;

PRINT CONCAT('Nulled sport_id for ', @@ROWCOUNT, ' Athletic Director / Program Admin row(s)');
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT us.id, u.email, us.program_role_id, pr.display_name, us.sport_id
FROM   dbo.users_sports us
JOIN   dbo.users        u  ON u.user_id = us.user_id
JOIN   dbo.program_role pr ON pr.id     = us.program_role_id
WHERE  us.program_role_id IN (1, 2)
ORDER  BY us.program_role_id, u.email;

PRINT '=== 023_nullable_sport_id complete ===';
GO
