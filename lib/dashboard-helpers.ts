// ─── Shared helpers for dashboard tab components ──────────────────────────────
// Used by CommsDashboardTab and its AlumniTab / PlayerTab wrappers.

import { theme } from './theme'

export const AUDIENCE_LABEL: Record<string, string> = {
  all:          'Everyone',
  players_only: 'Players',
  alumni_only:  'Alumni',
  byGradYear:   'By Grad Year',
  byPosition:   'By Position',
  custom:       'Custom',
}

export const STATUS_COLOR: Record<string, string> = {
  draft:     theme.gray400,
  active:    theme.primary,
  completed: theme.accent,
  cancelled: theme.gray400,
}

export function audienceBadgeVariant(audience: string): 'primary' | 'primary-inverse' {
  return audience === 'players_only' || audience === 'alumni_only'
    ? 'primary-inverse'
    : 'primary'
}

/** Format an ISO date string as "Jan 5, 2025" */
export function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  })
}
