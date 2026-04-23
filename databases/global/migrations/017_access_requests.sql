-- Migration 017: access_requests table
-- Tracks self-signup requests created via invite codes.
-- Status flows: pending → approved | denied.
-- On approval, sp_ReviewAccessRequest replicates the same global DB writes
-- as the manual user-creation flow (sp_GetOrCreateUser: user_teams insert).

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'access_requests' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.access_requests (
    id               UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWID(),
    user_id          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.users(id),
    team_id          UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.teams(id),
    role             NVARCHAR(30)      NOT NULL,
    invite_code_id   UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.invite_codes(id),
    status           NVARCHAR(20)      NOT NULL DEFAULT 'pending'
                       CONSTRAINT chk_access_requests_status
                         CHECK (status IN ('pending', 'approved', 'denied')),
    reviewed_by      UNIQUEIDENTIFIER  NULL REFERENCES dbo.users(id),
    reviewed_at      DATETIME2         NULL,
    reminder_sent_at DATETIME2         NULL,
    denial_reason    NVARCHAR(MAX)     NULL,
    created_at       DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at       DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE INDEX IX_access_requests_user_id   ON dbo.access_requests(user_id);
  CREATE INDEX IX_access_requests_team_id   ON dbo.access_requests(team_id);
  CREATE INDEX IX_access_requests_status    ON dbo.access_requests(status);

  PRINT 'Created access_requests table';
END
ELSE
  PRINT 'access_requests table already exists — skipping';
GO
