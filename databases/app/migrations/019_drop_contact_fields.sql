-- Migration 019: Drop contact/social columns from players and alumni
-- Contact info is now stored in Global DB dbo.user_contact (migration 022+035).
-- Run on: each tenant App DB

-- players table
ALTER TABLE dbo.players
  DROP COLUMN IF EXISTS phone,
                        personal_email,
                        instagram,
                        twitter,
                        snapchat,
                        emergency_contact_name,
                        emergency_contact_phone,
                        parent1_name,
                        parent1_phone,
                        parent1_email,
                        parent2_name,
                        parent2_phone,
                        parent2_email,
                        notes;
GO

-- alumni table
ALTER TABLE dbo.alumni
  DROP COLUMN IF EXISTS phone,
                        personal_email,
                        linkedin_url,
                        twitter_url,
                        notes;
GO
