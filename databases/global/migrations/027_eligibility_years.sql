-- ============================================================
-- Migration 027: Add eligibility_years lookup table
-- Run on: LegacyLinkGlobal database
-- Run after: 026_reorder_pk_fk_columns.sql
-- ============================================================
-- Replaces the free-text academic_years_json in team_config with
-- a static lookup table keyed by level_id (1 = High School, 2 = College).
-- sp_GetTeamConfig now JOINs this table so the settings page no longer
-- needs an Academic Years editor — values are derived from the team level.
-- ============================================================

USE LegacyLinkGlobal
GO

CREATE TABLE dbo.eligibility_years (
    id        INT          NOT NULL,
    level_id  INT          NOT NULL,  -- 1 = High School, 2 = College
    year_name VARCHAR(50)  NOT NULL,
    CONSTRAINT PK_eligibility_years PRIMARY KEY (id)
);

INSERT INTO dbo.eligibility_years (id, level_id, year_name) VALUES
(1,  1, 'Freshman'),
(2,  1, 'Sophomore'),
(3,  1, 'Junior'),
(4,  1, 'Senior'),
(5,  2, 'Freshman'),
(6,  2, 'Redshirt Freshman'),
(7,  2, 'Sophomore'),
(8,  2, 'Redshirt Sophomore'),
(9,  2, 'Junior'),
(10, 2, 'Redshirt Junior'),
(11, 2, 'Senior'),
(12, 2, '5th Year Senior');
