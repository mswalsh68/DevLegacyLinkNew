'use client'

import { useEffect, useState } from 'react'

interface Position {
  positionId:   number
  positionName: string
}

interface SportSnapshot {
  sportId:       number
  positionId:    number | null
  positionName?: string | null
  position?:     string | null
  jerseyNumber:  number | null
  classYear:     number | null
  seasonsPlayed: number | null
}

export interface SportSavedPayload {
  positionId:    number | null
  position:      string | null
  positionName:  string | null
  jerseyNumber:  number | null
  classYear:     number | null
  seasonsPlayed: number | null
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontSize: 14,
  border: '1px solid var(--color-card-border)',
  borderRadius: 6,
  backgroundColor: 'var(--color-card-bg)',
  color: 'var(--color-gray-900, #111)',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-gray-400, #9ca3af)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 4,
}

export function SportEditForm({
  sport,
  patchEndpoint,
  onSaved,
  onCancel,
}: {
  sport:         SportSnapshot
  patchEndpoint: string   // e.g. /api/players/14 or /api/alumni/14
  onSaved:       (payload: SportSavedPayload) => void
  onCancel:      () => void
}) {
  const [positions,     setPositions]     = useState<Position[]>([])
  const [positionId,    setPositionId]    = useState<string>(sport.positionId != null ? String(sport.positionId) : '')
  const [jerseyNumber,  setJerseyNumber]  = useState<string>(sport.jerseyNumber  != null ? String(sport.jerseyNumber)  : '')
  const [classYear,     setClassYear]     = useState<string>(sport.classYear     != null ? String(sport.classYear)     : '')
  const [seasonsPlayed, setSeasonsPlayed] = useState<string>(sport.seasonsPlayed != null ? String(sport.seasonsPlayed) : '')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  useEffect(() => {
    fetch(`/api/sports/${sport.sportId}/positions`, { credentials: 'include' })
      .then(r => r.json())
      .then((json) => {
        if (Array.isArray(json.data)) setPositions(json.data)
        else console.error('[SportEditForm] positions fetch unexpected:', json)
      })
      .catch((err) => console.error('[SportEditForm] positions fetch error:', err))
  }, [sport.sportId])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(patchEndpoint, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sportId:       sport.sportId,
          positionId:    positionId    !== '' ? Number(positionId)    : null,
          jerseyNumber:  jerseyNumber  !== '' ? Number(jerseyNumber)  : null,
          classYear:     classYear     !== '' ? Number(classYear)     : null,
          seasonsPlayed: seasonsPlayed !== '' ? Number(seasonsPlayed) : null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) { setError(json.error ?? 'Failed to save'); return }

      const pos = positions.find(p => p.positionId === Number(positionId))
      const resolvedPosition = pos?.positionName ?? sport.position ?? sport.positionName ?? null
      onSaved({
        positionId:    positionId    !== '' ? Number(positionId)    : null,
        position:      resolvedPosition,
        positionName:  resolvedPosition,
        jerseyNumber:  jerseyNumber  !== '' ? Number(jerseyNumber)  : null,
        classYear:     classYear     !== '' ? Number(classYear)     : null,
        seasonsPlayed: seasonsPlayed !== '' ? Number(seasonsPlayed) : null,
      })
    } catch {
      setError('Network error — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Position</label>
          <select value={positionId} onChange={e => setPositionId(e.target.value)} style={inputStyle}>
            <option value="">— None —</option>
            {positions.map(p => (
              <option key={p.positionId} value={p.positionId}>{p.positionName}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Jersey #</label>
          <input
            type="number" min={0} max={99}
            value={jerseyNumber}
            onChange={e => setJerseyNumber(e.target.value)}
            placeholder="—"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Class Year</label>
          <input
            type="number" min={1900} max={2100}
            value={classYear}
            onChange={e => setClassYear(e.target.value)}
            placeholder="—"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Seasons Played</label>
          <input
            type="number" min={0} max={99}
            value={seasonsPlayed}
            onChange={e => setSeasonsPlayed(e.target.value)}
            placeholder="—"
            style={inputStyle}
          />
        </div>
      </div>
      {error && <p style={{ fontSize: 13, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', backgroundColor: 'var(--color-primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: '1px solid var(--color-card-border)', backgroundColor: 'transparent', color: 'var(--color-gray-700, #374151)', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
