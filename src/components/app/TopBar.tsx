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
      <div className="min-w-0">
        <h1 className="text-[30px] leading-[1.08] font-semibold tracking-[-0.025em] text-text-primary sm:text-[34px]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-[13px] leading-5 text-text-secondary sm:text-sm">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
