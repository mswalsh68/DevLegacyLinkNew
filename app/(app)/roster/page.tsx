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
import { playerStatusBadge } from '@/lib/statusMappings'
import { can, roleLabel, requiredRoleLabel } from '@/lib/permissions'
import { theme } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SportOption {
  id:   string
  name: string
  abbr: string
}

interface Player {
  userId:       string
  firstName:    string
  lastName:     string
  jerseyNumber: number | null
  position:     string
  academicYear: string
  status:       string
  major?:       string
}

interface PlayersResponse {
  success: boolean
  data:    Player[]
  total:   number
}

const PAGE_SIZE = 50

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RosterPage() {
  const router = useRouter()
  const config = useTeamConfig()
  const { user, isLoading } = useAuth()

  const isAdmin = ['global_admin', 'platform_owner', 'app_admin'].includes(user?.role ?? '')

  // All hooks must be called unconditionally before any early return.
  const { filters: { search, position, year, sportId }, setFilter, page, setPage } =
    useFilteredPagination({ search: '', position: '', year: '', sportId: '' })

  const [players,  setPlayers]  = useState<Player[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [sports,   setSports]   = useState<SportOption[]>([])

  useEffect(() => {
    fetch('/api/sports', { credentials: 'include' })
      .then(r => r.json())
      .then((d: { success: boolean; data: SportOption[] }) => {
        if (d.success) setSports(d.data ?? [])
      })
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
    if (sportId)  params.set('sportId',     sportId)

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

  const positionOptions = [
    { value: '', label: 'All Positions' },
    ...config.positions.map((p) => ({ value: p, label: p })),
  ]

  const yearOptions = [
    { value: '', label: 'All Years' },
    ...config.academicYears.map((y) => ({ value: y, label: y })),
  ]

  const sportOptions = [
    { value: '', label: 'All Sports' },
    ...sports.map((s) => ({ value: s.id, label: s.name })),
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
      actions={isAdmin ? (
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
          <Select value={year}     onChange={(v) => setFilter('year', v)}     options={yearOptions}     />
          <Select value={position} onChange={(v) => setFilter('position', v)} options={positionOptions} />
          {sports.length > 1 && (
            <Select value={sportId as string} onChange={(v) => setFilter('sportId', v)} options={sportOptions} />
          )}
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
              <th scope="col" style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
              <th scope="col" style={{ padding: '12px 20px' }}><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>Loading...</td></tr>
            ) : players.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>No players found</td></tr>
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

                {/* Status */}
                <td style={{ padding: '12px 20px' }}>
                  <Badge label={player.status} variant={playerStatusBadge(player.status)} />
                </td>

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
