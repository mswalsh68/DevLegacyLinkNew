'use client'

import { useState } from 'react'
import { theme } from '@/lib/theme'

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

// ─── Shared sub-components ────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
      {children}
    </label>
  )
}

function TextInput({ value, onChange, placeholder, disabled }: {
  value: string; onChange: (v: string) => void
  placeholder?: string; disabled?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        border:          `1.5px solid ${theme.gray200}`,
        borderRadius:    'var(--radius-sm)',
        padding:         '8px 12px',
        fontSize:        13,
        color:           theme.gray900,
        backgroundColor: 'var(--color-card-bg)',
        outline:         'none',
        width:           '100%',
        boxSizing:       'border-box',
        opacity:         disabled ? 0.6 : 1,
      }}
      onFocus={e  => { if (!disabled) e.target.style.borderColor = theme.primary }}
      onBlur={e   => { e.target.style.borderColor = theme.gray200 }}
    />
  )
}

function SelectInput({ value, onChange, options }: {
  value: number; onChange: (v: number) => void
  options: { id: number; displayName: string }[]
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        border:          `1.5px solid ${theme.gray200}`,
        borderRadius:    'var(--radius-sm)',
        padding:         '8px 12px',
        fontSize:        13,
        color:           theme.gray900,
        backgroundColor: 'var(--color-card-bg)',
        outline:         'none',
        width:           '100%',
        boxSizing:       'border-box',
      }}
      onFocus={e => { e.target.style.borderColor = theme.primary }}
      onBlur={e  => { e.target.style.borderColor = theme.gray200 }}
    >
      {options.map(o => <option key={o.id} value={o.id}>{o.displayName}</option>)}
    </select>
  )
}

