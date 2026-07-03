import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TodoQuickAddProps {
  onSubmit: (title: string) => Promise<void>
}

export function TodoQuickAdd({ onSubmit }: TodoQuickAddProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')

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

    if (!next) return

    await onSubmit(next)
    setValue('')
  }

  return (
    <div className="bg-memo-card flex items-center gap-3 rounded-[24px] p-3">
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="h-11 border-none bg-field"
        placeholder="添加今天要完成的事"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void handleCreate()
          }
        }}
      />
      <Button className="h-11 rounded-[18px] bg-accent px-4 text-white" onClick={() => void handleCreate()}>
        添加
      </Button>
    </div>
  )
}
