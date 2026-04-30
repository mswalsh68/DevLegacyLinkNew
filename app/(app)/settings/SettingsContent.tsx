'use client'

// Team Settings — loaded from GET /api/config, saved via PATCH /api/config.
// Sports Setup and Positions sections save live (one API call per action).

import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { triggerThemeRefresh } from '@/providers/ThemeProvider'
import { theme } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SportRow {
  id:       number
  name:     string
  abbr:     string
  isActive: boolean
}

interface PositionRow {
  positionId:   number
  sportId:      number
  sportName:    string
  positionName: string
  positionAbbr: string | null
  isActive:     boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_OPTIONS = [
  { value: 'college',     label: 'College / University' },
  { value: 'high_school', label: 'High School'          },
  { value: 'club',        label: 'Club / Amateur'       },
]

const DEFAULT_ACADEMIC_YEARS: Record<string, string[]> = {
  college:     ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
  high_school: ['9th Grade', '10th Grade', '11th Grade', '12th Grade'],
  club:        ['Year 1', 'Year 2', 'Year 3', 'Year 4'],
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function CollapsibleCard({
  title, subtitle, defaultOpen = true, children, headerRight,
}: {
  title: string; subtitle?: string; defaultOpen?: boolean
  children: React.ReactNode; headerRight?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div style={{
      backgroundColor: 'var(--color-card-bg)',
      border:          '1px solid var(--color-card-border)',
      borderRadius:    'var(--radius-lg)',
      boxShadow:       'var(--shadow-sm)',
      overflow:        'hidden',
    }}>
      {/* Clickable header row */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '16px 24px',
          cursor:         'pointer',
          userSelect:     'none',
          borderBottom:   open ? '1px solid var(--color-card-border)' : 'none',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 12, fontWeight: 700, color: 'var(--color-primary)',
              textTransform: 'uppercase', letterSpacing: '0.8px',
            }}>
              {title}
            </span>
            <span style={{
              fontSize: 11, color: 'var(--color-gray-400)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              display: 'inline-block',
            }}>
              ▾
            </span>
          </div>
          {subtitle && !open && (
            <p style={{ fontSize: 12, color: 'var(--color-gray-400)', margin: '2px 0 0', fontStyle: 'italic' }}>
              {subtitle}
            </p>
          )}
        </div>
        {/* Stop propagation so buttons in headerRight don't toggle collapse */}
        {headerRight && open && (
          <div onClick={e => e.stopPropagation()}>
            {headerRight}
          </div>
        )}
      </div>

      {/* Collapsible body */}
      {open && (
        <div style={{ padding: 24 }}>
          {subtitle && (
            <p style={{ fontSize: 13, color: 'var(--color-gray-500)', marginTop: 0, marginBottom: 16 }}>
              {subtitle}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{
        fontSize: 12, fontWeight: 700, color: theme.primary,
        textTransform: 'uppercase', letterSpacing: '0.8px',
        margin: 0, paddingBottom: 8, borderBottom: `2px solid ${theme.primaryLight}`,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: theme.gray500, marginTop: 6, marginBottom: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: theme.gray700, display: 'block', marginBottom: 6 }}>
      {children}
    </label>
  )
}

function TextInput({
  label, value, onChange, placeholder, helper, required, disabled,
}: {
  label?: string; value: string; onChange: (v: string) => void
  placeholder?: string; helper?: string; required?: boolean; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && (
        <FieldLabel>
          {label}
          {required && <span style={{ color: theme.danger }}> *</span>}
        </FieldLabel>
      )}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        style={{
          border: `1.5px solid ${theme.gray200}`, borderRadius: 'var(--radius-sm)',
          padding: '8px 12px', fontSize: 13, color: theme.gray900,
          outline: 'none', width: '100%', boxSizing: 'border-box',
          opacity: disabled ? 0.6 : 1,
        }}
        onFocus={e  => { if (!disabled) e.target.style.borderColor = theme.primary }}
        onBlur={e   => (e.target.style.borderColor = theme.gray200)}
      />
      {helper && <p style={{ fontSize: 11, color: theme.gray400, margin: 0 }}>{helper}</p>}
    </div>
  )
}

function SelectInput({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          border: `1.5px solid ${theme.gray200}`, borderRadius: 'var(--radius-sm)',
          padding: '8px 12px', fontSize: 13, color: theme.gray900,
          outline: 'none', background: 'var(--color-card-bg)',
          width: '100%', boxSizing: 'border-box',
        }}
        onFocus={e => (e.target.style.borderColor = theme.primary)}
        onBlur={e  => (e.target.style.borderColor = theme.gray200)}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 40, height: 36, border: `1px solid ${theme.gray200}`, borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }}
        />
        <input
          type="text" value={value} onChange={e => onChange(e.target.value)} maxLength={7}
          style={{
            flex: 1, border: `1.5px solid ${theme.gray200}`, borderRadius: 'var(--radius-sm)',
            padding: '8px 12px', fontSize: 13, fontFamily: 'monospace', color: theme.gray900, outline: 'none',
          }}
          onFocus={e => (e.target.style.borderColor = theme.primary)}
          onBlur={e  => (e.target.style.borderColor = theme.gray200)}
        />
        <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: value, border: `1px solid ${theme.gray200}`, flexShrink: 0 }} />
      </div>
    </div>
  )
}

