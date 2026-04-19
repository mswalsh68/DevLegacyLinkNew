import { cn } from '@/lib/utils'

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600',
        className,
      )}
    />
  )
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingSpinner className="h-10 w-10" />
    </div>
  )
}
