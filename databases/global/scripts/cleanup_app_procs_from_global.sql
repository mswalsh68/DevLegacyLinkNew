-- ============================================================
-- cleanup_app_procs_from_global.sql
-- Drops all App DB stored procedures and views that were
-- accidentally created in LegacyLinkGlobal.
-- Run on: LegacyLinkGlobal ONLY
-- ============================================================

USE LegacyLinkGlobal
GO

-- ─── Views ────────────────────────────────────────────────────
IF OBJECT_ID('dbo.vwPlayers', 'V') IS NOT NULL BEGIN DROP VIEW dbo.vwPlayers; PRINT 'Dropped: vwPlayers'; END
IF OBJECT_ID('dbo.vwAlumni',  'V') IS NOT NULL BEGIN DROP VIEW dbo.vwAlumni;  PRINT 'Dropped: vwAlumni';  END
GO

-- ─── Stored Procedures ────────────────────────────────────────
IF OBJECT_ID('dbo.sp_UpsertUser',                  'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_UpsertUser;                  PRINT 'Dropped: sp_UpsertUser'; END
IF OBJECT_ID('dbo.sp_GetPlayers',                  'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetPlayers;                  PRINT 'Dropped: sp_GetPlayers'; END
IF OBJECT_ID('dbo.sp_GetPlayerById',               'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetPlayerById;               PRINT 'Dropped: sp_GetPlayerById'; END
IF OBJECT_ID('dbo.sp_CreatePlayer',                'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_CreatePlayer;                PRINT 'Dropped: sp_CreatePlayer'; END
IF OBJECT_ID('dbo.sp_UpdatePlayer',                'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_UpdatePlayer;                PRINT 'Dropped: sp_UpdatePlayer'; END
IF OBJECT_ID('dbo.sp_GraduatePlayer',              'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GraduatePlayer;              PRINT 'Dropped: sp_GraduatePlayer'; END
IF OBJECT_ID('dbo.sp_RemovePlayer',                'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_RemovePlayer;                PRINT 'Dropped: sp_RemovePlayer'; END
IF OBJECT_ID('dbo.sp_UpsertPlayerStats',           'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_UpsertPlayerStats;           PRINT 'Dropped: sp_UpsertPlayerStats'; END
IF OBJECT_ID('dbo.sp_GetAlumni',                   'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetAlumni;                   PRINT 'Dropped: sp_GetAlumni'; END
IF OBJECT_ID('dbo.sp_GetAlumniById',               'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetAlumniById;               PRINT 'Dropped: sp_GetAlumniById'; END
IF OBJECT_ID('dbo.sp_UpdateAlumni',                'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_UpdateAlumni;                PRINT 'Dropped: sp_UpdateAlumni'; END
IF OBJECT_ID('dbo.sp_LogInteraction',              'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_LogInteraction;              PRINT 'Dropped: sp_LogInteraction'; END
IF OBJECT_ID('dbo.sp_GetAlumniStats',              'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetAlumniStats;              PRINT 'Dropped: sp_GetAlumniStats'; END
IF OBJECT_ID('dbo.sp_ResolveAudienceForCampaign',  'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_ResolveAudienceForCampaign;  PRINT 'Dropped: sp_ResolveAudienceForCampaign'; END
IF OBJECT_ID('dbo.sp_BulkCreatePlayers',           'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_BulkCreatePlayers;           PRINT 'Dropped: sp_BulkCreatePlayers'; END
IF OBJECT_ID('dbo.sp_BulkCreateAlumni',            'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_BulkCreateAlumni;            PRINT 'Dropped: sp_BulkCreateAlumni'; END
IF OBJECT_ID('dbo.sp_CreateAlumni',                'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_CreateAlumni;                PRINT 'Dropped: sp_CreateAlumni'; END
IF OBJECT_ID('dbo.sp_CreateCampaign',              'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_CreateCampaign;              PRINT 'Dropped: sp_CreateCampaign'; END
IF OBJECT_ID('dbo.sp_GetCampaigns',                'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetCampaigns;                PRINT 'Dropped: sp_GetCampaigns'; END
IF OBJECT_ID('dbo.sp_CancelCampaign',              'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_CancelCampaign;              PRINT 'Dropped: sp_CancelCampaign'; END
IF OBJECT_ID('dbo.sp_GetCampaignDetail',           'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetCampaignDetail;           PRINT 'Dropped: sp_GetCampaignDetail'; END
IF OBJECT_ID('dbo.sp_DispatchEmailCampaign',       'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_DispatchEmailCampaign;       PRINT 'Dropped: sp_DispatchEmailCampaign'; END
IF OBJECT_ID('dbo.sp_MarkEmailSent',               'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_MarkEmailSent;               PRINT 'Dropped: sp_MarkEmailSent'; END
IF OBJECT_ID('dbo.sp_MarkEmailOpened',             'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_MarkEmailOpened;             PRINT 'Dropped: sp_MarkEmailOpened'; END
IF OBJECT_ID('dbo.sp_ProcessUnsubscribe',          'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_ProcessUnsubscribe;          PRINT 'Dropped: sp_ProcessUnsubscribe'; END
IF OBJECT_ID('dbo.sp_CreatePost',                  'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_CreatePost;                  PRINT 'Dropped: sp_CreatePost'; END
IF OBJECT_ID('dbo.sp_GetFeed',                     'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetFeed;                     PRINT 'Dropped: sp_GetFeed'; END
IF OBJECT_ID('dbo.sp_GetFeedPost',                 'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetFeedPost;                 PRINT 'Dropped: sp_GetFeedPost'; END
IF OBJECT_ID('dbo.sp_MarkPostRead',                'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_MarkPostRead;                PRINT 'Dropped: sp_MarkPostRead'; END
IF OBJECT_ID('dbo.sp_GetPostReadStats',            'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetPostReadStats;            PRINT 'Dropped: sp_GetPostReadStats'; END
IF OBJECT_ID('dbo.sp_GetSports',                   'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetSports;                   PRINT 'Dropped: sp_GetSports'; END
IF OBJECT_ID('dbo.sp_GetUserSports',               'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetUserSports;               PRINT 'Dropped: sp_GetUserSports'; END
IF OBJECT_ID('dbo.sp_GetDashboardMetrics_Alumni',  'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetDashboardMetrics_Alumni;  PRINT 'Dropped: sp_GetDashboardMetrics_Alumni'; END
IF OBJECT_ID('dbo.sp_GetDashboardMetrics_Players', 'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetDashboardMetrics_Players; PRINT 'Dropped: sp_GetDashboardMetrics_Players'; END
IF OBJECT_ID('dbo.sp_GetDashboardMetrics_All',     'P') IS NOT NULL BEGIN DROP PROCEDURE dbo.sp_GetDashboardMetrics_All;     PRINT 'Dropped: sp_GetDashboardMetrics_All'; END
GO

PRINT '=== cleanup_app_procs_from_global.sql complete ===';
GO
