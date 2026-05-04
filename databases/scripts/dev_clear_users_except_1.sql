-- ============================================================
-- DEV SCRIPT — Clear all user data except UserID 1
-- !! FOR DEVELOPMENT USE ONLY — DO NOT RUN IN PRODUCTION !!
--
-- Deletes every user (and all their associated records) except
-- the super admin with user_id = 1. Run this to reset dev data
-- without losing your primary admin account.
--
-- Run Global DB section first, then App DB section.
--
-- Schema reflects migrations through 029 (invite_codes sport_id).
-- App DB reflects migration 014 (users_roles + role_transfer_log
-- dropped; role_change_log added; program_role_id on dbo.users).
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- SECTION 1: LegacyLinkGlobal
-- ════════════════════════════════════════════════════════════

USE LegacyLinkGlobal
GO

PRINT '── Global DB: clearing users other than user_id = 1 ──';

-- access_requests references users (no cascade)
DELETE FROM dbo.access_requests WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' access_request(s)');
GO

-- invite_codes: creator FK has no cascade — clear all
DELETE FROM dbo.invite_codes;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' invite_code(s)');
GO

-- user_contact: no cascade
DELETE FROM dbo.user_contact WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' user_contact row(s)');
GO

-- Now safe to delete users — cascades handle: user_teams, user_team_preferences,
-- refresh_tokens, password_reset_tokens, app_permissions, audit_log
DELETE FROM dbo.users WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' user(s) from dbo.users');
GO

-- Verify
SELECT user_id, email, role_id FROM dbo.users ORDER BY user_id;
GO

PRINT '=== Global DB clear complete ===';
GO


-- ════════════════════════════════════════════════════════════
-- SECTION 2: LegacyLinkApp
-- ════════════════════════════════════════════════════════════

USE LegacyLinkApp
GO

PRINT '── App DB: clearing users other than user_id = 1 ──';

-- role_change_log: FK to users — must go before dbo.users
DELETE FROM dbo.role_change_log;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' role_change_log row(s)');
GO

-- users_sports: child of users
DELETE FROM dbo.users_sports WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' users_sports row(s)');
GO

-- interaction_log: references alumni records
DELETE FROM dbo.interaction_log;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' interaction_log row(s)');
GO

-- outreach_messages: no user cascade
DELETE FROM dbo.outreach_messages;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' outreach_message(s)');
GO

-- feed posts & related (must clear child tables before feed_posts)
DELETE FROM dbo.feed_post_reads;
DELETE FROM dbo.feed_post_likes;
PRINT 'Cleared feed_post_reads and feed_post_likes';
GO

DELETE FROM dbo.feed_posts;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' feed_post(s)');
GO

-- App DB users thin sync table
DELETE FROM dbo.users WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' user(s) from App DB dbo.users');
GO

-- Verify
SELECT
  u.user_id,
  u.email,
  u.program_role_id,
  pr.display_name AS programRole,
  u.global_role_id
FROM dbo.users u
JOIN dbo.program_role pr ON pr.id = u.program_role_id
ORDER BY u.user_id;

SELECT COUNT(*) AS users_sports_remaining   FROM dbo.users_sports;
SELECT COUNT(*) AS role_change_log_remaining FROM dbo.role_change_log;
GO

PRINT '=== App DB clear complete ===';
GO
