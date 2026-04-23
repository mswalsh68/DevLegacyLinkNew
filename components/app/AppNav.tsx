'use client'

// Top navigation bar — matches the original project's visual design.
// - Background: var(--color-primary) — updates instantly on team switch
// - Left: team color swatch + team name + optional team switcher dropdown
// - Right: user avatar circle + dropdown (sign out)
// Replaces the dark sidebar (AppSidebar + AppHeader) that was previously used.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { useTeamConfig } from '@/providers/ThemeProvider'
import type { TeamConfig } from '@/types'

type TeamItem = TeamConfig & { teamId: string }

export function AppNav() {
  const router              = useRouter()
  const { user, clearSession } = useAuth()
  const config              = useTeamConfig()

  const [teams,        setTeams]        = useState<TeamItem[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [avatarOpen,   setAvatarOpen]   = useState(false)
  const [switching,    setSwitching]    = useState(false)
  const [switchError,  setSwitchError]  = useState('')

  const dropdownRef = useRef<HTMLDivElement>(null)
  const avatarRef   = useRef<HTMLDivElement>(null)

  // Fetch teams so the switcher is populated with real data
  useEffect(() => {
    fetch('/api/teams', { credentials: 'include' })
      .then((r) => r.json())
      .then((res: { success: boolean; data: TeamItem[] }) => {
        if (res.success && Array.isArray(res.data)) setTeams(res.data)
      })
      .catch(() => {}) // silent — switcher just won't show if teams unavailable
  }, [])

  // No applyTheme call here — ThemeProvider owns the theme.
  // After a team switch the JWT has currentTeamId, /api/config returns the right
  // team on reload, and ThemeProvider applies it. Applying colors from the /api/teams
  // list here (which uses different SP columns) would overwrite ThemeProvider's result.

  // Close both dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false)
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node))
        setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    setAvatarOpen(false)
    try {
      await fetch('/api/auth', { method: 'DELETE', credentials: 'include' })
    } catch { /* best-effort — clear client state regardless */ }
    clearSession()
    router.push('/login')
  }

  const handleSwitch = async (team: TeamItem) => {
    if (switching) return
    setSwitching(true)
    setSwitchError('')
    setDropdownOpen(false)

    try {
      const res = await fetch('/api/auth/switch-team', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ teamId: team.teamId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSwitchError((err as { error?: string }).error ?? 'Failed to switch team.')
        setSwitching(false)
        return
      }
    } catch {
      setSwitchError('Failed to switch team.')
      setSwitching(false)
      return
    }

    try { localStorage.setItem('dll_selected_team_id', team.teamId) } catch { /* ignore */ }

    // Clear sessionStorage so ThemeProvider doesn't paint stale old-team colors
    // on the new page load before the /api/config fetch completes.
    try { sessionStorage.removeItem('dll_team_config') } catch { /* ignore */ }

    // Hard reload — same pattern as the original project.
    // ThemeProvider re-mounts fresh and /api/config returns the new team's config
    // because the JWT now has currentTeamId set.
    window.location.href = '/dashboard'
  }

  const displayName  = user?.username ?? user?.email ?? ''
  const initials     = displayName[0]?.toUpperCase() ?? '?'
  const showSwitcher = teams.length > 1

  return (
    <nav
      style={{
        backgroundColor: 'var(--color-primary)',
        padding:         '0 24px',
        height:          56,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        position:        'sticky',
        top:             0,
        zIndex:          100,
        boxShadow:       '0 1px 4px rgba(0,0,0,0.15)',
      }}
    >
      {/* ── Left: logo + team name + team switcher ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Home button / team identity */}
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        10,
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            padding:    0,
          }}
        >
          <div
            style={{
              width:           36,
              height:          36,
              borderRadius:    8,
              backgroundColor: 'var(--color-accent)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              flexShrink:      0,
              overflow:        'hidden',
            }}
          >
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logoUrl}
                alt={config.teamName}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <span
                style={{
                  fontSize:      13,
                  fontWeight:    800,
                  color:         'var(--color-primary)',
                  letterSpacing: '-0.5px',
                }}
              >
                {config.teamName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <span
            style={{
              fontSize:      16,
              fontWeight:    700,
              color:         '#fff',
              letterSpacing: '-0.2px',
            }}
          >
            {config.teamName}
          </span>
        </button>

        {/* Team switcher dropdown */}
        {showSwitcher && (
          <div ref={dropdownRef} style={{ position: 'relative', marginLeft: 8 }}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              disabled={switching}
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             6,
                backgroundColor: 'rgba(255,255,255,0.12)',
                border:          '1px solid rgba(255,255,255,0.2)',
                borderRadius:    8,
                color:           'rgba(255,255,255,0.85)',
                padding:         '5px 10px',
                fontSize:        12,
                fontWeight:      600,
                cursor:          switching ? 'wait' : 'pointer',
                transition:      'background 0.15s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.22)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)')
              }
            >
              Switch Team
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{
                  transform:  dropdownOpen ? 'rotate(180deg)' : undefined,
                  transition: 'transform 0.15s',
                }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div
                style={{
                  position:     'absolute',
                  top:          '110%',
                  left:         0,
                  minWidth:     220,
                  background:   '#fff',
                  borderRadius: 10,
                  boxShadow:    '0 8px 24px rgba(0,0,0,0.18)',
                  border:       '1px solid #e5e7eb',
                  zIndex:       200,
                  overflow:     'hidden',
                }}
              >
                <div
                  style={{
                    padding:       '8px 12px 4px',
                    fontSize:      10,
                    fontWeight:    600,
                    color:         '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Switch Team
                </div>

                {teams.map((team) => {
                  const active = config.teamName === team.teamName
                  return (
                    <button
                      key={team.teamId}
                      onClick={() => handleSwitch(team)}
                      style={{
                        width:       '100%',
                        display:     'flex',
                        alignItems:  'center',
                        gap:         10,
                        padding:     '10px 14px',
                        background:  active ? 'var(--color-primary-light)' : 'transparent',
                        border:      'none',
                        cursor:      'pointer',
                        textAlign:   'left',
                        fontSize:    14,
                        color:       active ? 'var(--color-primary)' : '#374151',
                        fontWeight:  active ? 600 : 400,
                        transition:  'background 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        if (!active) e.currentTarget.style.background = '#f9fafb'
                      }}
                      onMouseLeave={(e) => {
                        if (!active) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span
                        style={{
                          width:           12,
                          height:          12,
                          borderRadius:    3,
                          backgroundColor: team.primaryColor,
                          flexShrink:      0,
                          border:          '1px solid rgba(0,0,0,0.08)',
                        }}
                      />
                      <span style={{ flex: 1 }}>{team.teamName}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{team.sport}</span>
                      {active && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          style={{ color: 'var(--color-primary)', flexShrink: 0 }}
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right: error + avatar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {switchError && (
          <span style={{ fontSize: 12, color: '#fca5a5' }}>{switchError}</span>
        )}

        {/* Avatar + dropdown */}
        <div ref={avatarRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAvatarOpen((v) => !v)}
            aria-label="Account menu"
            style={{
              width:           36,
              height:          36,
              borderRadius:    '50%',
              backgroundColor: 'var(--color-accent)',
              color:           'var(--color-primary)',
              border:          '2px solid rgba(255,255,255,0.3)',
              cursor:          'pointer',
              fontSize:        13,
              fontWeight:      700,
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              transition:      'border-color 0.15s',
              flexShrink:      0,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')
            }
          >
            {initials}
          </button>

          {avatarOpen && (
            <div
              style={{
                position:     'absolute',
                top:          '110%',
                right:        0,
                minWidth:     200,
                background:   '#fff',
                borderRadius: 10,
                boxShadow:    '0 8px 24px rgba(0,0,0,0.18)',
                border:       '1px solid #e5e7eb',
                zIndex:       200,
                overflow:     'hidden',
              }}
            >
              {/* User info header */}
              <div
                style={{
                  padding:      '12px 16px',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <div
                  style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}
                >
                  {displayName || 'My Account'}
                </div>
                {user?.email && user.email !== displayName && (
                  <div
                    style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}
                  >
                    {user.email}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: '#e5e7eb' }} />

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                style={{
                  width:      '100%',
                  display:    'flex',
                  alignItems: 'center',
                  gap:        10,
                  padding:    '10px 16px',
                  background: 'transparent',
                  border:     'none',
                  cursor:     'pointer',
                  textAlign:  'left',
                  fontSize:   14,
                  color:      '#ef4444',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = '#fef2f2')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
