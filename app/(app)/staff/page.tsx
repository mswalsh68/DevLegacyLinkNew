'use client'

import { useEffect, useState } from 'react'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { useAuth } from '@/providers/AuthProvider'
import { useFilteredPagination } from '@/hooks/useFilteredPagination'
import { DataTablePage } from '@/components/ui/DataTablePage'
import { Button }        from '@/components/ui/Button'
import { Input }         from '@/components/ui/Input'
import { Select }        from '@/components/ui/Select'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Alert }         from '@/components/ui/Alert'
import { TableRow }      from '@/components/ui/TableRow'
import { Pagination }    from '@/components/ui/Pagination'
import { AccessDenied }  from '@/components/ui/AccessDenied'
import { can, roleLabel, requiredRoleLabel } from '@/lib/permissions'
import { theme } from '@/lib/theme'
import { resendInvite, notifyTeamAdded, generateInviteCode } from '@/app/actions/members'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffMember {
  userSportId:     number
  userId:          string
  firstName:       string
  lastName:        string
  email:           string
  sportId:         number
  sportName:       string
  programRoleId:   number
  programRoleName: string
  position:        string | null
  accountClaimed:  boolean
}

type RowActionState = 'idle' | 'sending' | 'sent' | 'error'
type CopyLinkState  = 'idle' | 'copying' | 'copied' | 'error'

interface StaffResponse {
  success: boolean
  data:    StaffMember[]
  total:   number
}

interface SportOption { id: number; name: string; abbr: string }

const PAGE_SIZE = 50

// program_role_id → badge color
const ROLE_BADGE: Record<number, BadgeVariant> = {
  1: 'primary',  // Athletic Director
  2: 'primary',  // Program Admin
  3: 'gold',     // Alumni Director
  4: 'green',    // Head Coach
  5: 'green',    // Coach
  6: 'gray',     // Support Staff
}

