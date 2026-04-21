'use client'

// Team Settings form — ported from original project (app/admin/settings/page.tsx).
// Loads current config from GET /api/config, saves via PATCH /api/config.
// On save: clears sessionStorage cache and fires triggerThemeRefresh so the
// nav and all CSS vars update immediately without a page reload.

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { triggerThemeRefresh } from '@/providers/ThemeProvider'
import { theme } from '@/lib/theme'

// ─── Constants (copied from original project) ─────────────────────────────────

const SPORT_OPTIONS = [
  { value: 'football',   label: 'Football'   },
  { value: 'basketball', label: 'Basketball' },
  { value: 'baseball',   label: 'Baseball'   },
  { value: 'soccer',     label: 'Soccer'     },
  { value: 'softball',   label: 'Softball'   },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'other',      label: 'Other'      },
]

const LEVEL_OPTIONS = [
  { value: 'college',     label: 'College / University' },
  { value: 'high_school', label: 'High School'          },
  { value: 'club',        label: 'Club / Amateur'       },
]

const DEFAULT_POSITIONS: Record<string, string[]> = {
  football:   ['QB','RB','WR','TE','OL','DL','LB','DB','K','P','LS','ATH'],
  basketball: ['PG','SG','SF','PF','C'],
  baseball:   ['P','C','1B','2B','3B','SS','LF','CF','RF','DH'],
  soccer:     ['GK','DEF','MID','FWD'],
  softball:   ['P','C','1B','2B','3B','SS','LF','CF','RF','DP'],
  volleyball: ['S','OH','MB','RS','L','DS'],
  other:      [],
}

const DEFAULT_ACADEMIC_YEARS: Record<string, string[]> = {
  college:     ['Freshman','Sophomore','Junior','Senior','Graduate'],
  high_school: ['9th Grade','10th Grade','11th Grade','12th Grade'],
  club:        ['Year 1','Year 2','Year 3','Year 4'],
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{
        fontSize:      12,
        fontWeight:    700,
        color:         theme.primary,
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        margin:        0,
        paddingBottom: 8,
        borderBottom:  `2px solid ${theme.primaryLight}`,
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
  label, value, onChange, placeholder, helper, required,
}: {
  label?: string; value: string; onChange: (v: string) => void
  placeholder?: string; helper?: string; required?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <FieldLabel>{label}{required && <span style={{ color: theme.danger }}> *</span>}</FieldLabel>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          border:       `1.5px solid ${theme.gray200}`,
          borderRadius: 'var(--radius-sm)',
          padding:      '8px 12px',
          fontSize:     13,
          color:        theme.gray900,
          outline:      'none',
          width:        '100%',
          boxSizing:    'border-box',
        }}
        onFocus={e  => (e.target.style.borderColor = theme.primary)}
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
          border:       `1.5px solid ${theme.gray200}`,
          borderRadius: 'var(--radius-sm)',
          padding:      '8px 12px',
          fontSize:     13,
          color:        theme.gray900,
          outline:      'none',
          background:   '#fff',
          width:        '100%',
          boxSizing:    'border-box',
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

