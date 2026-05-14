-- ============================================================
-- seed_demo_metrics.sql  (App DB)
-- Seeds realistic demo data for the dashboard metrics tiles:
--   - outreach_campaigns + outreach_messages (alumni + players)
--   - interaction_log (alumni)
--   - last_team_login stamps on alumni users
--
-- Safe to run once on a dev/demo tenant App DB.
-- Does NOT affect feed_posts, users, or any config tables.
-- Run AFTER users and users_sports have been populated.
-- ============================================================

USE LegacyLinkApp;
GO

-- ─── Capture a staff user ID to use as "created_by" ─────────────────────────
-- Uses the admin/super-admin user (global_role_id 1 or 2) if present.

DECLARE @StaffId INT;
SELECT TOP 1 @StaffId = u.user_id
FROM dbo.users u
WHERE u.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM dbo.users_sports us
    WHERE us.user_id = u.user_id
      AND us.program_role_id IN (7, 8)
  )
ORDER BY u.user_id;

IF @StaffId IS NULL
BEGIN
  PRINT 'WARNING: No staff user found — skipping campaign inserts that require created_by.';
  RETURN;
END

PRINT CONCAT('Using staff user_id = ', @StaffId, ' as campaign creator.');

-- ─── 1. Alumni outreach campaigns (45 days ago + 10 days ago) ────────────────

DECLARE @AlumniCamp1 UNIQUEIDENTIFIER = NEWID();
DECLARE @AlumniCamp2 UNIQUEIDENTIFIER = NEWID();

INSERT INTO dbo.outreach_campaigns (
  id, sport_id, name, description,
  target_audience, audience_filters,
  scheduled_at, subject_line, body_html,
  from_name, reply_to_email, physical_address,
  created_by, status, started_at, completed_at
)
VALUES
  -- Campaign 1: older batch (beyond 30-day window, counts toward "total" only)
  (
    @AlumniCamp1, NULL,
    'Alumni Spring Reconnect', 'Reconnect with alumni ahead of spring events.',
    'alumni', '{}',
    DATEADD(DAY, -45, SYSUTCDATETIME()),
    'Reconnect with your program this spring',
    '<p>Hello {firstName},</p><p>We''d love to hear how you''re doing!</p>',
    'Legacy Link Program', 'coach@example.com', NULL,
    @StaffId, 'completed',
    DATEADD(DAY, -45, SYSUTCDATETIME()),
    DATEADD(DAY, -44, SYSUTCDATETIME())
  ),
  -- Campaign 2: recent batch (within 30-day window, counts toward month totals)
  (
    @AlumniCamp2, NULL,
    'Alumni Summer Update', 'Monthly update for alumni network.',
    'alumni', '{}',
    DATEADD(DAY, -8, SYSUTCDATETIME()),
    'Summer update from your program',
    '<p>Hello {firstName},</p><p>Here''s what''s new in the program this summer!</p>',
    'Legacy Link Program', 'coach@example.com', NULL,
    @StaffId, 'completed',
    DATEADD(DAY, -8, SYSUTCDATETIME()),
    DATEADD(DAY, -7, SYSUTCDATETIME())
  );

PRINT CONCAT('Inserted 2 alumni campaigns.');

-- ─── 2. Player outreach campaigns ────────────────────────────────────────────

DECLARE @PlayerCamp1 UNIQUEIDENTIFIER = NEWID();
DECLARE @PlayerCamp2 UNIQUEIDENTIFIER = NEWID();

INSERT INTO dbo.outreach_campaigns (
  id, sport_id, name, description,
  target_audience, audience_filters,
  scheduled_at, subject_line, body_html,
  from_name, reply_to_email, physical_address,
  created_by, status, started_at, completed_at
)
VALUES
  (
    @PlayerCamp1, NULL,
    'Roster Check-In Spring', 'Spring semester check-in for all players.',
    'players', '{}',
    DATEADD(DAY, -40, SYSUTCDATETIME()),
    'Spring check-in from coaching staff',
    '<p>Hey {firstName},</p><p>Hope the semester is going well. Let us know how you''re doing!</p>',
    'Coaching Staff', 'coach@example.com', NULL,
    @StaffId, 'completed',
    DATEADD(DAY, -40, SYSUTCDATETIME()),
    DATEADD(DAY, -40, SYSUTCDATETIME())
  ),
  (
    @PlayerCamp2, NULL,
    'Summer Camp Info', 'Summer camp details for current roster.',
    'players', '{}',
    DATEADD(DAY, -5, SYSUTCDATETIME()),
    'Summer camp registration is open',
    '<p>Hey {firstName},</p><p>Summer camp registration is now open. Sign up by June 30!</p>',
    'Coaching Staff', 'coach@example.com', NULL,
    @StaffId, 'completed',
    DATEADD(DAY, -5, SYSUTCDATETIME()),
    DATEADD(DAY, -5, SYSUTCDATETIME())
  );

PRINT CONCAT('Inserted 2 player campaigns.');

-- ─── 3. Alumni outreach messages ─────────────────────────────────────────────
-- One "sent" row per alumni user per campaign, with ~50% open rate on camp1.

