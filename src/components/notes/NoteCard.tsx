import { Link } from '@tanstack/react-router'
import { CloudOff, Pin, TriangleAlert } from 'lucide-react'

import type { LocalNote } from '@/types/domain'
import { formatNoteDate } from '@/utils/date'
import { normalizeNoteColor } from '@/utils/noteColor'
import { getExcerpt } from '@/utils/text'

const syncStatusMap = {
  pending: { icon: CloudOff, label: '待同步', className: 'text-[color:var(--note-muted)]' },
  error: { icon: TriangleAlert, label: '同步失败', className: 'text-[color:var(--color-danger)]' },
  conflict: { icon: TriangleAlert, label: '需要处理', className: 'text-[color:var(--color-danger)]' },
} as const

export function NoteCard({ note }: { note: LocalNote }) {
  const previewImage = note.attachments?.find(
    (attachment) =>
      attachment.mimeType.startsWith('image/') &&
      attachment.storageState !== 'remote-only' &&
      Boolean(attachment.base64),
  )
  const syncStatus = note.syncStatus === 'synced' ? null : syncStatusMap[note.syncStatus]
  const SyncIcon = syncStatus?.icon

  return (
    <Link
      to="/notes/$noteId"
      params={{ noteId: note.id }}
      viewTransition
      className="note-paper note-paper-card group block min-w-0 max-w-full overflow-hidden rounded-[15px] border p-3 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 sm:p-4"
      data-note-color={normalizeNoteColor(note.color)}
      style={{ viewTransitionName: `note-card-${note.id}` }}
    >
      <article className="flex min-w-0 max-w-full flex-col overflow-hidden">
        {previewImage ? (
          <img
            src={`data:${previewImage.mimeType};base64,${previewImage.base64}`}
            alt=""
            loading="lazy"
            decoding="async"
            className="order-first mb-3 aspect-[4/3] w-full max-w-full rounded-[11px] border border-[color:var(--note-line)] bg-[color:var(--note-paper-raised)] object-cover"
          />
        ) : null}

        <div className="min-w-0 max-w-full overflow-hidden">
          <div className="flex min-w-0 items-start gap-1.5">
            <h3 className="line-clamp-2 min-w-0 flex-1 break-words text-[15px] leading-[1.45] font-semibold tracking-[-0.01em] text-[color:var(--note-ink)] [overflow-wrap:anywhere] sm:text-[16px] sm:leading-6">
              {note.title || '未命名便签'}
            </h3>
            {note.pinned ? <Pin className="mt-1 size-3.5 shrink-0 text-[color:var(--note-accent)]" aria-label="已固定" /> : null}
          </div>

          <p className="mt-2 line-clamp-4 min-w-0 max-w-full break-words whitespace-pre-wrap text-[13px] leading-[1.65] text-[color:var(--note-muted)] [overflow-wrap:anywhere] sm:line-clamp-3 sm:text-[14px] sm:leading-6">
            {getExcerpt(note.content || '点击开始记录内容', 150)}
          </p>

          <div className="mt-3 flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden text-[10px] text-[color:var(--note-muted)] sm:mt-4 sm:text-[11px]">
            {syncStatus && SyncIcon ? (
              <span className={`inline-flex min-w-0 items-center gap-1 truncate ${syncStatus.className}`}>
                <SyncIcon className="size-3 shrink-0" />
                <span className="truncate">{syncStatus.label}</span>
              </span>
            ) : null}
            <time className="ml-auto shrink-0" dateTime={note.updatedAt}>
              {formatNoteDate(note.updatedAt)}
            </time>
          </div>
        </div>
      </article>
    </Link>
  )
}
