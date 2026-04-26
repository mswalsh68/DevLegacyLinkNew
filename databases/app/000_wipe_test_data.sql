-- ============================================================
-- 000_wipe_test_data.sql  (App DB)
-- ONE-TIME wipe of all test players, alumni, and related data.
-- Run on the tenant AppDB: LegacyLinkApp
--
-- Keeps configuration tables: sports, player_status_types.
-- Wipes all user-generated / seeded rows so new users created
-- through the app get matching GUIDs from LegacyLinkGlobal.
--
-- Run AFTER databases/global/000_wipe_test_data.sql.
-- ============================================================

USE LegacyLinkApp
GO

-- ─── 1. Outreach messages ────────────────────────────────────
IF OBJECT_ID('dbo.outreach_messages') IS NOT NULL
BEGIN
  DELETE FROM dbo.outreach_messages;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' outreach_messages row(s)');
END

-- ─── 2. Outreach campaigns ───────────────────────────────────
IF OBJECT_ID('dbo.outreach_campaigns') IS NOT NULL
BEGIN
  DELETE FROM dbo.outreach_campaigns;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' outreach_campaigns row(s)');
END

-- ─── 3. Email unsubscribes ───────────────────────────────────
IF OBJECT_ID('dbo.email_unsubscribes') IS NOT NULL
BEGIN
  DELETE FROM dbo.email_unsubscribes;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' email_unsubscribes row(s)');
END

-- ─── 4. Interaction log ──────────────────────────────────────
IF OBJECT_ID('dbo.interaction_log') IS NOT NULL
BEGIN
  DELETE FROM dbo.interaction_log;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' interaction_log row(s)');
END

-- ─── 5. Graduation log ───────────────────────────────────────
IF OBJECT_ID('dbo.graduation_log') IS NOT NULL
BEGIN
  DELETE FROM dbo.graduation_log;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' graduation_log row(s)');
END

-- ─── 6. Auth events ──────────────────────────────────────────
IF OBJECT_ID('dbo.auth_events') IS NOT NULL
BEGIN
  DELETE FROM dbo.auth_events;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' auth_events row(s)');
END

-- ─── 7. Player stats ─────────────────────────────────────────
IF OBJECT_ID('dbo.player_stats') IS NOT NULL
BEGIN
  DELETE FROM dbo.player_stats;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' player_stats row(s)');
END

-- ─── 8. Feed post reads ──────────────────────────────────────
IF OBJECT_ID('dbo.feed_post_reads') IS NOT NULL
BEGIN
  DELETE FROM dbo.feed_post_reads;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' feed_post_reads row(s)');
END

-- ─── 9. Feed posts (non-welcome) ─────────────────────────────
IF OBJECT_ID('dbo.feed_posts') IS NOT NULL
BEGIN
  DELETE FROM dbo.feed_posts
  WHERE ISNULL(is_welcome_post, 0) = 0;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' feed_posts row(s) (welcome post kept)');
END

-- ─── 10. Users sports (player-sport assignments) ─────────────
IF OBJECT_ID('dbo.users_sports') IS NOT NULL
BEGIN
  DELETE FROM dbo.users_sports;
  PRINT CONCAT('Deleted ', @@ROWCOUNT, ' users_sports row(s)');
END

-- ─── 11. Users (all players and alumni) ──────────────────────
DELETE FROM dbo.users;
PRINT CONCAT('Deleted ', @@ROWCOUNT, ' users row(s) (players + alumni)');

-- ─── Verify ──────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM dbo.users)    AS remaining_users,
  (SELECT COUNT(*) FROM dbo.sports)   AS sports_count,
  (SELECT COUNT(*) FROM dbo.feed_posts WHERE ISNULL(is_welcome_post,0) = 1) AS welcome_posts;

PRINT '=== App DB wipe complete ===';
PRINT 'Update the USE statement at the top for each additional tenant when added.';
GO