const ROLE_FILTER_OPTIONS = [
  { value: '',  label: 'All Roles'         },
  { value: '1', label: 'Athletic Director' },
  { value: '2', label: 'Program Admin'     },
  { value: '3', label: 'Alumni Director'   },
  { value: '4', label: 'Head Coach'        },
  { value: '5', label: 'Coach'             },
  { value: '6', label: 'Support Staff'     },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const config = useTeamConfig()
  const { user, isLoading } = useAuth()

  const canManage = can(user, 'staff:manage')

  const { filters: { search, roleId }, setFilter, page, setPage } =
    useFilteredPagination({ search: '', roleId: '' })

  const [staff,       setStaff]       = useState<StaffMember[]>([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [sports,      setSports]      = useState<SportOption[]>([])
  const [sportId,     setSportId]     = useState<number | null>(null)
  const [rowActions,  setRowActions]  = useState<Record<string, RowActionState>>({})
  const [copyStates,  setCopyStates]  = useState<Record<string, CopyLinkState>>({})

  const setRowAction = (userId: string, state: RowActionState) =>
    setRowActions(prev => ({ ...prev, [userId]: state }))

  const handleResend = async (member: StaffMember) => {
    if (!user?.currentTeamId) return
    setRowAction(member.userId, 'sending')
    const result = await resendInvite({
      email:     member.email,
      firstName: member.firstName,
      teamId:    user.currentTeamId,
      teamName:  config.teamName,
      role:      'staff',
    })
    setRowAction(member.userId, result.success ? 'sent' : 'error')
    if (result.success) setTimeout(() => setRowAction(member.userId, 'idle'), 3000)
  }

  const handleCopyLink = async (member: StaffMember) => {
    if (!user?.currentTeamId) return
    setCopyStates(prev => ({ ...prev, [member.userId]: 'copying' }))
    const result = await generateInviteCode({
      teamId:  user.currentTeamId,
      role:    'staff',
      maxUses: 1,
    })
    if (result.success && result.inviteUrl) {
      try {
        const claimUrl = `${result.inviteUrl}&e=${encodeURIComponent(member.email)}`
        await navigator.clipboard.writeText(claimUrl)
        setCopyStates(prev => ({ ...prev, [member.userId]: 'copied' }))
        setTimeout(() => setCopyStates(prev => ({ ...prev, [member.userId]: 'idle' })), 2500)
      } catch {
        setCopyStates(prev => ({ ...prev, [member.userId]: 'error' }))
      }
    } else {
      setCopyStates(prev => ({ ...prev, [member.userId]: 'error' }))
    }
  }

  const handleNotify = async (member: StaffMember) => {
    setRowAction(member.userId, 'sending')
    const result = await notifyTeamAdded({
      email:     member.email,
      firstName: member.firstName,
      teamName:  config.teamName,
    })
    setRowAction(member.userId, result.success ? 'sent' : 'error')
    if (result.success) setTimeout(() => setRowAction(member.userId, 'idle'), 3000)
  }

  useEffect(() => {
    fetch('/api/sports', { credentials: 'include' })
      .then(r => r.json())
      .then(res => { if (res.success) setSports(res.data ?? []) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!can(user, 'staff:view')) return

    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search)  params.set('search',  search)
    if (roleId)  params.set('roleId',  roleId)
    if (sportId) params.set('sportId', String(sportId))

    fetch(`/api/staff?${params}`, { credentials: 'include' })
      .then(r => r.json() as Promise<StaffResponse>)
      .then(res => {
        if (!res.success) throw new Error('Failed to load staff')
        setStaff(res.data)
        setTotal(res.total)
      })
      .catch(() => setError('Failed to load staff.'))
      .finally(() => setLoading(false))
  }, [page, search, roleId, sportId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const sportOptions = [
    { value: '', label: 'All Sports' },
    ...sports.map(s => ({ value: String(s.id), label: s.name })),
  ]

  // ── Access control ──────────────────────────────────────────────────────────
  if (isLoading) return null
  if (!can(user, 'staff:view')) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole={requiredRoleLabel('staff:view')} />
  }

  const colCount = canManage ? 5 : 4

  return (
    <DataTablePage
      title="Staff"
      subtitle={`${total} members`}
      actions={canManage ? (
        <Button
          label="Add Staff"
          variant="outline"
          onClick={() => window.location.href = '/settings'}
        />
      ) : undefined}
      alerts={error ? <Alert message={error} variant="error" onClose={() => setError(null)} /> : undefined}
      filters={
        <div className={sports.length > 1 ? 'filters-grid-3' : 'filters-grid-2'}>
          <Input
            value={search}
            onChange={(v) => setFilter('search', v)}
            placeholder="Search name or email..."
          />
          {sports.length > 1 && (
            <Select
              value={sportId ? String(sportId) : ''}
              onChange={(v) => { setSportId(v ? Number(v) : null); setPage(1) }}
              options={sportOptions}
            />
          )}
          <Select value={roleId} onChange={(v) => setFilter('roleId', v)} options={ROLE_FILTER_OPTIONS} />
        </div>
      }
    >
      <div style={{ borderRadius: 12, border: '1px solid var(--color-card-border)', overflow: 'hidden' }}>
      <div className="table-scroll" style={{ backgroundColor: 'var(--color-card-bg)' }}>
        <table style={{ width: '100%', minWidth: 520, borderCollapse: 'collapse' }} aria-label="Staff list">
          <thead>
            <tr style={{ backgroundColor: theme.gray50, borderBottom: `1px solid ${theme.gray200}` }}>
              <th scope="col" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</th>
              <th scope="col" className="sticky-name-th" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
              <th scope="col" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</th>
              {sports.length > 1 && (
                <th scope="col" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sport</th>
              )}
              {canManage && (
                <th scope="col" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>Loading...</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={colCount} style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>No staff found</td></tr>
            ) : staff.map((member, i) => (
              <TableRow
                key={`${member.userId}-${member.userSportId}`}
                index={i}
                onActivate={() => {}}
                ariaLabel={`${member.firstName} ${member.lastName}`}
              >
                {/* Role badge */}
                <td style={{ padding: '12px 20px' }}>
                  <Badge
                    label={member.programRoleName}
                    variant={ROLE_BADGE[member.programRoleId] ?? 'gray'}
                  />
                </td>

                {/* Name — sticky */}
                <td className="sticky-name-td" style={{ padding: '12px 20px' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: theme.gray900 }}>
                    {member.lastName}, {member.firstName}
                  </span>
                  {member.position && (
                    <div style={{ fontSize: 12, color: theme.gray400, marginTop: 2 }}>{member.position}</div>
                  )}
                </td>

                {/* Email */}
                <td style={{ padding: '12px 20px', fontSize: 13, color: theme.gray600 }}>
                  <a
                    href={`mailto:${member.email}`}
                    onClick={e => e.stopPropagation()}
                    style={{ color: 'var(--color-primary)', textDecoration: 'none' }}
                  >
                    {member.email}
                  </a>
                </td>

                {/* Sport — only shown when multi-sport */}
                {sports.length > 1 && (
                  <td style={{ padding: '12px 20px', fontSize: 13, color: theme.gray600 }}>
                    {member.sportName}
                  </td>
                )}

                {/* Status + invite actions — managers only */}
                {canManage && (
                  <td style={{ padding: '12px 20px' }} onClick={e => e.stopPropagation()}>
                    {member.accountClaimed ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge label="Active" variant="green" />
                        <button
                          disabled={rowActions[member.userId] === 'sending'}
                          onClick={() => handleNotify(member)}
                          style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-card-border)', backgroundColor: 'var(--color-card-bg)', color: theme.gray600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {rowActions[member.userId] === 'sending' ? '…'
                            : rowActions[member.userId] === 'sent'    ? '✓ Sent'
                            : rowActions[member.userId] === 'error'   ? 'Error'
                            : 'Notify'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge label="Unclaimed" variant="warning" />
                        <button
                          disabled={rowActions[member.userId] === 'sending'}
                          onClick={() => handleResend(member)}
                          style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-card-border)', backgroundColor: 'var(--color-card-bg)', color: theme.gray600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {rowActions[member.userId] === 'sending' ? '…'
                            : rowActions[member.userId] === 'sent'    ? '✓ Sent'
                            : rowActions[member.userId] === 'error'   ? 'Error'
                            : 'Resend Invite'}
                        </button>
                        <button
                          disabled={copyStates[member.userId] === 'copying'}
                          onClick={() => handleCopyLink(member)}
                          title="Copy personal invite link"
                          style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-card-border)', backgroundColor: 'var(--color-card-bg)', color: theme.gray600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {copyStates[member.userId] === 'copying' ? '…'
                            : copyStates[member.userId] === 'copied'  ? '✓ Copied'
                            : copyStates[member.userId] === 'error'   ? 'Error'
                            : '🔗 Copy Link'}
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </TableRow>
            ))}
          </tbody>
        </table>
      </div>
      </div>

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
    </DataTablePage>
  )
}