// ─── Sports Setup section ─────────────────────────────────────────────────────

function SportsSetupSection() {
  const [sports,     setSports]     = useState<SportRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [toggling,   setToggling]   = useState<number | null>(null)
  const [adding,     setAdding]     = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newAbbr,    setNewAbbr]    = useState('')
  const [addError,   setAddError]   = useState('')

  const load = useCallback(async () => {
    try {
      const res  = await fetch('/api/settings/sports', { credentials: 'include' })
      const json = await res.json()
      if (json.data) setSports(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = async (sport: SportRow) => {
    setToggling(sport.id)
    try {
      await fetch(`/api/settings/sports/${sport.id}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ isActive: !sport.isActive }),
      })
      setSports(prev => prev.map(s => s.id === sport.id ? { ...s, isActive: !s.isActive } : s))
    } finally {
      setToggling(null)
    }
  }

  const addSport = async () => {
    setAddError('')
    if (!newName.trim() || !newAbbr.trim()) {
      setAddError('Name and abbreviation are required.')
      return
    }
    setAdding(true)
    try {
      const res  = await fetch('/api/settings/sports', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ name: newName.trim(), abbr: newAbbr.trim().toUpperCase(), isActive: true }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error ?? 'Failed to add sport.'); return }
      setNewName(''); setNewAbbr(''); setShowAdd(false)
      await load()
    } finally {
      setAdding(false)
    }
  }

  return (
    <CollapsibleCard
      title="Sports Setup"
      subtitle="Toggle sports active to include them in roster and alumni tracking. Add a sport if yours isn't listed."
      defaultOpen={false}
      headerRight={
        <button
          type="button"
          onClick={() => { setShowAdd(v => !v); setAddError('') }}
          style={{
            background: showAdd ? theme.primary : 'transparent',
            border: `1px solid ${showAdd ? theme.primary : 'var(--color-card-border)'}`,
            borderRadius: 'var(--radius-sm)', padding: '5px 12px',
            fontSize: 12, fontWeight: 500,
            color: showAdd ? '#fff' : 'var(--color-gray-600)',
            cursor: 'pointer',
          }}
        >
          {showAdd ? '✕ Cancel' : '+ Add Sport'}
        </button>
      }
    >

      {showAdd && (
        <div style={{
          background: 'var(--color-primary-light)', borderRadius: 'var(--radius-sm)',
          padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <TextInput label="Sport Name" value={newName} onChange={setNewName} placeholder="e.g. Men's Lacrosse" />
          </div>
          <div style={{ flex: 1, minWidth: 80 }}>
            <TextInput label="Abbreviation" value={newAbbr} onChange={v => setNewAbbr(v.toUpperCase())} placeholder="e.g. MLAX" />
          </div>
          <button
            type="button"
            onClick={addSport}
            disabled={adding}
            style={{
              backgroundColor: theme.primary, color: '#fff', border: 'none',
              borderRadius: 'var(--radius-sm)', padding: '8px 20px',
              fontSize: 13, fontWeight: 600, cursor: adding ? 'wait' : 'pointer',
            }}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
          {addError && <p style={{ fontSize: 12, color: theme.danger, margin: 0, width: '100%' }}>{addError}</p>}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-gray-400)', fontSize: 13 }}>Loading sports…</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {sports.map(sport => (
            <button
              key={sport.id}
              type="button"
              onClick={() => toggle(sport)}
              disabled={toggling === sport.id}
              title={sport.isActive ? 'Click to deactivate' : 'Click to activate'}
              style={{
                display:      'flex',
                alignItems:   'center',
                gap:          8,
                padding:      '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize:     13,
                fontWeight:   600,
                cursor:       toggling === sport.id ? 'wait' : 'pointer',
                border:       `2px solid ${sport.isActive ? theme.primary : theme.gray200}`,
                background:   sport.isActive ? theme.primaryLight : 'transparent',
                color:        sport.isActive ? theme.primary : theme.gray500,
                transition:   'all 0.15s',
                opacity:      toggling === sport.id ? 0.6 : 1,
              }}
            >
              {/* Toggle dot */}
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                backgroundColor: sport.isActive ? theme.primary : theme.gray300,
                flexShrink: 0,
              }} />
              {sport.name}
              <span style={{ fontSize: 11, opacity: 0.7 }}>({sport.abbr})</span>
            </button>
          ))}
        </div>
      )}
    </CollapsibleCard>
  )
}

// ─── Positions section ────────────────────────────────────────────────────────

function PositionsSection() {
  const [allPositions,  setAllPositions]  = useState<PositionRow[]>([])
  const [allSports,     setAllSports]     = useState<SportRow[]>([])
  const [loading,       setLoading]       = useState(true)
  const [activeSportId, setActiveSportId] = useState<number | null>(null)

  // Per-position edit state
  const [editing,    setEditing]    = useState<number | null>(null)
  const [editName,   setEditName]   = useState('')
  const [editAbbr,   setEditAbbr]   = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Add position state
  const [showAdd,    setShowAdd]    = useState(false)
  const [addName,    setAddName]    = useState('')
  const [addAbbr,    setAddAbbr]    = useState('')
  const [adding,     setAdding]     = useState(false)
  const [addError,   setAddError]   = useState('')
  const [deleting,   setDeleting]   = useState<number | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, pRes] = await Promise.all([
        fetch('/api/settings/sports',    { credentials: 'include' }),
        fetch('/api/settings/positions', { credentials: 'include' }),
      ])
      const [sJson, pJson] = await Promise.all([sRes.json(), pRes.json()])
      const sports: SportRow[]     = sJson.data ?? []
      const positions: PositionRow[] = pJson.data ?? []
      setAllSports(sports)
      setAllPositions(positions)
      // Default to first active sport
      if (!activeSportId) {
        const first = sports.find(s => s.isActive)
        if (first) setActiveSportId(first.id)
      }
    } finally {
      setLoading(false)
    }
  }, [activeSportId])

  useEffect(() => { loadAll() }, [loadAll])

  const activeSports    = allSports.filter(s => s.isActive)
  const visiblePositions = allPositions.filter(p => p.sportId === activeSportId)

  const startEdit = (pos: PositionRow) => {
    setEditing(pos.positionId)
    setEditName(pos.positionName)
    setEditAbbr(pos.positionAbbr ?? '')
  }

  const saveEdit = async (positionId: number) => {
    setEditSaving(true)
    try {
      await fetch(`/api/settings/positions/${positionId}`, {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ positionName: editName.trim(), abbreviation: editAbbr.trim().toUpperCase() }),
      })
      setAllPositions(prev => prev.map(p =>
        p.positionId === positionId
          ? { ...p, positionName: editName.trim(), positionAbbr: editAbbr.trim().toUpperCase() }
          : p,
      ))
      setEditing(null)
    } finally {
      setEditSaving(false)
    }
  }

  const deletePosition = async (positionId: number) => {
    if (!confirm('Remove this position? This cannot be undone.')) return
    setDeleting(positionId)
    try {
      await fetch(`/api/settings/positions/${positionId}`, {
        method: 'DELETE', credentials: 'include',
      })
      setAllPositions(prev => prev.filter(p => p.positionId !== positionId))
    } finally {
      setDeleting(null)
    }
  }

  const addPosition = async () => {
    setAddError('')
    if (!addName.trim() || !addAbbr.trim()) {
      setAddError('Position name and abbreviation are required.')
      return
    }
    if (!activeSportId) return
    setAdding(true)
    try {
      const res  = await fetch('/api/settings/positions', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ sportId: activeSportId, positionName: addName.trim(), abbreviation: addAbbr.trim().toUpperCase() }),
      })
      const json = await res.json()
      if (!res.ok) { setAddError(json.error ?? 'Failed to add position.'); return }
      setAddName(''); setAddAbbr(''); setShowAdd(false)
      // Add optimistically
      const sport = allSports.find(s => s.id === activeSportId)
      if (sport) {
        setAllPositions(prev => [...prev, {
          positionId:   json.data.positionId,
          sportId:      activeSportId,
          sportName:    sport.name,
          positionName: addName.trim(),
          positionAbbr: addAbbr.trim().toUpperCase(),
          isActive:     true,
        }])
      }
    } finally {
      setAdding(false)
    }
  }

  const tabBtn = (sport: SportRow) => ({
    padding:      '5px 14px',
    borderRadius: 'var(--radius-full)',
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
    border:       `1.5px solid ${activeSportId === sport.id ? theme.primary : theme.gray200}`,
    background:   activeSportId === sport.id ? theme.primary : 'transparent',
    color:        activeSportId === sport.id ? '#fff' : theme.gray600,
    transition:   'all 0.12s',
  } as React.CSSProperties)

  return (
    <CollapsibleCard
      title="Positions"
      subtitle="Configure positions per sport. Edits apply immediately."
      defaultOpen={false}
      headerRight={activeSportId ? (
        <button
          type="button"
          onClick={() => { setShowAdd(v => !v); setAddError('') }}
          style={{
            background: showAdd ? theme.primary : 'transparent',
            border: `1px solid ${showAdd ? theme.primary : 'var(--color-card-border)'}`,
            borderRadius: 'var(--radius-sm)', padding: '5px 12px',
            fontSize: 12, fontWeight: 500,
            color: showAdd ? '#fff' : 'var(--color-gray-600)',
            cursor: 'pointer',
          }}
        >
          {showAdd ? '✕ Cancel' : '+ Add Position'}
        </button>
      ) : undefined}
    >

      {loading ? (
        <p style={{ color: 'var(--color-gray-400)', fontSize: 13 }}>Loading positions…</p>
      ) : activeSports.length === 0 ? (
        <p style={{ color: 'var(--color-gray-400)', fontSize: 13 }}>
          No active sports. Activate at least one sport in the Sports Setup section above.
        </p>
      ) : (
        <>
          {/* Sport tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {activeSports.map(sport => (
              <button
                key={sport.id}
                type="button"
                onClick={() => { setActiveSportId(sport.id); setShowAdd(false); setEditing(null) }}
                style={tabBtn(sport)}
              >
                {sport.name}
              </button>
            ))}
          </div>

          {/* Add position form */}
          {showAdd && (
            <div style={{
              background: 'var(--color-primary-light)', borderRadius: 'var(--radius-sm)',
              padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap',
            }}>
              <div style={{ flex: 2, minWidth: 160 }}>
                <TextInput label="Position Name" value={addName} onChange={setAddName} placeholder="e.g. Quarterback" />
              </div>
              <div style={{ flex: 1, minWidth: 80 }}>
                <TextInput label="Abbreviation" value={addAbbr} onChange={v => setAddAbbr(v.toUpperCase())} placeholder="e.g. QB" />
              </div>
              <button
                type="button"
                onClick={addPosition}
                disabled={adding}
                style={{
                  backgroundColor: theme.primary, color: '#fff', border: 'none',
                  borderRadius: 'var(--radius-sm)', padding: '8px 20px',
                  fontSize: 13, fontWeight: 600, cursor: adding ? 'wait' : 'pointer',
                }}
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
              {addError && <p style={{ fontSize: 12, color: theme.danger, margin: 0, width: '100%' }}>{addError}</p>}
            </div>
          )}

          {/* Positions list */}
          {visiblePositions.length === 0 ? (
            <p style={{ color: 'var(--color-gray-400)', fontSize: 13 }}>
              No positions defined for this sport yet. Use &quot;+ Add Position&quot; to add one.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visiblePositions.map(pos => (
                <div key={pos.positionId} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${editing === pos.positionId ? theme.primary : theme.gray200}`,
                  background: editing === pos.positionId ? theme.primaryLight : 'transparent',
                }}>
                  {editing === pos.positionId ? (
                    <>
                      <input
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        style={{
                          flex: 2, border: `1.5px solid ${theme.primary}`, borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px', fontSize: 13, outline: 'none',
                        }}
                        placeholder="Position name"
                      />
                      <input
                        value={editAbbr}
                        onChange={e => setEditAbbr(e.target.value.toUpperCase())}
                        style={{
                          width: 70, border: `1.5px solid ${theme.primary}`, borderRadius: 'var(--radius-sm)',
                          padding: '4px 8px', fontSize: 13, fontWeight: 700, outline: 'none', textAlign: 'center',
                        }}
                        placeholder="ABBR"
                        maxLength={10}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(pos.positionId)}
                        disabled={editSaving}
                        style={{ padding: '4px 14px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: 'none', background: theme.primary, color: '#fff', cursor: 'pointer' }}
                      >
                        {editSaving ? '…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        style={{ padding: '4px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', border: `1px solid ${theme.gray200}`, background: 'transparent', color: theme.gray600, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{
                        minWidth: 52, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        fontSize: 12, fontWeight: 700, textAlign: 'center',
                        background: theme.primaryLight, color: theme.primary,
                      }}>
                        {pos.positionAbbr ?? '—'}
                      </span>
                      <span style={{ flex: 1, fontSize: 13, color: theme.gray900 }}>{pos.positionName}</span>
                      <button
                        type="button"
                        onClick={() => startEdit(pos)}
                        style={{ padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius-sm)', border: `1px solid ${theme.gray200}`, background: 'transparent', color: theme.gray600, cursor: 'pointer' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePosition(pos.positionId)}
                        disabled={deleting === pos.positionId}
                        style={{ padding: '3px 10px', fontSize: 11, borderRadius: 'var(--radius-sm)', border: `1px solid ${theme.danger}`, background: 'transparent', color: theme.danger, cursor: 'pointer' }}
                      >
                        {deleting === pos.positionId ? '…' : 'Remove'}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </CollapsibleCard>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SettingsContent() {
  const router = useRouter()

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  const [form, setForm] = useState({
    teamName:          '',
    teamAbbr:          '',
    level:             'college',
    logoUrl:           '',
    colorPrimary:      '#006747',
    colorPrimaryDark:  '#005432',
    colorPrimaryLight: '#E0F0EA',
    colorAccent:       '#CFC493',
    colorAccentDark:   '#A89C6A',
    colorAccentLight:  '#EDEBD1',
    academicYearsText: '',
    alumniLabel:       'Alumni',
    rosterLabel:       'Roster',
    classLabel:        'Recruiting Class',
  })

  useEffect(() => { fetchConfig() }, [])

  const fetchConfig = async () => {
    try {
      const res  = await fetch('/api/config', { credentials: 'include' })
      const json = await res.json()
      const c    = json.data ?? {}
      setForm(prev => ({
        ...prev,
        teamName:          c.teamName          ?? c.name          ?? '',
        teamAbbr:          c.teamAbbr          ?? c.abbr          ?? '',
        level:             c.level             ?? 'college',
        logoUrl:           c.logoUrl           ?? '',
        colorPrimary:      c.colorPrimary      ?? c.primaryColor  ?? '#006747',
        colorPrimaryDark:  c.colorPrimaryDark  ?? '#005432',
        colorPrimaryLight: c.colorPrimaryLight ?? '#E0F0EA',
        colorAccent:       c.colorAccent       ?? c.accentColor   ?? '#CFC493',
        colorAccentDark:   c.colorAccentDark   ?? '#A89C6A',
        colorAccentLight:  c.colorAccentLight  ?? '#EDEBD1',
        academicYearsText: Array.isArray(c.academicYears) ? c.academicYears.join(', ') : '',
        alumniLabel:       c.alumniLabel       ?? 'Alumni',
        rosterLabel:       c.rosterLabel       ?? 'Roster',
        classLabel:        c.classLabel        ?? 'Recruiting Class',
      }))

    } catch {
      setError('Failed to load team settings.')
    } finally {
      setLoading(false)
    }
  }

  const applyDefaultAcademicYears = () => {
    const defaults = DEFAULT_ACADEMIC_YEARS[form.level] ?? []
    setForm(p => ({ ...p, academicYearsText: defaults.join(', ') }))
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const academicYears = form.academicYearsText.split(',').map(y => y.trim()).filter(Boolean)
    if (academicYears.length === 0) {
      setError('At least one academic year is required.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        teamName:          form.teamName,
        teamAbbr:          form.teamAbbr,
        level:             form.level,
        logoUrl:           form.logoUrl || '',
        colorPrimary:      form.colorPrimary,
        colorPrimaryDark:  form.colorPrimaryDark,
        colorPrimaryLight: form.colorPrimaryLight,
        colorAccent:       form.colorAccent,
        colorAccentDark:   form.colorAccentDark,
        colorAccentLight:  form.colorAccentLight,
        academicYears,
        alumniLabel:       form.alumniLabel,
        rosterLabel:       form.rosterLabel,
        classLabel:        form.classLabel,
      }

      const res  = await fetch('/api/config', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to save settings.'); return }

      try { sessionStorage.removeItem('dll_team_config') } catch { /* ignore */ }
      triggerThemeRefresh({
        primaryColor:   form.colorPrimary,
        accentColor:    form.colorAccent,
        secondaryColor: form.colorAccent,
      })
      setSuccess('Team settings saved successfully.')
    } catch {
      setError('Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: keyof typeof form) => (val: string) =>
    setForm(p => ({ ...p, [key]: val }))

  return (
    <>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>
            Team Settings
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-gray-500)', marginTop: 4, marginBottom: 0 }}>
            Configure your portal identity, colors, sports, positions, and terminology
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            background: 'transparent', border: `1px solid var(--color-card-border)`,
            borderRadius: 'var(--radius-sm)', padding: '7px 14px',
            fontSize: 13, fontWeight: 500, color: 'var(--color-gray-600)', cursor: 'pointer',
          }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Alert banners */}
      {error && (
        <div style={{ backgroundColor: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--color-danger)' }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-danger)', lineHeight: 1 }}>✕</button>
        </div>
      )}
      {success && (
        <div style={{ backgroundColor: 'var(--color-success-light)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: 'var(--color-success)' }}>{success}</span>
          <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-success)', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-gray-400)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Main form sections (id lets the Save button live outside) ── */}
          <form id="settings-form" onSubmit={handleSave} style={{ display: 'contents' }}>

            <CollapsibleCard title="Team Identity" subtitle="Your program's name and branding.">
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
                <TextInput label="Team / Program Name" value={form.teamName} onChange={set('teamName')} placeholder="USF Bulls" required />
                <TextInput label="Abbreviation"        value={form.teamAbbr} onChange={set('teamAbbr')} placeholder="USF"      required />
                <SelectInput label="Level" value={form.level} onChange={v => setForm(p => ({ ...p, level: v }))} options={LEVEL_OPTIONS} />
              </div>
              <div style={{ marginTop: 16 }}>
                <TextInput
                  label="Logo URL (optional)"
                  value={form.logoUrl}
                  onChange={set('logoUrl')}
                  placeholder="https://example.com/logo.png"
                  helper="Leave blank to show abbreviation badge instead"
                />
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Brand Colors" subtitle="Six hex values control the full portal color theme." defaultOpen={false}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                <ColorInput label="Primary"       value={form.colorPrimary}      onChange={set('colorPrimary')}      />
                <ColorInput label="Primary Dark"  value={form.colorPrimaryDark}  onChange={set('colorPrimaryDark')}  />
                <ColorInput label="Primary Light" value={form.colorPrimaryLight} onChange={set('colorPrimaryLight')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <ColorInput label="Accent"        value={form.colorAccent}       onChange={set('colorAccent')}       />
                <ColorInput label="Accent Dark"   value={form.colorAccentDark}   onChange={set('colorAccentDark')}   />
                <ColorInput label="Accent Light"  value={form.colorAccentLight}  onChange={set('colorAccentLight')}  />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {[form.colorPrimary, form.colorPrimaryDark, form.colorPrimaryLight, form.colorAccent, form.colorAccentDark, form.colorAccentLight].map((c, i) => (
                  <div key={i} style={{ flex: 1, height: 32, backgroundColor: c, borderRadius: 6, border: `1px solid ${theme.gray200}` }} title={c} />
                ))}
              </div>
            </CollapsibleCard>

            <CollapsibleCard
              title="Academic Years"
              subtitle="Comma-separated list (e.g. Freshman, Sophomore, Junior, Senior, Graduate)."
              defaultOpen={false}
              headerRight={
                <button
                  type="button"
                  onClick={applyDefaultAcademicYears}
                  style={{ background: 'transparent', border: `1px solid var(--color-card-border)`, borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 12, fontWeight: 500, color: 'var(--color-gray-600)', cursor: 'pointer' }}
                >
                  Load defaults for level
                </button>
              }
            >
              <TextInput
                value={form.academicYearsText}
                onChange={v => setForm(p => ({ ...p, academicYearsText: v }))}
                placeholder="Freshman, Sophomore, Junior, Senior, Graduate"
              />
              {form.academicYearsText && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {form.academicYearsText.split(',').map(y => y.trim()).filter(Boolean).map(y => (
                    <span key={y} style={{ padding: '3px 10px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 700 }}>
                      {y}
                    </span>
                  ))}
                </div>
              )}
            </CollapsibleCard>

            <CollapsibleCard title="Terminology Labels" subtitle="Customize the labels used throughout the portal." defaultOpen={false}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <TextInput label="Alumni Label" value={form.alumniLabel} onChange={set('alumniLabel')} placeholder="Alumni"           helper='e.g. "Alumni", "Former Players"' />
                <TextInput label="Roster Label" value={form.rosterLabel} onChange={set('rosterLabel')} placeholder="Roster"           helper='e.g. "Roster", "Team Roster"'   />
                <TextInput label="Class Label"  value={form.classLabel}  onChange={set('classLabel')}  placeholder="Recruiting Class" helper='e.g. "Recruiting Class", "Year"' />
              </div>
            </CollapsibleCard>

          </form>

          {/* ── Sports Setup (live-save, outside main form) ── */}
          <SportsSetupSection />

          {/* ── Positions (live-save, outside main form) ── */}
          <PositionsSection />

          {/* ── Save Settings — always at the bottom ── */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingBottom: 24 }}>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              style={{ background: 'transparent', border: 'none', padding: '9px 18px', fontSize: 14, color: 'var(--color-gray-500)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="settings-form"
              disabled={saving}
              style={{
                backgroundColor: saving ? 'var(--color-primary-dark)' : 'var(--color-primary)',
                color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
                padding: '9px 24px', fontSize: 14, fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer', transition: 'background 0.15s',
              }}
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>

        </div>
      )}
    </>
  )
}
