import type { LocalNote } from '@/types/domain'
import { NoteCard } from '@/components/notes/NoteCard'

export function NoteMasonry({ notes }: { notes: LocalNote[] }) {
  return (
    <div className="grid min-w-0 max-w-full grid-cols-2 items-start gap-2.5 sm:gap-3 xl:grid-cols-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  )
}
