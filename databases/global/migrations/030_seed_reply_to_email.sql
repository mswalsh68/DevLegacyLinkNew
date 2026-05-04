-- Migration 030 — Seed reply_to_email for existing teams
-- email_reply_to column already exists on dbo.team_config (migration 013).
-- Sets a temporary testing address for all current teams.

USE DevLegacyLinkGlobal;
GO

UPDATE dbo.team_config
SET    email_reply_to = 'legacylinkhqapp@gmail.com'
WHERE  email_reply_to IS NULL;

PRINT CONCAT('Seeded email_reply_to for ', @@ROWCOUNT, ' team(s)');
GO

-- Verify
SELECT t.id, t.name, tc.email_reply_to
FROM   dbo.teams t
JOIN   dbo.team_config tc ON tc.team_id = t.id
ORDER  BY t.id;
GO

PRINT '=== Migration 030 complete ===';
GO
