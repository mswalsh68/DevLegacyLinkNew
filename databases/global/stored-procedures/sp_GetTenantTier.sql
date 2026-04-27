SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO
-- ============================================================
-- sp_GetTenantTier (Global DB)
-- Returns the subscription tier name for a team by resolving
-- teams.tier_id → tiers.name.
-- Called once per dashboard metrics request from app-api.
-- Falls back to 'starter' if the team is not found.
-- ============================================================
CREATE OR ALTER PROCEDURE dbo.sp_GetTenantTier
  @TeamId INT,
  @Tier   NVARCHAR(20) OUTPUT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT @Tier = tr.name
  FROM   dbo.teams t
  JOIN   dbo.tiers tr ON tr.id = t.tier_id
  WHERE  t.id = @TeamId;

  -- Default to most restrictive tier if team not found
  IF @Tier IS NULL SET @Tier = N'starter';
END;
GO