INSERT INTO dbo.outreach_messages (
  id, campaign_id, user_id, channel, status,
  email_address, unsubscribe_token,
  sent_at, opened_at
)
SELECT
  NEWID(),
  @AlumniCamp1,
  us.user_id,
  'email',
  'sent',
  u.email,
  NEWID(),
  DATEADD(DAY, -44, SYSUTCDATETIME()),
  -- Alternating open: every other alumni opened it (realistic ~50% open rate)
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 2 = 1
       THEN DATEADD(DAY, -43, SYSUTCDATETIME())
       ELSE NULL
  END
FROM dbo.users_sports us
JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7
  AND us.is_active = 1;

INSERT INTO dbo.outreach_messages (
  id, campaign_id, user_id, channel, status,
  email_address, unsubscribe_token,
  sent_at, opened_at
)
SELECT
  NEWID(),
  @AlumniCamp2,
  us.user_id,
  'email',
  'sent',
  u.email,
  NEWID(),
  DATEADD(DAY, -7, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 3 != 0
       THEN DATEADD(DAY, -6, SYSUTCDATETIME())
       ELSE NULL
  END
FROM dbo.users_sports us
JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7
  AND us.is_active = 1;

PRINT CONCAT('Inserted alumni outreach messages for both campaigns.');

-- ─── 4. Player outreach messages ─────────────────────────────────────────────

INSERT INTO dbo.outreach_messages (
  id, campaign_id, user_id, channel, status,
  email_address, unsubscribe_token,
  sent_at, opened_at
)
SELECT
  NEWID(),
  @PlayerCamp1,
  us.user_id,
  'email',
  'sent',
  u.email,
  NEWID(),
  DATEADD(DAY, -40, SYSUTCDATETIME()),
  NULL
FROM dbo.users_sports us
JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 8
  AND us.is_active = 1;

INSERT INTO dbo.outreach_messages (
  id, campaign_id, user_id, channel, status,
  email_address, unsubscribe_token,
  sent_at, opened_at
)
SELECT
  NEWID(),
  @PlayerCamp2,
  us.user_id,
  'email',
  'sent',
  u.email,
  NEWID(),
  DATEADD(DAY, -5, SYSUTCDATETIME()),
  NULL
FROM dbo.users_sports us
JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 8
  AND us.is_active = 1;

PRINT 'Inserted player outreach messages for both campaigns.';

-- ─── 5. Interaction log (alumni) ─────────────────────────────────────────────
-- A few interactions per alumni user spread across the last 60 days.

INSERT INTO dbo.interaction_log (
  user_id, logged_by_user_id, channel, summary, outcome, logged_at
)
SELECT
  us.user_id,
  @StaffId,
  CASE (ABS(CHECKSUM(NEWID())) % 3)
    WHEN 0 THEN 'email'
    WHEN 1 THEN 'phone'
    ELSE        'text'
  END,
  CASE (ABS(CHECKSUM(NEWID())) % 4)
    WHEN 0 THEN 'Reached out to check in on post-grad life.'
    WHEN 1 THEN 'Alumni expressed interest in mentoring a current player.'
    WHEN 2 THEN 'Discussed upcoming alumni weekend event.'
    ELSE        'Followed up on summer internship opportunity.'
  END,
  CASE (ABS(CHECKSUM(NEWID())) % 3)
    WHEN 0 THEN 'positive'
    WHEN 1 THEN 'no_response'
    ELSE        'follow_up'
  END,
  -- Spread interactions: 2 per alumni user, 60 days ago and 10 days ago
  DATEADD(DAY, -60 + (ROW_NUMBER() OVER (ORDER BY us.user_id) % 50), SYSUTCDATETIME())
FROM dbo.users_sports us
WHERE us.program_role_id = 7
  AND us.is_active = 1

UNION ALL

SELECT
  us.user_id,
  @StaffId,
  'email',
  'Sent monthly newsletter and alumni engagement update.',
  'positive',
  DATEADD(DAY, -10, SYSUTCDATETIME())
FROM dbo.users_sports us
WHERE us.program_role_id = 7
  AND us.is_active = 1;

PRINT 'Inserted interaction_log entries for alumni.';

-- ─── 6. Stamp last_team_login for alumni users ───────────────────────────────
-- Simulates alumni who have logged in within the last 30 days.
-- Alternates: 2/3 of alumni get a recent login stamp.

UPDATE u
SET u.last_team_login = DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 28 + 1), SYSUTCDATETIME())
FROM dbo.users u
WHERE EXISTS (
  SELECT 1 FROM dbo.users_sports us
  WHERE us.user_id = u.user_id
    AND us.program_role_id = 7
    AND us.is_active = 1
)
AND u.user_id % 3 != 0;  -- ~67% of alumni get a login stamp

PRINT 'Stamped last_team_login on alumni users.';

-- ─── Summary ─────────────────────────────────────────────────────────────────

SELECT
  (SELECT COUNT(*) FROM dbo.outreach_campaigns)                          AS campaigns,
  (SELECT COUNT(*) FROM dbo.outreach_messages WHERE status = 'sent')    AS messages_sent,
  (SELECT COUNT(*) FROM dbo.outreach_messages WHERE opened_at IS NOT NULL) AS messages_opened,
  (SELECT COUNT(*) FROM dbo.interaction_log)                             AS interactions,
  (SELECT COUNT(*) FROM dbo.users WHERE last_team_login IS NOT NULL)    AS alumni_with_logins;

PRINT '=== seed_demo_metrics complete ===';
GO
