import { CornerDownLeft, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TodoQuickAddProps {
  onSubmit: (title: string) => Promise<void>
}

export function TodoQuickAdd({ onSubmit }: TodoQuickAddProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    function handleFocus() {
      inputRef.current?.focus()
    }

    window.addEventListener('quicknote:add-todo', handleFocus)

    return () => {
      window.removeEventListener('quicknote:add-todo', handleFocus)
    }
  }, [])

  async function handleCreate() {
    const next = value.trim()

    if (!next || submitting) return

    setSubmitting(true)

    try {
      await onSubmit(next)
      setValue('')
      inputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-[14px] border border-divider bg-white p-2">
      <span className="ml-2 flex size-7 items-center justify-center rounded-full bg-[#fff7dc] text-[#8f6b0c]" aria-hidden="true">
        <Plus className="size-4" />
      </span>
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-10 min-w-0 flex-1 border-none bg-transparent px-1 shadow-none focus-visible:ring-0"
        placeholder="添加一项待办"
        aria-label="待办标题"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void handleCreate()
          }
        }}
      />
      <Button
        size="icon"
        variant="ghost"
        className="size-10 rounded-[11px] bg-surface-muted text-text-primary hover:bg-[#e9e9e4]"
        disabled={!value.trim() || submitting}
        onClick={() => void handleCreate()}
        aria-label="添加待办"
      >
        <CornerDownLeft className="size-4" />
      </Button>
    </div>
  )
}
