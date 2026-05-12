-- Migration 024: Mentor Program — dbo.mentor_pairings
-- Creates the table that tracks all admin-curated player ↔ alumni pairings.
-- Run on: LegacyLinkApp (per-tenant) ONLY
-- ============================================================

USE LegacyLinkApp
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.tables
  WHERE object_id = OBJECT_ID('dbo.mentor_pairings')
)
BEGIN
  CREATE TABLE dbo.mentor_pairings (
    id              INT          IDENTITY(1,1) NOT NULL,
    player_user_id  INT          NOT NULL,
    alumni_user_id  INT          NOT NULL,
    sport_id        INT          NULL,          -- browsing context; nullable
    admin_user_id   INT          NOT NULL,      -- who created the pairing
    status          VARCHAR(20)  NOT NULL CONSTRAINT DF_mentor_pairings_status DEFAULT 'pending',
    created_at      DATETIME2    NOT NULL CONSTRAINT DF_mentor_pairings_created DEFAULT SYSUTCDATETIME(),
    responded_at    DATETIME2    NULL,
    CONSTRAINT PK_mentor_pairings       PRIMARY KEY (id),
    CONSTRAINT FK_mp_player             FOREIGN KEY (player_user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT FK_mp_alumni             FOREIGN KEY (alumni_user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT FK_mp_sport              FOREIGN KEY (sport_id)       REFERENCES dbo.sports(id),
    CONSTRAINT FK_mp_admin              FOREIGN KEY (admin_user_id)  REFERENCES dbo.users(user_id),
    CONSTRAINT CK_mp_status             CHECK (status IN ('pending','active','declined','cancelled')),
  );

  CREATE INDEX IX_mp_player  ON dbo.mentor_pairings (player_user_id, status);
  CREATE INDEX IX_mp_alumni  ON dbo.mentor_pairings (alumni_user_id, status);

  PRINT 'Created dbo.mentor_pairings';
END
ELSE
  PRINT 'dbo.mentor_pairings already exists — skipping';
GO

PRINT '=== 024_mentor_pairings complete ===';
GO
