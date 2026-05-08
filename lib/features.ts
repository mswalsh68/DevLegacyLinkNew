/**
 * features.ts — Centralised feature-flag module (frontend)
 *
 * Feed the tier from useTeamConfig().subscriptionTier — it is
 * loaded once at session bootstrap by ThemeProvider via GET /api/config.
 *
 * Usage:
 *   const { subscriptionTier } = useTeamConfig()
 *   if (hasFeature(subscriptionTier, 'alumni_dashboard')) { ... }
 */

export type Tier = 'starter' | 'pro' | 'elite'

const FEATURE_MATRIX: Record<string, Tier[]> = {
  // Available on all tiers (starter+)
  interactions:      ['starter', 'pro', 'elite'],
  emails_sent:       ['starter', 'pro', 'elite'],
  player_feed_posts: ['starter', 'pro', 'elite'],
  alumni_dashboard:  ['starter', 'pro', 'elite'],
  login_frequency:   ['starter', 'pro', 'elite'],
  email_open_rate:   ['starter', 'pro', 'elite'],

  // Pro and above — roster management + player comms + full engagement tabs
  roster_management: ['pro', 'elite'],
  player_dashboard:  ['pro', 'elite'],

  // Elite only
  events_module:     ['elite'],
  donor_tracking:    ['elite'],
  engagement_score:  ['elite'],
}

export function normalizeTier(raw: string | undefined | null): Tier {
  if (raw === 'enterprise' || raw === 'elite') return 'elite'
  if (raw === 'pro')                           return 'pro'
  return 'starter'
}

export function hasFeature(tier: string | undefined | null, feature: string): boolean {
  const t = normalizeTier(tier)
  return FEATURE_MATRIX[feature]?.includes(t) ?? false
}

export function featuresForTier(tier: string | undefined | null): string[] {
  const t = normalizeTier(tier)
  return Object.entries(FEATURE_MATRIX)
    .filter(([, tiers]) => tiers.includes(t))
    .map(([feature]) => feature)
}
