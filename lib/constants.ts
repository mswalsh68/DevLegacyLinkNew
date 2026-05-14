// App-wide constants. No business logic — pure values only.

export const APP_NAME = 'LegacyLink'

// ─── Select-option arrays used across pages ───────────────────────────────────

export const SEMESTER_OPTIONS = [
  { value: 'spring', label: 'Spring' },
  { value: 'fall',   label: 'Fall'   },
  { value: 'summer', label: 'Summer' },
]

export const ROLE_OPTIONS = [
  { value: 'super_admin',    label: 'Super Admin'    },
  { value: 'support_admin',  label: 'Support Admin'  },
  { value: 'client',         label: 'Client'         },
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

// Values must match dbo.roles.role_name in LegacyLinkGlobal (migration 028).
// 1 = super_admin (internal), 2 = support_admin (internal), 3 = client (external)
export const USER_ROLES = [
  'super_admin',
  'support_admin',
  'client',
] as const
export type UserRole = (typeof USER_ROLES)[number]

// Bump this string whenever the community T&C text changes to force re-consent.
export const COMMUNITY_TC_VERSION = '1.0'

// ─── Program role labels ──────────────────────────────────────────────────────
// Matches dbo.program_role IDs in the App DB (post-migration 014).
// 1=AD, 2=PA, 3=ADir, 4=HC, 5=Coach, 6=Staff, 7=Alumni, 8=Player
export const PROGRAM_ROLE_LABELS: Record<number, string> = {
  1: 'Athletic Director',
  2: 'Program Admin',
  3: 'Associate Director',
  4: 'Head Coach',
  5: 'Coach',
  6: 'Staff',
  7: 'Alumni',
  8: 'Player',
}

export const PROGRAM_ROLE_OPTIONS = Object.entries(PROGRAM_ROLE_LABELS).map(
  ([id, label]) => ({ value: Number(id), label }),
)
