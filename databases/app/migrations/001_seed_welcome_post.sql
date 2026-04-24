-- ============================================================
-- 001_seed_welcome_post.sql
-- Seeds the pinned welcome post for any tenant whose app DB
-- was provisioned without the welcome post row.
--
-- Safe to re-run: the IF NOT EXISTS guard prevents duplicates.
-- To force a refresh (e.g. content update) delete the row first:
--   DELETE FROM dbo.feed_posts WHERE is_welcome_post = 1;
--
-- Body uses white-label tokens resolved at render time by the
-- web app (lib/feedTokens.ts):
--   {{TEAM_NAME}}     → teamConfig.teamName
--   {{PRIMARY_COLOR}} → teamConfig.primaryColor  (hex)
--   {{ACCENT_COLOR}}  → teamConfig.accentColor   (hex)
--   {{SPORT_EMOJI}}   → derived from teamConfig.sport
--
-- HTML entities used to avoid sqlcmd encoding issues:
--   &#127891; = 🎓  graduation cap
--   &#128236; = 📬  mailbox with mail
--   &#9881;   = ⚙️  gear
--   &#8212;   = —   em dash
--
-- created_by = 00000000-0000-0000-0000-000000000001 (system sentinel)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM dbo.feed_posts WHERE is_welcome_post = 1)
BEGIN
  DECLARE @WelcomeHtml NVARCHAR(MAX) =
      N'<div style="background:{{PRIMARY_COLOR}};border-radius:12px;padding:32px 28px;text-align:center;margin-bottom:20px;">'
    + N'<div style="font-size:52px;margin-bottom:12px;">{{SPORT_EMOJI}}</div>'
    + N'<h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0 0 8px 0;letter-spacing:-0.3px;">Welcome to {{TEAM_NAME}}</h1>'
    + N'<p style="color:rgba(255,255,255,0.75);font-size:15px;margin:0;line-height:1.5;">Your team management platform is live and ready to go.</p>'
    + N'</div>'
    + N'<p style="font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px 0;">Everything your staff needs to run your program, in one place:</p>'
    + N'<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px;">'

    -- Roster
    + N'<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};">'
    + N'<span style="font-size:20px;flex-shrink:0;margin-top:1px;">{{SPORT_EMOJI}}</span>'
    + N'<div><strong style="color:#111827;display:block;margin-bottom:3px;font-size:14px;">Roster</strong>'
    + N'<span style="font-size:13px;color:#6b7280;line-height:1.5;">Add and manage active players &#8212; positions, jersey numbers, academic years, and contact info.</span>'
    + N'</div></div>'

    -- Alumni CRM
    + N'<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};">'
    + N'<span style="font-size:20px;flex-shrink:0;margin-top:1px;">&#127891;</span>'
    + N'<div><strong style="color:#111827;display:block;margin-bottom:3px;font-size:14px;">Alumni CRM</strong>'
    + N'<span style="font-size:13px;color:#6b7280;line-height:1.5;">Stay connected with graduates. Log interactions, track employment, and keep lifelong relationships strong.</span>'
    + N'</div></div>'

    -- Communications
    + N'<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};">'
    + N'<span style="font-size:20px;flex-shrink:0;margin-top:1px;">&#128236;</span>'
    + N'<div><strong style="color:#111827;display:block;margin-bottom:3px;font-size:14px;">Communications</strong>'
    + N'<span style="font-size:13px;color:#6b7280;line-height:1.5;">Send targeted emails to players or alumni, post to this feed, and track open rates &#8212; all in one hub.</span>'
    + N'</div></div>'

    -- Team Settings
    + N'<div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;background:#f9fafb;border-radius:10px;border-left:4px solid {{ACCENT_COLOR}};">'
    + N'<span style="font-size:20px;flex-shrink:0;margin-top:1px;">&#9881;</span>'
    + N'<div><strong style="color:#111827;display:block;margin-bottom:3px;font-size:14px;">Team Settings</strong>'
    + N'<span style="font-size:13px;color:#6b7280;line-height:1.5;">Customize team colors, positions, and labels &#8212; changes apply instantly across the entire platform.</span>'
    + N'</div></div>'

    + N'</div>'
    + N'<p style="font-size:12px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:14px;margin:0;">This post was pinned automatically when your account was set up.</p>';

  INSERT INTO dbo.feed_posts (
    id,
    created_by,
    title,
    body_html,
    audience,
    is_pinned,
    is_welcome_post
  )
  VALUES (
    NEWID(),
    CAST('00000000-0000-0000-0000-000000000001' AS UNIQUEIDENTIFIER),
    N'Welcome to {{TEAM_NAME}}',
    @WelcomeHtml,
    N'all',
    1,   -- pinned
    1    -- is_welcome_post
  );

  PRINT '001: Welcome post seeded.';
END
ELSE
BEGIN
  PRINT '001: Welcome post already exists — skipped.';
END
GO
