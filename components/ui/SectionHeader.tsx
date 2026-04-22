import { theme } from '@/lib/theme'

export interface SectionHeaderProps {
  title:     string
  subtitle?: string
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2
        style={{
          fontSize:      12,
          fontWeight:    700,
          color:         theme.primary,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          margin:        0,
          paddingBottom: 8,
          borderBottom:  `2px solid ${theme.primaryLight}`,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: theme.gray500, marginTop: 6, marginBottom: 0 }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

export default SectionHeader
