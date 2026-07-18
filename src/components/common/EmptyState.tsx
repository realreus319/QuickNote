import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-[18px] border border-dashed border-divider bg-white/55 px-6 py-10 text-center">
      <span className="mb-4 size-2 rounded-full bg-accent" aria-hidden="true" />
      <p className="text-base font-semibold text-text-primary">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
