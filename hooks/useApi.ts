'use client'

// Generic data-fetching hook. Wraps fetch with loading / error state.
// Use this instead of raw fetch in client components.
import { useEffect, useState } from 'react'

interface UseApiResult<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useApi<T>(url: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(url, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<T>
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url, tick])

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) }
}
