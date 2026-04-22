// App-wide constants. No business logic — pure values only.

export const APP_NAME = 'DevLegacyLink'

// ─── Select-option arrays used across pages ───────────────────────────────────

export const SEMESTER_OPTIONS = [
  { value: 'spring', label: 'Spring' },
  { value: 'fall',   label: 'Fall'   },
  { value: 'summer', label: 'Summer' },
]

export const ROLE_OPTIONS = [
  { value: 'readonly',       label: 'Read Only'      },
  { value: 'coach_staff',    label: 'Coach / Staff'  },
  { value: 'app_admin',      label: 'App Admin'      },
  { value: 'global_admin',   label: 'Global Admin'   },
  { value: 'platform_owner', label: 'Platform Owner' },
]

// ─── Roster defaults ──────────────────────────────────────────────────────────

/** Default positions used when a team has not customised their config. */
export const DEFAULT_POSITIONS = [
  'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P', 'LS', 'ATH',
]

export const DEFAULT_ACADEMIC_YEARS = [
  'Freshman',
  'RS Freshman',
  'Sophomore',
  'RS Sophomore',
  'Junior',
  'RS Junior',
  'Senior',
  'RS Senior',
  'Graduate',
  'Graduate Transfer',
]

/** Build a descending array of calendar years starting from the current year. */
export function makeYearOptions(count: number): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: count }, (_, i) => currentYear - i)
}

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const

export const API_TIMEOUT_MS = 10_000

export const SEMESTERS = ['Spring', 'Summer', 'Fall'] as const
export type Semester = (typeof SEMESTERS)[number]

export const TRANSFER_REASONS = [
  'graduated',
  'transferred',
  'medically-retired',
  'other',
] as const
export type TransferReason = (typeof TRANSFER_REASONS)[number]

// Values must match the global_role CHECK constraint in the DB:
//   platform_owner | global_admin | coach_staff | readonly
// Legacy aliases (coach, staff, read_only) kept for backwards compat.
export const USER_ROLES = [
  'platform_owner',
  'global_admin',
  'coach_staff',
  'readonly',
  'coach',
  'staff',
  'read_only',
] as const
export type UserRole = (typeof USER_ROLES)[number]
