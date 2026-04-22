// DataTablePage
//
// Consistent layout wrapper for all list / admin pages.
// Enforces the shared header → alerts → filters → table structure
// so individual pages only define their own data and controls.
//
// NOTE: This component renders content only — the outer page shell
// (nav, page background, max-width centering) is provided by
// app/(app)/layout.tsx, so no PageLayout wrapping is needed here.

import { type ReactNode } from 'react'
import { theme } from '@/lib/theme'

export interface DataTablePageProps {
  /** Page heading */
  title:      ReactNode
  /** Sub-heading, e.g. "42 records" */
  subtitle?:  ReactNode
  /** Action buttons rendered top-right of the header */
  actions?:   ReactNode
  /** Alert banners (error / success) rendered below the header */
  alerts?:    ReactNode
  /** Filter controls rendered below alerts */
  filters?:   ReactNode
  /** Table + pagination */
  children:   ReactNode
  /** Optional — kept for API compat with pages that pass a currentPage label */
  currentPage?: string
}

export function DataTablePage({
  title,
  subtitle,
  actions,
  alerts,
  filters,
  children,
}: DataTablePageProps) {
  return (
    <>
      {/* ── Header ── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          marginBottom:   24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: theme.gray900, margin: 0 }}>
            {title}
          </h1>
          {subtitle !== undefined && (
            <p style={{ fontSize: 14, color: theme.gray500, marginTop: 4 }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', gap: 10 }}>{actions}</div>
        )}
      </div>

      {/* ── Alerts ── */}
      {alerts}

      {/* ── Filters ── */}
      {filters}

      {/* ── Table + pagination ── */}
      {children}
    </>
  )
}

export default DataTablePage
