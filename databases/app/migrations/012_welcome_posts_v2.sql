-- ============================================================
-- 012_welcome_posts_v2.sql
-- Replaces the 9 v1 welcome posts with the 8 canonical v2
-- posts per spec.
--
-- Key changes from 011:
--   • 8 posts (no Tier 1 / Player — no player role at Tier 1)
--   • role_group: 'admin' | 'alumni' | 'player'
--     Staff/coaches share the 'admin' post (no separate 'staff')
--   • Voice locked: identical opening for all posts;
--     feature list scales per tier; closing locked per audience
--   • audience = 'all_sports' (Feed V2 value)
--
-- Tokens resolved at render time (lib/feedTokens.ts):
--   {{TEAM_NAME}}     → teamConfig.teamName
--   {{TEAM_LOGO_URL}} → teamConfig.logoUrl
--   {{ACCENT_COLOR}}  → teamConfig.accentColor
--
-- Run on: each tenant App DB
-- Run after: 011_feed_v2.sql
-- ============================================================

DELETE FROM dbo.feed_posts WHERE is_welcome_post = 1;
GO

DECLARE @SysUser  INT          = ISNULL((SELECT MIN(user_id) FROM dbo.users), 0);
DECLARE @Now      DATETIME2    = GETUTCDATE();
DECLARE @ImgUrl   NVARCHAR(500)= N'{{TEAM_LOGO_URL}}';

-- ── Shared fragments ──────────────────────────────────────────────────────────

DECLARE @Hdr NVARCHAR(MAX) =
    N'<p style="font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:1px;'
  + N'text-transform:uppercase;margin:0 0 4px 0;">Powered by LegacyLink HQ</p>';

DECLARE @Open NVARCHAR(MAX) =
    N'<p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">'
  + N'Every athlete who ever wore your colors is part of something bigger. '
  + N'This is where that story lives.</p>';

DECLARE @WhatYouHave NVARCHAR(MAX) =
    N'<p style="font-size:14px;font-weight:700;color:#374151;margin:0 0 10px 0;">'
  + N'What you have access to:</p>';

DECLARE @Close NVARCHAR(MAX) =
    N'<p style="font-size:15px;color:#374151;line-height:1.75;font-weight:600;margin:16px 0 0 0;">'
  + N'Every rep. Every game. Every teammate. That''s your legacy. Welcome home.</p>';

-- ── Feature card macro ────────────────────────────────────────────────────────

-- Admin / AD — Tier 1
DECLARE @AlumniDir1 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#127891; Alumni Directory</strong> &#8212; '
  + N'Your full alumni network, organized and searchable.</p></div>';

DECLARE @Comms1 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128227; Communications</strong> &#8212; '
  + N'Send updates directly to your graduates.</p></div>';

DECLARE @FeedAdmin1 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128240; The Feed</strong> &#8212; '
  + N'Post updates your alumni community can see and engage with.</p></div>';

DECLARE @Settings1 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#9881;&#65039; Team Settings</strong> &#8212; '
  + N'Your colors, your brand, your program.</p></div>';

-- Admin / AD — Tier 2
DECLARE @Roster2 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#127941; Roster Management</strong> &#8212; '
  + N'Your current athletes, positions, and program details all in one place.</p></div>';

DECLARE @AlumniDir2 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#127891; Alumni Directory</strong> &#8212; '
  + N'Every graduate, still connected.</p></div>';

DECLARE @Comms2 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128227; Communications</strong> &#8212; '
  + N'Send targeted updates to your roster, your alumni, or everyone at once.</p></div>';

DECLARE @FeedAdmin2 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128240; The Feed</strong> &#8212; '
  + N'Your program''s community hub. Post to your entire network or specific sports.</p></div>';

DECLARE @Settings2 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#9881;&#65039; Team Settings</strong> &#8212; '
  + N'Your colors, your brand, your program.</p></div>';

-- Admin / AD — Tier 3
DECLARE @Roster3 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#127941; Roster Management</strong> &#8212; '
  + N'Your current athletes, fully organized. Every detail, every position, every academic year.</p></div>';

DECLARE @AlumniDir3 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#127891; Alumni Directory</strong> &#8212; '
  + N'Your complete graduate network. Track careers, engagement, and lifelong connections.</p></div>';

DECLARE @Comms3 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128227; Communications</strong> &#8212; '
  + N'Targeted updates delivered to exactly the right people at exactly the right time.</p></div>';

