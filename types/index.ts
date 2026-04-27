// ─── Shared TypeScript Types ──────────────────────────────────────────────────
// Keep types here that are used across multiple features.
// Feature-specific types live next to the feature.

import type { UserRole, Semester, TransferReason } from '@/lib/constants'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface UserSession {
  userId: string         // GUID — dbo.users.id; mapped from JWT sub claim by getServerSession()
  userIntId: number      // Integer user_id — dbo.users.user_id; canonical ID across Global + every App DB
  sub?: string           // Raw JWT sub claim (GUID) — kept for switch-team token re-issue stripping
  currentTeamId?: number // Set by POST /api/auth/switch-team; tells /api/config which team to load
  appDb?: string         // Tenant App DB name from dbo.teams.app_db — embedded in JWT by sp_Login / sp_SwitchTeam
  username: string
  email: string
  roleId: number         // dbo.roles.id (1 = platform_owner … 7 = alumni) — source of truth since migration 018
  role: UserRole         // dbo.roles.role_name — human-readable alias, used by permissions.ts can()
  accountClaimed: boolean // true after first login; gates who may edit the user record
  apps: string[]
  exp: number
  iat: number
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserContact {
  phone:                   string | null
  address:                 string | null
  city:                    string | null
  state:                   string | null
  zipcode:                 string | null
  country:                 string | null
  emergencyContactName1:   string | null
  emergencyContactEmail1:  string | null
  emergencyContactPhone1:  string | null
  emergencyContactName2:   string | null
  emergencyContactEmail2:  string | null
  emergencyContactPhone2:  string | null
  twitter:                 string | null
  instagram:               string | null
  facebook:                string | null
  linkedIn:                string | null
  contactUpdatedDate:      string | null
}

export interface UserProfile extends UserContact {
  userId:         number
  guid:           string
  email:          string
  firstName:      string
  lastName:       string
  roleId:         number
  role:           string
  isActive:       boolean
  accountClaimed: boolean
  claimedDate:    string | null
  lastLoginAt:    string | null
  createdAt:      string
}

// ─── Team Config ──────────────────────────────────────────────────────────────

export interface TeamConfig {
  // ── Identity ─────────────────────────────────────────────
  teamName:        string
  teamAbbr?:       string
  logoUrl?:        string
  sport:           string
  level:           string
  subscriptionTier?: string

  // ── Colors (normalized — ThemeProvider derives dark/light variants) ──
  primaryColor:    string
  secondaryColor:  string
  accentColor:     string

  // ── Colors (raw DB values — used by settings page, returned by /api/config) ──
  colorPrimary?:      string
  colorPrimaryDark?:  string
  colorPrimaryLight?: string
  colorAccent?:       string
  colorAccentDark?:   string
  colorAccentLight?:  string

  // ── Roster / alumni ──────────────────────────────────────
  positions:      string[]
  academicYears:  string[]
  customLabels:   Record<string, string>

  // ── Terminology labels ───────────────────────────────────
  alumniLabel?:   string
  rosterLabel?:   string
  classLabel?:    string
}

// ─── Player / Roster ──────────────────────────────────────────────────────────

export interface Player {
  playerId: number
  firstName: string
  lastName: string
  position: string
  jerseyNumber: string
  academicYear: string
  recruitingClass: number
  isActive: boolean
  createdAt: string
}

export interface TransferPayload {
  playerIds: number[]
  transferReason: TransferReason
  transferYear: number
  transferSemester: Semester
  notes?: string
}

// ─── Alumni ───────────────────────────────────────────────────────────────────

export interface Alumni {
  alumniId: number
  sourcePlayerId: number | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  position: string
  graduationYear: number
  graduationSemester: Semester
  recruitingClass: number
  employer: string | null
  jobTitle: string | null
  createdAt: string
}

export interface Interaction {
  interactionId: number
  alumniId: number
  type: string
  notes: string
  interactedAt: string
  createdByUserId: number
}

// ─── API Response Envelope ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
