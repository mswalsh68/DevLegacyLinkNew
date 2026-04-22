/**
 * feedTokens.ts
 *
 * Resolves white-label tokens embedded in feed post HTML.
 * Tokens are substituted at render time using the live TeamConfig —
 * no extra DB call needed, and colors always reflect the current
 * team palette even after admin settings changes.
 *
 * Tokens:
 *   {{TEAM_NAME}}     → config.teamName
 *   {{PRIMARY_COLOR}} → config.primaryColor
 *   {{ACCENT_COLOR}}  → config.accentColor
 *   {{SPORT_EMOJI}}   → emoji derived from config.sport
 *
 * Only applied when isWelcomePost === true to avoid scanning every post.
 */

import type { TeamConfig } from '@/types'

const SPORT_EMOJI: Record<string, string> = {
  football:   '🏈',
  basketball: '🏀',
  baseball:   '⚾',
  soccer:     '⚽',
  softball:   '🥎',
  volleyball: '🏐',
  other:      '🏆',
}

export function resolvePostTokens(html: string, config: TeamConfig): string {
  const sportEmoji = SPORT_EMOJI[config.sport?.toLowerCase()] ?? '🏆'
  return html
    .replaceAll('{{TEAM_NAME}}',     config.teamName)
    .replaceAll('{{PRIMARY_COLOR}}', config.primaryColor)
    .replaceAll('{{ACCENT_COLOR}}',  config.accentColor)
    .replaceAll('{{SPORT_EMOJI}}',   sportEmoji)
}
