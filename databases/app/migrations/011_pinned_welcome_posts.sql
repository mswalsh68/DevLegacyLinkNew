-- ============================================================
-- 011_pinned_welcome_posts.sql
-- Replaces the single generic welcome post with 9 tier- and
-- role-targeted pinned welcome posts.
--
-- Run on: each tenant AppDB
-- Run after: 010_outreach_resend_tracking.sql
--
-- tier_group : 'starter' | 'pro' | 'enterprise'
-- role_group : 'admin' | 'staff' | 'player'
--
-- Tokens resolved at render time (lib/feedTokens.ts):
--   {{TEAM_NAME}}     → teamConfig.teamName
--   {{TEAM_LOGO_URL}} → teamConfig.logoUrl
--   {{PRIMARY_COLOR}} → teamConfig.primaryColor
--   {{ACCENT_COLOR}}  → teamConfig.accentColor
-- ============================================================

-- Step 1: Add new columns (idempotent guards)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.feed_posts') AND name = 'tier_group')
    ALTER TABLE dbo.feed_posts ADD tier_group NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.feed_posts') AND name = 'role_group')
    ALTER TABLE dbo.feed_posts ADD role_group NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.feed_posts') AND name = 'image_url')
    ALTER TABLE dbo.feed_posts ADD image_url NVARCHAR(500) NULL;
GO

-- Step 2: Remove all existing welcome posts (replaced by the 9 below)
DELETE FROM dbo.feed_posts WHERE is_welcome_post = 1;
GO

-- Step 3: Seed 9 welcome posts
DECLARE @SysUser INT = ISNULL((SELECT MIN(user_id) FROM dbo.users), 0);
DECLARE @Now     DATETIME2 = GETUTCDATE();

-- ── Helper HTML fragments ─────────────────────────────────────────────────────

DECLARE @Header NVARCHAR(MAX) =
    N'<p style="font-size:12px;color:#9ca3af;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;margin:0 0 20px 0;">Powered by LegacyLink HQ</p>';

DECLARE @Feature_AlumniDir NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#127891; Alumni Directory</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Your full alumni network, organized and searchable.</p>'
  + N'</div>';

DECLARE @Feature_Comms NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#128227; Communications</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Send updates directly to your graduates. Keep them connected to the program they love.</p>'
  + N'</div>';

DECLARE @Feature_CommsStaff NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#128227; Communications</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Send targeted updates to your roster, your alumni, or everyone at once.</p>'
  + N'</div>';

DECLARE @Feature_Settings NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#9881;&#65039; Team Settings</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Make the platform yours. Your colors, your brand, your program.</p>'
  + N'</div>';

DECLARE @Feature_Roster NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#127941; Roster Management</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Your current athletes, positions, and program details all in one place.</p>'
  + N'</div>';

DECLARE @Feature_AlumniCRM NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#127891; Alumni CRM</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Every graduate, still connected. Track where they are and keep the relationship strong.</p>'
  + N'</div>';

DECLARE @Feature_Feed NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#128240; The Feed</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Your program''s home base. Posts, updates, and announcements for your entire community.</p>'
  + N'</div>';

DECLARE @Feature_FeedStaff NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#128240; The Feed</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Post updates, share news, and keep your entire program community connected.</p>'
  + N'</div>';

DECLARE @Feature_SettingsAdv NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#9881;&#65039; Team Settings</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Your colors, your brand, your program &#8212; customized exactly how you want it.</p>'
  + N'</div>';

DECLARE @Feature_Analytics NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#128202; Analytics</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Understand your legacy network like never before. Who''s engaged, who''s giving back, and where your program stands.</p>'
  + N'</div>';

DECLARE @Feature_CommsPlayer NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#128227; Communications</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Messages from your program delivered straight to you. Never miss an update that matters.</p>'
  + N'</div>';

DECLARE @Feature_FeedPlayer NVARCHAR(MAX) =
    N'<div style="padding:12px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};margin-bottom:8px;">'
  + N'<strong style="color:#111827;font-size:14px;">&#128240; The Feed</strong>'
  + N'<p style="font-size:13px;color:#6b7280;margin:4px 0 0 0;line-height:1.5;">Program updates, announcements, and news posted directly by your staff.</p>'
  + N'</div>';

DECLARE @AccessLabel NVARCHAR(200) =
    N'<p style="font-size:15px;color:#374151;line-height:1.7;font-weight:600;margin:0 0 12px 0;">What you have access to:</p>';

DECLARE @Closing_Legacy NVARCHAR(200) =
    N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:16px 0 0 0;">This is where your legacy lives. Welcome.</p>';

DECLARE @Closing_RosterLegacy NVARCHAR(200) =
    N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:16px 0 0 0;">Your roster becomes your legacy. It starts here.</p>';

DECLARE @Closing_BiggerLegacy NVARCHAR(200) =
    N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:16px 0 0 0;">Every athlete who ever wore your colors is part of something bigger. This is where that story lives.</p>';

DECLARE @ImageUrl NVARCHAR(500) = N'{{TEAM_LOGO_URL}}';

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 1 (starter) — Admin / Owner / AD
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @T1A NVARCHAR(MAX) =
    @Header
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;">Welcome to {{TEAM_NAME}}.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">Your alumni network is now in one place. Every graduate who wore your colors, represented your program, and carried your legacy forward &#8212; they''re here. Stay connected, send updates, and keep those relationships alive long after the final game.</p>'
  + @AccessLabel
  + @Feature_AlumniDir
  + @Feature_Comms
  + @Feature_Settings
  + @Closing_Legacy;

