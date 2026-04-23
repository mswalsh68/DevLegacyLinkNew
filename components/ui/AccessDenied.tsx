// Shown when a user navigates to a page their role cannot access.
// Works in both server and client components — no hooks used.

interface AccessDeniedProps {
  /** The user's current role label (e.g. "Read Only"). */
  currentRole?: string
  /** What is required (e.g. "App Admin or higher"). */
  requiredRole?: string
}

export function AccessDenied({ currentRole, requiredRole }: AccessDeniedProps) {
  return (
    <div
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '80px 24px',
        textAlign:      'center',
      }}
    >
      {/* Lock icon */}
      <div
        style={{
          width:           72,
          height:          72,
          borderRadius:    '50%',
          backgroundColor: '#fef2f2',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          marginBottom:    24,
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      <h2
        style={{
          fontSize:     22,
          fontWeight:   700,
          color:        '#111827',
          margin:       '0 0 8px',
          letterSpacing: '-0.3px',
        }}
      >
        Access Denied
      </h2>

      <p
        style={{
          fontSize:  15,
          color:     '#6b7280',
          maxWidth:  380,
          lineHeight: 1.55,
          margin:    '0 0 4px',
        }}
      >
        You don&apos;t have permission to view this page.
      </p>

      {(currentRole || requiredRole) && (
        <p style={{ fontSize: 13, color: '#9ca3af', margin: '8px 0 0' }}>
          {currentRole && <>Your role: <strong style={{ color: '#6b7280' }}>{currentRole}</strong></>}
          {currentRole && requiredRole && ' · '}
          {requiredRole && <>Required: <strong style={{ color: '#6b7280' }}>{requiredRole}</strong></>}
        </p>
      )}

      <a
        href="/dashboard"
        style={{
          display:         'inline-block',
          marginTop:       28,
          padding:         '9px 20px',
          backgroundColor: 'var(--color-primary)',
          color:           '#fff',
          borderRadius:    8,
          fontSize:        14,
          fontWeight:      600,
          textDecoration:  'none',
        }}
      >
        Back to Dashboard
      </a>
    </div>
  )
}
