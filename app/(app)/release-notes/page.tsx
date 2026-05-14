'use client'

const releases = [
  {
    version: 'v1.0.0',
    date: 'May 13, 2026',
    sections: [
      {
        label: 'New Features',
        color: '#16a34a',
        bg: '#f0fdf4',
        items: [
          'Two-tier role architecture — global roles and program roles',
          'Roster and alumni management with sport filtering',
          'Staff management page',
          'Feed with sport tagging and pinned welcome posts',
          'Mentor program (Elite tier)',
          'Team switcher with per-team theme support',
          'Tier-based dashboard tabs and feature flags',
          'Invite, claim, and member signup flows',
          'Community consent gate',
          'Welcome popup for new members',
        ],
      },
      {
        label: 'Improvements',
        color: '#2563eb',
        bg: '#eff6ff',
        items: [
          'Azure SQL cross-database coordination layer',
          'Responsive UI with compact filter bars',
          'Session-based team and role resolution',
        ],
      },
      {
        label: 'Bug Fixes',
        color: '#dc2626',
        bg: '#fef2f2',
        items: [
          'Fixed tierId feature flag resolving as string instead of number',
          'Fixed case-insensitive tier normalization',
          'Fixed dashboard metric routes using session tierId',
          'Fixed mentor program stored procedure column references',
        ],
      },
    ],
  },
]

export default function ReleaseNotesPage() {
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

      {releases.map((release) => (
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
              fontSize:        14,
              fontWeight:      700,
              color:           'var(--color-gray-900)',
              fontFamily:      'monospace',
              background:      'var(--color-gray-100)',
              border:          '1px solid var(--color-card-border)',
              borderRadius:    6,
              padding:         '2px 10px',
            }}>
              {release.version}
            </span>
            <span style={{ fontSize: 13, color: 'var(--color-gray-500)' }}>{release.date}</span>
          </div>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {release.sections.map((section) => (
              <div key={section.label}>
                <div style={{
                  display:      'inline-block',
                  fontSize:     11,
                  fontWeight:   600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color:        section.color,
                  background:   section.bg,
                  borderRadius: 4,
                  padding:      '2px 8px',
                  marginBottom: 10,
                }}>
                  {section.label}
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {section.items.map((item) => (
                    <li key={item} style={{ fontSize: 14, color: 'var(--color-gray-700)', lineHeight: 1.5 }}>
                      {item}
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
