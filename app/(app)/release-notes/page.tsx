'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/providers/AuthProvider'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReleaseNoteItem    { body: string }
interface ReleaseNoteSection { label: string; color: string; bg: string; items: ReleaseNoteItem[] }
interface ReleaseNote {
  id:             number
  version:        string
  releaseDate:    string   // "May 15, 2026"
  releaseDateRaw: string   // "2026-05-15"
  sections:       ReleaseNoteSection[]
}

// ─── Section presets ──────────────────────────────────────────────────────────

const SECTION_PRESETS = [
  { label: 'New Features', color: '#16a34a', bg: '#f0fdf4' },
  { label: 'Improvements', color: '#2563eb', bg: '#eff6ff' },
  { label: 'Bug Fixes',    color: '#dc2626', bg: '#fef2f2' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build sections payload from parallel textarea strings (one item per line). */
function buildSections(itemLines: string[]) {
  return SECTION_PRESETS
    .map((preset, i) => ({
      ...preset,
      sortOrder: i,
      items: itemLines[i]
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map((body, j) => ({ body, sortOrder: j })),
    }))
    .filter(s => s.items.length > 0)
}

/** Derive textarea strings from an existing release's sections. */
function sectionsToLines(sections: ReleaseNoteSection[]): string[] {
  return SECTION_PRESETS.map(preset => {
    const match = sections.find(s => s.label === preset.label)
    return match ? match.items.map(i => i.body).join('\n') : ''
  })
}

// ─── EditForm component ───────────────────────────────────────────────────────

interface EditFormProps {
  initial?: ReleaseNote                // undefined = create mode
  onSave:   () => void
  onCancel: () => void
}

function EditForm({ initial, onSave, onCancel }: EditFormProps) {
  const [version,     setVersion]     = useState(initial?.version        ?? '')
  const [releaseDate, setReleaseDate] = useState(initial?.releaseDateRaw ?? '')
  const [itemLines,   setItemLines]   = useState<string[]>(
    initial ? sectionsToLines(initial.sections) : ['', '', ''],
  )
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState('')

  const handleSave = async () => {
    if (!version.trim() || !releaseDate.trim()) {
      setErr('Version and date are required.')
      return
    }
    const sections = buildSections(itemLines)
    setSaving(true)
    setErr('')

    try {
      if (initial) {
        // Update
        const res = await fetch(`/api/release-notes/${initial.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ version: version.trim(), releaseDate, sections }),
        })
        const json = await res.json()
        if (!json.success) { setErr(json.error ?? 'Failed to update.'); return }
      } else {
        // Create — first create the shell, then immediately update with sections
        const res1 = await fetch('/api/release-notes', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ version: version.trim(), releaseDate }),
        })
        const json1 = await res1.json()
        if (!json1.success) { setErr(json1.error ?? 'Failed to create.'); return }

        const newId: number = json1.data.id
        if (sections.length > 0) {
          const res2 = await fetch(`/api/release-notes/${newId}`, {
            method:  'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ version: version.trim(), releaseDate, sections }),
          })
          const json2 = await res2.json()
          if (!json2.success) { setErr(json2.error ?? 'Failed to save sections.'); return }
        }
      }
      onSave()
    } catch {
      setErr('Network error.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width:        '100%',
    padding:      '7px 10px',
    fontSize:     13,
    border:       '1px solid var(--color-card-border)',
    borderRadius: 6,
    background:   'var(--color-input-bg, var(--color-gray-50))',
    color:        'var(--color-gray-900)',
    boxSizing:    'border-box',
  }

  return (
    <div style={{
      backgroundColor: 'var(--color-card-bg)',
      border:          '1px solid var(--color-primary)',
      borderRadius:    'var(--radius-lg)',
      overflow:        'hidden',
      marginBottom:    24,
    }}>
      {/* Header */}
      <div style={{
        padding:      '16px 24px',
        borderBottom: '1px solid var(--color-card-border)',
        background:   'var(--color-gray-50)',
      }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-gray-700)' }}>
          {initial ? `Editing ${initial.version}` : 'New Release'}
        </p>
      </div>

      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Version + Date row */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-gray-600)', marginBottom: 4 }}>
              Version
            </label>
            <input
              style={inputStyle}
              placeholder="v1.7.0"
              value={version}
              onChange={e => setVersion(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-gray-600)', marginBottom: 4 }}>
              Release Date
            </label>
            <input
              type="date"
              style={inputStyle}
              value={releaseDate}
              onChange={e => setReleaseDate(e.target.value)}
            />
          </div>
        </div>

        {/* Section textareas */}
        {SECTION_PRESETS.map((preset, i) => (
          <div key={preset.label}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{
                fontSize:      11,
                fontWeight:    600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color:         preset.color,
                background:    preset.bg,
                borderRadius:  4,
                padding:       '2px 8px',
              }}>
                {preset.label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>one item per line</span>
            </label>
            <textarea
              style={{ ...inputStyle, height: 80, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              placeholder={`${preset.label} items, one per line…`}
              value={itemLines[i]}
              onChange={e => setItemLines(prev => prev.map((v, j) => j === i ? e.target.value : v))}
            />
          </div>
        ))}

        {err && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-danger)' }}>{err}</p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={saving}
            style={{
              padding:      '7px 16px',
              fontSize:     13,
              fontWeight:   500,
              borderRadius: 6,
              border:       '1px solid var(--color-card-border)',
              background:   'transparent',
              color:        'var(--color-gray-600)',
              cursor:       'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding:      '7px 16px',
              fontSize:     13,
              fontWeight:   600,
              borderRadius: 6,
              border:       'none',
              background:   'var(--color-primary)',
              color:        '#fff',
              cursor:       saving ? 'not-allowed' : 'pointer',
              opacity:      saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Release'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Release Notes Page ───────────────────────────────────────────────────────

export default function ReleaseNotesPage() {
  const { user } = useAuth()
  const isAdmin  = user?.roleId === 1

  const [releases,   setReleases]   = useState<ReleaseNote[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(false)
  const [creating,   setCreating]   = useState(false)
  const [editingId,  setEditingId]  = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/release-notes', { credentials: 'include' })
      .then(r => r.json())
      .then(({ success, data }) => {
        if (success) setReleases(data)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaved = () => {
    setCreating(false)
    setEditingId(null)
    load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this release? This cannot be undone.')) return
    setDeletingId(id)
    try {
      const res  = await fetch(`/api/release-notes/${id}`, { method: 'DELETE', credentials: 'include' })
      const json = await res.json()
      if (json.success) load()
      else alert(json.error ?? 'Failed to delete.')
    } catch {
      alert('Network error.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-gray-900)', margin: '0 0 6px' }}>
            Release Notes
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-gray-500)', margin: 0 }}>
            What&apos;s new in LegacyLink
          </p>
        </div>

        {isAdmin && !creating && (
          <button
            onClick={() => { setCreating(true); setEditingId(null) }}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          6,
              padding:      '7px 14px',
              fontSize:     13,
              fontWeight:   600,
              borderRadius: 6,
              border:       'none',
              background:   'var(--color-primary)',
              color:        '#fff',
              cursor:       'pointer',
              whiteSpace:   'nowrap',
              flexShrink:   0,
            }}
          >
            + Add Release
          </button>
        )}
      </div>

      {/* Create form */}
      {isAdmin && creating && (
        <EditForm
          onSave={handleSaved}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* States */}
      {loading && (
        <p style={{ color: 'var(--color-gray-400)', textAlign: 'center', padding: '40px 0' }}>Loading…</p>
      )}
      {error && !loading && (
        <p style={{ color: 'var(--color-danger)', textAlign: 'center', padding: '40px 0' }}>
          Failed to load release notes.
        </p>
      )}

      {/* Release cards */}
      {!loading && !error && releases.map((release) => {

        // Edit mode replaces the card
        if (isAdmin && editingId === release.id) {
          return (
            <EditForm
              key={release.id}
              initial={release}
              onSave={handleSaved}
              onCancel={() => setEditingId(null)}
            />
          )
        }

        return (
          <div
            key={release.id}
            style={{
              backgroundColor: 'var(--color-card-bg)',
              border:          '1px solid var(--color-card-border)',
              borderRadius:    'var(--radius-lg)',
              overflow:        'hidden',
              marginBottom:    24,
            }}
          >
            {/* Card header */}
            <div style={{
              padding:      '16px 20px',
              borderBottom: '1px solid var(--color-card-border)',
              display:      'flex',
              alignItems:   'center',
              gap:          10,
            }}>
              <span style={{
                fontSize:     14,
                fontWeight:   700,
                color:        'var(--color-gray-900)',
                fontFamily:   'monospace',
                background:   'var(--color-gray-100)',
                border:       '1px solid var(--color-card-border)',
                borderRadius: 6,
                padding:      '2px 10px',
              }}>
                {release.version}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-gray-500)', flex: 1 }}>
                {release.releaseDate}
              </span>

              {/* Admin controls */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { setEditingId(release.id); setCreating(false) }}
                    title="Edit"
                    style={{
                      padding:      '4px 10px',
                      fontSize:     12,
                      fontWeight:   500,
                      borderRadius: 5,
                      border:       '1px solid var(--color-card-border)',
                      background:   'transparent',
                      color:        'var(--color-gray-600)',
                      cursor:       'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(release.id)}
                    disabled={deletingId === release.id}
                    title="Delete"
                    style={{
                      padding:      '4px 10px',
                      fontSize:     12,
                      fontWeight:   500,
                      borderRadius: 5,
                      border:       '1px solid #fca5a5',
                      background:   'transparent',
                      color:        'var(--color-danger)',
                      cursor:       deletingId === release.id ? 'not-allowed' : 'pointer',
                      opacity:      deletingId === release.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === release.id ? '…' : 'Delete'}
                  </button>
                </div>
              )}
            </div>

            {/* Sections */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {release.sections.map((section) => (
                <div key={section.label}>
                  <div style={{
                    display:       'inline-block',
                    fontSize:      11,
                    fontWeight:    600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color:         section.color,
                    background:    section.bg,
                    borderRadius:  4,
                    padding:       '2px 8px',
                    marginBottom:  10,
                  }}>
                    {section.label}
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {section.items.map((item, i) => (
                      <li key={i} style={{ fontSize: 14, color: 'var(--color-gray-700)', lineHeight: 1.5 }}>
                        {item.body}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
