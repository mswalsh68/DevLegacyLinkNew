SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- DOMAIN: Mentor Pairings
-- Procedures: sp_CreateMentorPairing, sp_GetMentorPairings,
--             sp_CancelMentorPairing, sp_RespondToMentorRequest,
--             sp_GetPlayerMentors, sp_GetAlumniMentorDashboard
-- Run on: each tenant AppDB
-- ============================================================

-- ============================================================
-- sp_CreateMentorPairing
-- Admin creates a player ↔ alumni pairing.
-- Validates: no existing pending/active pair, ≤2 declines, 24hr cooldown.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CreateMentorPairing
  @PlayerUserId  INT,
  @AlumniUserId  INT,
  @SportId       INT = NULL,
  @AdminUserId   INT
AS
BEGIN
  SET NOCOUNT ON;

  -- Existing pending or active pairing?
  IF EXISTS (
    SELECT 1 FROM dbo.mentor_pairings
    WHERE player_user_id = @PlayerUserId
      AND alumni_user_id = @AlumniUserId
      AND status IN ('pending', 'active')
  )
  BEGIN
    SELECT 'ALREADY_EXISTS' AS errorCode, NULL AS pairingId;
    RETURN;
  END

  -- Decline cap
  DECLARE @DeclineCount INT;
  SELECT @DeclineCount = COUNT(*)
  FROM dbo.mentor_pairings
  WHERE player_user_id = @PlayerUserId
    AND alumni_user_id = @AlumniUserId
    AND status = 'declined';

  IF @DeclineCount >= 2
  BEGIN
    SELECT 'MAX_DECLINES_REACHED' AS errorCode, NULL AS pairingId;
    RETURN;
  END

  -- 24-hour cooldown after a decline
  DECLARE @LastDecline DATETIME2;
  SELECT @LastDecline = MAX(responded_at)
  FROM dbo.mentor_pairings
  WHERE player_user_id = @PlayerUserId
    AND alumni_user_id = @AlumniUserId
    AND status = 'declined';

  IF @LastDecline IS NOT NULL
     AND DATEDIFF(HOUR, @LastDecline, SYSUTCDATETIME()) < 24
  BEGIN
    SELECT 'COOLDOWN_ACTIVE' AS errorCode, NULL AS pairingId;
    RETURN;
  END

  INSERT INTO dbo.mentor_pairings (player_user_id, alumni_user_id, sport_id, admin_user_id, status)
  VALUES (@PlayerUserId, @AlumniUserId, @SportId, @AdminUserId, 'pending');

  SELECT NULL AS errorCode, SCOPE_IDENTITY() AS pairingId;
END;
GO

-- ============================================================
-- sp_GetMentorPairings
-- Admin status board — all pairings with player + alumni detail.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetMentorPairings
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    mp.id,
    mp.status,
    mp.created_at    AS createdAt,
    mp.responded_at  AS respondedAt,
    mp.sport_id      AS sportId,
    s.name           AS sportName,
    -- Player
    mp.player_user_id AS playerUserId,
    pu.first_name     AS playerFirstName,
    pu.last_name      AS playerLastName,
    psp.position_name AS playerPosition,
    pus.class_year    AS playerClassYear,
    -- Alumni
    mp.alumni_user_id AS alumniUserId,
    au.first_name     AS alumniFirstName,
    au.last_name      AS alumniLastName,
    asp.position_name AS alumniPosition,
    -- Admin
    mp.admin_user_id  AS adminUserId,
    adm.first_name    AS adminFirstName,
    adm.last_name     AS adminLastName
  FROM dbo.mentor_pairings mp
  JOIN  dbo.users pu   ON pu.user_id  = mp.player_user_id
  JOIN  dbo.users au   ON au.user_id  = mp.alumni_user_id
  JOIN  dbo.users adm  ON adm.user_id = mp.admin_user_id
  LEFT JOIN dbo.sports s ON s.id = mp.sport_id
  -- player sport row for context
  LEFT JOIN dbo.users_sports pus
    ON pus.user_id = mp.player_user_id
   AND pus.sport_id = mp.sport_id
  LEFT JOIN dbo.sports_position psp ON psp.position_id = pus.position_id
  -- alumni sport row for context
  LEFT JOIN dbo.users_sports aus
    ON aus.user_id = mp.alumni_user_id
   AND aus.sport_id = mp.sport_id
  LEFT JOIN dbo.sports_position asp ON asp.position_id = aus.position_id
  ORDER BY mp.created_at DESC;
END;
GO

