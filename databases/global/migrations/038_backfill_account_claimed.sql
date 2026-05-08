-- Migration 038: Backfill account_claimed for users who already set a password
-- Any user with a real bcrypt hash (not INVITE_PENDING) has claimed their account
-- but may have account_claimed = 0 if they registered before migration 022 ran
-- or if sp_ActivatePendingAccount didn't propagate the flag correctly.
-- Run on: LegacyLinkGlobal ONLY
-- ============================================================

USE LegacyLinkGlobal
GO

UPDATE dbo.users
SET    account_claimed = 1,
       claimed_date    = ISNULL(claimed_date, created_at)
WHERE  password_hash <> 'INVITE_PENDING'
  AND  account_claimed = 0;

PRINT CONCAT('Backfilled account_claimed for ', @@ROWCOUNT, ' user(s)');
GO

-- Verification
SELECT user_id, email, first_name, last_name,
       account_claimed, claimed_date,
       CASE WHEN password_hash = 'INVITE_PENDING' THEN 'INVITE_PENDING' ELSE 'hashed' END AS password_status
FROM   dbo.users
ORDER  BY user_id;

PRINT '=== 038_backfill_account_claimed complete ===';
GO
