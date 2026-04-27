-- ============================================================
-- 022_repair.sql
-- Fixes the compile-time column-not-found error in 022.
-- The ALTER TABLE ADD and the UPDATE that sets account_claimed
-- must be in SEPARATE GO batches — SQL Server resolves column
-- names at parse time, so referencing a just-added column in
-- the same batch always fails with Msg 207.
-- Run on: LegacyLinkGlobal ONLY
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── 1. Add account_claimed + claimed_date (own batch) ───────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.users') AND name = 'account_claimed'
)
BEGIN
  ALTER TABLE dbo.users
    ADD account_claimed BIT       NOT NULL DEFAULT 0,
        claimed_date    DATETIME2 NULL;
  PRINT 'Added account_claimed + claimed_date';
END
ELSE
  PRINT 'account_claimed already exists — skipping';
GO

-- ─── 2. Mark mswalsh68 as claimed (separate batch — column now exists) ───────
UPDATE dbo.users
SET    account_claimed = 1,
       claimed_date    = created_at
WHERE  email = 'mswalsh68@gmail.com'
  AND  account_claimed = 0;

PRINT CONCAT('Marked ', @@ROWCOUNT, ' user(s) as account_claimed');
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT user_id, id AS guid, email, first_name, last_name,
       account_claimed, claimed_date
FROM   dbo.users
ORDER  BY user_id;

SELECT uc.user_id, u.email, uc.updated_date
FROM   dbo.user_contact uc
JOIN   dbo.users u ON u.id = uc.user_id;

PRINT '=== 022_repair complete ===';
GO
