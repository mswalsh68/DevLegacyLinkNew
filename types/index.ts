// ─── Shared TypeScript Types ──────────────────────────────────────────────────
// Keep types here that are used across multiple features.
// Feature-specific types live next to the feature.

import type { UserRole, Semester, TransferReason } from '@/lib/constants'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface UserSession {
  userId: string        // UUID — JWT stores this in the 'sub' claim; getServerSession() maps sub → userId
  sub?: string          // Raw JWT subject (same UUID, kept for completeness)
  currentTeamId?: string // Set by POST /api/auth/switch-team; tells /api/config which team to load
  username: string
  email: string
  role: UserRole
  apps: string[]
  exp: number
  iat: number
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
