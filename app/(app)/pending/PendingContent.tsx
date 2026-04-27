'use client'

// PendingContent — polling status screen for users awaiting access approval.
// Polls /api/invite/request/me every 60 seconds.
// Auto-redirects to /dashboard on approval, back to /join on denial.

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendRequestReminder } from '@/app/actions/invite'

interface AccessRequest {
  requestId:       string
  teamId:          number
  teamName:        string
  sport:           string
  role:            string
  status:          'pending' | 'approved' | 'denied'
  denialReason?:   string | null
  reminderSentAt?: string | null
  createdAt:       string
}

const POLL_MS = 60_000

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins  / 60)
  const days  = Math.floor(hours / 24)
  if (days  > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins  > 0) return `${mins}m ago`
  return 'just now'
}

function canSendReminder(reminderSentAt?: string | null): boolean {
  if (!reminderSentAt) return true
  const hoursSince = (Date.now() - new Date(reminderSentAt).getTime()) / 3_600_000
  return hoursSince >= 48
}

export function PendingContent({
  initialRequests,
}: {
  initialRequests: Record<string, unknown>[]
}) {
  const router = useRouter()
  const [requests, setRequests] = useState<AccessRequest[]>(
    initialRequests as unknown as AccessRequest[],
  )
  const [reminderStates, setReminderStates] = useState<Record<string, 'idle' | 'sending' | 'sent' | 'error'>>({})
  const [isPending, startTransition] = useTransition()

  // Poll every 60 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch('/api/invite/request/me', { credentials: 'include' })
        const body = await res.json()
        if (res.ok && body.data) {
          const updated = body.data as AccessRequest[]
          setRequests(updated)

          const allApproved = updated.every(r => r.status === 'approved')
          if (allApproved && updated.length > 0) {
            router.push('/dashboard')
          }
        }
      } catch { /* silent — keep showing last known state */ }
    }

    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [router])

  function handleReminder(req: AccessRequest) {
    setReminderStates(s => ({ ...s, [req.requestId]: 'sending' }))
    startTransition(async () => {
      const result = await sendRequestReminder({
        requestId: req.requestId,
        teamName:  req.teamName,
      })
      setReminderStates(s => ({
        ...s,
        [req.requestId]: result.success ? 'sent' : 'error',
      }))
    })
  }

  return (
    <div
      style={{
        minHeight:       '100vh',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
        justifyContent:  'center',
        padding:         '48px 24px',
        backgroundColor: 'var(--color-page-bg)',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>
        <h1
          style={{
            fontSize:    24,
            fontWeight:  700,
            color:       '#111827',
            marginBottom: 8,
            textAlign:   'center',
          }}
        >
          Awaiting Approval
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>
          Your request has been submitted. An administrator will review it shortly.
        </p>

        {requests.map((req) => (
          <RequestCard
            key={req.requestId}
            req={req}
            reminderState={reminderStates[req.requestId] ?? 'idle'}
            onReminder={() => handleReminder(req)}
            isPending={isPending}
          />
        ))}

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 24 }}>
          This page refreshes automatically every minute.
        </p>
      </div>
    </div>
  )
}

function RequestCard({
  req,
  reminderState,
  onReminder,
  isPending,
}: {
  req:           AccessRequest
  reminderState: 'idle' | 'sending' | 'sent' | 'error'
  onReminder:    () => void
  isPending:     boolean
}) {
  const statusColors = {
    pending:  { bg: '#fef3c7', color: '#92400e', label: 'Pending Review' },
    approved: { bg: '#d1fae5', color: '#065f46', label: 'Approved'       },
    denied:   { bg: '#fee2e2', color: '#991b1b', label: 'Denied'         },
  }
  const s = statusColors[req.status]

  return (
    <div
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border:          '1px solid var(--color-card-border)',
        borderRadius:    12,
        padding:         24,
        marginBottom:    16,
        boxShadow:       '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 16, color: '#111827', margin: 0 }}>{req.teamName}</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '2px 0 0' }}>
            {req.sport} · {req.role}
          </p>
        </div>
        <span
          style={{
            backgroundColor: s.bg,
            color:           s.color,
            fontSize:        11,
            fontWeight:      600,
            padding:         '3px 10px',
            borderRadius:    99,
            whiteSpace:      'nowrap',
          }}
        >
          {s.label}
        </span>
      </div>

      <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 16px' }}>
        Submitted {timeAgo(req.createdAt)}
      </p>

      {/* Pending: animated indicator + reminder button */}
      {req.status === 'pending' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PulsingDot />
            <span style={{ fontSize: 13, color: '#6b7280' }}>Waiting for admin review</span>
          </div>

          {reminderState === 'sent' ? (
            <span style={{ fontSize: 12, color: '#059669' }}>Reminder sent</span>
          ) : reminderState === 'error' ? (
            <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>Could not send</span>
          ) : canSendReminder(req.reminderSentAt) ? (
            <button
              onClick={onReminder}
              disabled={isPending || reminderState === 'sending'}
              style={{
                fontSize:        12,
                padding:         '5px 12px',
                borderRadius:    6,
                border:          '1px solid #d1d5db',
                background:      '#f9fafb',
                color:           '#374151',
                cursor:          'pointer',
                opacity:         isPending ? 0.6 : 1,
              }}
            >
              {reminderState === 'sending' ? 'Sending…' : 'Remind admin'}
            </button>
          ) : (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Reminder sent</span>
          )}
        </div>
      )}

      {/* Denied: show reason + link back to /join */}
      {req.status === 'denied' && (
        <div>
          {req.denialReason && (
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              <strong>Reason:</strong> {req.denialReason}
            </p>
          )}
          <a
            href="/join"
            style={{ fontSize: 13, color: '#2563eb', textDecoration: 'underline' }}
          >
            Submit a new request with a different code
          </a>
        </div>
      )}
    </div>
  )
}

function PulsingDot() {
  return (
    <span
      style={{
        display:         'inline-block',
        width:           8,
        height:          8,
        borderRadius:    '50%',
        backgroundColor: '#f59e0b',
        animation:       'pulse 2s ease-in-out infinite',
      }}
    />
  )
}
