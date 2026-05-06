-- Migration 035: Add website + other_link_1/2/3 to user_contact
-- Run on: LegacyLinkGlobal

ALTER TABLE dbo.user_contact
  ADD website      NVARCHAR(500) NULL,
      other_link_1 NVARCHAR(500) NULL,
      other_link_2 NVARCHAR(500) NULL,
      other_link_3 NVARCHAR(500) NULL;
GO
