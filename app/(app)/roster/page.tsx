'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { useAuth } from '@/providers/AuthProvider'
import { useFilteredPagination } from '@/hooks/useFilteredPagination'
import { DataTablePage } from '@/components/ui/DataTablePage'
import { Button }        from '@/components/ui/Button'
import { Input }         from '@/components/ui/Input'
import { Select }        from '@/components/ui/Select'
import { Badge }         from '@/components/ui/Badge'
import { Alert }         from '@/components/ui/Alert'
import { TableRow }      from '@/components/ui/TableRow'
import { Pagination }    from '@/components/ui/Pagination'
import { AccessDenied }  from '@/components/ui/AccessDenied'
import { can, roleLabel, requiredRoleLabel } from '@/lib/permissions'
import { theme } from '@/lib/theme'
import { resendInvite, notifyTeamAdded, generateInviteCode } from '@/app/actions/members'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  userId:         string
  firstName:      string
  lastName:       string
  email:          string
  jerseyNumber:   number | null
  position:       string
  academicYear:   string
  accountClaimed: boolean
  major?:         string
}

type RowActionState  = 'idle' | 'sending' | 'sent' | 'error'
type CopyLinkState   = 'idle' | 'copying' | 'copied' | 'error'

interface PlayersResponse {
  success: boolean
  data:    Player[]
  total:   number
}

interface SportOption { id: number; name: string; abbr: string }