-- ============================================================
-- sp_CancelMentorPairing
-- Admin cancels a pending pairing. Returns errorCode if not pending.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_CancelMentorPairing
  @PairingId   INT,
  @AdminUserId INT
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.mentor_pairings WHERE id = @PairingId AND status = 'pending')
  BEGIN
    SELECT 'NOT_PENDING' AS errorCode;
    RETURN;
  END

  UPDATE dbo.mentor_pairings
  SET status       = 'cancelled',
      responded_at = SYSUTCDATETIME()
  WHERE id = @PairingId;

  -- Return alumni + player user IDs so the API can send the cancellation email
  SELECT NULL AS errorCode, alumni_user_id AS alumniUserId, player_user_id AS playerUserId
  FROM dbo.mentor_pairings WHERE id = @PairingId;
END;
GO

-- ============================================================
-- sp_RespondToMentorRequest
-- Alumni accepts or declines a pending pairing.
-- @Response: 'active' (accept) | 'declined' (decline)
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_RespondToMentorRequest
  @PairingId    INT,
  @AlumniUserId INT,
  @Response     VARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (
    SELECT 1 FROM dbo.mentor_pairings
    WHERE id = @PairingId
      AND alumni_user_id = @AlumniUserId
      AND status = 'pending'
  )
  BEGIN
    SELECT 'NOT_FOUND' AS errorCode, NULL AS playerUserId, NULL AS adminUserId;
    RETURN;
  END

  UPDATE dbo.mentor_pairings
  SET status       = @Response,
      responded_at = SYSUTCDATETIME()
  WHERE id = @PairingId;

  -- Return player + admin user IDs so the API can send the right emails
  SELECT NULL AS errorCode, player_user_id AS playerUserId, admin_user_id AS adminUserId
  FROM dbo.mentor_pairings WHERE id = @PairingId;
END;
GO

-- ============================================================
-- sp_GetPlayerMentors
-- Returns active mentor pairings for a given player.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetPlayerMentors
  @PlayerUserId INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    mp.id,
    mp.alumni_user_id AS alumniUserId,
    au.first_name     AS alumniFirstName,
    au.last_name      AS alumniLastName,
    mp.sport_id       AS sportId,
    s.name            AS sportName,
    asp.position_name AS alumniPosition,
    aus.class_year    AS alumniClassYear,
    aus.seasons_played AS alumniSeasonsPlayed,
    mp.responded_at   AS acceptedAt
  FROM dbo.mentor_pairings mp
  JOIN  dbo.users au ON au.user_id = mp.alumni_user_id
  LEFT JOIN dbo.sports s ON s.id = mp.sport_id
  LEFT JOIN dbo.users_sports aus
    ON aus.user_id = mp.alumni_user_id
   AND aus.sport_id = mp.sport_id
  LEFT JOIN dbo.sports_position asp ON asp.position_id = aus.position_id
  WHERE mp.player_user_id = @PlayerUserId
    AND mp.status = 'active'
  ORDER BY mp.responded_at DESC;
END;
GO

-- ============================================================
-- sp_GetAlumniMentorDashboard
-- Returns all mentoring data for an alumni:
--   pending requests, active mentees, and history (graduated players).
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetAlumniMentorDashboard
  @AlumniUserId INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    mp.id,
    mp.status,
    mp.created_at    AS createdAt,
    mp.responded_at  AS respondedAt,
    mp.sport_id      AS sportId,
    s.name           AS sportName,
    -- Player info
    mp.player_user_id AS playerUserId,
    pu.first_name     AS playerFirstName,
    pu.last_name      AS playerLastName,
    psp.position_name AS playerPosition,
    pus.class_year    AS playerClassYear,
    -- Is the player still on the active roster?
    CASE
      WHEN EXISTS (
        SELECT 1 FROM dbo.users_sports
        WHERE user_id = mp.player_user_id
          AND program_role_id = 8
          AND is_active = 1
      ) THEN CAST(1 AS BIT)
      ELSE CAST(0 AS BIT)
    END AS playerIsActive
  FROM dbo.mentor_pairings mp
  JOIN  dbo.users pu ON pu.user_id = mp.player_user_id
  LEFT JOIN dbo.sports s ON s.id = mp.sport_id
  LEFT JOIN dbo.users_sports pus
    ON pus.user_id = mp.player_user_id
   AND pus.sport_id = mp.sport_id
  LEFT JOIN dbo.sports_position psp ON psp.position_id = pus.position_id
  WHERE mp.alumni_user_id = @AlumniUserId
    AND mp.status IN ('pending', 'active')
  ORDER BY mp.created_at DESC;
END;
GO
