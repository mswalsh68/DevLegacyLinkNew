-- ============================================================
-- APP DB — CROSS-DATABASE SYNONYMS
-- ============================================================
-- WHY SYNONYMS?
--   Azure SQL does not support linked servers, so 4-part names
--   like [GLOBAL_DB].LegacyLinkGlobal.dbo.sp_GetOrCreateUser
--   cause SQL71562 errors during DACPAC deployment and fail at
--   runtime on Azure.
--
--   Synonyms replace the 4-part names with a single-name alias.
--   The AppDB stored procedures call the synonym; SQL Server
--   resolves it to the target object at runtime using the
--   3-part (database.schema.object) path stored here.
--
-- HOW IT WORKS (both local SQL Express and Azure SQL):
--   Local dev:  both DBs live on the same SQL Server instance.
--               The synonym resolves fine as a cross-DB call.
--   Azure SQL:  both DBs live on the same logical server.
--               Azure SQL supports cross-database synonyms
--               within the same logical server.
--               The calling user must have EXECUTE permission
--               on the target stored procedure in LegacyLinkGlobal.
--
-- WHEN TO RE-RUN:
--   Run this script once per AppDB before running
--   sp_App_AllProcedures.sql. Re-run any time you provision
--   a new AppDB or the GlobalDB name changes (dev → prod).
--
-- ─── CONFIGURE BEFORE RUNNING ───────────────────────────────
-- Set @GlobalDb to match your environment:
--   Production : 'LegacyLinkGlobal'
--   Development: 'DevLegacyLinkGlobal'
-- ────────────────────────────────────────────────────────────
-- NOTE: Dynamic SQL is required because CREATE SYNONYM does not
--       accept a variable for the target name — it must be a
--       string literal. We build the statement and EXEC it.
-- ============================================================

DECLARE @GlobalDb NVARCHAR(150) = 'LegacyLinkGlobal';  -- ← change for dev

-- ─────────────────────────────────────────────────────────────────────────────
-- Synonym 1: syn_GetOrCreateUser
--   Target : [GlobalDb].dbo.sp_GetOrCreateUser
--   Used by: sp_CreatePlayer, sp_BulkCreatePlayers, sp_BulkCreateAlumni
--
--   Purpose: Idempotent user lookup/creation in the Global DB.
--            Returns an existing user ID if the email is already
--            registered, or creates the account and returns the new ID.
--
--   Signature of the target SP:
--     @Email     NVARCHAR(255),
--     @FirstName NVARCHAR(100),
--     @LastName  NVARCHAR(100),
--     @TeamId    UNIQUEIDENTIFIER,
--     @UserId    UNIQUEIDENTIFIER OUTPUT,
--     @ErrorCode NVARCHAR(50)     OUTPUT
-- ─────────────────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.syn_GetOrCreateUser', 'SN') IS NOT NULL
BEGIN
    DROP SYNONYM dbo.syn_GetOrCreateUser;
    PRINT 'Dropped existing synonym: dbo.syn_GetOrCreateUser';
END

DECLARE @sql1 NVARCHAR(500) =
    N'CREATE SYNONYM dbo.syn_GetOrCreateUser '
  + N'FOR [' + @GlobalDb + N'].[dbo].[sp_GetOrCreateUser];';

EXEC sp_executesql @sql1;
PRINT 'Created synonym: dbo.syn_GetOrCreateUser → [' + @GlobalDb + '].[dbo].[sp_GetOrCreateUser]';
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- Synonym 2: syn_TransferPlayerToAlumni
--   Target : [GlobalDb].dbo.sp_TransferPlayerToAlumni
--   Used by: sp_GraduatePlayer
--
--   Purpose: Revokes the user's 'roster' app-permission in the Global DB
--            and grants 'alumni' app-permission in its place. Called inside
--            sp_GraduatePlayer's per-player transaction so that a Global DB
--            failure rolls back the AppDB status flip atomically.
--
--   Signature of the target SP:
--     @UserId    UNIQUEIDENTIFIER,
--     @GrantedBy NVARCHAR(100)
-- ─────────────────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.syn_TransferPlayerToAlumni', 'SN') IS NOT NULL
BEGIN
    DROP SYNONYM dbo.syn_TransferPlayerToAlumni;
    PRINT 'Dropped existing synonym: dbo.syn_TransferPlayerToAlumni';
END

DECLARE @GlobalDb2 NVARCHAR(150) = 'LegacyLinkGlobal';  -- ← keep in sync with @GlobalDb above
DECLARE @sql2 NVARCHAR(500) =
    N'CREATE SYNONYM dbo.syn_TransferPlayerToAlumni '
  + N'FOR [' + @GlobalDb2 + N'].[dbo].[sp_TransferPlayerToAlumni];';

EXEC sp_executesql @sql2;
PRINT 'Created synonym: dbo.syn_TransferPlayerToAlumni → [' + @GlobalDb2 + '].[dbo].[sp_TransferPlayerToAlumni]';
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification — confirm both synonyms were created successfully
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    name              AS synonym_name,
    base_object_name  AS resolves_to,
    create_date       AS created_at
FROM sys.synonyms
WHERE name IN ('syn_GetOrCreateUser', 'syn_TransferPlayerToAlumni')
ORDER BY name;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- Azure SQL: Grant EXECUTE on both synonyms to the app service account.
-- Replace 'app_service_user' with your actual login/user name.
-- ─────────────────────────────────────────────────────────────────────────────
-- GRANT EXECUTE ON dbo.syn_GetOrCreateUser       TO [app_service_user];
-- GRANT EXECUTE ON dbo.syn_TransferPlayerToAlumni TO [app_service_user];
-- GO