const PAGE_SIZE = 50

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RosterPage() {
  const router = useRouter()
  const config = useTeamConfig()
  const { user, isLoading } = useAuth()

  const canTransfer = can(user, 'roster:promote_to_alumni')
  const canManage   = can(user, 'roster:manage')

  // All hooks must be called unconditionally before any early return.
  const { filters: { search, position, year }, setFilter, page, setPage } =
    useFilteredPagination({ search: '', position: '', year: '' })

  const [players,    setPlayers]    = useState<Player[]>([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [sports,     setSports]     = useState<SportOption[]>([])
  const [sportId,    setSportId]    = useState<number | null>(null)
  const [rowActions,  setRowActions]  = useState<Record<string, RowActionState>>({})
  const [copyStates,  setCopyStates]  = useState<Record<string, CopyLinkState>>({})

  const setRowAction = (userId: string, state: RowActionState) =>
    setRowActions(prev => ({ ...prev, [userId]: state }))

  const handleResend = async (player: Player) => {
    if (!user?.currentTeamId) return
    setRowAction(player.userId, 'sending')
    const result = await resendInvite({
      email:     player.email,
      firstName: player.firstName,
      teamId:    user.currentTeamId,
      teamName:  config.teamName,
      role:      'player',
    })
    setRowAction(player.userId, result.success ? 'sent' : 'error')
    if (result.success) setTimeout(() => setRowAction(player.userId, 'idle'), 3000)
  }

  const handleCopyLink = async (player: Player) => {
    if (!user?.currentTeamId) return
    setCopyStates(prev => ({ ...prev, [player.userId]: 'copying' }))
    const result = await generateInviteCode({
      teamId:  user.currentTeamId,
      role:    'player',
      maxUses: 1,
    })
    if (result.success && result.inviteUrl) {
      try {
        const claimUrl = `${result.inviteUrl}&e=${encodeURIComponent(player.email)}`
        await navigator.clipboard.writeText(claimUrl)
        setCopyStates(prev => ({ ...prev, [player.userId]: 'copied' }))
        setTimeout(() => setCopyStates(prev => ({ ...prev, [player.userId]: 'idle' })), 2500)
      } catch {
        setCopyStates(prev => ({ ...prev, [player.userId]: 'error' }))
      }
    } else {
      setCopyStates(prev => ({ ...prev, [player.userId]: 'error' }))
    }
  }

  const handleNotify = async (player: Player) => {
    setRowAction(player.userId, 'sending')
    const result = await notifyTeamAdded({
      email:     player.email,
      firstName: player.firstName,
      teamName:  config.teamName,
    })
    setRowAction(player.userId, result.success ? 'sent' : 'error')
    if (result.success) setTimeout(() => setRowAction(player.userId, 'idle'), 3000)
  }

  useEffect(() => {
    fetch('/api/sports', { credentials: 'include' })
      .then(r => r.json())
      .then(res => { if (res.success) setSports(res.data ?? []) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!can(user, 'roster:view')) return  // don't fetch if no access

    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search)   params.set('search',      search)
    if (position) params.set('position',    position)
    if (year)     params.set('academicYear', year)
    if (sportId)  params.set('sportId',     String(sportId))

    fetch(`/api/players?${params}`, { credentials: 'include' })
      .then((r) => r.json() as Promise<PlayersResponse>)
      .then((res) => {
        if (!res.success) throw new Error('Failed to load players')
        setPlayers(res.data)
        setTotal(res.total)
      })
      .catch(() => setError('Failed to load players.'))
      .finally(() => setLoading(false))
  }, [page, search, position, year, sportId, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const sportOptions = [
    { value: '', label: 'All Sports' },
    ...sports.map(s => ({ value: String(s.id), label: s.name })),
  ]

  const positionOptions = [
    { value: '', label: 'All Positions' },
    ...config.positions.map((p) => ({ value: p, label: p })),
  ]

  const yearOptions = [
    { value: '', label: 'All Years' },
    ...config.academicYears.map((y) => ({ value: y, label: y })),
  ]

  // ── Access control ──────────────────────────────────────────────────────────
  if (isLoading) return null
  if (!can(user, 'roster:view')) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole={requiredRoleLabel('roster:view')} />
  }

  return (
    <DataTablePage
      title={config.rosterLabel ?? 'Roster'}
      subtitle={`${total} players`}
      actions={canTransfer ? (
        <>
          <Button label="Transfer to Alumni" variant="outline" onClick={() => router.push('/roster/transfer')} />
        </>
      ) : undefined}
      alerts={error ? <Alert message={error} variant="error" onClose={() => setError(null)} /> : undefined}
      filters={
        <div className={sports.length > 1 ? 'filters-grid-4' : 'filters-grid-3'}>
          <Input
            value={search}
            onChange={(v) => setFilter('search', v)}
            placeholder="Search name or jersey #..."
          />
          {sports.length > 1 && (
            <Select
              value={sportId ? String(sportId) : ''}
              onChange={(v) => { setSportId(v ? Number(v) : null); setPage(1) }}
              options={sportOptions}
            />
          )}
          <Select value={year}     onChange={(v) => setFilter('year', v)}     options={yearOptions}     />
          <Select value={position} onChange={(v) => setFilter('position', v)} options={positionOptions} />
        </div>
      }
    >
      {/* Outer div clips border-radius; inner div scrolls horizontally */}
      <div style={{ borderRadius: 12, border: '1px solid var(--color-card-border)', overflow: 'hidden' }}>
      <div className="table-scroll" style={{ backgroundColor: 'var(--color-card-bg)' }}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }} aria-label="Player roster">
          <thead>
            <tr style={{ backgroundColor: theme.gray50, borderBottom: `1px solid ${theme.gray200}` }}>
              <th scope="col" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
              <th scope="col" className="sticky-name-th" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Name</th>
              <th scope="col" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Position</th>
              <th scope="col" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Year</th>
              {canManage && <th scope="col" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>}
              <th scope="col" style={{ padding: '12px 20px' }}><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={canManage ? 6 : 5} style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>Loading...</td></tr>
            ) : players.length === 0 ? (
              <tr><td colSpan={canManage ? 6 : 5} style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>No players found</td></tr>
            ) : players.map((player, i) => (
              <TableRow
                key={player.userId}
                index={i}
                onActivate={() => router.push(`/roster/${player.userId}`)}
                ariaLabel={`View ${player.firstName} ${player.lastName}`}
              >
                {/* Jersey */}
                <td style={{ padding: '12px 20px' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    backgroundColor: 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 700,
                  }}>
                    {player.jerseyNumber ?? '—'}
                  </div>
                </td>

                {/* Name — sticky */}
                <td className="sticky-name-td" style={{ padding: '12px 20px' }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: theme.gray900 }}>
                    {player.lastName}, {player.firstName}
                  </span>
                  {config.level === 'college' && player.major && (
                    <div style={{ fontSize: 12, color: theme.gray400, marginTop: 2 }}>{player.major}</div>
                  )}
                </td>

                {/* Position */}
                <td style={{ padding: '12px 20px' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary)' }}>
                    {player.position}
                  </span>
                </td>

                {/* Year */}
                <td style={{ padding: '12px 20px', fontSize: 13, color: theme.gray600, textTransform: 'capitalize' }}>
                  {player.academicYear ?? '—'}
                </td>

                {/* Status + invite action — managers only */}
                {canManage && (
                  <td style={{ padding: '12px 20px' }} onClick={e => e.stopPropagation()}>
                    {player.accountClaimed ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge label="Active" variant="green" />
                        <button
                          disabled={rowActions[player.userId] === 'sending'}
                          onClick={() => handleNotify(player)}
                          style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-card-border)', backgroundColor: 'var(--color-card-bg)', color: theme.gray600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {rowActions[player.userId] === 'sending' ? '…'
                            : rowActions[player.userId] === 'sent'    ? '✓ Sent'
                            : rowActions[player.userId] === 'error'   ? 'Error'
                            : 'Notify'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge label="Unclaimed" variant="warning" />
                        <button
                          disabled={rowActions[player.userId] === 'sending'}
                          onClick={() => handleResend(player)}
                          style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-card-border)', backgroundColor: 'var(--color-card-bg)', color: theme.gray600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {rowActions[player.userId] === 'sending' ? '…'
                            : rowActions[player.userId] === 'sent'    ? '✓ Sent'
                            : rowActions[player.userId] === 'error'   ? 'Error'
                            : 'Resend Invite'}
                        </button>
                        <button
                          disabled={copyStates[player.userId] === 'copying'}
                          onClick={() => handleCopyLink(player)}
                          title="Copy invite link"
                          style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--color-card-border)', backgroundColor: 'var(--color-card-bg)', color: theme.gray600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {copyStates[player.userId] === 'copying' ? '…'
                            : copyStates[player.userId] === 'copied'  ? '✓ Copied'
                            : copyStates[player.userId] === 'error'   ? 'Error'
                            : '🔗 Copy Link'}
                        </button>
                      </div>
                    )}
                  </td>
                )}

                {/* Arrow */}
                <td style={{ padding: '12px 20px', color: theme.gray300, fontSize: 18 }}>›</td>
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
