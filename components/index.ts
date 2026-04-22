// ─── Barrel export — all shared UI components ─────────────────────────────────
// Pages import from '@/components' rather than individual file paths.

export { Alert }         from './ui/Alert'
export { Badge }         from './ui/Badge'
export { Button }        from './ui/Button'
export { Card }          from './ui/Card'
export { DataTablePage } from './ui/DataTablePage'
export { Input }         from './ui/Input'
export { Modal }         from './ui/Modal'
export { Pagination }    from './ui/Pagination'
export { SectionHeader } from './ui/SectionHeader'
export { Select }        from './ui/Select'
export { TableRow }      from './ui/TableRow'
export { Textarea }      from './ui/Textarea'

// App-level components
export { InviteBanner }  from './app/InviteBanner'

// Re-export types for convenience
export type { AlertProps }         from './ui/Alert'
export type { BadgeProps, BadgeVariant } from './ui/Badge'
export type { ButtonProps }        from './ui/Button'
export type { DataTablePageProps } from './ui/DataTablePage'
export type { InputProps }         from './ui/Input'
export type { ModalProps }         from './ui/Modal'
export type { PaginationProps }    from './ui/Pagination'
export type { SectionHeaderProps } from './ui/SectionHeader'
export type { SelectProps, SelectOption } from './ui/Select'
export type { TableRowProps }      from './ui/TableRow'
export type { TextareaProps }      from './ui/Textarea'
export type { InviteBannerProps }  from './app/InviteBanner'
