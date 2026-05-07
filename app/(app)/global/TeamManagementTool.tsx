'use client'

import { useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  id:              number
  name:            string
  tierId:          number
  tier:            string
  tierDisplayName: string
  levelId:         number
  level:           string
  levelDisplayName: string
  appDb:           string
  isActive:        boolean
  createdAt:       string
}

interface Props {
  teams:  Team[]
  tiers:  { id: number; name: string; displayName: string }[]
  levels: { id: number; name: string; displayName: string }[]
}

// ─── Inline style helpers ─────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: 'var(--color-card-bg)',
  border:          '1px solid var(--color-card-border)',
  borderRadius:    12,
  padding:         24,
  marginBottom:    16,
}

const label: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, display: 'block',
}

const input: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 12px',
  border: '1.5px solid var(--color-card-border)', borderRadius: 8,
  fontSize: 14, color: 'var(--color-text-primary)', backgroundColor: 'var(--color-card-bg)',
  outline: 'none',
}

const select: React.CSSProperties = { ...input }

function Btn({ label: lbl, onClick, variant = 'primary', disabled, small }: {
  label: string; onClick: () => void; variant?: 'primary' | 'danger' | 'ghost'
  disabled?: boolean; small?: boolean
}) {
  const bg = variant === 'primary' ? 'var(--color-primary)' : variant === 'danger' ? '#ef4444' : 'transparent'
  const color = variant === 'ghost' ? 'var(--color-text-secondary)' : '#fff'
  const border = variant === 'ghost' ? '1.5px solid var(--color-card-border)' : 'none'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding:         small ? '6px 12px' : '9px 18px',
        borderRadius:    8,
        border,
        backgroundColor: bg,
        color,
        fontSize:        small ? 12 : 13,
        fontWeight:      600,
        cursor:          disabled ? 'default' : 'pointer',
        opacity:         disabled ? 0.6 : 1,
        transition:      'opacity 0.15s',
      }}
    >{lbl}</button>
  )
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────

function EditDrawer({ team, tiers, levels, onClose, onSaved }: {
  team:    Team
  tiers:   Props['tiers']
  levels:  Props['levels']
  onClose: () => void
  onSaved: (updated: Partial<Team>) => void
}) {
  const [name,    setName]    = useState(team.name)
  const [tierId,  setTierId]  = useState(team.tierId)
  const [levelId, setLevelId] = useState(team.levelId)
  const [appDb,   setAppDb]   = useState(team.appDb)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/internal/teams/${team.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), tierId, levelId, appDb: appDb.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to save'); return }
      const tier  = tiers.find(t => t.id === tierId)!
      const level = levels.find(l => l.id === levelId)!
      onSaved({ name: name.trim(), tierId, tier: tier.name, tierDisplayName: tier.displayName, levelId, level: level.name, levelDisplayName: level.displayName, appDb: appDb.trim() })
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    }} onClick={onClose}>
      <div style={{
        width: 420, height: '100%', backgroundColor: 'var(--color-card-bg)',
        borderLeft: '1px solid var(--color-card-border)',
        padding: 32, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 20,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Edit Team</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-secondary)' }}>×</button>
        </div>

        <div>
          <span style={label}>Team Name</span>
          <input style={input} value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div>
          <span style={label}>App Database</span>
          <input style={input} value={appDb} onChange={e => setAppDb(e.target.value)} placeholder="DevLegacyLinkApp_TeamName" />
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>Name of the tenant App DB on the SQL server.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <span style={label}>Tier</span>
            <select style={select} value={tierId} onChange={e => setTierId(Number(e.target.value))}>
              {tiers.map(t => <option key={t.id} value={t.id}>{t.displayName}</option>)}
            </select>
          </div>
          <div>
            <span style={label}>Level</span>
            <select style={select} value={levelId} onChange={e => setLevelId(Number(e.target.value))}>
              {levels.map(l => <option key={l.id} value={l.id}>{l.displayName}</option>)}
            </select>
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <Btn label={saving ? 'Saving…' : 'Save changes'} onClick={handleSave} disabled={saving} />
          <Btn label="Cancel" onClick={onClose} variant="ghost" />
        </div>
      </div>
    </div>
  )
}

// ─── New Team Form ────────────────────────────────────────────────────────────

