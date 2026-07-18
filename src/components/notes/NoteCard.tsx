import { Link } from '@tanstack/react-router'
import { CloudOff, Pin, TriangleAlert } from 'lucide-react'

import type { LocalNote } from '@/types/domain'
import { formatNoteDate } from '@/utils/date'
import { getExcerpt } from '@/utils/text'

const syncStatusMap = {
  pending: { icon: CloudOff, label: '待同步', className: 'text-text-muted' },
  error: { icon: TriangleAlert, label: '同步失败', className: 'text-[color:var(--color-danger)]' },
  conflict: { icon: TriangleAlert, label: '需要处理', className: 'text-[color:var(--color-danger)]' },
} as const

export function NoteCard({ note }: { note: LocalNote }) {
  const previewImage = note.attachments?.find((attachment) => attachment.mimeType.startsWith('image/'))
  const syncStatus = note.syncStatus === 'synced' ? null : syncStatusMap[note.syncStatus]
  const SyncIcon = syncStatus?.icon

  return (
    <Link
      to="/notes/$noteId"
      params={{ noteId: note.id }}
      viewTransition
      className="group block rounded-[15px] border border-divider bg-white p-4 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-[#d8d8d2] hover:shadow-[0_10px_28px_rgba(25,25,24,0.055)]"
      style={{ viewTransitionName: `note-card-${note.id}` }}
    >
      <article className={previewImage ? 'grid grid-cols-[minmax(0,1fr)_76px] gap-4' : ''}>
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <h3 className="line-clamp-2 min-w-0 flex-1 text-[16px] leading-6 font-semibold tracking-[-0.01em] text-text-primary">
              {note.title || '未命名便签'}
            </h3>
            {note.pinned ? <Pin className="mt-1 size-3.5 shrink-0 text-accent" aria-label="已固定" /> : null}
          </div>

          <p className="mt-2 line-clamp-3 text-[14px] leading-6 whitespace-pre-wrap text-text-secondary">
            {getExcerpt(note.content || '点击开始记录内容', 150)}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-muted">
            {note.tags
              .filter((tag) => tag !== '全部')
              .slice(0, 2)
              .map((tag) => (
                <span key={tag} className="rounded-full bg-surface-muted px-2 py-1 text-text-secondary">
                  {tag}
                </span>
              ))}
            {syncStatus && SyncIcon ? (
              <span className={`inline-flex items-center gap-1 ${syncStatus.className}`}>
                <SyncIcon className="size-3" />
                {syncStatus.label}
              </span>
            ) : null}
            <time className="ml-auto" dateTime={note.updatedAt}>
              {formatNoteDate(note.updatedAt)}
            </time>
          </div>
        </div>

        {previewImage ? (
          <img
            src={`data:${previewImage.mimeType};base64,${previewImage.base64}`}
            alt=""
            loading="lazy"
            className="h-20 w-[76px] rounded-[12px] border border-divider object-cover bg-surface-muted"
          />
        ) : null}
      </article>
    </Link>
  )
}
