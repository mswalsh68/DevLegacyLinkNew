-- ============================================================
-- 000_wipe_test_data.sql
-- ONE-TIME wipe of all seeded / imported test users.
-- Keeps only mswalsh68@gmail.com (platform_owner).
--
-- Run on: LegacyLinkGlobal
-- Run BEFORE migration 020_integer_user_id.sql so that
-- mswalsh68 receives user_id = 1 from the IDENTITY column.
--
-- After this script, run 020 then re-create real users
-- through the app so every new user gets a matching GUID
-- in both LegacyLinkGlobal and the tenant AppDB.
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── Safety: confirm the keeper account exists ────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = 'mswalsh68@gmail.com')
BEGIN
  RAISERROR('mswalsh68@gmail.com not found — aborting wipe.', 16, 1);
  RETURN;
END
GO

DECLARE @KeeperId UNIQUEIDENTIFIER = (
  SELECT id FROM dbo.users WHERE email = 'mswalsh68@gmail.com'
);

PRINT CONCAT('Keeper GUID: ', CAST(@KeeperId AS NVARCHAR(100)));

-- ─── 1. Audit log ────────────────────────────────────────────
DELETE FROM dbo.audit_log;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' audit_log row(s)');

-- ─── 2. Access requests ──────────────────────────────────────
DELETE FROM dbo.access_requests;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' access_requests row(s)');

-- ─── 3. Invite codes ─────────────────────────────────────────
DELETE FROM dbo.invite_codes;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' invite_codes row(s)');

-- ─── 4. Invite tokens ────────────────────────────────────────
DELETE FROM dbo.invite_tokens;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' invite_tokens row(s)');

-- ─── 5. Password reset tokens ────────────────────────────────
DELETE FROM dbo.password_reset_tokens;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' password_reset_tokens row(s)');

-- ─── 6. Refresh tokens ───────────────────────────────────────
DELETE FROM dbo.refresh_tokens;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' refresh_tokens row(s)');

-- ─── 7. User team preferences ────────────────────────────────
DELETE FROM dbo.user_team_preferences
WHERE user_id <> @KeeperId;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' user_team_preferences row(s)');

-- ─── 8. User teams ───────────────────────────────────────────
DELETE FROM dbo.user_teams
WHERE user_id <> @KeeperId;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' user_teams row(s)');

-- ─── 9. Users (all except platform owner) ────────────────────
DELETE FROM dbo.users
WHERE id <> @KeeperId;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' users row(s)');

-- ─── Verify ──────────────────────────────────────────────────
SELECT
  u.id    AS guid,
  u.email,
  u.first_name,
  u.last_name,
  r.role_name,
  ut.team_id
FROM dbo.users u
JOIN dbo.roles r ON r.id = u.role_id
LEFT JOIN dbo.user_teams ut ON ut.user_id = u.id
ORDER BY u.email;

PRINT '=== Global wipe complete — run 020_integer_user_id.sql next ===';
GO
