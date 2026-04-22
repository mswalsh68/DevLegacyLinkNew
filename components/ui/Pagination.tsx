'use client'

import { Button } from '@/components/ui/Button'
import { theme } from '@/lib/theme'

export interface PaginationProps {
  page:     number
  total:    number
  pageSize: number
  onPage:   (page: number) => void
}

/**
 * Renders "Showing X–Y of Z" + Prev / Next buttons.
 * Returns null when all records fit on one page.
 */
export function Pagination({ page, total, pageSize, onPage }: PaginationProps) {
  if (total <= pageSize) return null

  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)

  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        marginTop:      16,
      }}
    >
      <span style={{ fontSize: 13, color: theme.gray500 }}>
        Showing {start}–{end} of {total}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button
          label="← Previous"
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        />
        <Button
          label="Next →"
          variant="outline"
          size="sm"
          disabled={end >= total}
          onClick={() => onPage(page + 1)}
        />
      </div>
    </div>
  )
}

export default Pagination
