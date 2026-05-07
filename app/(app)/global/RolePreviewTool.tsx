'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROGRAM_ROLE_OPTIONS } from '@/lib/constants'
import { theme } from '@/lib/theme'

interface Team {
  id:   number
  name: string
}

interface Props {
  teams: Team[]
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
      {children}
    </label>
  )
}

export default function RolePreviewTool({ teams }: Props) {
  const router = useRouter()

  const [teamId,        setTeamId]        = useState<number | ''>('')
  const [programRoleId, setProgramRoleId] = useState<number | ''>('')
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)

  async function handleStart() {
    if (teamId === '' || programRoleId === '') return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/internal/preview/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ teamId, programRoleId }),
      })
      const data = await res.json() as { success: boolean; error?: string }

      if (!data.success) {
        setError(data.error ?? 'Failed to start preview.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = teamId !== '' && programRoleId !== '' && !loading

  const selectStyle: React.CSSProperties = {
    width:           '100%',
    padding:         '8px 12px',
    borderRadius:    'var(--radius-sm)',
    border:          `1.5px solid ${theme.gray200}`,
    fontSize:        13,
    color:           theme.gray900,
    backgroundColor: 'var(--color-card-bg)',
    outline:         'none',
    boxSizing:       'border-box',
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-card-bg)',
      border:          `1px solid var(--color-card-border)`,
      borderRadius:    'var(--radius-lg)',
      boxShadow:       'var(--shadow-sm)',
      overflow:        'hidden',
      maxWidth:        480,
    }}>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Team selector */}
        <div>
          <FieldLabel>Team</FieldLabel>
          <select
            value={teamId}
            onChange={e => setTeamId(e.target.value === '' ? '' : Number(e.target.value))}
            style={selectStyle}
            onFocus={e => { e.target.style.borderColor = theme.primary }}
            onBlur={e  => { e.target.style.borderColor = theme.gray200 }}
          >
            <option value="">Select a team…</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Role selector */}
        <div>
          <FieldLabel>Program Role</FieldLabel>
          <select
            value={programRoleId}
            onChange={e => setProgramRoleId(e.target.value === '' ? '' : Number(e.target.value))}
            style={selectStyle}
            onFocus={e => { e.target.style.borderColor = theme.primary }}
            onBlur={e  => { e.target.style.borderColor = theme.gray200 }}
          >
            <option value="">Select a role…</option>
            {PROGRAM_ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: 13, color: theme.danger }}>{error}</p>
        )}

        <div>
          <button
            onClick={handleStart}
            disabled={!canSubmit}
            style={{
              padding:         '9px 18px',
              borderRadius:    'var(--radius-sm)',
              border:          'none',
              fontSize:        13,
              fontWeight:      600,
              cursor:          canSubmit ? 'pointer' : 'not-allowed',
              backgroundColor: canSubmit ? theme.primary : theme.gray200,
              color:           canSubmit ? '#fff' : theme.gray500,
              opacity:         loading ? 0.55 : 1,
              transition:      'opacity 0.15s',
            }}
          >
            {loading ? 'Starting…' : 'Start Preview'}
          </button>
        </div>
      </div>
    </div>
  )
}
