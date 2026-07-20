import type { LocalNote } from '@/types/domain'
import { NoteCard } from '@/components/notes/NoteCard'

export function NoteMasonry({ notes }: { notes: LocalNote[] }) {
  return (
    <div className="min-w-0 max-w-full columns-2 gap-2.5 sm:gap-3 xl:columns-3">
      {notes.map((note) => (
        <div
          key={note.id}
          className="mb-2.5 inline-block w-full break-inside-avoid align-top sm:mb-3"
        >
          <NoteCard note={note} />
        </div>
      ))}
    </div>
  )
}
