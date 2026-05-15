'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ─── Unsubscribe Page ─────────────────────────────────────────────────────────
// Public — no auth required. Linked from every outreach email footer.

type Status = 'loading' | 'success' | 'invalid' | 'error'

export default function UnsubscribePage() {
  const searchParams          = useSearchParams()
  const token                 = searchParams.get('token')
  const [status, setStatus]   = useState<Status>('loading')
  const [firstName, setFirstName] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setStatus('invalid'); return }

    fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((data: { success: boolean; firstName?: string | null; error?: string }) => {
        if (data.success) {
          setFirstName(data.firstName ?? null)
          setStatus('success')
        } else if (data.error === 'INVALID_TOKEN') {
          setStatus('invalid')
        } else {
          setStatus('error')
        }
      })
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div
      style={{
        minHeight:       '100vh',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        backgroundColor: '#f9fafb',
        fontFamily:      'system-ui, sans-serif',
        padding:         24,
      }}
    >
      <div
        style={{
          maxWidth:        480,
          width:           '100%',
          backgroundColor: '#ffffff',
          borderRadius:    12,
          boxShadow:       '0 1px 4px rgba(0,0,0,0.08)',
          padding:         40,
          textAlign:       'center',
        }}
      >
        {/* Logo / brand */}
        <p style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 32 }}>
          LegacyLink
        </p>

        {status === 'loading' && (
          <>
            <p style={{ fontSize: 16, color: '#6b7280' }}>Processing your request…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
              {firstName ? `Got it, ${firstName}.` : 'You\'ve been unsubscribed.'}
            </h1>
            <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, marginBottom: 0 }}>
              You won't receive any more emails from this program. If this was a mistake,
              contact your program administrator to be re-added.
            </p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
              Invalid link
            </h1>
            <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, marginBottom: 0 }}>
              This unsubscribe link is invalid or has already been used.
              If you're still receiving emails you didn't expect, please contact your program administrator.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>
              We couldn't process your request. Please try again or contact support.
            </p>
            <Link
              href={`/unsubscribe?token=${token ?? ''}`}
              style={{ fontSize: 14, color: '#2563eb', textDecoration: 'underline' }}
            >
              Try again
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
