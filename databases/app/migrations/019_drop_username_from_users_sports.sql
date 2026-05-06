-- Migration 019: drop users_sports.username
-- The username column was a denormalized copy of first_name + last_name and
-- was written on insert but never selected by any stored procedure or query.
-- Full name is always fetched via JOIN to dbo.users.

ALTER TABLE dbo.users_sports DROP COLUMN username;
GO