function ColorInput({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: 40, height: 36, border: `1px solid ${theme.gray200}`, borderRadius: 6, cursor: 'pointer', padding: 2, flexShrink: 0 }}
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          maxLength={7}
          style={{
            flex:         1,
            border:       `1.5px solid ${theme.gray200}`,
            borderRadius: 'var(--radius-sm)',
            padding:      '8px 12px',
            fontSize:     13,
            fontFamily:   'monospace',
            color:        theme.gray900,
            outline:      'none',
          }}
          onFocus={e => (e.target.style.borderColor = theme.primary)}
          onBlur={e  => (e.target.style.borderColor = theme.gray200)}
        />
        <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: value, border: `1px solid ${theme.gray200}`, flexShrink: 0 }} />
      </div>
    </div>
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
    sport:             'football',
    level:             'college',
    logoUrl:           '',
    colorPrimary:      '#006747',
    colorPrimaryDark:  '#005432',
    colorPrimaryLight: '#E0F0EA',
    colorAccent:       '#CFC493',
    colorAccentDark:   '#A89C6A',
    colorAccentLight:  '#EDEBD1',
    positionsText:     '',
    academicYearsText: '',
    alumniLabel:       'Alumni',
    rosterLabel:       'Roster',
    classLabel:        'Recruiting Class',
  })

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res  = await fetch('/api/config', { credentials: 'include' })
      const json = await res.json()
      const c    = json.data ?? {}
      setForm(prev => ({
        ...prev,
        teamName:          c.teamName          ?? c.name          ?? '',
        teamAbbr:          c.teamAbbr          ?? c.abbr          ?? '',
        sport:             c.sport             ?? 'football',
        level:             c.level             ?? 'college',
        logoUrl:           c.logoUrl           ?? '',
        colorPrimary:      c.colorPrimary      ?? c.primaryColor  ?? '#006747',
        colorPrimaryDark:  c.colorPrimaryDark  ?? '#005432',
        colorPrimaryLight: c.colorPrimaryLight ?? '#E0F0EA',
        colorAccent:       c.colorAccent       ?? c.accentColor   ?? '#CFC493',
        colorAccentDark:   c.colorAccentDark   ?? '#A89C6A',
        colorAccentLight:  c.colorAccentLight  ?? '#EDEBD1',
        positionsText:     Array.isArray(c.positions) ? c.positions.join(', ') : '',
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

  const applyDefaultPositions = () => {
    const defaults = DEFAULT_POSITIONS[form.sport] ?? []
    setForm(p => ({ ...p, positionsText: defaults.join(', ') }))
  }

  const applyDefaultAcademicYears = () => {
    const defaults = DEFAULT_ACADEMIC_YEARS[form.level] ?? []
    setForm(p => ({ ...p, academicYearsText: defaults.join(', ') }))
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const positions     = form.positionsText.split(',').map(p => p.trim().toUpperCase()).filter(Boolean)
    const academicYears = form.academicYearsText.split(',').map(y => y.trim()).filter(Boolean)

    if (positions.length === 0) {
      setError('At least one position is required.')
      return
    }
    if (academicYears.length === 0) {
      setError('At least one academic year is required.')
      return
    }

    setSaving(true)
    try {
      const payload = {
        teamName:          form.teamName,
        teamAbbr:          form.teamAbbr,
        sport:             form.sport,
        level:             form.level,
        logoUrl:           form.logoUrl || '',
        colorPrimary:      form.colorPrimary,
        colorPrimaryDark:  form.colorPrimaryDark,
        colorPrimaryLight: form.colorPrimaryLight,
        colorAccent:       form.colorAccent,
        colorAccentDark:   form.colorAccentDark,
        colorAccentLight:  form.colorAccentLight,
        positions,
        academicYears,
        alumniLabel:       form.alumniLabel,
        rosterLabel:       form.rosterLabel,
        classLabel:        form.classLabel,
      }

      const res = await fetch('/api/config', {
        method:      'PATCH',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify(payload),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save settings.')
        return
      }

      // Bust ThemeProvider cache, then apply new colors immediately
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

  // ─── Card wrapper ────────────────────────────────────────────────────────────
  const card = {
    backgroundColor: 'var(--color-card-bg)',
    border:          '1px solid var(--color-card-border)',
    borderRadius:    'var(--radius-lg)',
    padding:         24,
    boxShadow:       'var(--shadow-sm)',
  }

  return (
    <>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-gray-900)', margin: 0 }}>
            Team Settings
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-gray-500)', marginTop: 4, marginBottom: 0 }}>
            Configure your portal identity, colors, positions, and terminology
          </p>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          style={{
            background:   'transparent',
            border:       `1px solid var(--color-card-border)`,
            borderRadius: 'var(--radius-sm)',
            padding:      '7px 14px',
            fontSize:     13,
            fontWeight:   500,
            color:        'var(--color-gray-600)',
            cursor:       'pointer',
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
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-gray-400)' }}>Loading...</div>
      ) : (
        <form onSubmit={handleSave}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Team Identity ── */}
            <div style={card}>
              <SectionHeader title="Team Identity" subtitle="Your program's name and branding." />
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16 }}>
                <TextInput label="Team / Program Name" value={form.teamName} onChange={set('teamName')} placeholder="USF Bulls" required />
                <TextInput label="Abbreviation"        value={form.teamAbbr} onChange={set('teamAbbr')} placeholder="USF"      required />
                <SelectInput label="Sport" value={form.sport} onChange={v => setForm(p => ({ ...p, sport: v }))} options={SPORT_OPTIONS} />
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
            </div>

            {/* ── Brand Colors ── */}
            <div style={card}>
              <SectionHeader title="Brand Colors" subtitle="Six hex values control the full portal color theme." />
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
              {/* Preview swatches */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {[form.colorPrimary, form.colorPrimaryDark, form.colorPrimaryLight, form.colorAccent, form.colorAccentDark, form.colorAccentLight].map((c, i) => (
                  <div key={i} style={{ flex: 1, height: 32, backgroundColor: c, borderRadius: 6, border: `1px solid ${theme.gray200}` }} title={c} />
                ))}
              </div>
            </div>

            {/* ── Positions ── */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <SectionHeader title="Positions" subtitle="Comma-separated list of valid positions for your sport." />
                <button
                  type="button"
                  onClick={applyDefaultPositions}
                  style={{ background: 'transparent', border: `1px solid var(--color-card-border)`, borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 12, fontWeight: 500, color: 'var(--color-gray-600)', cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}
                >
                  Load defaults for sport
                </button>
              </div>
              <TextInput
                value={form.positionsText}
                onChange={v => setForm(p => ({ ...p, positionsText: v }))}
                placeholder="QB, RB, WR, TE, OL, DL, LB, DB, K, P, LS, ATH"
              />
              {form.positionsText && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {form.positionsText.split(',').map(p => p.trim().toUpperCase()).filter(Boolean).map(p => (
                    <span key={p} style={{ padding: '3px 10px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 700 }}>
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Academic Years ── */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <SectionHeader title="Academic Years" subtitle="Comma-separated list (e.g. Freshman, Sophomore, Junior, Senior, Graduate)." />
                <button
                  type="button"
                  onClick={applyDefaultAcademicYears}
                  style={{ background: 'transparent', border: `1px solid var(--color-card-border)`, borderRadius: 'var(--radius-sm)', padding: '5px 12px', fontSize: 12, fontWeight: 500, color: 'var(--color-gray-600)', cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}
                >
                  Load defaults for level
                </button>
              </div>
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
            </div>

            {/* ── Terminology Labels ── */}
            <div style={card}>
              <SectionHeader title="Terminology Labels" subtitle="Customize the labels used throughout the portal." />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <TextInput label="Alumni Label"  value={form.alumniLabel} onChange={set('alumniLabel')} placeholder="Alumni"            helper='e.g. "Alumni", "Former Players"' />
                <TextInput label="Roster Label"  value={form.rosterLabel} onChange={set('rosterLabel')} placeholder="Roster"            helper='e.g. "Roster", "Team Roster"'   />
                <TextInput label="Class Label"   value={form.classLabel}  onChange={set('classLabel')}  placeholder="Recruiting Class"  helper='e.g. "Recruiting Class", "Year"' />
              </div>
            </div>

          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              style={{ background: 'transparent', border: 'none', padding: '9px 18px', fontSize: 14, color: 'var(--color-gray-500)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                backgroundColor: saving ? 'var(--color-primary-dark)' : 'var(--color-primary)',
                color:           '#fff',
                border:          'none',
                borderRadius:    'var(--radius-sm)',
                padding:         '9px 24px',
                fontSize:        14,
                fontWeight:      600,
                cursor:          saving ? 'wait' : 'pointer',
                transition:      'background 0.15s',
              }}
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </>
  )
}
