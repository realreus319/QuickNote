import { Search } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SearchInputProps {
  className?: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export function SearchInput({
  className,
  placeholder,
  value,
  onChange,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-text-secondary" />
      <Input
        className="h-12 rounded-[999px] border-none bg-field pr-4 pl-11 text-[15px] shadow-none focus-visible:ring-2 focus-visible:ring-[rgba(246,190,58,0.4)]"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}
