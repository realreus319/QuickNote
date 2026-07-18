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
    const note = await createNote()
    await navigate({
      to: '/notes/$noteId',
      params: { noteId: note.id },
    })
  }

  if (pathname !== '/notes') {
    return null
  }

  return (
    <div className="pointer-events-none fixed right-5 bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-30 lg:hidden">
      <Button
        className="pointer-events-auto h-12 rounded-full bg-text-primary px-4 text-sm font-semibold text-white shadow-floating hover:bg-[#2a2a28]"
        onClick={() => void handleClick()}
        aria-label="新建笔记"
      >
        <Plus className="size-4" />
        新建
      </Button>
    </div>
  )
}
