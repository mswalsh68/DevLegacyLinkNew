import type { CSSProperties, ReactNode } from 'react'

// Simple card container — all values via CSS custom properties so they
// respond to runtime theme switches without a re-render.

interface CardProps {
  children:  ReactNode
  style?:    CSSProperties
  padding?:  number | string
  className?: string
}

export function Card({ children, style, padding = 24, className }: CardProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border:          '1px solid var(--color-card-border)',
        borderRadius:    'var(--radius-lg)',
        boxShadow:       'var(--shadow-sm)',
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export default Card