function Btn({ label, onClick, disabled, variant = 'primary', small }: {
  label: string; onClick: () => void
  variant?: 'primary' | 'danger' | 'ghost'
  disabled?: boolean; small?: boolean
}) {
  const styles: React.CSSProperties = {
    padding:         small ? '6px 12px' : '9px 18px',
    borderRadius:    'var(--radius-sm)',
    fontSize:        small ? 12 : 13,
    fontWeight:      600,
    cursor:          disabled ? 'not-allowed' : 'pointer',
    opacity:         disabled ? 0.55 : 1,
    transition:      'opacity 0.15s',
    ...(variant === 'primary' && {
      border:          'none',
      backgroundColor: theme.primary,
      color:           '#fff',
    }),
    ...(variant === 'danger' && {
      border:          `1.5px solid ${theme.danger}`,
      backgroundColor: 'transparent',
      color:           theme.danger,
    }),
    ...(variant === 'ghost' && {
      border:          `1.5px solid ${theme.gray200}`,
      backgroundColor: 'transparent',
      color:           theme.gray600,
    }),
  }
  return <button onClick={onClick} disabled={disabled} style={styles}>{label}</button>
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children, highlighted }: { children: React.ReactNode; highlighted?: boolean }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-card-bg)',
      border:          highlighted ? `1.5px solid ${theme.primary}` : `1px solid var(--color-card-border)`,
      borderRadius:    'var(--radius-lg)',
      boxShadow:       'var(--shadow-sm)',
      overflow:        'hidden',
      marginBottom:    12,
    }}>
      {children}
    </div>
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
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.35)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 440, height: '100%',
          backgroundColor: 'var(--color-card-bg)',
          borderLeft: `1px solid var(--color-card-border)`,
          boxShadow: 'var(--shadow-lg)',
          padding: 32, overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, borderBottom: `1px solid var(--color-card-border)` }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.gray900 }}>Edit Team</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: theme.gray400, lineHeight: 1 }}
          >×</button>
        </div>

        <div>
          <FieldLabel>Team Name</FieldLabel>
          <TextInput value={name} onChange={setName} />
        </div>

        <div>
          <FieldLabel>App Database</FieldLabel>
          <TextInput value={appDb} onChange={setAppDb} placeholder="DevLegacyLinkApp_TeamName" />
          <p style={{ fontSize: 12, color: theme.gray500, margin: '4px 0 0' }}>Name of the tenant App DB on the SQL server.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <FieldLabel>Tier</FieldLabel>
            <SelectInput value={tierId} onChange={setTierId} options={tiers} />
          </div>
          <div>
            <FieldLabel>Level</FieldLabel>
            <SelectInput value={levelId} onChange={setLevelId} options={levels} />
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: theme.danger, margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
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
  const [abbr,    setAbbr]    = useState('')
  const [appDb,   setAppDb]   = useState('')
  const [tierId,  setTierId]  = useState(tiers[0]?.id ?? 1)
  const [levelId, setLevelId] = useState(levels[0]?.id ?? 1)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  const handleNameChange = (v: string) => {
    setName(v)
    setAbbr(v.trim().split(/\s+/).map(w => w[0] ?? '').join('').toUpperCase().slice(0, 5))
  }

  const handleCreate = async () => {
    if (!name.trim() || !appDb.trim()) { setError('Name and App DB are required.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/internal/teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), abbr: abbr.trim(), appDb: appDb.trim(), tierId, levelId }),
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
    <Card highlighted>
      {/* Card header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid var(--color-card-border)` }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: theme.gray900 }}>New Client</h3>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: theme.gray500 }}>Provision a new team on the platform.</p>
      </div>

      {/* Card body */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16 }}>
          <div>
            <FieldLabel>Team / Program Name</FieldLabel>
            <TextInput value={name} onChange={handleNameChange} placeholder="e.g. Legacy Link" />
          </div>
          <div style={{ width: 96 }}>
            <FieldLabel>Abbreviation</FieldLabel>
            <TextInput value={abbr} onChange={v => setAbbr(v.toUpperCase().slice(0, 5))} placeholder="LL" />
          </div>
          <div>
            <FieldLabel>App Database Name</FieldLabel>
            <TextInput value={appDb} onChange={setAppDb} placeholder="LegacyLinkApp" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <FieldLabel>Tier</FieldLabel>
            <SelectInput value={tierId} onChange={setTierId} options={tiers} />
          </div>
          <div>
            <FieldLabel>Level</FieldLabel>
            <SelectInput value={levelId} onChange={setLevelId} options={levels} />
          </div>
        </div>

        {error && <p style={{ fontSize: 13, color: theme.danger, margin: 0 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn label={saving ? 'Creating…' : 'Create client'} onClick={handleCreate} disabled={saving} />
          <Btn label="Cancel" onClick={onCancel} variant="ghost" />
        </div>
      </div>
    </Card>
  )
}

// ─── Team Row ─────────────────────────────────────────────────────────────────

function TeamRow({ team, toggling, onEdit, onToggle }: {
  team:      Team
  toggling:  boolean
  onEdit:    () => void
  onToggle:  () => void
}) {
  return (
    <Card>
      <div style={{
        padding:        '16px 24px',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            16,
        opacity:        team.isActive ? 1 : 0.55,
      }}>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: theme.gray900 }}>{team.name}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)',
              backgroundColor: team.isActive ? 'var(--color-success-light)' : 'var(--color-gray-100)',
              color:           team.isActive ? 'var(--color-success)'       : theme.gray500,
            }}>
              {team.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: theme.gray500, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>DB: <strong style={{ color: theme.gray700 }}>{team.appDb}</strong></span>
            <span>Tier: <strong style={{ color: theme.gray700 }}>{team.tierDisplayName}</strong></span>
            <span>Level: <strong style={{ color: theme.gray700 }}>{team.levelDisplayName}</strong></span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Btn label="Edit" onClick={onEdit} variant="ghost" small />
          <Btn
            label={toggling ? '…' : team.isActive ? 'Deactivate' : 'Activate'}
            onClick={onToggle}
            variant={team.isActive ? 'danger' : 'primary'}
            disabled={toggling}
            small
          />
        </div>
      </div>
    </Card>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeamManagementTool({ teams: initialTeams, tiers, levels }: Props) {
  const [teams,    setTeams]    = useState<Team[]>(initialTeams)
  const [editing,  setEditing]  = useState<Team | null>(null)
  const [showNew,  setShowNew]  = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

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
        <span style={{ fontSize: 13, color: theme.gray500 }}>
          {active.length} active · {inactive.length} inactive
        </span>
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
        <p style={{ fontSize: 14, color: theme.gray500, textAlign: 'center', padding: '40px 0' }}>No teams yet.</p>
      )}

      {[...active, ...inactive].map(team => (
        <TeamRow
          key={team.id}
          team={team}
          toggling={toggling === team.id}
          onEdit={() => setEditing(team)}
          onToggle={() => handleToggleActive(team)}
        />
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