DECLARE @FeedAdmin3 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128240; The Feed</strong> &#8212; '
  + N'Your program''s community hub. Posts, announcements, and updates across your entire network.</p></div>';

DECLARE @Analytics NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128202; Analytics</strong> &#8212; '
  + N'Understand your legacy network like never before. Who''s engaged, who''s giving back, where your program stands.</p></div>';

DECLARE @Settings3 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#9881;&#65039; Team Settings</strong> &#8212; '
  + N'Your platform, your brand, your rules.</p></div>';

-- Alumni features
DECLARE @FeedAlumni1 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128240; The Feed</strong> &#8212; '
  + N'Stay close to the program. See updates posted by your coaches and staff.</p></div>';

DECLARE @Support1 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128077; Show Your Support</strong> &#8212; '
  + N'Like posts and let your program know you''re still in their corner.</p></div>';

DECLARE @FeedAlumni2 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128240; The Feed</strong> &#8212; '
  + N'See what your program and fellow alumni are posting. Your community, all in one place.</p></div>';

DECLARE @Share NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#9997;&#65039; Share Your Story</strong> &#8212; '
  + N'Post updates, milestones, and memories to the {{TEAM_NAME}} community.</p></div>';

DECLARE @Connect NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128100; Connect</strong> &#8212; '
  + N'See and reach fellow alumni across every sport that ever wore this logo.</p></div>';

DECLARE @Support2 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128077; Show Your Support</strong> &#8212; '
  + N'Like posts and let your community know you''re still in their corner.</p></div>';

DECLARE @MentorAlumni NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#129309; Mentorship</strong> &#8212; '
  + N'Connect with current athletes. Share what you know. Give back to the program that gave to you.</p></div>';

-- Player features
DECLARE @FeedPlayer2 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128240; The Feed</strong> &#8212; '
  + N'Stay connected to your program. Hear from your coaches and staff directly.</p></div>';

DECLARE @AlumniNet2 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128100; Your Alumni Network</strong> &#8212; '
  + N'See the people who came before you. The ones who wore your logo and built what you''re now a part of.</p></div>';

DECLARE @SupportPlayer NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128077; Show Your Support</strong> &#8212; '
  + N'Like posts from your program and your alumni community.</p></div>';

DECLARE @FeedPlayer3 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128240; The Feed</strong> &#8212; '
  + N'Stay connected to your program. Hear from your coaches, staff, and alumni directly.</p></div>';

DECLARE @AlumniNet3 NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#128100; Your Alumni Network</strong> &#8212; '
  + N'See the people who came before you and reach out. They wore your logo. They want to hear from you.</p></div>';

DECLARE @MentorPlayer NVARCHAR(MAX) =
    N'<div style="padding:10px 14px;background:#f9fafb;border-radius:8px;'
  + N'border-left:3px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<p style="margin:0;font-size:14px;color:#111827;">'
  + N'<strong>&#129309; Mentorship</strong> &#8212; '
  + N'Connect with alumni in your field. Your program family is ready to invest in your future.</p></div>';

-- ─────────────────────────────────────────────────────────────────────────────
-- POST 1 — Tier 1 (starter) / Admin / AD
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @P1 NVARCHAR(MAX) =
    @Hdr + @Open
  + N'<p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">'
  + N'Your program has a history worth protecting. LegacyLink gives you the tools to manage it, '
  + N'grow it, and pass it forward. Everything your program needs &#8212; in one place, '
  + N'built for programs like yours.</p>'
  + @WhatYouHave
  + @AlumniDir1 + @Comms1 + @FeedAdmin1 + @Settings1;

