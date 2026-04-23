-- Migration 016: invite_codes table
-- Stores shareable invite codes that gate self-signup access requests.
-- A code is scoped to a team + role and optionally limited by expiry / max uses.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'invite_codes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.invite_codes (
    id           UNIQUEIDENTIFIER  NOT NULL PRIMARY KEY DEFAULT NEWID(),
    team_id      UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.teams(id) ON DELETE CASCADE,
    role         NVARCHAR(30)      NOT NULL,
    token        NVARCHAR(128)     NOT NULL,   -- UUID, opaque — never encodes team/role
    created_by   UNIQUEIDENTIFIER  NOT NULL REFERENCES dbo.users(id),
    expires_at   DATETIME2         NULL,
    max_uses     INT               NULL,
    use_count    INT               NOT NULL DEFAULT 0,
    is_active    BIT               NOT NULL DEFAULT 1,
    created_at   DATETIME2         NOT NULL DEFAULT SYSUTCDATETIME()
  );

  CREATE UNIQUE INDEX UX_invite_codes_token    ON dbo.invite_codes(token);
  CREATE        INDEX IX_invite_codes_team_id  ON dbo.invite_codes(team_id);
  CREATE        INDEX IX_invite_codes_is_active ON dbo.invite_codes(is_active);

  PRINT 'Created invite_codes table';
END
ELSE
  PRINT 'invite_codes table already exists — skipping';
GO
