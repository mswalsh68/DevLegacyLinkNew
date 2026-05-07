-- ============================================================
-- GLOBAL DB — PREVIEW SESSION STORED PROCEDURES
-- Run this file on: LegacyLinkGlobal database
-- Run after: 036_preview_sessions.sql
-- ============================================================

-- ============================================================
-- sp_StartPreviewSession
-- Inserts a new preview session audit record.
-- Returns the new session ID so the caller can embed it in the JWT.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_StartPreviewSession
  @ActorId       BIGINT,
  @ActorEmail    NVARCHAR(255),
  @TeamId        INT,
  @TeamName      NVARCHAR(100),
  @ProgramRoleId INT,
  -- Output
  @SessionId     INT OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO dbo.preview_sessions (actor_id, actor_email, team_id, team_name, program_role_id)
  VALUES (@ActorId, @ActorEmail, @TeamId, @TeamName, @ProgramRoleId);

  SET @SessionId = SCOPE_IDENTITY();
END;
GO

-- ============================================================
-- sp_EndPreviewSession
-- Stamps ended_at on a preview session row.
-- No-ops gracefully if the session ID is not found.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_EndPreviewSession
  @SessionId INT
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.preview_sessions
  SET    ended_at = GETUTCDATE()
  WHERE  id = @SessionId
  AND    ended_at IS NULL;
END;
GO
