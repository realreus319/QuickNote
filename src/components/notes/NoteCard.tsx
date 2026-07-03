import { Link } from '@tanstack/react-router'
import { Image, Pin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { LocalNote } from '@/types/domain'
import { formatNoteDate } from '@/utils/date'
import { getExcerpt } from '@/utils/text'

export function NoteCard({ note }: { note: LocalNote }) {
  const attachmentCount = note.attachments?.length ?? 0

  return (
    <Link
      to="/notes/$noteId"
      params={{ noteId: note.id }}
      viewTransition
      className="bg-memo-card mb-4 block break-inside-avoid rounded-[26px] p-4 transition-transform hover:-translate-y-0.5"
      style={{
        viewTransitionName: `note-card-${note.id}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 text-[17px] leading-6 font-semibold text-text-primary">
          {note.title || '未命名便签'}
        </h3>
        {note.pinned ? <Pin className="mt-0.5 size-4 text-accent" /> : null}
      </div>

      <p className="mt-3 line-clamp-4 text-[15px] leading-7 whitespace-pre-wrap text-text-secondary">
        {getExcerpt(note.content || '点击开始记录灵感', 140)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {note.tags.filter((tag) => tag !== '全部').slice(0, 2).map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="rounded-[999px] bg-[#f4f1e2] px-2.5 py-1 text-[11px] text-text-secondary"
          >
            {tag}
          </Badge>
        ))}
        {attachmentCount ? (
          <Badge
            variant="secondary"
            className="rounded-[999px] bg-white/80 px-2.5 py-1 text-[11px] text-text-secondary"
          >
            <Image className="mr-1 size-3" />
            {attachmentCount}
          </Badge>
        ) : null}
        <span className="ml-auto text-xs text-text-muted">{formatNoteDate(note.updatedAt)}</span>
      </div>
    </Link>
  )
}
