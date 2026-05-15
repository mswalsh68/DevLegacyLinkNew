'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { theme } from '@/lib/theme'
import { Alert, Button } from '@/components'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CommsDashboardTabProps {
  metricsEndpoint: string
  sportId?:        number | null
  title:           string
  subtitle:        string
  errorMessage:    string
  renderMetrics:   (metrics: unknown, features: string[]) => ReactNode
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CommsDashboardTab({
  metricsEndpoint,
  sportId,
  title,
  subtitle,
  errorMessage,
  renderMetrics,
}: CommsDashboardTabProps) {
  const router = useRouter()

  const [metrics,  setMetrics]  = useState<unknown>(null)
  const [features, setFeatures] = useState<string[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = sportId
        ? `/api${metricsEndpoint}?sportId=${encodeURIComponent(sportId)}`
        : `/api${metricsEndpoint}`
      const res = await fetch(url, { credentials: 'include' }).then(r => r.json())
      setMetrics(res.data)
      setFeatures(res.features_available ?? [])
    } catch {
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [metricsEndpoint, sportId, errorMessage])

  useEffect(() => { load() }, [load])

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.gray900, margin: 0 }}>{title}</h2>
          <p style={{ fontSize: 13, color: theme.gray500, marginTop: 2 }}>{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button label="+ New Post"     onClick={() => router.push('/feed/new')}   />
          <Button label="+ Create Email" onClick={() => router.push('/email/new')} />
        </div>
      </div>

      {error && <div style={{ marginBottom: 16 }}><Alert variant="error" message={error} /></div>}

      {loading ? (
        <p style={{ color: theme.gray500, padding: '40px 0', textAlign: 'center' }}>Loading…</p>
      ) : (
        metrics && renderMetrics(metrics, features)
      )}

    </>
  )
}
