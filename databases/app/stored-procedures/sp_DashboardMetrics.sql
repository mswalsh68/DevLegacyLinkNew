-- ============================================================
-- APP DB — DASHBOARD METRICS STORED PROCEDURES
-- Run on: each tenant AppDB after sp_App_AllProcedures.sql
-- Requires: migration 014 schema
-- ============================================================
-- Procedures:
--   sp_GetDashboardMetrics_Alumni  — alumni engagement KPIs
--   sp_GetDashboardMetrics_Players — player comms KPIs
--   sp_GetDashboardMetrics_All     — combined engagement KPIs
--
-- @SportId INT = NULL filters to a specific sport; NULL = all.
--
-- Role IDs: program_role_id = 8 (player), 7 (alumni)
-- ============================================================

USE [$(AppDb)]
GO

-- ============================================================
-- sp_GetDashboardMetrics_Alumni
-- Returns alumni-side engagement KPIs.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetDashboardMetrics_Alumni
  @SportId INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  -- ── Interaction counts ─────────────────────────────────────────────────────
  DECLARE @TotalInteractions INT = 0;
  DECLARE @MonthInteractions INT = 0;

  SELECT
    @TotalInteractions = COUNT(*),
    @MonthInteractions = SUM(CASE WHEN il.logged_at >= DATEADD(DAY, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END)
  FROM dbo.interaction_log il
  JOIN dbo.users u ON u.user_id = il.user_id
  WHERE u.program_role_id = 7   -- alumni
    AND u.is_active = 1
    AND (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.users_sports us
      WHERE us.user_id = u.user_id AND us.sport_id = @SportId AND us.is_active = 1
    ));

  -- ── Email counts + open rate for alumni recipients ───────────────────────
  DECLARE @TotalEmailsSent  INT          = 0;
  DECLARE @MonthEmailsSent  INT          = 0;
  DECLARE @TotalOpened      INT          = 0;
  DECLARE @EmailOpenRatePct DECIMAL(5,1) = 0;

  SELECT
    @TotalEmailsSent = SUM(CASE WHEN om.status IN ('sent','responded') THEN 1 ELSE 0 END),
    @MonthEmailsSent = SUM(CASE WHEN om.status IN ('sent','responded')
                                 AND om.sent_at >= DATEADD(DAY, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END),
    @TotalOpened     = SUM(CASE WHEN om.opened_at IS NOT NULL THEN 1 ELSE 0 END)
  FROM dbo.outreach_messages om
  JOIN dbo.users u ON u.user_id = om.user_id
  WHERE u.program_role_id = 7   -- alumni
    AND u.is_active = 1
    AND (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.users_sports us
      WHERE us.user_id = u.user_id AND us.sport_id = @SportId AND us.is_active = 1
    ));

  SET @EmailOpenRatePct = CASE
    WHEN @TotalEmailsSent = 0 THEN 0
    ELSE CAST(100.0 * @TotalOpened / @TotalEmailsSent AS DECIMAL(5,1))
  END;

  -- ── Alumni logins last 30 days ─────────────────────────────────────────────
  DECLARE @AlumniLogins INT = 0;

  SELECT @AlumniLogins = COUNT(DISTINCT u.user_id)
  FROM   dbo.users u
  WHERE  u.program_role_id = 7
    AND  u.is_active = 1
    AND  u.last_team_login >= DATEADD(DAY, -30, SYSUTCDATETIME())
    AND  (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.users_sports us
      WHERE us.user_id = u.user_id AND us.sport_id = @SportId AND us.is_active = 1
    ));

  -- ── Feed post counts (alumni-visible: all + alumni_only) ──────────────────
  DECLARE @TotalFeedPosts INT = 0;
  DECLARE @MonthFeedPosts INT = 0;

  SELECT
    @TotalFeedPosts = COUNT(*),
    @MonthFeedPosts = SUM(CASE WHEN fp.created_at >= DATEADD(DAY, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END)
  FROM dbo.feed_posts fp
  WHERE fp.audience IN ('all', 'alumni_only')
    AND (@SportId IS NULL OR fp.sport_id = @SportId);

  SELECT
    ISNULL(@TotalInteractions, 0) AS totalInteractions,
    ISNULL(@MonthInteractions, 0) AS monthInteractions,
    ISNULL(@TotalEmailsSent, 0)   AS totalEmailsSent,
    ISNULL(@MonthEmailsSent, 0)   AS monthEmailsSent,
    ISNULL(@AlumniLogins, 0)      AS alumniLoginsLast30Days,
    ISNULL(@TotalFeedPosts, 0)    AS totalFeedPosts,
    ISNULL(@MonthFeedPosts, 0)    AS monthFeedPosts,
    ISNULL(@EmailOpenRatePct, 0)  AS emailOpenRatePct;
END;
GO

-- ============================================================
-- sp_GetDashboardMetrics_Players
-- Returns player-comms KPIs.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetDashboardMetrics_Players
  @SportId INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  -- ── Email counts for player recipients ────────────────────────────────────
  DECLARE @TotalEmailsSent INT = 0;
  DECLARE @MonthEmailsSent INT = 0;

  SELECT
    @TotalEmailsSent = SUM(CASE WHEN om.status IN ('sent','responded') THEN 1 ELSE 0 END),
    @MonthEmailsSent = SUM(CASE WHEN om.status IN ('sent','responded')
                                 AND om.sent_at >= DATEADD(DAY, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END)
  FROM dbo.outreach_messages om
  JOIN dbo.users u ON u.user_id = om.user_id
  WHERE u.program_role_id = 8   -- player
    AND u.is_active = 1
    AND (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.users_sports us
      WHERE us.user_id = u.user_id AND us.sport_id = @SportId AND us.is_active = 1
    ));

  -- ── Feed post counts (player-visible) ────────────────────────────────────
  DECLARE @TotalFeedPosts INT = 0;
  DECLARE @MonthFeedPosts INT = 0;

  SELECT
    @TotalFeedPosts = COUNT(*),
    @MonthFeedPosts = SUM(CASE WHEN fp.created_at >= DATEADD(DAY, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END)
  FROM dbo.feed_posts fp
  WHERE fp.audience IN ('all', 'players_only', 'by_position')
    AND (@SportId IS NULL OR fp.sport_id = @SportId);

  SELECT
    ISNULL(@TotalEmailsSent, 0) AS totalEmailsSent,
    ISNULL(@MonthEmailsSent, 0) AS monthEmailsSent,
    ISNULL(@TotalFeedPosts, 0)  AS totalFeedPosts,
    ISNULL(@MonthFeedPosts, 0)  AS monthFeedPosts;
END;
GO

-- ============================================================
-- sp_GetDashboardMetrics_All
-- Combined alumni + player engagement KPIs.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetDashboardMetrics_All
  @SportId INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  -- ── Interaction counts (alumni only) ──────────────────────────────────────
  DECLARE @TotalInteractions INT = 0;
  DECLARE @MonthInteractions INT = 0;

  SELECT
    @TotalInteractions = COUNT(*),
    @MonthInteractions = SUM(CASE WHEN il.logged_at >= DATEADD(DAY, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END)
  FROM dbo.interaction_log il
  JOIN dbo.users u ON u.user_id = il.user_id
  WHERE u.program_role_id = 7
    AND u.is_active = 1
    AND (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.users_sports us
      WHERE us.user_id = u.user_id AND us.sport_id = @SportId AND us.is_active = 1
    ));

  -- ── Alumni email counts ───────────────────────────────────────────────────
  DECLARE @AlumniEmailsTotal INT = 0;
  DECLARE @AlumniEmailsMonth INT = 0;

  SELECT
    @AlumniEmailsTotal = SUM(CASE WHEN om.status IN ('sent','responded') THEN 1 ELSE 0 END),
    @AlumniEmailsMonth = SUM(CASE WHEN om.status IN ('sent','responded')
                                   AND om.sent_at >= DATEADD(DAY, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END)
  FROM dbo.outreach_messages om
  JOIN dbo.users u ON u.user_id = om.user_id
  WHERE u.program_role_id = 7
    AND u.is_active = 1
    AND (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.users_sports us
      WHERE us.user_id = u.user_id AND us.sport_id = @SportId AND us.is_active = 1
    ));

  -- ── Alumni logins last 30 days ─────────────────────────────────────────────
  DECLARE @AlumniLogins INT = 0;

  SELECT @AlumniLogins = COUNT(DISTINCT u.user_id)
  FROM   dbo.users u
  WHERE  u.program_role_id = 7
    AND  u.is_active = 1
    AND  u.last_team_login >= DATEADD(DAY, -30, SYSUTCDATETIME())
    AND  (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.users_sports us
      WHERE us.user_id = u.user_id AND us.sport_id = @SportId AND us.is_active = 1
    ));

  -- ── Player email counts ───────────────────────────────────────────────────
  DECLARE @PlayerEmailsTotal INT = 0;
  DECLARE @PlayerEmailsMonth INT = 0;

  SELECT
    @PlayerEmailsTotal = SUM(CASE WHEN om.status IN ('sent','responded') THEN 1 ELSE 0 END),
    @PlayerEmailsMonth = SUM(CASE WHEN om.status IN ('sent','responded')
                                   AND om.sent_at >= DATEADD(DAY, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END)
  FROM dbo.outreach_messages om
  JOIN dbo.users u ON u.user_id = om.user_id
  WHERE u.program_role_id = 8
    AND u.is_active = 1
    AND (@SportId IS NULL OR EXISTS (
      SELECT 1 FROM dbo.users_sports us
      WHERE us.user_id = u.user_id AND us.sport_id = @SportId AND us.is_active = 1
    ));

  -- ── Feed post counts ──────────────────────────────────────────────────────
  DECLARE @TotalFeedPosts INT = 0;
  DECLARE @MonthFeedPosts INT = 0;

  SELECT
    @TotalFeedPosts = COUNT(*),
    @MonthFeedPosts = SUM(CASE WHEN fp.created_at >= DATEADD(DAY, -30, SYSUTCDATETIME()) THEN 1 ELSE 0 END)
  FROM dbo.feed_posts fp
  WHERE (@SportId IS NULL OR fp.sport_id = @SportId);

  SELECT
    ISNULL(@TotalInteractions, 0) AS totalInteractions,
    ISNULL(@MonthInteractions, 0) AS monthInteractions,
    ISNULL(@AlumniEmailsTotal, 0) AS alumniEmailsTotal,
    ISNULL(@AlumniEmailsMonth, 0) AS alumniEmailsMonth,
    ISNULL(@AlumniLogins, 0)      AS alumniLoginsLast30Days,
    ISNULL(@PlayerEmailsTotal, 0) AS playerEmailsTotal,
    ISNULL(@PlayerEmailsMonth, 0) AS playerEmailsMonth,
    ISNULL(@TotalFeedPosts, 0)    AS totalFeedPosts,
    ISNULL(@MonthFeedPosts, 0)    AS monthFeedPosts;
END;
GO

PRINT '=== sp_DashboardMetrics SPs created ===';
GO
