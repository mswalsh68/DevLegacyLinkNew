-- ============================================================
-- Migration 025: Drop dbo.teams.db_server column
-- Run on: LegacyLinkGlobal database
-- Run after: 024_bigint_user_pk.sql
-- ============================================================
-- db_server was used to embed the SQL Server hostname in the JWT
-- (via sp_Login / sp_RefreshToken / sp_SwitchTeam). The connection
-- layer reads the server from env vars — the column was never
-- consumed by any runtime code, just leaking infrastructure info
-- into a client-readable cookie.
--
-- sp_Login, sp_RefreshToken, and sp_SwitchTeam no longer reference
-- this column (fixed in sp_Global_AllProcedures.sql alongside 024).
-- ============================================================

USE LegacyLinkGlobal
GO

IF COL_LENGTH('dbo.teams', 'db_server') IS NOT NULL
BEGIN
  -- Drop any default constraint on the column before dropping it
  DECLARE @constraint NVARCHAR(200);
  SELECT TOP 1 @constraint = dc.name
  FROM   sys.default_constraints dc
  JOIN   sys.columns c ON c.default_object_id = dc.object_id
  WHERE  c.object_id = OBJECT_ID('dbo.teams')
    AND  c.name      = 'db_server';

  IF @constraint IS NOT NULL
    EXEC(N'ALTER TABLE dbo.teams DROP CONSTRAINT [' + @constraint + N']');

  ALTER TABLE dbo.teams DROP COLUMN db_server;
  PRINT 'Dropped dbo.teams.db_server';
END
ELSE
  PRINT 'dbo.teams.db_server not found — already dropped or never existed';
GO

-- Verification
SELECT c.name AS column_name, tp.name AS data_type
FROM   sys.columns c
JOIN   sys.types tp ON tp.user_type_id = c.user_type_id
WHERE  c.object_id = OBJECT_ID('dbo.teams')
ORDER  BY c.column_id;

PRINT '=== Migration 025 complete ===';
GO
