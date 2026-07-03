import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { createNote } from '@/db/notesRepo'

export function FloatingAddButton() {
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  async function handleClick() {
    if (pathname === '/notes') {
      const note = await createNote()
      await navigate({
        to: '/notes/$noteId',
        params: {
          noteId: note.id,
        },
      })
      return
    }

    if (pathname === '/todos') {
      window.dispatchEvent(new CustomEvent('quicknote:add-todo'))
    }
  }

  if (pathname !== '/notes' && pathname !== '/todos') {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-5 bottom-24 z-30 md:right-8 md:bottom-8">
      <Button
        size="icon-lg"
        className="pointer-events-auto size-14 rounded-full bg-accent text-white shadow-[0_18px_30px_rgba(246,190,58,0.35)] hover:bg-[#f0b52c]"
        onClick={() => {
          void handleClick()
        }}
      >
        <Plus className="size-6" />
      </Button>
    </div>
  )
}
