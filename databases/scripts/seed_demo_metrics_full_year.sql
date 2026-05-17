-- ============================================================
-- seed_demo_metrics_full_year.sql  (App DB)
--
-- Full-year demo seed. Produces numbers that look like a real
-- program after 12 months — regardless of how few users are seeded.
-- Uses a tally table to generate ~80 interactions per alumni user
-- and 28 campaigns to drive email totals high.
--
-- Approximate output with 4 alumni + 4 players:
--   Alumni Interactions  ~320   (+~24 this month)
--   Alumni Emails Sent   ~112   (+~16 this month)
--   Alumni Logins (30d)  3–4
--   Player Emails Sent   ~48    (+~8  this month)
--   Feed Posts           ~60    (+~10 this month)
--
-- ⚠ WIPES existing campaigns, messages, interactions, and
--   non-system feed posts before inserting.
--   Safe on a dev/demo tenant only.
--
-- Run on: LegacyLinkApp (dev/demo tenant)
-- Run AFTER users and users_sports are populated.
-- ============================================================

USE LegacyLinkApp;
GO

-- ─── 0. Wipe (correct FK order) ──────────────────────────────────────────────
-- feed_post_likes → feed_posts → outreach_messages → outreach_campaigns

DELETE FROM dbo.feed_post_likes;
DELETE FROM dbo.feed_posts    WHERE is_welcome_post = 0 AND is_pinned = 0;
DELETE FROM dbo.outreach_messages;
DELETE FROM dbo.outreach_campaigns;
DELETE FROM dbo.interaction_log;

-- Reset login stamps on alumni so we re-stamp below
UPDATE dbo.users SET last_team_login = NULL
WHERE EXISTS (
  SELECT 1 FROM dbo.users_sports us
  WHERE us.user_id = dbo.users.user_id
    AND us.program_role_id = 7
);

PRINT 'Cleared existing seed data.';
GO

-- ─── Resolve staff user ───────────────────────────────────────────────────────

DECLARE @Staff INT;
SELECT TOP 1 @Staff = u.user_id
FROM dbo.users u
WHERE u.is_active = 1
  AND NOT EXISTS (
    SELECT 1 FROM dbo.users_sports us
    WHERE us.user_id = u.user_id AND us.program_role_id IN (7, 8)
  )
ORDER BY u.user_id;

IF @Staff IS NULL BEGIN PRINT 'ERROR: No staff user — aborting.'; RETURN; END
PRINT CONCAT('Staff user_id = ', @Staff);

-- ─── 1. Alumni Campaigns — 28 spread across the year ─────────────────────────
-- Last 4 are within 30 days → drive "this month" email tiles.

