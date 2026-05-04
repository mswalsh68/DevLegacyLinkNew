-- ============================================================
-- DEV SCRIPT — Clear all user data except UserID 1
-- !! FOR DEVELOPMENT USE ONLY — DO NOT RUN IN PRODUCTION !!
--
-- Deletes every user (and all their associated records) except
-- the super admin with user_id = 1. Run this to reset dev data
-- without losing your primary admin account.
--
-- Run Global DB section first, then App DB section.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- SECTION 1: LegacyLinkGlobal
-- ════════════════════════════════════════════════════════════

USE LegacyLinkGlobal
GO

PRINT '── Global DB: clearing users other than user_id = 1 ──';

-- Cascades handle: user_teams, user_team_preferences, refresh_tokens,
--                  password_reset_tokens, app_permissions, audit_log
DELETE FROM dbo.users WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' user(s) from dbo.users');
GO

-- access_requests: no cascade on user FK — delete manually
DELETE FROM dbo.access_requests WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' access_request(s)');
GO

-- invite_codes: creator FK has no cascade — clear all invite codes
DELETE FROM dbo.invite_codes;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' invite_code(s)');
GO

-- user_contact: may not cascade — delete manually
DELETE FROM dbo.user_contact WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' user_contact row(s)');
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

-- users_roles: child of users — delete first
DELETE FROM dbo.users_roles WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' users_roles row(s)');
GO

-- users_sports: child of users — delete first
DELETE FROM dbo.users_sports WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' users_sports row(s)');
GO

-- role_transfer_log: references user_id — delete first
DELETE FROM dbo.role_transfer_log WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' role_transfer_log row(s)');
GO

-- interaction_log: delete all (references alumni records)
DELETE FROM dbo.interaction_log;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' interaction_log row(s)');
GO

-- outreach_messages: no user cascade
DELETE FROM dbo.outreach_messages;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' outreach_message(s)');
GO

-- feed posts & related (feed_post_reads, feed_post_likes)
DELETE FROM dbo.feed_post_reads;
DELETE FROM dbo.feed_post_likes;
PRINT 'Cleared feed_post_reads and feed_post_likes';
GO

-- App DB users thin sync table
DELETE FROM dbo.users WHERE user_id <> 1;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' user(s) from App DB dbo.users');
GO

-- Verify
SELECT user_id, email, platform_role FROM dbo.users ORDER BY user_id;
SELECT COUNT(*) AS users_roles_remaining FROM dbo.users_roles;
GO

PRINT '=== App DB clear complete ===';
GO
