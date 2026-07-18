import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  className?: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}

export function SearchInput({
  className,
  placeholder,
  value,
  onChange,
  autoFocus = false,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-text-muted" />
      <Input
        className="h-12 rounded-[13px] border border-divider bg-white pr-10 pl-10 text-[15px] shadow-none transition-colors placeholder:text-text-muted focus-visible:border-[rgba(227,173,39,0.55)] focus-visible:ring-2 focus-visible:ring-[rgba(227,173,39,0.15)]"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          className="absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
          onClick={() => onChange('')}
          aria-label="清空搜索"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
