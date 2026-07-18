import type { LocalNote } from '@/types/domain'
import { NoteCard } from '@/components/notes/NoteCard'

export function NoteMasonry({ notes }: { notes: LocalNote[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  )
}
