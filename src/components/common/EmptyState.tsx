import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-memo-card flex min-h-56 flex-col items-center justify-center rounded-[28px] px-6 py-10 text-center">
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
