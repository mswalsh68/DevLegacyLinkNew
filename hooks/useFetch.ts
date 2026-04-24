'use client'

/**
 * useFetch — data-fetching hook used by list and detail pages.
 *
 * Usage:
 *   const { data, loading, error, clearError, refetch } = useFetch<{ data: Player[]; total: number }>(
 *     '/players',
 *     { page, pageSize: 50, search },
 *     [page, search],
 *     'Failed to load players.',
 *   )
 *
 * - Fetches automatically when deps change.
 * - Returns stable `refetch` callback to reload on demand.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { appApi } from '@/lib/api'

export function useFetch<T>(
  path:         string,
  params:       Record<string, unknown>,
  deps:         unknown[],
  errorMessage?: string,
) {
  const [data,    setData]    = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  // Avoid stale closure by storing params in a ref
  const paramsRef = useRef(params)
  paramsRef.current = params

  const clearError = useCallback(() => setError(''), [])

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const { data: res } = await appApi.get<T>(path, { params: paramsRef.current })
      setData(res)
      setError('')
    } catch (err) {
      setError(errorMessage ?? (err instanceof Error ? err.message : 'An error occurred'))
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, errorMessage, ...deps])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { data, loading, error, clearError, refetch: fetch }
}
