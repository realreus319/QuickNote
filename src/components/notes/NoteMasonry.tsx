import type { LocalNote } from '@/types/domain'
import { NoteCard } from '@/components/notes/NoteCard'

export function NoteMasonry({ notes }: { notes: LocalNote[] }) {
  return (
    <div className="columns-2 gap-4 md:columns-3 xl:columns-4">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  )
}