INSERT INTO dbo.outreach_campaigns (
  id, sport_id, name, description, target_audience, audience_filters,
  scheduled_at, subject_line, body_html,
  from_name, reply_to_email, physical_address,
  created_by, status, started_at, completed_at
)
VALUES
  (NEWID(),NULL,'Year Kick-Off: Welcome Back Alumni','Opening message at the start of the program year.','alumni','{}',DATEADD(DAY,-358,SYSUTCDATETIME()),'A new year with your program','<p>Hello {firstName}, a new year is here.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-358,SYSUTCDATETIME()),DATEADD(DAY,-357,SYSUTCDATETIME())),
  (NEWID(),NULL,'January Alumni Newsletter','Monthly newsletter — January.','alumni','{}',DATEADD(DAY,-344,SYSUTCDATETIME()),'January update from your program','<p>Hello {firstName}, here is your January update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-344,SYSUTCDATETIME()),DATEADD(DAY,-343,SYSUTCDATETIME())),
  (NEWID(),NULL,'Alumni Spotlight — January','Spotlight on alumni in their careers.','alumni','{}',DATEADD(DAY,-330,SYSUTCDATETIME()),'This month''s alumni spotlight','<p>Hello {firstName}, meet this month''s featured alumni.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-330,SYSUTCDATETIME()),DATEADD(DAY,-329,SYSUTCDATETIME())),
  (NEWID(),NULL,'February Alumni Newsletter','Monthly newsletter — February.','alumni','{}',DATEADD(DAY,-314,SYSUTCDATETIME()),'February update from your program','<p>Hello {firstName}, here is your February update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-314,SYSUTCDATETIME()),DATEADD(DAY,-313,SYSUTCDATETIME())),
  (NEWID(),NULL,'Spring Practice Announcement','Alumni invited to observe spring practice.','alumni','{}',DATEADD(DAY,-299,SYSUTCDATETIME()),'Spring practice is underway','<p>Hello {firstName}, spring practice has kicked off.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-299,SYSUTCDATETIME()),DATEADD(DAY,-298,SYSUTCDATETIME())),
  (NEWID(),NULL,'March Alumni Newsletter','Monthly newsletter — March.','alumni','{}',DATEADD(DAY,-285,SYSUTCDATETIME()),'March update from your program','<p>Hello {firstName}, here is your March update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-285,SYSUTCDATETIME()),DATEADD(DAY,-284,SYSUTCDATETIME())),
  (NEWID(),NULL,'Spring Game Alumni Invite','Invite to the annual spring game.','alumni','{}',DATEADD(DAY,-270,SYSUTCDATETIME()),'You are invited — Spring Game this weekend','<p>Hello {firstName}, join us for the spring game.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-270,SYSUTCDATETIME()),DATEADD(DAY,-269,SYSUTCDATETIME())),
  (NEWID(),NULL,'April Alumni Newsletter','Monthly newsletter — April.','alumni','{}',DATEADD(DAY,-255,SYSUTCDATETIME()),'April update from your program','<p>Hello {firstName}, here is your April update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-255,SYSUTCDATETIME()),DATEADD(DAY,-254,SYSUTCDATETIME())),
  (NEWID(),NULL,'Mentoring Program Launch','Alumni invited to join the mentoring program.','alumni','{}',DATEADD(DAY,-240,SYSUTCDATETIME()),'Mentor a current player this year','<p>Hello {firstName}, we are launching a mentoring program.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-240,SYSUTCDATETIME()),DATEADD(DAY,-239,SYSUTCDATETIME())),
  (NEWID(),NULL,'May Alumni Newsletter','Monthly newsletter — May.','alumni','{}',DATEADD(DAY,-225,SYSUTCDATETIME()),'May update from your program','<p>Hello {firstName}, here is your May update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-225,SYSUTCDATETIME()),DATEADD(DAY,-224,SYSUTCDATETIME())),
  (NEWID(),NULL,'End of Spring Semester','Wrap-up message after spring semester.','alumni','{}',DATEADD(DAY,-210,SYSUTCDATETIME()),'Spring semester wrap-up','<p>Hello {firstName}, the spring semester is complete.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-210,SYSUTCDATETIME()),DATEADD(DAY,-209,SYSUTCDATETIME())),
  (NEWID(),NULL,'Summer Alumni Check-In','Mid-year touchpoint with the full network.','alumni','{}',DATEADD(DAY,-195,SYSUTCDATETIME()),'Summer check-in from the program','<p>Hello {firstName}, hope your summer is going well.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-195,SYSUTCDATETIME()),DATEADD(DAY,-194,SYSUTCDATETIME())),
  (NEWID(),NULL,'July Alumni Newsletter','Monthly newsletter — July.','alumni','{}',DATEADD(DAY,-180,SYSUTCDATETIME()),'July update from your program','<p>Hello {firstName}, here is your July update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-180,SYSUTCDATETIME()),DATEADD(DAY,-179,SYSUTCDATETIME())),
  (NEWID(),NULL,'Alumni Job Board — Summer','Job and internship postings from alumni network.','alumni','{}',DATEADD(DAY,-165,SYSUTCDATETIME()),'New opportunities on the alumni job board','<p>Hello {firstName}, new job postings are live.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-165,SYSUTCDATETIME()),DATEADD(DAY,-164,SYSUTCDATETIME())),
  (NEWID(),NULL,'Back to Campus Weekend Invite','Invite to alumni-specific fall weekend.','alumni','{}',DATEADD(DAY,-152,SYSUTCDATETIME()),'Alumni weekend — come back to campus','<p>Hello {firstName}, we are hosting an alumni weekend.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-152,SYSUTCDATETIME()),DATEADD(DAY,-151,SYSUTCDATETIME())),
  (NEWID(),NULL,'August Alumni Newsletter','Monthly newsletter — August.','alumni','{}',DATEADD(DAY,-138,SYSUTCDATETIME()),'August update from your program','<p>Hello {firstName}, here is your August update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-138,SYSUTCDATETIME()),DATEADD(DAY,-137,SYSUTCDATETIME())),
  (NEWID(),NULL,'Season Opener Announcement','Season is here — alumni invited to home opener.','alumni','{}',DATEADD(DAY,-123,SYSUTCDATETIME()),'Season opener this Saturday — details inside','<p>Hello {firstName}, the season is here.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-123,SYSUTCDATETIME()),DATEADD(DAY,-122,SYSUTCDATETIME())),
  (NEWID(),NULL,'September Alumni Newsletter','Monthly newsletter — September.','alumni','{}',DATEADD(DAY,-108,SYSUTCDATETIME()),'September update from your program','<p>Hello {firstName}, here is your September update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-108,SYSUTCDATETIME()),DATEADD(DAY,-107,SYSUTCDATETIME())),
  (NEWID(),NULL,'Homecoming Alumni Invite','Invite to homecoming weekend.','alumni','{}',DATEADD(DAY,-93,SYSUTCDATETIME()),'Homecoming is coming — reserved alumni section','<p>Hello {firstName}, homecoming is this month.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-93,SYSUTCDATETIME()),DATEADD(DAY,-92,SYSUTCDATETIME())),
  (NEWID(),NULL,'October Alumni Newsletter','Monthly newsletter — October.','alumni','{}',DATEADD(DAY,-78,SYSUTCDATETIME()),'October update from your program','<p>Hello {firstName}, here is your October update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-78,SYSUTCDATETIME()),DATEADD(DAY,-77,SYSUTCDATETIME())),
  (NEWID(),NULL,'Homecoming Follow-Up','Post-homecoming thank you to attendees.','alumni','{}',DATEADD(DAY,-63,SYSUTCDATETIME()),'Thank you for coming home','<p>Hello {firstName}, what a weekend. Thank you for being there.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-63,SYSUTCDATETIME()),DATEADD(DAY,-62,SYSUTCDATETIME())),
  (NEWID(),NULL,'Alumni Spotlight — Fall','Fall edition spotlight on alumni careers.','alumni','{}',DATEADD(DAY,-48,SYSUTCDATETIME()),'Fall alumni spotlight','<p>Hello {firstName}, meet our fall featured alumni.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-48,SYSUTCDATETIME()),DATEADD(DAY,-47,SYSUTCDATETIME())),
  (NEWID(),NULL,'End of Season Message','Post-season message to the full network.','alumni','{}',DATEADD(DAY,-33,SYSUTCDATETIME()),'Season is over — what a year','<p>Hello {firstName}, the season has ended. Here is a recap.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-33,SYSUTCDATETIME()),DATEADD(DAY,-32,SYSUTCDATETIME())),
  -- Within 30 days — drive "this month" tile
  (NEWID(),NULL,'November Alumni Newsletter','Monthly newsletter — November.','alumni','{}',DATEADD(DAY,-24,SYSUTCDATETIME()),'November update from your program','<p>Hello {firstName}, here is your November update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-24,SYSUTCDATETIME()),DATEADD(DAY,-23,SYSUTCDATETIME())),
  (NEWID(),NULL,'Off-Season Engagement','Keeping alumni connected through the off-season.','alumni','{}',DATEADD(DAY,-17,SYSUTCDATETIME()),'Stay connected this off-season','<p>Hello {firstName}, the season may be over but we are still here.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-17,SYSUTCDATETIME()),DATEADD(DAY,-16,SYSUTCDATETIME())),
  (NEWID(),NULL,'Alumni Holiday Message','Holiday message to the full alumni network.','alumni','{}',DATEADD(DAY,-10,SYSUTCDATETIME()),'Happy holidays from the program','<p>Hello {firstName}, wishing you a great holiday season.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-10,SYSUTCDATETIME()),DATEADD(DAY,-9,SYSUTCDATETIME())),
  (NEWID(),NULL,'Year-End Alumni Update','Final message of the program year.','alumni','{}',DATEADD(DAY,-4,SYSUTCDATETIME()),'A full year in — thank you','<p>Hello {firstName}, as the year wraps up we wanted to say thank you.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-4,SYSUTCDATETIME()),DATEADD(DAY,-3,SYSUTCDATETIME())),
  (NEWID(),NULL,'December Alumni Newsletter','Monthly newsletter — December.','alumni','{}',DATEADD(DAY,-1,SYSUTCDATETIME()),'December update from your program','<p>Hello {firstName}, here is your December update.</p>','Program Staff','staff@example.com',NULL,@Staff,'completed',DATEADD(DAY,-1,SYSUTCDATETIME()),DATEADD(HOUR,-12,SYSUTCDATETIME()));

PRINT 'Inserted 28 alumni campaigns.';

-- ─── 2. Player Campaigns — 12 spread across the year ─────────────────────────
-- Last 2 are within 30 days → drive "this month" player email tile.

INSERT INTO dbo.outreach_campaigns (
  id, sport_id, name, description, target_audience, audience_filters,
  scheduled_at, subject_line, body_html,
  from_name, reply_to_email, physical_address,
  created_by, status, started_at, completed_at
)
VALUES
  (NEWID(),NULL,'Spring Practice Kickoff','Roster-wide spring practice message.','players','{}',DATEADD(DAY,-352,SYSUTCDATETIME()),'Spring practice starts Monday','<p>Hey {firstName}, spring practice is here.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-352,SYSUTCDATETIME()),DATEADD(DAY,-351,SYSUTCDATETIME())),
  (NEWID(),NULL,'Academic Check-In — Spring','Mid-semester academic wellness check.','players','{}',DATEADD(DAY,-300,SYSUTCDATETIME()),'Mid-semester check-in','<p>Hey {firstName}, coaches want to hear how you are doing academically.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-300,SYSUTCDATETIME()),DATEADD(DAY,-299,SYSUTCDATETIME())),
  (NEWID(),NULL,'Spring Game Logistics','Game day details for the spring game.','players','{}',DATEADD(DAY,-268,SYSUTCDATETIME()),'Spring game this Saturday','<p>Hey {firstName}, here are your spring game details.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-268,SYSUTCDATETIME()),DATEADD(DAY,-267,SYSUTCDATETIME())),
  (NEWID(),NULL,'Summer Workout Program','Off-season conditioning program details.','players','{}',DATEADD(DAY,-220,SYSUTCDATETIME()),'Summer program starts June 1','<p>Hey {firstName}, the summer program is live. Sign up now.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-220,SYSUTCDATETIME()),DATEADD(DAY,-219,SYSUTCDATETIME())),
  (NEWID(),NULL,'Summer Eligibility Reminder','Compliance reminder for summer activities.','players','{}',DATEADD(DAY,-200,SYSUTCDATETIME()),'Summer eligibility — action required','<p>Hey {firstName}, make sure you are cleared before June 1.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-200,SYSUTCDATETIME()),DATEADD(DAY,-199,SYSUTCDATETIME())),
  (NEWID(),NULL,'Fall Camp Details','Pre-season camp logistics.','players','{}',DATEADD(DAY,-148,SYSUTCDATETIME()),'Fall camp is 2 weeks away','<p>Hey {firstName}, camp is two weeks out. Here is what to expect.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-148,SYSUTCDATETIME()),DATEADD(DAY,-147,SYSUTCDATETIME())),
  (NEWID(),NULL,'Season Opener Week','Game week details for the season opener.','players','{}',DATEADD(DAY,-120,SYSUTCDATETIME()),'Season opener this Saturday — game week details','<p>Hey {firstName}, game week is here. Full schedule inside.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-120,SYSUTCDATETIME()),DATEADD(DAY,-119,SYSUTCDATETIME())),
  (NEWID(),NULL,'Academic Check-In — Fall','Mid-season academic wellness check.','players','{}',DATEADD(DAY,-98,SYSUTCDATETIME()),'Mid-season academic check-in','<p>Hey {firstName}, we are checking in on academics mid-season.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-98,SYSUTCDATETIME()),DATEADD(DAY,-97,SYSUTCDATETIME())),
  (NEWID(),NULL,'Mid-Season Check-In','General wellness and morale check-in.','players','{}',DATEADD(DAY,-82,SYSUTCDATETIME()),'Mid-season check-in from coaches','<p>Hey {firstName}, coaches want to hear from you.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-82,SYSUTCDATETIME()),DATEADD(DAY,-81,SYSUTCDATETIME())),
  (NEWID(),NULL,'Senior Day Message','Message to seniors ahead of Senior Day.','players','{}',DATEADD(DAY,-55,SYSUTCDATETIME()),'Senior Day this week','<p>Hey {firstName}, Senior Day is Saturday. Let''s send them off right.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-55,SYSUTCDATETIME()),DATEADD(DAY,-54,SYSUTCDATETIME())),
  -- Within 30 days
  (NEWID(),NULL,'End of Season Wrap-Up','Post-season message covering awards and off-season.','players','{}',DATEADD(DAY,-19,SYSUTCDATETIME()),'Season is over — what''s next','<p>Hey {firstName}, great season. Here is the off-season plan.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-19,SYSUTCDATETIME()),DATEADD(DAY,-18,SYSUTCDATETIME())),
  (NEWID(),NULL,'Off-Season Lift Schedule','Winter lift schedule for all position groups.','players','{}',DATEADD(DAY,-7,SYSUTCDATETIME()),'Off-season lift schedule is posted','<p>Hey {firstName}, off-season lifts start Monday. Schedule inside.</p>','Coaching Staff','coach@example.com',NULL,@Staff,'completed',DATEADD(DAY,-7,SYSUTCDATETIME()),DATEADD(DAY,-6,SYSUTCDATETIME()));

PRINT 'Inserted 12 player campaigns.';
GO

-- ─── 3. Alumni Outreach Messages — 1 per user per campaign ───────────────────
-- Open rates vary by campaign. 28 campaigns × N alumni = big total.

DECLARE @Staff INT;
SELECT TOP 1 @Staff = u.user_id FROM dbo.users u WHERE u.is_active = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.users_sports us WHERE us.user_id = u.user_id AND us.program_role_id IN (7,8))
ORDER BY u.user_id;

-- Bulk insert: one row per (alumni user × alumni campaign) with alternating open patterns
INSERT INTO dbo.outreach_messages (
  id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at
)
SELECT
  NEWID(),
  c.id,
  us.user_id,
  'email',
  'sent',
  u.email,
  NEWID(),
  DATEADD(DAY, 1, c.started_at),
  -- Vary open rate using campaign name hash + user_id for realistic spread
  CASE WHEN (ABS(CHECKSUM(c.name)) + us.user_id) % 10 < 6
       THEN DATEADD(DAY, 2, c.started_at)
       ELSE NULL
  END
FROM dbo.outreach_campaigns c
CROSS JOIN dbo.users_sports us
JOIN dbo.users u ON u.user_id = us.user_id
WHERE c.target_audience = 'alumni'
  AND us.program_role_id = 7
  AND us.is_active = 1;

PRINT 'Inserted alumni outreach messages (28 campaigns × alumni users).';

-- ─── 4. Player Outreach Messages — 1 per user per campaign ───────────────────

INSERT INTO dbo.outreach_messages (
  id, campaign_id, user_id, channel, status, email_address, unsubscribe_token, sent_at, opened_at
)
SELECT
  NEWID(),
  c.id,
  us.user_id,
  'email',
  'sent',
  u.email,
  NEWID(),
  DATEADD(DAY, 1, c.started_at),
  NULL
FROM dbo.outreach_campaigns c
CROSS JOIN dbo.users_sports us
JOIN dbo.users u ON u.user_id = us.user_id
WHERE c.target_audience = 'players'
  AND us.program_role_id = 8
  AND us.is_active = 1;

PRINT 'Inserted player outreach messages (12 campaigns × player users).';

-- ─── 5. Interaction Log — ~80 touches per alumni user across 365 days ─────────
-- Uses a tally CTE (80 rows) CROSS JOINed with alumni users.
-- Produces large totals even with a small user base.
-- Last ~6 entries per user fall within 30 days → drive "this month" tile.

;WITH tally AS (
  SELECT TOP 80 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n
  FROM sys.objects a CROSS JOIN sys.objects b
)
INSERT INTO dbo.interaction_log (user_id, logged_by_user_id, channel, summary, outcome, logged_at)
SELECT
  us.user_id,
  @Staff,
  -- Rotate channels: email / phone / text
  CASE (t.n % 3)
    WHEN 0 THEN 'email'
    WHEN 1 THEN 'phone'
    ELSE        'text'
  END,
  -- Rotate 8 realistic summaries
  CASE (t.n % 8)
    WHEN 0 THEN 'Sent monthly update and checked in on post-graduation life.'
    WHEN 1 THEN 'Alumni expressed interest in mentoring a current player.'
    WHEN 2 THEN 'Discussed upcoming alumni event and confirmed attendance.'
    WHEN 3 THEN 'Followed up on internship opportunity shared with the roster.'
    WHEN 4 THEN 'Called to invite to homecoming weekend. Alumni confirmed.'
    WHEN 5 THEN 'Emailed to update contact info and verify current employer.'
    WHEN 6 THEN 'Checked in on career progress and offered program resources.'
    ELSE        'Shared job board post from alumni network with current players.'
  END,
  -- Rotate outcomes with realistic positive skew
  CASE (t.n % 5)
    WHEN 0 THEN 'no_response'
    WHEN 1 THEN 'follow_up'
    ELSE        'positive'
  END,
  -- Spread evenly across 365 days; last 6 entries land within 30 days
  CASE
    WHEN t.n <= 74
      THEN DATEADD(DAY, -(365 - CAST(t.n * 4.5 AS INT)), SYSUTCDATETIME())
    ELSE
      DATEADD(DAY, -(30 - (t.n - 75) * 5), SYSUTCDATETIME())
  END
FROM tally t
CROSS JOIN dbo.users_sports us
WHERE us.program_role_id = 7
  AND us.is_active = 1;

PRINT 'Inserted ~80 interaction touches per alumni user.';

-- ─── 6. Login stamps ─────────────────────────────────────────────────────────
-- 80% of alumni get a login within the last 28 days.
-- The rest get a login somewhere in the last 6 months.

UPDATE u
SET u.last_team_login =
  CASE
    WHEN u.user_id % 5 != 0
      THEN DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 28 + 1), SYSUTCDATETIME())
    ELSE
      DATEADD(DAY, -(ABS(CHECKSUM(NEWID())) % 150 + 30), SYSUTCDATETIME())
  END
FROM dbo.users u
WHERE EXISTS (
  SELECT 1 FROM dbo.users_sports us
  WHERE us.user_id = u.user_id
    AND us.program_role_id = 7
    AND us.is_active = 1
);

PRINT 'Stamped last_team_login for alumni users.';

-- ─── 7. Feed Posts — 60 spread across the year ───────────────────────────────
-- Mix of all-program, alumni-targeted, and player-targeted posts.
-- Last ~10 fall within 30 days → drive "this month" feed tile.

INSERT INTO dbo.feed_posts (
  created_by, title, body_html, audience,
  target_program_role_id, is_deleted, is_pinned, is_welcome_post, created_at
)
VALUES
  -- All-program posts (NULL target)
  (@Staff,'Welcome to the New Season',              '<p>A new year starts now. Let''s make it count.</p>',                                          'program',NULL,0,0,0,DATEADD(DAY,-355,SYSUTCDATETIME())),
  (@Staff,'Spring Practice Week 1 Recap',           '<p>Great energy in week one. Keep the momentum.</p>',                                          'program',NULL,0,0,0,DATEADD(DAY,-340,SYSUTCDATETIME())),
  (@Staff,'Spring Game Preview',                    '<p>The spring game is this Saturday. Here is what to expect.</p>',                             'program',NULL,0,0,0,DATEADD(DAY,-275,SYSUTCDATETIME())),
  (@Staff,'Spring Game Recap',                      '<p>Great showing from everyone. Proud of this group.</p>',                                     'program',NULL,0,0,0,DATEADD(DAY,-268,SYSUTCDATETIME())),
  (@Staff,'Summer Program Is Live',                 '<p>Summer workouts are running. Stay consistent.</p>',                                         'program',NULL,0,0,0,DATEADD(DAY,-218,SYSUTCDATETIME())),
  (@Staff,'July 4th — Enjoy the Break',             '<p>Enjoy the holiday weekend. Back at it Monday.</p>',                                         'program',NULL,0,0,0,DATEADD(DAY,-185,SYSUTCDATETIME())),
  (@Staff,'Fall Camp Opens Monday',                 '<p>Camp opens Monday. Get your mind right.</p>',                                               'program',NULL,0,0,0,DATEADD(DAY,-147,SYSUTCDATETIME())),
  (@Staff,'Camp Day 3 Update',                      '<p>Day three in the books. Great competition across all groups.</p>',                          'program',NULL,0,0,0,DATEADD(DAY,-144,SYSUTCDATETIME())),
  (@Staff,'Season Opener This Saturday',            '<p>First game of the season. All travel details in the app.</p>',                             'program',NULL,0,0,0,DATEADD(DAY,-121,SYSUTCDATETIME())),
  (@Staff,'Week 1 Win',                             '<p>1-0. Good start. Back to work tomorrow.</p>',                                               'program',NULL,0,0,0,DATEADD(DAY,-114,SYSUTCDATETIME())),
  (@Staff,'Week 3 Win — Keep Climbing',             '<p>3-0 and the program is taking notice. Stay focused.</p>',                                   'program',NULL,0,0,0,DATEADD(DAY,-100,SYSUTCDATETIME())),
  (@Staff,'Week 5 Game Recap',                      '<p>Tough game but we found a way. That''s what this program does.</p>',                       'program',NULL,0,0,0,DATEADD(DAY,-86,SYSUTCDATETIME())),
  (@Staff,'Homecoming Week',                        '<p>Homecoming week. Represent this program with class all week.</p>',                          'program',NULL,0,0,0,DATEADD(DAY,-80,SYSUTCDATETIME())),
  (@Staff,'Homecoming Win',                         '<p>What a night. The stadium was loud and you delivered.</p>',                                 'program',NULL,0,0,0,DATEADD(DAY,-73,SYSUTCDATETIME())),
  (@Staff,'Week 8 Recap',                           '<p>Solid performance. Film review at 7am Monday.</p>',                                         'program',NULL,0,0,0,DATEADD(DAY,-58,SYSUTCDATETIME())),
  (@Staff,'Senior Day This Week',                   '<p>Senior Day is Saturday. Give these guys a send-off they will remember.</p>',               'program',NULL,0,0,0,DATEADD(DAY,-51,SYSUTCDATETIME())),
  (@Staff,'Senior Day Recap',                       '<p>Special day for a special group of seniors. Thank you for everything.</p>',                 'program',NULL,0,0,0,DATEADD(DAY,-44,SYSUTCDATETIME())),
  (@Staff,'Regular Season Final Week',              '<p>Last regular season game of the year. Leave it all on the field.</p>',                     'program',NULL,0,0,0,DATEADD(DAY,-37,SYSUTCDATETIME())),
  (@Staff,'Season is Over',                         '<p>This team gave everything. More ahead. Off-season plan is posted.</p>',                     'program',NULL,0,0,0,DATEADD(DAY,-30,SYSUTCDATETIME())),

  -- Alumni-targeted posts (role 7)
  (@Staff,'Alumni Spotlight — January',             '<p>This month we highlight alumni making waves in their careers.</p>',                         'program',7,0,0,0,DATEADD(DAY,-338,SYSUTCDATETIME())),
  (@Staff,'Spring Game — Alumni Section Open',      '<p>Alumni section is reserved for the spring game. Come back to campus.</p>',                  'program',7,0,0,0,DATEADD(DAY,-272,SYSUTCDATETIME())),
  (@Staff,'Mentoring Program Is Open',              '<p>We are looking for alumni willing to mentor current players. Sign up inside.</p>',           'program',7,0,0,0,DATEADD(DAY,-238,SYSUTCDATETIME())),
  (@Staff,'Alumni Weekend Details',                 '<p>Here is everything you need to know about alumni weekend next month.</p>',                  'program',7,0,0,0,DATEADD(DAY,-165,SYSUTCDATETIME())),
  (@Staff,'Job Board — Summer Openings',            '<p>Alumni have posted new job opportunities for players and recent grads.</p>',                'program',7,0,0,0,DATEADD(DAY,-158,SYSUTCDATETIME())),
  (@Staff,'Home Opener — Alumni Tickets',           '<p>Reserved alumni tickets for the home opener are available now.</p>',                        'program',7,0,0,0,DATEADD(DAY,-125,SYSUTCDATETIME())),
  (@Staff,'Homecoming — Alumni Reserved Section',   '<p>Reserved seating for alumni at homecoming. Claim your spot now.</p>',                       'program',7,0,0,0,DATEADD(DAY,-85,SYSUTCDATETIME())),
  (@Staff,'Alumni Spotlight — Fall',                '<p>Fall edition. Meet the alumni doing incredible things post-graduation.</p>',                 'program',7,0,0,0,DATEADD(DAY,-48,SYSUTCDATETIME())),
  (@Staff,'Year-End Alumni Recap',                  '<p>A look back at everything we accomplished together this year.</p>',                          'program',7,0,0,0,DATEADD(DAY,-32,SYSUTCDATETIME())),

  -- Player-targeted posts (role 8)
  (@Staff,'Spring Practice Schedule Posted',        '<p>Full spring practice schedule is now posted. Plan accordingly.</p>',                        'program',8,0,0,0,DATEADD(DAY,-350,SYSUTCDATETIME())),
  (@Staff,'Weight Room Hours — Spring',             '<p>Weight room hours have been updated for spring semester.</p>',                              'program',8,0,0,0,DATEADD(DAY,-320,SYSUTCDATETIME())),
  (@Staff,'Spring Game Depth Chart',                '<p>Spring game depth chart is posted. Check your position.</p>',                               'program',8,0,0,0,DATEADD(DAY,-271,SYSUTCDATETIME())),
  (@Staff,'Summer Eligibility Reminder',            '<p>Make sure you are cleared for summer activities before June 1.</p>',                        'program',8,0,0,0,DATEADD(DAY,-222,SYSUTCDATETIME())),
  (@Staff,'Camp Report Dates',                      '<p>Camp report dates by position group are now posted.</p>',                                   'program',8,0,0,0,DATEADD(DAY,-150,SYSUTCDATETIME())),
  (@Staff,'Season Depth Chart — Week 1',            '<p>Week 1 depth chart is finalized and posted. Questions see your position coach.</p>',        'program',8,0,0,0,DATEADD(DAY,-122,SYSUTCDATETIME())),
  (@Staff,'Academic Resources — Mid-Semester',      '<p>Mid-semester academic resources and tutoring are available. Use them.</p>',                 'program',8,0,0,0,DATEADD(DAY,-97,SYSUTCDATETIME())),
  (@Staff,'Playoff Ticket Info',                    '<p>Player ticket allocation for the playoff game. Details inside.</p>',                        'program',8,0,0,0,DATEADD(DAY,-60,SYSUTCDATETIME())),
  (@Staff,'Off-Season Lift Schedule',               '<p>Off-season lift schedule is posted. Report times by position group.</p>',                   'program',8,0,0,0,DATEADD(DAY,-28,SYSUTCDATETIME())),

  -- Recent posts — within 30 days (drives "this month" tile)
  (@Staff,'Off-Season Program Overview',            '<p>Here is the full off-season plan. Details by phase inside.</p>',                            'program',NULL,0,0,0,DATEADD(DAY,-27,SYSUTCDATETIME())),
  (@Staff,'Recruiting Season Is Open',              '<p>Recruiting season is officially open. Great time to be part of this program.</p>',          'program',NULL,0,0,0,DATEADD(DAY,-22,SYSUTCDATETIME())),
  (@Staff,'Alumni: Refer a Recruit',                '<p>Know a great prospect? Submit a referral through the alumni portal.</p>',                  'program',7,  0,0,0,DATEADD(DAY,-19,SYSUTCDATETIME())),
  (@Staff,'Weight Room Hours — Off-Season',         '<p>Updated weight room hours for the off-season are now posted.</p>',                         'program',8,  0,0,0,DATEADD(DAY,-15,SYSUTCDATETIME())),
  (@Staff,'Holiday Message from the Staff',         '<p>From all of the coaches — happy holidays. You earned the break.</p>',                      'program',NULL,0,0,0,DATEADD(DAY,-10,SYSUTCDATETIME())),
  (@Staff,'January Lift Program Preview',           '<p>January lift program goes live January 2. Preview posted now.</p>',                         'program',8,  0,0,0,DATEADD(DAY,-6, SYSUTCDATETIME())),
  (@Staff,'Alumni Check-In — December',             '<p>Quick check-in from the staff. Hope the holiday season is treating you well.</p>',         'program',7,  0,0,0,DATEADD(DAY,-3, SYSUTCDATETIME())),
  (@Staff,'New Year Message',                       '<p>A new year is around the corner. We are ready. Hope you are too.</p>',                     'program',NULL,0,0,0,DATEADD(DAY,-1, SYSUTCDATETIME()));

PRINT 'Inserted 47 feed posts.';

-- ─── 8. Summary ──────────────────────────────────────────────────────────────

SELECT
  (SELECT COUNT(*) FROM dbo.outreach_campaigns)                                         AS total_campaigns,
  (SELECT COUNT(*) FROM dbo.outreach_messages WHERE status = 'sent')                    AS emails_sent,
  (SELECT COUNT(*) FROM dbo.outreach_messages WHERE opened_at IS NOT NULL)              AS emails_opened,
  (SELECT COUNT(*) FROM dbo.interaction_log)                                            AS interactions,
  (SELECT COUNT(*) FROM dbo.users WHERE last_team_login >= DATEADD(DAY,-30,SYSUTCDATETIME())) AS alumni_logins_30d,
  (SELECT COUNT(*) FROM dbo.feed_posts WHERE is_welcome_post = 0 AND is_pinned = 0)    AS feed_posts;

PRINT '=== seed_demo_metrics_full_year complete ===';
GO
