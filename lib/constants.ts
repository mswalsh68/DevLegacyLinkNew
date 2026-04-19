// App-wide constants. No business logic — pure values only.

export const APP_NAME = 'DevLegacyLink'

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

export const USER_ROLES = ['global_admin', 'coach', 'staff', 'read_only'] as const
export type UserRole = (typeof USER_ROLES)[number]
