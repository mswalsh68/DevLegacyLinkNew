'use client'

import { useEffect, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReleaseNoteItem    { body: string }
interface ReleaseNoteSection { label: string; color: string; bg: string; items: ReleaseNoteItem[] }
interface ReleaseNote        { version: string; releaseDate: string; sections: ReleaseNoteSection[] }

// ─── Release Notes Page ───────────────────────────────────────────────────────

export default function ReleaseNotesPage() {
  const [releases, setReleases] = useState<ReleaseNote[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(false)

  useEffect(() => {
    fetch('/api/release-notes', { credentials: 'include' })
      .then(r => r.json())
      .then(({ success, data }) => {
        if (success) setReleases(data)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-gray-900)', margin: '0 0 6px' }}>
          Release Notes
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-gray-500)', margin: 0 }}>
          What&apos;s new in LegacyLink
        </p>
      </div>

      {loading && (
        <p style={{ color: 'var(--color-gray-400)', textAlign: 'center', padding: '40px 0' }}>Loading…</p>
      )}

      {error && !loading && (
        <p style={{ color: 'var(--color-danger)', textAlign: 'center', padding: '40px 0' }}>
          Failed to load release notes.
        </p>
      )}

      {!loading && !error && releases.map((release) => (
        <div
          key={release.version}
          style={{
            backgroundColor: 'var(--color-card-bg)',
            border:          '1px solid var(--color-card-border)',
            borderRadius:    'var(--radius-lg)',
            overflow:        'hidden',
            marginBottom:    24,
          }}
        >
          <div style={{
            padding:      '20px 24px',
            borderBottom: '1px solid var(--color-card-border)',
            display:      'flex',
            alignItems:   'center',
            gap:          12,
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
            <span style={{ fontSize: 13, color: 'var(--color-gray-500)' }}>{release.releaseDate}</span>
          </div>

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
      ))}
    </div>
  )
}
