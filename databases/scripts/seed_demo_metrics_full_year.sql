-- ============================================================
-- seed_demo_metrics_full_year.sql  (App DB)
--
-- Full-year demo seed. Replaces the thin starter seed with
-- realistic data that looks like a program 12 months in:
--   · 10 alumni campaigns spread across the year
--   ·  6 player campaigns spread across the year
--   · ~12 interactions per alumni user (365-day spread)
--   · Varied open rates per campaign (40–75%)
--   · Recent activity within the last 30 days (drives month tiles)
--   · Feed posts spread across the year
--
-- ⚠ WIPES existing outreach_campaigns, outreach_messages,
--   interaction_log, feed_posts (non-welcome), and login stamps
--   before inserting. Safe on a dev/demo tenant only.
--
-- Run on: LegacyLinkApp (dev/demo tenant)
-- Run AFTER users and users_sports are populated.
-- ============================================================

USE LegacyLinkApp;
GO

-- ─── 0. Wipe existing seed data ──────────────────────────────────────────────

DELETE FROM dbo.outreach_messages;
DELETE FROM dbo.outreach_campaigns;
DELETE FROM dbo.interaction_log;
-- Wipe non-welcome, non-pinned feed posts only
DELETE FROM dbo.feed_posts WHERE is_welcome_post = 0 AND is_pinned = 0;
-- Clear login stamps so we re-stamp with realistic spread
UPDATE dbo.users SET last_team_login = NULL
WHERE EXISTS (
  SELECT 1 FROM dbo.users_sports us
  WHERE us.user_id = dbo.users.user_id
    AND us.program_role_id = 7
);

PRINT 'Cleared existing seed data.';
GO

-- ─── Resolve staff user ───────────────────────────────────────────────────────

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
  PRINT 'ERROR: No staff user found — aborting.';
  RETURN;
END

PRINT CONCAT('Staff user: ', @StaffId);

-- ─── 1. Alumni Campaigns (10 over the year) ───────────────────────────────────

DECLARE @AC1  UNIQUEIDENTIFIER = NEWID();
DECLARE @AC2  UNIQUEIDENTIFIER = NEWID();
DECLARE @AC3  UNIQUEIDENTIFIER = NEWID();
DECLARE @AC4  UNIQUEIDENTIFIER = NEWID();
DECLARE @AC5  UNIQUEIDENTIFIER = NEWID();
DECLARE @AC6  UNIQUEIDENTIFIER = NEWID();
DECLARE @AC7  UNIQUEIDENTIFIER = NEWID();
DECLARE @AC8  UNIQUEIDENTIFIER = NEWID();
DECLARE @AC9  UNIQUEIDENTIFIER = NEWID();
DECLARE @AC10 UNIQUEIDENTIFIER = NEWID();

