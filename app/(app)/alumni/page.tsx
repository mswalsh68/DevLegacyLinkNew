'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { useAuth } from '@/providers/AuthProvider'
import { useFilteredPagination } from '@/hooks/useFilteredPagination'
import { DataTablePage } from '@/components/ui/DataTablePage'
import { Input }         from '@/components/ui/Input'
import { Select }        from '@/components/ui/Select'
import { Badge }         from '@/components/ui/Badge'
import { Alert }         from '@/components/ui/Alert'
import { TableRow }      from '@/components/ui/TableRow'
import { Pagination }    from '@/components/ui/Pagination'
import { alumniStatusBadge } from '@/lib/statusMappings'
import { theme } from '@/lib/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlumniRecord {
  userId:          string
  firstName:       string
  lastName:        string
  graduationYear:  number
  graduationSemester?: string
  position:        string
  currentEmployer?: string
  currentJobTitle?: string
  currentCity?:    string
  currentState?:   string
  status:          string
  isDonor:         boolean
}

interface AlumniResponse {
  success: boolean
  data:    AlumniRecord[]
  total:   number
}

const PAGE_SIZE = 50

const STATUS_OPTIONS = [
  { value: '',             label: 'All Statuses'   },
  { value: 'active',       label: 'Active'         },
  { value: 'lostContact',  label: 'Lost Contact'   },
  { value: 'doNotContact', label: 'Do Not Contact' },
  { value: 'deceased',     label: 'Deceased'       },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlumniPage() {
  const router = useRouter()
  const config = useTeamConfig()
  const { user } = useAuth()

  const isAdmin = ['global_admin', 'platform_owner', 'app_admin'].includes(user?.role ?? '')

  const { filters: { search, status, position, isDonor }, setFilter, page, setPage } =
    useFilteredPagination({ search: '', status: '', position: '', isDonor: false })

  const [alumni,   setAlumni]  = useState<AlumniRecord[]>([])
  const [total,    setTotal]   = useState(0)
  const [loading,  setLoading] = useState(true)
  const [error,    setError]   = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search)   params.set('search',   search)
    if (status)   params.set('status',   status)
    if (position) params.set('position', position)
    if (isDonor)  params.set('isDonor',  'true')

    fetch(`/api/alumni?${params}`, { credentials: 'include' })
      .then((r) => r.json() as Promise<AlumniResponse>)
      .then((res) => {
        if (!res.success) throw new Error('Failed to load alumni')
        setAlumni(res.data)
        setTotal(res.total)
      })
      .catch(() => setError('Failed to load alumni.'))
      .finally(() => setLoading(false))
  }, [page, search, status, position, isDonor])

  const positionOptions = [
    { value: '', label: 'All Positions' },
    ...config.positions.map((p) => ({ value: p, label: p })),
  ]

  const alumniLabel = config.alumniLabel ?? 'Alumni'

  return (
    <DataTablePage
      title={alumniLabel}
      subtitle={`${total} records`}
      alerts={error ? <Alert message={error} variant="error" onClose={() => setError(null)} /> : undefined}
      filters={
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Input
              value={search}
              onChange={(v) => setFilter('search', v)}
              placeholder="Search name, employer, city..."
            />
            <Select value={status}   onChange={(v) => setFilter('status', v)}   options={STATUS_OPTIONS}   />
            <Select value={position} onChange={(v) => setFilter('position', v)} options={positionOptions}  />
          </div>
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setFilter('isDonor', !isDonor)}
              style={{
                padding:         '6px 16px',
                borderRadius:    999,
                border:          `1.5px solid ${isDonor ? 'var(--color-primary)' : theme.gray200}`,
                backgroundColor: isDonor ? 'var(--color-primary-light)' : '#fff',
                color:           isDonor ? 'var(--color-primary-dark)' : theme.gray600,
                fontSize:        13,
                fontWeight:      600,
                cursor:          'pointer',
              }}
            >
              ⭐ Donors only
            </button>
          </div>
        </>
      }
    >
      <div style={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid var(--color-card-border)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Alumni list">
          <thead>
            <tr style={{ backgroundColor: theme.gray50, borderBottom: `1px solid ${theme.gray200}` }}>
              {['Class', 'Name', 'Position', 'Employer', 'Location', 'Status', 'Donor', ''].map((h) => (
                <th
                  key={h}
                  scope="col"
                  style={{ textAlign: 'left', padding: '12px 20px', fontSize: 11, fontWeight: 600, color: theme.gray500, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                  {h || <span className="sr-only">View</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>Loading...</td></tr>
            ) : alumni.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: theme.gray400 }}>No alumni found</td></tr>
            ) : alumni.map((a, i) => (
              <TableRow
                key={a.userId}
                index={i}
                onActivate={() => router.push(`/alumni/${a.userId}`)}
                ariaLabel={`View ${a.firstName} ${a.lastName}`}
              >
                {/* Class year bubble */}
                <td style={{ padding: '12px 20px' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    backgroundColor: 'var(--color-accent-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-accent-dark)', fontSize: 12, fontWeight: 700,
                  }}>
                    &apos;{String(a.graduationYear ?? '').slice(-2)}
                  </div>
                </td>

                {/* Name */}
                <td style={{ padding: '12px 20px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: theme.gray900 }}>
                    {a.lastName}, {a.firstName}
                  </div>
                  {a.graduationSemester && (
                    <div style={{ fontSize: 12, color: theme.gray400, marginTop: 2, textTransform: 'capitalize' }}>
                      {a.graduationSemester} {a.graduationYear}
                    </div>
                  )}
                </td>

                {/* Position */}
                <td style={{ padding: '12px 20px' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary)' }}>
                    {a.position}
                  </span>
                </td>

                {/* Employer */}
                <td style={{ padding: '12px 20px', fontSize: 13, color: theme.gray600 }}>
                  {a.currentEmployer ?? '—'}
                  {a.currentJobTitle && (
                    <div style={{ fontSize: 11, color: theme.gray400, marginTop: 1 }}>{a.currentJobTitle}</div>
                  )}
                </td>

                {/* Location */}
                <td style={{ padding: '12px 20px', fontSize: 13, color: theme.gray600 }}>
                  {a.currentCity && a.currentState ? `${a.currentCity}, ${a.currentState}` : '—'}
                </td>

                {/* Status */}
                <td style={{ padding: '12px 20px' }}>
                  <Badge label={a.status} variant={alumniStatusBadge(a.status)} />
                </td>

                {/* Donor */}
                <td style={{ padding: '12px 20px' }}>
                  {a.isDonor
                    ? <Badge label="Donor" variant="gold" />
                    : <span style={{ color: theme.gray300, fontSize: 13 }}>—</span>}
                </td>

                {/* Arrow */}
                <td style={{ padding: '12px 20px', color: theme.gray300, fontSize: 18 }}>›</td>
              </TableRow>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
    </DataTablePage>
  )
}
