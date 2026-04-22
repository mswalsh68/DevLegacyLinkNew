'use client'

import { type HTMLAttributes, type ReactNode } from 'react'
import { theme } from '@/lib/theme'

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** 0-based row index — drives even/odd striping */
  index:       number
  /** Called when the row is clicked or activated via keyboard */
  onActivate:  () => void
  /** Accessible label for the row, e.g. "View Jane Doe" */
  ariaLabel?:  string
  /** Background for even-index rows. Defaults to white. */
  evenBg?:     string
  /** Whether this row is currently selected/expanded */
  isSelected?: boolean
  children:    ReactNode
}

/**
 * Interactive table row with even/odd striping, primaryLight hover,
 * and full keyboard accessibility (Enter / Space to activate).
 */
export function TableRow({
  index,
  onActivate,
  ariaLabel,
  evenBg     = theme.white,
  isSelected = false,
  children,
  ...rest
}: TableRowProps) {
  const oddBg  = theme.gray50
  const baseBg = isSelected
    ? theme.primaryLight
    : index % 2 === 0 ? evenBg : oddBg

  return (
    <tr
      onClick={onActivate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onActivate() }}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      style={{
        borderBottom:    `1px solid ${theme.gray100}`,
        backgroundColor: baseBg,
        cursor:          'pointer',
        transition:      'background-color 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.primaryLight)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor =
        isSelected ? theme.primaryLight : (index % 2 === 0 ? evenBg : oddBg)
      )}
      {...rest}
    >
      {children}
    </tr>
  )
}

export default TableRow