INSERT INTO dbo.outreach_campaigns (
  id, sport_id, name, description,
  target_audience, audience_filters,
  scheduled_at, subject_line, body_html,
  from_name, reply_to_email, physical_address,
  created_by, status, started_at, completed_at
)
VALUES
  -- Month 1 (~360 days ago)
  (@AC1, NULL,
   'Year Kick-Off: Welcome Back Alumni',
   'Opening message to the alumni network at the start of the program year.',
   'alumni', '{}',
   DATEADD(DAY, -360, SYSUTCDATETIME()),
   'A new year with your program — welcome back',
   '<p>Hello {firstName},</p><p>A new year is here and we''re excited to keep you connected to the program. Stay tuned for big things ahead.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -360, SYSUTCDATETIME()), DATEADD(DAY, -359, SYSUTCDATETIME())),

  -- Month 2 (~320 days ago)
  (@AC2, NULL,
   'Winter Alumni Newsletter',
   'Newsletter covering winter program updates and alumni spotlights.',
   'alumni', '{}',
   DATEADD(DAY, -320, SYSUTCDATETIME()),
   'Winter newsletter — what''s new in the program',
   '<p>Hello {firstName},</p><p>Here''s your winter update from the program. Alumni spotlight, schedule news, and more inside.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -320, SYSUTCDATETIME()), DATEADD(DAY, -319, SYSUTCDATETIME())),

  -- Month 3 (~280 days ago)
  (@AC3, NULL,
   'Spring Reconnect Campaign',
   'Spring outreach to engage alumni ahead of on-campus events.',
   'alumni', '{}',
   DATEADD(DAY, -280, SYSUTCDATETIME()),
   'Spring is here — reconnect with your program',
   '<p>Hello {firstName},</p><p>Spring is a great time to reconnect. We have several events coming up and would love to see familiar faces.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -280, SYSUTCDATETIME()), DATEADD(DAY, -279, SYSUTCDATETIME())),

  -- Month 4 (~240 days ago) — Spring Game
  (@AC4, NULL,
   'Spring Game Alumni Invite',
   'Invitation to the annual spring game with alumni section.',
   'alumni', '{}',
   DATEADD(DAY, -240, SYSUTCDATETIME()),
   'You''re invited — Spring Game this weekend',
   '<p>Hello {firstName},</p><p>Join us for the spring game! Alumni section is open and we''d love to have you back on campus.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -240, SYSUTCDATETIME()), DATEADD(DAY, -239, SYSUTCDATETIME())),

  -- Month 5 (~200 days ago) — Summer check-in
  (@AC5, NULL,
   'Summer Alumni Check-In',
   'Mid-year touchpoint with the full alumni network.',
   'alumni', '{}',
   DATEADD(DAY, -200, SYSUTCDATETIME()),
   'Checking in from the program — summer edition',
   '<p>Hello {firstName},</p><p>Hope summer is going well. Here''s a quick update from the staff and a look at what''s ahead for the fall.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -200, SYSUTCDATETIME()), DATEADD(DAY, -199, SYSUTCDATETIME())),

  -- Month 7 (~160 days ago) — Back to campus
  (@AC6, NULL,
   'Back to Campus Weekend',
   'Invite to alumni-specific back-to-campus weekend in early fall.',
   'alumni', '{}',
   DATEADD(DAY, -160, SYSUTCDATETIME()),
   'Alumni weekend — come back to campus',
   '<p>Hello {firstName},</p><p>Fall is almost here and we''re hosting an alumni weekend on campus. Details inside — we hope to see you there.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -160, SYSUTCDATETIME()), DATEADD(DAY, -159, SYSUTCDATETIME())),

  -- Month 8 (~120 days ago) — Fall newsletter
  (@AC7, NULL,
   'Fall Alumni Newsletter',
   'Seasonal newsletter with season preview and alumni updates.',
   'alumni', '{}',
   DATEADD(DAY, -120, SYSUTCDATETIME()),
   'Fall newsletter — season preview inside',
   '<p>Hello {firstName},</p><p>The season is underway and we''re off to a great start. Catch up on everything in this month''s newsletter.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -120, SYSUTCDATETIME()), DATEADD(DAY, -119, SYSUTCDATETIME())),

  -- Month 10 (~80 days ago) — Homecoming
  (@AC8, NULL,
   'Homecoming Follow-Up',
   'Post-homecoming message thanking alumni who attended.',
   'alumni', '{}',
   DATEADD(DAY, -80, SYSUTCDATETIME()),
   'Thanks for coming home — homecoming recap',
   '<p>Hello {firstName},</p><p>What a weekend. Thank you to everyone who made it back for homecoming. Here''s a recap and what''s next.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -80, SYSUTCDATETIME()), DATEADD(DAY, -79, SYSUTCDATETIME())),

  -- Month 11 (~22 days ago — within 30-day window, drives month tile)
  (@AC9, NULL,
   'November Alumni Engagement',
   'Late-season touchpoint ahead of the postseason.',
   'alumni', '{}',
   DATEADD(DAY, -22, SYSUTCDATETIME()),
   'The stretch run — update from the program',
   '<p>Hello {firstName},</p><p>We''re in the home stretch of the season. Here''s where things stand and how you can stay involved.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -22, SYSUTCDATETIME()), DATEADD(DAY, -21, SYSUTCDATETIME())),

  -- Month 12 (~6 days ago — very recent, drives month tile)
  (@AC10, NULL,
   'Year-End Alumni Message',
   'Year-end message to the full alumni network.',
   'alumni', '{}',
   DATEADD(DAY, -6, SYSUTCDATETIME()),
   'A full year in — thank you from the program',
   '<p>Hello {firstName},</p><p>As the year wraps up, we wanted to reflect on what we''ve built together and share what''s coming next year.</p>',
   'Program Staff', 'staff@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -6, SYSUTCDATETIME()), DATEADD(DAY, -5, SYSUTCDATETIME()));

PRINT 'Inserted 10 alumni campaigns.';

-- ─── 2. Player Campaigns (6 over the year) ───────────────────────────────────

DECLARE @PC1 UNIQUEIDENTIFIER = NEWID();
DECLARE @PC2 UNIQUEIDENTIFIER = NEWID();
DECLARE @PC3 UNIQUEIDENTIFIER = NEWID();
DECLARE @PC4 UNIQUEIDENTIFIER = NEWID();
DECLARE @PC5 UNIQUEIDENTIFIER = NEWID();
DECLARE @PC6 UNIQUEIDENTIFIER = NEWID();

INSERT INTO dbo.outreach_campaigns (
  id, sport_id, name, description,
  target_audience, audience_filters,
  scheduled_at, subject_line, body_html,
  from_name, reply_to_email, physical_address,
  created_by, status, started_at, completed_at
)
VALUES
  -- Spring practice
  (@PC1, NULL,
   'Spring Practice Kickoff',
   'Roster-wide message kicking off spring practice.',
   'players', '{}',
   DATEADD(DAY, -355, SYSUTCDATETIME()),
   'Spring practice starts Monday — details inside',
   '<p>Hey {firstName},</p><p>Spring practice is almost here. Review the schedule and make sure you have everything you need before Monday.</p>',
   'Coaching Staff', 'coach@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -355, SYSUTCDATETIME()), DATEADD(DAY, -354, SYSUTCDATETIME())),

  -- Spring game
  (@PC2, NULL,
   'Spring Game Logistics',
   'Spring game schedule and roster expectations.',
   'players', '{}',
   DATEADD(DAY, -285, SYSUTCDATETIME()),
   'Spring game this Saturday — what you need to know',
   '<p>Hey {firstName},</p><p>Spring game is Saturday. Here''s everything you need to know about warm-ups, travel, and game-day logistics.</p>',
   'Coaching Staff', 'coach@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -285, SYSUTCDATETIME()), DATEADD(DAY, -284, SYSUTCDATETIME())),

  -- Summer workouts
  (@PC3, NULL,
   'Summer Workout Program',
   'Off-season conditioning program for the full roster.',
   'players', '{}',
   DATEADD(DAY, -225, SYSUTCDATETIME()),
   'Summer program starts June 1 — register now',
   '<p>Hey {firstName},</p><p>The summer workout program starts June 1. Register by Friday to secure your spot and get your schedule.</p>',
   'Coaching Staff', 'coach@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -225, SYSUTCDATETIME()), DATEADD(DAY, -224, SYSUTCDATETIME())),

  -- Fall camp
  (@PC4, NULL,
   'Fall Camp Details',
   'Pre-season camp logistics for the full roster.',
   'players', '{}',
   DATEADD(DAY, -150, SYSUTCDATETIME()),
   'Fall camp is 2 weeks away — full details inside',
   '<p>Hey {firstName},</p><p>Camp is two weeks out. Here are your report dates, what to bring, and what to expect from day one.</p>',
   'Coaching Staff', 'coach@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -150, SYSUTCDATETIME()), DATEADD(DAY, -149, SYSUTCDATETIME())),

  -- Mid-season check-in
  (@PC5, NULL,
   'Mid-Season Check-In',
   'Mid-season academic and wellness check-in for all players.',
   'players', '{}',
   DATEADD(DAY, -85, SYSUTCDATETIME()),
   'Mid-season check-in — coaches want to hear from you',
   '<p>Hey {firstName},</p><p>We''re at the midpoint of the season. Fill out the quick check-in form so coaches can get back to you individually.</p>',
   'Coaching Staff', 'coach@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -85, SYSUTCDATETIME()), DATEADD(DAY, -84, SYSUTCDATETIME())),

  -- End of season (~18 days ago — within 30-day window)
  (@PC6, NULL,
   'End of Season Wrap-Up',
   'Post-season message covering awards, off-season plan, and next steps.',
   'players', '{}',
   DATEADD(DAY, -18, SYSUTCDATETIME()),
   'Season''s over — what''s next for the program',
   '<p>Hey {firstName},</p><p>Great season. Here''s the off-season plan, award details, and everything you need to know heading into the winter.</p>',
   'Coaching Staff', 'coach@example.com', NULL,
   @StaffId, 'completed',
   DATEADD(DAY, -18, SYSUTCDATETIME()), DATEADD(DAY, -17, SYSUTCDATETIME()));

PRINT 'Inserted 6 player campaigns.';
GO

-- ─── 3. Alumni Outreach Messages ─────────────────────────────────────────────
-- One message row per alumni per campaign.
-- Open rates vary per campaign to produce a realistic ~50% overall average.
-- Campaigns @AC9 and @AC10 are within 30 days → drive the "this month" tile.

DECLARE @AC1  UNIQUEIDENTIFIER; SELECT @AC1  = id FROM dbo.outreach_campaigns WHERE name = 'Year Kick-Off: Welcome Back Alumni';
DECLARE @AC2  UNIQUEIDENTIFIER; SELECT @AC2  = id FROM dbo.outreach_campaigns WHERE name = 'Winter Alumni Newsletter';
DECLARE @AC3  UNIQUEIDENTIFIER; SELECT @AC3  = id FROM dbo.outreach_campaigns WHERE name = 'Spring Reconnect Campaign';
DECLARE @AC4  UNIQUEIDENTIFIER; SELECT @AC4  = id FROM dbo.outreach_campaigns WHERE name = 'Spring Game Alumni Invite';
DECLARE @AC5  UNIQUEIDENTIFIER; SELECT @AC5  = id FROM dbo.outreach_campaigns WHERE name = 'Summer Alumni Check-In';
DECLARE @AC6  UNIQUEIDENTIFIER; SELECT @AC6  = id FROM dbo.outreach_campaigns WHERE name = 'Back to Campus Weekend';
DECLARE @AC7  UNIQUEIDENTIFIER; SELECT @AC7  = id FROM dbo.outreach_campaigns WHERE name = 'Fall Alumni Newsletter';
DECLARE @AC8  UNIQUEIDENTIFIER; SELECT @AC8  = id FROM dbo.outreach_campaigns WHERE name = 'Homecoming Follow-Up';
DECLARE @AC9  UNIQUEIDENTIFIER; SELECT @AC9  = id FROM dbo.outreach_campaigns WHERE name = 'November Alumni Engagement';
DECLARE @AC10 UNIQUEIDENTIFIER; SELECT @AC10 = id FROM dbo.outreach_campaigns WHERE name = 'Year-End Alumni Message';

-- Campaign 1 — 55% open rate (row# % 20 >= 9 → ~55% open)
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC1, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -359, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 20 >= 9 THEN DATEADD(DAY, -357, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

-- Campaign 2 — 45% open rate
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC2, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -319, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 20 < 9 THEN DATEADD(DAY, -317, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

-- Campaign 3 — 65% open rate
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC3, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -279, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 3 != 0 THEN DATEADD(DAY, -277, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

-- Campaign 4 — 75% open rate (event invite — high open)
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC4, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -239, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 4 != 0 THEN DATEADD(DAY, -237, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

-- Campaign 5 — 50% open rate
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC5, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -199, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 2 = 0 THEN DATEADD(DAY, -197, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

-- Campaign 6 — 70% open rate (back to campus — event invite)
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC6, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -159, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 10 < 7 THEN DATEADD(DAY, -157, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

-- Campaign 7 — 48% open rate
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC7, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -119, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 25 < 12 THEN DATEADD(DAY, -117, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

-- Campaign 8 — 72% open rate (homecoming — high intent)
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC8, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -79, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 7 != 0 THEN DATEADD(DAY, -77, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

-- Campaign 9 — 52% open rate  (within 30 days → month tile)
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC9, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -21, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 21 < 11 THEN DATEADD(DAY, -19, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

-- Campaign 10 — 60% open rate (within 30 days → month tile)
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @AC10, us.user_id, 'email', 'sent', u.email, NEWID(),
  DATEADD(DAY, -5, SYSUTCDATETIME()),
  CASE WHEN ROW_NUMBER() OVER (ORDER BY us.user_id) % 5 < 3 THEN DATEADD(DAY, -4, SYSUTCDATETIME()) ELSE NULL END
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id
WHERE us.program_role_id = 7 AND us.is_active = 1;

PRINT 'Inserted alumni outreach messages (10 campaigns).';

-- ─── 4. Player Outreach Messages ─────────────────────────────────────────────

DECLARE @PC1 UNIQUEIDENTIFIER; SELECT @PC1 = id FROM dbo.outreach_campaigns WHERE name = 'Spring Practice Kickoff';
DECLARE @PC2 UNIQUEIDENTIFIER; SELECT @PC2 = id FROM dbo.outreach_campaigns WHERE name = 'Spring Game Logistics';
DECLARE @PC3 UNIQUEIDENTIFIER; SELECT @PC3 = id FROM dbo.outreach_campaigns WHERE name = 'Summer Workout Program';
DECLARE @PC4 UNIQUEIDENTIFIER; SELECT @PC4 = id FROM dbo.outreach_campaigns WHERE name = 'Fall Camp Details';
DECLARE @PC5 UNIQUEIDENTIFIER; SELECT @PC5 = id FROM dbo.outreach_campaigns WHERE name = 'Mid-Season Check-In';
DECLARE @PC6 UNIQUEIDENTIFIER; SELECT @PC6 = id FROM dbo.outreach_campaigns WHERE name = 'End of Season Wrap-Up';

INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @PC1, us.user_id, 'email', 'sent', u.email, NEWID(), DATEADD(DAY, -354, SYSUTCDATETIME()), NULL
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id WHERE us.program_role_id = 8 AND us.is_active = 1;

INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @PC2, us.user_id, 'email', 'sent', u.email, NEWID(), DATEADD(DAY, -284, SYSUTCDATETIME()), NULL
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id WHERE us.program_role_id = 8 AND us.is_active = 1;

INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @PC3, us.user_id, 'email', 'sent', u.email, NEWID(), DATEADD(DAY, -224, SYSUTCDATETIME()), NULL
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id WHERE us.program_role_id = 8 AND us.is_active = 1;

INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @PC4, us.user_id, 'email', 'sent', u.email, NEWID(), DATEADD(DAY, -149, SYSUTCDATETIME()), NULL
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id WHERE us.program_role_id = 8 AND us.is_active = 1;

INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @PC5, us.user_id, 'email', 'sent', u.email, NEWID(), DATEADD(DAY, -84, SYSUTCDATETIME()), NULL
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id WHERE us.program_role_id = 8 AND us.is_active = 1;

-- PC6 — within 30 days, drives month tile
INSERT INTO dbo.outreach_messages (id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at)
SELECT NEWID(), @PC6, us.user_id, 'email', 'sent', u.email, NEWID(), DATEADD(DAY, -17, SYSUTCDATETIME()), NULL
FROM dbo.users_sports us JOIN dbo.users u ON u.user_id = us.user_id WHERE us.program_role_id = 8 AND us.is_active = 1;

PRINT 'Inserted player outreach messages (6 campaigns).';
GO

-- ─── 5. Interaction Log (~12 touches per alumni across the year) ──────────────
-- 12 UNION ALL blocks, each producing 1 row per active alumni user.
-- Channels, summaries, outcomes, and dates vary across blocks.

DECLARE @StaffId INT;
SELECT TOP 1 @StaffId = u.user_id
FROM dbo.users u WHERE u.is_active = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.users_sports us WHERE us.user_id = u.user_id AND us.program_role_id IN (7, 8))
ORDER BY u.user_id;

INSERT INTO dbo.interaction_log (user_id, logged_by_user_id, channel, summary, outcome, logged_at)

-- Touch 1 — early January (~355 days ago)
SELECT us.user_id, @StaffId, 'email',
  'Sent initial outreach to reconnect with alumni network at the start of the year.',
  'positive', DATEADD(DAY, -355, SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 2 — early February (~320 days ago)
SELECT us.user_id, @StaffId, 'phone',
  'Called to check in on post-graduation life and career progress.',
  'positive', DATEADD(DAY, -320 + (us.user_id % 7), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 3 — late February (~295 days ago)
SELECT us.user_id, @StaffId, 'text',
  'Sent text to confirm updated contact info in the system.',
  'positive', DATEADD(DAY, -295 + (us.user_id % 5), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 4 — March (~265 days ago)
SELECT us.user_id, @StaffId, 'email',
  'Alumni expressed interest in mentoring a current player. Referred to the mentoring module.',
  'positive', DATEADD(DAY, -265 + (us.user_id % 9), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 5 — April (~230 days ago)
SELECT us.user_id, @StaffId, 'phone',
  'Discussed upcoming spring game. Alumni confirmed attendance.',
  CASE WHEN us.user_id % 3 = 0 THEN 'no_response' ELSE 'positive' END,
  DATEADD(DAY, -230 + (us.user_id % 6), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 6 — May (~195 days ago)
SELECT us.user_id, @StaffId, 'email',
  'Followed up on internship opportunity shared with current players.',
  CASE WHEN us.user_id % 4 = 0 THEN 'follow_up' ELSE 'positive' END,
  DATEADD(DAY, -195 + (us.user_id % 8), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 7 — July (~155 days ago)
SELECT us.user_id, @StaffId, 'text',
  'Reached out about alumni weekend in the fall. Alumni confirmed they plan to attend.',
  'positive', DATEADD(DAY, -155 + (us.user_id % 5), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 8 — August (~120 days ago)
SELECT us.user_id, @StaffId, 'phone',
  'Pre-season call to share season schedule and invite to home opener.',
  CASE WHEN us.user_id % 5 = 0 THEN 'no_response' ELSE 'positive' END,
  DATEADD(DAY, -120 + (us.user_id % 7), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 9 — October (~75 days ago)
SELECT us.user_id, @StaffId, 'email',
  'Post-homecoming thank-you email to alumni who attended. Shared photo recap.',
  'positive', DATEADD(DAY, -75 + (us.user_id % 6), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 10 — October/November (~50 days ago)
SELECT us.user_id, @StaffId, 'phone',
  'Mid-season check-in call. Discussed alumni''s interest in giving back to the program.',
  CASE WHEN us.user_id % 3 = 1 THEN 'follow_up' ELSE 'positive' END,
  DATEADD(DAY, -50 + (us.user_id % 8), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 11 — November (~20 days ago — within 30-day window, drives month tile)
SELECT us.user_id, @StaffId, 'email',
  'Sent year-end recap and asked about availability for the annual alumni banquet.',
  CASE WHEN us.user_id % 4 = 0 THEN 'no_response' ELSE 'positive' END,
  DATEADD(DAY, -20 + (us.user_id % 5), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1

UNION ALL

-- Touch 12 — this week (~4 days ago — very recent, drives month tile)
SELECT us.user_id, @StaffId, 'text',
  'Quick text to confirm contact info is current heading into the off-season.',
  'positive', DATEADD(DAY, -4 + (us.user_id % 3), SYSUTCDATETIME())
FROM dbo.users_sports us WHERE us.program_role_id = 7 AND us.is_active = 1;

PRINT 'Inserted 12 interaction log touches per alumni user.';

-- ─── 6. Login stamps (spread across the year) ────────────────────────────────
-- ~75% of alumni have logged in within the last 30 days.
-- The remaining 25% have a login somewhere in the last 365 days.

UPDATE u
SET u.last_team_login =
  CASE
    -- 75% — logged in within the last 28 days (drives the active login tile)
    WHEN u.user_id % 4 != 0
      THEN DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 28 + 1), SYSUTCDATETIME())
    -- 25% — logged in somewhere in the last 6 months
    ELSE
      DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 180 + 30), SYSUTCDATETIME())
  END
FROM dbo.users u
WHERE EXISTS (
  SELECT 1 FROM dbo.users_sports us
  WHERE us.user_id = u.user_id
    AND us.program_role_id = 7
    AND us.is_active = 1
);

PRINT 'Stamped last_team_login for alumni users.';

-- ─── 7. Feed posts (spread across the year) ──────────────────────────────────
-- Inserts posts targeting both alumni and players throughout the year.
-- Drives the "Feed Posts" tiles on the dashboard.

INSERT INTO dbo.feed_posts (
  created_by, title, body_html, audience,
  target_program_role_id, is_deleted, is_pinned, is_welcome_post, created_at
)
VALUES
  -- All-audience posts (program-wide)
  (@StaffId, 'Welcome to the New Season',        '<p>A new year with the program starts now. Let''s make it count.</p>',                   'program', NULL, 0, 0, 0, DATEADD(DAY, -358, SYSUTCDATETIME())),
  (@StaffId, 'Spring Practice Update',           '<p>Great energy in practice this week. Keep the momentum going.</p>',                   'program', NULL, 0, 0, 0, DATEADD(DAY, -310, SYSUTCDATETIME())),
  (@StaffId, 'Spring Game Recap',                '<p>What a showing from everyone today. Proud of this group.</p>',                       'program', NULL, 0, 0, 0, DATEADD(DAY, -270, SYSUTCDATETIME())),
  (@StaffId, 'Summer Program Is Live',           '<p>Summer workouts are up and running. Stay consistent, stay hungry.</p>',              'program', NULL, 0, 0, 0, DATEADD(DAY, -215, SYSUTCDATETIME())),
  (@StaffId, 'Fall Camp Opens This Week',        '<p>Camp opens Monday. Get your mind right — this is what we''ve worked for.</p>',       'program', NULL, 0, 0, 0, DATEADD(DAY, -145, SYSUTCDATETIME())),
  (@StaffId, 'Season Opener This Saturday',      '<p>First game of the season is here. Everyone travels — details in the app.</p>',       'program', NULL, 0, 0, 0, DATEADD(DAY, -118, SYSUTCDATETIME())),
  (@StaffId, 'Week 4 Win — Keep Climbing',       '<p>4-0. The work is showing. Enjoy the night, back at it tomorrow.</p>',               'program', NULL, 0, 0, 0, DATEADD(DAY, -97, SYSUTCDATETIME())),
  (@StaffId, 'Homecoming Week',                  '<p>Homecoming week is here. Represent the program with class all week.</p>',            'program', NULL, 0, 0, 0, DATEADD(DAY, -83, SYSUTCDATETIME())),
  (@StaffId, 'End of Season Message',            '<p>This team gave everything. Proud of every one of you. More ahead.</p>',             'program', NULL, 0, 0, 0, DATEADD(DAY, -16, SYSUTCDATETIME())),
  (@StaffId, 'Off-Season Starts Now',            '<p>Season is over, but the work doesn''t stop. Off-season plan is posted.</p>',        'program', NULL, 0, 0, 0, DATEADD(DAY, -4,  SYSUTCDATETIME())),

  -- Alumni-targeted posts (program_role_id = 7)
  (@StaffId, 'Alumni Spotlight — January',       '<p>This month we''re highlighting alumni making waves in their careers.</p>',           'program', 7, 0, 0, 0, DATEADD(DAY, -340, SYSUTCDATETIME())),
  (@StaffId, 'Spring Game Alumni Section',       '<p>Alumni section is open for the spring game — come back to campus.</p>',             'program', 7, 0, 0, 0, DATEADD(DAY, -245, SYSUTCDATETIME())),
  (@StaffId, 'Mentoring Program Is Open',        '<p>Looking for alumni willing to mentor current players. Sign up inside.</p>',          'program', 7, 0, 0, 0, DATEADD(DAY, -198, SYSUTCDATETIME())),
  (@StaffId, 'Alumni Weekend Details',           '<p>Here''s everything you need to know about alumni weekend next month.</p>',           'program', 7, 0, 0, 0, DATEADD(DAY, -170, SYSUTCDATETIME())),
  (@StaffId, 'Job Board — Fall Openings',        '<p>Alumni have posted new job opportunities for current players and recent grads.</p>', 'program', 7, 0, 0, 0, DATEADD(DAY, -130, SYSUTCDATETIME())),
  (@StaffId, 'Homecoming — Alumni Section Info', '<p>Reserved seating for alumni at homecoming. Claim your spot now.</p>',               'program', 7, 0, 0, 0, DATEADD(DAY, -88, SYSUTCDATETIME())),
  (@StaffId, 'Year-End Alumni Newsletter',       '<p>A look back at everything we accomplished together this year.</p>',                  'program', 7, 0, 0, 0, DATEADD(DAY, -10, SYSUTCDATETIME())),
  (@StaffId, 'Happy Holidays from the Program',  '<p>Wishing all of our alumni a great holiday season. Stay connected.</p>',             'program', 7, 0, 0, 0, DATEADD(DAY, -3,  SYSUTCDATETIME())),

  -- Player-targeted posts (program_role_id = 8)
  (@StaffId, 'Spring Practice Schedule Posted',  '<p>Full spring practice schedule is now posted. Plan accordingly.</p>',                'program', 8, 0, 0, 0, DATEADD(DAY, -350, SYSUTCDATETIME())),
  (@StaffId, 'Summer Eligibility Reminder',      '<p>Make sure you''re cleared for summer activities before June 1.</p>',               'program', 8, 0, 0, 0, DATEADD(DAY, -228, SYSUTCDATETIME())),
  (@StaffId, 'Academic Check-In — Fall',         '<p>Mid-semester check-in is this week. See your position coach if you need support.</p>', 'program', 8, 0, 0, 0, DATEADD(DAY, -100, SYSUTCDATETIME())),
  (@StaffId, 'Senior Day This Week',             '<p>Senior Day is Saturday. Show up early, give your seniors a send-off they''ll remember.</p>', 'program', 8, 0, 0, 0, DATEADD(DAY, -55, SYSUTCDATETIME())),
  (@StaffId, 'Off-Season Lift Schedule',         '<p>Off-season lift schedule is posted. Report times by position group.</p>',           'program', 8, 0, 0, 0, DATEADD(DAY, -8,  SYSUTCDATETIME()));

PRINT 'Inserted 23 feed posts (10 all-program, 8 alumni, 5 player).';

-- ─── 8. Summary ──────────────────────────────────────────────────────────────

SELECT
  (SELECT COUNT(*) FROM dbo.outreach_campaigns)                                    AS total_campaigns,
  (SELECT COUNT(*) FROM dbo.outreach_messages WHERE status = 'sent')               AS emails_sent,
  (SELECT COUNT(*) FROM dbo.outreach_messages WHERE opened_at IS NOT NULL)         AS emails_opened,
  (SELECT COUNT(*) FROM dbo.interaction_log)                                       AS interactions,
  (SELECT COUNT(*) FROM dbo.users WHERE last_team_login >= DATEADD(DAY,-30,SYSUTCDATETIME())) AS alumni_logins_30d,
  (SELECT COUNT(*) FROM dbo.feed_posts WHERE is_welcome_post = 0 AND is_pinned = 0) AS feed_posts;

PRINT '=== seed_demo_metrics_full_year complete ===';
GO
