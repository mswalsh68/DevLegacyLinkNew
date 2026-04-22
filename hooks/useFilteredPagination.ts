'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * useFilteredPagination
 *
 * Manages a set of filter values together with a page counter.
 * Any filter change automatically resets the page to 1.
 *
 * @example
 *   const { filters, setFilter, page, setPage } = useFilteredPagination({
 *     search: '', status: '', position: '',
 *   })
 *
 *   // No manual setPage(1) needed on every filter change:
 *   <Input onChange={(v) => setFilter('search', v)} value={filters.search} />
 */
export function useFilteredPagination<T extends Record<string, unknown>>(
  initialFilters: T,
  initialPage = 1,
) {
  const [filters, setFilters] = useState<T>(initialFilters)
  const [page,    setPage]    = useState(initialPage)

  // Skip the page reset on the very first mount.
  const mounted = useRef(false)

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    setPage(1)
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps
  // ^ intentionally excludes `page` — we only reset on filter change,
  //   not when page itself changes (that would cause an infinite loop).

  /** Update a single filter key; automatically resets page to 1. */
  function setFilter<K extends keyof T>(key: K, value: T[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  /** Reset all filters to their initial values; automatically resets page to 1. */
  function resetFilters() {
    setFilters(initialFilters)
  }

  return { filters, setFilter, setFilters, resetFilters, page, setPage }
}
