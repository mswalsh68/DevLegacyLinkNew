'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROGRAM_ROLE_OPTIONS } from '@/lib/constants'

interface Team {
  id:   number
  name: string
}

interface Props {
  teams: Team[]
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

      // Navigate to dashboard as the preview role
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = teamId !== '' && programRoleId !== '' && !loading

  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        border:          '1px solid var(--color-border)',
        borderRadius:    12,
        padding:         24,
        maxWidth:        480,
      }}
    >
      {/* Team selector */}
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="preview-team"
          style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6,
                   color: 'var(--color-text-primary)' }}
        >
          Team
        </label>
        <select
          id="preview-team"
          value={teamId}
          onChange={e => setTeamId(e.target.value === '' ? '' : Number(e.target.value))}
          style={{
            width:        '100%',
            padding:      '8px 12px',
            borderRadius: 8,
            border:       '1px solid var(--color-border)',
            fontSize:     14,
            color:        'var(--color-text-primary)',
            backgroundColor: 'var(--color-input-bg)',
          }}
        >
          <option value="">Select a team…</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Role selector */}
      <div style={{ marginBottom: 24 }}>
        <label
          htmlFor="preview-role"
          style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6,
                   color: 'var(--color-text-primary)' }}
        >
          Program Role
        </label>
        <select
          id="preview-role"
          value={programRoleId}
          onChange={e => setProgramRoleId(e.target.value === '' ? '' : Number(e.target.value))}
          style={{
            width:        '100%',
            padding:      '8px 12px',
            borderRadius: 8,
            border:       '1px solid var(--color-border)',
            fontSize:     14,
            color:        'var(--color-text-primary)',
            backgroundColor: 'var(--color-input-bg)',
          }}
        >
          <option value="">Select a role…</option>
          {PROGRAM_ROLE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-error)' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleStart}
        disabled={!canSubmit}
        style={{
          padding:         '9px 20px',
          borderRadius:    8,
          border:          'none',
          fontSize:        14,
          fontWeight:      600,
          cursor:          canSubmit ? 'pointer' : 'not-allowed',
          backgroundColor: canSubmit ? 'var(--color-primary)' : 'var(--color-border)',
          color:           canSubmit ? '#fff' : 'var(--color-text-secondary)',
          transition:      'background-color 150ms',
        }}
      >
        {loading ? 'Starting…' : 'Start Preview'}
      </button>
    </div>
  )
}