INSERT INTO dbo.feed_posts
  (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES
  (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @P1, @ImgUrl, N'all_sports', 1, 1, N'starter', N'admin', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- POST 2 — Tier 1 (starter) / Alumni
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @P2 NVARCHAR(MAX) =
    @Hdr + @Open
  + N'<p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">'
  + N'Once a part of this program, always a part of this program. This is where {{TEAM_NAME}} '
  + N'stays connected to you &#8212; and where you stay connected to each other. '
  + N'The jersey comes off. The legacy doesn''t.</p>'
  + @WhatYouHave
  + @FeedAlumni1 + @Support1
  + @Close;

INSERT INTO dbo.feed_posts
  (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES
  (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @P2, @ImgUrl, N'all_sports', 1, 1, N'starter', N'alumni', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- POST 3 — Tier 2 (pro) / Admin / AD
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @P3 NVARCHAR(MAX) =
    @Hdr + @Open
  + N'<p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">'
  + N'Your program has a history worth protecting. LegacyLink gives you the tools to manage it, '
  + N'grow it, and pass it forward. Everything your program needs &#8212; in one place, '
  + N'built for programs like yours.</p>'
  + @WhatYouHave
  + @Roster2 + @AlumniDir2 + @Comms2 + @FeedAdmin2 + @Settings2;

INSERT INTO dbo.feed_posts
  (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES
  (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @P3, @ImgUrl, N'all_sports', 1, 1, N'pro', N'admin', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- POST 4 — Tier 2 (pro) / Alumni
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @P4 NVARCHAR(MAX) =
    @Hdr + @Open
  + N'<p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">'
  + N'Once a part of this program, always a part of this program. This is where {{TEAM_NAME}} '
  + N'stays connected to you &#8212; and where you stay connected to each other. '
  + N'The jersey comes off. The legacy doesn''t.</p>'
  + @WhatYouHave
  + @FeedAlumni2 + @Share + @Connect + @Support2
  + @Close;

INSERT INTO dbo.feed_posts
  (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES
  (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @P4, @ImgUrl, N'all_sports', 1, 1, N'pro', N'alumni', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- POST 5 — Tier 2 (pro) / Player
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @P5 NVARCHAR(MAX) =
    @Hdr + @Open
  + N'<p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">'
  + N'You are part of something bigger than any season. {{TEAM_NAME}} is more than a program '
  + N'&#8212; it''s a family built on shared sacrifice, shared wins, and a bond that lasts '
  + N'long after the final whistle. Welcome to where that bond lives.</p>'
  + @WhatYouHave
  + @FeedPlayer2 + @AlumniNet2 + @SupportPlayer
  + @Close;

INSERT INTO dbo.feed_posts
  (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES
  (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @P5, @ImgUrl, N'all_sports', 1, 1, N'pro', N'player', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- POST 6 — Tier 3 (enterprise) / Admin / AD
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @P6 NVARCHAR(MAX) =
    @Hdr + @Open
  + N'<p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">'
  + N'Your program has a history worth protecting. LegacyLink gives you the tools to manage it, '
  + N'grow it, and pass it forward. Everything your program needs &#8212; in one place, '
  + N'built for programs like yours.</p>'
  + @WhatYouHave
  + @Roster3 + @AlumniDir3 + @Comms3 + @FeedAdmin3 + @Analytics + @Settings3;

INSERT INTO dbo.feed_posts
  (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES
  (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @P6, @ImgUrl, N'all_sports', 1, 1, N'enterprise', N'admin', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- POST 7 — Tier 3 (enterprise) / Alumni
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @P7 NVARCHAR(MAX) =
    @Hdr + @Open
  + N'<p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">'
  + N'Once a part of this program, always a part of this program. This is where {{TEAM_NAME}} '
  + N'stays connected to you &#8212; and where you stay connected to each other. '
  + N'The jersey comes off. The legacy doesn''t.</p>'
  + @WhatYouHave
  + @FeedAlumni2 + @Share + @Connect + @MentorAlumni + @Support2
  + @Close;

INSERT INTO dbo.feed_posts
  (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES
  (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @P7, @ImgUrl, N'all_sports', 1, 1, N'enterprise', N'alumni', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- POST 8 — Tier 3 (enterprise) / Player
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @P8 NVARCHAR(MAX) =
    @Hdr + @Open
  + N'<p style="font-size:15px;color:#374151;line-height:1.75;margin:0 0 16px 0;">'
  + N'You are part of something bigger than any season. {{TEAM_NAME}} is more than a program '
  + N'&#8212; it''s a family built on shared sacrifice, shared wins, and a bond that lasts '
  + N'long after the final whistle. Welcome to where that bond lives.</p>'
  + @WhatYouHave
  + @FeedPlayer3 + @AlumniNet3 + @MentorPlayer + @SupportPlayer
  + @Close;

INSERT INTO dbo.feed_posts
  (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES
  (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @P8, @ImgUrl, N'all_sports', 1, 1, N'enterprise', N'player', @Now, @Now);

PRINT '012: 8 v2 welcome posts seeded (starter: admin+alumni; pro: admin+alumni+player; enterprise: admin+alumni+player).';
GO
