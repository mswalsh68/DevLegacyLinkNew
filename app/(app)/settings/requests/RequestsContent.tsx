'use client'

// RequestsContent — admin UI for reviewing access requests.
// Approve / Deny with optional denial reason. Role override on approve.
// Matches the inline-style approach used throughout the rest of the app.

import { useState, useTransition } from 'react'
import { approveAccessRequest, denyAccessRequest } from '@/app/actions/invite'

interface AccessRequest {
  requestId:         string
  userId:            string
  email:             string
  firstName:         string
  lastName:          string
  teamId:            string
  teamName:          string
  role:              string
  status:            string
  denialReason?:     string | null
  createdAt:         string
  reviewedAt?:       string | null
  reviewedByFirstName?: string | null
  reviewedByLastName?:  string | null
}

type Tab = 'pending' | 'reviewed'

function timeAgo(isoDate: string): string {
  const diff  = Date.now() - new Date(isoDate).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(mins  / 60)
  const days  = Math.floor(hours / 24)
  if (days  > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins  > 0) return `${mins}m ago`
  return 'just now'
}

export function RequestsContent({
  pending:  initialPending,
  reviewed: initialReviewed,
}: {
  pending:  Record<string, unknown>[]
  reviewed: Record<string, unknown>[]
}) {
  const [tab,      setTab]      = useState<Tab>('pending')
  const [pending,  setPending]  = useState<AccessRequest[]>(initialPending as unknown as AccessRequest[])
  const [reviewed, setReviewed] = useState<AccessRequest[]>(initialReviewed as unknown as AccessRequest[])
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [isPending, startTransition] = useTransition()

  // Per-row state for deny modal
  const [denyingId,     setDenyingId]     = useState<string | null>(null)
  const [denialReason,  setDenialReason]  = useState('')
  const [roleOverrides, setRoleOverrides] = useState<Record<string, string>>({})

  function setError(id: string, msg: string) {
    setErrors(e => ({ ...e, [id]: msg }))
  }

  function moveToReviewed(req: AccessRequest, updates: Partial<AccessRequest>) {
    setPending(p  => p.filter(r => r.requestId !== req.requestId))
    setReviewed(r => [{ ...req, ...updates }, ...r])
  }

  function handleApprove(req: AccessRequest) {
    const role = roleOverrides[req.requestId] || req.role
    startTransition(async () => {
      const result = await approveAccessRequest({
        requestId: req.requestId,
        role,
        userEmail: req.email,
      })
      if (result.success) {
        moveToReviewed(req, { status: 'approved', role })
      } else {
        setError(req.requestId, result.error ?? 'Approval failed.')
      }
    })
  }

  function handleDenyConfirm(req: AccessRequest) {
    startTransition(async () => {
      const result = await denyAccessRequest({
        requestId:    req.requestId,
        denialReason: denialReason || undefined,
        userEmail:    req.email,
      })
      if (result.success) {
        moveToReviewed(req, { status: 'denied', denialReason: denialReason || null })
        setDenyingId(null)
        setDenialReason('')
      } else {
        setError(req.requestId, result.error ?? 'Denial failed.')
      }
    })
  }

  const currentList = tab === 'pending' ? pending : reviewed

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          Access Requests
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
          Review and approve self-signup requests from your program members.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['pending', 'reviewed'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding:         '7px 16px',
              borderRadius:    8,
              border:          'none',
              fontSize:        13,
              fontWeight:      600,
              cursor:          'pointer',
              backgroundColor: tab === t ? 'var(--color-primary)' : '#f3f4f6',
              color:           tab === t ? '#fff' : '#374151',
              transition:      'background 0.15s',
              position:        'relative',
            }}
          >
            {t === 'pending' ? 'Pending' : 'Reviewed'}
            {t === 'pending' && pending.length > 0 && (
              <span
                style={{
                  position:        'absolute',
                  top:             -6,
                  right:           -6,
                  backgroundColor: '#ef4444',
                  color:           '#fff',
                  fontSize:        10,
                  fontWeight:      700,
                  borderRadius:    99,
                  padding:         '1px 5px',
                  minWidth:        16,
                  textAlign:       'center',
                }}
              >
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {currentList.length === 0 ? (
        <div
          style={{
            textAlign:       'center',
            padding:         '48px 24px',
            color:           '#9ca3af',
            backgroundColor: '#f9fafb',
            borderRadius:    12,
            border:          '1px dashed #e5e7eb',
          }}
        >
          {tab === 'pending' ? 'No pending requests.' : 'No reviewed requests yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {currentList.map(req => (
            <RequestRow
              key={req.requestId}
              req={req}
              tab={tab}
              error={errors[req.requestId]}
              roleOverride={roleOverrides[req.requestId] ?? req.role}
              onRoleChange={role =>
                setRoleOverrides(r => ({ ...r, [req.requestId]: role }))
              }
              onApprove={() => handleApprove(req)}
              onDeny={() => { setDenyingId(req.requestId); setDenialReason('') }}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Deny modal */}
      {denyingId && (
        <div
          style={{
            position:        'fixed',
            inset:           0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            zIndex:          200,
            padding:         24,
          }}
          onClick={() => setDenyingId(null)}
        >
          <div
            style={{
              background:   '#fff',
              borderRadius: 12,
              padding:      28,
              maxWidth:     440,
              width:        '100%',
              boxShadow:    '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Deny Request</h3>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Optional: provide a reason that will be shown to the user.
            </p>
            <textarea
              value={denialReason}
              onChange={e => setDenialReason(e.target.value)}
              placeholder="e.g. Please contact your program administrator directly."
              rows={3}
              style={{
                width:        '100%',
                borderRadius: 8,
                border:       '1px solid #d1d5db',
                padding:      '10px 12px',
                fontSize:     13,
                resize:       'vertical',
                marginBottom: 16,
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDenyingId(null)}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const req = pending.find(r => r.requestId === denyingId)
                  if (req) handleDenyConfirm(req)
                }}
                disabled={isPending}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                {isPending ? 'Denying…' : 'Confirm Denial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RequestRow({
  req,
  tab,
  error,
  roleOverride,
  onRoleChange,
  onApprove,
  onDeny,
  isPending,
}: {
  req:          AccessRequest
  tab:          Tab
  error?:       string
  roleOverride: string
  onRoleChange: (role: string) => void
  onApprove:    () => void
  onDeny:       () => void
  isPending:    boolean
}) {
  const statusColors: Record<string, { bg: string; color: string }> = {
    pending:  { bg: '#fef3c7', color: '#92400e' },
    approved: { bg: '#d1fae5', color: '#065f46' },
    denied:   { bg: '#fee2e2', color: '#991b1b' },
  }
  const sc = statusColors[req.status] ?? statusColors.pending

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border:          '1px solid #e5e7eb',
        borderRadius:    10,
        padding:         '16px 20px',
        boxShadow:       '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        {/* Left: user + request info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: '#111827', margin: '0 0 2px' }}>
            {req.firstName} {req.lastName}
          </p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>{req.email}</p>
          <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
            {req.teamName} · {timeAgo(req.createdAt)}
          </p>
        </div>

        {/* Right: status badge */}
        <span
          style={{
            backgroundColor: sc.bg,
            color:           sc.color,
            fontSize:        11,
            fontWeight:      600,
            padding:         '3px 10px',
            borderRadius:    99,
            whiteSpace:      'nowrap',
            textTransform:   'capitalize',
          }}
        >
          {req.status}
        </span>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{error}</p>
      )}

      {/* Pending actions */}
      {tab === 'pending' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>Role:</label>
          <select
            value={roleOverride}
            onChange={e => onRoleChange(e.target.value)}
            style={{
              fontSize:    12,
              padding:     '5px 8px',
              borderRadius: 6,
              border:      '1px solid #d1d5db',
              color:       '#374151',
              background:  '#fff',
            }}
          >
            {['roster', 'alumni', 'coach_staff', 'readonly'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <div style={{ flex: 1 }} />

          <button
            onClick={onDeny}
            disabled={isPending}
            style={{
              padding:      '7px 16px',
              borderRadius:  8,
              border:       '1px solid #fca5a5',
              background:   '#fff',
              color:        '#dc2626',
              fontSize:     13,
              fontWeight:   600,
              cursor:       'pointer',
              opacity:      isPending ? 0.6 : 1,
            }}
          >
            Deny
          </button>
          <button
            onClick={onApprove}
            disabled={isPending}
            style={{
              padding:      '7px 16px',
              borderRadius:  8,
              border:       'none',
              background:   'var(--color-primary)',
              color:        '#fff',
              fontSize:     13,
              fontWeight:   600,
              cursor:       'pointer',
              opacity:      isPending ? 0.6 : 1,
            }}
          >
            {isPending ? 'Saving…' : 'Approve'}
          </button>
        </div>
      )}

      {/* Reviewed: show reviewer + timestamp */}
      {tab === 'reviewed' && req.reviewedAt && (
        <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 10 }}>
          {req.status === 'approved' ? 'Approved' : 'Denied'} by{' '}
          {req.reviewedByFirstName} {req.reviewedByLastName} · {timeAgo(req.reviewedAt)}
          {req.denialReason && ` — "${req.denialReason}"`}
        </p>
      )}
    </div>
  )
}