function NewTeamForm({ tiers, levels, onCreated, onCancel }: {
  tiers:     Props['tiers']
  levels:    Props['levels']
  onCreated: (team: Team) => void
  onCancel:  () => void
}) {
  const [name,    setName]    = useState('')
  const [appDb,   setAppDb]   = useState('')
  const [tierId,  setTierId]  = useState(1)
  const [levelId, setLevelId] = useState(1)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const handleCreate = async () => {
    if (!name.trim() || !appDb.trim()) { setError('Name and App DB are required.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/internal/teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), appDb: appDb.trim(), tierId, levelId }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to create'); return }
      const tier  = tiers.find(t => t.id === tierId)!
      const level = levels.find(l => l.id === levelId)!
      onCreated({
        id: json.data.teamId, name: name.trim(), appDb: appDb.trim(),
        tierId, tier: tier.name, tierDisplayName: tier.displayName,
        levelId, level: level.name, levelDisplayName: level.displayName,
        isActive: true, createdAt: new Date().toISOString(),
      })
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ ...card, border: '1.5px solid var(--color-primary)' }}>
      <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 700 }}>New Client</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <span style={label}>Team / Program Name</span>
            <input style={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. USF Bulls" />
          </div>
          <div>
            <span style={label}>App Database Name</span>
            <input style={input} value={appDb} onChange={e => setAppDb(e.target.value)} placeholder="DevLegacyLinkApp_USF" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <span style={label}>Tier</span>
            <select style={select} value={tierId} onChange={e => setTierId(Number(e.target.value))}>
              {tiers.map(t => <option key={t.id} value={t.id}>{t.displayName}</option>)}
            </select>
          </div>
          <div>
            <span style={label}>Level</span>
            <select style={select} value={levelId} onChange={e => setLevelId(Number(e.target.value))}>
              {levels.map(l => <option key={l.id} value={l.id}>{l.displayName}</option>)}
            </select>
          </div>
        </div>
      </div>
      {error && <p style={{ fontSize: 13, color: '#ef4444', margin: '12px 0 0' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <Btn label={saving ? 'Creating…' : 'Create client'} onClick={handleCreate} disabled={saving} />
        <Btn label="Cancel" onClick={onCancel} variant="ghost" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeamManagementTool({ teams: initialTeams, tiers, levels }: Props) {
  const [teams,     setTeams]     = useState<Team[]>(initialTeams)
  const [editing,   setEditing]   = useState<Team | null>(null)
  const [showNew,   setShowNew]   = useState(false)
  const [toggling,  setToggling]  = useState<number | null>(null)

  const handleToggleActive = async (team: Team) => {
    setToggling(team.id)
    try {
      const res = await fetch(`/api/internal/teams/${team.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive: !team.isActive }),
      })
      if (res.ok) {
        setTeams(prev => prev.map(t => t.id === team.id ? { ...t, isActive: !team.isActive } : t))
      }
    } finally {
      setToggling(null)
    }
  }

  const handleSaved = (teamId: number, updates: Partial<Team>) => {
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, ...updates } : t))
    setEditing(null)
  }

  const handleCreated = (team: Team) => {
    setTeams(prev => [team, ...prev])
    setShowNew(false)
  }

  const active   = teams.filter(t => t.isActive)
  const inactive = teams.filter(t => !t.isActive)

  return (
    <>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          {active.length} active · {inactive.length} inactive
        </p>
        {!showNew && (
          <Btn label="+ New Client" onClick={() => setShowNew(true)} />
        )}
      </div>

      {/* New team form */}
      {showNew && (
        <NewTeamForm
          tiers={tiers}
          levels={levels}
          onCreated={handleCreated}
          onCancel={() => setShowNew(false)}
        />
      )}

      {/* Team list */}
      {teams.length === 0 && (
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', textAlign: 'center', padding: '40px 0' }}>No teams yet.</p>
      )}

      {[...active, ...inactive].map(team => (
        <div key={team.id} style={{
          ...card,
          marginBottom: 8,
          opacity: team.isActive ? 1 : 0.6,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>{team.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                backgroundColor: team.isActive ? 'var(--color-success-light, #dcfce7)' : 'var(--color-card-border)',
                color: team.isActive ? '#166534' : 'var(--color-text-secondary)',
              }}>
                {team.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>DB: <strong style={{ color: 'var(--color-text-primary)' }}>{team.appDb}</strong></span>
              <span>Tier: <strong style={{ color: 'var(--color-text-primary)' }}>{team.tierDisplayName}</strong></span>
              <span>Level: <strong style={{ color: 'var(--color-text-primary)' }}>{team.levelDisplayName}</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <Btn label="Edit" onClick={() => setEditing(team)} variant="ghost" small />
            <Btn
              label={toggling === team.id ? '…' : team.isActive ? 'Deactivate' : 'Activate'}
              onClick={() => handleToggleActive(team)}
              variant={team.isActive ? 'danger' : 'primary'}
              disabled={toggling === team.id}
              small
            />
          </div>
        </div>
      ))}

      {/* Edit drawer */}
      {editing && (
        <EditDrawer
          team={editing}
          tiers={tiers}
          levels={levels}
          onClose={() => setEditing(null)}
          onSaved={(updates) => handleSaved(editing.id, updates)}
        />
      )}
    </>
  )
}
