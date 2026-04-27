-- ============================================================
-- 004_repair2.sql
-- Replaces the old monolithic dbo.users (mixed auth + player data)
-- with the new thin sync table design.
-- Run on: LegacyLinkApp ONLY
-- ============================================================
-- The old dbo.users held player profile fields (jersey_number,
-- position, recruiting_class, etc.) directly on the user row.
-- New architecture keeps those in dbo.players / dbo.alumni.
-- The new dbo.users is a thin sync table: user_id INT PK,
-- email, first/last name, platform_role, program_role_id.
-- ============================================================

USE LegacyLinkApp
GO

-- ─── 1. Drop all FKs that reference dbo.users ────────────────────────────────
DECLARE @fk NVARCHAR(200);
SELECT TOP 1 @fk = fk.name
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID('dbo.users');
WHILE @fk IS NOT NULL
BEGIN
  DECLARE @tbl NVARCHAR(200);
  SELECT @tbl = OBJECT_NAME(fk.parent_object_id)
  FROM sys.foreign_keys fk WHERE fk.name = @fk;
  EXEC(N'ALTER TABLE dbo.[' + @tbl + N'] DROP CONSTRAINT [' + @fk + N']');
  PRINT 'Dropped FK: ' + @fk;
  SET @fk = NULL;
  SELECT TOP 1 @fk = fk.name
  FROM sys.foreign_keys fk
  WHERE fk.referenced_object_id = OBJECT_ID('dbo.users');
END
GO

-- ─── 2. Drop old dbo.users ────────────────────────────────────────────────────
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
BEGIN
  DROP TABLE dbo.users;
  PRINT 'Dropped old dbo.users';
END
GO

-- ─── 3. Create new thin sync table ───────────────────────────────────────────
CREATE TABLE dbo.users (
  -- Matches LegacyLinkGlobal.dbo.users.user_id (INT IDENTITY)
  -- Same integer across Global and every App DB.
  user_id         INT           NOT NULL
                    CONSTRAINT PK_app_users PRIMARY KEY,

  -- Synced from global on team switch
  email           NVARCHAR(255) NOT NULL,
  first_name      NVARCHAR(100) NOT NULL,
  last_name       NVARCHAR(100) NOT NULL,

  -- Synced from global dbo.roles.role_name (permission level)
  platform_role   NVARCHAR(50)  NOT NULL DEFAULT 'player',

  -- Local to this App DB — UI category (player, alumni, staff, etc.)
  program_role_id INT           NULL
                    CONSTRAINT FK_app_users_program_role
                      FOREIGN KEY REFERENCES dbo.program_role(id),

  -- Per-team login tracking
  last_team_login DATETIME2     NULL,

  -- When global data was last pushed to this row
  synced_at       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX UQ_app_users_email ON dbo.users(email);

PRINT 'Created new dbo.users (thin sync table)';
GO

-- ─── Verification ─────────────────────────────────────────────────────────────
SELECT c.name AS column_name, tp.name AS data_type, c.is_nullable
FROM sys.columns c
JOIN sys.types tp ON tp.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.users')
ORDER BY c.column_id;

PRINT '=== 004_repair2 complete ===';
GO
