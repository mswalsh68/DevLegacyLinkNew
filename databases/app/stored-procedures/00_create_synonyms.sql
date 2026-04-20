-- ============================================================
-- APP DB — CROSS-DATABASE SYNONYMS
-- ============================================================
-- PURPOSE
--   Azure SQL does not support linked servers or 4-part names
--   like [GLOBAL_DB].LegacyLinkGlobal.dbo.sp_GetOrCreateUser.
--   Synonyms replace those references with a local alias that
--   SQL Server resolves at runtime via a 3-part database name.
--
-- PREREQUISITE
--   Both databases (App DB and Global DB) must reside on the
--   SAME Azure SQL logical server (same .database.windows.net
--   hostname). Cross-server synonyms are not supported on
--   Azure SQL.
--
-- HOW TO RUN  ← use sqlcmd, NOT the Azure Portal query editor
--
--   Windows / local dev (DevLegacyLinkGlobal):
--     sqlcmd -S localhost\SQLEXPRESS -d <AppDb> -E ^
--       -v GlobalDb="DevLegacyLinkGlobal" ^
--       -i databases\app\stored-procedures\00_create_synonyms.sql -b
--
--   Azure SQL / production (LegacyLinkGlobal):
--     sqlcmd -S <server>.database.windows.net -d <AppDb> ^
--       -U <login> -P <password> ^
--       -v GlobalDb="LegacyLinkGlobal" ^
--       -i databases\app\stored-procedures\00_create_synonyms.sql -b
--
--   Or use the helper scripts (they handle all flags for you):
--     .\scripts\deploy-app-db.ps1  -GlobalDb DevLegacyLinkGlobal  (Windows)
--     ./scripts/deploy-app-db.sh   --global-db DevLegacyLinkGlobal (Linux / CI)
--
-- WHY SQLCMD VARIABLES instead of T-SQL DECLARE + dynamic SQL
--   sqlcmd substitutes $(GlobalDb) at the TEXT level before SQL
--   Server parses the statement, so CREATE SYNONYM sees a plain
--   string literal — no dynamic SQL, no sp_executesql, no
--   permission issues. The previous dynamic-SQL approach failed
--   in sqlpackage / Azure DevOps pipelines that parse SQL before
--   executing it.
--
-- IDEMPOTENT
--   Safe to re-run: drops synonyms before recreating them.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Synonym 1 : syn_GetOrCreateUser
--   Target  : [$(GlobalDb)].dbo.sp_GetOrCreateUser
--   Used by : sp_CreatePlayer, sp_BulkCreatePlayers,
--             sp_BulkCreateAlumni
--
--   Signature:
--     @Email     NVARCHAR(255),
--     @FirstName NVARCHAR(100),
--     @LastName  NVARCHAR(100),
--     @TeamId    UNIQUEIDENTIFIER,
--     @UserId    UNIQUEIDENTIFIER OUTPUT,
--     @ErrorCode NVARCHAR(50)     OUTPUT
-- ─────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.syn_GetOrCreateUser', 'SN') IS NOT NULL
BEGIN
    DROP SYNONYM dbo.syn_GetOrCreateUser;
    PRINT 'Dropped: dbo.syn_GetOrCreateUser';
END
GO

CREATE SYNONYM dbo.syn_GetOrCreateUser
    FOR [$(GlobalDb)].[dbo].[sp_GetOrCreateUser];
GO

PRINT 'Created: dbo.syn_GetOrCreateUser';
GO

-- ─────────────────────────────────────────────────────────────
-- Synonym 2 : syn_TransferPlayerToAlumni
--   Target  : [$(GlobalDb)].dbo.sp_TransferPlayerToAlumni
--   Used by : sp_GraduatePlayer
--
--   Signature:
--     @UserId    UNIQUEIDENTIFIER,
--     @GrantedBy NVARCHAR(100)
-- ─────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.syn_TransferPlayerToAlumni', 'SN') IS NOT NULL
BEGIN
    DROP SYNONYM dbo.syn_TransferPlayerToAlumni;
    PRINT 'Dropped: dbo.syn_TransferPlayerToAlumni';
END
GO

CREATE SYNONYM dbo.syn_TransferPlayerToAlumni
    FOR [$(GlobalDb)].[dbo].[sp_TransferPlayerToAlumni];
GO

PRINT 'Created: dbo.syn_TransferPlayerToAlumni';
GO

-- ─────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────
SELECT
    name             AS synonym_name,
    base_object_name AS resolves_to,
    create_date      AS created_at
FROM sys.synonyms
WHERE name IN ('syn_GetOrCreateUser', 'syn_TransferPlayerToAlumni')
ORDER BY name;
GO

-- ─────────────────────────────────────────────────────────────
-- Azure SQL permissions
-- After provisioning the service principal / SQL login, run
-- the following two blocks (once per App DB, once on Global DB).
--
-- ON THIS APP DB (replace app_service_user with your login):
-- ─────────────────────────────────────────────────────────────
-- GRANT EXECUTE ON dbo.syn_GetOrCreateUser        TO [app_service_user];
-- GRANT EXECUTE ON dbo.syn_TransferPlayerToAlumni TO [app_service_user];
-- GO

-- ─────────────────────────────────────────────────────────────
-- ON THE GLOBAL DB (connect to $(GlobalDb) and run):
-- ─────────────────────────────────────────────────────────────
-- GRANT EXECUTE ON dbo.sp_GetOrCreateUser        TO [app_service_user];
-- GRANT EXECUTE ON dbo.sp_TransferPlayerToAlumni TO [app_service_user];
-- GO
