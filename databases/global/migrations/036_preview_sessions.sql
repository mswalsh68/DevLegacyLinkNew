-- Migration 036: Add dbo.preview_sessions for View As / Role Preview audit log
-- Run on: LegacyLinkGlobal
-- Requires: no dependencies beyond the users and teams tables (001, 004)

CREATE TABLE dbo.preview_sessions (
  id               INT            NOT NULL IDENTITY(1,1),
  actor_id         BIGINT         NOT NULL,
  actor_email      NVARCHAR(255)  NOT NULL,
  team_id          INT            NOT NULL,
  team_name        NVARCHAR(100)  NOT NULL,
  program_role_id  INT            NOT NULL,
  started_at       DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
  ended_at         DATETIME2      NULL,

  CONSTRAINT PK_preview_sessions PRIMARY KEY (id),
  CONSTRAINT FK_preview_sessions_actor  FOREIGN KEY (actor_id) REFERENCES dbo.users(user_id),
  CONSTRAINT FK_preview_sessions_team   FOREIGN KEY (team_id)  REFERENCES dbo.teams(id)
);
GO

CREATE INDEX IX_preview_sessions_actor ON dbo.preview_sessions (actor_id, started_at DESC);
GO