INSERT INTO dbo.feed_posts (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @T1A, @ImageUrl, N'all', 1, 1, N'starter', N'admin', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 1 (starter) — Coach / Staff
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @T1S NVARCHAR(MAX) =
    @Header
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;">Welcome to {{TEAM_NAME}}.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">Your alumni network is now in one place. Every graduate who wore your colors, represented your program, and carried your legacy forward &#8212; they''re here. Stay connected, send updates, and keep those relationships alive long after the final game.</p>'
  + @AccessLabel
  + @Feature_AlumniDir
  + @Feature_Comms
  + @Closing_Legacy;

INSERT INTO dbo.feed_posts (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @T1S, @ImageUrl, N'all', 1, 1, N'starter', N'staff', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 1 (starter) — Player / Alumni
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @T1P NVARCHAR(MAX) =
    @Header
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;font-style:italic;">Once a part of this program, always a part of this program.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;">This is where {{TEAM_NAME}} stays connected to you. Updates from the program, news from your coaches, and a direct line to the community you helped build.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;">You earned your place in this legacy. Stay close to it.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0;font-weight:600;">Welcome home.</p>';

INSERT INTO dbo.feed_posts (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @T1P, @ImageUrl, N'all', 1, 1, N'starter', N'player', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 2 (pro) — Admin / Owner / AD
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @T2A NVARCHAR(MAX) =
    @Header
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;">Welcome to {{TEAM_NAME}}.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">From the first day on the roster to long after graduation &#8212; your program''s relationships live here. Manage your current athletes, stay connected to your alumni, and move players from one to the other in a single click. The pipeline that used to take hours of spreadsheet work now takes seconds.</p>'
  + @AccessLabel
  + @Feature_Roster
  + @Feature_AlumniCRM
  + @Feature_CommsStaff
  + @Feature_Feed
  + @Feature_SettingsAdv
  + @Closing_RosterLegacy;

INSERT INTO dbo.feed_posts (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @T2A, @ImageUrl, N'all', 1, 1, N'pro', N'admin', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 2 (pro) — Coach / Staff
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @T2S NVARCHAR(MAX) =
    @Header
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;">Welcome to {{TEAM_NAME}}.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">Everything you need to manage your program and stay connected to your athletes &#8212; current and former &#8212; is right here.</p>'
  + @AccessLabel
  + @Feature_Roster
  + @Feature_AlumniCRM
  + @Feature_CommsStaff
  + @Feature_FeedStaff
  + @Closing_RosterLegacy;

INSERT INTO dbo.feed_posts (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @T2S, @ImageUrl, N'all', 1, 1, N'pro', N'staff', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 2 (pro) — Player / Alumni
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @T2P NVARCHAR(MAX) =
    @Header
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;">Your journey with {{TEAM_NAME}} doesn''t end when the season does.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">This is your home base. Stay up to date with everything happening in the program, hear directly from your coaches and staff, and stay connected to every teammate &#8212; past and present &#8212; who shared this experience with you.</p>'
  + @Feature_FeedPlayer
  + @Feature_CommsPlayer
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:16px 0 0 0;font-style:italic;">The jersey comes off. The legacy doesn''t.</p>';

INSERT INTO dbo.feed_posts (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @T2P, @ImageUrl, N'all', 1, 1, N'pro', N'player', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 3 (enterprise) — Admin / Owner / AD
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @T3A NVARCHAR(MAX) =
    @Header
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;">Welcome to {{TEAM_NAME}}.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">Your program has a history. Now you have the tools to understand it, grow it, and use it. Manage your current athletes, stay connected to every graduate, communicate with your entire community, and measure the engagement of your legacy network &#8212; all in one platform built specifically for programs like yours.</p>'
  + @AccessLabel
  + @Feature_Roster
  + @Feature_AlumniCRM
  + @Feature_CommsStaff
  + @Feature_Feed
  + @Feature_Analytics
  + @Feature_SettingsAdv
  + @Closing_BiggerLegacy;

INSERT INTO dbo.feed_posts (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @T3A, @ImageUrl, N'all', 1, 1, N'enterprise', N'admin', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 3 (enterprise) — Coach / Staff
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @T3S NVARCHAR(MAX) =
    @Header
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;">Welcome to {{TEAM_NAME}}.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">Everything you need to run your program and build lasting relationships with your athletes &#8212; from recruitment to retirement &#8212; is right here.</p>'
  + @AccessLabel
  + @Feature_Roster
  + @Feature_AlumniCRM
  + @Feature_CommsStaff
  + @Feature_FeedStaff
  + @Closing_BiggerLegacy;

INSERT INTO dbo.feed_posts (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @T3S, @ImageUrl, N'all', 1, 1, N'enterprise', N'staff', @Now, @Now);

-- ─────────────────────────────────────────────────────────────────────────────
-- TIER 3 (enterprise) — Player / Alumni
-- ─────────────────────────────────────────────────────────────────────────────
DECLARE @T3P NVARCHAR(MAX) =
    @Header
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 12px 0;font-style:italic;">You are part of something that outlasts any season, any record, any roster.</p>'
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">{{TEAM_NAME}} has built something here &#8212; a community of athletes, coaches, and alumni who share a bond that doesn''t fade. This is where that community lives.</p>'
  + @Feature_FeedPlayer
  + @Feature_CommsPlayer
  + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:16px 0 0 0;font-style:italic;">Every rep. Every game. Every teammate. That''s your legacy. Welcome back to it.</p>';

INSERT INTO dbo.feed_posts (id, created_by, title, body_html, image_url, audience, is_pinned, is_welcome_post, tier_group, role_group, published_at, created_at)
VALUES (NEWID(), @SysUser, N'Welcome to {{TEAM_NAME}}', @T3P, @ImageUrl, N'all', 1, 1, N'enterprise', N'player', @Now, @Now);

PRINT '011: 9 tier/role-targeted welcome posts seeded.';
GO
