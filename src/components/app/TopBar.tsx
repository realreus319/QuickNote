import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface TopBarProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function TopBar({ title, subtitle, actions, className }: TopBarProps) {
  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div>
        <h1 className="text-[28px] leading-none font-semibold tracking-[-0.04em] text-text-primary">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-sm text-text-secondary">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
