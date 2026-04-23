'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { Button }  from '@/components/ui/Button'
import { Select }  from '@/components/ui/Select'
import { Alert }   from '@/components/ui/Alert'
import { Badge }   from '@/components/ui/Badge'
import { theme }   from '@/lib/theme'
import { SEMESTER_OPTIONS, makeYearOptions } from '@/lib/constants'
import { AccessDenied }  from '@/components/ui/AccessDenied'
import { can, roleLabel, requiredRoleLabel } from '@/lib/permissions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  userId:       string
  firstName:    string
  lastName:     string
  jerseyNumber: number | null
  position:     string
  academicYear: string
  status:       string
  recruitingClass?: number
}

interface TransferResult {
  transferredCount: number
  failures: { reason: string }[]
}

const YEAR_OPTIONS = makeYearOptions(10).map((y) => ({ value: String(y), label: String(y) }))

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransferPage() {
  const router  = useRouter()
  const { user, isLoading } = useAuth()

  const currentYear = new Date().getFullYear()

  const [players,          setPlayers]          = useState<Player[]>([])
  const [loading,          setLoading]          = useState(true)
  const [selectedIds,      setSelectedIds]      = useState<Set<string>>(new Set())
  const [transferYear,     setTransferYear]     = useState(String(currentYear))
  const [transferSemester, setTransferSemester] = useState('spring')
  const [submitting,       setSubmitting]       = useState(false)
  const [alert,            setAlert]            = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null)
  const [result,           setResult]           = useState<TransferResult | null>(null)
  const [search,           setSearch]           = useState('')

  const allowed = can(user, 'roster:transfer')

  useEffect(() => {
    if (!allowed) return
    fetchPlayers()
  }, [allowed]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPlayers = () => {
    setLoading(true)
    fetch('/api/players?pageSize=200&status=active', { credentials: 'include' })
      .then((r) => r.json())
      .then((res: { success: boolean; data: Player[] }) => setPlayers(res.data ?? []))
      .catch(() => setAlert({ msg: 'Failed to load players.', type: 'error' }))
      .finally(() => setLoading(false))
  }

  const filteredPlayers = players.filter((p) =>
    !search ||
    `${p.firstName} ${p.lastName} ${p.jerseyNumber ?? ''}`.toLowerCase().includes(search.toLowerCase()),
  )

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filteredPlayers.length && filteredPlayers.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredPlayers.map((p) => p.userId)))
    }
  }

  const handleTransfer = async () => {
    if (selectedIds.size === 0) {
      setAlert({ msg: 'Select at least one player.', type: 'warning' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/players/transfer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          playerIds:        Array.from(selectedIds),
          transferYear:     parseInt(transferYear),
          transferSemester,
        }),
      })
      const json = await res.json() as { success: boolean; data: TransferResult; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Transfer failed')

      const data = json.data
      setResult(data)
      setSelectedIds(new Set())
      fetchPlayers()
      setAlert({
        msg:  `${data.transferredCount} player(s) moved to Alumni successfully.`,
        type: data.failures?.length > 0 ? 'warning' : 'success',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed. No changes were made.'
      setAlert({ msg, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) return null
  if (!allowed) {
    return <AccessDenied currentRole={roleLabel(user?.role)} requiredRole={requiredRoleLabel('roster:transfer')} />
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.gray900, margin: 0 }}>Transfer to Alumni</h1>
          <p style={{ fontSize: 14, color: theme.gray500, marginTop: 4 }}>
            Move players from the active roster to the Alumni database
          </p>
        </div>
        <Button label="← Back to Roster" variant="outline" onClick={() => router.push('/roster')} />
      </div>

      {alert && <Alert message={alert.msg} variant={alert.type} onClose={() => setAlert(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left: Departure period + submit ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ backgroundColor: '#fff', border: '1px solid var(--color-card-border)', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: 12, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14, marginTop: 0 }}>
              Departure Period
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Select label="Year"     value={transferYear}     onChange={setTransferYear}     options={YEAR_OPTIONS}     />
              <Select label="Semester" value={transferSemester} onChange={setTransferSemester} options={SEMESTER_OPTIONS} />
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div style={{ backgroundColor: 'var(--color-primary-light)', border: '1.5px solid var(--color-primary)', borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--color-primary-dark)', fontWeight: 600, margin: '0 0 6px 0' }}>
                Ready to transfer {selectedIds.size} player{selectedIds.size !== 1 ? 's' : ''}
              </p>
              <p style={{ fontSize: 12, color: 'var(--color-primary-dark)', margin: '0 0 14px 0', opacity: 0.8, textTransform: 'capitalize' }}>
                {transferSemester} {transferYear}
              </p>
              <Button
                label={submitting ? 'Transferring...' : `Transfer ${selectedIds.size} Player${selectedIds.size !== 1 ? 's' : ''} to Alumni`}
                loading={submitting}
                fullWidth
                onClick={handleTransfer}
              />
              <p style={{ fontSize: 11, color: theme.gray500, textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
                This moves players to Alumni and removes roster access.
              </p>
            </div>
          )}
        </div>

        {/* ── Right: Player selection ── */}
        <div style={{ backgroundColor: '#fff', border: '1px solid var(--color-card-border)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          {/* Search + select all */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${theme.gray200}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: `1.5px solid ${theme.gray200}`, borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none', width: 200 }}
              />
              <span style={{ fontSize: 13, color: theme.gray500 }}>
                {selectedIds.size} of {filteredPlayers.length} selected
              </span>
            </div>
            <button
              onClick={toggleAll}
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {selectedIds.size === filteredPlayers.length && filteredPlayers.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Player list */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>Loading players...</div>
          ) : filteredPlayers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>No active players found</div>
          ) : (
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {filteredPlayers.map((player, i) => {
                const selected = selectedIds.has(player.userId)
                return (
                  <button
                    key={player.userId}
                    type="button"
                    onClick={() => toggleSelect(player.userId)}
                    style={{
                      display:         'flex',
                      alignItems:      'center',
                      gap:             14,
                      padding:         '12px 20px',
                      backgroundColor: selected ? 'var(--color-primary-light)' : (i % 2 === 0 ? '#fff' : theme.gray50),
                      cursor:          'pointer',
                      transition:      'background-color 0.1s',
                      border:          'none',
                      borderBottom:    `1px solid ${theme.gray100}`,
                      width:           '100%',
                      textAlign:       'left',
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width:           20,
                      height:          20,
                      borderRadius:    5,
                      border:          `2px solid ${selected ? 'var(--color-primary)' : theme.gray300}`,
                      backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                      flexShrink:      0,
                      transition:      'all 0.15s',
                    }}>
                      {selected && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>

                    {/* Jersey */}
                    <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                      {player.jerseyNumber ?? '—'}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: theme.gray900 }}>
                        {player.lastName}, {player.firstName}
                      </div>
                      <div style={{ fontSize: 12, color: theme.gray500, marginTop: 2 }}>
                        {player.position} · {player.academicYear ?? '—'}{player.recruitingClass ? ` · Class of ${player.recruitingClass}` : ''}
                      </div>
                    </div>

                    <Badge label="active" variant="green" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Failure summary */}
      {result && result.failures?.length > 0 && (
        <div style={{ marginTop: 20, backgroundColor: '#fff', border: '1px solid var(--color-card-border)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: theme.gray900, marginBottom: 12, marginTop: 0 }}>
            Transfer failures ({result.failures.length})
          </h2>
          {result.failures.map((f, i) => (
            <div key={i} style={{ backgroundColor: 'var(--color-danger-light)', borderRadius: 8, padding: '8px 12px', marginBottom: 6, fontSize: 13, color: 'var(--color-danger)' }}>
              {f.reason}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
